-- Adds audience visibility controls for workout summary social posts.
--
-- Run after:
--   docs/supabase-social-posts.sql
--
-- Visibility values:
--   everyone  - any authenticated user can see the post
--   following - only the author and profiles the author follows can see it
--   private   - only the author can see it

begin;

alter table public.social_post
  add column if not exists visibility text;

alter table public.social_post
  alter column visibility set default 'following';

update public.social_post
set visibility = case
  when btrim(coalesce(visibility, '')) in ('everyone', 'following', 'private')
    then btrim(visibility)
  else 'following'
end;

alter table public.social_post
  alter column visibility set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'social_post_visibility_valid'
      and conrelid = 'public.social_post'::regclass
  ) then
    alter table public.social_post
      add constraint social_post_visibility_valid
      check (visibility in ('everyone', 'following', 'private'));
  end if;
end $$;

create index if not exists social_post_visibility_created_idx
  on public.social_post (visibility, created_at desc, id desc)
  where deleted_at is null;

drop policy if exists "Social posts are viewable by owners and followers"
  on public.social_post;

drop policy if exists "Social posts are viewable by owners and allowed audience"
  on public.social_post;

create policy "Social posts are viewable by owners and allowed audience"
on public.social_post
for select
to authenticated
using (
  (select auth.uid()) is not null
  and (
    author_id = (select auth.uid())
    or (
      deleted_at is null
      and (
        visibility = 'everyone'
        or (
          visibility = 'following'
          and exists (
            select 1
            from public.user_follows follow
            where follow.follower_id = public.social_post.author_id
              and follow.following_id = (select auth.uid())
          )
        )
      )
    )
  )
);

drop policy if exists "Social post likes are viewable with visible posts"
  on public.social_post_like;

create policy "Social post likes are viewable with visible posts"
on public.social_post_like
for select
to authenticated
using (
  exists (
    select 1
    from public.social_post post
    where post.id = public.social_post_like.post_id
      and post.deleted_at is null
      and (
        post.author_id = (select auth.uid())
        or post.visibility = 'everyone'
        or (
          post.visibility = 'following'
          and exists (
            select 1
            from public.user_follows follow
            where follow.follower_id = post.author_id
              and follow.following_id = (select auth.uid())
          )
        )
      )
  )
);

drop policy if exists "Users can like visible social posts"
  on public.social_post_like;

create policy "Users can like visible social posts"
on public.social_post_like
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.social_post post
    where post.id = public.social_post_like.post_id
      and post.deleted_at is null
      and (
        post.author_id = (select auth.uid())
        or post.visibility = 'everyone'
        or (
          post.visibility = 'following'
          and exists (
            select 1
            from public.user_follows follow
            where follow.follower_id = post.author_id
              and follow.following_id = (select auth.uid())
          )
        )
      )
  )
);

commit;
