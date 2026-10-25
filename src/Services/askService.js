// Ask FitVen: the AI chat about the person's own training. The cloud half is
// the edge function `ask-fitven` and the consent functions; the contract
// between the parts is docs/ASK-FITVEN.md.
//
// Nothing here throws at the screen. A call that fails answers { code } -
// offline, unauthorized, consent_required, quota_exceeded (with tier and
// usage), provider_error, unavailable, error - and the screen says it in
// words (Utils/askResponse.js, screenStateForCode). A call that works answers
// without a `code`.
//
// The rules live in Utils/ask*.js, so Node can test them. The conversation is
// kept on this phone only; the AI writes nothing - a suggested change is
// applied here, by the person's button, through the same workout services the
// workout screen uses.
import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "@database/supaBaseClient";
import { weightliftingRepository } from "@repository";
import { dateToIsoDate } from "@utils/dateUtils";
import { buildAskBody, buildAskContext } from "@utils/askRequest";
import {
  classifyAskFailure,
  classifyRpcFailure,
  looksOffline,
  normalizeAskResponse,
} from "@utils/askResponse";
import {
  consentOffStorageKey,
  conversationStorageKey,
  parseConversation,
  parseSuggestionStates,
  serializeConversation,
  serializeSuggestionStates,
  suggestionStatesStorageKey,
} from "@utils/askConversation";
import { pickFlatLift } from "@utils/askPrompts";
import {
  expandSuggestionSets,
  normalizeSuggestion,
  restorePayload,
  sameExerciseName,
  snapshotSets,
} from "@utils/askSuggestion";
import { isAskTier, normalizeUsage } from "@utils/askTiers";
import { buildDirections, normalizeRecordRows } from "@utils/recordsInsights";
import * as programService from "./programService";
import * as splitService from "./splitService";
import * as weightliftingService from "./weightliftingService";
import { enqueueSync } from "./syncScheduler";

const ASK_FUNCTION = "ask-fitven";
// An answer can take a while (the model reads the history); the other calls
// are one round trip.
const ASK_TIMEOUT_MS = 60000;
const QUICK_TIMEOUT_MS = 15000;
// The sync before a question is for the workout finished a minute ago. It is
// never worth making the person wait for more than this.
const SYNC_WAIT_MS = 3000;
const FLAT_LIFT_WINDOW_DAYS = 120;

/* ---------------------------------------------------------------- the call -- */

async function readFailureBody(response) {
  try {
    const text = await response.text();

    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function failureFromInvokeError(error, timedOut) {
  // The function answered with a status: the body says why.
  if (error?.context && typeof error.context.text === "function") {
    return classifyAskFailure({
      status: error.context.status ?? null,
      body: await readFailureBody(error.context),
    });
  }

  if (timedOut) {
    return { code: "error" };
  }

  if (error?.name === "FunctionsRelayError") {
    return { code: "unavailable" };
  }

  return looksOffline(error) || error?.name === "AbortError"
    ? { code: "offline" }
    : { code: "error" };
}

// One request to the function, ended after `timeoutMs`. -> { data } | { code, ... }
async function callFunction(body, timeoutMs) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const { data, error } = await supabase.functions.invoke(ASK_FUNCTION, {
      body,
      signal: controller.signal,
    });

    if (error) {
      return await failureFromInvokeError(error, timedOut);
    }

    return { data };
  } catch (error) {
    return await failureFromInvokeError(error, timedOut);
  } finally {
    clearTimeout(timer);
  }
}

/** This month's questions per tier. -> { usage } | { code } */
export async function getAskUsage() {
  const result = await callFunction({ action: "usage" }, QUICK_TIMEOUT_MS);

  if (result.code) {
    return result;
  }

  const usage = normalizeUsage(result.data?.usage);

  return usage ? { usage } : { code: "error" };
}

/**
 * Which tier suits this question. It does not use up a question.
 * -> { tier, reason, usage } | { code }
 */
export async function recommendTier(question, language = "en") {
  const text = typeof question === "string" ? question.trim().slice(0, 2000) : "";

  if (!text) {
    return { code: "error" };
  }

  const result = await callFunction(
    { action: "recommend", question: text, language: buildAskContext({ language }).language },
    QUICK_TIMEOUT_MS
  );

  if (result.code) {
    return result;
  }

  if (!isAskTier(result.data?.tier)) {
    return { code: "error" };
  }

  return {
    tier: result.data.tier,
    reason: typeof result.data.reason === "string" ? result.data.reason : "",
    usage: normalizeUsage(result.data.usage),
  };
}

