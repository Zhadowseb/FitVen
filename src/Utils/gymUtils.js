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

// One colour per chain, so a map full of pins can be read at a glance.
//
// These are not the chains' brand colours. Three of the app's own colours
// already mean something on this map - the accent is your centre, green is
// where you are standing, gold is a record - so a chain that happens to be
// orange or green would say the wrong thing. These are picked to be told
// apart from each other and from those three, in both light and dark mode,
// leaning towards each chain's brand only where that was free.
const CHAIN_COLORS = {
  // Cyan rather than a true green: green already marks where you are
  // standing, and two greens on one map is one green too many.
  puregym: "#22D3EE",
  sats: "#E4362F",
  "loop fitness": "#A855F7",
  loop: "#A855F7",
  // Brighter and more saturated than the gold a record is drawn in, which
  // never appears on the map anyway.
  fitnessx: "#FACC15",
  "fit&sund": "#EC4899",
  // No centres of this chain are imported; the colour is here so a future
  // scrape does not land on somebody else's.
  "fitness world": "#0D9488",
};
const UNKNOWN_CHAIN_COLOR = "#C4C7CF";

/** The pin colour for a chain. An unknown chain stays neutral grey. */
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

/** "850 m" under a kilometre, "2.3 km" above, "12 km" once it is far. */
export function formatDistance(meters) {
  const value = Number(meters);

  if (!Number.isFinite(value) || value < 0) {
    return "";
  }

  if (value < 1000) {
    return `${Math.round(value / 10) * 10} m`;
  }

  if (value < 10000) {
    return `${(value / 1000).toFixed(1).replace(/\.0$/, "")} km`;
  }

  return `${Math.round(value / 1000)} km`;
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
