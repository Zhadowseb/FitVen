// Pure helpers for centres and centre leaderboards. No database, no network,
// so scripts/test-gym-leaderboard.js can load this file on its own.
import { t } from "@localization";

const CHAIN_INITIALS = {
  puregym: "PG",
  sats: "SA",
  "loop fitness": "LO",
  loop: "LO",
  fitnessx: "FX",
  "fit&sund": "FS",
  "fitness world": "FW",
  independent: "IN",
};

// One colour per chain, behind the initials of a centre without a photo, so a
// list of centres says which chain is which at a glance.
//
// These are not the chains' brand colours. They were picked for the centres
// map, since removed, where three of the app's own colours already meant
// something - the accent was your centre, green where you were standing, gold
// a record. They are told apart from each other and from those three, in both
// light and dark mode, leaning towards each chain's brand only where that was
// free.
const CHAIN_COLORS = {
  // Cyan rather than a true green, which marked where you were standing.
  puregym: "#22D3EE",
  sats: "#E4362F",
  "loop fitness": "#A855F7",
  loop: "#A855F7",
  // Brighter and more saturated than the gold a record is drawn in.
  fitnessx: "#FACC15",
  "fit&sund": "#EC4899",
  // No centres of this chain are imported; the colour is here so a future
  // scrape does not land on somebody else's.
  "fitness world": "#0D9488",
};
const UNKNOWN_CHAIN_COLOR = "#C4C7CF";

/** The tile colour for a chain. An unknown chain stays neutral grey. */
export function getChainColor(chain) {
  const key = String(chain ?? "").trim().toLowerCase();

  return CHAIN_COLORS[key] ?? UNKNOWN_CHAIN_COLOR;
}

/**
 * Two letters for the chain tile: a known chain gets its fixed pair, anything
 * else the first letter of its first two words, or its first two letters.
 */
export function getChainInitials(chain) {
  const normalized = String(chain ?? "").trim();

  if (!normalized) {
    return "??";
  }

  const known = CHAIN_INITIALS[normalized.toLowerCase()];

  if (known) {
    return known;
  }

  const words = normalized.split(/[\s&/-]+/).filter(Boolean);

  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  return normalized.slice(0, 2).toUpperCase();
}

/** "100", "102.5" - a weight without a trailing ".0" or float noise. */
export function formatWeightKg(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return "—";
  }

  const rounded = Math.round(numeric * 100) / 100;

  return String(rounded);
}

