import { ensureOwnProfile } from "./socialService";
import {
  buildLocalWorkoutSummaryPost,
  getHiddenWorkoutSummaryExerciseIds,
  getOwnPostedWorkoutSummaries,
} from "./socialPostService";

const SUPPORTED_WORKOUT_TYPES = ["Resistance"];

/**
 * Every completed workout the user owns, rendered as a post whether or not it
 * was ever published. The payload is built from the local database, so the
 * cards look the same as in the feed and work offline; only the posted flag
 * needs the cloud.
 */
export async function getOwnWorkoutPosts(db, { user, limit = 20 } = {}) {
  if (!user?.id) {
    return [];
  }

  const placeholders = SUPPORTED_WORKOUT_TYPES.map(() => "?").join(", ");
  const workouts = await db.getAllAsync(
    `SELECT
        w.workout_id,
        w.cloud_workout_type_instance_id,
        w.workout_type,
        w.elapsed_time,
        w.done,
        d.date,
        COALESCE(
          NULLIF(w.label, w.workout_type),
          NULLIF(wt.display_name, ''),
          w.label,
          w.workout_type
        ) AS workout_label,
        CASE
          WHEN d.date LIKE '__.__.____'
          THEN substr(d.date, 7, 4) || '-' || substr(d.date, 4, 2) || '-' || substr(d.date, 1, 2)
          ELSE d.date
        END AS performed_date_sort
     FROM Workout_Type_Instance w
     JOIN Day d ON d.day_id = w.day_id
     LEFT JOIN Workout_Type wt ON wt.name = w.workout_type
     WHERE w.done = 1
       AND w.workout_type IN (${placeholders})
       AND COALESCE(w.deleted_at, '') = ''
       AND COALESCE(d.deleted_at, '') = ''
     ORDER BY performed_date_sort DESC, w.workout_id DESC
     LIMIT ?;`,
    [...SUPPORTED_WORKOUT_TYPES, Math.max(1, Number(limit) || 20)]
  );

  if (!workouts?.length) {
    return [];
  }

  let profile = null;
  let publishedByCloudId = new Map();
  let hiddenExerciseIds = [];

  // The list still renders without a connection; it just cannot say which
  // workouts are already published.
  try {
    [profile, publishedByCloudId, hiddenExerciseIds] = await Promise.all([
      ensureOwnProfile(user),
      getOwnPostedWorkoutSummaries({ user }),
      getHiddenWorkoutSummaryExerciseIds({ user }),
    ]);
  } catch (error) {
    console.warn("Could not read own post state:", error);
  }

  const author = {
    id: user.id,
    displayName: profile?.displayName ?? "You",
    username: profile?.username ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
  };

  const posts = [];

  for (const workout of workouts) {
    try {
      posts.push(
        await buildLocalWorkoutSummaryPost(db, {
          workout,
          author,
          hiddenExerciseIds,
          publishedPost:
            publishedByCloudId.get(
              Number(workout.cloud_workout_type_instance_id)
            ) ?? null,
        })
      );
    } catch (error) {
      console.warn("Could not build a local workout post:", error);
    }
  }

  return posts;
}

