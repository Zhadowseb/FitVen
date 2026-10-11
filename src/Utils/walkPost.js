import { averagePaceSecondsPerKm, stepsPerKilometre } from "./walkTracking";

// The Feed post of a finished walk (design: WalkPost.dc.html, brief: WALK_POST.md),
// without the phone: what goes into the post's payload, and how the route is
// made safe to share. Distance and time are the numbers a walk post is about;
// pace, steps, cadence and steps/km are worked out when the post is drawn (so
// the viewer's unit follows the viewer), never stored.
//
// The route is the thing to be careful with. A walk usually starts and ends at
// home, so the post never shows where it started or ended: the start and the end
// are cut away before the route leaves the phone (trimRoute), and what is left
// is simplified and rounded. The raw LocationLog points never go into a post.

// Cut from each end, and never share a route shorter than this: a short walk
// is nothing but start and end.
export const ROUTE_TRIM_METERS = 200;
// A little more than that is cut, so that rounding the coordinates (about a
// metre) can never put a point back inside the 200 m.
const TRIM_MARGIN_METERS = 5;
export const MIN_ROUTE_METERS = 800;
// Douglas-Peucker, and a cap that keeps the payload small in a long feed.
export const ROUTE_TOLERANCE_METERS = 10;
export const MAX_ROUTE_POINTS = 150;
export const ROUTE_DECIMALS = 5;

export const WALK_POST_VERSION = 1;

const EARTH_RADIUS_METERS = 6371000;
const toRadians = (degrees) => (degrees * Math.PI) / 180;

/** The distance between two { latitude, longitude } in metres. */
export function distanceBetween(from, to) {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * The stretches of a walk's route - [[{ latitude, longitude }, ...], ...], one
 * for each stretch between pauses - as one line of usable points. A break
 * marker (no position) is not a point, and the walk's own order is kept.
 */
export function flattenRoute(segments) {
  const points = [];

  for (const segment of segments ?? []) {
    for (const point of segment ?? []) {
      // A break marker has no position at all (null), which is not 0.
      const hasPosition = point && point.latitude != null && point.longitude != null;
      const latitude = hasPosition ? Number(point.latitude) : NaN;
      const longitude = hasPosition ? Number(point.longitude) : NaN;

      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        points.push({ latitude, longitude });
      }
    }
  }

  return points;
}

function pathLength(points) {
  let total = 0;

  for (let index = 1; index < points.length; index += 1) {
    total += distanceBetween(points[index - 1], points[index]);
  }

  return total;
}

/**
 * The route without where it started and ended: null when it is shorter than
 * MIN_ROUTE_METERS, or nothing is left. Two rules, and both have to hold for
 * every point that stays:
 *   - it is more than 200 m along the route from the start and from the end;
 *   - it is more than 200 m in a straight line from the first and the last
 *     position - so a walk that comes back past the front door half way does not
 *     show it.
 * What is kept is one stretch: from after the last point near the start to before
 * the first point near the end, so no line is drawn across a hole.
 */
export function trimRoute(points, trimMeters = ROUTE_TRIM_METERS) {
  if (!Array.isArray(points) || points.length < 2) {
    return null;
  }

  const total = pathLength(points);

  if (total < MIN_ROUTE_METERS) {
    return null;
  }

  const radius = trimMeters + TRIM_MARGIN_METERS;

  const first = points[0];
  const last = points[points.length - 1];
  const along = [0];

  for (let index = 1; index < points.length; index += 1) {
    along.push(along[index - 1] + distanceBetween(points[index - 1], points[index]));
  }

  const nearStart = (index) =>
    along[index] < radius || distanceBetween(points[index], first) < radius;
  const nearEnd = (index) =>
    total - along[index] < radius || distanceBetween(points[index], last) < radius;

  let from = 0;

  for (let index = 0; index < points.length; index += 1) {
    if (nearStart(index)) {
      from = index + 1;
    }
  }

  let to = points.length - 1;

  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (nearEnd(index)) {
      to = index - 1;
    }
  }

  const kept = points.slice(from, to + 1);

  return kept.length >= 2 ? kept : null;
}

// Douglas-Peucker on a flat map around the route (a few kilometres: close
// enough to flat), tolerance in metres.
function simplify(points, toleranceMeters) {
  if (points.length <= 2) {
    return points;
  }

  const meanLatitude = points.reduce((sum, point) => sum + point.latitude, 0) / points.length;
  const metersPerDegreeLatitude = (Math.PI * EARTH_RADIUS_METERS) / 180;
  const metersPerDegreeLongitude = metersPerDegreeLatitude * Math.cos(toRadians(meanLatitude));
  const flat = points.map((point) => ({
    x: point.longitude * metersPerDegreeLongitude,
    y: point.latitude * metersPerDegreeLatitude,
  }));
  const keep = new Array(points.length).fill(false);

  keep[0] = true;
  keep[points.length - 1] = true;

  const stack = [[0, points.length - 1]];

  while (stack.length > 0) {
    const [start, end] = stack.pop();
    let farthest = -1;
    let farthestDistance = 0;
    const dx = flat[end].x - flat[start].x;
    const dy = flat[end].y - flat[start].y;
    const lengthSquared = dx * dx + dy * dy;

    for (let index = start + 1; index < end; index += 1) {
      const px = flat[index].x - flat[start].x;
      const py = flat[index].y - flat[start].y;
      const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / lengthSquared));
      const distance = Math.hypot(px - t * dx, py - t * dy);

      if (distance > farthestDistance) {
        farthestDistance = distance;
        farthest = index;
      }
    }

    if (farthest !== -1 && farthestDistance > toleranceMeters) {
      keep[farthest] = true;
      stack.push([start, farthest], [farthest, end]);
    }
  }

  return points.filter((_, index) => keep[index]);
}

