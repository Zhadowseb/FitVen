-- The price of training at one centre, for the card that opens when you tap a
-- pin on the map.
--
-- Run after:
--   supabase/migrations/20260917120100_workout-music.sql
--
-- Only the single-centre membership: what it costs to train at this one
-- centre and no other. The chains sell a dozen combinations each - family,
-- student, all-centre, campaign, day pass - and showing the cheapest of those
-- would tell somebody a number they cannot actually buy for this centre.
--
-- `npm run gyms:import` fills these in where the scrape supports it, which
-- today is PureGym (their normal per-centre price) and SATS (Basic for an
-- adult, their own "access to your favourite centre"). A LOOP membership
-- covers every LOOP centre, so those rows stay null rather than carry a
-- number that means something else. `price_checked_on` is the day the scrape
-- read it, and the app shows it: a price is only as true as its source was.

begin;

alter table public.gym add column if not exists price_kr numeric(7,2);
alter table public.gym add column if not exists price_is_from boolean not null default false;
alter table public.gym add column if not exists price_note text;
alter table public.gym add column if not exists price_checked_on date;

-- The map reads its pins through this, so the price has to come with them.
-- Dropped first: a function's return type cannot be changed in place.
drop function if exists public.gyms_nearby(double precision, double precision, integer);

create or replace function public.gyms_nearby(
  lat double precision,
  lng double precision,
  result_limit integer default 20
)
returns table (
  id bigint,
  chain text,
  name text,
  short_name text,
  address text,
  city text,
  latitude double precision,
  longitude double precision,
  image_url text,
  price_kr numeric,
  price_is_from boolean,
  price_checked_on date,
  distance_m double precision,
  member_count integer,
  is_home_gym boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with viewer as (
    select auth.uid() as id
  ),
  home as (
    select private.home_gym_id_for((select id from viewer)) as gym_id
  )
  select
    gym.id,
    gym.chain,
    gym.name,
    gym.short_name,
    gym.address,
    gym.city,
    gym.latitude,
    gym.longitude,
    gym.image_url,
    gym.price_kr,
    gym.price_is_from,
    gym.price_checked_on,
    2 * 6371000 * asin(sqrt(
      power(sin(radians(gym.latitude - lat) / 2), 2)
      + cos(radians(lat)) * cos(radians(gym.latitude))
        * power(sin(radians(gym.longitude - lng) / 2), 2)
    )) as distance_m,
    private.gym_member_count(gym.id) as member_count,
    gym.id = (select gym_id from home) as is_home_gym
  from public.gym gym
  where gym.is_public
    and (select id from viewer) is not null
  order by distance_m asc
  limit least(greatest(coalesce(result_limit, 20), 1), 100);
$$;

revoke all on function public.gyms_nearby(double precision, double precision, integer) from public, anon;
grant execute on function public.gyms_nearby(double precision, double precision, integer) to authenticated;

commit;
