create table if not exists public.profile_private (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  birth_date date,
  manual_max_heart_rate smallint,
  measured_max_heart_rate smallint,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profile_private_birth_date_minimum
    check (birth_date is null or birth_date >= date '1900-01-01'),
  constraint profile_private_manual_max_heart_rate_range
    check (manual_max_heart_rate is null or manual_max_heart_rate between 60 and 250),
  constraint profile_private_measured_max_heart_rate_range
    check (measured_max_heart_rate is null or measured_max_heart_rate between 60 and 250)
);

alter table public.profile_private
  add column if not exists manual_max_heart_rate smallint;
alter table public.profile_private
  add column if not exists measured_max_heart_rate smallint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profile_private_manual_max_heart_rate_range'
      and conrelid = 'public.profile_private'::regclass
  ) then
    alter table public.profile_private
      add constraint profile_private_manual_max_heart_rate_range
      check (manual_max_heart_rate is null or manual_max_heart_rate between 60 and 250);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profile_private_measured_max_heart_rate_range'
      and conrelid = 'public.profile_private'::regclass
  ) then
    alter table public.profile_private
      add constraint profile_private_measured_max_heart_rate_range
      check (measured_max_heart_rate is null or measured_max_heart_rate between 60 and 250);
  end if;
end;
$$;

alter table public.profile_private enable row level security;

grant select, insert, update, delete
on table public.profile_private
to authenticated;

drop policy if exists "Users can view their own private profile" on public.profile_private;
create policy "Users can view their own private profile"
on public.profile_private
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own private profile" on public.profile_private;
create policy "Users can insert their own private profile"
on public.profile_private
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own private profile" on public.profile_private;
create policy "Users can update their own private profile"
on public.profile_private
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own private profile" on public.profile_private;
create policy "Users can delete their own private profile"
on public.profile_private
for delete
to authenticated
using ((select auth.uid()) = user_id);

notify pgrst, 'reload schema';
