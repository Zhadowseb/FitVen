import * as SQLite from "expo-sqlite";

import {
  loginWithEmail,
  logout as logoutFromSupabase,
  registerWithEmail,
  supabase,
} from "../Database/supaBaseClient";
import { getDatabaseNameForUserId } from "../Database/localDatabase";

// The login, register and profile screens were the only three places in
// src/Pages that reached into src/Database directly, against the layer rule in
// src/AGENTS.md. This is the seam they go through now.

const DELETE_ACCOUNT_FUNCTION = "delete-account";
// web/reset-password/index.html. Kept in step with that page by npm test.
const PASSWORD_RESET_REDIRECT = "https://fitven.netlify.app/reset-password/";
// The local database file is still open when the account is deleted. The
// provider in App.js remounts on the auth change and closes it, but not before
// this returns, so the delete is retried a few times rather than raced.
const LOCAL_DATABASE_DELETE_ATTEMPTS = 4;
const LOCAL_DATABASE_DELETE_DELAY_MS = 350;

export function login({ email, password }) {
  return loginWithEmail({ email, password });
}

export function register({ email, password, usernameBase }) {
  return registerWithEmail({ email, password, usernameBase });
}

export function logout() {
  return logoutFromSupabase();
}

// A function error arrives as "non-2xx status code" with the real reason in a
// body nobody reads. The reason is the only useful part of it.
async function describeDeleteError(error) {
  const response = error?.context;

  if (typeof response?.text !== "function") {
    return error instanceof Error
      ? error
      : new Error("Could not delete the account.");
  }

  try {
    const body = (await response.text())?.trim();

    if (!body) {
      return error;
    }

    return new Error(
      `${DELETE_ACCOUNT_FUNCTION} failed (${
        response.status ?? "error"
      }): ${body.slice(0, 300)}`
    );
  } catch {
    return error;
  }
}

async function deleteLocalDatabaseForUser(userId) {
  const databaseName = getDatabaseNameForUserId(userId);

  for (let attempt = 1; attempt <= LOCAL_DATABASE_DELETE_ATTEMPTS; attempt++) {
    try {
      await SQLite.deleteDatabaseAsync(databaseName);
      return true;
    } catch (error) {
      if (attempt === LOCAL_DATABASE_DELETE_ATTEMPTS) {
        // The cloud account is already gone by this point, so this is cleanup,
        // not the deletion itself. Losing it leaves an orphaned file for one
        // user id that can never be signed into again.
        console.warn("Could not remove the local database file:", error);
        return false;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, LOCAL_DATABASE_DELETE_DELAY_MS)
      );
    }
  }

  return false;
}

/**
 * GDPR art. 17. Erases the account in the cloud, signs out, and removes this
 * device's copy. There is no undo and no grace period - if one is ever wanted,
 * it belongs in the Edge Function, not here.
 */
export async function deleteAccount({ user } = {}) {
  if (!user?.id) {
    throw new Error("You need to be signed in to delete your account.");
  }

  const userId = user.id;
  const { data, error } = await supabase.functions.invoke(
    DELETE_ACCOUNT_FUNCTION,
    { body: {} }
  );

  if (error) {
    throw await describeDeleteError(error);
  }

  // Sign out before the file: the provider has to let go of the database
  // before it can be deleted, and it only does that on the auth change.
  await logoutFromSupabase();

  const localDatabaseRemoved = await deleteLocalDatabaseForUser(userId);

  return {
    deletedRows: data?.deletedRows ?? {},
    removedFileCount: data?.removedFileCount ?? 0,
    localDatabaseRemoved,
  };
}

/**
 * Sends the "set a new password" email.
 *
 * The link in it lands on a web page, not back in the app. It has to work from
 * whatever the person opens their mail in, on a phone that may no longer have
 * FitVen on it - a deep link would need the scheme registered, the app present
 * and the right build, which is three ways to leave somebody locked out.
 *
 * Supabase has to allow PASSWORD_RESET_REDIRECT under Authentication - URL
 * Configuration - Redirect URLs, or it refuses to send anyone there.
 */
export async function requestPasswordReset({ email }) {
  const normalizedEmail = String(email ?? "").trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error("Enter your email address first.");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: PASSWORD_RESET_REDIRECT,
  });

  if (error) {
    throw error;
  }
}
