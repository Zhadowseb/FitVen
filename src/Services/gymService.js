// Centres and centre leaderboards.
//
// Three jobs: match a workout to the centre it happened in (one position fix
// at start or finish, then the match_gym RPC), push the best set per exercise
// of a finished strength workout to gym_lift, and read the leaderboards behind
// the Centres screens. Every ranked read is an RPC - the migration header in
// supabase/migrations/20260917120000_gyms-and-lift-verification.sql explains
// why the table itself only answers for your own rows.
import * as Location from "expo-location";

import { getCurrentUserId, supabase } from "../Database/supaBaseClient";
import { weightliftingRepository, workoutRepository } from "../Repository";
import { attachAvatarUrls } from "./avatarUrls";
import { LOCATION_WORKOUT_TYPES } from "./cloudSync/workoutTypes";
import {
  selectBestLiftsPerExercise,
  selectLiftsToUpsert,
} from "../Utils/gymUtils";

const GYM_TABLE = "gym";
const GYM_LIFT_TABLE = "gym_lift";
const GYM_LIFT_VOTE_TABLE = "gym_lift_vote";
const PROFILE_PRIVATE_TABLE = "profile_private";
const GYM_SELECT_FIELDS =
  "id, chain, name, short_name, address, postal_code, city, latitude, longitude, match_radius_m, image_url";

export const LIFT_VIDEO_BUCKET = "lift-videos";
export const LIFT_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const LIFT_VIDEO_MAX_DURATION_SECONDS = 30;
export const GYM_SCOPE_GYM = "gym";
export const GYM_SCOPE_FRIENDS = "friends";
export const LIFT_UNIT_KG = "kg";
export const LIFT_UNIT_BODYWEIGHT = "bw";

/**
 * The reasons the reject step offers. The values are what the column check
 * accepts, so a new one here without one there fails the insert.
 */
export const REJECTION_REASONS = [
  { value: "depth", label: "Not deep enough" },
  { value: "lockout", label: "No lockout" },
  { value: "assist", label: "Assisted or spotted" },
  { value: "weight", label: "Weight does not match" },
  { value: "other", label: "Something else" },
];

const GYM_SETUP_MESSAGE =
  "Centres are not set up in Supabase yet. Run supabase/migrations/20260917120000_gyms-and-lift-verification.sql in the Supabase SQL editor first.";
const POSITION_TIMEOUT_MS = 12000;
const SIGNED_VIDEO_TTL_SECONDS = 60 * 60;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeGymError(error) {
  const message = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  const missing =
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find");

  if (
    missing &&
    (message.includes("gym") || message.includes("lift") || message.includes("match_gym"))
  ) {
    return new Error(GYM_SETUP_MESSAGE);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error?.message ?? "Something went wrong with centres."));
}

async function getAuthenticatedUserId() {
  try {
    return await getCurrentUserId();
  } catch (error) {
    if (String(error?.message ?? "").toLowerCase().includes("auth session missing")) {
      return null;
    }

    throw error;
  }
}

/* -------------------------------------------------------------- mapping -- */

/** A gym row or RPC summary, in the shape the screens read. */
export function mapGym(row) {
  if (!row) {
    return null;
  }

  const id = toNumber(row.id);

  if (id === null) {
    return null;
  }

  return {
    id,
    chain: row.chain ?? null,
    name: row.name ?? null,
    shortName: row.short_name ?? row.shortName ?? row.name ?? null,
    address: row.address ?? null,
    postalCode: row.postal_code ?? null,
    city: row.city ?? null,
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    matchRadiusM: toNumber(row.match_radius_m) ?? 120,
    imageUrl: row.image_url ?? null,
    memberCount: toNumber(row.member_count) ?? 0,
    followedMemberCount: toNumber(row.followed_member_count) ?? 0,
    isHomeGym: Boolean(row.is_home_gym),
    distanceM: toNumber(row.distance_m),
    workoutCount: toNumber(row.workout_count) ?? 0,
  };
}

