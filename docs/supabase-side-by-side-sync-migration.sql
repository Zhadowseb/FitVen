-- Side-by-side sync migration for FitApp program hierarchy data.
-- Run after taking a Supabase backup/export.

begin;

alter table public."Program" add column if not exists last_updated timestamptz;
alter table public."Program" add column if not exists is_deleting boolean not null default false;
alter table public."Program" add column if not exists delete_requested_at timestamptz;
alter table public."Program" add column if not exists local_watchers integer not null default 0;

alter table public."Mesocycle" add column if not exists last_updated timestamptz;
alter table public."Mesocycle" add column if not exists is_deleting boolean not null default false;
alter table public."Mesocycle" add column if not exists delete_requested_at timestamptz;
alter table public."Mesocycle" add column if not exists local_watchers integer not null default 0;

alter table public."Microcycle" add column if not exists last_updated timestamptz;
alter table public."Microcycle" add column if not exists is_deleting boolean not null default false;
alter table public."Microcycle" add column if not exists delete_requested_at timestamptz;
alter table public."Microcycle" add column if not exists local_watchers integer not null default 0;

alter table public."Day" add column if not exists last_updated timestamptz;
alter table public."Day" add column if not exists is_deleting boolean not null default false;
alter table public."Day" add column if not exists delete_requested_at timestamptz;
alter table public."Day" add column if not exists local_watchers integer not null default 0;

alter table public.workout_type_instance add column if not exists last_updated timestamptz;
alter table public.workout_type_instance add column if not exists is_deleting boolean not null default false;
alter table public.workout_type_instance add column if not exists delete_requested_at timestamptz;
alter table public.workout_type_instance add column if not exists local_watchers integer not null default 0;

alter table public.exercise_instance add column if not exists last_updated timestamptz;
alter table public.exercise_instance add column if not exists is_deleting boolean not null default false;
alter table public.exercise_instance add column if not exists delete_requested_at timestamptz;
alter table public.exercise_instance add column if not exists local_watchers integer not null default 0;

alter table public."set" add column if not exists last_updated timestamptz;
alter table public."set" add column if not exists is_deleting boolean not null default false;
alter table public."set" add column if not exists delete_requested_at timestamptz;
alter table public."set" add column if not exists local_watchers integer not null default 0;

update public."Program"
set last_updated = coalesce(
      last_updated,
      case
        when sync_version >= 100000000000 then to_timestamp(sync_version / 1000.0)
        when sync_version > 0 then to_timestamp(sync_version)
        else null
      end,
      deleted_at,
      timezone('utc', now())
    ),
    is_deleting = coalesce(is_deleting, false) or deleted_at is not null,
    delete_requested_at = case
      when deleted_at is not null then coalesce(delete_requested_at, deleted_at)
      else delete_requested_at
    end,
    local_watchers = coalesce(local_watchers, 0);

update public."Mesocycle"
set last_updated = coalesce(
      last_updated,
      case
        when sync_version >= 100000000000 then to_timestamp(sync_version / 1000.0)
        when sync_version > 0 then to_timestamp(sync_version)
        else null
      end,
      deleted_at,
      timezone('utc', now())
    ),
    is_deleting = coalesce(is_deleting, false) or deleted_at is not null,
    delete_requested_at = case
      when deleted_at is not null then coalesce(delete_requested_at, deleted_at)
      else delete_requested_at
    end,
    local_watchers = coalesce(local_watchers, 0);

update public."Microcycle"
set last_updated = coalesce(
      last_updated,
      case
        when sync_version >= 100000000000 then to_timestamp(sync_version / 1000.0)
        when sync_version > 0 then to_timestamp(sync_version)
        else null
      end,
      deleted_at,
      timezone('utc', now())
    ),
    is_deleting = coalesce(is_deleting, false) or deleted_at is not null,
    delete_requested_at = case
      when deleted_at is not null then coalesce(delete_requested_at, deleted_at)
      else delete_requested_at
    end,
    local_watchers = coalesce(local_watchers, 0);

update public."Day"
set last_updated = coalesce(
      last_updated,
      case
        when sync_version >= 100000000000 then to_timestamp(sync_version / 1000.0)
        when sync_version > 0 then to_timestamp(sync_version)
        else null
      end,
      deleted_at,
      timezone('utc', now())
    ),
    is_deleting = coalesce(is_deleting, false) or deleted_at is not null,
    delete_requested_at = case
      when deleted_at is not null then coalesce(delete_requested_at, deleted_at)
      else delete_requested_at
    end,
    local_watchers = coalesce(local_watchers, 0);

