// When somebody last looked at something, kept on the phone: Explore counts
// what is new since then - followers since the Social page, records since the
// centre's page. A per-user key, so a second account on the same phone does
// not inherit the first one's "new".
//
// Storage can be missing or refuse (a fresh install, a full disk). Then there
// is simply no "last seen", which reads as nothing new - never as an error.
import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "fitven.lastSeen.";

export async function getLastSeen(key) {
  try {
    const value = Number(await AsyncStorage.getItem(PREFIX + key));

    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export async function markSeen(key, at = Date.now()) {
  try {
    await AsyncStorage.setItem(PREFIX + key, String(at));
  } catch {
    // Nothing to do: next time it is simply not new.
  }
}

/**
 * The last visit, or - the first time - now, stored, so that everything that
 * already exists is not suddenly "new".
 */
export async function getLastSeenOrStart(key, now = Date.now()) {
  const seen = await getLastSeen(key);

  if (seen !== null) {
    return seen;
  }

  await markSeen(key, now);
  return now;
}

export const socialSeenKey = (userId) => `social:${userId}`;
export const gymSeenKey = (userId, gymId) => `gym:${userId}:${gymId}`;
