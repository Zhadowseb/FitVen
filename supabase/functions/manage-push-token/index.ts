import { createClient } from "npm:@supabase/supabase-js@2";

type JsonRecord = Record<string, unknown>;

type PushTokenRequest = {
  action?: "register" | "disable";
  expoPushToken?: string | null;
  platform?: string | null;
};

type PushTokenRow = {
  id: string;
  expo_push_token: string;
};

type TokenOwnerRow = {
  id: string;
  user_id: string;
  last_seen_at: string | null;
};

const VALID_PLATFORMS = new Set(["android", "ios", "web", "unknown"]);
// How long another account's row has to go untouched before this device may
// take its push token.
const STALE_TOKEN_DAYS = 7;

const jsonHeaders = {
  "Content-Type": "application/json",
};

function jsonResponse(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

// A thrown error leaves Deno.serve to answer with an opaque 500, and the client
// then only knows "non-2xx". Postgres says exactly what went wrong - a missing
// table or a missing unique index for the upsert - so pass that on.
function errorResponse(error: unknown, status = 500) {
  const detail = error as
    | { code?: string; message?: string; details?: string; hint?: string }
    | null;

  return jsonResponse(
    {
      error: detail?.message ?? "Unexpected error",
      code: detail?.code ?? null,
      details: detail?.details ?? null,
      hint: detail?.hint ?? null,
    },
    status
  );
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getBearerToken(req: Request) {
  const authorization = req.headers.get("Authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}

function normalizeExpoPushToken(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizePlatform(value: unknown) {
  if (typeof value !== "string") {
    return "unknown";
  }

  const normalized = value.trim().toLowerCase();
  return VALID_PLATFORMS.has(normalized) ? normalized : "unknown";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let supabaseUrl: string;
  let serviceRoleKey: string;

  try {
    supabaseUrl = requireEnv("SUPABASE_URL");
    serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  } catch (error) {
    return errorResponse(error);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const token = getBearerToken(req);

  if (!token) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(
    token
  );
  const userId = authData?.user?.id;

  if (authError || !userId) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let payload: PushTokenRequest;

  try {
    payload = (await req.json()) as PushTokenRequest;
  } catch {
    return jsonResponse({ error: "Invalid JSON payload" }, 400);
  }

  const action = payload.action;
  const expoPushToken = normalizeExpoPushToken(payload.expoPushToken);

  if (!expoPushToken) {
    return jsonResponse({ error: "Missing expoPushToken" }, 400);
  }

  const now = new Date().toISOString();

  if (action === "disable") {
    const { data: disabledRows, error } = await supabase
      .from("push_tokens")
      .update({
        enabled: false,
        updated_at: now,
      })
      .eq("user_id", userId)
      .eq("expo_push_token", expoPushToken)
      .select("id");

    if (error) {
      return errorResponse(error);
    }

    return jsonResponse({
      disabled: true,
      expoPushToken,
      disabledTokenCount: disabledRows?.length ?? 0,
    });
  }

  if (action !== "register") {
    return jsonResponse({ error: "Unsupported action" }, 400);
  }

  const platform = normalizePlatform(payload.platform);

  // Only one row per token may be enabled, so a device that changes hands has
  // to take the token from its previous account. This used to happen on any
  // client call: send somebody else's token and their row was switched off,
  // silently, and they simply stopped receiving notifications.
  //
  // Now the previous row is only released once it has gone quiet. An account
  // still using the app keeps its token; one that logged out badly, deleted the
  // app or wiped the phone goes stale and lets the new owner through.
  const { data: otherOwners, error: otherOwnersError } = await supabase
    .from("push_tokens")
    .select("id, user_id, last_seen_at")
    .eq("expo_push_token", expoPushToken)
    .eq("enabled", true)
    .neq("user_id", userId)
    .returns<TokenOwnerRow[]>();

  if (otherOwnersError) {
    return errorResponse(otherOwnersError);
  }

  const staleBefore = Date.now() - STALE_TOKEN_DAYS * 24 * 60 * 60 * 1000;
  const staleOwners = (otherOwners ?? []).filter((owner: TokenOwnerRow) => {
    const lastSeen = Date.parse(String(owner.last_seen_at ?? ""));

    return !Number.isFinite(lastSeen) || lastSeen < staleBefore;
  });
  const activeOwnerCount = (otherOwners ?? []).length - staleOwners.length;

  if (staleOwners.length) {
    const { error: releaseError } = await supabase
      .from("push_tokens")
      .update({ enabled: false, updated_at: now })
      .in(
        "id",
        staleOwners.map((owner: TokenOwnerRow) => owner.id)
      );

    if (releaseError) {
      return errorResponse(releaseError);
    }

    // Worth a line in the function log: it moves a device between accounts.
    console.info(
      `Released ${staleOwners.length} stale push token row(s) to user ${userId}`
    );
  }

  // Another account is still active on this token, so this row is stored but
  // left switched off rather than taking the device from them.
  const enabled = activeOwnerCount === 0;

  const { data: registeredToken, error: upsertError } = await supabase
    .from("push_tokens")
    .upsert(
      {
        user_id: userId,
        expo_push_token: expoPushToken,
        platform,
        enabled,
        last_seen_at: now,
        updated_at: now,
      },
      { onConflict: "user_id,expo_push_token" }
    )
    .select("id, expo_push_token")
    .single<PushTokenRow>();

  if (upsertError) {
    return errorResponse(upsertError);
  }

  return jsonResponse({
    registered: true,
    enabled,
    tokenId: registeredToken?.id ?? null,
    expoPushToken: registeredToken?.expo_push_token ?? expoPushToken,
    releasedStaleOwnerCount: staleOwners.length,
    blockedByActiveOwner: !enabled,
  });
});
