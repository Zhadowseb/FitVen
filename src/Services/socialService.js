import { supabase } from "../Database/supaBaseClient";
import {
  normalizeIsoDateString,
  normalizeLocalDateString,
} from "../Utils/dateUtils";
import {
  buildFullUsername,
  formatUsernameCode,
  normalizeUsernameBaseInput,
  slugifyUsernameBase,
  splitFullUsername,
  USERNAME_CODE_LENGTH,
  USERNAME_BASE_PATTERN,
} from "../Utils/socialUsername";
import {
  normalizeElapsedDurationSeconds,
  normalizeStoredTimestampSeconds,
} from "../Utils/timeUtils";

const PROFILES_TABLE = "profiles";
const USER_FOLLOWS_TABLE = "user_follows";
const WORKOUT_TYPE_INSTANCE_TABLE = "workout_type_instance";
const AVATAR_BUCKET = "avatars";
const PROFILE_SELECT_FIELDS =
  "id, username, username_base, username_code, display_name, bio, avatar_path, created_at, updated_at";
const WORKOUT_ACTIVITY_SELECT_FIELDS =
  "id, user_id, workout_type, date, label, done, is_active, timer_start, elapsed_time, deleted_at, workout_catalog:workout_type!workout_type_instance_workout_type_fkey(display_name)";
const SOCIAL_SETUP_MESSAGE =
  "User search and follows are not set up in Supabase yet. Run docs/supabase-social-search.sql in the Supabase SQL editor first.";
const WORKOUT_TYPE_SETUP_MESSAGE =
  "Workout types are not set up in Supabase yet. Run docs/supabase-workout-types.sql in the Supabase SQL editor first.";
const SOCIAL_AVATAR_SETUP_MESSAGE =
  "Profile photos are not set up in Supabase yet. Make sure the avatars bucket exists and rerun the updated docs/supabase-social-search.sql script first.";
export const PROFILE_DISPLAY_NAME_MAX_LENGTH = 40;
export const PROFILE_BIO_MAX_LENGTH = 160;
export const PROFILE_AVATAR_MAX_BYTES = 3 * 1024 * 1024;
const USERNAME_INSERT_RETRY_LIMIT = 3;

function buildAvatarPublicUrl(avatarPath, updatedAt) {
  if (!avatarPath) {
    return null;
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(avatarPath);
  const publicUrl = data?.publicUrl;

  if (!publicUrl) {
    return null;
  }

  return updatedAt ? `${publicUrl}?t=${encodeURIComponent(updatedAt)}` : publicUrl;
}

function getAvatarObjectPath(userId) {
  return `${userId}/avatar`;
}

function createFallbackUsernameBase(user) {
  return slugifyUsernameBase(
    user?.user_metadata?.username_base ??
      user?.user_metadata?.username ??
      user?.user_metadata?.display_name ??
      user?.email?.split("@")[0] ??
      "user"
  );
}

function createFallbackDisplayName(user, usernameBase) {
  const metadataDisplayName = user?.user_metadata?.display_name?.trim();
  if (metadataDisplayName) {
    return metadataDisplayName;
  }

  const emailName = user?.email?.split("@")[0]?.trim();
  if (emailName) {
    return emailName;
  }

  return usernameBase;
}

function mapProfileRow(row, followingIdSet = new Set()) {
  const parsedUsername = splitFullUsername(row.username);
  const usernameBase =
    row.username_base ?? parsedUsername?.usernameBase ?? "";
  const usernameCode =
    row.username_code ?? parsedUsername?.usernameCode ?? "";
  const updatedAt = row.updated_at ?? row.created_at ?? null;

  return {
    id: row.id,
    username:
      row.username ?? buildFullUsername(usernameBase, usernameCode),
    usernameBase,
    usernameCode,
    displayName: row.display_name,
    bio: row.bio ?? "",
    avatarPath: row.avatar_path ?? null,
    avatarUrl: buildAvatarPublicUrl(row.avatar_path, updatedAt),
    createdAt: row.created_at ?? null,
    updatedAt,
    isFollowing: followingIdSet.has(row.id),
  };
}

function isCloudWorkoutLive(workout) {
  const timerStartSeconds = getCloudWorkoutTimerStartSeconds(workout);

  return (
    Number(workout?.done) !== 1 &&
    (Number(workout?.is_active) === 1 || timerStartSeconds !== null)
  );
}

function formatCloudWorkoutElapsedDetail(workout) {
  const storedElapsedSeconds = normalizeElapsedDurationSeconds(
    workout?.elapsed_time,
    0
  );
  const timerStartSeconds = getCloudWorkoutTimerStartSeconds(workout);
  const runningElapsedSeconds =
    timerStartSeconds !== null
      ? Math.max(0, Math.trunc(Date.now() / 1000) - timerStartSeconds)
      : 0;
  const totalElapsedSeconds = storedElapsedSeconds + runningElapsedSeconds;
  const totalElapsedMinutes = Math.max(1, Math.floor(totalElapsedSeconds / 60));

  return `${totalElapsedMinutes} min in`;
}

function normalizeCloudTimeString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  const match = trimmedValue.match(/^(\d{2}):(\d{2})(?::(\d{2}))?/);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? "00");

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")}`;
}

