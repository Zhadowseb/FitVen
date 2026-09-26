// How the category page writes what it shows: a value and its unit, a row's
// line under the name, your own line, the filter you are left out by, and a
// tone that stays readable as text. Pure - every word comes in through the
// `t` the component hands over, so a language change re-renders it.

import { formatNumber } from "@localization";
import { mixHexColors } from "@utils/colorMix";
import { formatRelativeDay } from "@utils/dateUtils";
import {
  CALISTHENICS_FACTORS,
  PROGRESS_MAX_REPS,
  PROGRESS_MIN_SETS,
  PROGRESS_WINDOW_DAYS,
  SCOPE_ACTIVE_DAYS,
  STREAK_MIN_WORKOUTS,
  ageGroupLabelKey,
  fremgangTabLabelKey,
  genderLabelKey,
} from "@utils/gymCategories";
import { roundToNearestWeightIncrement } from "@utils/oneRepMaxUtils";

// What a missing number is shown as: a lift without both windows, a field
// before the list has loaded.
export const NO_VALUE = "–";

// The numbers the explanations and empty states quote, from the constants the
// server is held to, so the text cannot promise a rule the list does not keep.
export const RULE_PARAMS = {
  count: STREAK_MIN_WORKOUTS,
  days: PROGRESS_WINDOW_DAYS,
  sets: PROGRESS_MIN_SETS,
  reps: PROGRESS_MAX_REPS,
  activeDays: SCOPE_ACTIVE_DAYS,
  pullups: CALISTHENICS_FACTORS.pullups,
  dips: CALISTHENICS_FACTORS.dips,
  pushups: CALISTHENICS_FACTORS.pushups,
};

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

/** What a category's number counts - and so its unit and how it is written. */
export function valueKind(category, tab) {
  switch (category) {
    case "flid":
      return tab === "streak" ? "weeks" : "workouts";
    case "powerlifting":
      return "kg";
    case "fremgang":
      return "percent";
    case "calisthenics":
      return "points";
    default:
      return "workouts";
  }
}

export function formatKg(value) {
  const numeric = toNumber(value);

  return numeric === null ? NO_VALUE : formatNumber(numeric, { maximumFractionDigits: 2 });
}

/** An estimated 1RM, to the half kilo a bar is loaded in. */
export function formatEstimateKg(value) {
  const numeric = toNumber(value);

  return numeric === null ? NO_VALUE : formatKg(roundToNearestWeightIncrement(numeric, 0.5));
}

/** "+9", "+2.5": one decimal under ten, where a tenth still means something. */
export function formatPercent(value, { signed = true } = {}) {
  const numeric = toNumber(value);

  if (numeric === null) {
    return NO_VALUE;
  }

  const text = formatNumber(numeric, { maximumFractionDigits: Math.abs(numeric) < 10 ? 1 : 0 });

  return signed && numeric > 0 ? `+${text}` : text;
}

export function formatValue(kind, value, { signed = true } = {}) {
  const numeric = toNumber(value);

  if (numeric === null) {
    return NO_VALUE;
  }

  switch (kind) {
    case "kg":
      return formatKg(numeric);
    case "percent":
      return formatPercent(numeric, { signed });
    default:
      return formatNumber(Math.round(numeric));
  }
}

/** "træninger", "uge", "kg", "%", "point" - agreeing with the number. */
export function unitLabel(kind, value, t) {
  return t(`category.units.${kind}`, { count: toNumber(value) ?? 0 });
}

/**
 * kg and % sit beside the number, the way a weight is written; a word -
 * "træninger", "uger", "point" - goes under it in a row, where beside it
 * would take the room the line under the name needs at 375 pt.
 */
export function unitBesideValue(kind) {
  return kind === "kg" || kind === "percent";
}

function formatCount(value) {
  return formatNumber(Math.round(toNumber(value) ?? 0));
}

/* ------------------------------------------------------------- the rows -- */

function flidSubtitle(tab, detail, t, now) {
  const parts = [];
  const weeks = toNumber(detail.weeks);
  // On the streak tab the weeks are the value itself; saying them twice on
  // one row tells nobody anything.
  if (tab !== "streak" && weeks !== null && weeks > 0) {
    parts.push(t("category.rows.streak", { count: weeks }));
  }

  const when = detail.lastWorkoutAt ? formatRelativeDay(detail.lastWorkoutAt, now) : "";

  if (when) {
    parts.push(t("category.rows.last", { when: when.toLocaleLowerCase() }));
  }

  return parts.join(" · ");
}

/**
 * The line under a name: the streak and the last workout, the three lifts
 * (and the centre, above centre level), the lift and its two estimates, or
 * the three movements' reps.
 */
