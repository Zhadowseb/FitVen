-- Truncates stored birth dates to the year.
--
-- The app only uses the birth date to work out an age for heart rate zones, so
-- the day and month were more than it needed. New values are already stored as
-- the 1st of January; this brings the rows that were written before that.
--
-- Run once in the Supabase SQL editor. It is safe to run again.

update public.profile_private
set
  birth_date = date_trunc('year', birth_date)::date,
  updated_at = timezone('utc', now())
where birth_date is not null
  and birth_date <> date_trunc('year', birth_date)::date;