function getCloudWorkoutTimerStartSeconds(workout) {
  const storedTimerStartSeconds = normalizeStoredTimestampSeconds(
    workout?.timer_start
  );

  if (storedTimerStartSeconds !== null) {
    return storedTimerStartSeconds;
  }

  const normalizedDate = normalizeLocalDateString(workout?.date);
  const normalizedTime = normalizeCloudTimeString(workout?.timer_start);

  if (!normalizedDate || !normalizedTime) {
    return null;
  }

  const [day, month, year] = normalizedDate.split(".").map(Number);
  const [hours, minutes, seconds] = normalizedTime.split(":").map(Number);
  const date = new Date(year, month - 1, day, hours, minutes, seconds, 0);
  const timestampMs = date.getTime();

  return Number.isNaN(timestampMs) ? null : Math.trunc(timestampMs / 1000);
}

function createRestActivityPreview() {
  return {
    activityState: "rest",
    activityDetail: "Rest day",
    workoutType: null,
    workoutLabel: null,
  };
}

const ACTIVITY_PREVIEW_SORT_PRIORITY = {
  live: 0,
  planned: 1,
  done: 2,
  rest: 3,
};

function getActivityPreviewSortPriority(profile) {
  return ACTIVITY_PREVIEW_SORT_PRIORITY[profile?.activityState] ?? 3;
}

function sortCirclePreviewPeople(people) {
  return [...people].sort((left, right) => {
    const priorityDelta =
      getActivityPreviewSortPriority(left) -
      getActivityPreviewSortPriority(right);

    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    return 0;
  });
}

function getCloudWorkoutDisplayLabel(workout) {
  const workoutType = workout?.workout_type?.trim?.() ?? workout?.workout_type;
  const label = workout?.label?.trim?.() ?? workout?.label;
  const displayName =
    workout?.workout_catalog?.display_name?.trim?.() ??
    workout?.workout_catalog?.display_name;

  if (label && label !== workoutType) {
    return label;
  }

  return displayName || label || workoutType || null;
}