function mapLiftRow(row) {
  if (!row) {
    return null;
  }

  return {
    liftId: toNumber(row.lift_id ?? row.id),
    rank: toNumber(row.rank),
    userId: row.user_id ?? null,
    displayName: row.display_name ?? "Member",
    avatarPath: row.avatar_path ?? null,
    avatarUpdatedAt: null,
    avatarUrl: null,
    gym: row.gym
      ? {
          id: toNumber(row.gym.id),
          shortName: row.gym.short_name ?? null,
          city: row.gym.city ?? null,
        }
      : null,
    exerciseId: toNumber(row.exercise_id),
    exerciseName: row.exercise_name ?? null,
    weightKg: toNumber(row.weight_kg),
    reps: toNumber(row.reps),
    bodyweightKg: toNumber(row.bodyweight_kg),
    ratio: toNumber(row.ratio),
    videoStatus: row.video_status ?? "none",
    approvals: toNumber(row.approvals) ?? 0,
    rejections: toNumber(row.rejections) ?? 0,
    performedAt: row.performed_at ?? null,
    previousWeightKg: toNumber(row.previous_weight_kg),
    isMe: Boolean(row.is_me),
    gapToTop: toNumber(row.gap_to_top),
    videoPath: row.video_path ?? null,
    videoUrl: null,
    videoUploadedAt: row.video_uploaded_at ?? null,
    rankIfVerified: toNumber(row.rank_if_verified),
    canVote: row.can_vote === undefined ? true : Boolean(row.can_vote),
    isHomeGym: Boolean(row.is_home_gym),
  };
}

async function attachLiftAvatars(lifts) {
  const targets = lifts.filter(Boolean);

  if (targets.length) {
    await attachAvatarUrls(targets);
  }

  return lifts;
}

/* ------------------------------------------------------------ gym lookup -- */

const gymCache = new Map();

/** Centres by id, cached for the session - names on tiles ask for these a lot. */
export async function getGymsByIds(gymIds = []) {
  const wanted = [...new Set(gymIds.map(toNumber).filter((id) => id !== null))];
  const found = new Map();
  const missing = [];

  for (const id of wanted) {
    if (gymCache.has(id)) {
      found.set(id, gymCache.get(id));
    } else {
      missing.push(id);
    }
  }

  if (missing.length) {
    const { data, error } = await supabase
      .from(GYM_TABLE)
      .select(GYM_SELECT_FIELDS)
      .in("id", missing);

    if (error) {
      throw normalizeGymError(error);
    }

    for (const row of data ?? []) {
      const gym = mapGym(row);

      if (gym) {
        gymCache.set(gym.id, gym);
        found.set(gym.id, gym);
      }
    }
  }

  return found;
}

export async function getGymById(gymId) {
  const gyms = await getGymsByIds([gymId]);

  return gyms.get(toNumber(gymId)) ?? null;
}

/* ------------------------------------------------------------- position -- */

/**
 * One position fix, or null. Null for every way it can fail - no permission,
 * services off, no fix in time - because a workout must finish whether or not
 * the phone knows where it is.
 */
export async function getCurrentPosition({ requestPermission = true } = {}) {
  try {
    let permission = await Location.getForegroundPermissionsAsync();

    if (!permission.granted) {
      if (!requestPermission || permission.canAskAgain === false) {
        return null;
      }

      permission = await Location.requestForegroundPermissionsAsync();

      if (!permission.granted) {
        return null;
      }
    }

    if (!(await Location.hasServicesEnabledAsync())) {
      return null;
    }

    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise((resolve) => setTimeout(() => resolve(null), POSITION_TIMEOUT_MS)),
    ]);
    const latitude = toNumber(position?.coords?.latitude);
    const longitude = toNumber(position?.coords?.longitude);

    if (latitude === null || longitude === null) {
      return null;
    }

    return {
      latitude,
      longitude,
      accuracy: toNumber(position?.coords?.accuracy),
    };
  } catch (error) {
    console.warn("Could not read the current position:", error);
    return null;
  }
}

/* ------------------------------------------------------------- matching -- */

/**
 * Matches a workout to the centre it is in and stores the result on the row.
 * Already matched -> answers from the row. No position -> the row is left
 * alone, so a later attempt (the finish, after the start) can still match.
 * A position but no centre in range -> the coordinates are stored and gym_id
 * stays null; that is a real answer, not a failure.
 */
