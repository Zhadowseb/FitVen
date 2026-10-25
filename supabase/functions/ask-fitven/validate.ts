// The checks every answer passes before it leaves the function. Pure - no
// Deno, no network - so scripts/test-ask-fitven-edge.js runs this file in Node.
//
// Whatever the model sent - a parsed `respond` call, JSON in plain text, or
// plain text - comes out as the contract's shape:
//   { text, blocks, sources, tier, usage }
// with unknown block types dropped, a chart whose numbers are not in this
// turn's tool results dropped, and every limit applied.

import type { Tier, Usage } from "./quota.ts";

export const MAX_TEXT_LENGTH = 4000;
export const MAX_BLOCKS = 3;
export const MAX_CHART_POINTS = 60;
export const MAX_SUGGESTION_SETS = 6;

export type ChartBlock = {
  type: "chart";
  title: string;
  range: string;
  series: { x: string; y: number }[];
  unit: string;
  summary: string;
};

export type SuggestionBlock = {
  type: "suggestion";
  target: { kind: "next_workout"; label: string };
  change: { exercise: string; sets: { reps: number; weight: number; count: number }[] };
  text: string;
};

export type Block = ChartBlock | SuggestionBlock;

export type Sources = {
  label: string;
  count: number | null;
  range: string | null;
  link: { screen: "RecordsExercise"; exercise: string } | null;
};

export type AskAnswer = {
  text: string;
  blocks: Block[];
  sources: Sources | null;
  tier: Tier;
  usage: Usage | null;
};

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function str(value: unknown, max: number): string {
  if (typeof value !== "string") {
    return "";
  }

  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------- grounding --

// A number is compared to two decimals, the precision the app shows.
function numberKey(value: number): number {
  return Math.round(value * 100);
}

// Every number in this turn's tool results. Numbers are read from values, not
// from text, so a note that says "112 113 114" grants nothing. The one text
// case is a result that was too long to send whole: index/anthropic.ts then
// keeps the cut text as a top-level string, and its numbers count, because
// those are the numbers the model actually saw.
export function collectNumbers(results: unknown[]): Set<number> {
  const keys = new Set<number>();
  const stack: unknown[] = [];

  for (const result of results) {
    if (typeof result === "string") {
      const found = result.match(/-?\d+(?:\.\d+)?/g) ?? [];

      for (const piece of found) {
        keys.add(numberKey(Number(piece)));
      }
    } else {
      stack.push(result);
    }
  }

  while (stack.length) {
    const value = stack.pop();

    if (typeof value === "number") {
      if (Number.isFinite(value)) {
        keys.add(numberKey(value));
      }
    } else if (Array.isArray(value)) {
      for (const item of value) {
        stack.push(item);
      }
    } else if (isRecord(value)) {
      for (const key of Object.keys(value)) {
        stack.push(value[key]);
      }
    }
  }

  return keys;
}

// ------------------------------------------------------------- blocks --

function readChart(raw: Json, numbers: Set<number>): ChartBlock | null {
  const title = str(raw.title, 120);

  if (!title || !Array.isArray(raw.series)) {
    return null;
  }

  const series: { x: string; y: number }[] = [];

  for (const point of raw.series) {
    if (!isRecord(point) || typeof point.y !== "number" || !Number.isFinite(point.y)) {
      return null;
    }

    const x = typeof point.x === "number" ? String(point.x) : str(point.x, 40);

    if (!x) {
      return null;
    }

    // One number the tool results do not hold drops the whole chart: a chart
    // with an invented point is worse than no chart.
    if (!numbers.has(numberKey(point.y))) {
      return null;
    }

    series.push({ x, y: point.y });
  }

  if (!series.length) {
    return null;
  }

  return {
    type: "chart",
    title,
    range: str(raw.range, 60),
    // Only the most recent points when there are too many.
    series: series.length > MAX_CHART_POINTS ? series.slice(-MAX_CHART_POINTS) : series,
    unit: str(raw.unit, 12) || "kg",
    summary: str(raw.summary, 160),
  };
}

function readSets(raw: unknown): { reps: number; weight: number; count: number }[] | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_SUGGESTION_SETS) {
    return null;
  }

  const sets: { reps: number; weight: number; count: number }[] = [];

  for (const item of raw) {
    if (!isRecord(item)) {
      return null;
    }

    const reps = item.reps;
    const weight = item.weight;
    // A set group with no count is one set.
    const count = item.count === undefined || item.count === null ? 1 : item.count;

    if (
      typeof reps !== "number" ||
      !Number.isInteger(reps) ||
      reps < 1 ||
      reps > 100 ||
      typeof weight !== "number" ||
      !Number.isFinite(weight) ||
      weight < 0 ||
      weight > 1000 ||
      typeof count !== "number" ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > 10
    ) {
      return null;
    }

    sets.push({ reps, weight: round2(weight), count });
  }

  return sets;
}

