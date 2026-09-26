// Centres by country, region and centre, and the four categories they are
// ranked in (Utils/gymCategories.js). Every read is a security definer RPC
// from supabase/migrations/20260929090000_gym-scope-and-categories.sql that
// leaves out anybody blocked either way; this file turns the answers into the
// shapes below and signs the avatars.
//
// Shapes (camelCase, normalised):
//
// Scope  = { level: "world" | "country" | "region" | "gym", country?, region?, gymId? }
// Person = { id, displayName, username, avatarUrl, avatarPath, isMe }
// Region = { key, name, where }       // name "Sjælland", where "på Sjælland", in the app's language
//
// getScopeSummary({ scope }) ->
//   world:   { level, countries: [{ code, gymCount, lifterCount, isYours }] }       // most lifters first
//   country: { level, country: { code, gymCount, lifterCount },
//              regions: [Region & { gymCount, lifterCount }] }                       // the country's order
//   region:  { level, country: { code }, region: (Region & { gymCount }) | null,
//              gyms: [{ id, name, shortName, chain, city, imageUrl, lifterCount }] }  // most lifters first
//   gym:     { level, country: { code } | null, region: Region | null, gym: { id, name, shortName } | null }
//   Country names are the app's (category.countries.<CODE>); region names come
//   from the server and follow the language the app is in when it is read.
//
// getCategoryCards({ scope, gender, friendsOnly }) ->
//   { cards: CategoryCard[], unavailable?: true }       // most participants first
//   CategoryCard = {
//     category,                                         // CATEGORY_KEYS
//     participantCount,
//     top: { person, value, gymName, detail } | null,   // detail: category-specific, see Row
//     me:  { rank, value, total, inScope, inFilter, progress } | null,
//                                                       // progress: 0..1 of #1's value; inScope false = "ikke på {place}";
//                                                       // inFilter false = the gender leaves you out
//   }
//   Each card is its category under the default filters: Consistency by
//   workouts this month, Powerlifting and Progress over all lifts, all ages.
//
// getCategoryLeaderboard({ category, scope, gender, filters, friendsOnly, limit = 50 }) ->
//   { podium: Row[],                                    // up to 3; always empty for fremgang
//     rows: Row[],                                      // from #4 (from #1 for fremgang), up to `limit` places in all
//     me: (Row & { gapToNext: number | null, inFilter: boolean, breakdown }) | null,
//     total, unavailable?: true }
//   filters = normalizeCategoryFilters(category, ...)
//   me is there whenever you have trained at the level in 90 days - in the
//   top three too - and null when you have not. rank is null when you are not
//   on the list; inFilter false when the filter is what leaves you out.
//   gapToNext is the value between you and the place above (0 on a tie you
//   lose on time), null at #1 and off the list.
//   Row = { rank, person, value, gymName, detail }
//     flid workouts  detail = { workouts, weeks, lastWorkoutAt }             // lastWorkoutAt "YYYY-MM-DD"
//     flid streak    detail = { weeks, lastWorkoutAt }
//     powerlifting   detail = { bench, squat, deadlift, homeGymRank }     // homeGymRank only on your own row
//     fremgang       detail = { lift, before, now, percent }             // lift: "bench" | "squat" | "deadlift"
//     calisthenics   detail = { pullups, dips, pushups }                 // reps; points are value
//   me.breakdown (fremgang, calisthenics - the personal card; null otherwise):
//     fremgang       { bench, squat, deadlift }: each { before, now, percent } | null
//     calisthenics   { pullups, dips, pushups }: each { reps, factor, points }
//
// searchGyms({ query, scope }) -> [{ id, name, shortName, chain, city, imageUrl }]
//   inside the scope's level; the world level, or no scope, searches
//   everything. Before the migration it searches everything too.
//
// resolveStartCountry() -> { country, fromLocation }
//   the country Centres opens on: from the phone's position (reverse
//   geocoded; it may ask for location the way the old map did, through
//   gymService.getCurrentPosition), else the country of your centre, else DK.
//   Never throws.
//
// A backend without the migration returns empty reads with `unavailable: true`.
// Anything else that fails throws an Error whose message is translated
// (categoryService.errors), with the original as `cause`.
import * as Location from "expo-location";

