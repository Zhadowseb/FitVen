import AsyncStorage from "@react-native-async-storage/async-storage";

// Which articles somebody has opened, on this phone. A small set of ids per
// signed-in person: an article counts as read once it has been opened, which is
// what takes its NEW label away.

const storageKey = (userId) => `fitven.knowledge.read.${userId ?? "anonymous"}`;

export async function getReadArticleIds(userId) {
  try {
    const stored = await AsyncStorage.getItem(storageKey(userId));
    const ids = stored ? JSON.parse(stored) : [];

    return new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : []);
  } catch (error) {
    console.warn("Could not read which articles have been opened:", error);

    return new Set();
  }
}

/** Remembers that the article was opened, and returns the set of all that were. */
export async function markArticleRead(userId, articleId) {
  const ids = await getReadArticleIds(userId);

  if (ids.has(articleId)) {
    return ids;
  }

  ids.add(articleId);

  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify([...ids]));
  } catch (error) {
    console.warn("Could not remember that the article was opened:", error);
  }

  return ids;
}
