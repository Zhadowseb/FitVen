// The push for "Sebastian cheered you on".
//
// Called by a Database Webhook on public.workout_cheer, INSERT, with the
// x-fitven-webhook-secret header - the same secret as
// send-workout-started-notification. Deployed with verify_jwt off
// (supabase/config.toml): the caller is the database, which has no user's JWT,
// and the app never calls this.
//
// The trigger in supabase/migrations/20261012090000_cheers-from-a-notification.sql
// has already decided whether the athlete is told and written the history
// row. This only sends that event to the athlete's devices, and only once: the
// event is claimed by setting expo_response where it is still null, so a
// webhook retry finds it claimed and sends nothing. No event means nobody is
// to be told - cheers switched off, or a cheer already announced.
//
// What this adds to the like function: the athlete's switch is read again
// (it may have been turned off since), a block is checked again, and at most
// ten cheers are pushed per workout. A cheer past that is in the history and
// has no push.
//
// The text is English, as the workout-start push is: nothing on the server
// knows which language the athlete uses. The history page shows the row in
// the app's language.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  CHEER_EVENT_TYPE,
  WEBHOOK_SECRET_HEADER,
  buildCheerMessage,
  invalidTokenIds,
  pickRecipientTokens,
  cheerEventKey,
  pushLimitReached,
  readCheer,
  secretsMatch,
} from "./message.ts";
import type { ExpoTicket, PushTokenRow } from "./message.ts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
// The webhook calls within seconds of the cheer. An older unclaimed event is a
// cheer from before the webhook existed; it must not be pushed days late.
const MAX_EVENT_AGE_MS = 10 * 60 * 1000;

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

  const cheer = readCheer(payload);

  if (!cheer) {
    return jsonResponse({ skipped: true, reason: "not_a_cheer" });
  }

  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const eventKey = cheerEventKey(cheer.workoutEventId, cheer.senderId);
  const { data: event, error: claimError } = await supabase
    .from("notification_events")
    .update({ expo_response: { claimed_at: new Date().toISOString() } })
    .eq("event_key", eventKey)
    .eq("event_type", CHEER_EVENT_TYPE)
    .eq("status", "sent")
    .is("expo_response", null)
    .gte("created_at", new Date(Date.now() - MAX_EVENT_AGE_MS).toISOString())
    .select("id, payload")
    .maybeSingle<{ id: string; payload: JsonRecord }>();

  if (claimError) {
    return jsonResponse({ error: claimError.message }, 500);
  }

  if (!event) {
    return jsonResponse({ skipped: true, reason: "nothing_to_send", eventKey });
  }

  const message = buildCheerMessage(event.payload, event.id);

  if (!message) {
    await supabase
      .from("notification_events")
      .update({ error_message: "The event has no sender, recipient or text." })
      .eq("id", event.id);

    return jsonResponse({ skipped: true, reason: "incomplete_event", eventKey });
  }

  const eventId = event.id;
  const skip = async (reason: string) => {
    await supabase
      .from("notification_events")
      .update({ expo_response: { skipped: reason } })
      .eq("id", eventId);

    return jsonResponse({ sent: false, reason, eventKey });
  };

  try {
    const recipientId = message.data.recipientId;
    const senderId = message.data.actorId;

    // Switched off since the trigger ran, or no longer allowed to hear.
    const { data: preference, error: preferenceError } = await supabase
      .from("notification_preferences")
      .select("cheer_notifications")
      .eq("user_id", recipientId)
      .maybeSingle<{ cheer_notifications: boolean | null }>();

    if (preferenceError) {
      throw preferenceError;
    }

    if (preference?.cheer_notifications === false) {
      return await skip("cheers_off");
    }

    const { data: blocks, error: blocksError } = await supabase
      .from("user_blocks")
      .select("blocker_id")
      .or(
        `and(blocker_id.eq.${recipientId},blocked_id.eq.${senderId}),and(blocker_id.eq.${senderId},blocked_id.eq.${recipientId})`
      )
      .limit(1);

    if (blocksError) {
      throw blocksError;
    }

    if (blocks?.length) {
      return await skip("blocked");
    }

    // Cheers already pushed to this athlete for this workout. A skipped
    // event has expo_response.skipped; one still being sent has claimed_at.
    const { count: pushedCount, error: countError } = await supabase
      .from("notification_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", CHEER_EVENT_TYPE)
      .eq("payload->>workout_event_id", cheer.workoutEventId)
      .not("expo_response", "is", null)
      .is("expo_response->>skipped", null)
      .neq("id", event.id);

    if (countError) {
      throw countError;
    }

    if (pushLimitReached(pushedCount)) {
      return await skip("too_many_cheers");
    }

    const [
      { data: recipientTokens, error: recipientTokensError },
      { data: senderTokens, error: senderTokensError },
    ] = await Promise.all([
      supabase
        .from("push_tokens")
        .select("id, user_id, expo_push_token")
        .eq("user_id", recipientId)
        .eq("enabled", true),
      supabase
        .from("push_tokens")
        .select("id, user_id, expo_push_token")
        .eq("user_id", senderId)
        .eq("enabled", true),
    ]);

    if (recipientTokensError) {
      throw recipientTokensError;
    }

    if (senderTokensError) {
      throw senderTokensError;
    }

    const tokens = pickRecipientTokens(
      (recipientTokens ?? []) as PushTokenRow[],
      (senderTokens ?? []) as PushTokenRow[],
      recipientId
    );

    if (!tokens.length) {
      return await skip("no_push_tokens");
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
