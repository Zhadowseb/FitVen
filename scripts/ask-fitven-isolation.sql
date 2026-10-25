-- Proves that Ask FitVen's functions return only the caller's rows.
--
-- Run in the Supabase SQL editor after supabase/migrations/20261026090000_ask-fitven.sql.
-- It READS ONLY, and rolls back at the end - nothing is written, even the
-- temporary tables go with the transaction. Replace the one uuid below with an
-- account that has workouts (yours, or a test account), then run it whole.
--
-- What it does, as that account (role `authenticated`, auth.uid() = the uuid):
--   1. calls all eight functions, with the widest ranges they allow;
--   2. takes workout, exercise and set ids that belong to OTHER accounts - read
--      as the owner role, which row level security does not apply to - and asks
--      for them by id: ai.workout_detail must answer null for every one;
--   3. checks that no workout the AI listed, and no id in the answers, belongs to
--      anybody else;
--   4. calls them as `anon`: every call must be refused.
-- A follower can read a followed person's workouts through row level security
-- (the policy "Followed workout activity is viewable"), so step 2 only means
-- something when the other accounts have workouts - it prints how many ids it
-- tried and how many of them the account could read directly, which is the
-- reason these functions filter on the owner themselves.
--
-- Any problem raises an exception. A clean run ends with
-- NOTICE: ask-fitven isolation: ok.

begin;

-- The account to test as.
select set_config('ask.me', '00000000-0000-0000-0000-000000000000', true);

create temp table _ask_answers (name text, result jsonb);
create temp table _ask_foreign (workout_id bigint);
grant all on _ask_answers to public;
grant all on _ask_foreign to public;

-- Other accounts' workouts, read as the owner role.
insert into _ask_foreign (workout_id)
select workout.id
from public.workout_type_instance workout
where workout.user_id <> current_setting('ask.me')::uuid
order by workout.id desc
limit 50;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('ask.me'), 'role', 'authenticated')::text,
  true
);

insert into _ask_answers values ('profile_summary', ai.profile_summary(current_date));
insert into _ask_answers values ('list_workouts', ai.list_workouts(current_date - 730, current_date + 1, 60));
insert into _ask_answers values ('personal_records', ai.personal_records(null));
insert into _ask_answers values ('weekly_volume', ai.weekly_volume(current_date - 730, current_date + 1));
insert into _ask_answers values ('program_overview', ai.program_overview());
insert into _ask_answers values ('daily_steps', ai.daily_steps(current_date - 730, current_date + 1));

-- One exercise the account has done, for the history, and the other accounts'
-- workouts asked for by id.
insert into _ask_answers
select 'exercise_history',
       ai.exercise_history(
         (select instance.exercise_name
          from public.exercise_instance instance
          where instance.user_id = current_setting('ask.me')::uuid
          limit 1),
         current_date - 730, current_date + 1);

insert into _ask_answers
select 'foreign_workout_detail', coalesce(ai.workout_detail(foreign_workout.workout_id), 'null'::jsonb)
from _ask_foreign foreign_workout;

-- How many of those the account can read directly (row level security alone).
insert into _ask_answers
select 'visible_by_rls',
       to_jsonb((select count(*) from public.workout_type_instance workout
                 where workout.id in (select workout_id from _ask_foreign)));

-- The account's own newest workout, in detail.
insert into _ask_answers
select 'own_workout_detail',
       coalesce(ai.workout_detail((select workout.id from public.workout_type_instance workout
                                   where workout.user_id = current_setting('ask.me')::uuid
                                   order by workout.id desc limit 1)), 'null'::jsonb);

reset role;

do $$
declare
  v_me uuid := current_setting('ask.me')::uuid;
  v_foreign_tried integer := (select count(*) from _ask_foreign);
  v_foreign_visible integer := (select (result #>> '{}')::integer from _ask_answers where name = 'visible_by_rls');
  v_leaked integer;
  v_listed jsonb := (select result from _ask_answers where name = 'list_workouts');
  v_bad integer;
begin
  if v_me = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'put an account id in set_config(''ask.me'', ...) first';
  end if;

  -- 2. someone else's workout, asked for by id, is nothing.
  select count(*) into v_leaked
  from _ask_answers
  where name = 'foreign_workout_detail' and result <> 'null'::jsonb;

  if v_leaked > 0 then
    raise exception 'ai.workout_detail answered for % workout(s) that belong to somebody else', v_leaked;
  end if;

  -- 3. no listed workout belongs to anybody else.
  select count(*) into v_bad
  from public.workout_type_instance workout
  where workout.id in (select (entry ->> 'id')::bigint from jsonb_array_elements(v_listed -> 'workouts') entry)
    and workout.user_id <> v_me;

  if v_bad > 0 then
    raise exception 'ai.list_workouts listed % workout(s) that belong to somebody else', v_bad;
  end if;

  -- ... and nothing answered with a set or an exercise of somebody else's.
  select count(*) into v_bad
  from public.workout_type_instance workout
  where workout.user_id <> v_me
    and workout.id in (
      select (entry ->> 'id')::bigint
      from _ask_answers answer, jsonb_array_elements(coalesce(answer.result -> 'workouts', '[]'::jsonb)) entry
      where answer.name = 'list_workouts'
      union
      select (answer.result ->> 'id')::bigint
      from _ask_answers answer
      where answer.name = 'own_workout_detail'
    );

  if v_bad > 0 then
    raise exception 'an answer carried % workout id(s) that belong to somebody else', v_bad;
  end if;

  raise notice 'ask-fitven isolation: % other workout id(s) tried, % of them readable by this account through row level security alone',
    v_foreign_tried, v_foreign_visible;
end;
$$;

-- 4. anon is refused, by every function.
do $$
declare
  v_name text;
  v_refused integer := 0;
begin
  set local role anon;

  foreach v_name in array array[
    'select ai.profile_summary(null)',
    'select ai.list_workouts(null, null, 10)',
    'select ai.workout_detail(1)',
    'select ai.exercise_history(''x'', null, null)',
    'select ai.personal_records(null)',
    'select ai.weekly_volume(null, null)',
    'select ai.program_overview()',
    'select ai.daily_steps(null, null)'
  ] loop
    begin
      execute v_name;
    exception when insufficient_privilege then
      v_refused := v_refused + 1;
    end;
  end loop;

  reset role;

  if v_refused <> 8 then
    raise exception 'anon was allowed to call % of the 8 functions', 8 - v_refused;
  end if;
end;
$$;

-- The person's own answers are the ones to read through, here.
select name, left(result::text, 200) as answer from _ask_answers where name in ('profile_summary', 'list_workouts', 'own_workout_detail') order by name;

do $$ begin raise notice 'ask-fitven isolation: ok'; end; $$;

rollback;