import { supabase } from "@database/supaBaseClient";
import { getLanguage, t } from "@localization";
import {
  CALISTHENICS_FACTORS,
  DEFAULT_COUNTRY,
  normalizeCategory,
  normalizeCategoryFilters,
  normalizeGender,
  normalizeScope,
} from "@utils/gymCategories";

import { attachAvatarUrls } from "./avatarUrls";
import { buildGymSearchFilter, getCurrentPosition, getMyHomeGym } from "./gymService";

const GYM_TABLE = "gym";
const SEARCH_FIELDS = "id, chain, name, short_name, city, image_url";
const SEARCH_LIMIT = 40;
const MAX_LIMIT = 100;
const LIFTS = ["bench", "squat", "deadlift"];
const EVENTS = ["pullups", "dips", "pushups"];

// A database the migration has not reached: a function PostgREST cannot find
// (PGRST202, or 42883 from Postgres), a column (PGRST204), a table (PGRST205,
// or 42P01).
const MISSING_SCHEMA_CODES = new Set(["42883", "PGRST202", "PGRST204", "42P01", "PGRST205"]);
// ...and a column a table read names (42703): gym.country_code, before it.
const MISSING_COLUMN_CODES = new Set(["42703", "PGRST204"]);
const OFFLINE_MESSAGES = ["network request failed", "failed to fetch", "networkerror", "load failed", "network error"];

// A country does not move while the Centres screen is open, and a fix is a
// few seconds of GPS: one answer from the position serves for half an hour.
// A fix from the last day is good enough to tell a country by, when a fresh
// one does not come.
const START_COUNTRY_TTL_MS = 30 * 60 * 1000;
const COUNTRY_FIX_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const GEOCODE_TIMEOUT_MS = 8000;

/* -------------------------------------------------------------- errors -- */

let missingMigrationReported = false;

function reportMissingMigration(error) {
  if (missingMigrationReported) {
    return;
  }

  missingMigrationReported = true;
  console.warn(
    "Centre levels and categories are not set up yet: run supabase/migrations/20260929090000_gym-scope-and-categories.sql.",
    error?.message ?? error
  );
}

function isMissingSchemaError(error) {
  return MISSING_SCHEMA_CODES.has(String(error?.code ?? ""));
}

function isMissingColumnError(error) {
  return MISSING_COLUMN_CODES.has(String(error?.code ?? ""));
}

function isOfflineError(error) {
  const text = [error?.message, error?.details, error?.cause?.message]
    .filter((part) => typeof part === "string")
    .join(" ")
    .toLowerCase();

  return OFFLINE_MESSAGES.some((message) => text.includes(message));
}

// Literal keys, so scripts/test-localization.js checks every one of them.
const ERROR_MESSAGES = {
  offline: () => t("categoryService.errors.offline"),
  searchFailed: () => t("categoryService.errors.searchFailed"),
  generic: () => t("categoryService.errors.generic"),
};

/** Whatever came back, as an error the screen can show as it is. */
function toCategoryError(error, fallback = "generic") {
  const kind = isOfflineError(error) ? "offline" : fallback;
  const translated = new Error((ERROR_MESSAGES[kind] ?? ERROR_MESSAGES.generic)());

  translated.kind = kind;
  translated.cause = error;

  if (kind !== "offline") {
    console.warn("Centre rankings could not be read:", error);
  }

  return translated;
}

/* ------------------------------------------------------------- mapping -- */

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

function cleanText(value) {
  const text = typeof value === "string" ? value.trim() : "";

  return text.length ? text : null;
}

function normalizeCountryCode(value) {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";

  return /^[A-Z]{2}$/.test(code) ? code : null;
}

/** name_da / name_en, where_da / where_en - the one the app is in. */
function inLanguage(row, field) {
  const danish = cleanText(row?.[`${field}_da`]);
  const english = cleanText(row?.[`${field}_en`]);

  return getLanguage() === "da" ? danish ?? english : english ?? danish;
}

