import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { t } from "@localization";

import { supabase } from "../Database/supaBaseClient";
import {
  CHEER_PRESET_CUSTOM,
  cheerEventIdFromPush,
  cheerFromAction,
  cleanCheerMessage,
  isCheerAction,
} from "../Utils/cheers";

// Sending a cheer, from a button on the workout-started notification or from
// under its row in the notification history - the same insert either way.
// Who may cheer, once per workout, six hours, no blocks, is held by the
// database (supabase/migrations/20261012090000_cheers-from-a-notification.sql);
// the client only sends the event, the preset and, for "custom", the text.
// The server writes who the cheer is for.

const WORKOUT_CHEER_TABLE = "workout_cheer";
const ACTIVITY_NOTIFICATION_CHANNEL_ID = "activity";
const UNIQUE_VIOLATION_CODE = "23505";

export const CHEER_RESULT = {
  SENT: "sent",
  // A second cheer on the same workout. Not a failure: nothing is shown.
  ALREADY_SENT: "already_sent",
  SIGNED_OUT: "signed_out",
  FAILED: "failed",
  // Not a cheer button, or a button with nothing to send: a quiet nothing.
  IGNORED: "ignored",
};

// One tap can reach us three ways - the listener, the response the app was
// opened with, and a re-delivery - and each of them must send once. The unique
// key in the database would swallow the repeat anyway; this keeps it from
// being asked, and keeps a failure from being announced twice.
const handledResponseKeys = new Set();

async function hasSession() {
  try {
    const { data } = await supabase.auth.getSession();

    return Boolean(data?.session?.access_token);
  } catch {
    return false;
  }
}

/**
 * One insert into workout_cheer. Never throws: the answer is one of
 * CHEER_RESULT, because every caller does the same few things with it.
 */
export async function sendCheer({ eventId, preset, message = null } = {}) {
  if (!eventId || !preset) {
    return CHEER_RESULT.FAILED;
  }

  const text = preset === CHEER_PRESET_CUSTOM ? cleanCheerMessage(message) : null;

  if (preset === CHEER_PRESET_CUSTOM && !text) {
    return CHEER_RESULT.FAILED;
  }

  if (!(await hasSession())) {
    return CHEER_RESULT.SIGNED_OUT;
  }

  try {
    const { error } = await supabase
      .from(WORKOUT_CHEER_TABLE)
      .insert({ event_id: eventId, preset, message: text });

    if (!error) {
      return CHEER_RESULT.SENT;
    }

    if (error.code === UNIQUE_VIOLATION_CODE) {
      return CHEER_RESULT.ALREADY_SENT;
    }

    console.warn("Could not send the cheer:", error);
    return CHEER_RESULT.FAILED;
  } catch (error) {
    console.warn("Could not send the cheer:", error);
    return CHEER_RESULT.FAILED;
  }
}

/**
 * The cheers this person has sent for these workouts, as a map of
 * event id -> { preset, message }. A failed read is an empty map: the row then
 * shows its buttons, and pressing one that was already sent is ignored quietly.
 */
export async function getSentCheers({ user, eventIds } = {}) {
  const ids = [...new Set((eventIds ?? []).filter(Boolean))];

  if (!user?.id || !ids.length) {
    return {};
  }

  const { data, error } = await supabase
    .from(WORKOUT_CHEER_TABLE)
    .select("event_id, preset, message")
    .eq("sender_id", user.id)
    .in("event_id", ids);

  if (error) {
    console.warn("Could not read the cheers already sent:", error);
    return {};
  }

  return Object.fromEntries(
    (data ?? []).map((row) => [row.event_id, { preset: row.preset, message: row.message ?? null }])
  );
}

// "Couldn't send your cheer", once for the tap. Never a retry.
async function announceFailure() {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: t("cheers.sendFailed"),
        ...(Platform.OS === "android"
          ? { channelId: ACTIVITY_NOTIFICATION_CHANNEL_ID }
          : {}),
      },
      trigger: null,
    });
  } catch (error) {
    console.warn("Could not announce the failed cheer:", error);
  }
}

function responseKey(response) {
  const request = response?.notification?.request;

  return [request?.identifier, response?.actionIdentifier, response?.notification?.date]
    .filter((value) => value !== null && value !== undefined && value !== "")
    .join(":");
}

/**
 * A notification response that is a cheer button being pressed: sends the
 * cheer and answers with one of CHEER_RESULT. The caller (App.js) has already
 * checked isCheerAction, and says "Cheer sent" on SENT - this file shows
 * nothing, so it runs as it is in a test. A failure announces itself, once.
 * IGNORED covers a response seen before, an empty message and a push without
 * its workout.
 */
export async function handleCheerResponse(response) {
  const actionIdentifier = response?.actionIdentifier;

  if (!isCheerAction(actionIdentifier)) {
    return CHEER_RESULT.IGNORED;
  }

  const key = responseKey(response);

  if (key && handledResponseKeys.has(key)) {
    return CHEER_RESULT.IGNORED;
  }

  if (key) {
    handledResponseKeys.add(key);
  }

  const request = response?.notification?.request;
  const cheer = cheerFromAction(actionIdentifier, response?.userText);
  const eventId = cheerEventIdFromPush(request?.content?.data);

  // An empty message, or a push from before the workout carried its event: a
  // quiet nothing, the way a second cheer is.
  if (!cheer || !eventId) {
    return CHEER_RESULT.IGNORED;
  }

  const result = await sendCheer({ eventId, ...cheer });

  if (result === CHEER_RESULT.SENT || result === CHEER_RESULT.ALREADY_SENT) {
    // The buttons stay on an Android notification after they are pressed.
    try {
      if (request?.identifier) {
        await Notifications.dismissNotificationAsync(request.identifier);
      }
    } catch {
      // Already gone.
    }
  } else if (result === CHEER_RESULT.FAILED) {
    await announceFailure();
  }

  return result;
}
