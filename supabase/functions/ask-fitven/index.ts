// Ask FitVen: POST /functions/v1/ask-fitven. The contract (requests,
// responses, error codes, the eight tools, the security rules) is
// docs/ASK-FITVEN.md; the flow is in ./ask.ts, which has no Deno in it so
// scripts/test-ask-fitven-edge.js can run it. This file is only the glue.
//
// Deployed with verify_jwt on (supabase/config.toml), and it verifies the JWT
// again itself: the person is whoever auth.getUser() says.
//
// Two rules this file keeps, and a test reads the source to check them:
//   - The data client is made from the anon key and the caller's Authorization
//     header, so every database call - the eight tools included - runs as the
//     caller and auth.uid() is the caller. It is the only client that reads.
//   - The service-role key is used in exactly one place, refundQuestion below:
//     giving back a question that was counted when the model call then failed.
//     That client is made for that one call and touches nothing else.
// And one for the log: logEvent below is the only console call in this folder,
// and it can only write the fields it names.
import { createClient } from "npm:@supabase/supabase-js@2";
import { dispatch } from "./ask.ts";
import type { LogFields } from "./ask.ts";
import type { RpcFn } from "./anthropic.ts";
import type { Tier } from "./quota.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status: number, requestId: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "x-request-id": requestId,
    },
  });
}

// The one place anything is logged: a request id, an event word, the tier,
// counts, a status and the kind of an error. Each field is copied by name, so
// a caller cannot add a prompt, a question, a tool result or an answer to it.
function logEvent(fields: LogFields) {
  console.log(
    JSON.stringify({
      fn: "ask-fitven",
      requestId: fields.requestId,
      event: fields.event,
      action: fields.action,
      tier: fields.tier,
      inputTokens: fields.inputTokens,
      outputTokens: fields.outputTokens,
      toolCalls: fields.toolCalls,
      status: fields.status,
      errorKind: fields.errorKind,
    })
  );
}

// "ai.list_workouts" -> client.schema("ai").rpc("list_workouts", args);
// "public.ai_get_consent" -> client.rpc("ai_get_consent", args). Only these two
// schemas.
function makeRpc(client: ReturnType<typeof createClient>): RpcFn {
  return async (name, args) => {
    const dot = name.indexOf(".");
    const schema = name.slice(0, dot);
    const fn = name.slice(dot + 1);

    if (schema === "public") {
      const { data, error } = await client.rpc(fn, args ?? {});

      return { data, error };
    }

    if (schema === "ai") {
      const { data, error } = await client.schema("ai").rpc(fn, args ?? {});

      return { data, error };
    }

    throw new Error("Unknown schema");
  };
}

// The one use of the service-role key. Not for reading anything.
async function refundQuestion(userId: string, tier: Tier) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error("No service role configured");
  }

  const service = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await service.rpc("ai_refund_question", { p_user: userId, p_tier: tier });

  if (error) {
    throw new Error("Refund failed");
  }
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, requestId);
  }

  try {
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "bad_request" }, 400, requestId);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse({ error: "bad_request" }, 400, requestId);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !anonKey) {
      logEvent({ requestId, event: "config", status: 500, errorKind: "no_supabase_env" });

      return jsonResponse({ error: "error" }, 500, requestId);
    }

    const authorization = req.headers.get("Authorization") ?? "";
    const token = authorization.match(/^Bearer\s+(\S+)$/i)?.[1];

    if (!token) {
      return jsonResponse({ error: "unauthorized" }, 401, requestId);
    }

    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: auth, error: authError } = await client.auth.getUser(token);
    const userId = auth?.user?.id;

    if (authError || !userId) {
      return jsonResponse({ error: "unauthorized" }, 401, requestId);
    }

    const reply = await dispatch(
      {
        requestId,
        rpc: makeRpc(client),
        refund: (tier) => refundQuestion(userId, tier),
        fetchFn: (url, init) => fetch(url, init),
        env: (name) => Deno.env.get(name),
        now: () => Date.now(),
        log: logEvent,
      },
      body as Record<string, unknown>
    );

    return jsonResponse(reply.body, reply.status, requestId);
  } catch {
    // Only the fact is logged, never the error: it could hold anything.
    logEvent({ requestId, event: "unhandled", status: 500, errorKind: "internal" });

    return jsonResponse({ error: "error" }, 500, requestId);
  }
});
