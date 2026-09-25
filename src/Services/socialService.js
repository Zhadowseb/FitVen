import { t } from "@localization";
import { supabase } from "../Database/supaBaseClient";
import {
  AVATAR_BUCKET,
  attachAvatarUrls,
  forgetAvatarUrl,
  getAvatarObjectPath,
} from "./avatarUrls";
import {
  calculateAgeFromBirthDate,
  getTodaysDate,
  normalizeIsoDateString,
} from "../Utils/dateUtils";
import {
  buildFullUsername,
  formatUsernameCode,
  normalizeUsernameBaseInput,
  slugifyUsernameBase,
  splitFullUsername,
  USERNAME_BASE_PATTERN,
} from "../Utils/socialUsername";
import {
  MAX_HEART_RATE_SOURCE_AUTO,
  normalizeMaxHeartRate,
  normalizeMaxHeartRateSource,
  resolveMaxHeartRate,
} from "../Utils/heartRateUtils";
import {
  buildCloudActivityPreview,
  isMissingGymJoinError,
  createRestActivityPreview,
  getCloudWorkoutActivityAt,
  getCloudWorkoutDisplayLabel,
  isCloudWorkoutLive,
  mapCloudWorkoutGym,
  mapCloudWorkoutMusic,
} from "../Utils/cloudActivityUtils";
import * as gymService from "./gymService";

const PROFILES_TABLE = "profiles";
const PROFILE_PRIVATE_TABLE = "profile_private";
const USER_FOLLOWS_TABLE = "user_follows";
const USER_BLOCKS_TABLE = "user_blocks";
const USER_REPORTS_TABLE = "user_reports";
const WORKOUT_TYPE_INSTANCE_TABLE = "workout_type_instance";
const PROFILE_SELECT_FIELDS =
  "id, username, username_base, username_code, display_name, bio, avatar_path, created_at, updated_at";
const WORKOUT_ACTIVITY_SELECT_FIELDS =
  "id, user_id, workout_type, date, label, done, is_active, timer_start, elapsed_time, deleted_at, last_updated, workout_catalog:workout_type!workout_type_instance_workout_type_fkey(display_name)";
// The same rows with the centre and the newest track joined in, one request
// for everyone. Falls back to the plain select when the centre migration has
// not been run, so Home keeps working in the meantime.
const WORKOUT_ACTIVITY_WITH_GYM_SELECT_FIELDS = `${WORKOUT_ACTIVITY_SELECT_FIELDS}, gym_id, gym:gym!workout_type_instance_gym_id_fkey(id, short_name), workout_music(track, artist, art_url, provider, played_at)`;
const SOCIAL_SETUP_MESSAGE =
  "User search and follows are not set up in Supabase yet. Run supabase/migrations/20260424004053_social-search.sql in the Supabase SQL editor first.";
const WORKOUT_TYPE_SETUP_MESSAGE =
  "Workout types are not set up in Supabase yet. Run supabase/migrations/20260429131030_workout-types.sql in the Supabase SQL editor first.";
const SOCIAL_AVATAR_SETUP_MESSAGE =
  "Profile photos are not set up in Supabase yet. Make sure the avatars bucket exists and rerun the updated supabase/migrations/20260424004053_social-search.sql script first.";
const SOCIAL_BLOCK_SETUP_MESSAGE =
  "Blocking and the new user search are not set up in Supabase yet. Run supabase/migrations/20260905143000_user-blocks.sql in the Supabase SQL editor first.";
const SOCIAL_REPORT_SETUP_MESSAGE =
  "Reporting is not set up in Supabase yet. Run supabase/migrations/20260912220000_ugc-safety.sql in the Supabase SQL editor first.";
const PROFILE_BIRTH_DATE_SETUP_MESSAGE =
  "Birth date settings are not set up in Supabase yet. Run supabase/migrations/20260628211540_profile-birthdate.sql in the Supabase SQL editor first.";
export const PROFILE_DISPLAY_NAME_MAX_LENGTH = 40;
export const PROFILE_BIO_MAX_LENGTH = 160;
export const PROFILE_AVATAR_MAX_BYTES = 3 * 1024 * 1024;
// What profile_private.sex may hold. Null, the default, is "not given".
export const PROFILE_SEXES = Object.freeze({
  MALE: "male",
  FEMALE: "female",
});
const PROFILE_SEX_VALUES = Object.values(PROFILE_SEXES);
export const USER_SEARCH_MIN_LENGTH = 2;
const USERNAME_INSERT_RETRY_LIMIT = 3;

// The email address is deliberately not a source for either of these. For most
// people the part before the @ is their real name, and both of these end up on
// a public profile. The same change is in private.handle_new_user, which is the
// path that normally runs; this is the fallback for an account whose trigger
// did not fire.
function createFallbackUsernameBase(user) {
  return slugifyUsernameBase(
    user?.user_metadata?.username_base ??
      user?.user_metadata?.username ??
      user?.user_metadata?.display_name ??
      "user"
  );
}

function createFallbackDisplayName(user, usernameBase) {
  const metadataDisplayName = user?.user_metadata?.display_name?.trim();

  return metadataDisplayName || usernameBase;
}

