-- A post two different people report is withdrawn from the feed on the spot,
-- and read by a person afterwards.
--
-- Run after 20260912220000_ugc-safety.sql.
--
-- Reporting already worked: `user_reports` has carried `reported_post_id`
-- since that migration, and the reports are read with the service role. What
-- was missing is what happens in the hours before anyone reads them. The
-- support page promises an answer within a day, and a promise like that cannot
-- be kept by somebody who is asleep, so the second report acts on its own.
--
-- Two different people, not one. One person reporting is one person's opinion,
-- and this app is small enough that waiting for a third would mean waiting
-- forever.

/* ------------------------------------------------------------- the column -- */

alter table public.social_post
  add column if not exists hidden_at timestamptz;

comment on column public.social_post.hidden_at is
  'Set when a post is withdrawn from the feed: automatically once two different '
  'people have reported it, or by hand during review. The author still sees '
  'their own post.';

-- The trigger below counts reports per post on every insert, and the two
-- existing indexes are on status and on the reported user.
create index if not exists user_reports_reported_post_idx
  on public.user_reports (reported_post_id)
  where reported_post_id is not null;

/* -------------------------------------------------------- hide on report -- */

-- security definer because the reporter has no update right on somebody
-- else's post and must not be given one. This function is the only thing that
-- writes the column from the app's side; review still writes it by hand with
-- the service role.
create or replace function private.hide_post_when_reported()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reporter_count integer;
begin
  if new.reported_post_id is null then
    return new;
  end if;

  -- distinct: reporting the same post five times is still one person's
  -- opinion, and the insert policy does not stop somebody doing it.
  select count(distinct report.reporter_id)
    into reporter_count
  from public.user_reports report
  where report.reported_post_id = new.reported_post_id;

  if reporter_count >= 2 then
    -- Announced to the guard below, the way the gym_lift recount does it. The
    -- guard has to refuse everyone, including this function: it runs as the
    -- definer, but so would anything else somebody talked into calling it.
    perform set_config('fitven.social_post_hide', 'on', true);

    update public.social_post
       set hidden_at = timezone('utc', now())
     where id = new.reported_post_id
       and hidden_at is null;

    perform set_config('fitven.social_post_hide', 'off', true);
  end if;

  return new;
end;
$$;

revoke all on function private.hide_post_when_reported() from public;
revoke all on function private.hide_post_when_reported() from anon;
revoke all on function private.hide_post_when_reported() from authenticated;

drop trigger if exists on_user_report_hide_post on public.user_reports;

create trigger on_user_report_hide_post
after insert on public.user_reports
for each row
execute function private.hide_post_when_reported();

/* ------------------------------------------- only the trigger may hide -- */

-- Without this the whole thing is decoration. 20260525142801_social-posts.sql
-- grants `update` on the entire table to `authenticated`, and the update
-- policy asks only whether the row is yours - so the author of a post two
-- people reported could send `{ hidden_at: null }` from their own session and
-- put it straight back in the feed. The person the hiding is aimed at was the
-- one person who could undo it.
--
-- A column-level grant would be the other way, but `grant update (...)` means
-- naming every column the client does write, and a column added later without
-- a matching grant fails at runtime in the app rather than here. This refuses
-- one column instead, and says so.
create or replace function private.reject_manual_post_hide()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.hidden_at is distinct from old.hidden_at
     and current_setting('fitven.social_post_hide', true) is distinct from 'on' then
    raise exception 'hidden_at is set by report review, not by the client.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.reject_manual_post_hide() from public;
revoke all on function private.reject_manual_post_hide() from anon;
revoke all on function private.reject_manual_post_hide() from authenticated;

drop trigger if exists on_social_post_reject_manual_hide on public.social_post;

create trigger on_social_post_reject_manual_hide
before update of hidden_at on public.social_post
for each row
execute function private.reject_manual_post_hide();

/* ------------------------------------------------- hidden from the feed -- */

-- The policy from 20260531234750_social-post-visibility.sql, unchanged except
-- for one clause: a hidden post leaves everyone's feed but its author's. The
-- author keeps seeing it, because a post that quietly vanishes for the person
-- who wrote it reads as a bug, and they are the one person the hiding is not
-- protecting.
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