const round = (value) => Number(value.toFixed(ROUTE_DECIMALS));

/**
 * The route as the post carries it - { points: [[lat, lng], ...] } - from a
 * walk's stretches, or null when there is nothing safe to share. Trimmed,
 * simplified to about 10 m (more where it would be over 150 points) and
 * rounded to five decimals.
 */
export function buildPostRoute(segments) {
  const trimmed = trimRoute(flattenRoute(segments));

  if (!trimmed) {
    return null;
  }

  let tolerance = ROUTE_TOLERANCE_METERS;
  let simplified = simplify(trimmed, tolerance);

  while (simplified.length > MAX_ROUTE_POINTS) {
    tolerance *= 1.5;
    simplified = simplify(trimmed, tolerance);
  }

  if (simplified.length < 2) {
    return null;
  }

  return { points: simplified.map((point) => [round(point.latitude), round(point.longitude)]) };
}

/** Whether a finished walk has anything to say in a post: time, and a distance or steps. */
export function hasWalkToPost({ movingSeconds, distanceMeters, steps }) {
  return Number(movingSeconds) > 0 && (Number(distanceMeters) > 0 || Number(steps) > 0);
}

/**
 * Whether a route could be shared at all (the "Share route" switch is only
 * shown then): a walk of at least MIN_ROUTE_METERS with positions.
 */
export function canShareRoute(segments) {
  return buildPostRoute(segments) !== null;
}

/**
 * The payload of a walk post, or null when the walk has nothing in it. Never
 * a post of zeros: this is also what stops a phone that does not have the
 * walk's numbers (a new phone, a reinstall - they stay on the phone that
 * tracked the walk) from overwriting a good post with an empty one.
 */
export function buildWalkPayload({ distanceMeters, movingSeconds, steps, segments, shareRoute }) {
  if (!hasWalkToPost({ movingSeconds, distanceMeters, steps })) {
    return null;
  }

  const seconds = Math.round(Number(movingSeconds));
  const stepCount = Number(steps) > 0 ? Math.round(Number(steps)) : null;
  const meters = Number(distanceMeters) > 0 ? Math.round(Number(distanceMeters)) : null;

  return {
    version: WALK_POST_VERSION,
    distanceMeters: meters,
    movingSeconds: seconds,
    steps: stepCount,
    cadence: stepCount === null ? null : Math.round(stepCount / (seconds / 60)),
    route: shareRoute ? buildPostRoute(segments) : null,
  };
}

/* --------------------------------------------------------------- drawing -- */

/** The distance as the post writes it: "3.42" (km). */
export function formatWalkDistance(distanceMeters) {
  return (Number(distanceMeters) / 1000).toFixed(2);
}

/**
 * The time as the post writes it: { value: "42", unit: "min" } under an hour,
 * { value: "1:08", unit: "h" } from one hour up.
 */
export function formatWalkTime(movingSeconds) {
  const minutes = Math.max(1, Math.round(Number(movingSeconds) / 60));

  if (minutes < 60) {
    return { value: String(minutes), unit: "min" };
  }

  return {
    value: `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`,
    unit: "h",
  };
}

/**
 * What the small row under a walk post shows, from the payload alone: pace
 * (seconds per km, null without a distance), steps, steps a minute and steps a
 * km. Without a step counter it is the pace only, and nothing is ever zero.
 */
export function walkPostStats(payload) {
  const distance = Number(payload?.distanceMeters) > 0 ? Number(payload.distanceMeters) : null;
  const seconds = Number(payload?.movingSeconds) > 0 ? Number(payload.movingSeconds) : null;
  const steps = Number(payload?.steps) > 0 ? Number(payload.steps) : null;
  const cadence = Number(payload?.cadence) > 0 ? Number(payload.cadence) : null;
  const pace = distance && seconds ? averagePaceSecondsPerKm(distance, seconds) : null;
  const perKm = steps && distance ? stepsPerKilometre(steps, distance) : null;

  return { pace, steps, cadence, stepsPerKm: perKm };
}

/** The route's points as the post draws them: [{ latitude, longitude }], or [] when it is not shared. */
export function routePointsOf(payload) {
  const points = payload?.route?.points;

  if (!Array.isArray(points)) {
    return [];
  }

  return points
    .filter((point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]))
    .map(([latitude, longitude]) => ({ latitude, longitude }));
}
