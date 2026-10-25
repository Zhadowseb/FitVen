// The eight read tools the model may call, and the one way a tool call turns
// into a database call. Pure - no Deno, no network - so
// scripts/test-ask-fitven-edge.js runs this file in Node.
//
// This is the whole "what can the model reach" surface:
//   - A tool is one Postgres function in schema `ai` (ai.<tool name>). There is
//     no other way to the data, and a name that is not in TOOLS is rejected.
//   - No tool has a user id argument; the SQL functions filter on
//     (select auth.uid()) themselves. An argument that is not declared below is
//     rejected, so a model that adds `user_id` gets an error, not a call.
//   - Ranges are capped at two years and `max` at 60 rows before the call.
//   - There is no tool for sickness (docs/ASK-FITVEN.md, decision 3).

export const MAX_RANGE_DAYS = 731; // two years
export const MAX_ROWS = 60;
export const DEFAULT_ROWS = 30;
export const MAX_NAME_LENGTH = 100;

export const AI_SCHEMA = "ai";

// "respond" is not a data tool: it is how the model hands in its final answer
// (see anthropic.ts). It is named here so no data tool can take its name.
export const RESPOND_TOOL_NAME = "respond";

type ArgKind = "from" | "to" | "max" | "workout_id" | "exercise_name";

type ArgSpec = {
  // The argument the model sends.
  kind: ArgKind;
  // The parameter name the SQL function declares. A parameter named `from` or
  // `to` is not possible in SQL, so every parameter is prefixed `p_`
  // (public.ai_claim_question(p_tier) does the same). If the migration names
  // them otherwise, this table is the one place to change.
  param: string;
  required: boolean;
};

type ToolSpec = {
  description: string;
  args: ArgSpec[];
  // How far back `from` goes when the model leaves it out.
  defaultSpanDays: number;
};

const FROM = (): ArgSpec => ({ kind: "from", param: "p_from", required: false });
const TO = (): ArgSpec => ({ kind: "to", param: "p_to", required: false });
const MAX = (): ArgSpec => ({ kind: "max", param: "p_max", required: false });
const NAME = (required: boolean): ArgSpec => ({
  kind: "exercise_name",
  param: "p_exercise_name",
  required,
});

export const TOOLS: Record<string, ToolSpec> = {
  profile_summary: {
    description:
      "A short profile of the person's training: date of the first workout, workouts in the last 4 and 12 weeks, the active program and its status, the split's workout names, the unit and the daily step zone. Call it first when you need to orient yourself.",
    args: [],
    defaultSpanDays: 0,
  },
  list_workouts: {
    description:
      "The person's workouts in a date range, newest first: id, date, label, type, minutes, sets done, exercise names and how many personal records it held. Capped at 60 workouts; a capped result says truncated. Use workout_detail for the sets of one workout.",
    args: [FROM(), TO(), MAX()],
    defaultSpanDays: 90,
  },
  workout_detail: {
    description:
      "One of the person's workouts by id (an id from list_workouts): its exercises with every set (reps, weight, type, done, failed, RPE) and the exercise notes. Returns null when there is no such workout.",
    args: [{ kind: "workout_id", param: "p_workout_id", required: true }],
    defaultSpanDays: 0,
  },
  exercise_history: {
    description:
      "How one exercise went over time, per session: date, top set, estimated 1RM (Brzycki, up to 12 reps), volume and number of sets. The exercise is matched by name against the person's own exercises.",
    args: [NAME(true), FROM(), TO()],
    defaultSpanDays: 365,
  },
  personal_records: {
    description:
      "The personal records the app has flagged: exercise, reps, weight and date. Give an exercise name for one exercise, or none for all of them.",
    args: [NAME(false)],
    defaultSpanDays: 0,
  },
  weekly_volume: {
    description:
      "Sets per week for each exercise name in a date range. Use it for questions about volume, balance between muscle groups, or how training load changed.",
    args: [FROM(), TO()],
    defaultSpanDays: 84,
  },
  program_overview: {
    description:
      "The active program: its blocks, weeks and days with the planned workouts and their exercises. Use it for what is planned and what comes next.",
    args: [],
    defaultSpanDays: 0,
  },
  daily_steps: {
    description:
      "Steps per day in a date range, with where the number came from.",
    args: [FROM(), TO()],
    defaultSpanDays: 30,
  },
};

