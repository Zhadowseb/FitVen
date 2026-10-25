// What comes back from Ask FitVen, made safe to draw: an answer with unknown
// blocks, missing fields or wrong types never crashes the screen, and an error
// of any shape becomes one of the states the screen has words for. Pure
// (Node-testable).
import { isAskTier, normalizeUsage } from "./askTiers";
import { normalizeSuggestion } from "./askSuggestion";

export const MAX_BLOCKS = 3;
export const MAX_CHART_POINTS = 60;

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

/** A `chart` block, or null: it needs two numbers to be a line. */
export function normalizeChart(raw) {
  if (!raw || typeof raw !== "object" || raw.type !== "chart") {
    return null;
  }

  const series = [];

  for (const point of Array.isArray(raw.series) ? raw.series : []) {
    const y = typeof point?.y === "number" ? point.y : Number.NaN;

    if (!Number.isFinite(y)) {
      continue;
    }

    series.push({ x: typeof point?.x === "string" ? point.x : "", y });

    if (series.length >= MAX_CHART_POINTS) {
      break;
    }
  }

  if (series.length < 2) {
    return null;
  }

  return {
    type: "chart",
    title: cleanText(raw.title, 120),
    range: cleanText(raw.range, 60),
    series,
    unit: cleanText(raw.unit, 12),
    summary: cleanText(raw.summary, 160),
  };
}

// Where "See them" may go. Anything else is not a link: the function's answer
// does not get to pick a screen of the app.
const SOURCE_SCREENS = {
  RecordsExercise: (link) => {
    const exerciseName = cleanText(link.exercise, 120);

    return exerciseName ? { route: "RecordsExercisePage", params: { exerciseName } } : null;
  },
};

export function resolveSourceLink(link) {
  if (!link || typeof link !== "object" || typeof link.screen !== "string") {
    return null;
  }

  const build = Object.prototype.hasOwnProperty.call(SOURCE_SCREENS, link.screen)
    ? SOURCE_SCREENS[link.screen]
    : null;

  return build ? build(link) : null;
}

/** The `sources` object, or null when the answer rests on no sessions. */
export function normalizeSources(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const count = Number(raw.count);
  const label = cleanText(raw.label, 160);
  const range = cleanText(raw.range, 60);
  const link = resolveSourceLink(raw.link);

  if (!label && !(Number.isFinite(count) && count > 0)) {
    return null;
  }

  return {
    label,
    count: Number.isFinite(count) && count >= 0 ? Math.floor(count) : null,
    range,
    link,
  };
}

/**
 * The answer as the screen draws it:
 * { text, blocks, sources, tier, usage }, or null when there is nothing to
 * draw (no text and no block), which the caller treats as a failed answer.
 * Blocks of a type the app does not know are dropped; at most three are kept.
 */
export function normalizeAskResponse(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const text = cleanText(data.text, 8000);
  const blocks = [];

  for (const block of Array.isArray(data.blocks) ? data.blocks : []) {
    const normalized =
      block?.type === "chart"
        ? normalizeChart(block)
        : block?.type === "suggestion"
          ? normalizeSuggestion(block)
          : null;

    if (normalized) {
      blocks.push(normalized);
    }

    if (blocks.length >= MAX_BLOCKS) {
      break;
    }
  }

  if (!text && blocks.length === 0) {
    return null;
  }

  return {
    text,
    blocks,
    sources: normalizeSources(data.sources),
    tier: isAskTier(data.tier) ? data.tier : null,
    usage: normalizeUsage(data.usage),
  };
}

/* ------------------------------------------------------------------ errors -- */

export const ASK_ERROR_CODES = [
  "offline",
  "unauthorized",
  "consent_required",
  "quota_exceeded",
  "provider_error",
  "unavailable",
  "error",
];

const CODE_BY_STATUS = {
  401: "unauthorized",
  403: "consent_required",
  429: "quota_exceeded",
  502: "provider_error",
  503: "unavailable",
};

/**
 * The code for a failed call. The body's own `error` wins when it is one the
 * app knows ("bad_request" is not: it is the app's bug, and says "error");
 * otherwise the status decides.
 *
 *   -> { code, tier?, usage? }
 */
export function classifyAskFailure({ status = null, body = null, offline = false } = {}) {
  if (offline) {
    return { code: "offline" };
  }

  const named = typeof body?.error === "string" ? body.error : null;
  const code = ASK_ERROR_CODES.includes(named)
    ? named
    : CODE_BY_STATUS[Number(status)] ?? "error";
  const failure = { code };

  if (code === "quota_exceeded") {
    failure.tier = isAskTier(body?.tier) ? body.tier : null;
    failure.usage = normalizeUsage(body?.usage);
  }

  return failure;
}

const NETWORK_MESSAGES = ["Network request failed", "Failed to fetch", "NetworkError", "Load failed"];

export function looksOffline(error) {
  const message = String(error?.message ?? error ?? "");

  return (
    error?.name === "FunctionsFetchError" ||
    NETWORK_MESSAGES.some((candidate) => message.includes(candidate))
  );
}

/**
 * The failure of a database function call (the consent functions): a missing
 * function means the cloud half has not been deployed yet.
 */
export function classifyRpcFailure(error) {
  if (looksOffline(error)) {
    return { code: "offline" };
  }

  const code = String(error?.code ?? "");

  if (code === "PGRST202" || code === "42883" || code === "404") {
    return { code: "unavailable" };
  }

  if (code === "PGRST301" || code === "401" || /jwt/i.test(String(error?.message ?? ""))) {
    return { code: "unauthorized" };
  }

  return { code: "error" };
}

/**
 * What the screen does with a code: which state, which words, and whether
 * "Try again" makes sense.
 *   state: "offline" | "signin" | "consent" | "quota" | "error"
 */
export function screenStateForCode(code) {
  switch (code) {
    case "offline":
      return { state: "offline", messageKey: "ask.error.offline", canRetry: true };
    case "unauthorized":
      return { state: "signin", messageKey: "ask.error.unauthorized", canRetry: false };
    case "consent_required":
      return { state: "consent", messageKey: "ask.error.consent", canRetry: false };
    case "quota_exceeded":
      return { state: "quota", messageKey: "ask.quota.reached", canRetry: false };
    case "provider_error":
      return { state: "error", messageKey: "ask.error.provider", canRetry: true };
    case "unavailable":
      return { state: "error", messageKey: "ask.error.unavailable", canRetry: true };
    default:
      return { state: "error", messageKey: "ask.error.generic", canRetry: true };
  }
}
