import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "../Database/supaBaseClient";
import { normalizeElapsedDurationSeconds } from "../Utils/timeUtils";
import { ensureOwnProfile } from "./socialService";

const SOCIAL_POST_TABLE = "social_post";
const SOCIAL_POST_LIKE_TABLE = "social_post_like";
const SOCIAL_POST_HIDDEN_EXERCISE_TABLE = "social_post_hidden_exercise";
const AVATAR_BUCKET = "avatars";
const WORKOUT_SUMMARY_POST_TYPE = "workout_summary";
const SOCIAL_POST_SETUP_MESSAGE =
  "Workout summary posts are not set up in Supabase yet. Run docs/supabase-social-posts.sql and the follow-up social post SQL files in the Supabase SQL editor first.";
const WORKOUT_SUMMARY_POST_MODE_STORAGE_PREFIX =
  "fitven:workout-summary-post-mode";
const WORKOUT_SUMMARY_POST_VISIBILITY_STORAGE_PREFIX =
  "fitven:workout-summary-post-visibility";
export const WORKOUT_SUMMARY_POST_MODES = Object.freeze({
  FULL_INFO: "full_info",
  SUMMARY_ONLY: "summary_only",
  OFF: "off",
});
export const DEFAULT_WORKOUT_SUMMARY_POST_MODE =
  WORKOUT_SUMMARY_POST_MODES.FULL_INFO;
export const WORKOUT_SUMMARY_POST_VISIBILITIES = Object.freeze({
  EVERYONE: "everyone",
  FOLLOWING: "following",
  PRIVATE: "private",
});
export const DEFAULT_WORKOUT_SUMMARY_POST_VISIBILITY =
  WORKOUT_SUMMARY_POST_VISIBILITIES.FOLLOWING;
const SOCIAL_POST_SELECT_FIELDS = `
  id,
  author_id,
  post_type,
  source_workout_type_instance_id,
  visibility,
  workout_type,
  title,
  body,
  payload,
  completed_at,
  created_at,
  updated_at,
  deleted_at,
  author:profiles!social_post_author_fkey(
    id,
    username,
    display_name,
    avatar_path,
    updated_at
  )
`;
const SUPPORTED_AUTO_POST_WORKOUT_TYPES = new Set(["Resistance"]);

function normalizeWorkoutSummaryPostMode(mode) {
  return Object.values(WORKOUT_SUMMARY_POST_MODES).includes(mode)
    ? mode
    : DEFAULT_WORKOUT_SUMMARY_POST_MODE;
}

function normalizeWorkoutSummaryPostVisibility(visibility) {
  return Object.values(WORKOUT_SUMMARY_POST_VISIBILITIES).includes(visibility)
    ? visibility
    : DEFAULT_WORKOUT_SUMMARY_POST_VISIBILITY;
}

function getWorkoutSummaryPostModeStorageKey(userId) {
  return `${WORKOUT_SUMMARY_POST_MODE_STORAGE_PREFIX}:${userId}`;
}

function getWorkoutSummaryPostVisibilityStorageKey(userId) {
  return `${WORKOUT_SUMMARY_POST_VISIBILITY_STORAGE_PREFIX}:${userId}`;
}

export async function getWorkoutSummaryPostMode({ user } = {}) {
  if (!user?.id) {
    return DEFAULT_WORKOUT_SUMMARY_POST_MODE;
  }

  const storedMode = await AsyncStorage.getItem(
    getWorkoutSummaryPostModeStorageKey(user.id)
  );

  return normalizeWorkoutSummaryPostMode(storedMode);
}

export async function setWorkoutSummaryPostMode({ user, mode }) {
  if (!user?.id) {
    throw new Error("You need to be signed in to update social post settings.");
  }

  const nextMode = normalizeWorkoutSummaryPostMode(mode);
  await AsyncStorage.setItem(
    getWorkoutSummaryPostModeStorageKey(user.id),
    nextMode
  );

  return nextMode;
}

export async function getWorkoutSummaryPostVisibility({ user } = {}) {
  if (!user?.id) {
    return DEFAULT_WORKOUT_SUMMARY_POST_VISIBILITY;
  }

  const storedVisibility = await AsyncStorage.getItem(
    getWorkoutSummaryPostVisibilityStorageKey(user.id)
  );

  return normalizeWorkoutSummaryPostVisibility(storedVisibility);
}

export async function setWorkoutSummaryPostVisibility({ user, visibility }) {
  if (!user?.id) {
    throw new Error("You need to be signed in to update social post settings.");
  }

  const nextVisibility = normalizeWorkoutSummaryPostVisibility(visibility);
  await ensureOwnProfile(user);

  const { error } = await supabase
    .from(SOCIAL_POST_TABLE)
    .update({
      visibility: nextVisibility,
      updated_at: new Date().toISOString(),
    })
    .eq("author_id", user.id)
    .eq("post_type", WORKOUT_SUMMARY_POST_TYPE)
    .is("deleted_at", null);

  if (error) {
    throw normalizeSocialPostError(error);
  }

  await AsyncStorage.setItem(
    getWorkoutSummaryPostVisibilityStorageKey(user.id),
    nextVisibility
  );

  return nextVisibility;
}

