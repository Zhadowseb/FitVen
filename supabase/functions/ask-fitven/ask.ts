// What ask-fitven does for a request once the caller is known: usage,
// recommend and ask, in the order the contract (docs/ASK-FITVEN.md) gives.
//
// This file is pure as far as Deno and Supabase go - the database call, the
// refund, fetch, the environment, the clock and the log are all handed in - so
// scripts/test-ask-fitven-edge.js runs the whole flow in Node against fakes:
// the order of consent, claim and model call, and that a question is refunded
// exactly once when the model call fails and not at all when the request fails
// before the claim. ./index.ts is the Deno glue around it.

import { completeText, runToolLoop, ProviderError, TOTAL_BUDGET_MS } from "./anthropic.ts";
import type { FetchFn, ProviderDeps, RpcFn } from "./anthropic.ts";
import { buildSystemPrompt } from "./prompt.ts";
import { modelForTier, readUsage } from "./quota.ts";
import type { EnvReader, Tier, Usage } from "./quota.ts";
import { parseAsk, parseRecommend } from "./request.ts";
import { recommendTier } from "./router.ts";
import type { Complete } from "./router.ts";
import { validateAnswer } from "./validate.ts";

// The only things that are ever logged: a request id, a fixed event word, the
// tier, counts, a status and the kind of an error. Never a prompt, a question,
// a tool result or an answer - there is no field to put one in.
export type LogFields = {
  requestId: string;
  event: string;
  action?: string;
  tier?: string;
  inputTokens?: number;
  outputTokens?: number;
  toolCalls?: number;
  status?: number;
  errorKind?: string;
};

export type AskDeps = {
  requestId: string;
  // Database calls as the caller, by "schema.function" ("ai.list_workouts",
  // "public.ai_claim_question").
  rpc: RpcFn;
  // Gives back a question that was counted. index.ts makes this the one place a
  // service-role client exists. Throws when it cannot.
  refund: (tier: Tier) => Promise<void>;
  fetchFn: FetchFn;
  env: EnvReader;
  now: () => number;
  log: (fields: LogFields) => void;
};

export type Reply = { status: number; body: Record<string, unknown> };

// The router is a cheap call; it must not make the app wait.
export const ROUTER_TIMEOUT_MS = 12_000;
export const ROUTER_MAX_TOKENS = 120;

function reply(status: number, body: Record<string, unknown>): Reply {
  return { status, body };
}

function failure(status: number, code: string, extra: Record<string, unknown> = {}): Reply {
  return reply(status, { error: code, ...extra });
}

async function readUsageSummary(deps: AskDeps): Promise<Usage | null> {
  try {
    const { data, error } = await deps.rpc("public.ai_usage_summary");

    return error ? null : readUsage(data);
  } catch {
    return null;
  }
}

// null: could not be read. false: has not said yes.
async function readConsent(deps: AskDeps): Promise<boolean | null> {
  try {
    const { data, error } = await deps.rpc("public.ai_get_consent");

    if (error) {
      return null;
    }

    const value = Array.isArray(data) ? data[0] : data;

    return value !== null && value !== undefined && value !== false && value !== "";
  } catch {
    return null;
  }
}

function apiKeyOf(deps: AskDeps): string | null {
  const key = deps.env("ANTHROPIC_API_KEY");

  return typeof key === "string" && key.trim() ? key.trim() : null;
}

export async function handleUsage(deps: AskDeps): Promise<Reply> {
  const usage = await readUsageSummary(deps);

  deps.log({ requestId: deps.requestId, event: "usage", status: usage ? 200 : 500 });

  return usage ? reply(200, { usage }) : failure(500, "error");
}

export async function handleRecommend(deps: AskDeps, body: Record<string, unknown>): Promise<Reply> {
  const parsed = parseRecommend(body);

  if (!parsed.ok) {
    return failure(400, "bad_request");
  }

  const apiKey = apiKeyOf(deps);
  // The question only goes to the provider once the person has said yes to
  // that; without a yes (or a key) the rule decides and nothing leaves.
  const consent = apiKey ? await readConsent(deps) : false;
  let inputTokens = 0;
  let outputTokens = 0;
  let complete: Complete | null = null;

  if (apiKey && consent === true) {
    const provider: ProviderDeps = {
      fetchFn: deps.fetchFn,
      apiKey,
      timeoutMs: ROUTER_TIMEOUT_MS,
    };
    const model = modelForTier("haiku", deps.env);

    complete = async (system, userText) => {
      const result = await completeText(provider, {
        model,
        system,
        userText,
        maxTokens: ROUTER_MAX_TOKENS,
      });

      inputTokens += result.inputTokens;
      outputTokens += result.outputTokens;

      return result.text;
    };
  }

  const recommendation = await recommendTier(parsed.question, complete);
  const usage = await readUsageSummary(deps);

  deps.log({
    requestId: deps.requestId,
    event: "recommend",
    tier: recommendation.tier,
    inputTokens,
    outputTokens,
    status: 200,
  });

  return reply(200, { tier: recommendation.tier, reason: recommendation.reason, usage });
}