function buildCloudActivityPreview(workouts) {
  if (!workouts.length) {
    return createRestActivityPreview();
  }

  const liveWorkout = workouts.find((workout) => isCloudWorkoutLive(workout));

  if (liveWorkout) {
    return {
      activityState: "live",
      activityDetail: formatCloudWorkoutElapsedDetail(liveWorkout),
      workoutType: liveWorkout.workout_type ?? null,
      workoutLabel: getCloudWorkoutDisplayLabel(liveWorkout),
    };
  }

  const plannedWorkouts = workouts.filter(
    (workout) => Number(workout.done) !== 1
  );

  if (plannedWorkouts.length > 0) {
    const nextPlannedWorkout = plannedWorkouts[0];

    return {
      activityState: "planned",
      activityDetail:
        plannedWorkouts.length > 1
          ? `${plannedWorkouts.length} planned`
          : "Planned",
      workoutType: nextPlannedWorkout.workout_type ?? null,
      workoutLabel: getCloudWorkoutDisplayLabel(nextPlannedWorkout),
    };
  }

  const completedWorkout = workouts[workouts.length - 1];

  return {
    activityState: "done",
    activityDetail:
      workouts.length > 1 ? `${workouts.length} done` : "Done today",
    workoutType: completedWorkout?.workout_type ?? null,
    workoutLabel: getCloudWorkoutDisplayLabel(completedWorkout),
  };
}

async function fetchActivityPreviewByUserId({ userIds, date }) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  const activityDate = normalizeIsoDateString(date);

  if (!uniqueUserIds.length || !activityDate) {
    return new Map();
  }

  const { data: workouts, error } = await supabase
    .from(WORKOUT_TYPE_INSTANCE_TABLE)
    .select(WORKOUT_ACTIVITY_SELECT_FIELDS)
    .in("user_id", uniqueUserIds)
    .eq("date", activityDate)
    .is("deleted_at", null)
    .order("user_id", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw normalizeSocialError(error);
  }

  const workoutsByUserId = new Map();

  (workouts ?? []).forEach((workout) => {
    if (!workoutsByUserId.has(workout.user_id)) {
      workoutsByUserId.set(workout.user_id, []);
    }

    workoutsByUserId.get(workout.user_id).push(workout);
  });

  return new Map(
    uniqueUserIds.map((userId) => [
      userId,
      buildCloudActivityPreview(workoutsByUserId.get(userId) ?? []),
    ])
  );
}

function isMissingSocialSchemaError(error) {
  const message = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  return (
    error?.code === "42P01" ||
    error?.code === "42703" ||
    (message.includes("profiles") && message.includes("does not exist")) ||
    (message.includes("user_follows") && message.includes("does not exist")) ||
    (message.includes("username_base") && message.includes("does not exist")) ||
    (message.includes("username_code") && message.includes("does not exist")) ||
    (message.includes("avatar_path") && message.includes("does not exist"))
  );
}

function normalizeSocialError(error) {
  if (isMissingSocialSchemaError(error)) {
    return new Error(SOCIAL_SETUP_MESSAGE);
  }

  const message = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  if (
    message.includes("workout_type") &&
    (message.includes("does not exist") ||
      message.includes("relationship") ||
      message.includes("schema cache") ||
      message.includes("foreign key"))
  ) {
    return new Error(WORKOUT_TYPE_SETUP_MESSAGE);
  }

  if (
    message.includes("bucket") &&
    message.includes("avatars") &&
    (message.includes("not found") || message.includes("does not exist"))
  ) {
    return new Error(SOCIAL_AVATAR_SETUP_MESSAGE);
  }

  return error;
}

function buildSearchFilter(query) {
  return query.replace(/[,%()]/g, " ").replace(/^@+/, "").trim();
}

function normalizeProfileValues({ displayName, bio }) {
  return {
    displayName: (displayName ?? "").trim(),
    bio: (bio ?? "").trim(),
  };
}

async function fetchFollowingIdSet({ currentUserId, profileIds }) {
  if (!currentUserId || !profileIds.length) {
    return new Set();
  }

  const { data: followRows, error } = await supabase
    .from(USER_FOLLOWS_TABLE)
    .select("following_id")
    .eq("follower_id", currentUserId)
    .in("following_id", profileIds);

  if (error) {
    throw normalizeSocialError(error);
  }

  return new Set((followRows ?? []).map((row) => row.following_id));
}

