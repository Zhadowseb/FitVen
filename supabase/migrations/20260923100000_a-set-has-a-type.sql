-- A set is a warm-up, a working set, a drop set or an AMRAP set.
--
-- Run after 20260922100000_the-note-column-leaves-the-old-exercises.sql.
--
-- MUST RUN BEFORE ANY CLIENT ON 2.2.0 SYNCS. The app now asks for
-- `set_type` and `amrap_target` when it reads sets, and PostgREST refuses a
-- select that names a column that does not exist - so on a project without
-- these two, every set pull fails and no set reaches any device. Migrate first,
-- then ship.
--
-- `set_type` is the one truth about what kind of set a set is. `amrap` came
-- first - a boolean on every set, predating this folder - and it stays as a
-- mirror, because older app versions in the field read and write it and have
-- never heard of `set_type`. The app writes both together on every save.
--
-- The backfill is the same rule the app applies locally (db.js) and on every
-- read (Utils/setTypes.js): a working set with the flag up is an AMRAP set.
-- Both sides land on the same answer, so no row needs re-uploading to agree.
--
-- `amrap::text` rather than `amrap = true`: the column is older than any
-- recorded migration and its type is not written down here. The client sends
-- booleans, so it is almost certainly `boolean`, but a backfill against the
-- live project is not the place for "almost". Cast to text, both a boolean and
-- an integer column compare correctly.

begin;

alter table public."set"
  add column if not exists set_type text not null default 'working';

alter table public."set"
  add column if not exists amrap_target integer;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'set_type_known'
      and conrelid = 'public."set"'::regclass
  ) then
    alter table public."set"
      add constraint set_type_known
      check (set_type in ('warmup', 'working', 'drop', 'amrap'));
  end if;
end;
$$;

update public."set"
set set_type = 'amrap'
where amrap::text in ('true', '1', 't')
  and set_type = 'working';

commit;

notify pgrst, 'reload schema';

-- Check afterwards. The first should be 0: every AMRAP flag has its type.
--
--   select count(*) from public."set"
--   where amrap::text in ('true', '1', 't') and set_type <> 'amrap';
--
--   select set_type, count(*) from public."set" group by set_type;