function mapRegion(row) {
  const key = cleanText(row?.key);

  if (!key) {
    return null;
  }

  return { key, name: inLanguage(row, "name") ?? key, where: inLanguage(row, "where") };
}

function mapPerson(user, isMe) {
  const id = cleanText(user?.id);

  if (!id) {
    return null;
  }

  const username = cleanText(user.username);

  return {
    id,
    displayName: cleanText(user.display_name) ?? cleanText(username?.split("#")[0]) ?? t("common.member"),
    username,
    avatarPath: cleanText(user.avatar_path),
    avatarUrl: null,
    isMe: isMe === true,
  };
}

function mapDetail(category, tab, detail) {
  if (!detail || typeof detail !== "object") {
    return null;
  }

  switch (category) {
    case "flid":
      return tab === "streak"
        ? { weeks: toNumber(detail.weeks) ?? 0, lastWorkoutAt: detail.last_workout_at ?? null }
        : {
            workouts: toNumber(detail.workouts) ?? 0,
            weeks: toNumber(detail.weeks) ?? 0,
            lastWorkoutAt: detail.last_workout_at ?? null,
          };
    case "powerlifting":
      return {
        bench: toNumber(detail.bench) ?? 0,
        squat: toNumber(detail.squat) ?? 0,
        deadlift: toNumber(detail.deadlift) ?? 0,
        homeGymRank: toNumber(detail.home_gym_rank),
      };
    case "fremgang":
      return LIFTS.includes(detail.lift)
        ? {
            lift: detail.lift,
            before: toNumber(detail.before),
            now: toNumber(detail.now),
            percent: toNumber(detail.percent),
          }
        : null;
    case "calisthenics":
      return {
        pullups: toNumber(detail.pullups) ?? 0,
        dips: toNumber(detail.dips) ?? 0,
        pushups: toNumber(detail.pushups) ?? 0,
      };
    default:
      return null;
  }
}

function mapBreakdown(category, breakdown) {
  if (!breakdown || typeof breakdown !== "object") {
    return null;
  }

  if (category === "fremgang") {
    return Object.fromEntries(
      LIFTS.map((lift) => {
        const part = breakdown[lift];

        return [
          lift,
          part && typeof part === "object"
            ? { before: toNumber(part.before), now: toNumber(part.now), percent: toNumber(part.percent) }
            : null,
        ];
      })
    );
  }

  if (category === "calisthenics") {
    return Object.fromEntries(
      EVENTS.map((event) => {
        const part = breakdown[event] ?? {};

        return [
          event,
          {
            reps: toNumber(part.reps) ?? 0,
            // The server's factor, or the default when the catalogue has no
            // exercise for the event yet.
            factor: toNumber(part.factor) ?? CALISTHENICS_FACTORS[event],
            points: toNumber(part.points) ?? 0,
          },
        ];
      })
    );
  }

  return null;
}

function mapRow(row, category, tab) {
  if (!row || typeof row !== "object") {
    return null;
  }

  const person = mapPerson(row.user, row.is_me);

  if (!person) {
    return null;
  }

  return {
    rank: toNumber(row.rank),
    person,
    value: toNumber(row.value),
    gymName: cleanText(row.gym_short_name),
    detail: mapDetail(category, tab, row.detail),
  };
}

async function attachPeople(entries) {
  const people = entries.map((entry) => entry?.person).filter(Boolean);

  if (people.length) {
    await attachAvatarUrls(people);
  }
}

function scopeParams(scope) {
  return {
    p_level: scope.level,
    p_country: scope.country ?? null,
    p_region: scope.region ?? null,
    p_gym_id: scope.gymId ?? null,
  };
}

/* ---------------------------------------------------------- the levels -- */

function emptySummary(scope, unavailable) {
  const base = unavailable ? { unavailable: true } : {};

  switch (scope.level) {
    case "world":
      return { level: "world", countries: [], ...base };
    case "region":
      return { level: "region", country: { code: scope.country }, region: null, gyms: [], ...base };
    case "gym":
      return { level: "gym", country: null, region: null, gym: null, ...base };
    default:
      return {
        level: "country",
        country: { code: scope.country, gymCount: null, lifterCount: null },
        regions: [],
        ...base,
      };
  }
}

