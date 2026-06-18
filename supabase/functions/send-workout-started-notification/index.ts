import { createClient } from "npm:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_SIZE = 100;
const WEBHOOK_SECRET_HEADER = "x-fitven-webhook-secret";
const ACTIVITY_CHANNEL_ID = "activity";

type JsonRecord = Record<string, unknown>;

type WorkoutRecord = {
  id?: number | string | null;
  sync_id?: string | null;
  local_workout_type_instance_id?: number | string | null;
  user_id?: string | null;
  workout_type?: string | null;
  label?: string | null;
  done?: boolean | number | string | null;
  is_active?: boolean | number | string | null;
  is_deleting?: boolean | number | string | null;
  timer_start?: string | null;
  deleted_at?: string | null;
};

type DatabaseWebhookPayload = {
  source?: string;
  type?: string;
  table?: string;
  schema?: string;
  record?: WorkoutRecord | null;
  old_record?: WorkoutRecord | null;
  force?: boolean;
  started_at?: number | string | null;
  actor_expo_push_token?: string | null;
};

type PushTokenRow = {
  id: string;
  user_id: string;
  expo_push_token: string;
};

type NotificationPreferenceRow = {
  user_id: string;
  workout_start_mode: string;
};

type WorkoutStartNotificationSourceRow = {
  user_id: string;
};

type NotificationEventRow = {
  id: string;
};

type RequestAuth =
  | {
      kind: "webhook";
      userId?: never;
    }
  | {
      kind: "user";
      userId: string;
    };

type ExpoTicket = {
  status?: "ok" | "error";
  id?: string;
  message?: string;
  details?: {
    error?: string;
    [key: string]: unknown;
  };
};

type ExpoPushResponse = {
  data?: ExpoTicket | ExpoTicket[];
  errors?: JsonRecord[];
};

const jsonHeaders = {
  "Content-Type": "application/json",
};

const WORKOUT_START_NOTIFICATION_MODES = {
  NONE: "none",
  FOLLOWING: "following",
  CUSTOM: "custom",
} as const;

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

function normalizeBoolean(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function normalizeText(value: unknown) {
  if (!hasValue(value)) {
    return null;
  }

  return String(value).trim();
}

function isWorkoutLive(workout: WorkoutRecord | null | undefined) {
  if (!workout) {
    return false;
  }

  return (
    !normalizeBoolean(workout.done) &&
    !normalizeBoolean(workout.is_deleting) &&
    !hasValue(workout.deleted_at) &&
    (normalizeBoolean(workout.is_active) || hasValue(workout.timer_start))
  );
}

function isWorkoutStartedPayload(payload: DatabaseWebhookPayload) {
  if (payload.force === true) {
    return true;
  }

  const isSupportedEvent =
    payload.type === "INSERT" || payload.type === "UPDATE";

  return (
    isSupportedEvent &&
    payload.schema === "public" &&
    payload.table === "workout_type_instance" &&
    !isWorkoutLive(payload.old_record) &&
    isWorkoutLive(payload.record)
  );
}

function getWorkoutLabel(workout: WorkoutRecord) {
  const label = typeof workout.label === "string" ? workout.label.trim() : "";
  const workoutType =
    typeof workout.workout_type === "string" ? workout.workout_type.trim() : "";

  if (label && label.toLowerCase() !== workoutType.toLowerCase()) {
    return label;
  }

  return workoutType || "Workout";
}

function getWorkoutEventKey(workout: WorkoutRecord) {
  const syncId = normalizeText(workout.sync_id);

  if (syncId) {
    return `workout_started:${syncId}`;
  }

  const workoutId = normalizeText(workout.id);

  return workoutId ? `workout_started:${workoutId}` : null;
}

function getWorkoutSourceId(workout: WorkoutRecord) {
  return (
    normalizeText(workout.id) ??
    normalizeText(workout.sync_id) ??
    normalizeText(workout.local_workout_type_instance_id)
  );
}

function lowerFirst(value: string) {
  return value ? `${value.charAt(0).toLowerCase()}${value.slice(1)}` : value;
}

function upperFirst(value: string) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

function sentenceCasePhrase(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => (/^[A-Z0-9]+$/.test(word) ? word : lowerFirst(word)))
    .join(" ");
}