function normalizePositiveInteger(value) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) && numericValue > 0
    ? Math.trunc(numericValue)
    : null;
}

function buildExerciseVisibilitySignature(hiddenExerciseIds = []) {
  const normalizedIds = [...new Set(
    (hiddenExerciseIds ?? [])
      .map(normalizePositiveInteger)
      .filter((exerciseId) => exerciseId !== null)
  )].sort((left, right) => left - right);
  let hash = 0;

  for (const exerciseId of normalizedIds) {
    const idText = String(exerciseId);

    for (let index = 0; index < idText.length; index += 1) {
      hash = (hash * 31 + idText.charCodeAt(index)) >>> 0;
    }

    hash = (hash * 31 + 44) >>> 0;
  }

  return `${normalizedIds.length}:${hash.toString(36)}`;
}

export async function getHiddenWorkoutSummaryExerciseIds({ user } = {}) {
  if (!user?.id) {
    return [];
  }

  const { data, error } = await supabase
    .from(SOCIAL_POST_HIDDEN_EXERCISE_TABLE)
    .select("exercise_id")
    .eq("user_id", user.id);

  if (error) {
    throw normalizeSocialPostError(error);
  }

  return (data ?? [])
    .map((row) => normalizePositiveInteger(row?.exercise_id))
    .filter((exerciseId) => exerciseId !== null);
}

export async function setWorkoutSummaryExerciseHidden({
  user,
  exerciseId,
  hidden,
}) {
  if (!user?.id) {
    throw new Error("You need to be signed in to update exercise settings.");
  }

  const normalizedExerciseId = normalizePositiveInteger(exerciseId);

  if (normalizedExerciseId === null) {
    throw new Error("This exercise has not synced to Supabase yet.");
  }

  await ensureOwnProfile(user);

  if (hidden) {
    const { error } = await supabase
      .from(SOCIAL_POST_HIDDEN_EXERCISE_TABLE)
      .upsert(
        {
          user_id: user.id,
          exercise_id: normalizedExerciseId,
        },
        {
          onConflict: "user_id,exercise_id",
        }
      );

    if (error) {
      throw normalizeSocialPostError(error);
    }

    return { hidden: true };
  }

  const { error } = await supabase
    .from(SOCIAL_POST_HIDDEN_EXERCISE_TABLE)
    .delete()
    .eq("user_id", user.id)
    .eq("exercise_id", normalizedExerciseId);

  if (error) {
    throw normalizeSocialPostError(error);
  }

  return { hidden: false };
}

function isMissingSocialPostSchemaError(error) {
  const message = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();

  return (
    error?.code === "42P01" ||
    error?.code === "42703" ||
    message.includes("social_post") ||
    message.includes("social_post_like")
  );
}

function normalizeSocialPostError(error) {
  if (isMissingSocialPostSchemaError(error)) {
    return new Error(SOCIAL_POST_SETUP_MESSAGE);
  }

  return error;
}

function normalizeNumber(value, fallback = 0) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function normalizeInteger(value, fallback = 0) {
  const numericValue = normalizeNumber(value, fallback);

  return Number.isFinite(numericValue) ? Math.trunc(numericValue) : fallback;
}

function formatDisplayNumber(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Number.isInteger(numericValue)
    ? `${numericValue}`
    : numericValue.toFixed(1);
}

function formatWeightDisplay(value, unit = "kg") {
  const displayValue = formatDisplayNumber(value);

  return displayValue ? `${displayValue} ${unit}` : null;
}

function buildAvatarPublicUrl(avatarPath, updatedAt) {
  if (!avatarPath) {
    return null;
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(avatarPath);
  const publicUrl = data?.publicUrl;

  return publicUrl && updatedAt
    ? `${publicUrl}?t=${encodeURIComponent(updatedAt)}`
    : publicUrl ?? null;
}

function mapPostAuthor(row) {
  const author = Array.isArray(row?.author) ? row.author[0] : row?.author;

  if (!author) {
    return {
      id: row?.author_id ?? null,
      displayName: "FitVen athlete",
      username: null,
      avatarUrl: null,
    };
  }

  return {
    id: author.id,
    username: author.username ?? null,
    displayName: author.display_name ?? author.username ?? "FitVen athlete",
    avatarUrl: buildAvatarPublicUrl(author.avatar_path, author.updated_at),
  };
}

function mapSocialPostRow(row, likesByPostId = new Map(), likedPostIds = new Set()) {
  const payload =
    row?.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? row.payload
      : {};
  const likeRows = likesByPostId.get(row.id) ?? [];

  return {
    id: row.id,
    author: mapPostAuthor(row),
    postType: row.post_type,
    sourceWorkoutTypeInstanceId: row.source_workout_type_instance_id,
    visibility: normalizeWorkoutSummaryPostVisibility(row.visibility),
    workoutType: row.workout_type,
    title: row.title,
    body: row.body ?? "",
    payload,
    completedAt: row.completed_at ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    likeCount: likeRows.length,
    isLiked: likedPostIds.has(row.id),
  };
}

function normalizePostNote(note) {
  return String(note ?? "").trim();
}

async function getAuthenticatedUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    const message = String(error?.message ?? "").toLowerCase();

    if (message.includes("auth session missing")) {
      return null;
    }

    throw error;
  }

  return data.user ?? null;
}