function mapSummary(scope, data) {
  switch (scope.level) {
    case "world":
      return {
        level: "world",
        countries: (Array.isArray(data.countries) ? data.countries : [])
          .map((row) => {
            const code = normalizeCountryCode(row?.code);

            return code
              ? {
                  code,
                  gymCount: toNumber(row.gym_count) ?? 0,
                  lifterCount: toNumber(row.lifter_count) ?? 0,
                  isYours: row.is_yours === true,
                }
              : null;
          })
          .filter(Boolean),
      };
    case "region": {
      const region = mapRegion(data.region);

      return {
        level: "region",
        country: { code: normalizeCountryCode(data.country?.code) ?? scope.country },
        region: region ? { ...region, gymCount: toNumber(data.region.gym_count) ?? 0 } : null,
        gyms: (Array.isArray(data.gyms) ? data.gyms : [])
          .map((row) => {
            const id = toNumber(row?.id);

            return id === null
              ? null
              : {
                  id,
                  name: cleanText(row.name),
                  shortName: cleanText(row.short_name) ?? cleanText(row.name),
                  chain: cleanText(row.chain),
                  city: cleanText(row.city),
                  imageUrl: cleanText(row.image_url),
                  lifterCount: toNumber(row.lifter_count) ?? 0,
                };
          })
          .filter(Boolean),
      };
    }
    case "gym": {
      const id = toNumber(data.gym?.id);
      const code = normalizeCountryCode(data.country?.code);

      return {
        level: "gym",
        country: code ? { code } : null,
        region: mapRegion(data.region),
        gym:
          id === null
            ? null
            : {
                id,
                name: cleanText(data.gym.name),
                shortName: cleanText(data.gym.short_name) ?? cleanText(data.gym.name),
              },
      };
    }
    default:
      return {
        level: "country",
        country: {
          code: normalizeCountryCode(data.country?.code) ?? scope.country,
          gymCount: toNumber(data.country?.gym_count) ?? 0,
          lifterCount: toNumber(data.country?.lifter_count) ?? 0,
        },
        regions: (Array.isArray(data.regions) ? data.regions : [])
          .map((row) => {
            const region = mapRegion(row);

            return region
              ? { ...region, gymCount: toNumber(row.gym_count) ?? 0, lifterCount: toNumber(row.lifter_count) ?? 0 }
              : null;
          })
          .filter(Boolean),
      };
  }
}

/** What a level holds: its countries, regions or centres, with counts. */
export async function getScopeSummary({ scope } = {}) {
  const normalized = normalizeScope(scope);
  const { data, error } = await supabase.rpc("gym_scope_summary", scopeParams(normalized));

  if (error) {
    if (isMissingSchemaError(error)) {
      reportMissingMigration(error);
      return emptySummary(normalized, true);
    }

    throw toCategoryError(error);
  }

  if (!data || typeof data !== "object") {
    return emptySummary(normalized, false);
  }

  return mapSummary(normalized, data);
}

/* -------------------------------------------------------------- cards -- */

function mapCard(card) {
  const category = normalizeCategory(card?.category);

  if (!category) {
    return null;
  }

  const participantCount = toNumber(card.participant_count) ?? 0;
  const top = card.top && typeof card.top === "object" ? card.top : null;
  const person = top ? mapPerson(top.user, top.is_me) : null;
  const me = card.me && typeof card.me === "object" ? card.me : null;

  return {
    category,
    participantCount,
    top: person
      ? {
          person,
          value: toNumber(top.value),
          gymName: cleanText(top.gym_short_name),
          // The cards are the default filters: Consistency is its workouts tab.
          detail: mapDetail(category, "workouts", top.detail),
        }
      : null,
    me: me
      ? {
          rank: toNumber(me.rank),
          value: toNumber(me.value),
          total: toNumber(me.total) ?? participantCount,
          inScope: me.in_scope === true,
          inFilter: me.in_filter === true,
          progress: toNumber(me.progress),
        }
      : null,
  };
}

