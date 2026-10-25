// The Anthropic Messages API over fetch, and the tool loop on top of it. Pure
// as far as Deno goes - fetch and the database call are handed in - so
// scripts/test-ask-fitven-edge.js runs this file in Node with a fake of each.
//
// THE ANSWER FORMAT. The final answer comes back through a `respond` tool whose
// input is { text, blocks, sources }, not as JSON written inside text. A tool
// call arrives already parsed by the API, so there is no "the model wrapped the
// JSON in a sentence and a code fence" to guess at; the last call is made with
// tool_choice forced to `respond`, so there is always a final answer. Because a
// model can still answer in plain text, that is parsed defensively too
// (validate.ts parseModelText): the same JSON if it is JSON, otherwise the text
// itself as { text, blocks: [], sources: null }.
//
// What is never done here: log anything (the caller logs request ids, token
// counts and error kinds), put a tool result anywhere but a tool_result
// message, or let an error message carry the provider's response body.

import { parseModelText } from "./validate.ts";
import { prepareToolCall, ALL_TOOLS, RESPOND_TOOL_NAME } from "./tools.ts";
import type { Turn } from "./request.ts";

export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";
export const MAX_TOOL_CALLS = 6;
export const MAX_OUTPUT_TOKENS = 2000;
// One provider call.
export const CALL_TIMEOUT_MS = 45_000;
// The whole question. Seven provider calls of 45 s each would outlast the
// platform's request limit, and a question lost to the platform is not
// refunded; this budget ends the loop first, so the function can still refund
// and answer.
export const TOTAL_BUDGET_MS = 110_000;
// A provider call is not started with less than this left.
const MIN_CALL_MS = 4_000;
// A tool result longer than this is cut before the model sees it.
export const MAX_RESULT_CHARS = 40_000;

// The part of fetch that is used. Deno's fetch is one of these.
export type FetchFn = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

// One database call: "ai.list_workouts" and its arguments. index.ts provides
// the real one, on the caller's own client.
export type RpcFn = (
  name: string,
  args?: Record<string, unknown>
) => Promise<{ data: unknown; error: unknown }>;

export type Deadline = { now: () => number; at: number };

export type ProviderDeps = {
  fetchFn: FetchFn;
  apiKey: string;
  deadline?: Deadline;
  // Overrides CALL_TIMEOUT_MS; the tests use a few milliseconds.
  timeoutMs?: number;
};

// A failed model call. `kind` is a short fixed word ("timeout", "network",
// "http_529", "bad_response", "deadline", "no_answer") and is all that is ever
// logged; the provider's own message is not kept. `unavailable` is a provider
// that cannot serve us at all (our key refused, overloaded, down): the
// function answers 503 for it and 502 for the rest. Either way the question is
// refunded.
export class ProviderError extends Error {
  kind: string;
  unavailable: boolean;

  constructor(kind: string, unavailable = false) {
    super(kind);
    this.name = "ProviderError";
    this.kind = kind;
    this.unavailable = unavailable;
  }
}

type Json = Record<string, unknown>;

export type ModelResponse = {
  content: Json[];
  stopReason: string;
  inputTokens: number;
  outputTokens: number;
};