function getIndefiniteArticle(value: string) {
  return /^[aeiou]/i.test(value.trim()) ? "an" : "a";
}

function getWorkoutNotificationPhrase(workoutLabel: string) {
  const normalized = workoutLabel.trim();

  if (!normalized || normalized.toLowerCase() === "workout") {
    return "workout";
  }

  const type = sentenceCasePhrase(normalized);

  if (/\bworkout$/i.test(type)) {
    return type;
  }

  return `${type} workout`;
}

function getWorkoutNotificationTitle(workoutLabel: string) {
  const phrase = getWorkoutNotificationPhrase(workoutLabel);

  if (phrase === "workout") {
    return "Workout started";
  }

  return `${upperFirst(phrase)} started`;
}

function getWorkoutNotificationBody(actorName: string, workoutLabel: string) {
  const phrase = getWorkoutNotificationPhrase(workoutLabel);

  return `${actorName} has started ${getIndefiniteArticle(phrase)} ${phrase}!`;
}

function getDisplayName(profile: JsonRecord | null | undefined) {
  const displayName =
    typeof profile?.display_name === "string" ? profile.display_name.trim() : "";
  const username =
    typeof profile?.username === "string" ? profile.username.trim() : "";

  return displayName || username || "Someone";
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function getExpoTickets(responseBody: ExpoPushResponse) {
  if (Array.isArray(responseBody.data)) {
    return responseBody.data;
  }

  if (responseBody.data) {
    return [responseBody.data];
  }

  return [];
}

function getInvalidTokenIds(tokens: PushTokenRow[], tickets: ExpoTicket[]) {
  return tickets
    .map((ticket, index) =>
      ticket.status === "error" &&
      ticket.details?.error === "DeviceNotRegistered"
        ? tokens[index]?.id ?? null
        : null
    )
    .filter((tokenId): tokenId is string => Boolean(tokenId));
}

function validateWebhookSecret(req: Request) {
  const expectedSecret = Deno.env.get("FITVEN_NOTIFICATION_WEBHOOK_SECRET");
  const receivedSecret = req.headers.get(WEBHOOK_SECRET_HEADER);

  return Boolean(expectedSecret && receivedSecret === expectedSecret);
}

function getBearerToken(req: Request) {
  const authorization = req.headers.get("Authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}

async function authenticateRequest(
  req: Request,
  supabase: ReturnType<typeof createClient>
): Promise<RequestAuth | null> {
  if (validateWebhookSecret(req)) {
    return { kind: "webhook" };
  }

  const token = getBearerToken(req);

  if (!token) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser(token);
  const userId = data?.user?.id;

  if (error || !userId) {
    return null;
  }

  return { kind: "user", userId };
}

function normalizeClientPayload(
  payload: DatabaseWebhookPayload,
  userId: string
): DatabaseWebhookPayload {
  const record = payload.record ?? {};
  const timerStart =
    record.timer_start ?? payload.started_at ?? new Date().toISOString();

  return {
    ...payload,
    source: "client",
    type: payload.type ?? "CLIENT_WORKOUT_START",
    schema: payload.schema ?? "public",
    table: payload.table ?? "workout_type_instance",
    force: true,
    old_record: null,
    record: {
      ...record,
      user_id: userId,
      done: false,
      is_active: true,
      is_deleting: false,
      deleted_at: null,
      timer_start: timerStart,
    },
  };
}

function getEventPayload(payload: DatabaseWebhookPayload): JsonRecord {
  const { actor_expo_push_token: actorExpoPushToken, ...safePayload } = payload;

  if (!actorExpoPushToken) {
    return safePayload as JsonRecord;
  }

  return {
    ...safePayload,
    actor_expo_push_token_present: true,
  } as JsonRecord;
}

async function sendExpoPushes(tokens: PushTokenRow[], message: JsonRecord) {
  const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
  const responses: ExpoPushResponse[] = [];
  const invalidTokenIds: string[] = [];

  for (const tokenBatch of chunkArray(tokens, EXPO_BATCH_SIZE)) {
    const pushMessages = tokenBatch.map((token) => ({
      ...message,
      to: token.expo_push_token,
    }));
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    };

    if (expoAccessToken) {
      headers.Authorization = `Bearer ${expoAccessToken}`;
    }

    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(pushMessages),
    });
    const responseBody = (await response.json()) as ExpoPushResponse;

    responses.push(responseBody);

    if (!response.ok || responseBody.errors?.length) {
      throw new Error(
        `Expo push request failed: ${JSON.stringify(responseBody)}`
      );
    }

    invalidTokenIds.push(
      ...getInvalidTokenIds(tokenBatch, getExpoTickets(responseBody))
    );
  }

  return { responses, invalidTokenIds };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const requestAuth = await authenticateRequest(req, supabase);

  if (!requestAuth) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let payload: DatabaseWebhookPayload;

  try {
    payload = (await req.json()) as DatabaseWebhookPayload;
  } catch {
    return jsonResponse({ error: "Invalid JSON payload" }, 400);
  }

  if (requestAuth.kind === "user") {
    payload = normalizeClientPayload(payload, requestAuth.userId);
  }

  if (!isWorkoutStartedPayload(payload)) {
    return jsonResponse({
      skipped: true,
      reason: "not_workout_start",
    });
  }

  const workout = payload.record;
  const actorId = workout?.user_id;
  const workoutId = workout ? getWorkoutSourceId(workout) : null;
  const eventKey = workout ? getWorkoutEventKey(workout) : null;

  if (!workout || !actorId || !workoutId || !eventKey) {
    return jsonResponse(
      {
        skipped: true,
        reason: "missing_workout_identity",
      },
      400
    );
  }

  const { data: event, error: eventError } = await supabase
    .from("notification_events")
    .insert({
      event_key: eventKey,
      event_type: "workout_started",
      actor_id: actorId,
      source_table: "workout_type_instance",
      source_id: String(workoutId),
      status: "processing",
      payload: getEventPayload(payload),
    })
    .select("id")
    .single<NotificationEventRow>();

  if (eventError) {
    if (eventError.code === "23505") {
      return jsonResponse({
        skipped: true,
        reason: "duplicate_event",
        eventKey,
      });
    }

    throw eventError;
  }

  try {
    const { data: actorProfile, error: profileError } = await supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", actorId)
      .maybeSingle<JsonRecord>();

    if (profileError) {
      throw profileError;
    }

    const { data: follows, error: followsError } = await supabase
      .from("user_follows")
      .select("follower_id")
      .eq("following_id", actorId);

    if (followsError) {
      throw followsError;
    }

    const recipientIds = [
      ...new Set(
        (follows ?? [])
          .map((follow) => follow.follower_id)
          .filter((recipientId) => recipientId && recipientId !== actorId)
      ),
    ];

    if (!recipientIds.length) {
      await supabase
        .from("notification_events")
        .update({
          status: "skipped",
          recipient_count: 0,
          sent_at: new Date().toISOString(),
        })
        .eq("id", event.id);

      return jsonResponse({
        skipped: true,
        reason: "no_followers",
        eventKey,
      });
    }

    const [
      { data: preferences, error: preferencesError },
      { data: customSources, error: customSourcesError },
    ] = await Promise.all([
      supabase
        .from("notification_preferences")
        .select("user_id, workout_start_mode")
        .in("user_id", recipientIds),
      supabase
        .from("workout_start_notification_sources")
        .select("user_id")
        .in("user_id", recipientIds)
        .eq("source_user_id", actorId),
    ]);

    if (preferencesError) {
      throw preferencesError;
    }

    if (customSourcesError) {
      throw customSourcesError;
    }

    const workoutStartModeByUserId = new Map(
      ((preferences ?? []) as NotificationPreferenceRow[]).map((preference) => [
        preference.user_id,
        preference.workout_start_mode,
      ])
    );
    const customRecipientIds = new Set(
      ((customSources ?? []) as WorkoutStartNotificationSourceRow[]).map(
        (source) => source.user_id
      )
    );
    const filteredRecipientIds = recipientIds.filter((recipientId) => {
      const mode =
        workoutStartModeByUserId.get(recipientId) ??
        WORKOUT_START_NOTIFICATION_MODES.FOLLOWING;

      if (mode === WORKOUT_START_NOTIFICATION_MODES.NONE) {
        return false;
      }

      if (mode === WORKOUT_START_NOTIFICATION_MODES.CUSTOM) {
        return customRecipientIds.has(recipientId);
      }

      return true;
    });

    if (!filteredRecipientIds.length) {
      await supabase
        .from("notification_events")
        .update({
          status: "skipped",
          recipient_count: 0,
          sent_at: new Date().toISOString(),
        })
        .eq("id", event.id);

      return jsonResponse({
        skipped: true,
        reason: "filtered_by_preferences",
        eventKey,
      });
    }

    const actorName = getDisplayName(actorProfile);
    const workoutLabel = getWorkoutLabel(workout);
    const message = {
      title: getWorkoutNotificationTitle(workoutLabel),
      body: getWorkoutNotificationBody(actorName, workoutLabel),
      sound: "default",
      priority: "high",
      ttl: 3600,
      channelId: ACTIVITY_CHANNEL_ID,
      data: {
        type: "workout_started",
        actorId,
        workoutId: String(workoutId),
        workoutSyncId: workout.sync_id ?? null,
        localWorkoutId: workout.local_workout_type_instance_id ?? null,
        workoutType: workout.workout_type ?? null,
        workoutLabel,
      },
    };
    const { error: inboxError } = await supabase
      .from("notification_inbox")
      .upsert(
        filteredRecipientIds.map((recipientId) => ({
          user_id: recipientId,
          actor_id: actorId,
          event_id: event.id,
          event_type: "workout_started",
          title: message.title,
          body: message.body,
          data: message.data,
        })),
        {
          onConflict: "user_id,event_id",
          ignoreDuplicates: true,
        }
      );

    if (inboxError) {
      throw inboxError;
    }

    const [
      { data: pushTokens, error: tokensError },
      { data: actorTokens, error: actorTokensError },
    ] = await Promise.all([
      supabase
        .from("push_tokens")
        .select("id, user_id, expo_push_token")
        .in("user_id", filteredRecipientIds)
        .eq("enabled", true),
      supabase
        .from("push_tokens")
        .select("id, user_id, expo_push_token")
        .eq("user_id", actorId)
        .eq("enabled", true),
    ]);

    if (tokensError) {
      throw tokensError;
    }

    if (actorTokensError) {
      throw actorTokensError;
    }

    const registeredTokens = (pushTokens ?? []) as PushTokenRow[];
    const actorPushTokens = new Set(
      ((actorTokens ?? []) as PushTokenRow[])
        .map((token) => token.expo_push_token)
    );
    const directActorPushToken = normalizeText(payload.actor_expo_push_token);

    if (directActorPushToken) {
      actorPushTokens.add(directActorPushToken);
    }

    const addedRecipientTokens = new Set<string>();
    const tokens = registeredTokens.filter((token) => {
      if (
        token.user_id === actorId ||
        actorPushTokens.has(token.expo_push_token) ||
        addedRecipientTokens.has(token.expo_push_token)
      ) {
        return false;
      }

      addedRecipientTokens.add(token.expo_push_token);
      return true;
    });

    if (!tokens.length) {
      await supabase
        .from("notification_events")
        .update({
          status: "sent",
          recipient_count: filteredRecipientIds.length,
          sent_at: new Date().toISOString(),
        })
        .eq("id", event.id);

      return jsonResponse({
        sent: true,
        reason: "no_push_tokens",
        eventKey,
        inboxRecipientCount: filteredRecipientIds.length,
        pushRecipientCount: 0,
      });
    }

    const { responses, invalidTokenIds } = await sendExpoPushes(
      tokens,
      message
    );

    if (invalidTokenIds.length) {
      await supabase
        .from("push_tokens")
        .update({
          enabled: false,
          updated_at: new Date().toISOString(),
        })
        .in("id", invalidTokenIds);
    }

    await supabase
      .from("notification_events")
      .update({
        status: "sent",
        recipient_count: filteredRecipientIds.length,
        expo_response: responses as unknown as JsonRecord,
        sent_at: new Date().toISOString(),
      })
      .eq("id", event.id);

    return jsonResponse({
      sent: true,
      eventKey,
      inboxRecipientCount: filteredRecipientIds.length,
      pushRecipientCount: tokens.length,
      invalidTokenCount: invalidTokenIds.length,
    });
  } catch (error) {
    await supabase
      .from("notification_events")
      .update({
        status: "failed",
        error_message:
          error instanceof Error ? error.message : JSON.stringify(error),
      })
      .eq("id", event.id);

    throw error;
  }
});