async function fetchProfilesByIds({ profileIds, currentUserId }) {
  if (!profileIds.length) {
    return [];
  }

  const uniqueProfileIds = [...new Set(profileIds)];
  const { data: profiles, error: profileError } = await supabase
    .from(PROFILES_TABLE)
    .select(PROFILE_SELECT_FIELDS)
    .in("id", uniqueProfileIds);

  if (profileError) {
    throw normalizeSocialError(profileError);
  }

  const followingIdSet = await fetchFollowingIdSet({
    currentUserId,
    profileIds: uniqueProfileIds,
  });
  const profilesById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile])
  );

  return uniqueProfileIds
    .map((profileId) => profilesById.get(profileId))
    .filter(Boolean)
    .map((profile) => mapProfileRow(profile, followingIdSet));
}

async function findAvailableUsernameCode(usernameBase) {
  const normalizedUsernameBase = normalizeUsernameBaseInput(usernameBase);

  if (!USERNAME_BASE_PATTERN.test(normalizedUsernameBase)) {
    throw new Error("Username base is invalid.");
  }

  const { data: existingRows, error } = await supabase
    .from(PROFILES_TABLE)
    .select("username_code")
    .eq("username_base", normalizedUsernameBase)
    .limit(10000);

  if (error) {
    throw normalizeSocialError(error);
  }

  const takenCodes = new Set(
    (existingRows ?? [])
      .map((row) => row.username_code)
      .filter((value) => typeof value === "string")
      .map((value) => formatUsernameCode(value))
  );
  const randomStart = Math.floor(Math.random() * 10 ** USERNAME_CODE_LENGTH);

  for (let offset = 0; offset < 10 ** USERNAME_CODE_LENGTH; offset += 1) {
    const candidateNumber =
      (randomStart + offset) % 10 ** USERNAME_CODE_LENGTH;
    const candidateCode = formatUsernameCode(candidateNumber);

    if (!takenCodes.has(candidateCode)) {
      return candidateCode;
    }
  }

  throw new Error(
    `Username base "${normalizedUsernameBase}" has no remaining 4-digit tags.`
  );
}

export async function ensureOwnProfile(user) {
  if (!user?.id) {
    throw new Error("You need to be signed in to load social data.");
  }

  const { data: existingProfile, error: fetchError } = await supabase
    .from(PROFILES_TABLE)
    .select(PROFILE_SELECT_FIELDS)
    .eq("id", user.id)
    .maybeSingle();

  if (fetchError) {
    throw normalizeSocialError(fetchError);
  }

  if (existingProfile) {
    return mapProfileRow(existingProfile);
  }

  const usernameBase = createFallbackUsernameBase(user);
  const displayName = createFallbackDisplayName(user, usernameBase);
  for (
    let attemptIndex = 0;
    attemptIndex < USERNAME_INSERT_RETRY_LIMIT;
    attemptIndex += 1
  ) {
    const usernameCode = await findAvailableUsernameCode(usernameBase);
    const username = buildFullUsername(usernameBase, usernameCode);
    const { data: insertedProfile, error: insertError } = await supabase
      .from(PROFILES_TABLE)
      .insert({
        id: user.id,
        username,
        username_base: usernameBase,
        username_code: usernameCode,
        display_name: displayName,
        bio: "",
      })
      .select(PROFILE_SELECT_FIELDS)
      .single();

    if (!insertError) {
      return mapProfileRow(insertedProfile);
    }

    if (insertError.code !== "23505") {
      throw normalizeSocialError(insertError);
    }

    const { data: refetchedProfile, error: refetchError } = await supabase
      .from(PROFILES_TABLE)
      .select(PROFILE_SELECT_FIELDS)
      .eq("id", user.id)
      .maybeSingle();

    if (refetchError) {
      throw normalizeSocialError(refetchError);
    }

    if (refetchedProfile) {
      return mapProfileRow(refetchedProfile);
    }
  }

  throw new Error(
    "Could not reserve a username tag right now. Please try again."
  );
}