/** The four category cards of a level, most participants first. */
export async function getCategoryCards({ scope, gender = "all", friendsOnly = false } = {}) {
  const normalized = normalizeScope(scope);
  const { data, error } = await supabase.rpc("gym_category_cards", {
    ...scopeParams(normalized),
    p_gender: normalizeGender(gender),
    p_friends_only: friendsOnly === true,
  });

  if (error) {
    if (isMissingSchemaError(error)) {
      reportMissingMigration(error);
      return { cards: [], unavailable: true };
    }

    throw toCategoryError(error);
  }

  const cards = (Array.isArray(data?.cards) ? data.cards : []).map(mapCard).filter(Boolean);

  await attachPeople(cards.map((card) => card.top));

  return { cards };
}

/* --------------------------------------------------------------- lists -- */

// The filters as the server reads them: snake_case, and only what the
// category has.
function toServerFilters(filters) {
  const server = {};

  if (filters.tab !== undefined) server.tab = filters.tab;
  if (filters.period !== undefined) server.period = filters.period;
  if (filters.ageGroup !== undefined) server.age_group = filters.ageGroup;
  if (filters.onlyVideo !== undefined) server.only_video = filters.onlyVideo;

  return server;
}

function emptyLeaderboard(unavailable) {
  return { podium: [], rows: [], me: null, total: 0, ...(unavailable ? { unavailable: true } : {}) };
}

/** One category's list at a level, and where the viewer stands on it. */
export async function getCategoryLeaderboard({
  category,
  scope,
  gender = "all",
  filters = {},
  friendsOnly = false,
  limit = 50,
} = {}) {
  const normalizedCategory = normalizeCategory(category);

  if (!normalizedCategory) {
    return emptyLeaderboard(false);
  }

  const normalized = normalizeScope(scope);
  const normalizedFilters = normalizeCategoryFilters(normalizedCategory, filters);
  const pageLimit = Math.min(Math.max(Math.trunc(toNumber(limit) ?? 50), 1), MAX_LIMIT);
  const { data, error } = await supabase.rpc("gym_category_leaderboard", {
    p_category: normalizedCategory,
    ...scopeParams(normalized),
    p_gender: normalizeGender(gender),
    p_filters: toServerFilters(normalizedFilters),
    p_friends_only: friendsOnly === true,
    p_limit: pageLimit,
  });

  if (error) {
    if (isMissingSchemaError(error)) {
      reportMissingMigration(error);
      return emptyLeaderboard(true);
    }

    throw toCategoryError(error);
  }

  if (!data || typeof data !== "object") {
    return emptyLeaderboard(false);
  }

  const tab = normalizedFilters.tab;
  const podium = normalizedCategory === "fremgang"
    ? []
    : (Array.isArray(data.podium) ? data.podium : []).map((row) => mapRow(row, normalizedCategory, tab)).filter(Boolean);
  const rows = (Array.isArray(data.rows) ? data.rows : [])
    .map((row) => mapRow(row, normalizedCategory, tab))
    .filter(Boolean);
  const mine = mapRow(data.me, normalizedCategory, tab);
  const me = mine
    ? {
        ...mine,
        person: { ...mine.person, isMe: true },
        gapToNext: toNumber(data.me.gap_to_next),
        inFilter: data.me.in_filter === true,
        breakdown: mapBreakdown(normalizedCategory, data.me.breakdown),
      }
    : null;

  await attachPeople([...podium, ...rows, me]);

  return { podium, rows, me, total: toNumber(data.total) ?? 0 };
}

/* -------------------------------------------------------------- search -- */

function mapSearchResult(row) {
  const id = toNumber(row?.id);

  if (id === null) {
    return null;
  }

  return {
    id,
    name: cleanText(row.name),
    shortName: cleanText(row.short_name) ?? cleanText(row.name),
    chain: cleanText(row.chain),
    city: cleanText(row.city),
    imageUrl: cleanText(row.image_url),
  };
}

/**
 * Centres whose name, short name, chain or city match, inside the scope's
 * level; the world level, or no scope, searches everything. The query goes
 * through the same allowlist as gymService.searchGyms, because it is pasted
 * into the same kind of PostgREST `.or(...)` string.
 */