export async function matchWorkoutToGym(
  db,
  workoutId,
  { requestPermission = true, force = false } = {}
) {
  const workout = await workoutRepository.getWorkoutGymMatch(db, workoutId);

  if (!workout) {
    return { gymId: null, gym: null, matched: false, reason: "missing_workout" };
  }

  const existingGymId = toNumber(workout.gym_id);

  if (existingGymId !== null && !force) {
    const gym = await getGymById(existingGymId).catch(() => null);

    return { gymId: existingGymId, gym, matched: true, reason: "already_matched" };
  }

  const position = await getCurrentPosition({ requestPermission });

  if (!position) {
    return { gymId: existingGymId, gym: null, matched: false, reason: "no_position" };
  }

  let gym = null;

  try {
    const { data, error } = await supabase.rpc("match_gym", {
      lat: position.latitude,
      lng: position.longitude,
    });

    if (error) {
      throw error;
    }

    gym = mapGym(Array.isArray(data) ? data[0] : data);
  } catch (error) {
    console.warn("Centre match failed:", normalizeGymError(error));
  }

  if (gym) {
    gymCache.set(gym.id, gym);
  }

  await workoutRepository.setWorkoutGymMatch(db, {
    workoutId,
    gymId: gym?.id ?? null,
    startLatitude: position.latitude,
    startLongitude: position.longitude,
  });

  return {
    gymId: gym?.id ?? null,
    gym,
    matched: Boolean(gym),
    reason: gym ? "matched" : "no_gym_in_range",
    position,
  };
}

/** Fire and forget, for the start of a workout. */
export function matchWorkoutToGymInBackground(db, workoutId, options) {
  void matchWorkoutToGym(db, workoutId, options).catch((error) => {
    console.warn("Centre match failed:", error);
  });
}

/* ---------------------------------------------------------------- lifts -- */

/**
 * Pushes the best set per exercise of a finished strength workout to the
 * centre leaderboard. Runs, walks and workouts without a centre are skipped.
 * The database trigger decides what a heavier lift does to an attached video.
 */
export async function syncWorkoutLifts(db, workoutId) {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return { skipped: "signed_out", uploaded: 0 };
  }

  const workout = await workoutRepository.getWorkoutGymMatch(db, workoutId);
  const gymId = toNumber(workout?.gym_id);

  if (!workout || gymId === null) {
    return { skipped: "no_gym", uploaded: 0 };
  }

  if (Number(workout.done) !== 1) {
    return { skipped: "not_done", uploaded: 0 };
  }

  if (LOCATION_WORKOUT_TYPES.has(workout.workout_type)) {
    return { skipped: "location_workout", uploaded: 0 };
  }

  const sets = await weightliftingRepository.getCompletedSetsForGymLifts(db, workoutId);
  const bestLifts = selectBestLiftsPerExercise(sets);

  if (!bestLifts.length) {
    return { skipped: "no_sets", uploaded: 0 };
  }

  const { data: existing, error: existingError } = await supabase
    .from(GYM_LIFT_TABLE)
    .select("exercise_id, weight_kg")
    .eq("user_id", userId)
    .eq("gym_id", gymId);

  if (existingError) {
    throw normalizeGymError(existingError);
  }

  const toUpsert = selectLiftsToUpsert(bestLifts, existing ?? []);

  if (!toUpsert.length) {
    return { skipped: "nothing_heavier", uploaded: 0, gymId };
  }

  const performedAt = new Date().toISOString();
  const rows = toUpsert.map((lift) => ({
    user_id: userId,
    gym_id: gymId,
    exercise_id: lift.exerciseId,
    exercise_name: lift.exerciseName,
    weight_kg: lift.weightKg,
    reps: lift.reps,
    set_sync_id: UUID_PATTERN.test(String(lift.setSyncId ?? "")) ? lift.setSyncId : null,
    performed_at: performedAt,
  }));

  const { error: upsertError } = await supabase
    .from(GYM_LIFT_TABLE)
    .upsert(rows, { onConflict: "user_id,gym_id,exercise_id" });

  if (upsertError) {
    throw normalizeGymError(upsertError);
  }

  return { uploaded: rows.length, gymId };
}

/**
 * What a finished workout does for centres: a match if it has none yet, then
 * the lifts. Never throws - the workout is finished either way.
 */
export async function finishWorkoutGymSyncBestEffort(db, workoutId) {
  try {
    await matchWorkoutToGym(db, workoutId, { requestPermission: true });
  } catch (error) {
    console.warn("Centre match after finishing failed:", error);
  }

  try {
    return await syncWorkoutLifts(db, workoutId);
  } catch (error) {
    console.warn("Centre lift sync failed:", error);
    return { skipped: "error", uploaded: 0 };
  }
}

