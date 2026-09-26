// Fills public.store_stats with iOS downloads from App Store Connect.
//
// Called once a day by the cron in
// supabase/migrations/20260930090000_store-stats-ios-daily.sql, and by hand
// when checking it. Everything that decides a number - what counts as a
// download, how the report is read, what each of Apple's answers means - is in
// ./report.ts, which scripts/test-store-stats.js runs in Node. This file only
// connects that to the request, the secrets and the database.
//
// Deployed with verify_jwt off (supabase/config.toml): the caller is a cron
// job with no user's JWT to send. STORE_STATS_CRON_SECRET is the lock instead,
// and it is checked before anything else happens.
//
// Every key comes from the function's secrets. None is in the repository or
// the app, and none is ever written to a response or a log.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  createAppStoreConnectToken,
  presentedSecret,
  runIosStoreStats,
  secretsMatch,
  storeStatsTable,
} from "./report.ts";
import type { RunSummary } from "./report.ts";

type JsonRecord = Record<string, unknown>;

const jsonHeaders = {
  "Content-Type": "application/json",
};

function jsonResponse(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

// Postgres says exactly what went wrong - a missing table, a refused grant -
// so pass that on rather than leaving Deno.serve to answer an opaque 500.
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

Deno.serve(async (req) => {
  const expectedSecret = Deno.env.get("STORE_STATS_CRON_SECRET") ?? "";

  // Without the secret there is nothing to compare against, and a function
  // that answers anybody would let a stranger spend the key's rate limit.
  if (!expectedSecret) {
    console.error(
      "store-stats: STORE_STATS_CRON_SECRET is not set, so every call is refused."
    );
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  if (!(await secretsMatch(expectedSecret, presentedSecret(req.headers)))) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let supabaseUrl: string;
  let serviceRoleKey: string;
  let privateKeyPem: string;
  let keyId: string;
  let issuerId: string;
  let vendorNumber: string;

  try {
    supabaseUrl = requireEnv("SUPABASE_URL");
    serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    privateKeyPem = requireEnv("ASC_PRIVATE_KEY");
    keyId = requireEnv("ASC_KEY_ID");
    issuerId = requireEnv("ASC_ISSUER_ID");
    vendorNumber = requireEnv("ASC_VENDOR_NUMBER");
  } catch (error) {
    console.error(`store-stats: ${(error as Error).message}`);
    return errorResponse(error);
  }

  // One token for the whole run: it lives ten minutes and a run takes one or two.
  let token: string;

  try {
    token = await createAppStoreConnectToken({ privateKeyPem, keyId, issuerId });
  } catch (error) {
    console.error(`store-stats: ${(error as Error).message}`);
    return errorResponse(error);
  }

  // The service role, because store_stats has no write policy at all: the app
  // may only read it, and only as an admin.
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const table = storeStatsTable(supabase);

  let summary: RunSummary;

  try {
    summary = await runIosStoreStats({
      fetch,
      token,
      vendorNumber,
      readStoredDays: table.readStoredDays,
      writeRow: table.writeRow,
    });
  } catch (error) {
    // Not Apple: every answer of Apple's is turned into a summary, never
    // thrown. What lands here is the database refusing the read of the stored
    // days or a write, and the rows written before it stay written.
    console.error("store-stats: the run stopped", error);
    return errorResponse(error);
  }

  if (!summary.ok) {
    for (const problem of summary.problems) {
      console.error(`store-stats: ${problem}`);
    }
  } else if (summary.skipped.length > 0) {
    console.warn(
      `store-stats: ${summary.skipped.length} day(s) skipped for the next run`,
      JSON.stringify(summary.skipped)
    );
  }

  console.log(
    `store-stats: ${summary.written.length} written, ${summary.noSales.length} with no sales, ` +
      `${summary.noReport.length} with no report, ${summary.skipped.length} skipped, ` +
      `${summary.alreadyStored} already stored` +
      (summary.stoppedBy ? `; stopped early: ${summary.stoppedBy}` : "")
  );

  // 502 when Apple refused the key or a request, so the failure shows in the
  // cron's response log and not only in this function's.
  return jsonResponse(summary as unknown as JsonRecord, summary.ok ? 200 : 502);
});
