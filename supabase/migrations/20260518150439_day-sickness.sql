-- Adds day-level sickness tracking used by FitApp clients.
-- Run this against the Supabase project before shipping clients that sync
-- Day.is_sick.

alter table public."Day"
  add column if not exists is_sick boolean not null default false;
