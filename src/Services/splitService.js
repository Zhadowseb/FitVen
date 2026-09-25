// The split somebody chose on the Train tab - the two to six sessions they
// rotate through without a program - and the card built from it.
//
// The choice lives on profile_private.split_names, so it follows them to a new
// phone, and on the phone too, so the card shows it offline and at once. A
// choice made offline is marked as not yet sent and goes up the next time the
// card loads, rather than being overwritten by the older one in the cloud.
// Until 20260926090000_your-split-follows-you.sql has run there is no cloud
// column, and the choice simply stays on the phone.
import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "../Database/supaBaseClient";
import * as programService from "./programService";
import * as workoutService from "./workoutService";
import {
  SPLIT_MAX_SESSIONS,
  SPLIT_MIN_SESSIONS,
  namedHistory,
  repeatAlsoItems,
  resolveChosenSplit,
  sessionsFromGuess,
  splitCandidates,
} from "@utils/splitCard";
import { normalizeSplitName } from "@utils/splitGuess";

const PROFILE_PRIVATE_TABLE = "profile_private";
const CACHE_PREFIX = "fitven.split.";
const LIBRARY_LIMIT = 500;

let cloudColumnMissing = false;

function isMissingColumn(error) {
  return error?.code === "42703" || error?.code === "PGRST204";
}

/** Trimmed, one per session, at most six - or null for fewer than two. */
export function cleanSplitNames(names) {
  if (!Array.isArray(names)) {
    return null;
  }

  const seen = new Set();
  const clean = [];

  for (const name of names) {
    const text = String(name ?? "").trim().slice(0, 60);
    const key = normalizeSplitName(text);

    if (key && !seen.has(key)) {
      seen.add(key);
      clean.push(text);
    }
  }

  const limited = clean.slice(0, SPLIT_MAX_SESSIONS);

  return limited.length >= SPLIT_MIN_SESSIONS ? limited : null;
}

async function readCache(userId) {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + userId);
    const parsed = raw ? JSON.parse(raw) : null;

    return parsed && typeof parsed === "object"
      ? { names: cleanSplitNames(parsed.names), pending: Boolean(parsed.pending) }
      : null;
  } catch {
    return null;
  }
}

async function writeCache(userId, names, pending) {
  try {
    await AsyncStorage.setItem(CACHE_PREFIX + userId, JSON.stringify({ names, pending }));
  } catch {
    // The cloud still has it, or will.
  }
}

async function pushToCloud(userId, names) {
  const { error } = await supabase.from(PROFILE_PRIVATE_TABLE).upsert(
    {
      user_id: userId,
      split_names: names,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    if (isMissingColumn(error)) {
      cloudColumnMissing = true;
    }

    throw error;
  }
}

/** The chosen split's names, or null for none chosen. */
export async function getChosenSplitNames({ userId }) {
  if (!userId) {
    return null;
  }

  const cached = await readCache(userId);

  if (cloudColumnMissing) {
    return cached?.names ?? null;
  }

  // A choice made offline goes up first; the cloud's is older.
  if (cached?.pending) {
    try {
      await pushToCloud(userId, cached.names);
      await writeCache(userId, cached.names, false);
    } catch (error) {
      if (!cloudColumnMissing) {
        console.warn("The chosen split could not be sent yet:", error);
      }
    }

    return cached.names;
  }

  try {
    const { data, error } = await supabase
      .from(PROFILE_PRIVATE_TABLE)
      .select("split_names")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      if (isMissingColumn(error)) {
        cloudColumnMissing = true;
      } else {
        console.warn("Could not read the chosen split:", error);
      }

      return cached?.names ?? null;
    }

    const names = cleanSplitNames(data?.split_names);

    await writeCache(userId, names, false);
    return names;
  } catch (error) {
    console.warn("Could not read the chosen split:", error);
    return cached?.names ?? null;
  }
}

/**
 * Saves the chosen split, or clears it with null so the card goes back to
 * the guess. Kept on the phone at once; sent to the cloud when it can be.
 */
export async function saveChosenSplitNames({ userId, names }) {
  if (!userId) {
    return null;
  }

  const clean = cleanSplitNames(names);

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
 * Everything the split card shows: the sessions (chosen, or guessed until
 * something is chosen), what the editor offers, and "Repeat also".
 */
export async function getSplitCard(db, { userId, now = Date.now() }) {
  const [library, guess, chosenNames] = await Promise.all([
    programService.getWorkoutLibrary(db, { limit: LIBRARY_LIMIT }),
    workoutService.getSplitGroups(db, { now }),
    getChosenSplitNames({ userId }),
  ]);
  const history = namedHistory(library);
  const sessions = chosenNames
    ? resolveChosenSplit(chosenNames, history, { now })
    : sessionsFromGuess(guess, { now });

  return {
    source: chosenNames ? "chosen" : "guess",
    sessions,
    chosenNames,
    candidates: splitCandidates({ guess, history, now }),
    repeatAlso: repeatAlsoItems({
      history,
      splitNames: sessions.map((session) => session.name).filter(Boolean),
      now,
    }),
  };
}