export async function updateOwnProfile({ user, displayName, bio }) {
  if (!user?.id) {
    throw new Error("You need to be signed in to update your profile.");
  }

  const normalizedProfile = normalizeProfileValues({ displayName, bio });

  if (!normalizedProfile.displayName) {
    throw new Error("Display name cannot be empty.");
  }

  if (
    normalizedProfile.displayName.length > PROFILE_DISPLAY_NAME_MAX_LENGTH
  ) {
    throw new Error(
      `Display name must stay within ${PROFILE_DISPLAY_NAME_MAX_LENGTH} characters.`
    );
  }

  if (normalizedProfile.bio.length > PROFILE_BIO_MAX_LENGTH) {
    throw new Error(
      `Bio must stay within ${PROFILE_BIO_MAX_LENGTH} characters.`
    );
  }

  await ensureOwnProfile(user);

  const { data: updatedProfile, error: updateError } = await supabase
    .from(PROFILES_TABLE)
    .update({
      display_name: normalizedProfile.displayName,
      bio: normalizedProfile.bio,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select(PROFILE_SELECT_FIELDS)
    .single();

  if (updateError) {
    throw normalizeSocialError(updateError);
  }

  const existingMetadata = user.user_metadata ?? {};
  if (existingMetadata.display_name !== normalizedProfile.displayName) {
    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        ...existingMetadata,
        display_name: normalizedProfile.displayName,
      },
    });

    if (metadataError) {
      console.warn(
        "Updated profile row but failed to mirror display_name to auth metadata:",
        metadataError
      );
    }
  }

  return mapProfileRow(updatedProfile);
}

export async function uploadOwnAvatar({ user, asset }) {
  if (!user?.id) {
    throw new Error("You need to be signed in to update your profile photo.");
  }

  if (!asset?.uri) {
    throw new Error("Pick an image before uploading a profile photo.");
  }

  if (asset.fileSize && asset.fileSize > PROFILE_AVATAR_MAX_BYTES) {
    throw new Error("Profile photo must stay within 3 MB.");
  }

  await ensureOwnProfile(user);

  const response = await fetch(asset.uri);

  if (!response.ok) {
    throw new Error("Could not read the selected image.");
  }

  const avatarBuffer = await response.arrayBuffer();

  if (!avatarBuffer.byteLength) {
    throw new Error("The selected image was empty.");
  }

  const avatarPath = getAvatarObjectPath(user.id);
  const contentType =
    asset.mimeType ?? response.headers.get("Content-Type") ?? "image/jpeg";
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(avatarPath, avatarBuffer, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    throw normalizeSocialError(uploadError);
  }

  const nextUpdatedAt = new Date().toISOString();
  const { data: updatedProfile, error: updateError } = await supabase
    .from(PROFILES_TABLE)
    .update({
      avatar_path: avatarPath,
      updated_at: nextUpdatedAt,
    })
    .eq("id", user.id)
    .select(PROFILE_SELECT_FIELDS)
    .single();

  if (updateError) {
    throw normalizeSocialError(updateError);
  }

  return mapProfileRow(updatedProfile);
}

export async function searchUsers({ query, currentUserId, limit = 20 }) {
  if (!currentUserId) {
    throw new Error("You need to be signed in to search for users.");
  }

  const normalizedQuery = buildSearchFilter(query ?? "");
  let profilesQuery = supabase
    .from(PROFILES_TABLE)
    .select(PROFILE_SELECT_FIELDS)
    .neq("id", currentUserId)
    .order("display_name", { ascending: true })
    .limit(limit);

  if (normalizedQuery.length > 0) {
    profilesQuery = profilesQuery.or(
      `username.ilike.%${normalizedQuery}%,username_base.ilike.%${normalizedQuery}%,display_name.ilike.%${normalizedQuery}%`
    );
  }

  const { data: profiles, error: profileError } = await profilesQuery;

  if (profileError) {
    throw normalizeSocialError(profileError);
  }

  if (!profiles?.length) {
    return [];
  }

  const followingIdSet = await fetchFollowingIdSet({
    currentUserId,
    profileIds: profiles.map((profile) => profile.id),
  });

  return profiles.map((row) => mapProfileRow(row, followingIdSet));
}

