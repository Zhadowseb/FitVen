// The push for "Bo liked your post".
//
// Called by a Database Webhook on public.social_post_like, INSERT, with the
// x-fitven-webhook-secret header - the same secret as
// send-workout-started-notification. Deployed with verify_jwt off
// (supabase/config.toml): the caller is the database, which has no user's JWT,
// and the app never calls this.
//
// The trigger in supabase/migrations/20261009090000_a-like-notifies-the-poster.sql
// has already decided whether the author is told and written the history
// row. This only sends that event to the author's devices, and only once: the
// event is claimed by setting expo_response where it is still null, so a
// webhook retry, or the same like arriving again after an unlike, finds it
// claimed and sends nothing. No event means nobody is to be told - a like on
// your own post, a block, likes switched off, or a like already announced.
//
// The text is English, as the workout-start push is: nothing on the server
// knows which language the author uses. The history page shows the row in
// the app's language.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  POST_LIKED_EVENT_TYPE,
  WEBHOOK_SECRET_HEADER,
  buildPostLikedMessage,
  invalidTokenIds,
  pickRecipientTokens,
  postLikedEventKey,
  readLike,
  secretsMatch,
} from "./message.ts";
import type { ExpoTicket, PushTokenRow } from "./message.ts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type JsonRecord = Record<string, unknown>;

type ExpoPushResponse = {
  data?: ExpoTicket | ExpoTicket[];
  errors?: JsonRecord[];
};

const jsonHeaders = {
  "Content-Type": "application/json",
};

function jsonResponse(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function sendExpoPushes(tokens: PushTokenRow[], message: JsonRecord) {
  const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/json",
  };

  if (expoAccessToken) {
    headers.Authorization = `Bearer ${expoAccessToken}`;
  }

  // One author has a handful of devices; Expo takes up to a hundred at once.
  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(
      tokens.map((token) => ({ ...message, to: token.expo_push_token }))
    ),
  });
  const responseBody = (await response.json()) as ExpoPushResponse;

  if (!response.ok || responseBody.errors?.length) {
    throw new Error(`Expo push request failed: ${JSON.stringify(responseBody)}`);
  }

  const tickets = Array.isArray(responseBody.data)
    ? responseBody.data
    : responseBody.data
      ? [responseBody.data]
      : [];

  return { responseBody, invalid: invalidTokenIds(tokens, tickets) };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (
    !secretsMatch(
      Deno.env.get("FITVEN_NOTIFICATION_WEBHOOK_SECRET") ?? "",
      req.headers.get(WEBHOOK_SECRET_HEADER) ?? ""
    )
  ) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let payload: unknown;

  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON payload" }, 400);
  }

  const like = readLike(payload);

  if (!like) {
    return jsonResponse({ skipped: true, reason: "not_a_like" });
  }

  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const eventKey = postLikedEventKey(like.postId, like.likerId);
  const { data: event, error: claimError } = await supabase
    .from("notification_events")
    .update({ expo_response: { claimed_at: new Date().toISOString() } })
    .eq("event_key", eventKey)
    .eq("event_type", POST_LIKED_EVENT_TYPE)
    .eq("status", "sent")
    .is("expo_response", null)
    .select("id, payload")
    .maybeSingle<{ id: string; payload: JsonRecord }>();

  if (claimError) {
    return jsonResponse({ error: claimError.message }, 500);
  }

  if (!event) {
    return jsonResponse({ skipped: true, reason: "nothing_to_send", eventKey });
  }

  const message = buildPostLikedMessage(event.payload);

  if (!message) {
    await supabase
      .from("notification_events")
      .update({ error_message: "The event has no post, author or liker." })
      .eq("id", event.id);

    return jsonResponse({ skipped: true, reason: "incomplete_event", eventKey });
  }

  try {
    const authorId = message.data.author_id;
    const [
      { data: authorTokens, error: authorTokensError },
      { data: likerTokens, error: likerTokensError },
    ] = await Promise.all([
      supabase
        .from("push_tokens")
        .select("id, user_id, expo_push_token")
        .eq("user_id", authorId)
        .eq("enabled", true),
      supabase
        .from("push_tokens")
        .select("id, user_id, expo_push_token")
        .eq("user_id", message.data.liker_id)
        .eq("enabled", true),
    ]);

    if (authorTokensError) {
      throw authorTokensError;
    }

    if (likerTokensError) {
      throw likerTokensError;
    }

    const tokens = pickRecipientTokens(
      (authorTokens ?? []) as PushTokenRow[],
      (likerTokens ?? []) as PushTokenRow[],
      authorId
    );

    if (!tokens.length) {
      await supabase
        .from("notification_events")
        .update({ expo_response: { skipped: "no_push_tokens" } })
        .eq("id", event.id);

      return jsonResponse({ sent: false, reason: "no_push_tokens", eventKey });
    }

    const { responseBody, invalid } = await sendExpoPushes(tokens, message);

    if (invalid.length) {
      await supabase
        .from("push_tokens")
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .in("id", invalid);
    }

    await supabase
      .from("notification_events")
      .update({ expo_response: responseBody as unknown as JsonRecord })
      .eq("id", event.id);

    return jsonResponse({
      sent: true,
      eventKey,
      pushRecipientCount: tokens.length,
      invalidTokenCount: invalid.length,
    });
  } catch (error) {
    // The history row is already there; only the push failed. The claim stays,
    // so a retry does not send it late.
    await supabase
      .from("notification_events")
      .update({
        error_message:
          error instanceof Error ? error.message : JSON.stringify(error),
      })
      .eq("id", event.id);

    return jsonResponse({ error: "Push failed", eventKey }, 500);
  }
});
