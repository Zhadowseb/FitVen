// The four categories centres are ranked in - Consistency, Powerlifting,
// Progress and Calisthenics - and the levels and filters they are shown on.
// The rules each category counts by are the server's
// (supabase/migrations/20260929090000_gym-scope-and-categories.sql); this is
// the vocabulary the screens and the service share, so a filter value spelled
// one way in the sheet and another in the request cannot happen.
//
// Pure, so scripts/test-gym-categories.js loads it on its own.

/* -------------------------------------------------------------- levels -- */

// "world" lists countries, "country" regions, "region" centres, "gym" one.
export const SCOPE_LEVELS = ["world", "country", "region", "gym"];

export const DEFAULT_COUNTRY = "DK";

/**
 * A scope as the screens pass it around:
 * { level, country?, region?, gymId? } - with what each level needs, and
 * nothing it does not. Unknown input becomes the default country.
 */
export function normalizeScope(scope) {
  const level = SCOPE_LEVELS.includes(scope?.level) ? scope.level : "country";
  const country =
    typeof scope?.country === "string" && /^[A-Za-z]{2}$/.test(scope.country.trim())
      ? scope.country.trim().toUpperCase()
      : DEFAULT_COUNTRY;
  const region =
    typeof scope?.region === "string" && scope.region.trim() !== "" ? scope.region.trim() : null;
  const gymId = Number(scope?.gymId);

  if (level === "world") {
    return { level };
  }

  if (level === "gym" && Number.isInteger(gymId) && gymId > 0) {
    return { level, gymId };
  }

  if (level === "region" && region) {
    return { level, country, region };
  }

  return { level: "country", country };
}

/** One string per scope, for caches and keys. */
export function scopeKey(scope) {
  const normalized = normalizeScope(scope);

  switch (normalized.level) {
    case "world":
      return "world";
    case "gym":
      return `gym:${normalized.gymId}`;
    case "region":
      return `region:${normalized.country}:${normalized.region}`;
    default:
      return `country:${normalized.country}`;
  }
}

/* ---------------------------------------------------------- categories -- */

export const CATEGORY_KEYS = ["flid", "powerlifting", "fremgang", "calisthenics"];

// The colour each category is drawn in - its title, its value, its glow and
// its podium - as a theme token, so the light theme gets its own shade.
const CATEGORY_TONES = {
  flid: "secondary",
  powerlifting: "record",
  fremgang: "primary",
  calisthenics: "music",
};

export function categoryToneToken(category) {
  return CATEGORY_TONES[category] ?? "primary";
}

export function normalizeCategory(value) {
  return CATEGORY_KEYS.includes(value) ? value : null;
}

// Flid ranks by one of two things; Fremgang by all three lifts or one.
export const FLID_TABS = ["workouts", "streak"];
export const FREMGANG_TABS = ["all", "bench", "squat", "deadlift"];

/* ------------------------------------------------------------- filters -- */

export const GENDERS = ["all", "men", "women"];
export const DEFAULT_GENDER = "all";

export const AGE_GROUPS = ["all", "u23", "23-39", "40+"];
export const FLID_PERIODS = ["week", "month", "year"];
export const DEFAULT_FLID_PERIOD = "month";

// Body weight is not asked for yet, so the class filter has one value until
// it is; the classes are here so the sheet can grow into them.
export const WEIGHT_CLASSES = {
  men: ["-66", "-74", "-83", "-93", "-105", "-120", "120+"],
  women: ["-52", "-57", "-63", "-69", "-76", "-84", "84+"],
};
export const BODY_WEIGHT_AVAILABLE = false;

export function normalizeGender(value) {
  return GENDERS.includes(value) ? value : DEFAULT_GENDER;
}

export function normalizeAgeGroup(value) {
  return AGE_GROUPS.includes(value) ? value : "all";
}

export function normalizeFlidPeriod(value) {
  return FLID_PERIODS.includes(value) ? value : DEFAULT_FLID_PERIOD;
}

