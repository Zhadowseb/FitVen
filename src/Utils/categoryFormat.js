// How a category is written: its number and unit, the line under a name, your
// own line, the filter you are left out by, and its colour as text. A centre's
// category card (Resources/Components/CategoryCard) and the page the card
// opens (Pages/CategoryLeaderboardPage) both write through this file, so the
// number you tap is the number you land on - the language's decimal comma,
// estimates to the half kilo, the same unit and the same readable colour.
//
// Pure - every word comes in through the `t` the component hands over, so a
// language change re-renders it - and scripts/test-gym-categories.js loads it
// on its own.

import { formatNumber } from "@localization";

import { mixHexColors, parseHex } from "./colorMix";
import { formatRelativeDay } from "./dateUtils";
import {
  CALISTHENICS_FACTORS,
  PROGRESS_MAX_REPS,
  PROGRESS_MIN_SETS,
  PROGRESS_WINDOW_DAYS,
  SCOPE_ACTIVE_DAYS,
  STREAK_MIN_WORKOUTS,
  ageGroupLabelKey,
  categoryToneToken,
  fremgangTabLabelKey,
  genderLabelKey,
} from "./gymCategories";
import { roundToNearestWeightIncrement } from "./oneRepMaxUtils";

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

/* ------------------------------------------------------------- the values -- */

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

/** Kilos as they were lifted: "142,5". */
export function formatKg(value) {
  const numeric = toNumber(value);

  return numeric === null ? NO_VALUE : formatNumber(numeric, { maximumFractionDigits: 2 });
}

/** An estimated 1RM, to the half kilo a bar is loaded in. */
export function formatEstimateKg(value) {
  const numeric = toNumber(value);

  return numeric === null ? NO_VALUE : formatKg(roundToNearestWeightIncrement(numeric, 0.5));
}

/** "+9", "+2,5": one decimal under ten, where a tenth still means something. */
export function formatPercent(value, { signed = true } = {}) {
  const numeric = toNumber(value);

  if (numeric === null) {
    return NO_VALUE;
  }

  const text = formatNumber(numeric, { maximumFractionDigits: Math.abs(numeric) < 10 ? 1 : 0 });

  return signed && numeric > 0 ? `+${text}` : text;
}

/** A category's value in its kind: kilos, a rise in per cent, or a count. */
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

/* -------------------------------------------------------------- the lines -- */

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
 * The line under a name, on the category page's rows and under #1 on a
 * centre's card: the streak and the last workout, the three lifts (and the
 * centre, above centre level), the lift and its two estimates, or the three
 * movements' reps. Empty when there is nothing to say.
 */
export function rowSubtitle({ category, tab, row, scopeLevel, t, now = Date.now() }) {
  const detail = row?.detail;

  if (!detail) {
    return "";
  }

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
    case "fremgang": {
      const before = toNumber(detail.before);
      const after = toNumber(detail.now);

      // The lift and both estimates, or nothing: "– → 62 kg" says no more
      // than the value beside it.
      return detail.lift && before !== null && after !== null
        ? t("category.rows.fremgang", {
            lift: t(fremgangTabLabelKey(detail.lift)),
            before: formatEstimateKg(before),
            now: formatEstimateKg(after),
          })
        : "";
    }
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

/* -------------------------------------------------------------- the texts -- */

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

/* ------------------------------------------------------------- the colour -- */

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
 * `color` as text that holds `minimum` on every one of `surfaces`: itself
 * when it does, otherwise drawn toward `ink` - the theme's title colour,
 * which always does - a tenth at a time until it does.
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

// Everything a category's colour is written on as text: the cards, the page
// behind them, and the fields inside the personal card.
const TEXT_SURFACES = ["cardBackground", "background", "uiBackground"];

/**
 * A category's colour twice over: `tone` for what is filled - the glow, the
 * bar, a tint - and `toneText` for its title and its values, the same on the
 * card and on the page. As text it holds 4.5:1 on every surface it is written
 * on, in every accent theme, light and dark. Progress is the accent, whose
 * text form is primaryText; the other tones are drawn toward the title colour
 * only where they would read under that, which so far is only in light mode.
 */
export function categoryTone(theme, category) {
  const token = categoryToneToken(category);
  const tone = theme[token] ?? theme.primary;
  const text = token === "primary" ? theme.primaryText : tone;

  return {
    tone,
    toneText: readableTone(
      text,
      TEXT_SURFACES.map((surface) => theme[surface]),
      theme.title
    ),
  };
}
