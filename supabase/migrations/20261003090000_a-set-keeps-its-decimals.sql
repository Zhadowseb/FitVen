-- A set keeps its decimals: `set.weight` and `set.rpe` become numeric.
--
-- Run after 20261001090000_dev-kpis.sql. It does not depend on
-- 20261002090000_weight-mode-per-instance.sql, and either can run first.
--
-- The phone keeps a set's weight with decimals - 102.5 kg, and 11.25 kg with a
-- weight per side - and RPE to the half point (src/Utils/setValueLimits.js).
-- These columns are whole numbers ("weight in whole kilos" in
-- 20260929090000_gym-scope-and-categories.sql), so the app truncated both on
-- upload to get past them. Everything that reads the cloud got 102 for 102.5:
-- a new phone restoring its history, the category lists, a custom exercise's
-- typical weight.
--
-- The other numbers on a set stay integers. The phone rounds reps, 1RM %, the
-- pause, the set number and an AMRAP target to whole numbers, so whole is the
-- truth there.
--
-- Plain `numeric`, with no precision. The column has to take every value the
-- integer column holds now, including typos from before the phone capped a
-- weight at 1000 kg, and the app rounds to two decimals before it sends.
--
-- What reads these columns (every file in this folder searched for the set
-- table and for weight and rpe):
--
--   * private.refresh_custom_exercise_stats (20260928090000) already casts
--     `weight::numeric`. The median and the 5 kg bars now see 102.5.
--   * private.category_rows (20260929090000), in three categories:
--       powerlifting - `weight::numeric` and `weight > 0` are unchanged. A
--         single under a rejected video is matched by
--         `trunc(judged.weight_kg) <= logged_set.weight`, which was written
--         for whole kilos, and it gives exactly the same answers as before:
--         trunc(j) is a whole number, so trunc(j) <= w holds for 102.5 exactly
--         when it held for the 102 the cloud used to have. That includes the
--         old quirk that a lighter single within the same kilo (102.25 under
--         a rejected 102.5) is still left out. Tightening that would mean
--         changing the function, not the column type.
--       fremgang - `weight::numeric / (1.0278 - 0.0278 * reps)`: nothing to
--         change.
--       calisthenics - `weight is null or weight = 0`. A set with 0.5 kg added
--         used to arrive as 0 and count as bodyweight. Now it does not, which
--         is what that rule says.
--   * workout_record_counts (20260924090000) and the dev KPIs (20261001090000)
--     read the set table, but not these columns.
--   * No view, policy, trigger, generated column, index or publication in this
--     folder names either column. Anything older than the folder is not
--     written down anywhere, so the block below asks the catalogue instead.
--     If something would stop the type change, the block stops first and
--     names it, before anything is changed. Indexes, check constraints and
--     defaults are rebuilt by Postgres as part of the change. PL/pgSQL and
--     plain SQL functions are not tied to a column's type: they are planned
--     again on their next call.
--
-- The app works whether this runs before it or after it. Until this has run,
-- the integer column refuses "102.5" (22P02). A phone with the new app then
-- sends the set once more with its decimals cut off, as before, keeps doing
-- that for the rest of the session, and never lets the cut-off copy
-- overwrite its own 102.5. After this has run, the next session sends 102.5,
-- and a set the cloud already holds cut off is sent again once, with its
-- decimals, by the phone that logged it (src/Utils/setDecimals.js).
--
-- The lock. Integer to numeric is not a relabel: Postgres rewrites the table
-- and its indexes, and has the table to itself until it is done. Both columns
-- are changed in one statement, so the table is rewritten once.
-- `lock_timeout` makes it give up rather than queue behind a live sync, which
-- is the lesson of 20260921180000_music-opt-in.sql. `statement_timeout` makes
-- a rewrite that turns out slow give up rather than hold up every set sync
-- while it runs. Either way the transaction rolls back and nothing has
-- changed; run it again when the app is quieter. One table, one transaction.
-- Measured on a laptop with Postgres 17: 2 million sets (413 MB with five
-- indexes) took 13 seconds, and set requests waited for that long. To know
-- beforehand what you are asking for:
--
--   select count(*), pg_size_pretty(pg_total_relation_size('public."set"'))
--   from public."set";
--
-- Idempotent: a column is changed only while it is still a whole-number type,
-- so a second run changes nothing.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
declare
  targets text[];
  blockers text;
begin
  select coalesce(array_agg(col.column_name::text order by col.column_name), '{}')
    into targets
  from information_schema.columns col
  where col.table_schema = 'public'
    and col.table_name = 'set'
    and col.column_name in ('weight', 'rpe')
    and col.data_type in ('smallint', 'integer', 'bigint');

  if cardinality(targets) = 0 then
    raise notice 'public."set".weight and rpe already keep decimals; nothing to do.';
    return;
  end if;

  -- What Postgres refuses to change a column's type under: a view or rule, a
  -- policy, a trigger that names the column, a function with a SQL-standard
  -- body, a publication's row filter or column list, and a generated column.
  select string_agg(
           pg_catalog.pg_describe_object(dep.classid, dep.objid, dep.objsubid),
           '; '
           order by pg_catalog.pg_describe_object(dep.classid, dep.objid, dep.objsubid)
         )
    into blockers
  from pg_catalog.pg_depend dep
  join pg_catalog.pg_attribute att
    on att.attrelid = dep.refobjid
   and att.attnum = dep.refobjsubid
  where dep.refclassid = 'pg_catalog.pg_class'::regclass
    and dep.refobjid = 'public."set"'::regclass
    and att.attname = any(targets)
    and (
      dep.classid in (
        'pg_catalog.pg_rewrite'::regclass,
        'pg_catalog.pg_policy'::regclass,
        'pg_catalog.pg_trigger'::regclass,
        'pg_catalog.pg_proc'::regclass,
        'pg_catalog.pg_publication_rel'::regclass
      )
      or (
        dep.classid = 'pg_catalog.pg_attrdef'::regclass
        and exists (
          select 1
          from pg_catalog.pg_attrdef def
          join pg_catalog.pg_attribute generated
            on generated.attrelid = def.adrelid
           and generated.attnum = def.adnum
          where def.oid = dep.objid
            and generated.attgenerated <> ''
        )
      )
    );

  if blockers is not null then
    raise exception 'public."set".% cannot become numeric while these depend on it: %',
      array_to_string(targets, ' and '), blockers
      using hint = 'Nothing was changed. Drop them, run this file, and create them again.';
  end if;

  execute (
    select 'alter table public."set" '
      || string_agg(format('alter column %1$I type numeric using %1$I::numeric', target), ', ')
    from unnest(targets) as target
  );

  raise notice 'public."set": % now numeric.', array_to_string(targets, ' and ');
end;
$$;

commit;

notify pgrst, 'reload schema';

-- Check afterwards. Both should say numeric, and the second counts the sets
-- that have decimals - 0 right after this has run, then growing as phones
-- send them:
--
--   select column_name, data_type
--   from information_schema.columns
--   where table_schema = 'public'
--     and table_name = 'set'
--     and column_name in ('weight', 'rpe');
--
--   select count(*) filter (where weight <> trunc(weight)) as weights_with_decimals,
--          count(*) filter (where rpe <> trunc(rpe)) as rpe_with_decimals
--   from public."set";