/**
 * The filters a category's list is asked for with, reduced to what that
 * category has: { tab, period, ageGroup, onlyVideo }.
 */
export function normalizeCategoryFilters(category, filters = {}) {
  const ageGroup = normalizeAgeGroup(filters?.ageGroup);

  switch (category) {
    case "flid":
      return {
        tab: FLID_TABS.includes(filters?.tab) ? filters.tab : "workouts",
        period: normalizeFlidPeriod(filters?.period),
        ageGroup,
      };
    case "powerlifting":
      return { ageGroup, onlyVideo: filters?.onlyVideo === true };
    case "fremgang":
      return { tab: FREMGANG_TABS.includes(filters?.tab) ? filters.tab : "all" };
    case "calisthenics":
      return { ageGroup };
    default:
      return {};
  }
}

/* --------------------------------------------------------------- rules -- */

// These have to agree with the migration; scripts/test-gym-categories.js
// holds the two against each other.
export const STREAK_MIN_WORKOUTS = 3;
export const PROGRESS_WINDOW_DAYS = 30;
export const PROGRESS_MIN_SETS = 3;
export const SCOPE_ACTIVE_DAYS = 90;
// Past this the Brzycki estimate is not used - MAX_ESTIMATE_REPS in
// Utils/oneRepMaxUtils.js, the one the rest of the app goes by.
export const PROGRESS_MAX_REPS = 12;

// Calisthenics points: the most reps in one set without added weight, times
// how hard the movement is. A proposal (the spec's open point 4); the server
// keeps its own copy in a table so it can be changed without an app release.
export const CALISTHENICS_FACTORS = { pullups: 3, dips: 2, pushups: 1 };

/* -------------------------------------------------------------- labels -- */

// Translation keys in the `category` namespace, so every screen names a value
// the same way. The values are the server's; the keys are camelCase.
const AGE_GROUP_KEYS = { all: "all", u23: "u23", "23-39": "age23to39", "40+": "age40plus" };

export const categoryNameKey = (category) => `category.names.${normalizeCategory(category) ?? "flid"}`;
export const categoryDescriptionKey = (category) =>
  `category.descriptions.${normalizeCategory(category) ?? "flid"}`;
export const genderLabelKey = (gender) => `category.gender.${normalizeGender(gender)}`;
export const ageGroupLabelKey = (ageGroup) => `category.ageGroups.${AGE_GROUP_KEYS[normalizeAgeGroup(ageGroup)]}`;
export const periodLabelKey = (period) => `category.periods.${normalizeFlidPeriod(period)}`;
export const flidTabLabelKey = (tab) => `category.flidTabs.${FLID_TABS.includes(tab) ? tab : "workouts"}`;
export const fremgangTabLabelKey = (tab) => `category.fremgangTabs.${FREMGANG_TABS.includes(tab) ? tab : "all"}`;

/** A country's name and "in {country}" phrase keys; unknown codes show the code. */
export function countryNameKey(code) {
  return `category.countries.${String(code ?? DEFAULT_COUNTRY).toUpperCase()}`;
}

export function countryWhereKey(code) {
  return `category.countriesWhere.${String(code ?? DEFAULT_COUNTRY).toUpperCase()}`;
}

/* ---------------------------------------------------------- formatting -- */

/** "Anna B." - a first name and the last name's initial, for the podium. */
export function podiumName(displayName) {
  const parts = String(displayName ?? "").trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "";
  }

  if (parts.length === 1) {
    return parts[0];
  }

  return `${parts[0]} ${parts[parts.length - 1][0].toLocaleUpperCase()}.`;
}

/** Up to two letters for a region's tile: "Sjælland" -> "SJ". */
export function regionInitials(name) {
  const letters = String(name ?? "").replace(/[^\p{L}]/gu, "");

  return letters.slice(0, 2).toLocaleUpperCase();
}
