-- A workout post knows the centre its workout was done in.
--
-- Run after 20260925100000_explore-counts-your-centres-new-records.sql.
--
-- The centre was already on the workout (`workout_type_instance.gym_id`, set
-- when the workout is matched to a centre), but a post could not reach it: a
-- reader may see the post and not the workout under it, since followed
-- workouts are only open from yesterday to tomorrow. So the post carries its
-- own copy - and a card can say where, and Explore can show the posts from
-- your centres.
--
-- It is kept in step by two triggers rather than by the app: a post takes its
-- workout's centre as it is written, and a workout matched to a centre after
-- its post went out - the match can land a moment later - passes the centre
-- on. The posts that exist are filled in once, below.
--
-- The column is read under the policies that already govern social_post, so
-- it shows nothing about a post the reader could not see anyway.
--
-- Until this has run, the app gets "column does not exist" when it asks, and
-- shows posts without a centre and no centre posts on Explore. Safe to run
-- twice.

begin;

alter table public.social_post
  add column if not exists gym_id bigint references public.gym(id) on delete set null;

create index if not exists social_post_gym_created_idx
  on public.social_post (gym_id, created_at desc)
  where deleted_at is null and gym_id is not null;

update public.social_post post
set gym_id = workout.gym_id
from public.workout_type_instance workout
where workout.id = post.source_workout_type_instance_id
  and post.gym_id is distinct from workout.gym_id;

create or replace function private.social_post_takes_its_workouts_gym()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select workout.gym_id
  into new.gym_id
  from public.workout_type_instance workout
  where workout.id = new.source_workout_type_instance_id;

  return new;
end;
$$;

drop trigger if exists social_post_takes_its_workouts_gym on public.social_post;
create trigger social_post_takes_its_workouts_gym
  before insert or update of source_workout_type_instance_id on public.social_post
  for each row
  execute function private.social_post_takes_its_workouts_gym();

create or replace function private.workout_passes_its_gym_to_its_posts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.social_post
  set gym_id = new.gym_id
  where source_workout_type_instance_id = new.id
    and gym_id is distinct from new.gym_id;

  return new;
end;
$$;

drop trigger if exists workout_passes_its_gym_to_its_posts on public.workout_type_instance;
create trigger workout_passes_its_gym_to_its_posts
  after update of gym_id on public.workout_type_instance
  for each row
  when (old.gym_id is distinct from new.gym_id)
  execute function private.workout_passes_its_gym_to_its_posts();

commit;
