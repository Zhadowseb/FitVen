-- Drops the seven *_template tables, if they are genuinely empty.
--
-- They turned up in the security review as tables with RLS enabled but not a
-- single policy, which makes them unreachable for the app. They appear nowhere
-- in the repository and never have in 790 commits, so they were created in the
-- dashboard and never wired to anything. The names mirror the whole program
-- hierarchy, so they look like the start of a program-templates feature that
-- was never finished.
--
-- pg_stat_user_tables.n_live_tup is only an estimate, so this counts for real
-- and refuses to drop a table that holds anything. Run it in the SQL editor;
-- read the notices it prints.
--
-- If you would rather keep them for a future templates feature, do not run
-- this - but give them policies, or the app will silently read zero rows.

do $$
declare
  target text;
  row_count bigint;
  dropped int := 0;
  kept int := 0;
begin
  foreach target in array array[
    'set_template',
    'exercise_instance_template',
    'workout_template',
    'day_template',
    'microcycle_template',
    'mesocycle_template',
    'program_template'
  ]
  loop
    if to_regclass('public.' || quote_ident(target)) is null then
      raise notice '% does not exist, skipping', target;
      continue;
    end if;

    execute format('select count(*) from public.%I', target) into row_count;

    if row_count = 0 then
      execute format('drop table public.%I cascade', target);
      raise notice 'dropped % (was empty)', target;
      dropped := dropped + 1;
    else
      raise notice 'KEPT %: it holds % row(s) - look at it before dropping', target, row_count;
      kept := kept + 1;
    end if;
  end loop;

  raise notice 'done: % dropped, % kept', dropped, kept;
end $$;
