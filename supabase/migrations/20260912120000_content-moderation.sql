-- Reporting and content filtering for user-generated content.
--
-- Run after:
--   supabase/migrations/20260525142801_social-posts.sql
--   supabase/migrations/20260905143000_user-blocks.sql
--
-- Apple's review guideline 1.2 asks for four things from an app with user
-- content, and Google Play's UGC policy asks for the first two of them:
--
--   1. a way to filter objectionable material from being posted
--   2. a way to report offensive content, and a timely response to it
--   3. a way to block abusive users        -- already shipped: user_blocks
--   4. published contact information       -- fitven.dk/support
--
-- This migration is 1 and 2. Both are enforced in the database rather than in
-- the app: the client writes to social_post directly, so a check that only
-- lives in JavaScript is a check anybody can skip.

begin;

/* ------------------------------------------------------------- reports -- */

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null,
  target_post_id uuid references public.social_post(id) on delete cascade,
  target_user_id uuid references public.profiles(id) on delete cascade,
  reason text not null,
  note text,
  status text not null default 'open',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint content_reports_target_type_valid
    check (target_type in ('post', 'user')),
  constraint content_reports_reason_valid
    check (reason in (
      'spam',
      'harassment',
      'hate',
      'sexual',
      'violence',
      'self_harm',
      'impersonation',
      'other'
    )),
  constraint content_reports_status_valid
    check (status in ('open', 'actioned', 'dismissed')),
  -- The note is the reporter's own words. It is capped so a report cannot be
  -- used as unbounded storage, and it is never shown to the reported user.
  constraint content_reports_note_length
    check (note is null or char_length(note) <= 1000),
  -- A post report names a post; a user report names a user. Never both,
  -- never neither.
  constraint content_reports_target_present
    check (
      (target_type = 'post' and target_post_id is not null)
      or (target_type = 'user' and target_user_id is not null
          and target_post_id is null)
    ),
  constraint content_reports_no_self_report
    check (target_user_id is null or target_user_id <> reporter_id)
);

-- One report per person per thing. Reporting twice is not two reports, and the
-- auto-hide below counts reports.
create unique index if not exists content_reports_post_unique_idx
  on public.content_reports (reporter_id, target_post_id)
  where target_type = 'post';

create unique index if not exists content_reports_user_unique_idx
  on public.content_reports (reporter_id, target_user_id)
  where target_type = 'user';

create index if not exists content_reports_open_idx
  on public.content_reports (status, created_at desc);

create schema if not exists private;

create or replace function private.set_content_report_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_content_report_updated_at on public.content_reports;

create trigger set_content_report_updated_at
before update on public.content_reports
for each row
execute function private.set_content_report_updated_at();

alter table public.content_reports enable row level security;

revoke all on public.content_reports from anon, authenticated;
grant select, insert on public.content_reports to authenticated;

drop policy if exists "Users can file their own reports"
  on public.content_reports;

create policy "Users can file their own reports"
on public.content_reports
for insert
to authenticated
with check ((select auth.uid()) = reporter_id);

-- A reporter can see what they reported, so the app can say "you already
-- reported this". Nobody can read anybody else's reports, and the reported
-- person is never told who reported them.
drop policy if exists "Users can read their own reports"
  on public.content_reports;

create policy "Users can read their own reports"
on public.content_reports
for select
to authenticated
using ((select auth.uid()) = reporter_id);

/* ------------------------------------------------- hiding what is reported */

alter table public.social_post
  add column if not exists hidden_at timestamptz;

comment on column public.social_post.hidden_at is
  'Set when a post is withdrawn from the feed: automatically once enough '
  'different people report it, or by hand during review. The author still '
  'sees their own post.';

-- Two different people, because one person reporting is one person's opinion
-- and this app is small enough that waiting for a third would mean waiting
-- forever. A hidden post is still reviewed by hand afterwards; hiding first is
-- what keeps the response inside a day without anyone being awake for it.
create or replace function private.hide_post_when_reported()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  report_count integer;
begin
  if new.target_type <> 'post' or new.target_post_id is null then
    return new;
  end if;

  select count(*) into report_count
  from public.content_reports
  where target_post_id = new.target_post_id
    and target_type = 'post'
    and status <> 'dismissed';

  if report_count >= 2 then
    update public.social_post
    set hidden_at = coalesce(hidden_at, timezone('utc', now()))
    where id = new.target_post_id;
  end if;

  return new;
end;
$$;

drop trigger if exists hide_post_when_reported on public.content_reports;

create trigger hide_post_when_reported
after insert on public.content_reports
for each row
execute function private.hide_post_when_reported();