export const TOOL_NAMES: string[] = Object.keys(TOOLS);

export function isToolName(name: unknown): name is string {
  return typeof name === "string" && Object.prototype.hasOwnProperty.call(TOOLS, name);
}

// The Postgres function a tool is: "ai.list_workouts". null for a name that is
// not one of the eight.
export function rpcNameForTool(name: unknown): string | null {
  return isToolName(name) ? `${AI_SCHEMA}.${name}` : null;
}

const ARG_SCHEMAS: Record<ArgKind, Record<string, unknown>> = {
  from: {
    type: "string",
    description:
      "First day to include, YYYY-MM-DD. Ranges are capped at two years; leave it out for a sensible default.",
  },
  to: {
    type: "string",
    description: "Last day to include, YYYY-MM-DD. Defaults to today.",
  },
  max: {
    type: "integer",
    minimum: 1,
    maximum: MAX_ROWS,
    description: "How many rows at most (1 to 60). Defaults to 30.",
  },
  workout_id: {
    type: "integer",
    minimum: 1,
    description: "The id of one of the person's workouts, from list_workouts.",
  },
  exercise_name: {
    type: "string",
    maxLength: MAX_NAME_LENGTH,
    description: "The exercise's name, e.g. Bench Press.",
  },
};

export type ToolDefinition = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

function toolDefinition(name: string): ToolDefinition {
  const spec = TOOLS[name];
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const arg of spec.args) {
    properties[arg.kind] = ARG_SCHEMAS[arg.kind];

    if (arg.required) {
      required.push(arg.kind);
    }
  }

  return {
    name,
    description: spec.description,
    input_schema: {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    },
  };
}

// The eight, in the order of the contract.
export const DATA_TOOLS: ToolDefinition[] = TOOL_NAMES.map(toolDefinition);

// The final answer, as a tool: the API then hands over a parsed object instead
// of JSON inside text. The shape is checked again by validate.ts - this schema
// only steers the model.
export const RESPOND_TOOL: ToolDefinition = {
  name: RESPOND_TOOL_NAME,
  description:
    "Give the person your final answer. Call this exactly once, on its own, after you have the data you need. text is the answer in the person's language; blocks are optional charts and suggestions; sources says what the answer rests on, or null.",
  input_schema: {
    type: "object",
    properties: {
      text: { type: "string", description: "The answer, short, in the person's language." },
      blocks: {
        type: "array",
        maxItems: 3,
        description:
          "At most three blocks. A chart: {type:'chart', title, range, unit, summary, series:[{x:'YYYY-MM-DD', y:number}]} whose y values are copied exactly from tool results. A suggestion: {type:'suggestion', target:{kind:'next_workout', label}, change:{exercise, sets:[{reps, weight, count}]}, text}.",
        items: { type: "object" },
      },
      sources: {
        type: ["object", "null"],
        description:
          "{label, count, range, link:{screen:'RecordsExercise', exercise}} when the answer rests on logged sessions; null when it does not.",
      },
    },
    required: ["text"],
  },
};

export const ALL_TOOLS: ToolDefinition[] = [...DATA_TOOLS, RESPOND_TOOL];

export type PreparedCall =
  | { ok: true; name: string; rpc: string; args: Record<string, unknown> }
  | { ok: false; error: string };

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// A real calendar day as UTC midnight in ms, or null.
export function parseDay(value: unknown): number | null {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    return null;
  }

  const ms = Date.parse(`${value}T00:00:00Z`);

  if (!Number.isFinite(ms)) {
    return null;
  }

  // 2026-02-31 parses in some engines as March 3rd; it is not a day.
  return new Date(ms).toISOString().slice(0, 10) === value ? ms : null;
}

export function formatDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function fail(error: string): PreparedCall {
  return { ok: false, error };
}

