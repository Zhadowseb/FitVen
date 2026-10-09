// GDPR art. 17. Erases the caller's account and everything attached to it.
//
// Three things have to happen and only one of them is reachable from SQL, which
// is why this exists rather than an RPC: the rows (purge_user_account), the
// person's files in storage - their avatar, and the clips and posters of their
// custom exercises - and the auth user itself. The auth user goes last - if
// anything before it fails the account still exists, and the person can try
// again. The other way round leaves orphaned data nobody can reach or erase.
//
// The id is never taken from the request body. It comes from the bearer token,
// so this cannot be pointed at somebody else's account.
import { createClient } from "npm:@supabase/supabase-js@2";

type JsonRecord = Record<string, unknown>;
type AdminClient = ReturnType<typeof createClient>;

const AVATAR_BUCKET = "avatars";
// <user id>/<exercise id>.mp4 or .mov, and <exercise id>-poster.jpg - from
// supabase/migrations/20260928090000_custom-exercises-can-be-shared.sql.
const EXERCISE_VIDEO_BUCKET = "exercise-videos";
const LIST_PAGE_SIZE = 100;

// What storage answers for a folder, or a bucket, that is not there: nothing
// to erase, which is not a failure. The second is a project where the
// migration that makes the bucket has not been run yet.
const NOTHING_THERE = new Set(["The resource was not found", "Bucket not found"]);

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

// Every file in the person's own folder of a bucket. Listing the folder rather
// than reading paths from their rows, because the rows are already gone by
// now, and because a failed upload can leave a file no row ever pointed at.
// Throws what storage throws; returns how many files went.
async function emptyUserFolder(supabase: AdminClient, bucket: string, userId: string) {
  const paths: string[] = [];

  for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
    const { data: files, error: listError } = await supabase.storage
      .from(bucket)
      .list(userId, { limit: LIST_PAGE_SIZE, offset });

    if (listError) {
      if (NOTHING_THERE.has(listError.message)) {
        break;
      }

      throw listError;
    }

    paths.push(...(files ?? []).map((file) => `${userId}/${file.name}`));

    if (!files || files.length < LIST_PAGE_SIZE) {
      break;
    }
  }

  for (let start = 0; start < paths.length; start += LIST_PAGE_SIZE) {
    const { error: removeError } = await supabase.storage
      .from(bucket)
      .remove(paths.slice(start, start + LIST_PAGE_SIZE));

    if (removeError) {
      throw removeError;
    }
  }

  return paths.length;
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

  // Then the files: the avatar, and the clips and posters of their custom
  // exercises. The copies other people added of those exercises never had a
  // clip of their own, so nothing of theirs goes with these.
  let removedFileCount = 0;

  try {
    for (const bucket of [AVATAR_BUCKET, EXERCISE_VIDEO_BUCKET]) {
      removedFileCount += await emptyUserFolder(supabase, bucket, userId);
    }
  } catch (error) {
    return errorResponse(error);
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
