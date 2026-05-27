import { supabase } from "../Database/supaBaseClient";
import { normalizeElapsedDurationSeconds } from "../Utils/timeUtils";
import { ensureOwnProfile } from "./socialService";

const SOCIAL_POST_TABLE = "social_post";
const SOCIAL_POST_LIKE_TABLE = "social_post_like";
const AVATAR_BUCKET = "avatars";
const WORKOUT_SUMMARY_POST_TYPE = "workout_summary";
const WORKOUT_SUMMARY_CANDIDATE_LIMIT = 8;
const SOCIAL_POST_SETUP_MESSAGE =
  "Workout summary posts are not set up in Supabase yet. Run docs/supabase-social-posts.sql in the Supabase SQL editor first.";
const SOCIAL_POST_SELECT_FIELDS = `
  id,
  author_id,
  post_type,
  source_workout_type_instance_id,
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

async function getWorkoutTopSets(db, workoutId, limit = null) {
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

  return (rows ?? []).map((row) => {
    const weight = normalizeNumber(row.weight, 0);
    const reps = normalizeInteger(row.reps, 0);

    return {
      setId: row.sets_id,
      exerciseName: row.exercise_name,
      weight,
      reps,
      unit: "kg",
      weightDisplay: formatWeightDisplay(weight),
      personalRecord: Number(row.personal_record) === 1,
    };
  });
}

async function getWorkoutPersonalRecords(db, workoutId, limit = 2) {
  const rows = await db.getAllAsync(
    `SELECT
       s.sets_id,
       s.weight,
       s.reps,
       e.exercise_name,
       e.exercise_order
     FROM "Set" s
     JOIN Exercise_Instance e ON e.exercise_instance_id = s.exercise_instance_id
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
     LIMIT ?;`,
    [workoutId, limit]
  );

  return (rows ?? []).map((row) => {
    const weight = normalizeNumber(row.weight, 0);
    const reps = normalizeInteger(row.reps, 0);
    const weightDisplay = formatWeightDisplay(weight);

    return {
      setId: row.sets_id,
      exerciseName: row.exercise_name,
      recordType: "weight",
      value: weight,
      reps,
      unit: "kg",
      displayValue:
        weightDisplay && reps > 0 ? `${weightDisplay} x ${reps}` : weightDisplay,
    };
  });
}

async function buildWorkoutSummaryPayload(db, workoutSource) {
  const workoutId = workoutSource.workout_id;
  const [exerciseCount, setsCount, topSets, personalRecords] =
    await Promise.all([
      getWorkoutExerciseCount(db, workoutId),
      getWorkoutDoneSetCount(db, workoutId),
      getWorkoutTopSets(db, workoutId),
      getWorkoutPersonalRecords(db, workoutId),
    ]);

  return {
    durationSeconds: normalizeElapsedDurationSeconds(
      workoutSource.elapsed_time,
      0
    ),
    setsCount,
    exerciseCount,
    topSets,
    personalRecords,
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

function shouldKeepExistingWorkoutSummaryPost(existingPost, nextPayload) {
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
    existingExerciseCount > 0 &&
    nextExerciseCount > 0 &&
    existingExerciseCount !== nextExerciseCount
  ) {
    return true;
  }

  return (
    getPayloadTopSetCount(existingPayload) >=
    getPayloadTopSetCount(nextPayload)
  );
}

export async function getCompletedWorkoutSummaryPostCandidateIds(
  db,
  { limit = WORKOUT_SUMMARY_CANDIDATE_LIMIT } = {}
) {
  const normalizedLimit = Math.max(1, normalizeInteger(limit, 1));
  const rows = await db.getAllAsync(
    `SELECT w.workout_id
     FROM Workout_Type_Instance w
     WHERE w.done = 1
       AND w.workout_type = 'Resistance'
       AND COALESCE(w.deleted_at, '') = ''
     ORDER BY
       COALESCE(w.sync_version, 0) DESC,
       COALESCE(w.original_start_time, 0) DESC,
       w.workout_id DESC
     LIMIT ?;`,
    [normalizedLimit]
  );

  return (rows ?? [])
    .map((row) => normalizeInteger(row?.workout_id, 0))
    .filter((workoutId) => workoutId > 0);
}

export async function createWorkoutSummaryPostForCompletedWorkout(
  db,
  { workoutId }
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

  await ensureOwnProfile(user);
  const payload = await buildWorkoutSummaryPayload(db, workoutSource);

  const existingPost = await getExistingWorkoutSummaryPost({
    userId: user.id,
    cloudWorkoutTypeInstanceId,
  });

  if (shouldKeepExistingWorkoutSummaryPost(existingPost, payload)) {
    return mapSocialPostRow(existingPost);
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from(SOCIAL_POST_TABLE)
    .upsert(
      {
        author_id: user.id,
        post_type: WORKOUT_SUMMARY_POST_TYPE,
        source_workout_type_instance_id: cloudWorkoutTypeInstanceId,
        workout_type: workoutSource.workout_type,
        title: workoutSource.workout_label ?? workoutSource.workout_type,
        body: "",
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