update public.workout_type_instance
set last_updated = coalesce(
      last_updated,
      case
        when sync_version >= 100000000000 then to_timestamp(sync_version / 1000.0)
        when sync_version > 0 then to_timestamp(sync_version)
        else null
      end,
      deleted_at,
      timezone('utc', now())
    ),
    is_deleting = coalesce(is_deleting, false) or deleted_at is not null,
    delete_requested_at = case
      when deleted_at is not null then coalesce(delete_requested_at, deleted_at)
      else delete_requested_at
    end,
    local_watchers = coalesce(local_watchers, 0);

update public.exercise_instance
set last_updated = coalesce(
      last_updated,
      case
        when sync_version >= 100000000000 then to_timestamp(sync_version / 1000.0)
        when sync_version > 0 then to_timestamp(sync_version)
        else null
      end,
      deleted_at,
      timezone('utc', now())
    ),
    is_deleting = coalesce(is_deleting, false) or deleted_at is not null,
    delete_requested_at = case
      when deleted_at is not null then coalesce(delete_requested_at, deleted_at)
      else delete_requested_at
    end,
    local_watchers = coalesce(local_watchers, 0);

update public."set"
set last_updated = coalesce(
      last_updated,
      case
        when sync_version >= 100000000000 then to_timestamp(sync_version / 1000.0)
        when sync_version > 0 then to_timestamp(sync_version)
        else null
      end,
      deleted_at,
      timezone('utc', now())
    ),
    is_deleting = coalesce(is_deleting, false) or deleted_at is not null,
    delete_requested_at = case
      when deleted_at is not null then coalesce(delete_requested_at, deleted_at)
      else delete_requested_at
    end,
    local_watchers = coalesce(local_watchers, 0);

alter table public."Program" alter column last_updated set default timezone('utc', now());
alter table public."Program" alter column last_updated set not null;
alter table public."Program" alter column is_deleting set default false;
alter table public."Program" alter column is_deleting set not null;
alter table public."Program" alter column local_watchers set default 0;
alter table public."Program" alter column local_watchers set not null;
alter table public."Mesocycle" alter column last_updated set default timezone('utc', now());
alter table public."Mesocycle" alter column last_updated set not null;
alter table public."Mesocycle" alter column is_deleting set default false;
alter table public."Mesocycle" alter column is_deleting set not null;
alter table public."Mesocycle" alter column local_watchers set default 0;
alter table public."Mesocycle" alter column local_watchers set not null;
alter table public."Microcycle" alter column last_updated set default timezone('utc', now());
alter table public."Microcycle" alter column last_updated set not null;
alter table public."Microcycle" alter column is_deleting set default false;
alter table public."Microcycle" alter column is_deleting set not null;
alter table public."Microcycle" alter column local_watchers set default 0;
alter table public."Microcycle" alter column local_watchers set not null;
alter table public."Day" alter column last_updated set default timezone('utc', now());
alter table public."Day" alter column last_updated set not null;
alter table public."Day" alter column is_deleting set default false;
alter table public."Day" alter column is_deleting set not null;
alter table public."Day" alter column local_watchers set default 0;
alter table public."Day" alter column local_watchers set not null;
alter table public.workout_type_instance alter column last_updated set default timezone('utc', now());
alter table public.workout_type_instance alter column last_updated set not null;
alter table public.workout_type_instance alter column is_deleting set default false;
alter table public.workout_type_instance alter column is_deleting set not null;
alter table public.workout_type_instance alter column local_watchers set default 0;
alter table public.workout_type_instance alter column local_watchers set not null;
alter table public.exercise_instance alter column last_updated set default timezone('utc', now());
alter table public.exercise_instance alter column last_updated set not null;
alter table public.exercise_instance alter column is_deleting set default false;
alter table public.exercise_instance alter column is_deleting set not null;
alter table public.exercise_instance alter column local_watchers set default 0;
alter table public.exercise_instance alter column local_watchers set not null;
alter table public."set" alter column last_updated set default timezone('utc', now());
alter table public."set" alter column last_updated set not null;
alter table public."set" alter column is_deleting set default false;
alter table public."set" alter column is_deleting set not null;
alter table public."set" alter column local_watchers set default 0;
alter table public."set" alter column local_watchers set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'program_local_watchers_nonnegative'
  ) then
    alter table public."Program"
      add constraint program_local_watchers_nonnegative check (local_watchers >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'mesocycle_local_watchers_nonnegative'
  ) then
    alter table public."Mesocycle"
      add constraint mesocycle_local_watchers_nonnegative check (local_watchers >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'microcycle_local_watchers_nonnegative'
  ) then
    alter table public."Microcycle"
      add constraint microcycle_local_watchers_nonnegative check (local_watchers >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'day_local_watchers_nonnegative'
  ) then
    alter table public."Day"
      add constraint day_local_watchers_nonnegative check (local_watchers >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'workout_type_instance_local_watchers_nonnegative'
  ) then
    alter table public.workout_type_instance
      add constraint workout_type_instance_local_watchers_nonnegative check (local_watchers >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'exercise_instance_local_watchers_nonnegative'
  ) then
    alter table public.exercise_instance
      add constraint exercise_instance_local_watchers_nonnegative check (local_watchers >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'set_local_watchers_nonnegative'
  ) then
    alter table public."set"
      add constraint set_local_watchers_nonnegative check (local_watchers >= 0);
  end if;