// The normal sync, once, through the one queue every other upload uses - and
// not waited for beyond SYNC_WAIT_MS. A failed sync does not stop the question:
// the answer is then about what the cloud has.
async function syncBeforeAsking(db) {
  if (!db) {
    return;
  }

  let timer = null;

  try {
    const sync = enqueueSync(() => programService.pushDirtyStrengthHierarchyWithCloud(db)).catch(
      (error) => {
        console.warn("Sync before an Ask FitVen question failed:", error);
      }
    );
    const wait = new Promise((resolve) => {
      timer = setTimeout(resolve, SYNC_WAIT_MS);
    });

    await Promise.race([sync, wait]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Asks a question. `messages` is the conversation as the screen has it (the
 * last one the person's); the function gets the text of the last 12 turns.
 * `db` is the phone's database, for the sync that goes first.
 * -> { text, blocks, sources, tier, usage } | { code, tier?, usage? }
 */
export async function askQuestion(db, { tier, messages, language = "en", now = new Date() }) {
  if (!isAskTier(tier)) {
    return { code: "error" };
  }

  const body = buildAskBody({
    tier,
    turns: messages,
    context: buildAskContext({ now, language }),
  });

  if (body.messages.length === 0) {
    return { code: "error" };
  }

  await syncBeforeAsking(db);

  const result = await callFunction(body, ASK_TIMEOUT_MS);

  if (result.code) {
    return result;
  }

  return normalizeAskResponse(result.data) ?? { code: "error" };
}

/* ----------------------------------------------------------------- consent -- */

async function writeLocal(key, value) {
  try {
    if (value === null) {
      await AsyncStorage.removeItem(key);
    } else {
      await AsyncStorage.setItem(key, value);
    }
  } catch (error) {
    console.warn("Could not keep an Ask FitVen setting on this phone:", error);
  }
}

async function readLocal(key) {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Whether the person has said yes (public.ai_get_consent). The cloud keeps a
 * date or nothing, so "never asked" and "turned off" read the same there; the
 * entry on Home is hidden by the phone's own note of a switch turned off.
 * -> { consented } | { code }
 */
export async function getAskConsent({ userId = null } = {}) {
  const { data, error } = await supabase.rpc("ai_get_consent");

  if (error) {
    return classifyRpcFailure(error);
  }

  const consented = Boolean(data);

  if (consented) {
    await writeLocal(consentOffStorageKey(userId), null);
  }

  return { consented };
}

/** Says yes or no (public.ai_set_consent). -> { consented } | { code } */
export async function setAskConsent(consented, { userId = null } = {}) {
  const { error } = await supabase.rpc("ai_set_consent", { p_consent: Boolean(consented) });

  if (error) {
    return classifyRpcFailure(error);
  }

  await writeLocal(consentOffStorageKey(userId), consented ? null : "1");

  return { consented: Boolean(consented) };
}

/**
 * Whether Home shows the entry: yes, until the person turns Ask FitVen off in
 * Settings. Read from the phone, so it is there before the network is, and
 * offline.
 */
export async function isAskEntryEnabled({ userId = null } = {}) {
  return (await readLocal(consentOffStorageKey(userId))) !== "1";
}

/* ------------------------------------------------------------ conversation -- */

export async function loadConversation({ userId = null } = {}) {
  return parseConversation(await readLocal(conversationStorageKey(userId)));
}

export async function saveConversation(messages, { userId = null } = {}) {
  await writeLocal(
    conversationStorageKey(userId),
    messages.length > 0 ? serializeConversation(messages) : null
  );
}

// What became of the suggested changes in it - added, undone, not now - so a
// card that was added is still "Added" with its Undo tomorrow.
export async function loadSuggestionStates({ userId = null } = {}) {
  return parseSuggestionStates(await readLocal(suggestionStatesStorageKey(userId)));
}

export async function saveSuggestionStates(states, { userId = null } = {}) {
  const serialized = serializeSuggestionStates(states);

  await writeLocal(
    suggestionStatesStorageKey(userId),
    Object.keys(JSON.parse(serialized).states).length > 0 ? serialized : null
  );
}

export async function clearConversation({ userId = null } = {}) {
  await writeLocal(conversationStorageKey(userId), null);
  await writeLocal(suggestionStatesStorageKey(userId), null);
}

/* -------------------------------------------------------- the empty screen -- */

/**
 * What the four suggestion rows are made from, found on the phone: the lift
 * that has gone nowhere, and the workout that is next in the split. Each may
 * be null (nothing found, or the lookup failed) and the screen then asks a
 * fixed question instead.
 * -> { flatLift, nextWorkout }
 */
export async function loadEmptyStateFacts(db, { userId = null, now = Date.now() } = {}) {
  const since = dateToIsoDate(new Date(now - FLAT_LIFT_WINDOW_DAYS * 86400000));
  const [lifts, groups] = await Promise.allSettled([
    weightliftingService.getRecordsSourceData(db, { sinceIsoDate: since }),
    splitService.getHomeSplitGroups(db, { userId }),
  ]);
  const flatLift =
    lifts.status === "fulfilled"
      ? pickFlatLift(buildDirections(normalizeRecordRows(lifts.value.rows), { now }))
      : null;
  const next =
    groups.status === "fulfilled" ? groups.value.find((group) => group.isUpNext) : null;

  return {
    flatLift,
    nextWorkout: typeof next?.name === "string" && next.name.trim() ? next.name.trim() : null,
    nextWorkoutType: next?.workoutType ?? null,
  };
}

/* ------------------------------------------------------ a suggested change -- */

// The sets the exercise has, as their ids in order.
async function setIdsOf(db, exerciseId) {
  const rows = await weightliftingRepository.getSetIdsByExercise(db, exerciseId);

  return rows.map((row) => row.sets_id);
}

// As many sets as `count`: the surplus is deleted from the end and what is
// missing is added the way the + on the workout screen adds one. -> the ids.
async function resizeSets(db, exerciseId, count) {
  let ids = await setIdsOf(db, exerciseId);

  while (ids.length > count) {
    await weightliftingService.deleteSet(db, ids[ids.length - 1]);
    ids = await setIdsOf(db, exerciseId);
  }

  while (ids.length < count) {
    await weightliftingService.addSetToExercise(db, exerciseId);
    ids = await setIdsOf(db, exerciseId);
  }

  return ids;
}

// The suggested sets written the way the workout screen writes a number the
// person types: reps and weight through updateSetField / updateSetWeights
// (clamped, with the 1RM % worked out), as working sets. The weight is the
// number as it is written for that exercise - the same form the AI read it in.
async function writeSuggestedSets(db, exerciseId, wanted) {
  const ids = await resizeSets(db, exerciseId, wanted.length);
  const current = [...(await weightliftingService.getExerciseSets(db, exerciseId))].sort(
    (left, right) => Number(left.set_number) - Number(right.set_number)
  );

  for (let index = 0; index < ids.length; index += 1) {
    await weightliftingService.updateSetField(db, {
      field: "reps",
      value: wanted[index].reps,
      setId: ids[index],
    });

    if ((current[index]?.set_type ?? "working") !== "working") {
      await weightliftingService.setSetType(db, { setId: ids[index], setType: "working" });
    }
  }

  await weightliftingService.updateSetWeights(
    db,
    ids.map((setId, index) => ({ setId, weight: wanted[index].weight }))
  );
}

/**
 * "Add to next Push A": replaces the sets of the named exercise in the next
 * planned workout with that label, with the suggested ones. Nothing else is
 * touched: not another exercise, not a workout in the past or already done.
 * An exercise the workout lacks is added at the end.
 *
 * -> { applied } - what Undo needs - | { code: "no_workout" | "invalid" | "error" }
 */
export async function applySuggestion(db, suggestion, { today = new Date() } = {}) {
  const parsed = normalizeSuggestion(suggestion);

  if (!parsed) {
    return { code: "invalid" };
  }

  const workout = await programService.getNextPlannedWorkoutByLabel(db, {
    label: parsed.target.label,
    today,
  });

  if (!workout) {
    return { code: "no_workout" };
  }

  const workoutId = Number(workout.workout_id);
  const wanted = expandSuggestionSets(parsed.change);
  let applied = null;

  try {
    const entries = await weightliftingService.getWorkoutExerciseEntries(db, workoutId);
    const found = entries.find((entry) => sameExerciseName(entry.exerciseName, parsed.change.exercise));

    if (found) {
      applied = {
        workoutId,
        workoutLabel: workout.label,
        date: workout.date_iso ?? workout.date ?? null,
        exerciseId: found.exerciseId,
        exerciseName: found.exerciseName,
        added: false,
        snapshot: snapshotSets(await weightliftingService.getExerciseSets(db, found.exerciseId)),
      };
    } else {
      const created = await weightliftingService.addExerciseToWorkout(db, {
        workoutId,
        exerciseName: parsed.change.exercise,
      });

      applied = {
        workoutId,
        workoutLabel: workout.label,
        date: workout.date_iso ?? workout.date ?? null,
        exerciseId: created.exerciseId,
        exerciseName: parsed.change.exercise,
        added: true,
        snapshot: null,
      };
    }

    await writeSuggestedSets(db, applied.exerciseId, wanted);

    return { applied };
  } catch (error) {
    console.warn("Could not apply the Ask FitVen suggestion:", error);

    // Whatever was half done is put back.
    if (applied) {
      await undoSuggestion(db, applied).catch(() => {});
    }

    return { code: "error" };
  }
}

/**
 * Puts the exercise back as it was: the sets exactly as they were (every value
 * and the count), or - when the suggestion had to add the exercise - without it.
 * -> { restored: true } | { code }
 */
export async function undoSuggestion(db, applied) {
  if (!applied || !Number.isFinite(Number(applied.exerciseId))) {
    return { code: "invalid" };
  }

  try {
    const entries = await weightliftingService.getWorkoutExerciseEntries(db, applied.workoutId);

    // The person has taken it out of the workout since: there is nothing to restore.
    if (!entries.some((entry) => Number(entry.exerciseId) === Number(applied.exerciseId))) {
      return { code: "gone" };
    }

    if (applied.added) {
      await weightliftingService.deleteExercise(db, applied.exerciseId);

      return { restored: true };
    }

    await resizeSets(db, applied.exerciseId, applied.snapshot.length);
    await weightliftingService.saveExerciseSets(db, {
      exerciseId: applied.exerciseId,
      sets: restorePayload(applied.snapshot),
    });

    return { restored: true };
  } catch (error) {
    console.warn("Could not undo the Ask FitVen suggestion:", error);

    return { code: "error" };
  }
}