export function rowSubtitle({ category, tab, row, scopeLevel, t, now = Date.now() }) {
  const detail = row?.detail ?? {};

  switch (category) {
    case "flid":
      return flidSubtitle(tab, detail, t, now);
    case "powerlifting": {
      // A lift somebody has not done counts 0, and says so: "S 0 · D 0".
      const lifts = t("category.rows.powerlifting", {
        bench: formatKg(toNumber(detail.bench) ?? 0),
        squat: formatKg(toNumber(detail.squat) ?? 0),
        deadlift: formatKg(toNumber(detail.deadlift) ?? 0),
      });

      return scopeLevel !== "gym" && row?.gymName ? `${lifts} · ${row.gymName}` : lifts;
    }
    case "fremgang":
      return t("category.rows.fremgang", {
        lift: detail.lift ? t(fremgangTabLabelKey(detail.lift)) : "",
        before: formatEstimateKg(detail.before),
        now: formatEstimateKg(detail.now),
      }).trim();
    case "calisthenics":
      return t("category.rows.calisthenics", {
        pullups: formatCount(detail.pullups),
        dips: formatCount(detail.dips),
        pushups: formatCount(detail.pushups),
      });
    default:
      return "";
  }
}

/**
 * Your own line: how far it is to the place above, or that you lead, and on
 * Powerlifting where you stand in your own centre.
 */
export function meSubtitle({ category, tab, me, t }) {
  const kind = valueKind(category, tab);
  const rank = toNumber(me?.rank);
  const gap = toNumber(me?.gapToNext);
  const parts = [];

  if (rank === 1) {
    parts.push(t("category.me.leading"));
  } else if (rank !== null && rank > 1 && gap !== null) {
    parts.push(
      gap <= 0
        ? t("category.me.tied", { rank: rank - 1 })
        : t("category.me.gap", {
            gap: `${formatValue(kind, gap, { signed: false })} ${unitLabel(kind, gap, t)}`,
            rank: rank - 1,
          })
    );
  }

  const homeGymRank = toNumber(me?.detail?.homeGymRank);

  if (category === "powerlifting" && homeGymRank !== null) {
    parts.push(t("category.me.homeGymRank", { rank: homeGymRank }));
  }

  return parts.join(" · ");
}

/**
 * The filter that leaves you out, named. The server's in_filter is about who
 * you are - the gender and the age group - so those are the two named, both
 * when both are set: the list cannot say which one did it. Video only is not
 * one of them; without a verified single you are simply not on that list
 * yet, and the page says so as it does for any missing value.
 */
export function activeFilterLabel({ gender, filters, t }) {
  const names = [];

  if (gender && gender !== "all") {
    names.push(t(genderLabelKey(gender)));
  }

  if (filters?.ageGroup && filters.ageGroup !== "all") {
    names.push(t(ageGroupLabelKey(filters.ageGroup)));
  }

  return names.length ? names.join(" · ") : t(genderLabelKey(gender));
}

/* ---------------------------------------------------------------- texts -- */

/** How the category is counted, under the title - true to the tab and the video filter. */
export function explanationKey(category, filters) {
  switch (category) {
    case "flid":
      return filters?.tab === "streak"
        ? "category.explanations.flidStreak"
        : "category.explanations.flidWorkouts";
    case "powerlifting":
      return filters?.onlyVideo
        ? "category.explanations.powerliftingVideo"
        : "category.explanations.powerlifting";
    case "fremgang":
      return "category.explanations.fremgang";
    default:
      return "category.explanations.calisthenics";
  }
}

/** What gets somebody onto an empty list. */
export function emptyBodyKey(category, filters) {
  switch (category) {
    case "flid":
      return filters?.tab === "streak" ? "category.empty.flidStreak" : "category.empty.flidWorkouts";
    case "powerlifting":
      return filters?.onlyVideo ? "category.empty.powerliftingVideo" : "category.empty.powerlifting";
    case "fremgang":
      return "category.empty.fremgang";
    default:
      return "category.empty.calisthenics";
  }
}

/* ---------------------------------------------------------------- tones -- */

function parseHex(color) {
  if (typeof color !== "string" || !color.startsWith("#")) {
    return null;
  }

  let hex = color.slice(1);

  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }

  if (hex.length === 8) {
    hex = hex.slice(0, 6);
  }

  if (!/^[0-9a-f]{6}$/i.test(hex)) {
    return null;
  }

  return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}

function luminance(color) {
  const channels = parseHex(color);

  if (!channels) {
    return null;
  }

  const [r, g, b] = channels.map((channel) => {
    const share = channel / 255;

    return share <= 0.03928 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast between two hex colours; null when either cannot be read. */
export function contrastRatio(first, second) {
  const a = luminance(first);
  const b = luminance(second);

  if (a === null || b === null) {
    return null;
  }

  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * The category's colour as text. Dark mode keeps it as it is; on the light
 * surfaces some tones - the green, a light accent's secondary - fall under
 * 4.5:1, so they are drawn toward the ink a tenth at a time until they hold
 * on every surface given. Fills and tints keep the tone itself.
 */
export function readableTone(color, surfaces, ink, minimum = 4.5) {
  const worstContrast = (candidate) =>
    Math.min(...surfaces.map((surface) => contrastRatio(candidate, surface) ?? Infinity));

  for (let step = 0; step <= 10; step += 1) {
    const candidate = step === 0 ? color : mixHexColors(color, ink, step / 10);

    if (worstContrast(candidate) >= minimum) {
      return candidate;
    }
  }

  return ink;
}
