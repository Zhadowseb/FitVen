// GDPR art. 17. Erases the caller's account and everything attached to it.
//
// Three things have to happen and only one of them is reachable from SQL, which
// is why this exists rather than an RPC: the rows (purge_user_account), the
// avatar files in storage, and the auth user itself. The auth user goes last -
// if anything before it fails the account still exists, and the person can try
// again. The other way round leaves orphaned data nobody can reach or erase.
//
// The id is never taken from the request body. It comes from the bearer token,
// so this cannot be pointed at somebody else's account.
import { createClient } from "npm:@supabase/supabase-js@2";

type JsonRecord = Record<string, unknown>;

const AVATAR_BUCKET = "avatars";

const jsonHeaders = {
  "Content-Type": "application/json",
};

function jsonResponse(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

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

  // Rows first. This raises rather than returning a partial result if a foreign
  // key still refuses after its retries, so a half-erased account reports as a
  // failure instead of a success.
  const { data: purgeSummary, error: purgeError } = await supabase.rpc(
    "purge_user_account",
    { target_user: userId }
  );

  if (purgeError) {
    return errorResponse(purgeError);
  }

  // Then the avatar. Listing the folder rather than reading avatar_path from
  // the profile, because the profile row is already gone by now, and because a
  // failed upload can leave a file the profile never pointed at.
  let removedFileCount = 0;
  const { data: avatarFiles, error: listError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .list(userId, { limit: 100 });

  if (listError && listError.message !== "The resource was not found") {
    return errorResponse(listError);
  }

  if (avatarFiles?.length) {
    const paths = avatarFiles.map((file) => `${userId}/${file.name}`);
    const { error: removeError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .remove(paths);

    if (removeError) {
      return errorResponse(removeError);
    }

    removedFileCount = paths.length;
  }

  // Last, because everything above is still retryable while the account exists.
  const { error: deleteUserError } = await supabase.auth.admin.deleteUser(
    userId
  );

  if (deleteUserError) {
    return errorResponse(deleteUserError);
  }

  return jsonResponse({
    deleted: true,
    deletedRows: purgeSummary ?? {},
    removedFileCount,
  });
});