async function getWorkoutPostSource(db, workoutId) {
  return db.getFirstAsync(
    `SELECT
        w.workout_id,
        w.cloud_workout_type_instance_id,
        w.workout_type,
        w.label,
        w.elapsed_time,
        w.done,
        w.date,
        COALESCE(
          NULLIF(w.label, w.workout_type),
          NULLIF(wt.display_name, ''),
          w.label,
          w.workout_type
        ) AS workout_label
     FROM Workout_Type_Instance w
     LEFT JOIN Workout_Type wt ON wt.name = w.workout_type
     WHERE w.workout_id = ?
       AND COALESCE(w.deleted_at, '') = '';`,
    [workoutId]
  );
}

async function getWorkoutExerciseCount(db, workoutId) {
  const row = await db.getFirstAsync(
    `SELECT COUNT(*) AS exercise_count
     FROM Exercise_Instance e
     WHERE e.workout_type_instance_id = ?
       AND COALESCE(e.deleted_at, '') = '';`,
    [workoutId]
  );

  return normalizeInteger(row?.exercise_count, 0);
}

async function getWorkoutDoneSetCount(db, workoutId) {
  const row = await db.getFirstAsync(
    `SELECT COUNT(*) AS done_set_count
     FROM "Set" s
     JOIN Exercise_Instance e ON e.exercise_instance_id = s.exercise_instance_id
     WHERE e.workout_type_instance_id = ?
       AND s.done = 1
       AND COALESCE(s.deleted_at, '') = ''
       AND COALESCE(e.deleted_at, '') = '';`,
    [workoutId]
  );

  return normalizeInteger(row?.done_set_count, 0);
}

function filterVisibleExerciseRecords(records, hiddenExerciseIdSet) {
  if (!hiddenExerciseIdSet?.size) {
    return records;
  }

  return records.filter((record) => {
    const exerciseId = normalizePositiveInteger(record?.exerciseId);

    return exerciseId === null || !hiddenExerciseIdSet.has(exerciseId);
  });
}

// Heaviest completed set per exercise from every workout performed on an
// earlier date. The post card measures the day's top set against this, so a
// first-ever session has no baseline and counts as a record by definition.
async function getExercisePersonalBestsBeforeWorkout(db, workoutId) {
  const rows = await db.getAllAsync(
    `WITH target AS (
       SELECT
         w.workout_id,
         CASE
           WHEN d.date LIKE '__.__.____'
           THEN substr(d.date, 7, 4) || '-' || substr(d.date, 4, 2) || '-' || substr(d.date, 1, 2)
           ELSE d.date
         END AS performed_date_sort
       FROM Workout_Type_Instance w
       JOIN Day d ON d.day_id = w.day_id
       WHERE w.workout_id = ?
     )
     SELECT
       e.exercise_name,
       MAX(CAST(s.weight AS REAL)) AS best_weight
     FROM "Set" s
     JOIN Exercise_Instance e ON e.exercise_instance_id = s.exercise_instance_id
     JOIN Workout_Type_Instance w ON w.workout_id = e.workout_type_instance_id
     JOIN Day d ON d.day_id = w.day_id
     CROSS JOIN target t
     WHERE s.done = 1
       AND COALESCE(s.failed, 0) = 0
       AND s.weight IS NOT NULL
       AND CAST(s.weight AS REAL) > 0
       AND COALESCE(s.deleted_at, '') = ''
       AND COALESCE(e.deleted_at, '') = ''
       AND COALESCE(w.deleted_at, '') = ''
       AND COALESCE(d.deleted_at, '') = ''
       AND w.workout_id <> t.workout_id
       AND (
         CASE
           WHEN d.date LIKE '__.__.____'
           THEN substr(d.date, 7, 4) || '-' || substr(d.date, 4, 2) || '-' || substr(d.date, 1, 2)
           ELSE d.date
         END
       ) < t.performed_date_sort
       AND e.exercise_name COLLATE NOCASE IN (
         SELECT exercise_name
         FROM Exercise_Instance
         WHERE workout_type_instance_id = t.workout_id
           AND COALESCE(deleted_at, '') = ''
       )
     GROUP BY e.exercise_name COLLATE NOCASE;`,
    [workoutId]
  );

  const bestByExerciseName = new Map();

  for (const row of rows ?? []) {
    const name = typeof row?.exercise_name === "string" ? row.exercise_name : "";
    const best = normalizeNumber(row?.best_weight, 0);

    if (!name || best <= 0) {
      continue;
    }

    bestByExerciseName.set(name.trim().toLowerCase(), best);
  }

  return bestByExerciseName;
}

