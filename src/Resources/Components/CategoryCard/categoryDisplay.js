import { formatNumber } from "@localization";
import { mixHexColors } from "@utils/colorMix";
import { categoryToneToken, fremgangTabLabelKey } from "@utils/gymCategories";
import { roundToNearestWeightIncrement } from "@utils/oneRepMaxUtils";

// How a category's colour, value and detail are shown on a card. The card
// opens the category page, so both follow the same rules - the language's
// decimal comma, one decimal on a rise under ten per cent, estimates to the
// half kilo, and the same readable shade of the category's colour - and the
// number you tapped is the number you land on.

/* ------------------------------------------------------------- colour -- */

function channels(hex) {
  const value = typeof hex === "string" && hex.startsWith("#") ? hex.slice(1) : "";
  const full = value.length === 3 ? value.split("").map((char) => char + char).join("") : value.slice(0, 6);

  if (!/^[0-9a-f]{6}$/i.test(full)) {
    return null;
  }

  return [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16) / 255);
}

function luminance(hex) {
  const rgb = channels(hex);

  if (!rgb) {
    return null;
  }

  const [r, g, b] = rgb.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast between two hex colours, or null when either cannot be read. */
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
 * when it does, otherwise drawn towards `ink` - the theme's title colour,
 * which always does - a tenth at a time until it does.
 */
export function readableOn(color, surfaces, ink, minimum = 4.5) {
  const worst = (candidate) =>
    Math.min(...surfaces.map((surface) => contrastRatio(candidate, surface) ?? Infinity));

  for (let step = 0; step <= 10; step += 1) {
    const candidate = step === 0 ? color : mixHexColors(color, ink, step / 10);

    if (worst(candidate) >= minimum) {
      return candidate;
    }
  }

  return ink;
}

/**
 * A category's colour twice over: `tone` for what is filled - the glow, the
 * bar, a tint - and `ink` for its title and values. The accent has a text
 * token of its own; the others are only darkened where they would read under
 * 4.5:1 on a card or the page behind it, which is the green of the light
 * palette and most accent themes' second colour.
 */
export function getCategoryTone(theme, category) {
  const token = categoryToneToken(category);
  const tone = theme[token] ?? theme.primary;
  const base = token === "primary" ? theme.primaryText : tone;

  return { tone, ink: readableOn(base, [theme.cardBackground, theme.background], theme.title) };
}

/* -------------------------------------------------------------- value -- */

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

function formatKg(value) {
  return formatNumber(value, { maximumFractionDigits: 2 });
}

/** "412,5" for kilos, "+12" or "+2,5" for a rise in per cent, "18" for workouts and points. */
export function formatCategoryValue(category, value) {
  const numeric = toNumber(value);

  if (numeric === null) {
    return "–";
  }

  if (category === "powerlifting") {
    return formatKg(numeric);
  }

  if (category === "fremgang") {
    const text = formatNumber(numeric, { maximumFractionDigits: Math.abs(numeric) < 10 ? 1 : 0 });

    return numeric > 0 ? `+${text}` : text;
  }

  return formatNumber(Math.round(numeric));
}

/** The word after the value: workouts, kg, %, points - in step with the value's count. */
export function categoryUnit(t, category, value) {
  const count = toNumber(value) ?? 0;

  switch (category) {
    case "powerlifting":
      return t("category.units.kg");
    case "fremgang":
      return t("category.units.percent");
    case "flid":
      return t("category.units.workouts", { count });
    default:
      return t("category.units.points", { count });
  }
}

/**
 * What #1 did, under their name inside one centre: the three lifts, the
 * streak, the rise, the reps. Null when there is nothing to say. A lift that
 * is missing counts 0, as it does in the total.
 */
export function formatCategoryDetail(t, category, detail) {
  if (!detail) {
    return null;
  }

  switch (category) {
    case "powerlifting":
      return [detail.bench, detail.squat, detail.deadlift]
        .map((kilos) => formatKg(toNumber(kilos) ?? 0))
        .join(" · ");
    case "flid": {
      const weeks = toNumber(detail.weeks);

      return weeks !== null && weeks > 0 ? t("gyms.card.flidDetail", { count: weeks }) : null;
    }
    case "fremgang": {
      const before = toNumber(detail.before);
      const now = toNumber(detail.now);

      // Estimates, so to the half kilo a bar is loaded in.
      return detail.lift && before !== null && now !== null
        ? t("gyms.card.fremgangDetail", {
            lift: t(fremgangTabLabelKey(detail.lift)),
            before: formatKg(roundToNearestWeightIncrement(before, 0.5)),
            now: formatKg(roundToNearestWeightIncrement(now, 0.5)),
          })
        : null;
    }
    case "calisthenics":
      return t("gyms.card.calisthenicsDetail", {
        pullups: formatNumber(Math.round(toNumber(detail.pullups) ?? 0)),
        dips: formatNumber(Math.round(toNumber(detail.dips) ?? 0)),
        pushups: formatNumber(Math.round(toNumber(detail.pushups) ?? 0)),
      });
    default:
      return null;
  }
}