export async function getMyLifts({ userId, gymId = null }) {
  if (!userId) {
    return [];
  }

  let query = supabase
    .from(GYM_LIFT_TABLE)
    .select(
      "id, gym_id, exercise_id, exercise_name, weight_kg, reps, performed_at, video_path, video_status, approvals, rejections, previous_weight_kg"
    )
    .eq("user_id", userId);

  if (gymId !== null) {
    query = query.eq("gym_id", gymId);
  }

  const { data, error } = await query.order("performed_at", { ascending: false });

  if (error) {
    throw normalizeGymError(error);
  }

  return (data ?? []).map((row) => mapLiftRow({ ...row, lift_id: row.id, is_me: true }));
}

/* ---------------------------------------------------------- leaderboards -- */

export async function getGymOverview({ gymId, scope = GYM_SCOPE_GYM, moreLimit = 8 }) {
  const { data, error } = await supabase.rpc("gym_leaderboard_overview", {
    target_gym_id: gymId,
    scope,
    more_limit: moreLimit,
  });

  if (error) {
    throw normalizeGymError(error);
  }

  if (!data?.gym) {
    return null;
  }

  const featured = (data.featured ?? []).map((entry) => ({
    exerciseId: toNumber(entry.exercise_id),
    exerciseName: entry.exercise_name ?? null,
    lifterCount: toNumber(entry.lifter_count) ?? 0,
    top: mapLiftRow(entry.top),
    me: mapLiftRow(entry.me),
  }));

  await attachLiftAvatars(featured.flatMap((entry) => [entry.top, entry.me]));

  return {
    gym: mapGym(data.gym),
    scope: data.scope ?? scope,
    featured,
    more: (data.more ?? []).map((entry) => ({
      exerciseId: toNumber(entry.exercise_id),
      exerciseName: entry.exercise_name ?? null,
      lifterCount: toNumber(entry.lifter_count) ?? 0,
      topName: entry.top_name ?? null,
      topWeightKg: toNumber(entry.top_weight_kg),
      myRank: toNumber(entry.my_rank),
    })),
    moreTotal: toNumber(data.more_total) ?? 0,
  };
}

/**
 * One page of one exercise's ranking. `gymId` null means the whole country,
 * verified lifts only. Pass `nextCursor` from the previous page to continue.
 */
export async function getExerciseLeaderboard({
  gymId = null,
  exerciseId,
  scope = GYM_SCOPE_GYM,
  unit = LIFT_UNIT_KG,
  limit = 50,
  cursor = null,
}) {
  const params = {
    target_exercise_id: exerciseId,
    unit,
    page_limit: limit,
    cursor_sort_key: cursor?.sortKey ?? null,
    cursor_performed_at: cursor?.performedAt ?? null,
    cursor_id: cursor?.liftId ?? null,
  };
  let functionName = "national_exercise_leaderboard";

  if (gymId !== null && gymId !== undefined) {
    functionName = "gym_exercise_leaderboard";
    params.target_gym_id = gymId;
    params.scope = scope;
  }

  const { data, error } = await supabase.rpc(functionName, params);

  if (error) {
    throw normalizeGymError(error);
  }

  const rows = (data?.rows ?? []).map(mapLiftRow);
  const me = mapLiftRow(data?.me);

  await attachLiftAvatars([...rows, me]);

  return {
    gym: mapGym(data?.gym),
    exercise: data?.exercise
      ? { id: toNumber(data.exercise.id), name: data.exercise.name ?? null }
      : null,
    scope: data?.scope ?? scope,
    unit: data?.unit ?? unit,
    total: toNumber(data?.total) ?? 0,
    rows,
    me,
    nextCursor: data?.next_cursor
      ? {
          sortKey: toNumber(data.next_cursor.sort_key),
          performedAt: data.next_cursor.performed_at ?? null,
          liftId: toNumber(data.next_cursor.lift_id),
        }
      : null,
  };
}

export async function getNationalStrongest() {
  const { data, error } = await supabase.rpc("national_strongest");

  if (error) {
    throw normalizeGymError(error);
  }

  const entries = (data ?? []).map((entry) => ({
    exerciseId: toNumber(entry.exercise_id),
    exerciseName: entry.exercise_name ?? null,
    top: mapLiftRow(entry.top),
  }));

  await attachLiftAvatars(entries.map((entry) => entry.top));

  return entries;
}

/* ---------------------------------------------------------------- gyms -- */

export async function getNearbyGyms({ latitude, longitude, limit = 20 }) {
  const { data, error } = await supabase.rpc("gyms_nearby", {
    lat: latitude,
    lng: longitude,
    result_limit: limit,
  });

  if (error) {
    throw normalizeGymError(error);
  }

  return (data ?? []).map(mapGym).filter(Boolean);
}