async function getWorkoutTopSets(
  db,
  workoutId,
  { limit = null, hiddenExerciseIdSet = new Set() } = {}
) {
  const normalizedLimit =
    limit === null || limit === undefined
      ? null
      : Math.max(1, normalizeInteger(limit, 1));
  const limitClause = normalizedLimit === null ? "" : "LIMIT ?";
  const params = normalizedLimit === null
    ? [workoutId]
    : [workoutId, normalizedLimit];
  const rows = await db.getAllAsync(
    `WITH completed_sets AS (
       SELECT
         s.sets_id,
         s.weight,
         s.reps,
         s.personal_record,
         e.exercise_instance_id,
         e.exercise_name,
         e.exercise_order,
         catalog.cloud_exercise_id,
         ROW_NUMBER() OVER (
           PARTITION BY e.exercise_instance_id
           ORDER BY
             CAST(s.weight AS REAL) * CAST(s.reps AS INTEGER) DESC,
             CAST(s.weight AS REAL) DESC,
             CAST(s.reps AS INTEGER) DESC,
             s.set_number ASC,
             s.sets_id ASC
         ) AS set_rank
       FROM "Set" s
       JOIN Exercise_Instance e ON e.exercise_instance_id = s.exercise_instance_id
       LEFT JOIN Exercise catalog
         ON catalog.name = e.exercise_name COLLATE NOCASE
       WHERE e.workout_type_instance_id = ?
         AND s.done = 1
         AND COALESCE(s.failed, 0) = 0
         AND s.weight IS NOT NULL
         AND s.reps IS NOT NULL
         AND CAST(s.weight AS REAL) > 0
         AND CAST(s.reps AS INTEGER) > 0
         AND COALESCE(s.deleted_at, '') = ''
         AND COALESCE(e.deleted_at, '') = ''
     )
     SELECT
       sets_id,
       cloud_exercise_id,
       exercise_name,
       weight,
       reps,
       personal_record
     FROM completed_sets
     WHERE set_rank = 1
     ORDER BY exercise_order ASC, exercise_instance_id ASC
     ${limitClause};`,
    params
  );

  const topSets = (rows ?? []).map((row) => {
    const weight = normalizeNumber(row.weight, 0);
    const reps = normalizeInteger(row.reps, 0);

    return {
      setId: row.sets_id,
      exerciseId: normalizePositiveInteger(row.cloud_exercise_id),
      exerciseName: row.exercise_name,
      weight,
      reps,
      unit: "kg",
      weightDisplay: formatWeightDisplay(weight),
      personalRecord: Number(row.personal_record) === 1,
    };
  });

  return filterVisibleExerciseRecords(topSets, hiddenExerciseIdSet);
}

async function getWorkoutPersonalRecords(
  db,
  workoutId,
  { limit = 2, hiddenExerciseIdSet = new Set() } = {}
) {
  const rows = await db.getAllAsync(
    `SELECT
       s.sets_id,
       s.weight,
       s.reps,
       catalog.cloud_exercise_id,
       e.exercise_name,
       e.exercise_order
     FROM "Set" s
     JOIN Exercise_Instance e ON e.exercise_instance_id = s.exercise_instance_id
     LEFT JOIN Exercise catalog
       ON catalog.name = e.exercise_name COLLATE NOCASE
     WHERE e.workout_type_instance_id = ?
       AND s.done = 1
       AND COALESCE(s.failed, 0) = 0
       AND COALESCE(s.personal_record, 0) = 1
       AND s.weight IS NOT NULL
       AND s.reps IS NOT NULL
       AND CAST(s.weight AS REAL) > 0
       AND CAST(s.reps AS INTEGER) > 0
       AND COALESCE(s.deleted_at, '') = ''
       AND COALESCE(e.deleted_at, '') = ''
     ORDER BY e.exercise_order ASC, e.exercise_instance_id ASC, s.set_number ASC
     ${hiddenExerciseIdSet?.size ? "" : "LIMIT ?"};`,
    hiddenExerciseIdSet?.size ? [workoutId] : [workoutId, limit]
  );

  const personalRecords = (rows ?? []).map((row) => {
    const weight = normalizeNumber(row.weight, 0);
    const reps = normalizeInteger(row.reps, 0);
    const weightDisplay = formatWeightDisplay(weight);

    return {
      setId: row.sets_id,
      exerciseId: normalizePositiveInteger(row.cloud_exercise_id),
      exerciseName: row.exercise_name,
      recordType: "weight",
      value: weight,
      reps,
      unit: "kg",
      displayValue:
        weightDisplay && reps > 0 ? `${weightDisplay} x ${reps}` : weightDisplay,
    };
  });

  return filterVisibleExerciseRecords(
    personalRecords,
    hiddenExerciseIdSet
  ).slice(0, limit);
}