function describeSets(exercise: string, sets: { reps: number; weight: number; count: number }[]) {
  return `${exercise}: ${sets
    .map((set) => `${set.count} × ${set.reps} at ${set.weight} kg`)
    .join(", then ")}`;
}

function readSuggestion(raw: Json): SuggestionBlock | null {
  const target = raw.target;
  const change = raw.change;

  if (!isRecord(target) || !isRecord(change)) {
    return null;
  }

  // The app can apply a change to the next planned workout of that name and
  // nothing else.
  if (target.kind !== undefined && target.kind !== "next_workout") {
    return null;
  }

  const label = str(target.label, 60);
  const exercise = str(change.exercise, 100);
  const sets = readSets(change.sets);

  if (!label || !exercise || !sets) {
    return null;
  }

  return {
    type: "suggestion",
    target: { kind: "next_workout", label },
    change: { exercise, sets },
    text: str(raw.text, 300) || describeSets(exercise, sets),
  };
}

export function validateBlocks(raw: unknown, numbers: Set<number>): Block[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const blocks: Block[] = [];

  for (const item of raw) {
    if (blocks.length >= MAX_BLOCKS) {
      break;
    }

    if (!isRecord(item)) {
      continue;
    }

    let block: Block | null = null;

    if (item.type === "chart") {
      block = readChart(item, numbers);
    } else if (item.type === "suggestion") {
      block = readSuggestion(item);
    }

    // Any other type is dropped.
    if (block) {
      blocks.push(block);
    }
  }

  return blocks;
}

export function validateSources(raw: unknown): Sources | null {
  if (!isRecord(raw)) {
    return null;
  }

  const label = str(raw.label, 160);

  if (!label) {
    return null;
  }

  const count =
    typeof raw.count === "number" && Number.isInteger(raw.count) && raw.count >= 0
      ? raw.count
      : null;

  // "null when the answer rests on no sessions".
  if (count === 0) {
    return null;
  }

  let link: Sources["link"] = null;

  if (isRecord(raw.link) && raw.link.screen === "RecordsExercise") {
    const exercise = str(raw.link.exercise, 100);

    if (exercise) {
      link = { screen: "RecordsExercise", exercise };
    }
  }

  return { label, count, range: str(raw.range, 60) || null, link };
}

// ------------------------------------------------------------- answers --

// The model's final text, when it did not use the respond tool: JSON (maybe in
// a code fence, maybe with a sentence around it) or plain words. Returns the
// object to validate, or the trimmed text wrapped as a text-only answer. This
// is the fallback the contract names: { text: <raw text trimmed>, blocks: [],
// sources: null }.
export function parseModelText(raw: string): Json {
  const trimmed = raw.trim();
  const candidates = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fenced) {
    candidates.push(fenced[1].trim());
  }

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");

  if (first !== -1 && last > first) {
    candidates.push(trimmed.slice(first, last + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);

      if (isRecord(parsed) && typeof parsed.text === "string") {
        return parsed;
      }
    } catch {
      // not JSON; try the next reading
    }
  }

  return { text: trimmed, blocks: [], sources: null };
}

// What the model handed in (the input of a respond call, or parseModelText's
// result) as the contract's answer. null when there is no text at all, which
// the caller treats as a failed model call (and refunds).
export function validateAnswer(
  raw: unknown,
  toolResults: unknown[],
  tier: Tier,
  usage: Usage | null
): AskAnswer | null {
  if (!isRecord(raw)) {
    return null;
  }

  const text = str(raw.text, MAX_TEXT_LENGTH);

  if (!text) {
    return null;
  }

  const numbers = collectNumbers(toolResults);

  return {
    text,
    blocks: validateBlocks(raw.blocks, numbers),
    sources: validateSources(raw.sources),
    tier,
    usage,
  };
}
