// What the reps carousel shows and what a swipe does to the count. Pure, so
// scripts/test-set-editors.js loads it.
//
// The carousel is a strip of numbers that follows the finger while it is down,
// like scrolling a page, and settles on one number when it lets go - only
// then does the count change.

/** The reps as a whole number: typed text, a stored number or nothing (0). */
export function repsAsNumber(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const numeric = Math.trunc(Number(String(value).replace(",", ".")));

  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

/**
 * The numbers of the strip around the one now: `spread` on each side (the two
 * beside it show, the next one is only there so the strip slides in without a
 * gap). Under 0 there is nothing - `value` is null, drawn as a blank.
 * [{ offset: -3, value: null }, ..., { offset: 0, value: 8 }, ...]
 */
export function repsCarouselItems(value, spread = 3) {
  const current = repsAsNumber(value);
  const items = [];

  for (let offset = -spread; offset <= spread; offset += 1) {
    const reps = current + offset;

    items.push({ offset, value: reps >= 0 ? reps : null });
  }

  return items;
}

/**
 * How far the strip may follow a finger that has moved `dx` pixels, `stepPx`
 * to a number: freely towards more reps, and towards fewer only as far as 0
 * (with a little give, so the end of the strip is felt).
 */
export function clampRepsDrag(startReps, dx, stepPx) {
  const start = repsAsNumber(startReps);
  const farthestRight = start * stepPx + stepPx * 0.3;

  return Math.min(dx, farthestRight);
}

/**
 * Where a drag settles when the finger lets go: the number nearest to where
 * the strip is, pushed on a little by how fast it was moving (`vx`, pixels
 * per millisecond, negative to the left) - so a flick goes further than a
 * slow drag. Left is more, right is fewer, never below 0, whole reps.
 *
 * `offset` is where the strip is drawn from the middle once the new count is
 * in the middle: the same place on screen it was let go at, so it can glide the
 * rest of the way.
 */
export function settleReps(startReps, dx, vx, stepPx) {
  const start = repsAsNumber(startReps);
  const dragged = clampRepsDrag(start, dx, stepPx);
  const projected = dragged + (Number(vx) || 0) * 120;
  const passed = Math.round(-projected / stepPx);
  const reps = Math.max(0, start + passed);
  const settledPassed = reps - start;

  return { reps, offset: dragged + settledPassed * stepPx };
}
