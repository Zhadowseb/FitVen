// What a request to ask-fitven may contain, checked. Pure - no Deno, no
// network - so scripts/test-ask-fitven-edge.js runs this file in Node.
//
// `context` comes from the phone and ends up in the system prompt, so it is
// accepted only in strict formats and anything else is replaced by a default.
// A text field that could say "ignore your rules" never reaches the prompt.

import { isTier } from "./quota.ts";
import type { Tier } from "./quota.ts";
import { parseDay } from "./tools.ts";

export const LANGUAGES = ["en", "da", "sv", "nb", "de", "fr", "es"];
export const MAX_TURNS = 12;
export const MAX_TURN_LENGTH = 2000;

export type Language = "en" | "da" | "sv" | "nb" | "de" | "fr" | "es";

export type Turn = { role: "user" | "assistant"; text: string };

export type AskContext = {
  localDate: string; // YYYY-MM-DD
  localTime: string | null; // HH:MM
  timeZone: string;
  unit: "kg";
  language: Language;
};

export type ParsedAsk =
  | { ok: true; tier: Tier; turns: Turn[]; context: AskContext }
  | { ok: false; reason: string };

export type ParsedRecommend =
  | { ok: true; question: string; language: Language }
  | { ok: false; reason: string };

export function readLanguage(value: unknown): Language {
  return typeof value === "string" && LANGUAGES.includes(value) ? (value as Language) : "en";
}

export function normalizeContext(raw: unknown, now: Date): AskContext {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const localDate =
    typeof value.localDate === "string" && parseDay(value.localDate) !== null
      ? value.localDate
      : now.toISOString().slice(0, 10);
  const localTime =
    typeof value.localTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value.localTime)
      ? value.localTime
      : null;
  const timeZone =
    typeof value.timeZone === "string" && /^[A-Za-z][A-Za-z0-9_+\-/]{0,39}$/.test(value.timeZone)
      ? value.timeZone
      : "UTC";

  return {
    localDate,
    localTime,
    timeZone,
    // The app is kg-only today (the contract says "kg"); any other value is
    // not believed.
    unit: "kg",
    language: readLanguage(value.language),
  };
}

function cleanText(value: string, max: number): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max);
}

// The conversation as the provider wants it: it starts with a user turn, the
// roles alternate, and the last turn is the user's. Older turns past the last
// twelve are dropped and a turn is cut at 2,000 characters - the app already
// does both, this is the server not relying on it.
export function normalizeTurns(raw: unknown): Turn[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }

  const turns: Turn[] = [];

  for (const item of raw.slice(-MAX_TURNS)) {
    if (!item || typeof item !== "object") {
      return null;
    }

    const record = item as Record<string, unknown>;

    if (
      (record.role !== "user" && record.role !== "assistant") ||
      typeof record.text !== "string"
    ) {
      return null;
    }

    const text = cleanText(record.text, MAX_TURN_LENGTH);

    if (!text) {
      continue;
    }

    const last = turns[turns.length - 1];

    if (last && last.role === record.role) {
      last.text = `${last.text}\n\n${text}`;
    } else {
      turns.push({ role: record.role, text });
    }
  }

  while (turns.length && turns[0].role !== "user") {
    turns.shift();
  }

  if (!turns.length || turns[turns.length - 1].role !== "user") {
    return null;
  }

  return turns;
}

export function parseAsk(body: Record<string, unknown>, now: Date): ParsedAsk {
  if (!isTier(body.tier)) {
    return { ok: false, reason: "unknown tier" };
  }

  const turns = normalizeTurns(body.messages);

  if (!turns) {
    return { ok: false, reason: "no user message" };
  }

  return { ok: true, tier: body.tier, turns, context: normalizeContext(body.context, now) };
}

export function parseRecommend(body: Record<string, unknown>): ParsedRecommend {
  if (typeof body.question !== "string") {
    return { ok: false, reason: "no question" };
  }

  const question = cleanText(body.question, MAX_TURN_LENGTH);

  if (!question) {
    return { ok: false, reason: "no question" };
  }

  return { ok: true, question, language: readLanguage(body.language) };
}
