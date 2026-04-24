import { supabase } from "../Database/supaBaseClient";
import {
  buildFullUsername,
  formatUsernameCode,
  normalizeUsernameBaseInput,
  slugifyUsernameBase,
  splitFullUsername,
  USERNAME_CODE_LENGTH,
  USERNAME_BASE_PATTERN,
} from "../Utils/socialUsername";

const PROFILES_TABLE = "profiles";
const USER_FOLLOWS_TABLE = "user_follows";
const SOCIAL_SETUP_MESSAGE =
  "User search and follows are not set up in Supabase yet. Run docs/supabase-social-search.sql in the Supabase SQL editor first.";
export const PROFILE_DISPLAY_NAME_MAX_LENGTH = 40;
export const PROFILE_BIO_MAX_LENGTH = 160;
const USERNAME_INSERT_RETRY_LIMIT = 3;

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

  return {
    id: row.id,
    username:
      row.username ?? buildFullUsername(usernameBase, usernameCode),
    usernameBase,
    usernameCode,
    displayName: row.display_name,
    bio: row.bio ?? "",
    createdAt: row.created_at ?? null,
    isFollowing: followingIdSet.has(row.id),
  };
}

function isMissingSocialSchemaError(error) {
  const message = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  return (
    error?.code === "42P01" ||
    error?.code === "42703" ||
    (message.includes("profiles") && message.includes("does not exist")) ||
    (message.includes("user_follows") && message.includes("does not exist")) ||
    (message.includes("username_base") && message.includes("does not exist")) ||
    (message.includes("username_code") && message.includes("does not exist"))
  );
}

function normalizeSocialError(error) {
  if (isMissingSocialSchemaError(error)) {
    return new Error(SOCIAL_SETUP_MESSAGE);
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
    .select(
      "id, username, username_base, username_code, display_name, bio, created_at"
    )
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
      .select(
        "id, username, username_base, username_code, display_name, bio, created_at"
      )
      .single();

    if (!insertError) {
      return mapProfileRow(insertedProfile);
    }

    if (insertError.code !== "23505") {
      throw normalizeSocialError(insertError);
    }

    const { data: refetchedProfile, error: refetchError } = await supabase
      .from(PROFILES_TABLE)
      .select(
        "id, username, username_base, username_code, display_name, bio, created_at"
      )
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
    .select(
      "id, username, username_base, username_code, display_name, bio, created_at"
    )
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

export async function searchUsers({ query, currentUserId, limit = 20 }) {
  if (!currentUserId) {
    throw new Error("You need to be signed in to search for users.");
  }

  const normalizedQuery = buildSearchFilter(query ?? "");
  let profilesQuery = supabase
    .from(PROFILES_TABLE)
    .select(
      "id, username, username_base, username_code, display_name, bio, created_at"
    )
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

  const profileIds = profiles.map((profile) => profile.id);
  const { data: followRows, error: followError } = await supabase
    .from(USER_FOLLOWS_TABLE)
    .select("following_id")
    .eq("follower_id", currentUserId)
    .in("following_id", profileIds);

  if (followError) {
    throw normalizeSocialError(followError);
  }

  const followingIdSet = new Set(
    (followRows ?? []).map((row) => row.following_id)
  );

  return profiles.map((row) => mapProfileRow(row, followingIdSet));
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
