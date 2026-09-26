-- Once a day, ask the store-stats Edge Function to fill in the dev
-- dashboard's App Store numbers.
--
-- Run after 20260921220000_dev-dashboard.sql, which creates store_stats.
--
-- This file holds no secret, and it does nothing on its own. The job reads
-- the project's address and the shared secret from Vault by name every time
-- it runs, so they have to be created there - not here - along with the
-- function's own secrets and the function itself:
--
--   Function secrets (Dashboard -> Edge Functions -> Secrets, or
--   npx supabase secrets set NAME=value --project-ref <project-ref>):
--     ASC_PRIVATE_KEY          the whole .p8 file of the App Store Connect team
--                              key, its BEGIN and END lines included
--     ASC_KEY_ID               that key's id
--     ASC_ISSUER_ID            the issuer id shown above the team keys
--     ASC_VENDOR_NUMBER        the vendor number, from Payments and Financial
--                              Reports
--     STORE_STATS_CRON_SECRET  a long random string, e.g. openssl rand -hex 32
--
--   Vault secrets (the dashboard's Vault page, or
--   select vault.create_secret('<value>', '<name>');):
--     project_url              https://<project-ref>.supabase.co
--     store_stats_cron_secret  the same string as STORE_STATS_CRON_SECRET
--
--   The function:
--     npx supabase functions deploy store-stats --no-verify-jwt --project-ref <project-ref>
--
-- Until both Vault secrets exist, the job wakes up every morning and sends
-- nothing: the select in it has no row to send from. Until the function is
-- deployed with its secrets, what the job sends is refused and nothing is
-- written. Either way store_stats is left as it is, and a day without a row is
-- an em dash on the dashboard, never a zero.
--
-- 06:15 UTC. Apple's day is Pacific Time, and a day's report is ready by about
-- 8 a.m. PT the morning after. At 06:15 UTC it is still the evening before in
-- California, so the newest report is the one for the Pacific day before that -
-- ready for most of a day by then. Any hour works, because a day that is not
-- ready yet is simply asked for again by the next run; an hour after 17:00 UTC
-- would bring each day in half a day sooner.

begin;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Unscheduled first, so running this twice leaves one job rather than two,
-- and a changed hour or command replaces the old one instead of joining it.
select cron.unschedule(jobid)
from cron.job
where jobname = 'store-stats-ios-daily';

-- The timeout: a first run asks Apple for thirty days one after another, and
-- pg_net's default of two seconds would give up long before the function
-- answers - and the answer, with what each day came to, is what
-- net._http_response keeps.
select cron.schedule(
  'store-stats-ios-daily',
  '15 6 * * *',
  $job$
  select net.http_post(
    url := rtrim(secret.project_url, '/') || '/functions/v1/store-stats',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-store-stats-secret', secret.cron_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  )
  from (
    select
      (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') as project_url,
      (select decrypted_secret from vault.decrypted_secrets where name = 'store_stats_cron_secret') as cron_secret
  ) as secret
  where secret.project_url is not null
    and secret.cron_secret is not null;
  $job$
);

commit;
