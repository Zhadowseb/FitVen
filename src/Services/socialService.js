import { supabase } from "../Database/supaBaseClient";

const PROFILES_TABLE = "profiles";
const USER_FOLLOWS_TABLE = "user_follows";
const SOCIAL_SETUP_MESSAGE =
  "User search and follows are not set up in Supabase yet. Run docs/supabase-social-search.sql in the Supabase SQL editor first.";
export const PROFILE_DISPLAY_NAME_MAX_LENGTH = 40;
export const PROFILE_BIO_MAX_LENGTH = 160;

function slugifyUsername(value) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
}

function createFallbackUsername(user) {
  const preferredUsername = slugifyUsername(
    user?.user_metadata?.username ??
      user?.user_metadata?.display_name ??
      user?.email?.split("@")[0] ??
      "user"
  );
  const suffix = (user?.id ?? "user").replace(/-/g, "").slice(-6);
  const base = (preferredUsername || "user").slice(0, Math.max(3, 20 - suffix.length - 1));
  return `${base}_${suffix}`.slice(0, 20);
}

function createFallbackDisplayName(user, username) {
  const metadataDisplayName = user?.user_metadata?.display_name?.trim();
  if (metadataDisplayName) {
    return metadataDisplayName;
  }

  const emailName = user?.email?.split("@")[0]?.trim();
  if (emailName) {
    return emailName;
  }

  return username;
}

function mapProfileRow(row, followingIdSet = new Set()) {
  return {
    id: row.id,
    username: row.username,
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
    (message.includes("profiles") && message.includes("does not exist")) ||
    (message.includes("user_follows") && message.includes("does not exist"))
  );
}

function normalizeSocialError(error) {
  if (isMissingSocialSchemaError(error)) {
    return new Error(SOCIAL_SETUP_MESSAGE);
  }

  return error;
}

function buildSearchFilter(query) {
  return query.replace(/[,%()]/g, " ").trim();
}

function normalizeProfileValues({ displayName, bio }) {
  return {
    displayName: (displayName ?? "").trim(),
    bio: (bio ?? "").trim(),
  };
}

export async function ensureOwnProfile(user) {
  if (!user?.id) {
    throw new Error("You need to be signed in to load social data.");
  }

  const { data: existingProfile, error: fetchError } = await supabase
    .from(PROFILES_TABLE)
    .select("id, username, display_name, bio, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (fetchError) {
    throw normalizeSocialError(fetchError);
  }

  if (existingProfile) {
    return mapProfileRow(existingProfile);
  }

  const username = createFallbackUsername(user);
  const displayName = createFallbackDisplayName(user, username);

  const { data: insertedProfile, error: insertError } = await supabase
    .from(PROFILES_TABLE)
    .insert({
      id: user.id,
      username,
      display_name: displayName,
      bio: "",
    })
    .select("id, username, display_name, bio, created_at")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: refetchedProfile, error: refetchError } = await supabase
        .from(PROFILES_TABLE)
        .select("id, username, display_name, bio, created_at")
        .eq("id", user.id)
        .single();

      if (refetchError) {
        throw normalizeSocialError(refetchError);
      }

      return mapProfileRow(refetchedProfile);
    }

    throw normalizeSocialError(insertError);
  }

  return mapProfileRow(insertedProfile);
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
    .select("id, username, display_name, bio, created_at")
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
    .select("id, username, display_name, bio, created_at")
    .neq("id", currentUserId)
    .order("display_name", { ascending: true })
    .limit(limit);

  if (normalizedQuery.length > 0) {
    profilesQuery = profilesQuery.or(
      `username.ilike.%${normalizedQuery}%,display_name.ilike.%${normalizedQuery}%`
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
