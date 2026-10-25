// The three tiers of Ask FitVen and how many questions each has left this
// month (docs/ASK-FITVEN.md). Pure, so scripts/test-ask-fitven-app.js loads it
// in Node. The limits are the cloud's (public.ai_tier_limit); nothing here
// knows a number.

// Cheapest first. "Down" is towards the start, "up" towards the end.
export const ASK_TIERS = ["haiku", "sonnet", "opus"];

// What is assumed when the recommendation could not be had.
export const FALLBACK_TIER = "sonnet";

export function isAskTier(value) {
  return ASK_TIERS.includes(value);
}

function wholeNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : null;
}

/**
 * The cloud's Usage object, or null when it is not one. Every tier is present
 * in what comes back: a tier the answer left out is unknown, not empty.
 */
export function normalizeUsage(raw) {
  if (!raw || typeof raw !== "object" || !raw.tiers || typeof raw.tiers !== "object") {
    return null;
  }

  const tiers = {};

  for (const tier of ASK_TIERS) {
    const used = wholeNumber(raw.tiers[tier]?.used);
    const limit = wholeNumber(raw.tiers[tier]?.limit);

    if (used === null || limit === null) {
      continue;
    }

    tiers[tier] = { used, limit };
  }

  if (Object.keys(tiers).length === 0) {
    return null;
  }

  return { month: typeof raw.month === "string" ? raw.month : null, tiers };
}

/**
 * Questions left on a tier this month: a number, or null when the usage is not
 * known (not loaded, or the tier is missing from it). Unknown is not zero - a
 * person is not turned away on a guess; the cloud has the last word.
 */
export function questionsLeft(usage, tier) {
  const entry = usage?.tiers?.[tier];

  if (!entry) {
    return null;
  }

  return Math.max(0, entry.limit - entry.used);
}

function hasQuestions(usage, tier) {
  const left = questionsLeft(usage, tier);

  return left === null || left > 0;
}

/**
 * Which tier is preselected: the recommended one if it has questions left,
 * otherwise the next one DOWN that has some; if none has any, the quota state.
 * Going up is never automatic - it costs more of a scarcer allowance - so a
 * quota state offers the tiers that have questions left (tiersWithQuestions)
 * and lets the person choose.
 *
 *   -> { tier, recommended, quotaReached: false }
 *   -> { tier: null, recommended, quotaReached: true }
 */
export function chooseDefaultTier({ recommended = null, usage = null } = {}) {
  const wanted = isAskTier(recommended) ? recommended : FALLBACK_TIER;

  for (let index = ASK_TIERS.indexOf(wanted); index >= 0; index -= 1) {
    if (hasQuestions(usage, ASK_TIERS[index])) {
      return { tier: ASK_TIERS[index], recommended: wanted, quotaReached: false };
    }
  }

  return { tier: null, recommended: wanted, quotaReached: true };
}

/** The tiers that still have a question this month, cheapest first. */
export function tiersWithQuestions(usage) {
  return ASK_TIERS.filter((tier) => hasQuestions(usage, tier));
}

/** True when a tier is known to have none left. */
export function isTierExhausted(usage, tier) {
  return questionsLeft(usage, tier) === 0;
}