// Counts one question for the caller. { allowed, used, limit } - one object, or
// a one-row array when the function was declared as returning a table.
async function claimQuestion(deps: AskDeps, tier: Tier): Promise<boolean | null> {
  try {
    const { data, error } = await deps.rpc("public.ai_claim_question", { p_tier: tier });

    if (error) {
      return null;
    }

    const row = Array.isArray(data) ? data[0] : data;

    return !!row && typeof row === "object" && (row as Record<string, unknown>).allowed === true;
  } catch {
    return null;
  }
}

export async function handleAsk(deps: AskDeps, body: Record<string, unknown>): Promise<Reply> {
  const startedAt = deps.now();
  const parsed = parseAsk(body, new Date(startedAt));

  if (!parsed.ok) {
    return failure(400, "bad_request");
  }

  const { tier, turns, context } = parsed;
  const apiKey = apiKeyOf(deps);

  // Before anything is counted: a function with no key cannot answer.
  if (!apiKey) {
    deps.log({ requestId: deps.requestId, event: "ask", tier, status: 503, errorKind: "no_api_key" });

    return failure(503, "unavailable");
  }

  const consent = await readConsent(deps);

  if (consent === null) {
    return failure(500, "error");
  }

  if (!consent) {
    return failure(403, "consent_required");
  }

  const allowed = await claimQuestion(deps, tier);

  if (allowed === null) {
    return failure(500, "error");
  }

  if (!allowed) {
    deps.log({ requestId: deps.requestId, event: "ask", tier, status: 429 });

    return failure(429, "quota_exceeded", { tier, usage: await readUsageSummary(deps) });
  }

  // From here a question has been counted: every way out that is not an answer
  // gives it back, once.
  try {
    const result = await runToolLoop({
      provider: {
        fetchFn: deps.fetchFn,
        apiKey,
        deadline: { now: deps.now, at: startedAt + TOTAL_BUDGET_MS },
      },
      rpc: deps.rpc,
      model: modelForTier(tier, deps.env),
      system: buildSystemPrompt(context),
      turns,
      today: context.localDate,
    });
    const usage = await readUsageSummary(deps);
    const answer = validateAnswer(result.answer, result.toolResults, tier, usage);

    if (!answer) {
      throw new ProviderError("empty_answer");
    }

    deps.log({
      requestId: deps.requestId,
      event: "ask",
      tier,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      toolCalls: result.toolCalls,
      status: 200,
    });

    return reply(200, answer);
  } catch (error) {
    const providerError = error instanceof ProviderError ? error : null;
    // Only a fixed word is kept of what went wrong - never error.message,
    // which could hold anything.
    const errorKind = providerError ? providerError.kind : "internal";
    let refunded = false;

    try {
      await deps.refund(tier);
      refunded = true;
    } catch {
      deps.log({ requestId: deps.requestId, event: "refund_failed", tier, errorKind: "refund" });
    }

    const status = providerError ? (providerError.unavailable ? 503 : 502) : 500;

    deps.log({
      requestId: deps.requestId,
      event: refunded ? "ask_failed_refunded" : "ask_failed",
      tier,
      status,
      errorKind,
    });

    if (!providerError) {
      return failure(500, "error");
    }

    return providerError.unavailable ? failure(503, "unavailable") : failure(502, "provider_error");
  }
}

export async function dispatch(deps: AskDeps, body: Record<string, unknown>): Promise<Reply> {
  if (body.action === "usage") {
    return await handleUsage(deps);
  }

  if (body.action === "recommend") {
    return await handleRecommend(deps, body);
  }

  if (body.action === "ask") {
    return await handleAsk(deps, body);
  }

  return failure(400, "bad_request");
}
