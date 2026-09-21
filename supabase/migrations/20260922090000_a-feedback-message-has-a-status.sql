-- A feedback message can be triaged, not just read.
--
-- Run after 20260921230000_the-admin-guard-asks-who-is-asking.sql.
--
-- `read_at` says the message has been looked at. It does not say what was
-- decided about it, which is the thing worth keeping: an inbox of sixty
-- messages where every one is "read" is the same inbox as one where none of
-- them are.
--
-- Four states, because that is the whole of the decision:
--
--   new        nothing decided yet - the state every message arrives in
--   planned    going to be done
--   fixed      done
--   not_fixed  looked at, and deliberately not being done
--
-- `not_fixed` is one state rather than two. "Won't fix" and "can't reproduce"
-- read differently to somebody writing a bug tracker and identically to the
-- one person reading this screen: not happening. A fifth state nobody uses
-- costs a chip on a 390 dp row.
--
-- Deliberately not here: a "duplicate" state. It needs a second message to
-- point at, which is a column and a join and a way to pick the other one, and
-- nothing on this screen asks for that yet.

begin;

alter table public."Feedback"
  add column if not exists status text not null default 'new';

alter table public."Feedback"
  add column if not exists status_changed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'feedback_status_known'
      and conrelid = 'public."Feedback"'::regclass
  ) then
    alter table public."Feedback"
      add constraint feedback_status_known
      check (status in ('new', 'planned', 'fixed', 'not_fixed'));
  end if;
end;
$$;

-- Nobody legitimately sends a message that is already triaged, and the insert
-- policy lets any signed-in account write its own row - so without this,
-- somebody could post a suggestion already marked `fixed` and have it read as
-- dealt with. The column grants cannot help here: Postgres ignores a
-- column-level revoke when the role holds the privilege on the table, which
-- `authenticated` has.
create or replace function private.feedback_arrives_untriaged()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.status := 'new';
  new.status_changed_at := null;

  return new;
end;
$$;

drop trigger if exists feedback_arrives_untriaged on public."Feedback";
create trigger feedback_arrives_untriaged
before insert on public."Feedback"
for each row
execute function private.feedback_arrives_untriaged();

-- The list is read newest first and the screen counts what is still open, so
-- both of those want the column to be cheap to ask about.
create index if not exists feedback_status_idx
  on public."Feedback" (status, created_at desc);

commit;

notify pgrst, 'reload schema';