async function buildWorkoutSummaryPayload(
  db,
  workoutSource,
  { hiddenExerciseIds = [] } = {}
) {
  const workoutId = workoutSource.workout_id;
  const hiddenExerciseIdSet = new Set(
    hiddenExerciseIds
      .map(normalizePositiveInteger)
      .filter((exerciseId) => exerciseId !== null)
  );
  const [
    exerciseCount,
    setsCount,
    topSets,
    personalRecords,
    personalBestsBefore,
  ] = await Promise.all([
    getWorkoutExerciseCount(db, workoutId),
    getWorkoutDoneSetCount(db, workoutId),
    getWorkoutTopSets(db, workoutId, { hiddenExerciseIdSet }),
    getWorkoutPersonalRecords(db, workoutId, { hiddenExerciseIdSet }),
    getExercisePersonalBestsBeforeWorkout(db, workoutId),
  ]);
  const topSetsWithBaseline = topSets.map((topSet) => {
    const key = String(topSet.exerciseName ?? "").trim().toLowerCase();
    const previousBest = personalBestsBefore.get(key) ?? null;

    return {
      ...topSet,
      previousBest,
      personalRecord:
        topSet.personalRecord ||
        previousBest === null ||
        topSet.weight >= previousBest,
    };
  });

  return {
    durationSeconds: normalizeElapsedDurationSeconds(
      workoutSource.elapsed_time,
      0
    ),
    setsCount,
    exerciseCount,
    topSets: topSetsWithBaseline,
    personalRecords,
    exerciseVisibilitySignature:
      buildExerciseVisibilitySignature(hiddenExerciseIds),
  };
}

function applyWorkoutSummaryPostMode(payload, mode) {
  const postMode = normalizeWorkoutSummaryPostMode(mode);

  if (postMode === WORKOUT_SUMMARY_POST_MODES.SUMMARY_ONLY) {
    return {
      ...payload,
      topSets: [],
      personalRecords: [],
      postMode,
    };
  }

  return {
    ...payload,
    postMode: WORKOUT_SUMMARY_POST_MODES.FULL_INFO,
  };
}

async function getExistingWorkoutSummaryPost({
  userId,
  cloudWorkoutTypeInstanceId,
}) {
  const { data, error } = await supabase
    .from(SOCIAL_POST_TABLE)
    .select(SOCIAL_POST_SELECT_FIELDS)
    .eq("author_id", userId)
    .eq("post_type", WORKOUT_SUMMARY_POST_TYPE)
    .eq("source_workout_type_instance_id", cloudWorkoutTypeInstanceId)
    .maybeSingle();

  if (error) {
    throw normalizeSocialPostError(error);
  }

  return data ?? null;
}

function getPayloadTopSetCount(payload) {
  return Array.isArray(payload?.topSets) ? payload.topSets.length : 0;
}

// Payloads written before the progression bar shipped have top sets without a
// previousBest, so the card has nothing to draw against.
function payloadNeedsBaseline(payload) {
  const topSets = Array.isArray(payload?.topSets) ? payload.topSets : [];

  return (
    topSets.length > 0 &&
    topSets.some(
      (topSet) =>
        topSet !== null &&
        typeof topSet === "object" &&
        !("previousBest" in topSet)
    )
  );
}

function shouldKeepExistingWorkoutSummaryPost(
  existingPost,
  nextPayload,
  { visibility = DEFAULT_WORKOUT_SUMMARY_POST_VISIBILITY } = {}
) {
  if (!existingPost || existingPost.deleted_at) {
    return false;
  }

  const existingPayload =
    existingPost.payload &&
    typeof existingPost.payload === "object" &&
    !Array.isArray(existingPost.payload)
      ? existingPost.payload
      : {};
  const existingExerciseCount = normalizeInteger(
    existingPayload.exerciseCount,
    0
  );
  const nextExerciseCount = normalizeInteger(nextPayload?.exerciseCount, 0);

  if (
    normalizeWorkoutSummaryPostVisibility(existingPost.visibility) !==
    normalizeWorkoutSummaryPostVisibility(visibility)
  ) {
    return false;
  }

  if (
    normalizeWorkoutSummaryPostMode(existingPayload.postMode) !==
    normalizeWorkoutSummaryPostMode(nextPayload?.postMode)
  ) {
    return false;
  }

  if (payloadNeedsBaseline(existingPayload) && !payloadNeedsBaseline(nextPayload)) {
    return false;
  }

  if (
    String(existingPayload.exerciseVisibilitySignature ?? "0:0") !==
    String(nextPayload?.exerciseVisibilitySignature ?? "0:0")
  ) {
    return false;
  }

  if (
    existingExerciseCount > 0 &&
    nextExerciseCount > 0 &&
    existingExerciseCount > nextExerciseCount
  ) {
    return true;
  }

  return (
    getPayloadTopSetCount(existingPayload) >
    getPayloadTopSetCount(nextPayload)
  );
}

/**
 * Fills in the progression baseline from the local database for any post whose
 * stored payload predates it. Cheaper and more reliable than waiting for the
 * cloud backfill: the history lives on this device, so a post can be drawn
 * correctly even when its row cannot be rewritten.
 */