end $$;

create table if not exists public.sync_local_watchers (
  sync_local_watcher_id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on update cascade on delete cascade,
  entity_table text not null check (
    entity_table in (
      'Program',
      'Mesocycle',
      'Microcycle',
      'Day',
      'workout_type_instance',
      'exercise_instance',
      'set'
    )
  ),
  entity_id bigint not null,
  device_id uuid not null,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  unique (user_id, entity_table, entity_id, device_id)
);

create index if not exists sync_local_watchers_entity_idx
  on public.sync_local_watchers (entity_table, entity_id, user_id);

create index if not exists sync_local_watchers_device_idx
  on public.sync_local_watchers (user_id, device_id);

alter table public.sync_local_watchers enable row level security;

drop policy if exists "Users can view own sync watchers" on public.sync_local_watchers;
create policy "Users can view own sync watchers"
on public.sync_local_watchers
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own sync watchers" on public.sync_local_watchers;
create policy "Users can insert own sync watchers"
on public.sync_local_watchers
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own sync watchers" on public.sync_local_watchers;
create policy "Users can update own sync watchers"
on public.sync_local_watchers
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own sync watchers" on public.sync_local_watchers;
create policy "Users can delete own sync watchers"
on public.sync_local_watchers
for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.refresh_sync_local_watchers_count(
  target_user_id uuid,
  target_entity_table text,
  target_entity_id bigint
)
returns void
language plpgsql
as $$
declare
  watcher_count integer;
begin
  select count(*)::integer
    into watcher_count
  from public.sync_local_watchers
  where user_id = target_user_id
    and entity_table = target_entity_table
    and entity_id = target_entity_id;

  case target_entity_table
    when 'Program' then
      update public."Program"
      set local_watchers = watcher_count
      where user_id = target_user_id and id = target_entity_id;
    when 'Mesocycle' then
      update public."Mesocycle"
      set local_watchers = watcher_count
      where user_id = target_user_id and id = target_entity_id;
    when 'Microcycle' then
      update public."Microcycle"
      set local_watchers = watcher_count
      where user_id = target_user_id and id = target_entity_id;
    when 'Day' then
      update public."Day"
      set local_watchers = watcher_count
      where user_id = target_user_id and id = target_entity_id;
    when 'workout_type_instance' then
      update public.workout_type_instance
      set local_watchers = watcher_count
      where user_id = target_user_id and id = target_entity_id;
    when 'exercise_instance' then
      update public.exercise_instance
      set local_watchers = watcher_count
      where user_id = target_user_id and id = target_entity_id;
    when 'set' then
      update public."set"
      set local_watchers = watcher_count
      where user_id = target_user_id and id = target_entity_id;
  end case;
end;
$$;

create or replace function public.sync_local_watchers_refresh_count_trigger()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.refresh_sync_local_watchers_count(
      new.user_id,
      new.entity_table,
      new.entity_id
    );
  end if;

  if tg_op in ('DELETE', 'UPDATE') then
    perform public.refresh_sync_local_watchers_count(
      old.user_id,
      old.entity_table,
      old.entity_id
    );
  end if;

  return null;
