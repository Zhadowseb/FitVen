-- Terms acceptance, and blocking that tells the developer.
--
-- Run after 20260912220000_ugc-safety.sql.
--
-- Both come straight from an App Review rejection under guideline 1.2. The app
-- already had filtering, reporting, blocking and a published contact address,
-- and was still rejected with:
--
--   "require that users agree to terms (EULA) and these terms must make it
--    clear that there is no tolerance for objectionable content or abusive
--    users and a mechanism for users to block abusive users (blocking should
--    also notify the developer of the inappropriate content and should remove
--    it from the user's feed instantly)."
--
-- Removing it from the feed instantly was already true: a block severs the
-- follow in both directions, and everything a follower sees is gated on that
-- row. The two missing pieces are the terms and the notification.

/* ------------------------------------------------ the terms acceptance -- */

-- Alongside the privacy consent columns from 20260905174500, and for the same
-- reason: an acceptance that is not recorded is not an acceptance, it is a tick
-- somebody drew on a screen.
alter table public.profile_private
  add column if not exists terms_version text;

alter table public.profile_private
  add column if not exists terms_accepted_at timestamptz;

comment on column public.profile_private.terms_version is
  'The TERMS_VERSION from src/Resources/Legal/termsOfUse.js that this user accepted. Null means never asked or never answered.';

comment on column public.profile_private.terms_accepted_at is
  'When the terms above were accepted, in UTC.';

/* -------------------------------------- where an automatic report came from -- */

-- Reports now arrive two ways: somebody tapped Report, or somebody blocked an
-- account and this is the notification Apple asks for. They are worth telling
-- apart when reading the queue - a deliberate report carries a human's reason,
-- an automatic one carries only the fact of the block.
--
-- A column rather than a new value in `reason`, because the reasons the client
-- offers and the reasons the column accepts are checked against each other by
-- scripts/test-ugc-safety.js, and a value the client can never send would have
-- to be special-cased there forever.
alter table public.user_reports
  add column if not exists source text not null default 'user';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_reports_source_known'
  ) then
    alter table public.user_reports
      add constraint user_reports_source_known
      check (source in ('user', 'block'));
  end if;
end;
$$;

comment on column public.user_reports.source is
  'user = somebody tapped Report. block = raised automatically when somebody blocked this account.';

/* --------------------------------------- a block notifies the developer -- */

create or replace function private.report_on_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  -- One automatic report per block. Blocking is idempotent on the client - the
  -- duplicate-key error is swallowed - so this only ever runs on a row that was
  -- genuinely new, and a block, unblock, block again does raise a second one.
  -- That is wanted: it happened twice.
  --
  -- Wrapped, because an exception here would roll the whole statement back and
  -- the block with it. Somebody asking to be left alone must not be refused
  -- because the notification failed; a lost notification is the smaller harm,
  -- and the block itself is still on record in user_blocks.
  begin
    insert into public.user_reports (
      reporter_id,
      reported_user_id,
      reason,
      note,
      source
    )
    values (
      new.blocker_id,
      new.blocked_id,
      'other',
      'Raised automatically because this account was blocked. No reason was given by the person who blocked them.',
      'block'
    );
  exception
    when others then
      raise warning 'report_on_block: could not record the block notification (%)', sqlerrm;
  end;

  return new;
end;
$function$;

-- After, not before: if writing the notification fails there is no good reason
-- to refuse the block. The person asking to be left alone comes first.
drop trigger if exists on_user_block_report on public.user_blocks;
create trigger on_user_block_report
after insert on public.user_blocks
for each row execute function private.report_on_block();
