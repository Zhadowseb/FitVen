// Covers the chunking in src/Database/secureSessionStorage.js.
//
// This is where the Supabase session is written and read on every launch and
// every token refresh. Getting it wrong does not fail loudly - it signs
// everybody out, or worse, hands back half a session - and a device is the only
// place it otherwise runs. So the store underneath it is faked and the adapter
// is driven directly.

const assert = require("assert");
const loadAppModule = require("./lib/loadAppModule");

/* ------------------------------------------------------- the fake stores -- */

function createFakeSecureStore({ available = true } = {}) {
  const values = new Map();

  return {
    values,
    isAvailableAsync: async () => available,
    getItemAsync: async (key) => (values.has(key) ? values.get(key) : null),
    setItemAsync: async (key, value) => {
      // The real one rejects anything outside this character set, so a bad key
      // has to fail here too or the test proves nothing about the device.
      assert.ok(
        /^[A-Za-z0-9._-]+$/.test(key),
        `secure store key "${key}" uses characters the platform rejects`
      );
      // Values past 2048 bytes may not be storable at all on Android.
      assert.ok(
        Buffer.byteLength(String(value), "utf8") <= 2048,
        `secure store value for "${key}" is ${Buffer.byteLength(
          String(value),
          "utf8"
        )} bytes, past the 2048 limit`
      );
      values.set(key, String(value));
    },
    deleteItemAsync: async (key) => {
      values.delete(key);
    },
  };
}

function createFakeAsyncStorage(initial = {}) {
  const values = new Map(Object.entries(initial));

  return {
    values,
    getItem: async (key) => (values.has(key) ? values.get(key) : null),
    setItem: async (key, value) => {
      values.set(key, String(value));
    },
    removeItem: async (key) => {
      values.delete(key);
    },
    getAllKeys: async () => [...values.keys()],
    multiRemove: async (keys) => {
      for (const key of keys) values.delete(key);
    },
  };
}

function load({ secureStore, asyncStorage }) {
  loadAppModule.stubModule("expo-secure-store", secureStore);
  loadAppModule.stubModule("@react-native-async-storage/async-storage", {
    default: asyncStorage,
    __esModule: true,
  });

  return loadAppModule("src/Database/secureSessionStorage.js");
}

const SESSION_KEY = "sb-tgfeedchhogerswntuvy-auth-token";

// Roughly the shape of a real one: two signed tokens and a user object, well
// past what a single secure store entry holds.
function buildSession(sizeInCharacters) {
  return JSON.stringify({
    access_token: "a".repeat(Math.max(0, sizeInCharacters - 200)),
    refresh_token: "r".repeat(64),
    expires_at: 1_775_000_000,
    user: { id: "1f2e3d4c-0000-0000-0000-000000000000", email: "x@y.z" },
  });
}

/* -------------------------------------------------------- the round trip -- */

async function run() {
  {
    const secureStore = createFakeSecureStore();
    const asyncStorage = createFakeAsyncStorage();
    const { secureSessionStorage } = load({ secureStore, asyncStorage });

    assert.strictEqual(
      await secureSessionStorage.getItem(SESSION_KEY),
      null,
      "nothing stored reads as null, not as an empty session"
    );

    // A real session, and the sizes either side of a chunk boundary.
    for (const size of [1, 399, 400, 401, 800, 3000, 12000]) {
      const session = buildSession(size);

      await secureSessionStorage.setItem(SESSION_KEY, session);
      assert.strictEqual(
        await secureSessionStorage.getItem(SESSION_KEY),
        session,
        `a ${session.length} character session did not survive the round trip`
      );
    }

    // Multi-byte characters: the split is by character, so a chunk of 400 of
    // these is 1,600 bytes. The fake store asserts the byte ceiling.
    const emojiSession = JSON.stringify({ note: "🏋️".repeat(900) });
    await secureSessionStorage.setItem(SESSION_KEY, emojiSession);
    assert.strictEqual(
      await secureSessionStorage.getItem(SESSION_KEY),
      emojiSession,
      "a session full of multi-byte characters did not survive"
    );
  }

  /* ------------------------------------------- shrinking and clearing -- */

  {
    const secureStore = createFakeSecureStore();
    const asyncStorage = createFakeAsyncStorage();
    const { secureSessionStorage } = load({ secureStore, asyncStorage });

    const long = buildSession(5000);
    const short = buildSession(300);

    await secureSessionStorage.setItem(SESSION_KEY, long);
    await secureSessionStorage.setItem(SESSION_KEY, short);

    assert.strictEqual(
      await secureSessionStorage.getItem(SESSION_KEY),
      short,
      "the shorter session reads back whole"
    );
    // The failure this catches: leftover pieces of the long value still in the
    // store, which read back as a Frankenstein session the moment the count
    // grows again.
    assert.strictEqual(
      secureStore.values.size,
      2,
      `the tail of the long session was left behind: ${[
        ...secureStore.values.keys(),
      ].join(", ")}`
    );

    await secureSessionStorage.removeItem(SESSION_KEY);
    assert.strictEqual(
      secureStore.values.size,
      0,
      "signing out left something behind in secure storage"
    );
    assert.strictEqual(await secureSessionStorage.getItem(SESSION_KEY), null);
  }

  /* --------------------------------------------------- a torn value -- */

  {
    const secureStore = createFakeSecureStore();
    const asyncStorage = createFakeAsyncStorage();
    const { secureSessionStorage } = load({ secureStore, asyncStorage });

    await secureSessionStorage.setItem(SESSION_KEY, buildSession(3000));
    secureStore.values.delete(`${SESSION_KEY}.3`);

    // Half a session is not a session. It has to read as nothing, so the user
    // signs in again, rather than as a truncated string Supabase tries to parse.
    assert.strictEqual(
      await secureSessionStorage.getItem(SESSION_KEY),
      null,
      "a missing piece has to read as no session at all"
    );
    assert.strictEqual(
      secureStore.values.size,
      0,
      "the remains of a torn session were not cleared"
    );
  }

  /* ------------------------------------------ no keystore on the device -- */

  {
    const secureStore = createFakeSecureStore({ available: false });
    const asyncStorage = createFakeAsyncStorage();
    const { secureSessionStorage } = load({ secureStore, asyncStorage });

    const session = buildSession(3000);

    await secureSessionStorage.setItem(SESSION_KEY, session);

    // Falls back rather than throwing: being unable to sign in at all is worse
    // than the storage this replaced.
    assert.strictEqual(
      await secureSessionStorage.getItem(SESSION_KEY),
      session,
      "the fallback has to keep the session usable"
    );
    assert.strictEqual(
      secureStore.values.size,
      0,
      "nothing should reach a secure store that reports itself unavailable"
    );
  }

  /* ------------------------------------------ clearing the old plaintext -- */

  {
    const secureStore = createFakeSecureStore();
    const asyncStorage = createFakeAsyncStorage({
      [SESSION_KEY]: buildSession(3000),
      [`${SESSION_KEY}-code-verifier`]: "abc",
      "fitven:workout-summary-post-mode:1": "full_info",
      "fitven:theme-preference": "dark",
    });
    const { forgetLegacyPlaintextSession } = load({
      secureStore,
      asyncStorage,
    });

    await forgetLegacyPlaintextSession();

    assert.deepStrictEqual(
      [...asyncStorage.values.keys()].sort(),
      ["fitven:theme-preference", "fitven:workout-summary-post-mode:1"],
      "it has to take the session keys and nothing else"
    );
  }

  console.log("Secure session storage checks passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
