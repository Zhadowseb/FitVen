// What the reps carousel shows and what a swipe does to the count. Pure, so
// scripts/test-set-editors.js loads it.

/** The reps as a whole number: typed text, a stored number or nothing (0). */
export function repsAsNumber(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const numeric = Math.trunc(Number(String(value).replace(",", ".")));

  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

/** The three numbers: before (null at 0 - there is nothing under it), now, after. */
export function repsCarouselNumbers(value) {
  const current = repsAsNumber(value);

  return { before: current > 0 ? current - 1 : null, current, after: current + 1 };
}

/**
 * A swipe of `dx` pixels, `stepPx` to a rep, from `startReps`: left is more
 * (the next number slides in), right is fewer, never below 0, whole reps. The
 * `offset` is how far the numbers are still drawn from the middle, so they
 * slide with the finger and snap as each one is passed.
 */
export function repsFromSwipe(startReps, dx, stepPx) {
  const start = repsAsNumber(startReps);
  const passed = Math.trunc(-dx / stepPx);
  const reps = Math.max(0, start + passed);
  // At 0 a swipe right moves nothing: no slide either.
  const effectivePassed = reps - start;

  const offset = reps === 0 && passed < 0 ? 0 : dx + effectivePassed * stepPx;

  return { reps, offset: Math.max(-stepPx, Math.min(stepPx, offset)) };
}
