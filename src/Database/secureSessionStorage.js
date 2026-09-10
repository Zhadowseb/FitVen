// Where the Supabase session lives on the device.
//
// It used to be AsyncStorage, which on Android is an unencrypted SQLite file in
// the app's data directory. That is out of reach on a normal phone, but not on
// a rooted one, and not in a full-device backup - and what sits there is a
// refresh token, which is a working key to the account until it is rotated.
// expo-secure-store puts it behind the Android Keystore and the iOS Keychain
// instead.
//
// Two things make this more than a one-line swap.
//
// SecureStore is a key/value store meant for small secrets: a value over 2048
// bytes may not be storable at all. A Supabase session is a signed JWT plus a
// refresh token plus the user object, comfortably past that. So a value is
// split across numbered entries with a count stored under the original key.
//
// And it can be unavailable - no hardware keystore, a device policy, an
// emulator image without it. Failing to sign in at all is a worse outcome than
// the storage this replaces, so it falls back rather than throws, once, loudly.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

// Under the 2048-byte ceiling with room for multi-byte characters: the split is
// by character, and a character can cost up to four bytes.
const MAX_CHUNK_LENGTH = 400;
const MAX_CHUNKS = 64;

let secureStoreAvailable = null;

async function isSecureStoreUsable() {
  if (secureStoreAvailable !== null) {
    return secureStoreAvailable;
  }

  try {
    secureStoreAvailable = await SecureStore.isAvailableAsync();
  } catch {
    secureStoreAvailable = false;
  }

  if (!secureStoreAvailable) {
    console.warn(
      "expo-secure-store is unavailable on this device; the session falls back to unencrypted storage."
    );
  }

  return secureStoreAvailable;
}

function chunkKey(key, index) {
  return `${key}.${index}`;
}

async function readChunkCount(key) {
  const raw = await SecureStore.getItemAsync(key);

  if (raw === null || raw === undefined) {
    return 0;
  }

  const count = Number(raw);

  return Number.isInteger(count) && count > 0 && count <= MAX_CHUNKS
    ? count
    : 0;
}

async function removeChunksFrom(key, firstIndex, lastIndex) {
  for (let index = firstIndex; index < lastIndex; index += 1) {
    await SecureStore.deleteItemAsync(chunkKey(key, index));
  }
}

async function secureGetItem(key) {
  const count = await readChunkCount(key);

  if (count === 0) {
    return null;
  }

  const parts = [];

  for (let index = 0; index < count; index += 1) {
    const part = await SecureStore.getItemAsync(chunkKey(key, index));

    // A missing piece means a half-written or half-deleted value. There is no
    // useful repair - a truncated session is not a session - so clear it and
    // report nothing stored, which signs the user in again.
    if (part === null || part === undefined) {
      await secureRemoveItem(key);
      return null;
    }

    parts.push(part);
  }

  return parts.join("");
}

async function secureSetItem(key, value) {
  const text = String(value ?? "");
  const chunks = [];

  for (let start = 0; start < text.length; start += MAX_CHUNK_LENGTH) {
    chunks.push(text.slice(start, start + MAX_CHUNK_LENGTH));
  }

  if (chunks.length === 0) {
    chunks.push("");
  }

  if (chunks.length > MAX_CHUNKS) {
    throw new Error(
      `Session value is ${text.length} characters, past what secure storage holds.`
    );
  }

  const previousCount = await readChunkCount(key);

  for (let index = 0; index < chunks.length; index += 1) {
    await SecureStore.setItemAsync(chunkKey(key, index), chunks[index]);
  }

  // The count goes in last, so a write interrupted halfway leaves the old value
  // readable rather than a mixture of old and new pieces.
  await SecureStore.setItemAsync(key, String(chunks.length));

  // A shorter value than last time leaves the tail behind otherwise.
  if (previousCount > chunks.length) {
    await removeChunksFrom(key, chunks.length, previousCount);
  }
}

async function secureRemoveItem(key) {
  const count = await readChunkCount(key);

  await SecureStore.deleteItemAsync(key);
  await removeChunksFrom(key, 0, Math.max(count, 1));
}

/**
 * The storage adapter handed to the Supabase client. The shape is the one
 * `@supabase/supabase-js` expects: three methods, all returning promises.
 */
export const secureSessionStorage = {
  async getItem(key) {
    if (!(await isSecureStoreUsable())) {
      return AsyncStorage.getItem(key);
    }

    try {
      return await secureGetItem(key);
    } catch (error) {
      console.warn("Could not read the session from secure storage:", error);
      return null;
    }
  },

  async setItem(key, value) {
    if (!(await isSecureStoreUsable())) {
      return AsyncStorage.setItem(key, value);
    }

    try {
      await secureSetItem(key, value);
    } catch (error) {
      // Swallowed on purpose. Supabase calls this on every token refresh, and
      // throwing here takes down the request that triggered the refresh. The
      // cost of losing the write is signing in again.
      console.warn("Could not write the session to secure storage:", error);
    }
  },

  async removeItem(key) {
    if (!(await isSecureStoreUsable())) {
      return AsyncStorage.removeItem(key);
    }

    try {
      await secureRemoveItem(key);
    } catch (error) {
      console.warn("Could not clear the session from secure storage:", error);
    }
  },
};

/**
 * Deletes the plaintext session left in AsyncStorage by earlier versions.
 *
 * Nothing is migrated across. The point of the change is that those tokens have
 * been sitting readable on disk, so they are treated as spent: everybody signs
 * in once more, and the tokens that replace them only ever exist behind the
 * keystore. Leaving the old copy in place would undo the whole exercise.
 */
export async function forgetLegacyPlaintextSession() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const sessionKeys = keys.filter((key) => /^sb-.+-auth-token/.test(key));

    if (sessionKeys.length > 0) {
      await AsyncStorage.multiRemove(sessionKeys);
    }
  } catch (error) {
    console.warn("Could not clear the old plaintext session:", error);
  }
}
