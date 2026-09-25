// The pure half of somebody else's profile: how the answer from
// `public_profile` becomes the shape the page reads, the rule that colours the
// centre line, and the numbers behind the activity bars. No network and no
// React, so scripts/test-public-profile.js can run all of it.
import { buildFullUsername, formatUsernameCode } from "./socialUsername";

export const ACTIVITY_WEEKS = 12;
// The latest posts the profile shows as a grid; "See all" has the rest.
export const PROFILE_POST_GRID_SIZE = 9;
// PROFILE_BIO_MAX_LENGTH in Services/socialService.js, which this file cannot
// import without pulling in the Supabase client. The test holds them together.
export const PUBLIC_BIO_MAX_LENGTH = 160;

function toCount(value) {
  const numeric = Number(value);

  return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : 0;
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

function toText(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Twelve weekly counts, oldest first and this week last, whatever came back:
 * a short list is padded at the old end, a long one keeps its newest weeks.
 */
export function normalizeWeeklyWorkouts(values) {
  const counts = Array.isArray(values) ? values.map(toCount) : [];
  const newest = counts.slice(-ACTIVITY_WEEKS);

  return [...new Array(ACTIVITY_WEEKS - newest.length).fill(0), ...newest];
}

/**
 * One record: the heaviest lift in one of the big three. Null for a row that
 * has nothing to show, and for a rejected lift, which is never a record.
 *
 * Gold and a place need a verified video - the leaderboard's own rule - so a
 * lift without one keeps its weight and loses its rank, whatever rank came
 * with it, and the page says "Not ranked".
 */
export function mapPublicRecord(row) {
  const weightKg = toNumberOrNull(row?.weight_kg);
  const videoStatus = toText(row?.video_status) || "none";

  if (!row || weightKg === null || weightKg <= 0 || videoStatus === "rejected") {
    return null;
  }

  const isVerified = videoStatus === "verified";
  const rank = isVerified ? toNumberOrNull(row.rank) : null;
  const gymId = toNumberOrNull(row.gym?.id);

  return {
    exerciseId: toNumberOrNull(row.exercise_id),
    exerciseName: toText(row.exercise_name),
    liftId: toNumberOrNull(row.lift_id),
    weightKg,
    reps: toNumberOrNull(row.reps),
    videoStatus,
    approvals: toCount(row.approvals),
    isVerified,
    rank: rank !== null && rank > 0 ? Math.trunc(rank) : null,
    gym:
      gymId === null
        ? null
        : {
            id: gymId,
            shortName: toText(row.gym?.short_name) || null,
            city: toText(row.gym?.city) || null,
          },
    performedAt: row.performed_at ?? null,
  };
}

/** The `public_profile` answer as the page reads it, or null for no profile. */
export function mapPublicProfile(data) {
  if (!data || typeof data !== "object" || !data.id) {
    return null;
  }

  const usernameBase = toText(data.username_base);
  const rawCode = toText(data.username_code);
  const usernameCode = rawCode ? formatUsernameCode(rawCode) : "";
  const homeGymId = toNumberOrNull(data.home_gym?.id);

  return {
    id: String(data.id),
    displayName: toText(data.display_name) || usernameBase,
    usernameBase,
    usernameCode,
    // base#code - what finds them in search, so what the share text carries.
    username:
      usernameBase && usernameCode
        ? buildFullUsername(usernameBase, usernameCode)
        : usernameBase,
    bio: toText(data.bio).slice(0, PUBLIC_BIO_MAX_LENGTH),
    avatarPath: data.avatar_path ?? null,
    avatarUpdatedAt: null,
    avatarUrl: null,
    homeGym:
      homeGymId === null
        ? null
        : { id: homeGymId, shortName: toText(data.home_gym?.short_name) || null },
    followerCount: toCount(data.follower_count),
    followingCount: toCount(data.following_count),
    workoutCount: toCount(data.workout_count),
    weeklyWorkouts: normalizeWeeklyWorkouts(data.weekly_workouts),
    isFollowing: data.is_following === true,
    records: (Array.isArray(data.records) ? data.records : [])
      .map(mapPublicRecord)
      .filter(Boolean),
  };
}

/**
 * Whether the centre line is the viewer's own centre: orange, with "· your
 * centre". Both have to be known and the same. Never in a preview: it depends
 * on who is looking, and in a preview nobody is looking but you.
 */
export function isSharedCentre({ profileGymId, viewerGymId, preview = false }) {
  if (preview) {
    return false;
  }

  const profileId = toNumberOrNull(profileGymId);
  const viewerId = toNumberOrNull(viewerGymId);

  return profileId !== null && viewerId !== null && profileId === viewerId;
}

/** Finished workouts per week over the twelve, to one decimal. */
export function averageWorkoutsPerWeek(weeklyWorkouts) {
  const weeks = normalizeWeeklyWorkouts(weeklyWorkouts);
  const total = weeks.reduce((sum, count) => sum + count, 0);

  return Math.round((total / ACTIVITY_WEEKS) * 10) / 10;
}

/**
 * One bar per week, oldest first: how full it is against the busiest of the
 * twelve (0 to 1), and whether it is this week - the one drawn in the accent.
 */
export function buildActivityBars(weeklyWorkouts) {
  const weeks = normalizeWeeklyWorkouts(weeklyWorkouts);
  const busiest = Math.max(0, ...weeks);

  return weeks.map((count, index) => ({
    count,
    level: busiest > 0 ? count / busiest : 0,
    isLatest: index === weeks.length - 1,
  }));
}

/**
 * The profile's author on each of their posts. A post reads its author through
 * a join on `profiles`, which answers nobody about a stranger, so a stranger's
 * card said "FitVen athlete" with no picture. The profile page already has the
 * person from `public_profile`, and they are the author of every one of these.
 */
export function withProfileAuthor(posts, profile) {
  if (!Array.isArray(posts)) {
    return [];
  }

  if (!profile?.id) {
    return posts;
  }

  return posts.map((post) => ({
    ...post,
    author: {
      ...(post?.author ?? {}),
      id: profile.id,
      username: profile.username || post?.author?.username || null,
      displayName: profile.displayName || post?.author?.displayName,
      avatarPath: profile.avatarPath ?? post?.author?.avatarPath ?? null,
      avatarUrl: profile.avatarUrl ?? post?.author?.avatarUrl ?? null,
    },
  }));
}

/** The tapped post first, the rest in the order they came - as CenterPostsPage does. */
export function putPostFirst(posts, postId) {
  if (!Array.isArray(posts) || postId === null || postId === undefined) {
    return Array.isArray(posts) ? posts : [];
  }

  const first = posts.find((post) => String(post?.id) === String(postId));

  return first ? [first, ...posts.filter((post) => post !== first)] : posts;
}
