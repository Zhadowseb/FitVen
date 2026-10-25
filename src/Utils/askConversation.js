// The conversation as it is kept on the phone: in memory while the screen is
// open, and in local storage so it is still there tomorrow. Nothing of it goes
// to the cloud. Pure (Node-testable); the storage itself is in askService.
import { normalizeAskResponse } from "./askResponse";
import { isAskTier } from "./askTiers";

export const MAX_STORED_MESSAGES = 40;
export const CONVERSATION_VERSION = 1;

// Per person: more than one account can use a phone, and a conversation about
// somebody's training is not for the next person to open the app.
export const conversationStorageKey = (userId) => `ask.conversation.v1.${userId ?? "none"}`;
export const consentOffStorageKey = (userId) => `ask.consent.off.v1.${userId ?? "none"}`;

let counter = 0;

export function newMessageId() {
  counter += 1;

  return `m${Date.now().toString(36)}${counter.toString(36)}`;
}

export function userMessage(text, now = Date.now()) {
  return { id: newMessageId(), role: "user", text: String(text ?? "").trim(), at: now, failed: null };
}

export function assistantMessage(answer, now = Date.now()) {
  return {
    id: newMessageId(),
    role: "assistant",
    text: answer.text,
    blocks: answer.blocks,
    sources: answer.sources,
    tier: answer.tier,
    at: now,
  };
}

/** A question the answer to which never came: kept, with why, so Retry can ask again. */
export function markFailed(messages, id, code) {
  return messages.map((message) => (message.id === id ? { ...message, failed: code } : message));
}

/** Retry asks the same question again: it is cleared, not copied. */
export function clearFailed(messages) {
  return messages.map((message) => (message.failed ? { ...message, failed: null } : message));
}

/**
 * Before a new question is added: a question that never got its answer is
 * dropped, so the conversation does not carry two questions in a row.
 */
export function withoutFailedQuestion(messages) {
  return messages.filter((message) => !(message.role === "user" && message.failed));
}

export function serializeConversation(messages) {
  const kept = (Array.isArray(messages) ? messages : []).slice(-MAX_STORED_MESSAGES);

  return JSON.stringify({ v: CONVERSATION_VERSION, messages: kept });
}

/**
 * What was stored, made safe: a message of a shape that is not known is left
 * out, and an assistant message goes through the same checks as a fresh answer
 * (a stored block is no more trusted than one that just arrived).
 */
export function parseConversation(raw) {
  let parsed = null;

  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : null;
  } catch {
    return [];
  }

  if (!parsed || parsed.v !== CONVERSATION_VERSION || !Array.isArray(parsed.messages)) {
    return [];
  }

  const messages = [];

  for (const stored of parsed.messages) {
    if (!stored || typeof stored !== "object") {
      continue;
    }

    const at = Number.isFinite(Number(stored.at)) ? Number(stored.at) : 0;
    const id = typeof stored.id === "string" && stored.id ? stored.id : newMessageId();

    if (stored.role === "user" && typeof stored.text === "string" && stored.text.trim()) {
      messages.push({
        id,
        role: "user",
        text: stored.text.trim(),
        at,
        failed: typeof stored.failed === "string" ? stored.failed : null,
      });
    } else if (stored.role === "assistant") {
      const answer = normalizeAskResponse({
        text: stored.text,
        blocks: stored.blocks,
        sources: stored.sources
          ? { ...stored.sources, link: stored.sources.link ? linkBack(stored.sources.link) : null }
          : null,
        tier: stored.tier,
      });

      if (answer) {
        messages.push({
          id,
          role: "assistant",
          text: answer.text,
          blocks: answer.blocks,
          sources: answer.sources,
          tier: isAskTier(answer.tier) ? answer.tier : null,
          at,
        });
      }
    }
  }

  return messages;
}

// A stored link is the resolved { route, params }; normalizeSources wants the
// function's own { screen, exercise }. Only the one known screen comes back.
function linkBack(link) {
  return link.route === "RecordsExercisePage" && link.params?.exerciseName
    ? { screen: "RecordsExercise", exercise: link.params.exerciseName }
    : null;
}

/* ---------------------------------------- what became of the suggestions -- */

export const suggestionStatesStorageKey = (userId) => `ask.suggestions.v1.${userId ?? "none"}`;

// Only a card that has been settled is kept: applied (with what Undo needs),
// undone, dismissed, or told there was no workout. A card that was half way -
// applying, a failure to add - is an unanswered card again.
const KEPT_STATUSES = ["applied", "undone", "dismissed", "noWorkout"];

function isKeptApplied(applied) {
  return (
    applied &&
    typeof applied === "object" &&
    Number.isFinite(Number(applied.exerciseId)) &&
    Number.isFinite(Number(applied.workoutId)) &&
    (applied.added === true || Array.isArray(applied.snapshot))
  );
}

export function serializeSuggestionStates(states) {
  const kept = {};

  for (const [key, state] of Object.entries(states ?? {})) {
    if (!state || !KEPT_STATUSES.includes(state.status)) {
      continue;
    }

    if (state.status === "applied" && !isKeptApplied(state.applied)) {
      continue;
    }

    kept[key] = {
      status: state.status,
      workoutLabel: typeof state.workoutLabel === "string" ? state.workoutLabel : null,
      applied: state.status === "applied" ? state.applied : null,
    };
  }

  return JSON.stringify({ v: CONVERSATION_VERSION, states: kept });
}

export function parseSuggestionStates(raw) {
  let parsed = null;

  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : null;
  } catch {
    return {};
  }

  if (!parsed || parsed.v !== CONVERSATION_VERSION || !parsed.states || typeof parsed.states !== "object") {
    return {};
  }

  const states = {};

  for (const [key, state] of Object.entries(parsed.states)) {
    if (!state || !KEPT_STATUSES.includes(state.status)) {
      continue;
    }

    if (state.status === "applied" && !isKeptApplied(state.applied)) {
      continue;
    }

    states[key] = {
      status: state.status,
      workoutLabel: typeof state.workoutLabel === "string" ? state.workoutLabel : undefined,
      applied: state.status === "applied" ? state.applied : null,
    };
  }

  return states;
}