export async function attachLocalTopSetBaselines(db, posts) {
  if (!db || !Array.isArray(posts) || posts.length === 0) {
    return posts;
  }

  const postsNeedingBaseline = posts.filter(
    (post) =>
      payloadNeedsBaseline(post?.payload) &&
      normalizeInteger(post?.sourceWorkoutTypeInstanceId, 0) > 0
  );

  if (postsNeedingBaseline.length === 0) {
    return posts;
  }

  const cloudIds = [
    ...new Set(
      postsNeedingBaseline.map((post) =>
        normalizeInteger(post.sourceWorkoutTypeInstanceId, 0)
      )
    ),
  ];
  const placeholders = cloudIds.map(() => "?").join(", ");
  const localWorkouts = await db.getAllAsync(
    `SELECT workout_id, cloud_workout_type_instance_id
     FROM Workout_Type_Instance
     WHERE cloud_workout_type_instance_id IN (${placeholders})
       AND COALESCE(deleted_at, '') = '';`,
    cloudIds
  );
  const workoutIdByCloudId = new Map(
    (localWorkouts ?? []).map((row) => [
      normalizeInteger(row.cloud_workout_type_instance_id, 0),
      row.workout_id,
    ])
  );

  if (workoutIdByCloudId.size === 0) {
    return posts;
  }

  const baselinesByCloudId = new Map();

  for (const [cloudId, workoutId] of workoutIdByCloudId.entries()) {
    try {
      baselinesByCloudId.set(
        cloudId,
        await getExercisePersonalBestsBeforeWorkout(db, workoutId)
      );
    } catch (error) {
      console.warn("Local baseline lookup failed:", error);
    }
  }

  return posts.map((post) => {
    const cloudId = normalizeInteger(post?.sourceWorkoutTypeInstanceId, 0);
    const baselines = baselinesByCloudId.get(cloudId);

    if (!baselines || !payloadNeedsBaseline(post?.payload)) {
      return post;
    }

    return {
      ...post,
      payload: {
        ...post.payload,
        topSets: post.payload.topSets.map((topSet) => {
          const key = String(topSet?.exerciseName ?? "").trim().toLowerCase();

          return {
            ...topSet,
            previousBest: baselines.get(key) ?? null,
          };
        }),
      },
    };
  });
}

/**
 * The summaries the user has already published, keyed by the cloud workout id
 * they came from, so a local workout can tell whether it is posted and reach
 * its post for editing.
 */
export async function getOwnPostedWorkoutSummaries({ user }) {
  if (!user?.id) {
    return new Map();
  }

  const { data, error } = await supabase
    .from(SOCIAL_POST_TABLE)
    .select("id, source_workout_type_instance_id, body, visibility")
    .eq("author_id", user.id)
    .eq("post_type", WORKOUT_SUMMARY_POST_TYPE)
    .is("deleted_at", null);

  if (error) {
    throw normalizeSocialPostError(error);
  }

  const postsByCloudWorkoutId = new Map();

  for (const row of data ?? []) {
    const cloudId = normalizeInteger(row?.source_workout_type_instance_id, 0);

    if (cloudId <= 0) {
      continue;
    }

    postsByCloudWorkoutId.set(cloudId, {
      postId: row.id,
      body: row.body ?? "",
      visibility: normalizeWorkoutSummaryPostVisibility(row.visibility),
    });
  }

  return postsByCloudWorkoutId;
}

/**
 * A post object built entirely from the local database, so a workout can be
 * shown as a card before it has ever been published.
 */
export async function buildLocalWorkoutSummaryPost(
  db,
  { workout, author, publishedPost = null, hiddenExerciseIds = [] }
) {
  // Same hidden-exercise filter the publish path uses, so the preview matches
  // what would actually go out.
  const payload = await buildWorkoutSummaryPayload(
    db,
    {
      workout_id: workout.workout_id,
      workout_type: workout.workout_type,
      elapsed_time: workout.elapsed_time,
    },
    { hiddenExerciseIds }
  );

  return {
    // Keyed by the workout, so the row is stable whether or not it is posted.
    id: `local-workout-${workout.workout_id}`,
    workoutId: workout.workout_id,
    postId: publishedPost?.postId ?? null,
    author,
    postType: WORKOUT_SUMMARY_POST_TYPE,
    sourceWorkoutTypeInstanceId: normalizeInteger(
      workout.cloud_workout_type_instance_id,
      0
    ),
    workoutType: workout.workout_type,
    title: workout.workout_label ?? workout.workout_type,
    body: publishedPost?.body ?? "",
    payload,
    performedDate: workout.date ?? null,
    visibility: publishedPost?.visibility ?? null,
    // This view shows the workout, not its engagement.
    likeCount: 0,
    isLiked: false,
    isPosted: Boolean(publishedPost),
  };
}

let hasBackfilledBaselinesThisSession = false;

/**
 * Rewrites the payload of the signed-in user's own posts that predate the
 * progression bar, so their cards stop rendering without one. Runs at most
 * once per app session and only touches posts whose workout still exists
 * locally - other people's posts can only be fixed on their own device.
 */
