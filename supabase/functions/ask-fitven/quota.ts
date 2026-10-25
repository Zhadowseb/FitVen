// The three tiers of Ask FitVen: which model each one runs, and how the tier
// name in a request is checked. Pure - no Deno, no network - so
// scripts/test-ask-fitven-edge.js runs this file in Node.
//
// The monthly limits (10 / 5 / 2) are NOT here: they live in SQL
// (public.ai_tier_limit) so they change without a new deploy, and the edge
// function only ever asks public.ai_claim_question whether a question may be
// asked. What is here is the model for each tier.

export type Tier = "haiku" | "sonnet" | "opus";

export const TIERS: Tier[] = ["haiku", "sonnet", "opus"];

export const DEFAULT_MODELS: Record<Tier, string> = {
  haiku: "claude-haiku-5-5",
  sonnet: "claude-sonnet-5-5",
  opus: "claude-opus-5-5",
};

// The Supabase secret that replaces a tier's model without a code change.
export const MODEL_ENV_NAMES: Record<Tier, string> = {
  haiku: "ASK_MODEL_HAIKU",
  sonnet: "ASK_MODEL_SONNET",
  opus: "ASK_MODEL_OPUS",
};

// Reads one environment variable. Deno.env.get in index.ts, a plain lookup in
// the tests - this module never touches Deno itself.
export type EnvReader = (name: string) => string | undefined;

export function isTier(value: unknown): value is Tier {
  return value === "haiku" || value === "sonnet" || value === "opus";
}

export function modelForTier(tier: Tier, env: EnvReader): string {
  const override = env(MODEL_ENV_NAMES[tier]);
  const trimmed = typeof override === "string" ? override.trim() : "";

  // A model id is a short token; anything else is a typo in a secret and must
  // not become part of an API request.
  if (trimmed && trimmed.length <= 100 && /^[A-Za-z0-9._:-]+$/.test(trimmed)) {
    return trimmed;
  }

  return DEFAULT_MODELS[tier];
}

// The Usage object the contract returns: { month, tiers: { haiku: {used, limit}, ... } }.
export type TierUsage = { used: number; limit: number };
export type Usage = { month: string; tiers: Record<Tier, TierUsage> };

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : null;
}

// What public.ai_usage_summary() returned, checked and re-shaped. null when it
// is not a Usage - the caller then sends usage: null rather than a guess.
export function readUsage(raw: unknown): Usage | null {
  const value = Array.isArray(raw) ? raw[0] : raw;

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const tiers = record.tiers as Record<string, unknown> | null | undefined;

  if (typeof record.month !== "string" || !tiers || typeof tiers !== "object") {
    return null;
  }

  const result = { month: record.month, tiers: {} as Record<Tier, TierUsage> };

  for (const tier of TIERS) {
    const entry = tiers[tier] as Record<string, unknown> | null | undefined;
    const used = count(entry?.used);
    const limit = count(entry?.limit);

    if (used === null || limit === null) {
      return null;
    }

    result.tiers[tier] = { used, limit };
  }

  return result;
}