function toFiniteNumber(value) {
  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * The best completed set per exercise: heaviest weight, and on a tie the most
 * reps. Sets without a cloud exercise id are dropped - a custom exercise has
 * no shared id to rank under. Input rows are what
 * weightliftingRepository.getCompletedSetsForGymLifts returns.
 */
export function selectBestLiftsPerExercise(sets) {
  const bestByExercise = new Map();

  for (const set of sets ?? []) {
    const exerciseId = toFiniteNumber(set?.cloud_exercise_id);
    const weight = toFiniteNumber(set?.weight);
    const reps = toFiniteNumber(set?.reps);

    if (exerciseId === null || exerciseId <= 0 || weight === null || weight <= 0 || reps === null || reps <= 0) {
      continue;
    }

    const candidate = {
      exerciseId,
      exerciseName: String(set?.exercise_name ?? "").trim() || `Exercise ${exerciseId}`,
      weightKg: weight,
      reps,
      setSyncId: set?.sync_id ?? null,
    };
    const current = bestByExercise.get(exerciseId);

    if (
      !current ||
      candidate.weightKg > current.weightKg ||
      (candidate.weightKg === current.weightKg && candidate.reps > current.reps)
    ) {
      bestByExercise.set(exerciseId, candidate);
    }
  }

  return [...bestByExercise.values()].sort((left, right) => left.exerciseId - right.exerciseId);
}

/**
 * Which of today's best sets should go up. A lift is written when it is at
 * least as heavy as the row already there - equal weight still writes, so a
 * rep improvement lands and a re-done set keeps its performed_at fresh. The
 * database trigger keeps the video when the weight is unchanged.
 */
export function selectLiftsToUpsert(bestLifts, existingLifts) {
  const existingByExercise = new Map(
    (existingLifts ?? [])
      .map((lift) => [toFiniteNumber(lift?.exercise_id ?? lift?.exerciseId), lift])
      .filter(([exerciseId]) => exerciseId !== null)
  );

  return (bestLifts ?? []).filter((lift) => {
    const existing = existingByExercise.get(lift.exerciseId);

    if (!existing) {
      return true;
    }

    const existingWeight = toFiniteNumber(existing.weight_kg ?? existing.weightKg) ?? 0;

    return lift.weightKg >= existingWeight;
  });
}

export const APPROVALS_REQUIRED = 3;
export const REJECTIONS_TO_REMOVE = 2;

/**
 * The same rule the vote trigger applies, for showing the pill before the
 * server answers: two rejections beat everything, then three approvals.
 *
 * It reads the two constants above rather than repeating their values. It
 * used to hardcode them, two lines apart, so changing the rule in one place
 * moved the pill and the review sheet and left this behind - and the test
 * asserted the old numbers, so it kept passing.
 */
export function deriveVideoStatus({ hasVideo, approvals = 0, rejections = 0 }) {
  if (!hasVideo) {
    return "none";
  }

  if (Number(rejections) >= REJECTIONS_TO_REMOVE) {
    return "rejected";
  }

  if (Number(approvals) >= APPROVALS_REQUIRED) {
    return "verified";
  }

  return "pending";
}

/** "Mikkel R." - first name and the initial of the last, for the podium. */
export function shortenDisplayName(displayName) {
  const parts = String(displayName ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return t("common.member");
  }

  if (parts.length === 1) {
    return parts[0];
  }

  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/* ------------------------------------------------ a centre's exercises -- */

function exerciseNameKey(name) {
  return String(name ?? "").trim().toLocaleLowerCase();
}

// toFiniteNumber reads null as 0; a missing #1 or rank has to stay missing.
function toNullableNumber(value) {
  return value === null || value === undefined || value === "" ? null : toFiniteNumber(value);
}

/**
 * Every exercise ranked at a centre, from gymService.getGymOverview: the
 * featured three and the rest in one list, most lifters first, then by name.
 * The featured three are there even when nobody has lifted them, with 0.
 */
export function listCentreExercises(overview) {
  const byId = new Map();
  const add = (entry) => {
    const id = toFiniteNumber(entry?.id);
    const name = String(entry?.name ?? "").trim();

    if (id === null || id <= 0 || !name || byId.has(id)) {
      return;
    }

    byId.set(id, { ...entry, id, name, lifterCount: toFiniteNumber(entry.lifterCount) ?? 0 });
  };

  for (const entry of overview?.featured ?? []) {
    add({
      id: entry?.exerciseId,
      name: entry?.exerciseName,
      lifterCount: entry?.lifterCount,
      topName: entry?.top?.displayName ?? null,
      topWeightKg: toNullableNumber(entry?.top?.weightKg),
      myRank: toNullableNumber(entry?.me?.rank),
    });
  }

  for (const entry of overview?.more ?? []) {
    add({
      id: entry?.exerciseId,
      name: entry?.exerciseName,
      lifterCount: entry?.lifterCount,
      topName: entry?.topName ?? null,
      topWeightKg: toNullableNumber(entry?.topWeightKg),
      myRank: toNullableNumber(entry?.myRank),
    });
  }

  return [...byId.values()].sort(
    (left, right) => right.lifterCount - left.lifterCount || left.name.localeCompare(right.name)
  );
}

/**
 * How many exercises are ranked at the centre, for "All exercises": the ones
 * listCentreExercises finds in the overview, and the ones the overview left
 * out because it was asked for fewer (more_limit). `moreTotal` counts every
 * one of the rest, sent or not.
 */
export function countCentreExercises(overview) {
  const notSent = Math.max(
    0,
    (toFiniteNumber(overview?.moreTotal) ?? 0) - (overview?.more?.length ?? 0)
  );

  return listCentreExercises(overview).length + notSent;
}

/**
 * What the centre's exercise search says under its matches, from how far it
 * has got. The page starts with a preview of the exercises and fetches the
 * rest when somebody searches, so "no match" is only true once every exercise
 * has been looked through - before that the search is still looking, or
 * could not get the rest (PR #294's review: it said "no match" about an
 * exercise lifted there).
 *
 *   previewCount exercises the page already has
 *   totalCount   exercises ranked at the centre (countCentreExercises)
 *   status       "idle" | "loading" | "ready" | "error", for the full list -
 *                the page's words for its cards' status too
 */
export function centreSearchView({
  matchCount = 0,
  previewCount = 0,
  totalCount = 0,
  status = "idle",
} = {}) {
  const complete = status === "ready" || previewCount >= totalCount;
  const failed = !complete && status === "error";

  return {
    complete,
    loading: !complete && !failed,
    failed,
    noMatch: complete && matchCount === 0,
  };
}

/**
 * The exercises whose name holds what was typed, best match first: the name
 * starting with it, then a word in it, then anywhere - and within each, the
 * list's own order (most lifters first). Empty for an empty query.
 */
export function searchCentreExercises(exercises, query) {
  const needle = exerciseNameKey(query).replace(/\s+/g, " ");

  if (!needle) {
    return [];
  }

  const scored = [];

  (exercises ?? []).forEach((exercise, index) => {
    const name = exerciseNameKey(exercise?.name).replace(/\s+/g, " ");
    const at = name.indexOf(needle);

    if (at === -1) {
      return;
    }

    let score = at === 0 ? 0 : 2;

    // A word in the name starting with it: after a space, a bracket, a
    // slash or a dash - "press" in "Bench Press", "dumb" in "(Dumbbell)".
    for (let from = at; score === 2 && from !== -1; from = name.indexOf(needle, from + 1)) {
      if (/[\s(/-]/.test(name[from - 1] ?? "")) {
        score = 1;
      }
    }

    scored.push({ exercise, score, index });
  });

  return scored
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .map((entry) => entry.exercise);
}

/* ------------------------------------------------ centres before a search -- */

/**
 * The centres Explore's search shows before anything is typed, in its three
 * groups: your centre, the others you have trained in (most often first, as
 * my_gyms gives them) and the busiest centres of a region, `limit` of them.
 * A centre is shown once, in the first group it is in.
 */
export function mergeGymSuggestions({ home = null, trainedIn = [], popular = [], limit = 10 } = {}) {
  const seen = new Set();
  const isNew = (gym) => {
    const id = toNullableNumber(gym?.id);

    if (id === null || id <= 0 || seen.has(id)) {
      return false;
    }

    seen.add(id);
    return true;
  };

  const yours = home && isNew(home) ? home : null;
  const trained = (trainedIn ?? []).filter(isNew);
  const others = (popular ?? []).filter(isNew).slice(0, Math.max(0, limit));

  return { yours, trainedIn: trained, popular: others };
}

/**
 * Nearest centre by haversine within its own radius, or null. The database
 * does this in match_gym; this is the same rule for a list already in hand,
 * and for the test that pins the rule down.
 */
export function distanceBetweenMeters(a, b) {
  const lat1 = toFiniteNumber(a?.latitude);
  const lng1 = toFiniteNumber(a?.longitude);
  const lat2 = toFiniteNumber(b?.latitude);
  const lng2 = toFiniteNumber(b?.longitude);

  if ([lat1, lng1, lat2, lng2].some((value) => value === null)) {
    return null;
  }

  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

export function matchGymLocally(position, gyms) {
  let best = null;

  for (const gym of gyms ?? []) {
    const distance = distanceBetweenMeters(position, gym);
    const radius = toFiniteNumber(gym?.match_radius_m ?? gym?.matchRadiusM) ?? 120;

    if (distance === null || distance > radius) {
      continue;
    }

    if (!best || distance < best.distance) {
      best = { gym, distance };
    }
  }

  return best;
}