end;
$$;

drop trigger if exists sync_local_watchers_refresh_count on public.sync_local_watchers;
create trigger sync_local_watchers_refresh_count
after insert or update or delete on public.sync_local_watchers
for each row
execute function public.sync_local_watchers_refresh_count_trigger();

create index if not exists program_sync_last_updated_idx
  on public."Program" (user_id, last_updated)
  where is_deleting = false;

create index if not exists mesocycle_sync_last_updated_idx
  on public."Mesocycle" (user_id, last_updated)
  where is_deleting = false;

create index if not exists microcycle_sync_last_updated_idx
  on public."Microcycle" (user_id, last_updated)
  where is_deleting = false;

create index if not exists day_sync_last_updated_idx
  on public."Day" (user_id, last_updated)
  where is_deleting = false;

create index if not exists workout_type_instance_sync_last_updated_idx
  on public.workout_type_instance (user_id, last_updated)
  where is_deleting = false;

create index if not exists exercise_instance_sync_last_updated_idx
  on public.exercise_instance (user_id, last_updated)
  where is_deleting = false;

create index if not exists set_sync_last_updated_idx
  on public."set" (user_id, last_updated)
  where is_deleting = false;

do $$
begin
  if to_regclass('public.workout_type_instance') is not null then
    drop policy if exists "Followed workout activity is viewable" on public.workout_type_instance;

    create policy "Followed workout activity is viewable"
    on public.workout_type_instance
    for select
    to authenticated
    using (
      ((select auth.uid()) = user_id)
      or (
        deleted_at is null
        and coalesce(is_deleting, false) = false
        and date >= current_date - 1
        and date <= current_date + 1
        and exists (
          select 1
          from public.user_follows follow
          where follow.follower_id = (select auth.uid())
            and follow.following_id = public.workout_type_instance.user_id
        )
      )
    );
  end if;
end $$;

commit;

-- Preflight checks after migration:
--
-- select 'Program' as table_name, count(*) as missing_last_updated
-- from public."Program" where last_updated is null
-- union all select 'Mesocycle', count(*) from public."Mesocycle" where last_updated is null
-- union all select 'Microcycle', count(*) from public."Microcycle" where last_updated is null
-- union all select 'Day', count(*) from public."Day" where last_updated is null
-- union all select 'workout_type_instance', count(*) from public.workout_type_instance where last_updated is null
-- union all select 'exercise_instance', count(*) from public.exercise_instance where last_updated is null
-- union all select 'set', count(*) from public."set" where last_updated is null;
--
-- select user_id, local_set_id, count(*)
-- from public."set"
-- where local_set_id is not null
-- group by user_id, local_set_id
-- having count(*) > 1;
--
-- select 'Mesocycle' as table_name, count(*) as orphan_rows
-- from public."Mesocycle" child
-- left join public."Program" parent
--   on parent.user_id = child.user_id and parent.id = child.cloud_program_id
-- where child.cloud_program_id is not null and parent.id is null
-- union all select 'Microcycle', count(*)
-- from public."Microcycle" child
-- left join public."Mesocycle" parent
--   on parent.user_id = child.user_id and parent.id = child.cloud_mesocycle_id
-- where child.cloud_mesocycle_id is not null and parent.id is null
-- union all select 'Day', count(*)
-- from public."Day" child
-- left join public."Microcycle" parent
--   on parent.user_id = child.user_id and parent.id = child.cloud_microcycle_id
-- where child.cloud_microcycle_id is not null and parent.id is null
-- union all select 'workout_type_instance', count(*)
-- from public.workout_type_instance child
-- left join public."Day" parent
--   on parent.user_id = child.user_id and parent.id = child.cloud_day_id
-- where child.cloud_day_id is not null and parent.id is null
-- union all select 'exercise_instance', count(*)
-- from public.exercise_instance child
-- left join public.workout_type_instance parent
--   on parent.user_id = child.user_id and parent.id = child.cloud_workout_type_instance_id
-- where child.cloud_workout_type_instance_id is not null and parent.id is null
-- union all select 'set', count(*)
-- from public."set" child
-- left join public.exercise_instance parent
--   on parent.user_id = child.user_id and parent.id = child.cloud_exercise_instance_id
-- where child.cloud_exercise_instance_id is not null and parent.id is null;