export async function searchGyms({ query = "", scope } = {}) {
  const cleaned = buildGymSearchFilter(query);

  if (cleaned.length < 2) {
    return [];
  }

  const normalized = scope ? normalizeScope(scope) : { level: "world" };
  const pattern = `%${cleaned}%`;
  const search = (withLevel) => {
    let request = supabase
      .from(GYM_TABLE)
      .select(SEARCH_FIELDS)
      .or(`name.ilike.${pattern},short_name.ilike.${pattern},chain.ilike.${pattern},city.ilike.${pattern}`);

    if (withLevel && normalized.level === "country") {
      request = request.eq("country_code", normalized.country);
    } else if (withLevel && normalized.level === "region") {
      request = request.eq("country_code", normalized.country).eq("region_key", normalized.region);
    } else if (withLevel && normalized.level === "gym") {
      request = request.eq("id", normalized.gymId);
    }

    return request.order("short_name", { ascending: true }).limit(SEARCH_LIMIT);
  };

  let { data, error } = await search(true);

  // Before the migration the centre has no country or region to filter by;
  // every centre is Danish then, and the search still works without them.
  if (error && normalized.level !== "world" && isMissingColumnError(error)) {
    reportMissingMigration(error);
    ({ data, error } = await search(false));
  }

  if (error) {
    throw toCategoryError(error, "searchFailed");
  }

  return (data ?? []).map(mapSearchResult).filter(Boolean);
}

/* ------------------------------------------------------ the start country -- */

let startCountryFromPosition = null;
let startCountryRequest = null;

function withTimeout(promise, ms) {
  let timer = null;

  return Promise.race([
    promise,
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(null), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function countryFromPosition() {
  try {
    const position = await getCurrentPosition({ lastKnownMaxAgeMs: COUNTRY_FIX_MAX_AGE_MS });

    if (!position) {
      return null;
    }

    const places = await withTimeout(
      Location.reverseGeocodeAsync({ latitude: position.latitude, longitude: position.longitude }),
      GEOCODE_TIMEOUT_MS
    );

    for (const place of Array.isArray(places) ? places : []) {
      const code = normalizeCountryCode(place?.isoCountryCode);

      if (code) {
        return code;
      }
    }
  } catch (error) {
    console.warn("Could not tell the country from the position:", error);
  }

  return null;
}

async function countryOfHomeGym() {
  try {
    const home = await getMyHomeGym();

    if (!home?.id) {
      return null;
    }

    const { data, error } = await supabase
      .from(GYM_TABLE)
      .select("country_code")
      .eq("id", home.id)
      .maybeSingle();

    if (error) {
      // Before the migration there is no country column, and every centre
      // is Danish: the default is right.
      if (!isMissingColumnError(error)) {
        console.warn("Could not read the country of your centre:", error);
      }

      return null;
    }

    return normalizeCountryCode(data?.country_code);
  } catch (error) {
    console.warn("Could not read your centre:", error);
    return null;
  }
}

async function findStartCountry() {
  const located = await countryFromPosition();

  if (located) {
    startCountryFromPosition = { country: located, at: Date.now() };
    return { country: located, fromLocation: true };
  }

  return { country: (await countryOfHomeGym()) ?? DEFAULT_COUNTRY, fromLocation: false };
}

/**
 * The country Centres opens on: where the phone is, else where your centre
 * is, else Denmark. Asks for location the way the old map did. Never throws;
 * two screens asking at once share one answer.
 */
export async function resolveStartCountry() {
  if (startCountryFromPosition && Date.now() - startCountryFromPosition.at < START_COUNTRY_TTL_MS) {
    return { country: startCountryFromPosition.country, fromLocation: true };
  }

  if (!startCountryRequest) {
    startCountryRequest = findStartCountry()
      .catch((error) => {
        console.warn("Could not choose a start country:", error);
        return { country: DEFAULT_COUNTRY, fromLocation: false };
      })
      .finally(() => {
        startCountryRequest = null;
      });
  }

  return startCountryRequest;
}
