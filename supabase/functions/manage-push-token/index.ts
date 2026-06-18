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

const VALID_PLATFORMS = new Set(["android", "ios", "web", "unknown"]);

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

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
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
      throw error;
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

  const disableOtherOwners = async () =>
    supabase
      .from("push_tokens")
      .update({
        enabled: false,
        updated_at: now,
      })
      .eq("expo_push_token", expoPushToken)
      .neq("user_id", userId)
      .eq("enabled", true)
      .select("id");

  const upsertCurrentOwner = async () =>
    supabase
      .from("push_tokens")
      .upsert(
        {
          user_id: userId,
          expo_push_token: expoPushToken,
          platform,
          enabled: true,
          last_seen_at: now,
          updated_at: now,
        },
        { onConflict: "user_id,expo_push_token" }
      )
      .select("id, expo_push_token")
      .single<PushTokenRow>();

  const { data: disabledRows, error: disableError } =
    await disableOtherOwners();

  if (disableError) {
    throw disableError;
  }

  let { data: registeredToken, error: upsertError } =
    await upsertCurrentOwner();

  if (upsertError?.code === "23505") {
    const { error: retryDisableError } = await disableOtherOwners();

    if (retryDisableError) {
      throw retryDisableError;
    }

    const retryResult = await upsertCurrentOwner();
    registeredToken = retryResult.data;
    upsertError = retryResult.error;
  }

  if (upsertError) {
    throw upsertError;
  }

  return jsonResponse({
    registered: true,
    tokenId: registeredToken?.id ?? null,
    expoPushToken: registeredToken?.expo_push_token ?? expoPushToken,
    disabledOtherOwnerCount: disabledRows?.length ?? 0,
  });
});
