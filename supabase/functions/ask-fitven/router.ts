// The recommend step: which tier should answer this question. Pure - no Deno,
// no network - so scripts/test-ask-fitven-edge.js runs this file in Node.
//
// A small Haiku call with no tools and no user data is asked for one tier; if
// that call fails, times out or answers nonsense, a deterministic rule decides.
// recommendTier never throws and never fails the request.

import { buildRouterPrompt } from "./prompt.ts";
import { isTier } from "./quota.ts";
import type { Tier } from "./quota.ts";

export type Recommendation = { tier: Tier; reason: string };

// One model call: a system prompt and the question in, the model's text out.
// anthropic.ts provides the real one; the tests provide a fake.
export type Complete = (system: string, userText: string) => Promise<string>;

// Asking for something to be made - a plan, a program: opus.
const PLAN_WORDS = [
  "build me",
  "make me a",
  "make a ",
  "create a",
  "design a",
  "write me",
  "periodi",
  "mesocycle",
  "roadmap",
  "overhaul",
  "step by step",
  "lav mig",
  "lav en",
  "lav et",
  "planlæg",
  "skriv en",
  "byg ",
  "erstelle",
  "entwirf",
  "planifica",
  "crée",
  "skapa",
  "lag en",
];

// A plan or a program over a stretch of weeks or months is a plan to make.
const PLAN_NOUNS = ["plan", "program", "split", "træningsplan", "trainingsplan"];
const STRETCH = /\d+\s*(week|month|uge|måned|vecka|woche|semaine|semana)/;

// Words that ask for an analysis (several of them is a multi-step analysis).
const ANALYSIS_WORDS = [
  "analy",
  "review",
  "audit",
  "evaluate",
  "everything",
  "all my",
  "whole",
  "overall",
  "balance",
  "imbalance",
  "fix",
  "improve",
  "optimi",
  "gennemgå",
  " alt ",
  "hele",
  "forbedr",
  "analys",
  "gesamt",
  "analiz",
];

// A comparison, or a "why" over weeks: sonnet.
const COMPARE_WORDS = [
  "why",
  "compare",
  "versus",
  " vs ",
  "trend",
  "progress",
  "stuck",
  "plateau",
  "stall",
  "over time",
  "weeks",
  "months",
  "since",
  "last year",
  "better",
  "worse",
  "hvorfor",
  "sammenlign",
  "fremgang",
  "uger",
  "måneder",
  "siden",
  "stagner",
  " fast ",
  "varför",
  "warum",
  "pourquoi",
  "por qué",
];

const REASONS: Record<Tier, string> = {
  haiku: "A short lookup",
  sonnet: "A comparison or a why over weeks",
  opus: "A plan or a multi-step analysis",
};

function countHits(text: string, words: string[]): number {
  let hits = 0;

  for (const word of words) {
    if (text.includes(word)) {
      hits += 1;
    }
  }

  return hits;
}

// The rule used when the router call fails. Short lookup -> haiku, a
// comparison or a "why" over weeks -> sonnet, a plan or several steps of
// analysis -> opus.
export function fallbackRecommendation(question: string): Recommendation {
  const text = ` ${question.toLowerCase()} `;
  const length = question.trim().length;
  let tier: Tier = "haiku";

  if (
    countHits(text, PLAN_WORDS) > 0 ||
    (countHits(text, PLAN_NOUNS) > 0 && STRETCH.test(text)) ||
    countHits(text, ANALYSIS_WORDS) >= 2 ||
    length > 240
  ) {
    tier = "opus";
  } else if (countHits(text, COMPARE_WORDS) > 0 || countHits(text, ANALYSIS_WORDS) > 0 || length > 80) {
    tier = "sonnet";
  }

  return { tier, reason: REASONS[tier] };
}

// The router model's answer: {"tier": "...", "reason": "..."}, maybe in a code
// fence. null when it is not one of the three tiers.
export function parseRouterAnswer(raw: string): Recommendation | null {
  const trimmed = raw.trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");

  if (first === -1 || last <= first) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed.slice(first, last + 1)) as Record<string, unknown>;

    if (!isTier(parsed.tier)) {
      return null;
    }

    const reason = typeof parsed.reason === "string"
      ? parsed.reason.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80)
      : "";

    return { tier: parsed.tier, reason: reason || REASONS[parsed.tier] };
  } catch {
    return null;
  }
}

export async function recommendTier(
  question: string,
  complete: Complete | null
): Promise<Recommendation> {
  if (complete) {
    try {
      const answer = parseRouterAnswer(await complete(buildRouterPrompt(), question));

      if (answer) {
        return answer;
      }
    } catch {
      // The rule below decides. Nothing about the failure is kept: the
      // question must not end up in a log.
    }
  }

  return fallbackRecommendation(question);
}
