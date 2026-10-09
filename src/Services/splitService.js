// The split somebody chose - the two to six sessions they rotate through
// without a program - and what the Train tab and Home build from it.
//
// A session is an entry (Utils/splitEntries.js): a name, and the workout it
// was picked as when it was picked in the calendar. The choice lives on
// profile_private - split_entries with the pins, split_names beside it for
// builds from before pins - so it follows them to a new phone, and on the
// phone too, so the cards show it offline and at once. A choice made offline
// is marked as not yet sent and goes up the next time the Train tab loads,
// rather than being overwritten by the older one in the cloud.
//
// Until 20260926090000_your-split-follows-you.sql has run there is no cloud
// column at all, and the choice stays on the phone. Until
// 20261006090000_a-split-pins-its-workouts.sql has run there is no
// split_entries: the names go up alone, and the pins stay on the phone.
import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "../Database/supaBaseClient";
import * as programService from "./programService";
import * as workoutService from "./workoutService";
import {
  homeGroupsFromSplit,
  namedHistory,
  pinnedWorkouts,
  repeatAlsoItems,
  resolveChosenSplit,
  sessionsFromGuess,
  splitCandidates,
  splitTemplates,
} from "@utils/splitCard";
import {
  buildSplitCloudPayload,
  cleanSplitEntries,
  isMissingSplitEntriesColumnError,
  isMissingSplitNamesColumnError,
  readSplitCache,
  splitEntriesFromCloud,
  withLastCopy,
} from "@utils/splitEntries";

const PROFILE_PRIVATE_TABLE = "profile_private";
const CACHE_PREFIX = "fitven.split.";
const LIBRARY_LIMIT = 500;

// No split_names: nothing of the split reaches the cloud.
let cloudColumnMissing = false;
// No split_entries: the names do, the pins do not.
let entriesColumnMissing = false;

async function readCache(userId) {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + userId);

    return readSplitCache(raw ? JSON.parse(raw) : null);
  } catch {
    return null;
  }
}

async function writeCache(userId, entries, pending) {
  try {
    await AsyncStorage.setItem(CACHE_PREFIX + userId, JSON.stringify({ entries, pending }));
  } catch {
    // The cloud still has it, or will.
  }
}

