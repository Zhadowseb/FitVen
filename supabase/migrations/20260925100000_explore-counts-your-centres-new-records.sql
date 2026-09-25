-- Explore's "Your centre" card: how many of the centre's records were set
-- since you last looked at it, and the newest one.
--
-- Run after 20260924090000_a-friend-can-see-a-record-was-set-today.sql.
--
-- A record here is the lift at the top of an exercise's ranking at the centre
-- - rank 1 in `private.ranked_lifts` with the centre's own scope - so it
-- counts by exactly the rules the centre's leaderboard ranks by, and a lift
-- the leaderboard would not rank is not a record here either. Two lifts tied
-- at the top are two records.
--
-- `since` is the viewer's own last visit to the centre's page, which the app
-- keeps on the phone. Null counts every standing record.
--
-- Security definer for the same reason as gym_leaderboard_overview, whose
-- gate it borrows: `private.gym_summary` returns null for a centre the viewer
-- may not see, and so does this.
--
-- Until this has run, the app gets "function does not exist" and the card
-- shows the centre without its records. Safe to run twice.

begin;

create or replace function public.gym_recent_records(
  target_gym_id bigint,
  since timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  gym_json jsonb;
  new_count integer;
  latest_json jsonb;
begin
  if viewer_id is null then
    return null;
  end if;

  gym_json := private.gym_summary(target_gym_id, viewer_id);

  if gym_json is null then
    return null;
  end if;

  with records as (
    select ranked.lift_id, ranked.performed_at, ranked.row_json
    from private.ranked_lifts(viewer_id, target_gym_id, null, 'gym', 'kg') ranked
    where ranked.rank = 1
  )
  select
    (select count(*)::integer from records where since is null or records.performed_at > since),
    (select records.row_json from records order by records.performed_at desc, records.lift_id desc limit 1)
  into new_count, latest_json;

  return jsonb_build_object(
    'gym', gym_json,
    'new_count', coalesce(new_count, 0),
    'latest', latest_json
  );
end;
$$;

revoke all on function public.gym_recent_records(bigint, timestamptz) from public, anon;
grant execute on function public.gym_recent_records(bigint, timestamptz) to authenticated;

commit;
