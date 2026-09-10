-- Blocking, and the two policy holes that make blocking meaningless without them.
--
-- Run after 20260424004053_social-search.sql.
--
-- The model is open follow plus block, not follow requests. That puts all the
-- work on the block: everything a follower can see in this app is gated on a
-- row in public.user_follows, so a block that removes those rows in both
-- directions and stops new ones from appearing shuts off activity, posts, likes
-- and push notifications without touching any of their policies.
--
-- Two things had to come with it, or the block leaks:
--   * user_follows was readable in full by any signed-in user, so a blocked
--     person could still read the follow graph.
--   * profiles was readable in full, so the whole user base could be listed and
--     a blocked person stayed findable. Search moves to a function that filters
--     blocks server-side.

/* ------------------------------------------------------------- the table -- */

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_idx
  on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;

grant select, insert, delete on table public.user_blocks to authenticated;

-- Only the blocker reads their own rows. The blocked person must not be able to
-- ask who blocked them: that is the difference between a block and a public
-- rejection, and it is what stops someone from noticing and making a second
-- account to get around it.
drop policy if exists "Users can view their own blocks" on public.user_blocks;
create policy "Users can view their own blocks"
on public.user_blocks
for select
to authenticated
using ((select auth.uid()) = blocker_id);

drop policy if exists "Users can block from their own account" on public.user_blocks;
create policy "Users can block from their own account"
on public.user_blocks
for insert
to authenticated
with check ((select auth.uid()) = blocker_id and blocker_id <> blocked_id);

drop policy if exists "Users can remove their own blocks" on public.user_blocks;
create policy "Users can remove their own blocks"
on public.user_blocks
for delete
to authenticated
using ((select auth.uid()) = blocker_id);

/* ------------------------------------------- a block severs both follows -- */

-- In a trigger rather than in the client, because the client can only delete
-- follow rows where it is the follower. Cutting the other direction, the one
-- that actually matters, needs to bypass that policy, and it has to happen in
-- the same transaction as the block or a fast client could re-follow into the
-- gap.
create or replace function private.sever_follows_on_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  delete from public.user_follows
  where (follower_id = new.blocker_id and following_id = new.blocked_id)
     or (follower_id = new.blocked_id and following_id = new.blocker_id);

  return new;
end;
$function$;

drop trigger if exists on_user_block_created on public.user_blocks;
create trigger on_user_block_created
after insert on public.user_blocks
for each row execute function private.sever_follows_on_block();

/* --------------------------------------------- follows respect the block -- */

-- A blocked person re-following is the whole thing this feature exists to stop.
--
-- This cannot be a policy check. A policy expression runs as the person doing
-- the insert, so the subquery reading user_blocks is itself filtered by the
-- policy above - and the row that matters, the one where the *other* person is
-- the blocker, is invisible to them. `not exists` would be true every time and
-- the guard would pass silently. A security definer trigger sees the whole
-- table, which is the point.
create or replace function private.reject_blocked_follow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if exists (
    select 1
    from public.user_blocks block
    where (block.blocker_id = new.following_id and block.blocked_id = new.follower_id)
       or (block.blocker_id = new.follower_id and block.blocked_id = new.following_id)
  ) then
    -- Deliberately says nothing about who blocked whom.
    raise exception 'This account cannot be followed.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$function$;

drop trigger if exists on_user_follow_created on public.user_follows;
create trigger on_user_follow_created
before insert on public.user_follows
for each row execute function private.reject_blocked_follow();

-- Was using (true): the entire follow graph of every user, readable by anyone
-- signed in. Every read in the app is about the signed-in user's own
-- relationships, so this costs nothing.
drop policy if exists "Follow rows are viewable by authenticated users" on public.user_follows;
create policy "Follow rows are viewable by authenticated users"
on public.user_follows
for select
to authenticated
using (
  (select auth.uid()) = follower_id
  or (select auth.uid()) = following_id
);

/* ------------------------------------------------- profiles need a reason -- */

-- Was using (true) as well, so `select * from profiles` handed the whole user
-- base to any signed-in client. Reading a profile now needs a relationship: it
-- is you, you follow them, or they follow you. Finding a stranger goes through
-- search_profiles below, which filters blocks.
drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
create policy "Profiles are viewable by authenticated users"
on public.profiles
for select
to authenticated
using (
  (select auth.uid()) = id
  or exists (
    select 1
    from public.user_follows follow
    where (
        follow.follower_id = (select auth.uid())
        and follow.following_id = public.profiles.id
      )
      or (
        follow.following_id = (select auth.uid())
        and follow.follower_id = public.profiles.id
      )
  )
);

-- GDPR art. 17 needs somewhere for the row to go. Deleting the auth user
-- cascades to this one, but the account-deletion function also deletes it
-- directly, and without a policy that would silently do nothing.
drop policy if exists "Users can delete their own profile" on public.profiles;
create policy "Users can delete their own profile"
on public.profiles
for delete
to authenticated
using ((select auth.uid()) = id);

/* ------------------------------------------------------------- searching -- */

-- Security definer so it can see past the profile policy above, which is the
-- point: this is the one controlled way to find someone you have no
-- relationship with. It needs a real query, caps the result set, and hides
-- anyone on either side of a block.
create or replace function public.search_profiles(
  search_query text,
  result_limit integer default 20
)
returns table (
  id uuid,
  username text,
  username_base text,
  username_code text,
  display_name text,
  bio text,
  avatar_path text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  cleaned_query text;
  viewer_id uuid;
begin
  viewer_id := auth.uid();

  if viewer_id is null then
    return;
  end if;

  cleaned_query := regexp_replace(coalesce(search_query, ''), '[^a-zA-Z0-9_#]', '', 'g');

  -- Two characters is the floor. Below that the result set is the user base
  -- with extra steps, which is the enumeration this function replaced.
  if length(cleaned_query) < 2 then
    return;
  end if;

  return query
  select
    profile.id,
    profile.username,
    profile.username_base,
    profile.username_code,
    profile.display_name,
    profile.bio,
    profile.avatar_path,
    profile.created_at,
    profile.updated_at
  from public.profiles profile
  where profile.id <> viewer_id
    and (
      profile.username ilike '%' || cleaned_query || '%'
      or profile.username_base ilike '%' || cleaned_query || '%'
      or profile.display_name ilike '%' || cleaned_query || '%'
    )
    and not exists (
      select 1
      from public.user_blocks block
      where (block.blocker_id = viewer_id and block.blocked_id = profile.id)
         or (block.blocker_id = profile.id and block.blocked_id = viewer_id)
    )
  order by profile.display_name asc
  limit least(greatest(coalesce(result_limit, 20), 1), 50);
end;
$function$;

revoke all on function public.search_profiles(text, integer) from public;
revoke all on function public.search_profiles(text, integer) from anon;
grant execute on function public.search_profiles(text, integer) to authenticated;

/* -------------------------------------------- the people you have blocked -- */

-- The block list itself needs names to show, and the blocked profiles are no
-- longer readable through public.profiles once the follow is gone - which is
-- the policy working as intended. This is the one exception.
create or replace function public.list_blocked_profiles()
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_path text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    profile.id,
    profile.username,
    profile.display_name,
    profile.avatar_path,
    block.created_at
  from public.user_blocks block
  join public.profiles profile on profile.id = block.blocked_id
  where block.blocker_id = auth.uid()
  order by block.created_at desc;
$function$;

revoke all on function public.list_blocked_profiles() from public;
revoke all on function public.list_blocked_profiles() from anon;
grant execute on function public.list_blocked_profiles() to authenticated;

notify pgrst, 'reload schema';
