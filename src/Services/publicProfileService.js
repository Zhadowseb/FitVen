// Somebody else's profile: the page a name opens, and your own seen the way
// others see it.
//
// A stranger's profile row is not readable. public.profiles and
// public.user_follows only answer to the people a row involves (see
// supabase/migrations/20260905143000_user-blocks.sql), so everything but the
// posts comes through one security definer function, `public_profile`, which
// hands out a fixed set of fields and answers null for a block either way.
// The posts are read from social_post under its own policies, like the feed.
import { supabase } from "../Database/supaBaseClient";
import { attachAvatarUrls } from "./avatarUrls";
import { getWorkoutSummaryPostsByAuthor } from "./socialPostService";
import {
  PROFILE_POST_GRID_SIZE,
  mapPublicProfile,
} from "../Utils/publicProfileUtils";

// A database that has not had 20260927100000_public-profiles.sql run yet: the
// function, or a column it reads, is not there. PostgREST names a function it
// cannot find PGRST202 and a column PGRST204; Postgres itself says 42883 and
// 42703.
const MISSING_SCHEMA_CODES = new Set(["42883", "42703", "PGRST202", "PGRST204"]);

function isMissingSchemaError(error) {
  return MISSING_SCHEMA_CODES.has(String(error?.code ?? ""));
}

/**
 * The profile of `userId` as the signed-in viewer may see it: name, username,
 * avatar, bio, centre, counts, weekly activity, records and whether the viewer
 * follows them. Null when there is no such profile, when either of the two has
 * blocked the other - the function does not say which - and while the
 * migration has not been run, which the page shows as "not available".
 */
export async function getPublicProfile({ userId }) {
  if (!userId) {
    return null;
  }

  const { data, error } = await supabase.rpc("public_profile", {
    target_user_id: userId,
  });

  if (error) {
    if (isMissingSchemaError(error)) {
      console.warn(
        "Profiles cannot be opened yet: run supabase/migrations/20260927100000_public-profiles.sql.",
        error.message ?? error
      );
      return null;
    }

    // As PostgREST gave it: the page logs it and says the profile could not
    // be loaded in the user's own language.
    throw error;
  }

  const profile = mapPublicProfile(data);

  if (profile) {
    await attachAvatarUrls([profile]);
  }

  return profile;
}

/**
 * Their newest posts, and how many the viewer may see in all - the grid and
 * the "See all {n}" behind it. `preview` narrows your own posts to the ones a
 * stranger sees; for anybody else the post policies already do that.
 *
 * The authors come back as the posts' own join has them, which is nobody for
 * a stranger. `withProfileAuthor` in Utils/publicProfileUtils.js puts the
 * profile's name and picture on them where a card shows it.
 */
export async function getPublicProfilePosts({
  user,
  userId,
  limit = PROFILE_POST_GRID_SIZE,
  offset = 0,
  preview = false,
}) {
  if (!user?.id || !userId) {
    return { posts: [], total: 0 };
  }

  return getWorkoutSummaryPostsByAuthor({
    user,
    authorId: userId,
    limit,
    offset,
    everyoneOnly: preview,
  });
}