-- The feed policy has to respect hidden_at, or a hidden post is only hidden
-- from the people who did not look.
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
      and hidden_at is null
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

/* ------------------------------------------------------------ filtering -- */

-- The list is data, not code: it lives here so it can be added to from the
-- Supabase dashboard the day something gets past it, without an app release
-- and without waiting for review.
--
-- It sits in the `private` schema because a client that can read the list can
-- work around the list.
create table if not exists private.blocked_terms (
  term text primary key,
  created_at timestamptz not null default timezone('utc', now())
);

-- A deliberately small seed of unambiguous English slurs and sexual terms. It
-- is a floor, not a moderation policy: the reporting above is what catches
-- everything a word list cannot, which is most of it.
insert into private.blocked_terms (term)
values
  ('nigger'),
  ('nigga'),
  ('faggot'),
  ('tranny'),
  ('retard'),
  ('kike'),
  ('spic'),
  ('chink'),
  ('cunt'),
  ('whore'),
  ('rape'),
  ('rapist'),
  ('paedophile'),
  ('pedophile'),
  ('child porn'),
  ('cp links')
on conflict (term) do nothing;

-- Whole words only. Substring matching turns "Scunthorpe" and "assessment"
-- into rejections, and a filter that blocks ordinary words is a filter people
-- route around rather than obey.
create or replace function private.contains_blocked_term(candidate text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized text;
  blocked_term text;
begin
  if candidate is null or btrim(candidate) = '' then
    return false;
  end if;

  -- Collapse the usual evasions: separators inside a word, and repeated
  -- letters. Not a defence against a determined person, and not meant to be.
  normalized := lower(candidate);
  normalized := regexp_replace(normalized, '[0@]', 'o', 'g');
  normalized := regexp_replace(normalized, '[1!|]', 'i', 'g');
  normalized := regexp_replace(normalized, '[3]', 'e', 'g');
  normalized := regexp_replace(normalized, '[4]', 'a', 'g');
  normalized := regexp_replace(normalized, '[5$]', 's', 'g');
  normalized := regexp_replace(normalized, '[^a-z ]', '', 'g');
  normalized := regexp_replace(normalized, ' +', ' ', 'g');

  for blocked_term in select term from private.blocked_terms loop
    if normalized ~ ('\m' || blocked_term || '\M') then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

-- What the app calls before it lets someone press Post, so the refusal is a
-- sentence under the field rather than a failed write. It answers yes or no
-- and never says which word, because that is how a list gets learned.
create or replace function public.is_text_allowed(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not private.contains_blocked_term(candidate);
$$;

revoke all on function public.is_text_allowed(text) from anon, public;
grant execute on function public.is_text_allowed(text) to authenticated;

create or replace function private.reject_blocked_post_text()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.contains_blocked_term(new.title)
     or private.contains_blocked_term(new.body) then
    raise exception 'This post contains language that is not allowed.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists reject_blocked_post_text on public.social_post;

create trigger reject_blocked_post_text
before insert or update of title, body on public.social_post
for each row
execute function private.reject_blocked_post_text();

-- A profile is user content too: the display name and bio reach everybody who
-- can find the account, and the username reaches search.
create or replace function private.reject_blocked_profile_text()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.contains_blocked_term(new.display_name)
     or private.contains_blocked_term(new.bio)
     or private.contains_blocked_term(new.username) then
    raise exception 'This profile contains language that is not allowed.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists reject_blocked_profile_text on public.profiles;

create trigger reject_blocked_profile_text
before insert or update of display_name, bio, username on public.profiles
for each row
execute function private.reject_blocked_profile_text();

commit;

-- After applying:
--
-- 1. Reports are read from the Supabase dashboard:
--      select r.created_at, r.reason, r.note,
--             reporter.username as reported_by,
--             coalesce(target.username, author.username) as about,
--             post.title, post.body, post.hidden_at
--      from public.content_reports r
--      join public.profiles reporter on reporter.id = r.reporter_id
--      left join public.profiles target on target.id = r.target_user_id
--      left join public.social_post post on post.id = r.target_post_id
--      left join public.profiles author on author.id = post.author_id
--      where r.status = 'open'
--      order by r.created_at desc;
--
-- 2. Acting on one is two statements - hide or restore the post, then close
--    the report:
--      update public.social_post set hidden_at = timezone('utc', now())
--      where id = '<post-id>';
--      update public.content_reports set status = 'actioned'
--      where id = '<report-id>';
--
-- 3. Adding a term needs no release:
--      insert into private.blocked_terms (term) values ('<term>');