export async function backfillWorkoutSummaryPostBaselines(
  db,
  { limit = 25, force = false } = {}
) {
  if (hasBackfilledBaselinesThisSession && !force) {
    return { updated: 0, skipped: true };
  }

  hasBackfilledBaselinesThisSession = true;

  const user = await getAuthenticatedUser();

  if (!user?.id) {
    return { updated: 0, skipped: true };
  }

  const { data, error } = await supabase
    .from(SOCIAL_POST_TABLE)
    .select("id, source_workout_type_instance_id, payload")
    .eq("author_id", user.id)
    .eq("post_type", WORKOUT_SUMMARY_POST_TYPE)
    .is("deleted_at", null)
    .order("completed_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw normalizeSocialPostError(error);
  }

  const stalePosts = (data ?? []).filter((row) =>
    payloadNeedsBaseline(row?.payload)
  );

  if (stalePosts.length === 0) {
    return { updated: 0, skipped: false };
  }

  const hiddenExerciseIds = await getHiddenWorkoutSummaryExerciseIds({ user });
  const selectedPostMode = await getWorkoutSummaryPostMode({ user });
  let updated = 0;

  for (const row of stalePosts) {
    try {
      const localWorkout = await db.getFirstAsync(
        `SELECT workout_id
         FROM Workout_Type_Instance
         WHERE cloud_workout_type_instance_id = ?
           AND COALESCE(deleted_at, '') = ''
         LIMIT 1;`,
        [row.source_workout_type_instance_id]
      );

      if (!localWorkout?.workout_id) {
        continue;
      }

      const workoutSource = await getWorkoutPostSource(
        db,
        localWorkout.workout_id
      );

      if (!workoutSource) {
        continue;
      }

      const payload = applyWorkoutSummaryPostMode(
        await buildWorkoutSummaryPayload(db, workoutSource, {
          hiddenExerciseIds,
        }),
        selectedPostMode
      );

      // updated_at is left alone on purpose - this is a data repair, not an
      // edit, and bumping it would reshuffle the feed.
      const { error: updateError } = await supabase
        .from(SOCIAL_POST_TABLE)
        .update({ payload })
        .eq("id", row.id);

      if (updateError) {
        console.warn("Post baseline backfill failed:", updateError);
        continue;
      }

      updated += 1;
    } catch (backfillError) {
      console.warn("Post baseline backfill failed:", backfillError);
    }
  }

  return { updated, skipped: false };
}

export async function createWorkoutSummaryPostForCompletedWorkout(
  db,
  { workoutId, source = "automatic", note = null }
) {
  const user = await getAuthenticatedUser();

  if (!user?.id) {
    return { skipped: true, reason: "signed_out" };
  }

  const workoutSource = await getWorkoutPostSource(db, workoutId);

  if (!workoutSource || Number(workoutSource.done) !== 1) {
    return { skipped: true, reason: "not_completed" };
  }

  if (!SUPPORTED_AUTO_POST_WORKOUT_TYPES.has(workoutSource.workout_type)) {
    return { skipped: true, reason: "unsupported_workout_type" };
  }

  const cloudWorkoutTypeInstanceId = normalizeInteger(
    workoutSource.cloud_workout_type_instance_id,
    0
  );

  if (!cloudWorkoutTypeInstanceId) {
    return { skipped: true, reason: "missing_cloud_workout_id" };
  }

  const selectedPostMode = await getWorkoutSummaryPostMode({ user });
  const selectedPostVisibility = await getWorkoutSummaryPostVisibility({
    user,
  });

  if (
    source !== "manual" &&
    selectedPostMode === WORKOUT_SUMMARY_POST_MODES.OFF
  ) {
    return { skipped: true, reason: "automatic_posts_disabled" };
  }

  await ensureOwnProfile(user);
  const hiddenExerciseIds = await getHiddenWorkoutSummaryExerciseIds({ user });
  const payload = applyWorkoutSummaryPostMode(
    await buildWorkoutSummaryPayload(db, workoutSource, {
      hiddenExerciseIds,
    }),
    selectedPostMode
  );

  const existingPost = await getExistingWorkoutSummaryPost({
    userId: user.id,
    cloudWorkoutTypeInstanceId,
  });

  if (
    shouldKeepExistingWorkoutSummaryPost(existingPost, payload, {
      visibility: selectedPostVisibility,
    })
  ) {
    return mapSocialPostRow(existingPost);
  }

  const now = new Date().toISOString();
  // A note passed in wins; otherwise an existing post keeps the one it has.
  const existingBody =
    existingPost && !existingPost.deleted_at ? existingPost.body ?? "" : "";
  const body = note === null ? existingBody : normalizePostNote(note);
  const { data, error } = await supabase
    .from(SOCIAL_POST_TABLE)
    .upsert(
      {
        author_id: user.id,
        post_type: WORKOUT_SUMMARY_POST_TYPE,
        source_workout_type_instance_id: cloudWorkoutTypeInstanceId,
        visibility: selectedPostVisibility,
        workout_type: workoutSource.workout_type,
        title: workoutSource.workout_label ?? workoutSource.workout_type,
        body,
        payload,
        completed_at: now,
        updated_at: now,
        deleted_at: null,
      },
      {
        onConflict: "author_id,post_type,source_workout_type_instance_id",
      }
    )
    .select(SOCIAL_POST_SELECT_FIELDS)
    .single();

  if (error) {
    throw normalizeSocialPostError(error);
  }

  return mapSocialPostRow(data);
}

