// What Ask FitVen sends: the messages and the context. Pure (Node-testable).
//
// The conversation lives on the phone with blocks and sources on it; the
// function gets text only - an assistant turn is its `text`, nothing else.

export const MAX_TURNS = 12;
export const MAX_CHARS = 2000;
export const ASK_LANGUAGES = ["en", "da", "sv", "nb", "de", "fr", "es"];

// A cut that lands between the two halves of an emoji would send half of it.
function cutText(text, limit) {
  if (text.length <= limit) {
    return text;
  }

  const cut = text.slice(0, limit);
  const last = cut.charCodeAt(cut.length - 1);

  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}

/**
 * The last 12 turns, text only, each trimmed and cut at 2,000 characters, the
 * last one the person's.
 *
 * - A turn without text (an answer that was only a chart) is left out: the
 *   function refuses an empty one.
 * - Two turns by the same side in a row (a question that never got an answer,
 *   then the next) collapse to the later one, so the roles alternate.
 * - After the cut to 12 the first turn is the person's: a conversation does
 *   not open on the assistant.
 * - Trailing assistant turns are dropped; the question is what is answered.
 *
 * `turns` are the screen's messages: { role, text }.
 */
export function buildOutgoingMessages(turns) {
  const cleaned = [];

  for (const turn of Array.isArray(turns) ? turns : []) {
    const role = turn?.role === "assistant" ? "assistant" : turn?.role === "user" ? "user" : null;
    const text = typeof turn?.text === "string" ? turn.text.trim() : "";

    if (!role || !text) {
      continue;
    }

    if (cleaned.length > 0 && cleaned[cleaned.length - 1].role === role) {
      cleaned.pop();
    }

    cleaned.push({ role, text });
  }

  let kept = cleaned.slice(-MAX_TURNS);

  while (kept.length > 0 && kept[0].role !== "user") {
    kept = kept.slice(1);
  }

  while (kept.length > 0 && kept[kept.length - 1].role !== "user") {
    kept = kept.slice(0, -1);
  }

  return kept.map((turn) => ({ role: turn.role, text: cutText(turn.text, MAX_CHARS) }));
}

const pad = (value) => String(value).padStart(2, "0");

/**
 * The phone's own idea of now, so "today" and "this week" are the person's and
 * not the server's. The local date is built from the local getters -
 * toISOString() is UTC and gives yesterday's date for the first hours after
 * midnight in Copenhagen.
 */
export function buildAskContext({ now = new Date(), language = "en", timeZone = null } = {}) {
  let zone = timeZone;

  if (!zone) {
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      zone = "UTC";
    }
  }

  return {
    localDate: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    localTime: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    timeZone: zone,
    unit: "kg",
    language: ASK_LANGUAGES.includes(language) ? language : "en",
  };
}

/** The body of an `ask` request. */
export function buildAskBody({ tier, turns, context }) {
  return { action: "ask", tier, messages: buildOutgoingMessages(turns), context };
}
