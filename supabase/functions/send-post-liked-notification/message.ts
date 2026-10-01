// What the post-liked push says, whom it goes to, and which webhook calls it
// answers - everything here that decides something, and nothing that talks
// to the network or the database, so scripts/test-post-like-notification.js
// runs this file in Node. ./index.ts connects it to the request.
//
// Who is told at all is not decided here. The trigger in
// supabase/migrations/20261009090000_a-like-notifies-the-poster.sql writes
// the event only when the author should hear of the like - not their own
// like, not across a block, not with likes switched off, once per person per
// post - and this function only ever sends an event that trigger wrote.

export const POST_LIKED_EVENT_TYPE = "social_post_liked";
export const WEBHOOK_SECRET_HEADER = "x-fitven-webhook-secret";
export const ACTIVITY_CHANNEL_ID = "activity";
// A name and a workout title reach a lock screen, so both are capped.
export const MAX_NAME_LENGTH = 40;
export const MAX_BODY_LENGTH = 80;

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

// The Database Webhook on public.social_post_like, INSERT. Anything else - an
// UPDATE, another table, a row without its two ids - is not a like.
export function readLike(payload: unknown) {
  const body = (payload ?? {}) as JsonRecord;
  const record = (body.record ?? {}) as JsonRecord;
  const postId = text(record.post_id);
  const likerId = text(record.user_id);

  if (
    body.type !== "INSERT" ||
    body.schema !== "public" ||
    body.table !== "social_post_like" ||
    !postId ||
    !/^\d+$/.test(postId) ||
    !likerId
  ) {
    return null;
  }

  return { postId, likerId };
}

// The same key the trigger writes: 'post-liked:' || post_id || ':' || liker_id.
export function postLikedEventKey(postId: string, likerId: string) {
  return `post-liked:${postId}:${likerId}`;
}

// The event's payload is what the trigger put in the inbox row's data, so the
// push carries the same fields and the app opens both the same way.
export function buildPostLikedMessage(eventPayload: unknown) {
  const payload = (eventPayload ?? {}) as JsonRecord;
  const postId = text(payload.post_id);
  const authorId = text(payload.author_id);
  const likerId = text(payload.liker_id);

  if (!postId || !authorId || !likerId || authorId === likerId) {
    return null;
  }

  const likerName = cap(text(payload.liker_name) ?? "Someone", MAX_NAME_LENGTH);
  const postTitle = text(payload.post_title);

  return {
    title: `${likerName} liked your post`,
    body: postTitle ? cap(postTitle, MAX_BODY_LENGTH) : "Your workout post",
    sound: "default",
    priority: "high",
    ttl: 86400,
    channelId: ACTIVITY_CHANNEL_ID,
    data: {
      type: POST_LIKED_EVENT_TYPE,
      post_id: postId,
      author_id: authorId,
      liker_id: likerId,
      liker_name: likerName,
      post_title: postTitle,
      workout_type: text(payload.workout_type),
    },
  };
}

// The author's devices, once each - minus any device the liker is signed in
// on too, so a shared phone does not tell you about your own like.
export function pickRecipientTokens(
  authorTokens: PushTokenRow[],
  likerTokens: PushTokenRow[],
  authorId: string
) {
  const likerDevices = new Set(likerTokens.map((token) => token.expo_push_token));
  const seen = new Set<string>();

  return authorTokens.filter((token) => {
    if (
      token.user_id !== authorId ||
      !token.expo_push_token ||
      likerDevices.has(token.expo_push_token) ||
      seen.has(token.expo_push_token)
    ) {
      return false;
    }

    seen.add(token.expo_push_token);
    return true;
  });
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
