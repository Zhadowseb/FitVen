import { buildWalkPayload } from "../Utils/walkPost";
import * as walkService from "./walkService";

// The payload of a walk's post, made from what the phone has kept of the walk
// (Services/walkService.js: the segment with its distance, time and steps, and
// the route in LocationLog). Rules and the route's trimming are in
// Utils/walkPost.js; this only reads the walk and hands it over.
//
// A walk's numbers exist on the phone that tracked it and nowhere else - Run and
// LocationLog are not in the cloud. A phone without them (a new one, a
// reinstall) has nothing to build a post from, and says so with null: the caller
// then posts nothing, and never overwrites a good post with an empty one.

/**
 * The walk as the post needs it - { distanceMeters, movingSeconds, steps,
 * points } - or null when this phone has no record of it.
 */
export async function readWalkForPost(db, workoutId) {
  const { points, totals, segment } = await walkService.loadWalk(db, workoutId);

  if (!segment) {
    return null;
  }

  return {
    distanceMeters: totals.distanceKm * 1000,
    movingSeconds: totals.durationSeconds,
    steps: totals.steps,
    points,
  };
}

/**
 * The payload of the walk's post, or null when there is nothing to post: the
 * phone does not have the walk, or nothing was recorded in it. `shareRoute` says
 * whether the trimmed route goes with it; a "summary only" post never has one.
 */
export async function buildWalkSummaryPayload(db, workoutId, { shareRoute, summaryOnly = false }) {
  const walk = await readWalkForPost(db, workoutId);

  if (!walk) {
    return null;
  }

  return buildWalkPayload({
    distanceMeters: walk.distanceMeters,
    movingSeconds: walk.movingSeconds,
    steps: walk.steps,
    segments: [walk.points],
    shareRoute: Boolean(shareRoute) && !summaryOnly,
  });
}

/**
 * What the offer after a walk needs: whether there is anything to post, and
 * whether a route could go with it (the switch is only shown then).
 */
export async function getWalkPostOffer(db, workoutId) {
  const withRoute = await buildWalkSummaryPayload(db, workoutId, { shareRoute: true });

  if (!withRoute) {
    return { canPost: false, canShareRoute: false };
  }

  return { canPost: true, canShareRoute: withRoute.route !== null };
}

/**
 * The title of the post: the walk's own name when the person gave it one, and
 * its type otherwise. The type is never empty (the table does not accept a
 * blank title), and the card does not draw a title that is the type.
 */
export function walkPostTitle({ label, workout_type: workoutType }) {
  const type = String(workoutType ?? "Walk").trim() || "Walk";
  const name = String(label ?? "").trim();

  return name && name.toLowerCase() !== type.toLowerCase() ? name : type;
}
