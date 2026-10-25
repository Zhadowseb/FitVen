// The four suggestion rows on the empty Ask screen. They are picked from the
// person's own data where that is cheap, and fall back to fixed questions, so
// somebody with no history still sees four. Pure (Node-testable): `t` is
// passed in.

/**
 * The lift to ask about: of the lifts the Records screen trusts enough to give
 * a direction (buildDirections: three sessions, trained in the last weeks),
 * the one that has gone nowhere and been trained most. Null when none is flat.
 * `directions` are what buildDirections returns.
 */
export function pickFlatLift(directions) {
  let best = null;

  for (const entry of Array.isArray(directions) ? directions : []) {
    if (!entry?.qualifies || entry.direction !== "flat" || !entry.name) {
      continue;
    }

    if (!best || entry.sessionCount > best.sessionCount) {
      best = entry;
    }
  }

  return best ? best.name : null;
}

/**
 * Four rows: { id, text }. `facts` are what was found on the phone, any of
 * them may be missing: { flatLift, nextWorkout, monthLabel }.
 */
export function buildEmptyStateRows(facts, t) {
  const { flatLift = null, nextWorkout = null, monthLabel = null } = facts ?? {};

  return [
    {
      id: "stuck",
      text: flatLift ? t("ask.suggest.stuck", { exercise: flatLift }) : t("ask.suggest.stuckAny"),
    },
    {
      id: "next",
      text: nextWorkout ? t("ask.suggest.next", { workout: nextWorkout }) : t("ask.suggest.today"),
    },
    {
      id: "month",
      text: monthLabel ? t("ask.suggest.month", { month: monthLabel }) : t("ask.suggest.recent"),
    },
    { id: "volume", text: t("ask.suggest.volume") },
  ];
}