function mapProfileRow(
  row,
  followingIdSet = new Set(),
  privateSettings = {}
) {
  const parsedUsername = splitFullUsername(row.username);
  const usernameBase =
    row.username_base ?? parsedUsername?.usernameBase ?? "";
  const usernameCode =
    row.username_code ?? parsedUsername?.usernameCode ?? "";
  const updatedAt = row.updated_at ?? row.created_at ?? null;
  const birthDate = normalizeIsoDateString(privateSettings.birthDate);
  const age = calculateAgeFromBirthDate(birthDate);
  const manualMaxHeartRate = normalizeMaxHeartRate(
    privateSettings.manualMaxHeartRate
  );
  const measuredMaxHeartRate = normalizeMaxHeartRate(
    privateSettings.measuredMaxHeartRate
  );
  const preferredMaxHeartRateSource = normalizeMaxHeartRateSource(
    privateSettings.preferredMaxHeartRateSource
  );
  const maxHeartRate = resolveMaxHeartRate({
    age,
    manualMaxHeartRate,
    measuredMaxHeartRate,
    preferredSource: preferredMaxHeartRateSource,
  });

  return {
    id: row.id,
    username:
      row.username ?? buildFullUsername(usernameBase, usernameCode),
    usernameBase,
    usernameCode,
    displayName: row.display_name,
    bio: row.bio ?? "",
    birthDate,
    age,
    manualMaxHeartRate,
    measuredMaxHeartRate,
    maxHeartRate: maxHeartRate.value,
    maxHeartRateSource: maxHeartRate.source,
    preferredMaxHeartRateSource,
    avatarPath: row.avatar_path ?? null,
    avatarUpdatedAt: updatedAt,
    avatarUrl: null,
    createdAt: row.created_at ?? null,
    updatedAt,
    isFollowing: followingIdSet.has(row.id),
  };
}











// How far either side of today the tiles look for a last or a next workout.
// Far enough to cover a holiday and a training plan; the database does the
// looking, so the window costs one index scan rather than a page of rows.
const SURROUNDING_ACTIVITY_PAST_DAYS = 180;
const SURROUNDING_ACTIVITY_FUTURE_DAYS = 60;
/**
 * The last day each person finished a workout and the next day they have one
 * planned, for the tiles of everybody who has nothing on today.
 *
 * Through an RPC rather than a select. The follower policy on
 * `workout_type_instance` only lets a follower see yesterday, today and
 * tomorrow, so reading the table directly answered null for every friend and
 * the tiles said nothing instead of "3 days ago". Widening that policy would
 * hand a follower the whole training history to produce two dates;
 * `friends_surrounding_activity` is a security definer function that returns
 * the two dates and nothing else, for people the viewer actually follows.
 */
async function fetchSurroundingActivityByUserId({ userIds }) {
  const surrounding = new Map(
    userIds.map((userId) => [userId, { lastWorkoutAt: null, nextWorkoutAt: null }])
  );

  const { data, error } = await supabase.rpc("friends_surrounding_activity", {
    target_ids: userIds,
    past_days: SURROUNDING_ACTIVITY_PAST_DAYS,
    future_days: SURROUNDING_ACTIVITY_FUTURE_DAYS,
  });

  // A database without the function is a client running ahead of its
  // migrations: the tiles lose "last trained" and keep everything else.
  if (error) {
    console.warn("Could not read surrounding activity:", error.message ?? error);
    return surrounding;
  }

  for (const row of data ?? []) {
    const entry = surrounding.get(row.user_id);

    if (entry) {
      entry.lastWorkoutAt = row.last_workout_at ?? null;
      entry.nextWorkoutAt = row.next_workout_at ?? null;
    }
  }

  return surrounding;
}











async function fetchActivityWorkouts({ userIds, activityDate }) {
  const { data, error } = await supabase
    .from(WORKOUT_TYPE_INSTANCE_TABLE)
    .select(WORKOUT_ACTIVITY_WITH_GYM_SELECT_FIELDS)
    .in("user_id", userIds)
    .eq("date", activityDate)
    .is("deleted_at", null)
    .order("user_id", { ascending: true })
    .order("id", { ascending: true })
    .order("played_at", { referencedTable: "workout_music", ascending: false })
    .limit(1, { referencedTable: "workout_music" });

  if (!error) {
    return data ?? [];
  }

  if (!isMissingGymJoinError(error)) {
    throw normalizeSocialError(error);
  }

  const { data: plainData, error: plainError } = await supabase
    .from(WORKOUT_TYPE_INSTANCE_TABLE)
    .select(WORKOUT_ACTIVITY_SELECT_FIELDS)
    .in("user_id", userIds)
    .eq("date", activityDate)
    .is("deleted_at", null)
    .order("user_id", { ascending: true })
    .order("id", { ascending: true });

  if (plainError) {
    throw normalizeSocialError(plainError);
  }

  return plainData ?? [];
}

/**
 * How many personal records each of these workouts holds, by workout id.
 *
 * Friends' sets are private, so this goes through workout_record_counts,
 * which hands out the count for a workout the caller can already see and
 * nothing else. It only decorates a tile, so every failure - the function not
 * there yet included - is an empty answer rather than an error: a strip
 * without crowns is fine, a strip that failed to load is not.
 */
async function fetchWorkoutRecordCounts(workoutIds) {
  const ids = [...new Set(workoutIds.filter((id) => Number.isFinite(Number(id))))];

  if (!ids.length) {
    return new Map();
  }

  try {
    const { data, error } = await supabase.rpc("workout_record_counts", { workout_ids: ids });

    if (error) {
      return new Map();
    }

    return new Map(
      (data ?? []).map((row) => [Number(row.workout_id), Number(row.records) || 0])
    );
  } catch {
    return new Map();
  }
}