export async function getFollowCounts({ userId }) {
  if (!userId) {
    throw new Error("Missing user information for follow counts.");
  }

  const [
    { count: followersCount, error: followersError },
    { count: followingCount, error: followingError },
  ] = await Promise.all([
    supabase
      .from(USER_FOLLOWS_TABLE)
      .select("*", { count: "exact", head: true })
      .eq("following_id", userId),
    supabase
      .from(USER_FOLLOWS_TABLE)
      .select("*", { count: "exact", head: true })
      .eq("follower_id", userId),
  ]);

  if (followersError) {
    throw normalizeSocialError(followersError);
  }

  if (followingError) {
    throw normalizeSocialError(followingError);
  }

  return {
    followers: followersCount ?? 0,
    following: followingCount ?? 0,
  };
}

export async function getFollowers({
  userId,
  currentUserId,
  limit = 50,
}) {
  if (!userId) {
    throw new Error("Missing user information for followers.");
  }

  const { data: followRows, error } = await supabase
    .from(USER_FOLLOWS_TABLE)
    .select("follower_id, created_at")
    .eq("following_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw normalizeSocialError(error);
  }

  return fetchProfilesByIds({
    profileIds: (followRows ?? []).map((row) => row.follower_id),
    currentUserId,
  });
}

export async function getFollowing({
  userId,
  currentUserId,
  limit = 50,
}) {
  if (!userId) {
    throw new Error("Missing user information for following.");
  }

  const { data: followRows, error } = await supabase
    .from(USER_FOLLOWS_TABLE)
    .select("following_id, created_at")
    .eq("follower_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw normalizeSocialError(error);
  }

  return fetchProfilesByIds({
    profileIds: (followRows ?? []).map((row) => row.following_id),
    currentUserId,
  });
}

export async function getCirclePreview({ user, limit = 12, date = null }) {
  if (!user?.id) {
    throw new Error("You need to be signed in to load your circle.");
  }

  const [currentUserProfile, followingProfiles] = await Promise.all([
    ensureOwnProfile(user),
    getFollowing({
      userId: user.id,
      currentUserId: user.id,
      limit,
    }),
  ]);
  const activityPreviewByUserId = await fetchActivityPreviewByUserId({
    userIds: followingProfiles.map((profile) => profile.id),
    date,
  });

  const people = followingProfiles.map((profile) => ({
    ...profile,
    relationshipType: "following",
    ...(activityPreviewByUserId.get(profile.id) ?? createRestActivityPreview()),
  }));

  return {
    currentUser: currentUserProfile,
    people: sortCirclePreviewPeople(people),
  };
}

export async function followUser({ userId, targetUserId }) {
  if (!userId || !targetUserId) {
    throw new Error("Missing user information for follow.");
  }

  if (userId === targetUserId) {
    throw new Error("You cannot follow yourself.");
  }

  const { error } = await supabase.from(USER_FOLLOWS_TABLE).insert({
    follower_id: userId,
    following_id: targetUserId,
  });

  if (error && error.code !== "23505") {
    throw normalizeSocialError(error);
  }
}

export async function unfollowUser({ userId, targetUserId }) {
  if (!userId || !targetUserId) {
    throw new Error("Missing user information for unfollow.");
  }

  const { error } = await supabase
    .from(USER_FOLLOWS_TABLE)
    .delete()
    .eq("follower_id", userId)
    .eq("following_id", targetUserId);

  if (error) {
    throw normalizeSocialError(error);
  }
}