/** Every public centre inside a map viewport, capped so a zoomed-out map stays sane. */
export async function getGymsInBounds({
  minLatitude,
  maxLatitude,
  minLongitude,
  maxLongitude,
  limit = 300,
}) {
  const { data, error } = await supabase
    .from(GYM_TABLE)
    .select(GYM_SELECT_FIELDS)
    .gte("latitude", minLatitude)
    .lte("latitude", maxLatitude)
    .gte("longitude", minLongitude)
    .lte("longitude", maxLongitude)
    .limit(limit);

  if (error) {
    throw normalizeGymError(error);
  }

  return (data ?? []).map(mapGym).filter(Boolean);
}

export async function getGymCount() {
  const { count, error } = await supabase
    .from(GYM_TABLE)
    .select("id", { count: "exact", head: true });

  if (error) {
    throw normalizeGymError(error);
  }

  return count ?? 0;
}

/** Name, short name, chain or city. Commas and parentheses would break the filter, so they go. */
export async function searchGyms({ query, limit = 40 }) {
  const cleaned = String(query ?? "")
    .replace(/[(),.*%]/g, " ")
    .trim();

  if (cleaned.length < 2) {
    return [];
  }

  const pattern = `%${cleaned}%`;
  const { data, error } = await supabase
    .from(GYM_TABLE)
    .select(GYM_SELECT_FIELDS)
    .or(
      `name.ilike.${pattern},short_name.ilike.${pattern},chain.ilike.${pattern},city.ilike.${pattern}`
    )
    .order("short_name", { ascending: true })
    .limit(limit);

  if (error) {
    throw normalizeGymError(error);
  }

  return (data ?? []).map(mapGym).filter(Boolean);
}

/* ------------------------------------------------------ the user's centre -- */

/** The chosen centre, or the one trained in most over 90 days, or null. */
export async function getMyHomeGym() {
  const { data, error } = await supabase.rpc("my_home_gym");

  if (error) {
    throw normalizeGymError(error);
  }

  return mapGym(data);
}

/** Centres the user has trained in, most often first, for the Change centre sheet. */
export async function getMyGyms() {
  const { data, error } = await supabase.rpc("my_gyms");

  if (error) {
    throw normalizeGymError(error);
  }

  return (data ?? []).map(mapGym).filter(Boolean);
}