async function fetchActivityPreviewByUserId({ userIds, date }) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  // Today when the caller does not say. A missing date used to return an empty
  // map, which made every tile read "no activity" - the feature switched off
  // by an omitted argument, with nothing anywhere saying so.
  const activityDate = normalizeIsoDateString(date ?? getTodaysDate());

  if (!uniqueUserIds.length || !activityDate) {
    return new Map();
  }

  const [workouts, surrounding] = await Promise.all([
    fetchActivityWorkouts({ userIds: uniqueUserIds, activityDate }),
    fetchSurroundingActivityByUserId({ userIds: uniqueUserIds }),
  ]);
  // Only a finished workout's records crown a tile.
  const recordCounts = await fetchWorkoutRecordCounts(
    (workouts ?? []).filter((workout) => Number(workout.done) === 1).map((workout) => workout.id)
  );

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
      {
        ...buildCloudActivityPreview(workoutsByUserId.get(userId) ?? []),
        // Carried for everybody, not just the people resting: the strip is
        // sorted on them, and a tile that is quiet today still has a story.
        ...(surrounding.get(userId) ?? { lastWorkoutAt: null, nextWorkoutAt: null }),
        recordsToday: (workoutsByUserId.get(userId) ?? []).reduce(
          (total, workout) => total + (recordCounts.get(Number(workout.id)) ?? 0),
          0
        ),
      },
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
  const message = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();

  if (
    message.includes(PROFILE_PRIVATE_TABLE) &&
    (message.includes("does not exist") || message.includes("schema cache"))
  ) {
    return new Error(PROFILE_BIRTH_DATE_SETUP_MESSAGE);
  }

  // Checked before the generic one, for the same reason as the block message
  // below it: a missing reports table arrives as a 404 that the generic message
  // would blame on the wrong migration.
  if (
    message.includes(USER_REPORTS_TABLE) &&
    (message.includes("does not exist") || message.includes("schema cache"))
  ) {
    return new Error(SOCIAL_REPORT_SETUP_MESSAGE);
  }

  // Checked before the generic one: these three arrive as a 404 or a
  // missing-function error, and the generic message names the wrong file.
  if (
    message.includes("search_profiles") ||
    message.includes("list_blocked_profiles") ||
    message.includes("claim_username_code") ||
    (message.includes(USER_BLOCKS_TABLE) && message.includes("does not exist"))
  ) {
    return new Error(SOCIAL_BLOCK_SETUP_MESSAGE);
  }

  if (isMissingSocialSchemaError(error)) {
    return new Error(SOCIAL_SETUP_MESSAGE);
  }

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

function isMissingPrivateMaxHeartRateColumnsError(error) {
  const message = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();

  return (
    message.includes(PROFILE_PRIVATE_TABLE) &&
    (message.includes("manual_max_heart_rate") ||
      message.includes("measured_max_heart_rate")) &&
    (message.includes("does not exist") || message.includes("schema cache"))
  );
}

function isMissingPrivateMaxHeartRateSourceError(error) {
  const message = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();

  return (
    message.includes(PROFILE_PRIVATE_TABLE) &&
    message.includes("max_heart_rate_source") &&
    (message.includes("does not exist") || message.includes("schema cache"))
  );
}

// A read names the column in "column profile_private.sex does not exist"
// (42703); a write in "Could not find the 'sex' column of 'profile_private' in
// the schema cache" (PGRST204). A word match, so "sex" inside another name
// does not count.
function isMissingPrivateSexColumnError(error) {
  const message = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();

  return (
    message.includes(PROFILE_PRIVATE_TABLE) &&
    /\bsex\b/.test(message) &&
    (error?.code === "42703" ||
      error?.code === "PGRST204" ||
      message.includes("does not exist") ||
      message.includes("schema cache"))
  );
}

// The sex is only stored once 20260927090000_a-lifter-can-give-their-sex.sql
// has run. Until then the first read or write that names the column fails,
// the profile goes on without it, and it is not asked for again this session -
// otherwise every ensureOwnProfile, which half the social features call, would
// cost a failed request and a retry.
let privateSexUnavailable = false;

// The result is interpolated into a PostgREST `or=(...)` string, where a comma
// or a bracket would end the value and start a new filter, and % and * are
// wildcards. This used to strip a list of known-bad characters; a positive list
// cannot quietly stop covering everything if that string ever gains a field or
// an operator. Letters and digits are unicode, so a name in any alphabet still
// searches.
/**
 * Cleans a search box into something search_profiles can use.
 *
 * `#` survives, because a username is `base#1234` and the four digits are the
 * whole point of them: two people can both be `sebastian`, and the code is what
 * tells them apart. Stripping it turned "sebastian#4471" into "sebastian 4471",
 * which the server then closed up to "sebastian4471" - matching nobody, while
 * the same search without the digits worked. Searching for exactly the person
 * you were given failed, and searching vaguely succeeded.
 *
 * Everything else still becomes a space, which is only about keeping the two
 * halves apart on the way over: search_profiles strips whitespace as well, so
 * "anna.b" reaches the query as "annab" either way.
 */
