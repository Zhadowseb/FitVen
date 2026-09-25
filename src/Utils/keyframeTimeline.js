// CSS keyframe timing for animations that run as Reanimated worklets: the
// same cubic-bezier curves, per-keyframe easing, delays, iterations and
// directions a browser uses, so an effect designed as a CSS prototype moves
// across number for number instead of being eyeballed.
//
// Every function is a worklet. It runs on the UI thread inside
// useAnimatedStyle / useAnimatedProps, and just as well in plain Node, where
// the directive is an ignored string - which is what the tests rely on.
// Tracks and curves are plain arrays, so a worklet can capture them.

export const LINEAR = null;
// The CSS keywords.
export const EASE = [0.25, 0.1, 0.25, 1];
export const EASE_IN = [0.42, 0, 1, 1];
export const EASE_OUT = [0, 0, 0.58, 1];
export const EASE_IN_OUT = [0.42, 0, 0.58, 1];

export function clamp01(value) {
  "worklet";
  return value <= 0 ? 0 : value >= 1 ? 1 : value;
}

/**
 * `cubic-bezier(x1, y1, x2, y2)` at `t`, 0 to 1. Solves the curve for x the
 * way browsers do - Newton's method, with bisection when it stalls - so a y
 * past 1 overshoots exactly as far as it does in the prototype.
 */
export function cubicBezier(x1, y1, x2, y2, t) {
  "worklet";
  if (t <= 0) {
    return 0;
  }

  if (t >= 1) {
    return 1;
  }

  // The curve as polynomials in u: x(u) = ((ax u + bx) u + cx) u, and y alike.
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  let u = t;
  let solved = false;

  for (let step = 0; step < 8; step += 1) {
    const error = ((ax * u + bx) * u + cx) * u - t;

    if (Math.abs(error) < 1e-6) {
      solved = true;
      break;
    }

    const slope = (3 * ax * u + 2 * bx) * u + cx;

    if (Math.abs(slope) < 1e-6) {
      break;
    }

    u -= error / slope;
  }

  if (!solved || u < 0 || u > 1) {
    let low = 0;
    let high = 1;

    u = t;

    for (let step = 0; step < 30; step += 1) {
      const x = ((ax * u + bx) * u + cx) * u;

      if (Math.abs(x - t) < 1e-6) {
        break;
      }

      if (x < t) {
        low = u;
      } else {
        high = u;
      }

      u = (low + high) / 2;
    }
  }

  return ((ay * u + by) * u + cy) * u;
}

/** `curve` at `t`: one of the constants above, or a cubic-bezier's four numbers. */
export function ease(curve, t) {
  "worklet";
  if (!curve) {
    return clamp01(t);
  }

  return cubicBezier(curve[0], curve[1], curve[2], curve[3], t);
}

/**
 * A keyframe track - `[[offset, value], ...]`, offsets from 0 to 1 in order -
 * at progress `p`. As in CSS, the curve eases each stretch between two
 * keyframes on its own, not the animation as a whole.
 */
export function sampleTrack(track, p, curve) {
  "worklet";
  const last = track.length - 1;

  if (p <= track[0][0]) {
    return track[0][1];
  }

  if (p >= track[last][0]) {
    return track[last][1];
  }

  for (let index = 1; index <= last; index += 1) {
    const end = track[index];

    if (p <= end[0]) {
      const start = track[index - 1];
      const span = end[0] - start[0];
      const local = span > 0 ? (p - start[0]) / span : 1;

      return start[1] + (end[1] - start[1]) * ease(curve, local);
    }
  }

  return track[last][1];
}

/**
 * Where an infinite animation is in its iteration, 0 to 1, `time` ms after
 * the card began: its delay first - a negative one starts it part-way
 * through - then its iterations, backwards when `direction` is "reverse" and
 * every other one backwards when it is "alternate". Before its delay it rests
 * on its first keyframe.
 */
export function loopProgress(time, delay, duration, direction) {
  "worklet";
  const elapsed = time - delay;

  if (elapsed <= 0 || !(duration > 0)) {
    return direction === "reverse" ? 1 : 0;
  }

  const cycles = elapsed / duration;
  const iteration = Math.floor(cycles);
  const progress = cycles - iteration;

  if (direction === "reverse") {
    return 1 - progress;
  }

  if (direction === "alternate" && iteration % 2 === 1) {
    return 1 - progress;
  }

  return progress;
}

/** A single run's progress: 0 until its delay, 1 once it has finished. */
export function onceProgress(time, delay, duration) {
  "worklet";
  if (!(duration > 0)) {
    return time >= delay ? 1 : 0;
  }

  return clamp01((time - delay) / duration);
}

/** `a` to `b` by `amount`. */
export function mix(a, b, amount) {
  "worklet";
  return a + (b - a) * amount;
}