function isRecord(value: unknown): value is Json {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function tokens(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

export async function createMessage(deps: ProviderDeps, body: Json): Promise<ModelResponse> {
  let timeoutMs = deps.timeoutMs ?? CALL_TIMEOUT_MS;

  if (deps.deadline) {
    const left = deps.deadline.at - deps.deadline.now();

    if (left < MIN_CALL_MS) {
      throw new ProviderError("deadline");
    }

    timeoutMs = Math.min(timeoutMs, left);
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    let response;

    try {
      response = await deps.fetchFn(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "x-api-key": deps.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw new ProviderError(timedOut ? "timeout" : "network");
    }

    if (!response.ok) {
      const status = response.status;

      throw new ProviderError(
        `http_${status}`,
        status === 401 || status === 403 || status === 503 || status === 529
      );
    }

    let parsed: unknown;

    try {
      parsed = await response.json();
    } catch {
      throw new ProviderError(timedOut ? "timeout" : "bad_response");
    }

    if (!isRecord(parsed) || !Array.isArray(parsed.content)) {
      throw new ProviderError("bad_response");
    }

    const usage = isRecord(parsed.usage) ? parsed.usage : {};

    return {
      content: parsed.content.filter(isRecord),
      stopReason: typeof parsed.stop_reason === "string" ? parsed.stop_reason : "",
      inputTokens: tokens(usage.input_tokens),
      outputTokens: tokens(usage.output_tokens),
    };
  } finally {
    clearTimeout(timer);
  }
}

function textOf(content: Json[]): string {
  return content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("\n")
    .trim();
}

// One short model call with no tools, for the router.
export async function completeText(
  deps: ProviderDeps,
  options: { model: string; system: string; userText: string; maxTokens: number }
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const response = await createMessage(deps, {
    model: options.model,
    max_tokens: options.maxTokens,
    system: options.system,
    messages: [{ role: "user", content: options.userText }],
  });

  return {
    text: textOf(response.content),
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
  };
}

export type ToolLoopOptions = {
  provider: ProviderDeps;
  rpc: RpcFn;
  model: string;
  system: string;
  turns: Turn[];
  // The person's local date, the anchor for default date ranges.
  today: string;
  maxOutputTokens?: number;
};

export type ToolLoopResult = {
  // What the model handed in as its answer, not yet validated.
  answer: unknown;
  // The data of every tool call that worked, for checking a chart's numbers.
  toolResults: unknown[];
  toolCalls: number;
  inputTokens: number;
  outputTokens: number;
};

function toolResultBlock(id: unknown, content: string, isError: boolean): Json {
  const block: Json = { type: "tool_result", tool_use_id: id, content };

  if (isError) {
    block.is_error = true;
  }

  return block;
}

// Asks the model, runs the tools it calls (at most six), and returns its final
// answer. Throws ProviderError when the provider fails.
export async function runToolLoop(options: ToolLoopOptions): Promise<ToolLoopResult> {
  const messages: Json[] = options.turns.map((turn) => ({
    role: turn.role,
    content: turn.text,
  }));
  const toolResults: unknown[] = [];
  let toolCalls = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  // Six calls, then the forced answer, plus a little room for a response that
  // mixes respond with data tools.
  const maxRounds = MAX_TOOL_CALLS + 3;

  for (let round = 0; round < maxRounds; round += 1) {
    const mustRespond = toolCalls >= MAX_TOOL_CALLS;
    const response = await createMessage(options.provider, {
      model: options.model,
      max_tokens: options.maxOutputTokens ?? MAX_OUTPUT_TOKENS,
      system: options.system,
      tools: ALL_TOOLS,
      tool_choice: mustRespond ? { type: "tool", name: RESPOND_TOOL_NAME } : { type: "auto" },
      messages,
    });

    inputTokens += response.inputTokens;
    outputTokens += response.outputTokens;

    const uses = response.content.filter((block) => block.type === "tool_use");

    if (!uses.length) {
      // No tool call: a plain text answer.
      return {
        answer: parseModelText(textOf(response.content)),
        toolResults,
        toolCalls,
        inputTokens,
        outputTokens,
      };
    }

    const respondUse = uses.find((use) => use.name === RESPOND_TOOL_NAME);

    if (respondUse && uses.length === 1) {
      return { answer: respondUse.input, toolResults, toolCalls, inputTokens, outputTokens };
    }

    // The assistant turn goes back as it was (only the fields the API takes),
    // and every tool_use in it gets a tool_result in the next user turn - the
    // API refuses the next call otherwise.
    messages.push({
      role: "assistant",
      content: response.content
        .filter((block) => block.type === "text" || block.type === "tool_use")
        .map((block) =>
          block.type === "text"
            ? { type: "text", text: block.text }
            : { type: "tool_use", id: block.id, name: block.name, input: block.input ?? {} }
        ),
    });

    const results: Json[] = [];

    for (const use of uses) {
      if (use.name === RESPOND_TOOL_NAME) {
        results.push(
          toolResultBlock(use.id, "Call respond on its own, after the data tool results.", true)
        );
        continue;
      }

      if (toolCalls >= MAX_TOOL_CALLS) {
        results.push(
          toolResultBlock(use.id, "Tool limit reached. Answer now with what you have, using respond.", true)
        );
        continue;
      }

      toolCalls += 1;

      const prepared = prepareToolCall(use.name, use.input, options.today);

      if (!prepared.ok) {
        results.push(toolResultBlock(use.id, prepared.error, true));
        continue;
      }

      let data: unknown = null;
      let failed = false;

      try {
        const result = await options.rpc(prepared.rpc, prepared.args);

        if (result.error) {
          failed = true;
        } else {
          data = result.data ?? null;
        }
      } catch {
        failed = true;
      }

      if (failed) {
        // No database message is passed on: the model only needs to know it
        // got nothing.
        results.push(toolResultBlock(use.id, "The data could not be read.", true));
        continue;
      }

      const serialized = JSON.stringify(data);

      if (serialized.length > MAX_RESULT_CHARS) {
        const cut = `${serialized.slice(0, MAX_RESULT_CHARS)} ...[cut: too long, ask for a narrower range]`;

        toolResults.push(cut);
        results.push(toolResultBlock(use.id, cut, false));
      } else {
        toolResults.push(data);
        results.push(toolResultBlock(use.id, serialized, false));
      }
    }

    messages.push({ role: "user", content: results });
  }

  throw new ProviderError("no_answer");
}