// Checks what the model sent for a tool and turns it into the RPC to make:
// the function name, and its arguments under the SQL parameter names. Never
// throws; a refusal is { ok: false, error } and the error goes back to the
// model as a tool result it can correct.
//
// `today` is the person's local date (YYYY-MM-DD); it anchors defaults.
export function prepareToolCall(name: unknown, input: unknown, today: string): PreparedCall {
  if (!isToolName(name)) {
    return fail("Unknown tool. Use one of: " + TOOL_NAMES.join(", ") + ".");
  }

  const spec = TOOLS[name];
  let raw: Record<string, unknown> = {};

  if (input !== undefined && input !== null) {
    if (typeof input !== "object" || Array.isArray(input)) {
      return fail("The arguments must be an object.");
    }

    raw = input as Record<string, unknown>;
  }

  const allowed = spec.args.map((arg) => arg.kind as string);

  for (const key of Object.keys(raw)) {
    if (!allowed.includes(key)) {
      return fail(
        `Unknown argument "${key.slice(0, 40)}". ${name} takes ${
          allowed.length ? allowed.join(", ") : "no arguments"
        }.`
      );
    }
  }

  const args: Record<string, unknown> = {};

  // The one tool that needs the person's own date from outside the model: the
  // last four weeks and twelve weeks are counted back from it, not from the
  // server's clock.
  if (name === "profile_summary" && /^\d{4}-\d{2}-\d{2}$/.test(String(today))) {
    args["p_today"] = today;
  }

  const paramOf = (kind: ArgKind) => spec.args.find((arg) => arg.kind === kind)?.param;

  // Dates: from/to together, so the range cap can be applied to both.
  const fromParam = paramOf("from");
  const toParam = paramOf("to");

  if (fromParam && toParam) {
    const todayMs = parseDay(today) ?? parseDay(new Date().toISOString().slice(0, 10));

    if (todayMs === null) {
      return fail("No usable date.");
    }

    let toMs = todayMs;
    let fromMs: number | null = null;

    if (raw.to !== undefined && raw.to !== null) {
      const parsed = parseDay(raw.to);

      if (parsed === null) {
        return fail('"to" must be a real date, YYYY-MM-DD.');
      }

      toMs = parsed;
    }

    if (raw.from !== undefined && raw.from !== null) {
      fromMs = parseDay(raw.from);

      if (fromMs === null) {
        return fail('"from" must be a real date, YYYY-MM-DD.');
      }
    } else {
      fromMs = toMs - spec.defaultSpanDays * DAY_MS;
    }

    if (fromMs > toMs) {
      const swap = fromMs;

      fromMs = toMs;
      toMs = swap;
    }

    if (toMs - fromMs > MAX_RANGE_DAYS * DAY_MS) {
      fromMs = toMs - MAX_RANGE_DAYS * DAY_MS;
    }

    args[fromParam] = formatDay(fromMs);
    args[toParam] = formatDay(toMs);
  }

  const maxParam = paramOf("max");

  if (maxParam) {
    let max = DEFAULT_ROWS;

    if (raw.max !== undefined && raw.max !== null) {
      if (typeof raw.max !== "number" || !Number.isFinite(raw.max)) {
        return fail('"max" must be a number from 1 to 60.');
      }

      max = Math.floor(raw.max);
    }

    args[maxParam] = Math.min(MAX_ROWS, Math.max(1, max));
  }

  const idParam = paramOf("workout_id");

  if (idParam) {
    const id = raw.workout_id;
    const asNumber =
      typeof id === "string" && /^\d{1,15}$/.test(id) ? Number(id) : id;

    if (typeof asNumber !== "number" || !Number.isSafeInteger(asNumber) || asNumber < 1) {
      return fail('"workout_id" must be a positive whole number from list_workouts.');
    }

    args[idParam] = asNumber;
  }

  const nameParam = paramOf("exercise_name");

  if (nameParam) {
    const required = spec.args.find((arg) => arg.kind === "exercise_name")?.required;
    const value = raw.exercise_name;

    if (value === undefined || value === null || value === "") {
      if (required) {
        return fail('"exercise_name" is required.');
      }
    } else if (typeof value !== "string") {
      return fail('"exercise_name" must be text.');
    } else {
      // eslint-disable-next-line no-control-regex
      const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();

      if (!cleaned) {
        if (required) {
          return fail('"exercise_name" is required.');
        }
      } else {
        args[nameParam] = cleaned.slice(0, MAX_NAME_LENGTH);
      }
    }
  }

  return { ok: true, name, rpc: `${AI_SCHEMA}.${name}`, args };
}
