// What the cheer push says, whom it goes to, and which webhook calls it
// answers - everything here that decides something, and nothing that talks
// to the network or the database, so scripts/test-cheer-notification.js
// runs this file in Node. ./index.ts connects it to the request.
//
// Who is told at all is not decided here. The trigger in
// supabase/migrations/20261012090000_cheers-from-a-notification.sql writes
// the event only when the athlete should hear of the cheer - cheers switched
// on, once per person per workout - and the insert policy has already refused
// a cheer from someone who was not told about the workout, across a block, to
// oneself or after six hours. This function only ever sends an event that
// trigger wrote.

export const CHEER_EVENT_TYPE = "cheer";
export const WEBHOOK_SECRET_HEADER = "x-fitven-webhook-secret";
export const ACTIVITY_CHANNEL_ID = "activity";
// At most this many cheers are pushed to one athlete for one workout. Later
// ones are still in their history, without a push.
export const MAX_CHEER_PUSHES_PER_WORKOUT = 10;
// A name and a message reach a lock screen, so both are capped.
export const MAX_NAME_LENGTH = 40;
export const MAX_MESSAGE_LENGTH = 140;

type JsonRecord = Record<string, unknown>;

export type PushTokenRow = {
  id: string;
  user_id: string;
  expo_push_token: string;
};

export type ExpoTicket = {
  status?: "ok" | "error";
  details?: { error?: string };
};

const PRESET_TEXT: Record<string, string> = {
  good_workout: "💪 Good workout!",
  lets_go: "🔥 Let's go!",
  crush_it: "👏 Crush it!",
};

function text(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = String(value).replace(/\s+/g, " ").trim();

  return trimmed || null;
}

function cap(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1).trimEnd()}…` : value;
}

// Compares in constant time, so a caller cannot learn the secret one character
// at a time from how long the comparison takes.
export function secretsMatch(expected: string, received: string) {
  if (!expected || !received) {
    return false;
  }

  const expectedBytes = new TextEncoder().encode(expected);
  const receivedBytes = new TextEncoder().encode(received);
  let mismatch = expectedBytes.length ^ receivedBytes.length;

  for (let index = 0; index < expectedBytes.length; index += 1) {
    mismatch |= expectedBytes[index] ^ (receivedBytes[index] ?? 0);
  }

  return mismatch === 0;
}

// The Database Webhook on public.workout_cheer, INSERT. Anything else - an
// UPDATE, another table, a row without its two ids - is not a cheer.
export function readCheer(payload: unknown) {
  const body = (payload ?? {}) as JsonRecord;
  const record = (body.record ?? {}) as JsonRecord;
  const workoutEventId = text(record.event_id);
  const senderId = text(record.sender_id);

  if (
    body.type !== "INSERT" ||
    body.schema !== "public" ||
    body.table !== "workout_cheer" ||
    !workoutEventId ||
    !senderId
  ) {
    return null;
  }

  return { workoutEventId, senderId };
}

// The same key the trigger writes: 'cheer:' || event_id || ':' || sender_id.
export function cheerEventKey(workoutEventId: string, senderId: string) {
  return `cheer:${workoutEventId}:${senderId}`;
}

// The words of the cheer: the preset's text, or the custom message after a
// speech bubble. Null for a preset the server does not know or an empty
// custom message.
export function cheerText(preset: unknown, message: unknown) {
  const presetId = text(preset);

  if (presetId === "custom") {
    const custom = text(message);

    return custom ? `💬 ${cap(custom, MAX_MESSAGE_LENGTH)}` : null;
  }

  return (presetId && PRESET_TEXT[presetId]) || null;
}

// The event's payload is what the trigger put in the inbox row's data, so the
// push carries the same fields. eventId is the cheer's own notification event,
// the row the history page shows; the workout it answers is workout_event_id.
export function buildCheerMessage(eventPayload: unknown, eventId: string) {
  const payload = (eventPayload ?? {}) as JsonRecord;
  const senderId = text(payload.sender_id);
  const recipientId = text(payload.recipient_id);
  const preset = text(payload.preset);
  const body = cheerText(payload.preset, payload.message);

  if (!senderId || !recipientId || !preset || !body || senderId === recipientId) {
    return null;
  }

  const senderName = cap(text(payload.sender_name) ?? "Someone", MAX_NAME_LENGTH);

  return {
    title: `${senderName} cheered you on`,
    body,
    sound: "default",
    priority: "high",
    ttl: 86400,
    channelId: ACTIVITY_CHANNEL_ID,
    data: {
      type: CHEER_EVENT_TYPE,
      actorId: senderId,
      eventId,
      preset,
      recipientId,
      workoutEventId: text(payload.workout_event_id),
      senderName,
    },
  };
}

// The athlete's devices, once each - minus any device the sender is signed in
// on too, so a shared phone does not tell you about your own cheer.
export function pickRecipientTokens(
  recipientTokens: PushTokenRow[],
  senderTokens: PushTokenRow[],
  recipientId: string
) {
  const senderDevices = new Set(senderTokens.map((token) => token.expo_push_token));
  const seen = new Set<string>();

  return recipientTokens.filter((token) => {
    if (
      token.user_id !== recipientId ||
      !token.expo_push_token ||
      senderDevices.has(token.expo_push_token) ||
      seen.has(token.expo_push_token)
    ) {
      return false;
    }

    seen.add(token.expo_push_token);
    return true;
  });
}

// True once this many cheers have been pushed for the workout already.
export function pushLimitReached(pushedCount: number | null | undefined) {
  return (pushedCount ?? 0) >= MAX_CHEER_PUSHES_PER_WORKOUT;
}

// Expo answers one ticket per message, in order.
export function invalidTokenIds(tokens: PushTokenRow[], tickets: ExpoTicket[]) {
  return tickets
    .map((ticket, index) =>
      ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered"
        ? tokens[index]?.id ?? null
        : null
    )
    .filter((tokenId): tokenId is string => Boolean(tokenId));
}
