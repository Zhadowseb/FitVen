import { Platform } from "react-native";
import "react-native-url-polyfill/auto";
import "expo-sqlite/localStorage/install";
import { createClient, processLock } from '@supabase/supabase-js';

import {
  forgetLegacyPlaintextSession,
  secureSessionStorage,
} from "./secureSessionStorage";

import {
  isValidUsernameBase,
  normalizeUsernameBaseInput,
} from "../Utils/socialUsername";

const supabaseUrl = 'https://tgfeedchhogerswntuvy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnZmVlZGNoaG9nZXJzd250dXZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzODAwMjcsImV4cCI6MjA4OTk1NjAyN30.yKXLdHRx64c_TqY9dmZPFjG2tYRlOx_t4QDrlBc9WfQ';

const NETWORK_RETRYABLE_MESSAGES = [
  "Network request failed",
  "Failed to fetch",
  "NetworkError",
];

const delay = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

function isRetryableNetworkError(error) {
  const message = String(error?.message ?? error ?? "");

  return NETWORK_RETRYABLE_MESSAGES.some((candidate) =>
    message.includes(candidate)
  );
}

async function retryingFetch(input, init) {
  let latestError = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error) {
      latestError = error;

      if (!isRetryableNetworkError(error) || attempt === 2) {
        throw error;
      }

      await delay(400 * (attempt + 1));
    }
  }

  throw latestError;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: retryingFetch,
  },
  auth: {
    ...(Platform.OS !== "web"
      ? { storage: secureSessionStorage }
      : { storage: globalThis.localStorage }),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
});

// Once, at startup. Moving the session behind the keystore achieves nothing
// while the readable copy the old version wrote is still sitting next to it.
// Native only: on web the session lives in localStorage under the same key, and
// AsyncStorage is localStorage, so this would delete the live session.
if (Platform.OS !== "web") {
  void forgetLegacyPlaintextSession();
}

export async function registerWithEmail({ email, password, usernameBase }) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsernameBase = normalizeUsernameBaseInput(usernameBase);

  if (!isValidUsernameBase(normalizedUsernameBase)) {
    throw new Error(
      "Username must be 3-20 characters and use only lowercase letters, numbers or underscores."
    );
  }

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        username_base: normalizedUsernameBase,
        username: normalizedUsernameBase,
        display_name: normalizedUsernameBase,
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function loginWithEmail({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function logout() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

/* ------------------------------------------------ the signed-in user's id -- */

// Kept here because it is asked for on a path that runs once a second while
// somebody is training, to look up which columns they want visible.
//
// It used to be `auth.getUser()`, which is not a local read: auth-js sends
// GET /auth/v1/user and takes a process lock on the way. That is roughly 3,600
// HTTP calls per hour of training, on a code path that is otherwise entirely
// offline, competing with the token refresh for the same lock - and the fetch
// wrapper above retries each one up to three times on a bad connection.
//
// getSession() reads the stored session instead. It does not revalidate the
// token with the server, which is fine for this: the id decides which local
// preference rows to read, and everything that actually matters is enforced by
// row-level security on the server anyway.
let cachedUserId = null;
let hasCachedUserId = false;

// One subscription for the life of the process. INITIAL_SESSION fires on
// startup, so this warms itself; SIGNED_IN and SIGNED_OUT keep it honest.
supabase.auth.onAuthStateChange((_event, session) => {
  cachedUserId = session?.user?.id ?? null;
  hasCachedUserId = true;
});

/**
 * The signed-in user's id, or null. Local, and after the first call it does not
 * touch storage either.
 */
export async function getCurrentUserId() {
  if (hasCachedUserId) {
    return cachedUserId;
  }

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  // Not marked as cached: the subscription above is what makes it authoritative,
  // and it may not have fired yet.
  return data.session?.user?.id ?? null;
}