async function upsertSplit(userId, entries) {
  const { error } = await supabase.from(PROFILE_PRIVATE_TABLE).upsert(
    {
      user_id: userId,
      ...buildSplitCloudPayload(entries, { withEntries: !entriesColumnMissing }),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  return error ?? null;
}

async function pushToCloud(userId, entries) {
  let error = await upsertSplit(userId, entries);

  if (error && !entriesColumnMissing && isMissingSplitEntriesColumnError(error)) {
    entriesColumnMissing = true;
    error = await upsertSplit(userId, entries);
  }

  if (error) {
    if (isMissingSplitNamesColumnError(error)) {
      cloudColumnMissing = true;
    }

    throw error;
  }
}

async function selectSplit(userId) {
  const read = (columns) =>
    supabase.from(PROFILE_PRIVATE_TABLE).select(columns).eq("user_id", userId).maybeSingle();

  if (!entriesColumnMissing) {
    const result = await read("split_names, split_entries");

    if (!result.error || !isMissingSplitEntriesColumnError(result.error)) {
      return result;
    }

    entriesColumnMissing = true;
  }

  return read("split_names");
}

/** The chosen split's entries, or null for none chosen. */
export async function getChosenSplitEntries({ userId }) {
  if (!userId) {
    return null;
  }

  const cached = await readCache(userId);

  if (cloudColumnMissing) {
    return cached?.entries ?? null;
  }

  // A choice made offline goes up first; the cloud's is older.
  if (cached?.pending) {
    try {
      await pushToCloud(userId, cached.entries);
      await writeCache(userId, cached.entries, false);
    } catch (error) {
      if (!cloudColumnMissing) {
        console.warn("The chosen split could not be sent yet:", error);
      }
    }

    return cached.entries;
  }

  try {
    const { data, error } = await selectSplit(userId);

    if (error) {
      if (isMissingSplitNamesColumnError(error)) {
        cloudColumnMissing = true;
      } else {
        console.warn("Could not read the chosen split:", error);
      }

      return cached?.entries ?? null;
    }

    const entries = splitEntriesFromCloud({
      names: data?.split_names ?? null,
      // Undefined while the column is missing: the pins come from the phone.
      entries: entriesColumnMissing ? undefined : data?.split_entries ?? null,
      cachedEntries: cached?.entries ?? null,
    });

    await writeCache(userId, entries, false);
    return entries;
  } catch (error) {
    console.warn("Could not read the chosen split:", error);
    return cached?.entries ?? null;
  }
}

/**
 * Saves the chosen split, or clears it with null so the cards go back to the
 * guess. Kept on the phone at once; sent to the cloud when it can be.
 */
export async function saveChosenSplit({ userId, entries }) {
  if (!userId) {
    return null;
  }

  const clean = cleanSplitEntries(entries);

  await writeCache(userId, clean, true);

  if (cloudColumnMissing) {
    return clean;
  }

  try {
    await pushToCloud(userId, clean);
    await writeCache(userId, clean, false);
  } catch (error) {
    if (!cloudColumnMissing) {
      console.warn("The chosen split is kept on the phone until it can be sent:", error);
    }
  }

  return clean;
}

/**
 * The chosen split's sessions, resolved against what is on the phone:
 * `rows` for names, and the pinned workouts (and their last copies) by
 * sync_id. `rows` is the library on the Train tab, and on Home only the
 * newest workout of each name in it, which resolves every session the same.
 */
async function resolveEntries(db, entries, { now, rows }) {
  const syncIds = (entries ?? []).flatMap((entry) => [entry.workout, entry.last]).filter(Boolean);
  const pinnedRows = syncIds.length > 0 ? await programService.getWorkoutsBySyncIds(db, syncIds) : [];
  const history = namedHistory(rows);

  return {
    history,
    sessions: entries
      ? resolveChosenSplit(entries, history, {
          now,
          templates: splitTemplates(rows),
          pinned: pinnedWorkouts(pinnedRows),
        })
      : [],
  };
}

/**
 * Everything the Train tab's split card shows: the sessions (chosen, or
 * guessed until something is chosen), what the editor offers, and "Repeat
 * also". `chosenEntries` carry `pinnedAt`, the pinned workout's day, so the
 * editor can tell two sessions of the same name apart.
 */
export async function getSplitCard(db, { userId, now = Date.now() }) {
  const [library, guess, chosenEntries] = await Promise.all([
    programService.getWorkoutLibrary(db, { limit: LIBRARY_LIMIT }),
    workoutService.getSplitGroups(db, { now }),
    getChosenSplitEntries({ userId }),
  ]);
  const { history, sessions: chosenSessions } = await resolveEntries(db, chosenEntries, { now, rows: library });
  const sessions = chosenEntries ? chosenSessions : sessionsFromGuess(guess, { now });

  return {
    source: chosenEntries ? "chosen" : "guess",
    sessions,
    chosenEntries: chosenEntries
      ? chosenSessions.map((session) => ({ ...session.entry, pinnedAt: session.pinnedAt }))
      : null,
    candidates: splitCandidates({ guess, history, now }),
    repeatAlso: repeatAlsoItems({
      history,
      splitNames: sessions.map((session) => session.name).filter(Boolean),
      now,
    }),
  };
}

/**
 * Home's split cards: the chosen split whenever there is one, resolved the
 * way the Train tab resolves it, and the guess only when none is chosen.
 *
 * Home does not wait on the network: the choice is read from the phone, and
 * the cloud's is fetched behind it, for the next time Home loads. Nor does it
 * read the library, as it loads on every focus: a session finds its workout
 * among the newest workout of each name, which is the one the library would
 * have given it (programService.getNewestWorkoutOfEachName).
 */
export async function getHomeSplitGroups(db, { userId, now = Date.now() }) {
  const cached = userId ? await readCache(userId) : null;

  if (userId && !cached?.pending) {
    getChosenSplitEntries({ userId }).catch(() => {});
  }

  if (!cached?.entries) {
    return workoutService.getSplitGroups(db, { now });
  }

  const rows = await programService.getNewestWorkoutOfEachName(db, { limit: LIBRARY_LIMIT });
  const { sessions } = await resolveEntries(db, cached.entries, { now, rows });

  return homeGroupsFromSplit(sessions);
}

/**
 * A pinned session was just started from the split, as `workoutId` (the
 * copy). Kept on its entry, so the split knows when that session - not just
 * any workout of its name - was last done. Never throws: the workout is
 * already open, and this is bookkeeping.
 */
export async function noteSplitSessionStarted(db, { userId, entry, workoutId }) {
  if (!userId || !entry?.workout || !workoutId) {
    return;
  }

  try {
    const last = await workoutService.ensureWorkoutSyncId(db, workoutId);
    const cached = await readCache(userId);
    const entries = withLastCopy(cached?.entries ?? null, { workout: entry.workout, last });

    if (entries && entries !== cached?.entries) {
      await saveChosenSplit({ userId, entries });
    }
  } catch (error) {
    console.warn("Could not note which split session was started:", error);
  }
}