export async function deleteWorkoutSummaryPostForWorkout(db, { workoutId }) {
  const user = await getAuthenticatedUser();

  if (!user?.id) {
    return { skipped: true, reason: "signed_out" };
  }

  const workoutSource = await getWorkoutPostSource(db, workoutId);
  const cloudWorkoutTypeInstanceId = normalizeInteger(
    workoutSource?.cloud_workout_type_instance_id,
    0
  );

  if (!cloudWorkoutTypeInstanceId) {
    return { skipped: true, reason: "missing_cloud_workout_id" };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from(SOCIAL_POST_TABLE)
    .update({
      deleted_at: now,
      updated_at: now,
    })
    .eq("author_id", user.id)
    .eq("post_type", WORKOUT_SUMMARY_POST_TYPE)
    .eq("source_workout_type_instance_id", cloudWorkoutTypeInstanceId);

  if (error) {
    throw normalizeSocialPostError(error);
  }

  return { skipped: false };
}

export async function getWorkoutSummaryFeed({ user, limit = 10, offset = 0 }) {
  if (!user?.id) {
    return [];
  }

  await ensureOwnProfile(user);
  const normalizedLimit = Math.max(1, normalizeInteger(limit, 10));
  const normalizedOffset = Math.max(0, normalizeInteger(offset, 0));

  const { data: posts, error: postsError } = await supabase
    .from(SOCIAL_POST_TABLE)
    .select(SOCIAL_POST_SELECT_FIELDS)
    .eq("post_type", WORKOUT_SUMMARY_POST_TYPE)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(normalizedOffset, normalizedOffset + normalizedLimit - 1);

  if (postsError) {
    throw normalizeSocialPostError(postsError);
  }

  const postIds = (posts ?? []).map((post) => post.id).filter(Boolean);

  if (!postIds.length) {
    return [];
  }

  const { data: likes, error: likesError } = await supabase
    .from(SOCIAL_POST_LIKE_TABLE)
    .select("post_id, user_id")
    .in("post_id", postIds);

  if (likesError) {
    throw normalizeSocialPostError(likesError);
  }

  const likesByPostId = new Map();
  const likedPostIds = new Set();

  (likes ?? []).forEach((like) => {
    if (!likesByPostId.has(like.post_id)) {
      likesByPostId.set(like.post_id, []);
    }

    likesByPostId.get(like.post_id).push(like);

    if (like.user_id === user.id) {
      likedPostIds.add(like.post_id);
    }
  });

  return posts.map((post) => mapSocialPostRow(post, likesByPostId, likedPostIds));
}

export async function getWorkoutSummaryPostById({ user, postId }) {
  if (!user?.id || !postId) {
    throw new Error("You need to be signed in to edit workout posts.");
  }

  await ensureOwnProfile(user);

  const { data, error } = await supabase
    .from(SOCIAL_POST_TABLE)
    .select(SOCIAL_POST_SELECT_FIELDS)
    .eq("id", postId)
    .eq("author_id", user.id)
    .eq("post_type", WORKOUT_SUMMARY_POST_TYPE)
    .is("deleted_at", null)
    .single();

  if (error) {
    throw normalizeSocialPostError(error);
  }

  return mapSocialPostRow(data);
}

export async function updateWorkoutSummaryPostNote({ user, postId, note }) {
  if (!user?.id || !postId) {
    throw new Error("You need to be signed in to edit workout posts.");
  }

  await ensureOwnProfile(user);

  const { data, error } = await supabase
    .from(SOCIAL_POST_TABLE)
    .update({
      body: normalizePostNote(note),
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId)
    .eq("author_id", user.id)
    .eq("post_type", WORKOUT_SUMMARY_POST_TYPE)
    .is("deleted_at", null)
    .select(SOCIAL_POST_SELECT_FIELDS)
    .single();

  if (error) {
    throw normalizeSocialPostError(error);
  }

  return mapSocialPostRow(data);
}

export async function deleteWorkoutSummaryPost({ user, postId }) {
  if (!user?.id || !postId) {
    throw new Error("You need to be signed in to delete workout posts.");
  }

  await ensureOwnProfile(user);

  const { error } = await supabase
    .from(SOCIAL_POST_TABLE)
    .delete()
    .eq("id", postId)
    .eq("author_id", user.id)
    .eq("post_type", WORKOUT_SUMMARY_POST_TYPE);

  if (error) {
    throw normalizeSocialPostError(error);
  }

  return { deleted: true };
}

export async function toggleWorkoutSummaryPostLike({ user, postId, shouldLike }) {
  if (!user?.id || !postId) {
    throw new Error("You need to be signed in to like workout posts.");
  }

  await ensureOwnProfile(user);

  if (shouldLike) {
    const { error } = await supabase.from(SOCIAL_POST_LIKE_TABLE).upsert(
      {
        post_id: postId,
        user_id: user.id,
      },
      {
        onConflict: "post_id,user_id",
      }
    );

    if (error) {
      throw normalizeSocialPostError(error);
    }

    return;
  }

  const { error } = await supabase
    .from(SOCIAL_POST_LIKE_TABLE)
    .delete()
    .eq("post_id", postId)
    .eq("user_id", user.id);

  if (error) {
    throw normalizeSocialPostError(error);
  }
}