/** `gymId` null goes back to automatic. */
export async function setHomeGym({ userId, gymId }) {
  if (!userId) {
    throw new Error("You need to be signed in to choose a centre.");
  }

  const { error } = await supabase.from(PROFILE_PRIVATE_TABLE).upsert(
    {
      user_id: userId,
      home_gym_id: gymId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw normalizeGymError(error);
  }
}

/* --------------------------------------------------------- verification -- */

async function signVideoUrls(lifts) {
  const paths = [...new Set(lifts.map((lift) => lift?.videoPath).filter(Boolean))];

  if (!paths.length) {
    return lifts;
  }

  const { data, error } = await supabase.storage
    .from(LIFT_VIDEO_BUCKET)
    .createSignedUrls(paths, SIGNED_VIDEO_TTL_SECONDS);

  if (error) {
    console.warn("Could not sign lift video URLs:", error);
    return lifts;
  }

  const urlByPath = new Map(
    (data ?? [])
      .filter((entry) => entry?.signedUrl && !entry.error)
      .map((entry) => [entry.path, entry.signedUrl])
  );

  for (const lift of lifts) {
    if (lift?.videoPath) {
      lift.videoUrl = urlByPath.get(lift.videoPath) ?? null;
    }
  }

  return lifts;
}

export async function getLiftVideoUrl(videoPath) {
  if (!videoPath) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(LIFT_VIDEO_BUCKET)
    .createSignedUrl(videoPath, SIGNED_VIDEO_TTL_SECONDS);

  if (error) {
    throw normalizeGymError(error);
  }

  return data?.signedUrl ?? null;
}

/** Lifts in a centre waiting for the viewer's verdict, with playable URLs. */
export async function getVerificationQueue({ gymId }) {
  const { data, error } = await supabase.rpc("gym_lift_verification_queue", {
    target_gym_id: gymId,
  });

  if (error) {
    throw normalizeGymError(error);
  }

  const lifts = (data ?? []).map(mapLiftRow).filter(Boolean);

  await Promise.all([attachLiftAvatars(lifts), signVideoUrls(lifts)]);

  return lifts;
}

/**
 * One vote. A reason is only kept on a rejection. Voting twice on the same
 * lift is the row already being there, which the trigger's recount already
 * covered, so 23505 is not an error here.
 */
export async function voteOnLift({ userId, liftId, approve, reason = null }) {
  if (!userId) {
    throw new Error("You need to be signed in to vote.");
  }

  const { error } = await supabase.from(GYM_LIFT_VOTE_TABLE).insert({
    lift_id: liftId,
    voter_id: userId,
    approve: Boolean(approve),
    reason: approve ? null : reason ?? "other",
  });

  if (error && error.code !== "23505") {
    throw normalizeGymError(error);
  }
}

/**
 * Attaches a video to one of the viewer's own lifts: upload to the private
 * bucket under their own folder, point the row at it (the trigger sets the
 * status to pending and clears old votes), then ask the centre to look. The
 * request for verification is best effort - the video is attached either way.
 */
export async function attachLiftVideo({ userId, liftId, asset }) {
  if (!userId) {
    throw new Error("You need to be signed in to attach a video.");
  }

  if (!asset?.uri) {
    throw new Error("Pick a video first.");
  }

  const durationSeconds = toNumber(asset.duration);

  // expo-image-picker reports duration in milliseconds on both platforms.
  if (durationSeconds !== null && durationSeconds / 1000 > LIFT_VIDEO_MAX_DURATION_SECONDS + 1) {
    throw new Error(`Keep the video under ${LIFT_VIDEO_MAX_DURATION_SECONDS} seconds.`);
  }

  if (asset.fileSize && asset.fileSize > LIFT_VIDEO_MAX_BYTES) {
    throw new Error("The video must stay under 50 MB.");
  }

  const response = await fetch(asset.uri);

  if (!response.ok) {
    throw new Error("Could not read the selected video.");
  }

  const buffer = await response.arrayBuffer();

  if (!buffer.byteLength) {
    throw new Error("The selected video was empty.");
  }

  if (buffer.byteLength > LIFT_VIDEO_MAX_BYTES) {
    throw new Error("The video must stay under 50 MB.");
  }

  const isQuickTime = /\.mov$/i.test(asset.fileName ?? asset.uri ?? "");
  const contentType = asset.mimeType ?? (isQuickTime ? "video/quicktime" : "video/mp4");
  const extension = contentType === "video/quicktime" ? "mov" : "mp4";
  const videoPath = `${userId}/${liftId}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(LIFT_VIDEO_BUCKET)
    .upload(videoPath, buffer, { contentType, upsert: true });

  if (uploadError) {
    throw normalizeGymError(uploadError);
  }

  const { error: updateError } = await supabase
    .from(GYM_LIFT_TABLE)
    .update({ video_path: videoPath, updated_at: new Date().toISOString() })
    .eq("id", liftId)
    .eq("user_id", userId);

  if (updateError) {
    throw normalizeGymError(updateError);
  }

  let notified = 0;

  try {
    const { data, error } = await supabase.rpc("request_lift_verification", {
      target_lift_id: liftId,
    });

    if (error) {
      throw error;
    }

    notified = toNumber(data) ?? 0;
  } catch (error) {
    console.warn("Could not ask the centre to verify the lift:", error);
  }

  return { videoPath, notified };
}

export async function removeLiftVideo({ userId, liftId, videoPath }) {
  if (!userId) {
    throw new Error("You need to be signed in.");
  }

  const { error } = await supabase
    .from(GYM_LIFT_TABLE)
    .update({ video_path: null, updated_at: new Date().toISOString() })
    .eq("id", liftId)
    .eq("user_id", userId);

  if (error) {
    throw normalizeGymError(error);
  }

  if (videoPath) {
    const { error: removeError } = await supabase.storage
      .from(LIFT_VIDEO_BUCKET)
      .remove([videoPath]);

    if (removeError) {
      console.warn("Could not delete the lift video:", removeError);
    }
  }
}

/* -------------------------------------------------------- activity tiles -- */

/**
 * The centre line for the viewer's own Friends activity tile: the centre of
 * the workout the summary points at, if it has one, marked as home when it
 * is the viewer's own centre.
 */
export async function getGymForActivityTile(gymId, homeGymId = null) {
  const id = toNumber(gymId);

  if (id === null) {
    return null;
  }

  const gym = await getGymById(id).catch(() => null);

  if (!gym) {
    return null;
  }

  return {
    id: gym.id,
    shortName: gym.shortName,
    isHomeGym: homeGymId !== null && toNumber(homeGymId) === gym.id,
  };
}
