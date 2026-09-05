import { supabase } from "../Database/supaBaseClient";

// Avatars used to be read with getPublicUrl(), which only works on a public
// bucket - and a public bucket serves every file without authentication, so the
// storage policies did not apply to reads at all. The path is
// `<user-uuid>/avatar`, every user id is readable by anyone with an account,
// and the URL never expires: one account was enough to collect a permanent,
// public link to every user's face.
//
// Signed URLs go through the authenticated endpoint, respect the policies and
// stop working after an hour, so a deleted avatar really does disappear.

export const AVATAR_BUCKET = "avatars";

const SIGNED_URL_TTL_SECONDS = 60 * 60;
// Re-signed a quarter of an hour before the URL actually lapses, so a list
// rendered from the cache cannot hand out a link that dies while it is on
// screen.
const CACHE_TTL_MS = (SIGNED_URL_TTL_SECONDS - 15 * 60) * 1000;

const signedUrlCache = new Map();

export function getAvatarObjectPath(userId) {
  return `${userId}/avatar`;
}

/**
 * Signs a batch of avatar paths in one request and returns them by path.
 * Paths that cannot be signed are simply absent, so a caller renders its own
 * placeholder rather than a broken image.
 */
export async function resolveAvatarUrls(avatarPaths = []) {
  const wanted = [...new Set(avatarPaths.filter(Boolean))];
  const resolved = new Map();

  if (!wanted.length) {
    return resolved;
  }

  const now = Date.now();
  const missing = [];

  for (const path of wanted) {
    const cached = signedUrlCache.get(path);

    if (cached && cached.expiresAt > now) {
      resolved.set(path, cached.url);
    } else {
      missing.push(path);
    }
  }

  if (!missing.length) {
    return resolved;
  }

  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrls(missing, SIGNED_URL_TTL_SECONDS);

  if (error) {
    // An avatar is decoration; failing to sign one must not fail the screen.
    console.warn("Could not sign avatar URLs:", error);
    return resolved;
  }

  for (const entry of data ?? []) {
    if (!entry?.signedUrl || entry.error) {
      continue;
    }

    signedUrlCache.set(entry.path, {
      url: entry.signedUrl,
      expiresAt: now + CACHE_TTL_MS,
    });
    resolved.set(entry.path, entry.signedUrl);
  }

  return resolved;
}

/** The signed URL already carries a query string, so the buster is appended. */
export function withAvatarCacheBuster(signedUrl, updatedAt) {
  if (!signedUrl || !updatedAt) {
    return signedUrl ?? null;
  }

  return `${signedUrl}&t=${encodeURIComponent(updatedAt)}`;
}

/**
 * Fills in `avatarUrl` on entities that carry an `avatarPath`, in one round
 * trip for the whole list. `pick` reaches the object holding the path when it
 * is nested, as it is on a post's author.
 */
export async function attachAvatarUrls(entities = [], pick = (entity) => entity) {
  const targets = entities.map(pick).filter(Boolean);
  const urls = await resolveAvatarUrls(targets.map((target) => target.avatarPath));

  for (const target of targets) {
    target.avatarUrl = withAvatarCacheBuster(
      urls.get(target.avatarPath) ?? null,
      target.avatarUpdatedAt
    );
  }

  return entities;
}

/** After an upload or a delete, so the next read signs the new object. */
export function forgetAvatarUrl(avatarPath) {
  if (avatarPath) {
    signedUrlCache.delete(avatarPath);
  }
}