export function buildSearchFilter(query) {
  return String(query ?? "")
    .replace(/^@+/, "")
    .replace(/[^\p{L}\p{N}# _-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// The birth date and the sex live in profile_private, and `undefined` for
// either means "not part of this save" rather than "clear it": the form leaves
// both out when they could not be loaded, so a failed read is never written
// back over what is stored.
function normalizeProfileValues({ displayName, bio, birthDate, sex }) {
  return {
    displayName: (displayName ?? "").trim(),
    bio: (bio ?? "").trim(),
    birthDate:
      birthDate === undefined ? undefined : normalizeBirthDateValue(birthDate),
    sex: normalizeSexValue(sex),
  };
}

// "male", "female" or null (not given). Anything else comes out as null, and
// validateSex refuses it when it was a real value rather than an empty one.
function normalizeSexValue(sex) {
  if (sex === undefined) {
    return undefined;
  }

  if (sex === null) {
    return null;
  }

  const normalized = String(sex).trim().toLowerCase();

  return PROFILE_SEX_VALUES.includes(normalized) ? normalized : null;
}

function validateSex(sex, normalizedSex) {
  if (
    sex !== undefined &&
    sex !== null &&
    String(sex).trim() !== "" &&
    normalizedSex === null
  ) {
    throw new Error(t("profile.sex.invalid"));
  }
}

// The birth date is only ever used to work out an age for heart rate zones, so
// the day and month are thrown away before anything is stored. Everything
// downstream keeps working on a date; it is simply always the 1st of January.
function normalizeBirthDateValue(birthDate) {
  if (birthDate === null || birthDate === undefined || birthDate === "") {
    return null;
  }

  const normalized = normalizeIsoDateString(birthDate);

  return normalized ? `${normalized.slice(0, 4)}-01-01` : normalized;
}

function validateBirthDate(birthDate, normalizedBirthDate) {
  if (birthDate && !normalizedBirthDate) {
    throw new Error(t("social.errors.birthDateInvalid"));
  }

  if (
    normalizedBirthDate &&
    normalizedBirthDate > new Date().toISOString().slice(0, 10)
  ) {
    throw new Error(t("social.errors.birthDateFuture"));
  }

  if (normalizedBirthDate && normalizedBirthDate < "1900-01-01") {
    throw new Error(t("social.errors.birthDateTooEarly"));
  }
}

// The birth year and the sex, the two private fields the profile form edits,
// in one write. A field left undefined is not sent at all, so an upsert that
// only carries the birth year - the heart rate settings save it on its own -
// leaves the sex as it is. Resolves with whether the sex went in: before the
// sex migration has run, the birth year is saved without it.
async function saveOwnPrivateProfile(userId, { birthDate, sex }) {
  const row = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  };

  if (birthDate !== undefined) {
    row.birth_date = birthDate;
  }

  const includesSex = sex !== undefined && !privateSexUnavailable;

  if (includesSex) {
    row.sex = sex;
  }

  if (row.birth_date === undefined && !includesSex) {
    return { sexSaved: false };
  }

  const { error } = await supabase
    .from(PROFILE_PRIVATE_TABLE)
    .upsert(row, { onConflict: "user_id" });

  if (!error) {
    return { sexSaved: includesSex };
  }

  if (!includesSex || !isMissingPrivateSexColumnError(error)) {
    throw normalizeSocialError(error);
  }

  privateSexUnavailable = true;
  delete row.sex;

  if (row.birth_date !== undefined) {
    const { error: retryError } = await supabase
      .from(PROFILE_PRIVATE_TABLE)
      .upsert(row, { onConflict: "user_id" });

    if (retryError) {
      throw normalizeSocialError(retryError);
    }
  }

  return { sexSaved: false };
}

const PRIVATE_SETTINGS_SELECT_FIELDS =
  "birth_date, manual_max_heart_rate, measured_max_heart_rate, max_heart_rate_source";

function mapPrivateSettingsRow(data) {
  return {
    birthDate: normalizeIsoDateString(data?.birth_date),
    manualMaxHeartRate: normalizeMaxHeartRate(data?.manual_max_heart_rate),
    measuredMaxHeartRate: normalizeMaxHeartRate(data?.measured_max_heart_rate),
    preferredMaxHeartRateSource: normalizeMaxHeartRateSource(
      data?.max_heart_rate_source
    ),
  };
}

// `sexAvailable` says whether the column exists, so the form knows whether to
// offer the field at all; `sex` is null both when it was never given and when
// it cannot be stored yet.
async function getOwnPrivateSettings(userId) {
  if (privateSexUnavailable) {
    return {
      ...(await getOwnPrivateSettingsWithoutSex(userId)),
      sex: null,
      sexAvailable: false,
    };
  }

  const { data, error } = await supabase
    .from(PROFILE_PRIVATE_TABLE)
    .select(`${PRIVATE_SETTINGS_SELECT_FIELDS}, sex`)
    .eq("user_id", userId)
    .maybeSingle();

  if (!error) {
    return {
      ...mapPrivateSettingsRow(data),
      sex: normalizeSexValue(data?.sex ?? null),
      sexAvailable: true,
    };
  }

  const sexIsMissing = isMissingPrivateSexColumnError(error);

  if (
    !sexIsMissing &&
    !isMissingPrivateMaxHeartRateSourceError(error) &&
    !isMissingPrivateMaxHeartRateColumnsError(error)
  ) {
    throw normalizeSocialError(error);
  }

  if (sexIsMissing) {
    privateSexUnavailable = true;
  }

  // An older project: read what it has, the way it always has.
  return {
    ...(await getOwnPrivateSettingsWithoutSex(userId)),
    sex: null,
    sexAvailable: false,
  };
}

async function getOwnPrivateSettingsWithoutSex(userId) {
  const { data, error } = await supabase
    .from(PROFILE_PRIVATE_TABLE)
    .select(PRIVATE_SETTINGS_SELECT_FIELDS)
    .eq("user_id", userId)
    .maybeSingle();

  if (error && isMissingPrivateMaxHeartRateSourceError(error)) {
    const { data: previousData, error: previousError } = await supabase
      .from(PROFILE_PRIVATE_TABLE)
      .select("birth_date, manual_max_heart_rate, measured_max_heart_rate")
      .eq("user_id", userId)
      .maybeSingle();

    if (!previousError) {
      return {
        birthDate: normalizeIsoDateString(previousData?.birth_date),
        manualMaxHeartRate: normalizeMaxHeartRate(
          previousData?.manual_max_heart_rate
        ),
        measuredMaxHeartRate: normalizeMaxHeartRate(
          previousData?.measured_max_heart_rate
        ),
        preferredMaxHeartRateSource: MAX_HEART_RATE_SOURCE_AUTO,
      };
    }

    if (!isMissingPrivateMaxHeartRateColumnsError(previousError)) {
      throw normalizeSocialError(previousError);
    }

    const { data: legacyData, error: legacyError } = await supabase
      .from(PROFILE_PRIVATE_TABLE)
      .select("birth_date")
      .eq("user_id", userId)
      .maybeSingle();

    if (legacyError) {
      throw normalizeSocialError(legacyError);
    }

    return {
      birthDate: normalizeIsoDateString(legacyData?.birth_date),
      manualMaxHeartRate: null,
      measuredMaxHeartRate: null,
      preferredMaxHeartRateSource: MAX_HEART_RATE_SOURCE_AUTO,
    };
  }

  if (error && isMissingPrivateMaxHeartRateColumnsError(error)) {
    const { data: legacyData, error: legacyError } = await supabase
      .from(PROFILE_PRIVATE_TABLE)
      .select("birth_date")
      .eq("user_id", userId)
      .maybeSingle();

    if (legacyError) {
      throw normalizeSocialError(legacyError);
    }

    return {
      birthDate: normalizeIsoDateString(legacyData?.birth_date),
      manualMaxHeartRate: null,
      measuredMaxHeartRate: null,
      preferredMaxHeartRateSource: MAX_HEART_RATE_SOURCE_AUTO,
    };
  }

  if (error) {
    throw normalizeSocialError(error);
  }

  return mapPrivateSettingsRow(data);
}

// The sex is added here and not in mapProfileRow, which also maps other
// people's rows: it is the owner's own business, so it is only ever a field on
// the owner's own profile. profile_private answers nobody else anyway.
async function mapOwnProfileRow(row, userId) {
  try {
    const privateSettings = await getOwnPrivateSettings(userId);
    const profile = mapProfileRow(row, new Set(), privateSettings);
    await attachAvatarUrls([profile]);

    return {
      ...profile,
      sex: privateSettings.sex ?? null,
      sexAvailable: privateSettings.sexAvailable === true,
      privateSettingsAvailable: true,
      privateSettingsError: null,
    };
  } catch (error) {
    console.warn("Private profile settings are unavailable:", error);
    const profile = mapProfileRow(row);
    await attachAvatarUrls([profile]);

    return {
      ...profile,
      sex: null,
      // Not known to be missing - the read failed, not the column - so the
      // form still shows the field, locked like the birth year beside it.
      sexAvailable: !privateSexUnavailable,
      privateSettingsAvailable: false,
      privateSettingsError:
        error instanceof Error
          ? error.message
          : t("social.errors.privateSettingsUnavailable"),
    };
  }
}

export async function getOwnRunProfileSettings(user) {
  const profile = await ensureOwnProfile(user);
  const privateSettings = await getOwnPrivateSettings(user.id);
  const age = calculateAgeFromBirthDate(privateSettings.birthDate);
  const maxHeartRate = resolveMaxHeartRate({
    age,
    manualMaxHeartRate: privateSettings.manualMaxHeartRate,
    measuredMaxHeartRate: privateSettings.measuredMaxHeartRate,
    preferredSource: privateSettings.preferredMaxHeartRateSource,
  });

  return {
    ...profile,
    birthDate: privateSettings.birthDate,
    age,
    manualMaxHeartRate: privateSettings.manualMaxHeartRate,
    measuredMaxHeartRate: privateSettings.measuredMaxHeartRate,
    maxHeartRate: maxHeartRate.value,
    maxHeartRateSource: maxHeartRate.source,
    preferredMaxHeartRateSource: maxHeartRate.preferredSource,
    privateSettingsAvailable: true,
    privateSettingsError: null,
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

  return attachAvatarUrls(
    uniqueProfileIds
      .map((profileId) => profilesById.get(profileId))
      .filter(Boolean)
      .map((profile) => mapProfileRow(profile, followingIdSet))
  );
}

async function findAvailableUsernameCode(usernameBase) {
  const normalizedUsernameBase = normalizeUsernameBaseInput(usernameBase);

  if (!USERNAME_BASE_PATTERN.test(normalizedUsernameBase)) {
    throw new Error(t("social.errors.usernameBaseInvalid"));
  }

  // This used to read every profile sharing the base and pick a code that was
  // not among them. Two problems with that, and the second one is new:
  // there was nothing stopping two clients picking the same free code at the
  // same moment, and since profiles stopped answering to strangers the read
  // comes back empty, so the "check" was really a guess. The database has
  // allocated tags under an advisory lock all along.
  const { data: claimedCode, error } = await supabase.rpc(
    "claim_username_code",
    { username_base: normalizedUsernameBase }
  );

  if (error) {
    throw normalizeSocialError(error);
  }

  if (typeof claimedCode !== "string" || !claimedCode) {
    throw new Error(
      t("social.errors.usernameBaseExhausted", {
        usernameBase: normalizedUsernameBase,
      })
    );
  }

  return formatUsernameCode(claimedCode);
}

export async function ensureOwnProfile(user) {
  if (!user?.id) {
    throw new Error(t("social.errors.signInToLoadSocial"));
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
    return mapOwnProfileRow(existingProfile, user.id);
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
      return mapOwnProfileRow(insertedProfile, user.id);
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
      return mapOwnProfileRow(refetchedProfile, user.id);
    }
  }

  throw new Error(t("social.errors.usernameTagUnavailable"));
}

/**
 * Saves the profile form: the public half on `profiles`, then the birth year
 * and the sex together on `profile_private`. Leave `birthDate` and `sex` out
 * (undefined) to save the public half only. A private write that fails does
 * not undo the public one; the result says so in `privateSettingsError`.
 */
export async function updateOwnProfile({
  user,
  displayName,
  bio,
  birthDate,
  sex,
}) {
  if (!user?.id) {
    throw new Error(t("social.errors.signInToUpdateProfile"));
  }

  const normalizedProfile = normalizeProfileValues({
    displayName,
    bio,
    birthDate,
    sex,
  });

  validateBirthDate(birthDate, normalizedProfile.birthDate);
  validateSex(sex, normalizedProfile.sex);

  if (!normalizedProfile.displayName) {
    throw new Error(t("social.errors.displayNameEmpty"));
  }

  if (
    normalizedProfile.displayName.length > PROFILE_DISPLAY_NAME_MAX_LENGTH
  ) {
    throw new Error(
      t("social.errors.displayNameTooLong", {
        count: PROFILE_DISPLAY_NAME_MAX_LENGTH,
      })
    );
  }

  if (normalizedProfile.bio.length > PROFILE_BIO_MAX_LENGTH) {
    throw new Error(
      t("social.errors.bioTooLong", { count: PROFILE_BIO_MAX_LENGTH })
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

  let privateSettingsError = null;

  if (
    normalizedProfile.birthDate !== undefined ||
    normalizedProfile.sex !== undefined
  ) {
    try {
      await saveOwnPrivateProfile(user.id, {
        birthDate: normalizedProfile.birthDate,
        sex: normalizedProfile.sex,
      });
    } catch (error) {
      privateSettingsError = error;
      console.warn(
        "Public profile saved without private profile settings:",
        error
      );
    }
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

  const mappedProfile = await mapOwnProfileRow(updatedProfile, user.id);

  if (!privateSettingsError) {
    return mappedProfile;
  }

  return {
    ...mappedProfile,
    privateSettingsAvailable: false,
    privateSettingsError:
      privateSettingsError instanceof Error
        ? privateSettingsError.message
        : t("social.errors.privateSettingsSaveFailed"),
  };
}

export async function updateOwnBirthDate({ user, birthDate }) {
  if (!user?.id) {
    throw new Error(t("social.errors.signInToUpdateBirthDate"));
  }

  const normalizedBirthDate = normalizeBirthDateValue(birthDate);
  validateBirthDate(birthDate, normalizedBirthDate);
  await ensureOwnProfile(user);
  // The birth year alone: no sex in the row, so the one stored stays.
  await saveOwnPrivateProfile(user.id, { birthDate: normalizedBirthDate });

  return getOwnRunProfileSettings(user);
}

export async function updateOwnManualMaxHeartRate({
  user,
  maxHeartRate,
}) {
  if (!user?.id) {
    throw new Error(t("social.errors.signInToUpdateMaxHeartRate"));
  }

  const normalizedMaxHeartRate = normalizeMaxHeartRate(maxHeartRate);

  if (
    maxHeartRate !== null &&
    maxHeartRate !== undefined &&
    maxHeartRate !== "" &&
    normalizedMaxHeartRate === null
  ) {
    throw new Error(t("social.errors.maxHeartRateRange"));
  }

  await ensureOwnProfile(user);

  const { error } = await supabase
    .from(PROFILE_PRIVATE_TABLE)
    .upsert(
      {
        user_id: user.id,
        manual_max_heart_rate: normalizedMaxHeartRate,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    throw normalizeSocialError(error);
  }

  return getOwnRunProfileSettings(user);
}

export async function updateOwnMaxHeartRateSource({
  user,
  preferredSource,
}) {
  if (!user?.id) {
    throw new Error(t("social.errors.signInToUpdateMaxHeartRate"));
  }

  const normalizedSource = normalizeMaxHeartRateSource(preferredSource);

  if (normalizedSource !== preferredSource) {
    throw new Error(t("social.errors.maxHeartRateSourceInvalid"));
  }

  await ensureOwnProfile(user);

  const { error } = await supabase
    .from(PROFILE_PRIVATE_TABLE)
    .upsert(
      {
        user_id: user.id,
        max_heart_rate_source: normalizedSource,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    throw normalizeSocialError(error);
  }

  return getOwnRunProfileSettings(user);
}

export async function uploadOwnAvatar({ user, asset }) {
  if (!user?.id) {
    throw new Error(t("social.errors.signInToUpdatePhoto"));
  }

  if (!asset?.uri) {
    throw new Error(t("social.errors.pickImageFirst"));
  }

  if (asset.fileSize && asset.fileSize > PROFILE_AVATAR_MAX_BYTES) {
    throw new Error(t("social.errors.photoTooLarge"));
  }

  await ensureOwnProfile(user);

  const response = await fetch(asset.uri);

  if (!response.ok) {
    throw new Error(t("social.errors.imageReadFailed"));
  }

  const avatarBuffer = await response.arrayBuffer();

  if (!avatarBuffer.byteLength) {
    throw new Error(t("social.errors.imageEmpty"));
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

  // The object path stays the same, so a cached signature would still point at
  // the picture that was just replaced.
  forgetAvatarUrl(avatarPath);

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

  return mapOwnProfileRow(updatedProfile, user.id);
}

export async function searchUsers({ query, currentUserId, limit = 20 }) {
  if (!currentUserId) {
    throw new Error(t("social.errors.signInToSearch"));
  }

  const normalizedQuery = buildSearchFilter(query ?? "");

  // Below the minimum the old query returned the entire user base in
  // display-name order, which is the enumeration the search function replaced.
  // Save the round trip and let the screen say so.
  if (normalizedQuery.length < USER_SEARCH_MIN_LENGTH) {
    return [];
  }

  // Not a table read: public.profiles no longer answers to a client that has no
  // relationship with the row. search_profiles is the one way past that, and it
  // is where blocked people are filtered out in both directions.
  const { data: profiles, error: profileError } = await supabase.rpc(
    "search_profiles",
    {
      search_query: normalizedQuery,
      result_limit: limit,
    }
  );

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

  return attachAvatarUrls(
    profiles.map((row) => mapProfileRow(row, followingIdSet))
  );
}

export async function getFollowCounts({ userId }) {
  if (!userId) {
    throw new Error(t("social.errors.missingUserFollowCounts"));
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

/**
 * How many people started following `userId` after `since` (a timestamp in
 * ms) - the badge on Explore's social button. Zero without a user or a time.
 */
export async function countFollowersSince({ userId, since }) {
  if (!userId || !Number.isFinite(since)) {
    return 0;
  }

  const { count, error } = await supabase
    .from(USER_FOLLOWS_TABLE)
    .select("*", { count: "exact", head: true })
    .eq("following_id", userId)
    .gt("created_at", new Date(since).toISOString());

  if (error) {
    throw normalizeSocialError(error);
  }

  return count ?? 0;
}

export async function getFollowers({
  userId,
  currentUserId,
  limit = 50,
}) {
  if (!userId) {
    throw new Error(t("social.errors.missingUserFollowers"));
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
    throw new Error(t("social.errors.missingUserFollowing"));
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
    throw new Error(t("social.errors.signInToLoadCircle"));
  }

  // The viewer's own centre is what marks a friend's centre line orange. It
  // is fetched alongside the rest and is allowed to fail: without it every
  // centre simply reads as somebody else's.
  const [currentUserProfile, followingProfiles, homeGym] = await Promise.all([
    ensureOwnProfile(user),
    getFollowing({
      userId: user.id,
      currentUserId: user.id,
      limit,
    }),
    gymService.getMyHomeGym().catch(() => null),
  ]);
  const activityPreviewByUserId = await fetchActivityPreviewByUserId({
    userIds: followingProfiles.map((profile) => profile.id),
    date,
  });
  const homeGymId = homeGym?.id ?? null;

  const people = followingProfiles.map((profile) => {
    const preview =
      activityPreviewByUserId.get(profile.id) ?? createRestActivityPreview();

    return {
      ...profile,
      relationshipType: "following",
      ...preview,
      gym: preview.gym
        ? { ...preview.gym, isHomeGym: homeGymId !== null && preview.gym.id === homeGymId }
        : null,
    };
  });

  return {
    currentUser: currentUserProfile
      ? { ...currentUserProfile, homeGymId, homeGym }
      : currentUserProfile,
    // Unordered: FriendsActivity sorts, because the order is what the strip
    // wants rather than what the request produced.
    people,
  };
}

export async function followUser({ userId, targetUserId }) {
  if (!userId || !targetUserId) {
    throw new Error(t("social.errors.missingUserFollow"));
  }

  if (userId === targetUserId) {
    throw new Error(t("social.errors.followSelf"));
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
    throw new Error(t("social.errors.missingUserUnfollow"));
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

/* --------------------------------------------------------------- blocks -- */

export async function blockUser({ userId, targetUserId }) {
  if (!userId || !targetUserId) {
    throw new Error(t("social.errors.missingUserBlock"));
  }

  if (userId === targetUserId) {
    throw new Error(t("social.errors.blockSelf"));
  }

  // The follow rows in both directions are cut by a trigger on this insert, not
  // here: the client has no permission to delete the row where the other person
  // is the follower, which is the direction that matters.
  const { error } = await supabase.from(USER_BLOCKS_TABLE).insert({
    blocker_id: userId,
    blocked_id: targetUserId,
  });

  // 23505 is the row already being there, which is the state we wanted anyway.
  if (error && error.code !== "23505") {
    throw normalizeSocialError(error);
  }
}

/* -------------------------------------------------------------- reports -- */

/**
 * The reasons the report sheet offers. The values are the ones the database
 * constraint accepts, so adding one here without adding it there fails the
 * insert rather than storing something nobody will recognise later.
 */
// `labelKey` is what a translated screen shows. `label` translates the same
// key when it is read, for screens that print option.label - the same reason
// REJECTION_REASONS in gymService carries both.
export const REPORT_REASONS = [
  { value: "spam", labelKey: "social.report.reasons.spam", get label() { return t(this.labelKey); } },
  { value: "harassment", labelKey: "social.report.reasons.harassment", get label() { return t(this.labelKey); } },
  { value: "inappropriate", labelKey: "social.report.reasons.inappropriate", get label() { return t(this.labelKey); } },
  { value: "impersonation", labelKey: "social.report.reasons.impersonation", get label() { return t(this.labelKey); } },
  { value: "other", labelKey: "social.report.reasons.other", get label() { return t(this.labelKey); } },
];

export const REPORT_NOTE_MAX_LENGTH = 1000;

const REPORT_REASON_VALUES = new Set(
  REPORT_REASONS.map((reason) => reason.value)
);

/**
 * Report an account, or one post on it.
 *
 * `postId` is optional: without it the report is about the account, with it the
 * report is about that post. The post id is stored loose rather than as a
 * foreign key, so deleting the post does not delete the report - a report about
 * something that has since been taken down is the one worth keeping.
 */
export async function reportUser({
  userId,
  targetUserId,
  reason,
  note = "",
  postId = null,
}) {
  if (!userId || !targetUserId) {
    throw new Error(t("social.errors.missingUserReport"));
  }

  if (userId === targetUserId) {
    throw new Error(t("social.errors.reportSelf"));
  }

  if (!REPORT_REASON_VALUES.has(reason)) {
    throw new Error(t("social.errors.reportReasonRequired"));
  }

  const trimmedNote = String(note ?? "")
    .trim()
    .slice(0, REPORT_NOTE_MAX_LENGTH);

  const { error } = await supabase.from(USER_REPORTS_TABLE).insert({
    reporter_id: userId,
    reported_user_id: targetUserId,
    reported_post_id: postId ?? null,
    reason,
    note: trimmedNote,
  });

  if (error) {
    throw normalizeSocialError(error);
  }
}

export async function unblockUser({ userId, targetUserId }) {
  if (!userId || !targetUserId) {
    throw new Error(t("social.errors.missingUserUnblock"));
  }

  const { error } = await supabase
    .from(USER_BLOCKS_TABLE)
    .delete()
    .eq("blocker_id", userId)
    .eq("blocked_id", targetUserId);

  if (error) {
    throw normalizeSocialError(error);
  }
}

export async function getBlockedProfiles({ userId }) {
  if (!userId) {
    throw new Error(t("social.errors.signInToSeeBlocked"));
  }

  // Through a function, because once the follow is gone the blocked profile is
  // no longer readable through public.profiles - which is the profile policy
  // working, and would otherwise leave the unblock list showing blank rows.
  const { data, error } = await supabase.rpc("list_blocked_profiles");

  if (error) {
    throw normalizeSocialError(error);
  }

  return attachAvatarUrls(
    (data ?? []).map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      avatarPath: row.avatar_path ?? null,
      avatarUpdatedAt: row.created_at ?? null,
      avatarUrl: null,
      blockedAt: row.created_at ?? null,
    }))
  );
}

/* ------------------------------------------------------- privacy consent -- */

/**
 * Which version of the policy this user has agreed to, if any. Null means they
 * have never been asked, which the consent gate treats as outstanding.
 */
export async function getPrivacyConsent({ user }) {
  if (!user?.id) {
    return { version: null, acceptedAt: null };
  }

  const { data, error } = await supabase
    .from(PROFILE_PRIVATE_TABLE)
    .select(
      "privacy_policy_version, privacy_policy_accepted_at, terms_version, terms_accepted_at"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw normalizeSocialError(error);
  }

  return {
    version: data?.privacy_policy_version ?? null,
    acceptedAt: data?.privacy_policy_accepted_at ?? null,
    termsVersion: data?.terms_version ?? null,
    termsAcceptedAt: data?.terms_accepted_at ?? null,
  };
}

/**
 * Records acceptance of the privacy policy, the terms of use, or both.
 *
 * Both in one call because the gate asks for both on one screen: two writes
 * would leave a window where somebody has agreed to one and not the other, and
 * nothing in the app knows what to do with that state.
 */
export async function acceptPrivacyPolicy({ user, version, termsVersion }) {
  if (!user?.id) {
    throw new Error(t("social.errors.signInToAcceptPrivacy"));
  }

  if (!version && !termsVersion) {
    throw new Error(t("social.errors.missingPrivacyVersion"));
  }

  // The profile row has to exist first: profile_private is keyed on it, and a
  // brand new account reaches the consent screen before anything else has
  // touched the profile.
  await ensureOwnProfile(user);

  const acceptedAt = new Date().toISOString();
  const row = {
    user_id: user.id,
    updated_at: acceptedAt,
  };

  if (version) {
    row.privacy_policy_version = version;
    row.privacy_policy_accepted_at = acceptedAt;
  }

  if (termsVersion) {
    row.terms_version = termsVersion;
    row.terms_accepted_at = acceptedAt;
  }

  const { error } = await supabase
    .from(PROFILE_PRIVATE_TABLE)
    .upsert(row, { onConflict: "user_id" });

  if (error) {
    throw normalizeSocialError(error);
  }

  return { version, termsVersion, acceptedAt };
}
