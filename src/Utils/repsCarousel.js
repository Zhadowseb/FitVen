// What the reps carousel shows and what a drag does to the count. Pure, so
// scripts/test-set-editors.js loads it.
//
// The carousel is a strip of numbers laid out side by side - the reps n at
// n * step pixels - and a scroll position that says which part of it is in
// the middle. A finger moves the position freely, like scrolling a page, and
// every number that passes the middle is the count for as long as it is there;
// letting go settles on the nearest one.

/** The reps as a whole number: typed text, a stored number or nothing (0). */
export function repsAsNumber(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const numeric = Math.trunc(Number(String(value).replace(",", ".")));

  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

/**
 * Where the strip is when a finger that landed with it at `startScroll` has
 * moved `dx` pixels (negative to the left): left shows more reps, right fewer,
 * and not further right than 0 and a little give, so the end of the strip is
 * felt. The finger may have landed on a strip that was still gliding, so this
 * starts from where it was and not from a count.
 */
export function scrollPositionFor(startScroll, dx, stepPx) {
  return Math.max(-stepPx * 0.3, Number(startScroll) - dx);
}

/** The count at a scroll position: the number nearest to the middle, never below 0. */
export function repsAtScroll(scroll, stepPx) {
  return Math.max(0, Math.round(Number(scroll) / stepPx));
}

/**
 * Where a drag settles when the finger lets go: the number nearest to where
 * the strip is, pushed on a little by how fast it was going (`vx`, pixels per
 * millisecond, negative to the left - towards more reps) so a flick goes
 * further than a slow drag.
 */
export function settledReps(scroll, vx, stepPx) {
  return repsAtScroll(Number(scroll) - (Number(vx) || 0) * 120, stepPx);
}

/**
 * The numbers to draw around `centre`: `spread` on each side, none under 0. Two
 * of them show on each side; the rest are the buffer that lets a fast drag
 * run ahead of the next render without ever showing a gap.
 */
export function visibleRepsWindow(centre, spread) {
  const middle = repsAsNumber(centre);
  const numbers = [];

  for (let reps = Math.max(0, middle - spread); reps <= middle + spread; reps += 1) {
    numbers.push(reps);
  }

  return numbers;
}
