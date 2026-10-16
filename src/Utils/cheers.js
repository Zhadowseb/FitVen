// Cheers - the quick replies to "X has started a push!" - everything that
// decides something, and nothing that talks to the phone or the database, so
// scripts/test-cheers.js runs this file in Node.
//
// The same three replies and the same free text are offered in two places: as
// buttons on the workout-started notification (Services/notificationService.js
// registers them) and under the row in the notification history. Both end in
// Services/cheerService.js. The rules the server holds them to are in
// supabase/migrations/20261012090000_cheers-from-a-notification.sql.

// The category the workout-started push names, and the id of each button.
export const WORKOUT_STARTED_CATEGORY_ID = "workout_started";
export const CHEER_ACTION_PREFIX = "cheer_";
export const CHEER_CUSTOM_ACTION_ID = "cheer_custom";
export const MAX_CHEER_MESSAGE_LENGTH = 140;
// A cheer is for a workout that has just started; the server refuses one
// after six hours, and the buttons under a row go the same way.
export const CHEER_WINDOW_MS = 6 * 60 * 60 * 1000;
export const WORKOUT_STARTED_EVENT_TYPE = "workout_started";
export const CHEER_EVENT_TYPE = "cheer";

export const CHEER_PRESET_CUSTOM = "custom";

// `labelKey` is the string; `id` is what is stored and what the server's
// push says; `actionId` is the notification button.
export const CHEER_PRESETS = [
  { id: "good_workout", actionId: "cheer_good_workout", labelKey: "cheers.presets.goodWorkout" },
  { id: "lets_go", actionId: "cheer_lets_go", labelKey: "cheers.presets.letsGo" },
  { id: "crush_it", actionId: "cheer_crush_it", labelKey: "cheers.presets.crushIt" },
];

const PRESET_BY_ID = new Map(CHEER_PRESETS.map((preset) => [preset.id, preset]));
const PRESET_BY_ACTION = new Map(CHEER_PRESETS.map((preset) => [preset.actionId, preset]));

function textOf(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * What the database would keep of a typed message: line breaks and runs of
 * spaces become one space, the ends are trimmed, and it is cut to 140
 * characters (counted as the database counts: whole characters, an emoji is
 * one). Null when nothing is left.
 */
export function cleanCheerMessage(value) {
  if (typeof value !== "string") {
    return null;
  }

  const collapsed = value.replace(/\s+/g, " ").trim();

  if (!collapsed) {
    return null;
  }

  const characters = Array.from(collapsed);

  return characters.length > MAX_CHEER_MESSAGE_LENGTH
    ? characters.slice(0, MAX_CHEER_MESSAGE_LENGTH).join("").trim()
    : collapsed;
}

/**
 * The cheer a pressed notification button stands for - { preset, message } -
 * or null for a button that is not a cheer, or a text button with no text.
 */
export function cheerFromAction(actionIdentifier, userText) {
  const action = textOf(actionIdentifier);

  if (!action || !action.startsWith(CHEER_ACTION_PREFIX)) {
    return null;
  }

  if (action === CHEER_CUSTOM_ACTION_ID) {
    const message = cleanCheerMessage(userText);

    return message ? { preset: CHEER_PRESET_CUSTOM, message } : null;
  }

  const preset = PRESET_BY_ACTION.get(action);

  return preset ? { preset: preset.id, message: null } : null;
}

/** True for any response whose button is one of ours, valid or not. */
export function isCheerAction(actionIdentifier) {
  return typeof actionIdentifier === "string" && actionIdentifier.startsWith(CHEER_ACTION_PREFIX);
}

/**
 * The workout a pushed notification is about, for a cheer: the event id the
 * workout-started push carries. Null for a push without one - sent before
 * this existed - which then has no buttons to press either.
 */
export function cheerEventIdFromPush(pushData) {
  const data = pushData && typeof pushData === "object" ? pushData : {};

  return textOf(data.eventId) ?? textOf(data.event_id);
}

/** The words of a cheer, in the reader's language. */
export function cheerText(preset, message, t) {
  if (preset === CHEER_PRESET_CUSTOM) {
    const custom = textOf(message);

    return custom ? t("cheers.customBody", { message: custom }) : null;
  }

  const known = PRESET_BY_ID.get(preset);

  return known ? t(known.labelKey) : null;
}

/**
 * Can this row still be answered with a cheer? Only while the workout is
 * fresh, and only if the push said the athlete takes cheers (data.cheers,
 * written by send-workout-started-notification): with them off, or a row from
 * before cheers existed, a reply would be saved and reach nobody.
 */
export function isCheerableRow(item, { now = Date.now() } = {}) {
  if (item?.eventType !== WORKOUT_STARTED_EVENT_TYPE || !item?.eventId) {
    return false;
  }

  if (item?.data?.cheers !== true) {
    return false;
  }

  const created = Date.parse(item.createdAt ?? "");

  return Number.isFinite(created) && now - created >= 0 && now - created < CHEER_WINDOW_MS;
}

// A cheer on a workout the reader started shows the cheerer; one the reader
// sent shows as "You cheered".

/** The cheer row's sender: the profile as it is now, else as written down. */
export function cheererName(item, t) {
  const data = item?.data && typeof item.data === "object" ? item.data : {};

  return (
    textOf(item?.actor?.displayName) ?? textOf(data.sender_name) ?? t("cheers.someone")
  );
}

/** Title and body of a received cheer, or null if the row is not one. */
export function describeCheer(item, t) {
  if (item?.eventType !== CHEER_EVENT_TYPE) {
    return null;
  }

  const data = item?.data && typeof item.data === "object" ? item.data : {};

  return {
    title: t("cheers.title", { name: cheererName(item, t) }),
    body: cheerText(data.preset, data.message, t) ?? textOf(item?.body) ?? "",
  };
}
