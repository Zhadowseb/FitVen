// Records that the app was opened: when, on which platform and in which
// version, on your own profile_private row. The developer overview counts
// active users and the versions in use from it. src/Sync/AppOpenSync.js calls
// this on launch and on every return to the foreground; the rules for how
// often live in @utils/appOpen.
//
// Only for someone who has accepted the privacy policy this build carries.
// The consent gate asks for it after launch, and this runs at launch, so
// without the check it would record the first open of anybody who has not yet
// agreed to a policy that mentions it. It is part of the same request - an
// update that matches no row when the accepted version is another one - so it
// costs nothing extra. It is also why this is an update rather than an upsert:
// accepting the policy is what creates the row, so there is always one to
// update when there is anything to record.
//
// Every failure is quiet. It is a count on a developer's screen, not something
// the person using the app should ever notice.
import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "@database/supaBaseClient";
import {
  getAppOpenStorageKey,
  isMissingAppOpenColumnError,
  normalizeAppOpenPlatform,
  normalizeAppVersionForCloud,
  parseLastRecordedAt,
  shouldRecordAppOpen,
} from "@utils/appOpen";

const PROFILE_PRIVATE_TABLE = "profile_private";

// The columns come with 20261001090000_dev-kpis.sql. Until it has run, the
// first write says so, and it is not tried again this session.
let appOpenColumnsMissing = false;

async function readLastRecordedAt(storageKey) {
  try {
    return parseLastRecordedAt(await AsyncStorage.getItem(storageKey));
  } catch {
    return null;
  }
}

async function writeLastRecordedAt(storageKey, time) {
  try {
    await AsyncStorage.setItem(storageKey, String(time));
  } catch {
    // Recorded anyway; the next open may record once more than it needed to.
  }
}

/**
 * Writes `last_opened_at`, `last_opened_platform` and `last_app_version`
 * when the last write from this phone for this user is more than an hour old.
 *
 * `platform` is `Platform.OS`, and `appVersion` is feedbackService's
 * getAppVersion(), so the versions in use and the bug reports read the same.
 *
 * Resolves to `{ recorded: true }`, or `{ recorded: false, reason }` for a
 * write that was not needed or not allowed. Throws only when the request
 * itself failed - offline, say - and then nothing is remembered, so the next
 * return to the foreground tries again.
 */
export async function recordAppOpen({
  userId,
  platform,
  appVersion,
  privacyPolicyVersion,
  now = Date.now(),
}) {
  if (!userId) {
    return { recorded: false, reason: "signed_out" };
  }

  const openedOn = normalizeAppOpenPlatform(platform);

  if (!openedOn) {
    return { recorded: false, reason: "platform" };
  }

  if (!privacyPolicyVersion) {
    return { recorded: false, reason: "no_policy_version" };
  }

  if (appOpenColumnsMissing) {
    return { recorded: false, reason: "missing_columns" };
  }

  const storageKey = getAppOpenStorageKey(userId);
  const lastRecordedAt = await readLastRecordedAt(storageKey);

  if (!shouldRecordAppOpen({ lastRecordedAt, now })) {
    return { recorded: false, reason: "recently_recorded" };
  }

  const { data, error } = await supabase
    .from(PROFILE_PRIVATE_TABLE)
    .update({
      last_opened_at: new Date(now).toISOString(),
      last_opened_platform: openedOn,
      last_app_version: normalizeAppVersionForCloud(appVersion),
    })
    .eq("user_id", userId)
    .eq("privacy_policy_version", privacyPolicyVersion)
    .select("user_id");

  if (error) {
    if (isMissingAppOpenColumnError(error)) {
      appOpenColumnsMissing = true;
      return { recorded: false, reason: "missing_columns" };
    }

    throw error;
  }

  // Not accepted yet - the gate is on screen. Nothing is remembered, so the
  // next launch or return to the foreground asks again, by when it usually has
  // been.
  if (!data?.length) {
    return { recorded: false, reason: "policy_not_accepted" };
  }

  await writeLastRecordedAt(storageKey, now);
  return { recorded: true };
}
