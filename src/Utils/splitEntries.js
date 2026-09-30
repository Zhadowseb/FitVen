// What a chosen split is made of: two to six entries, each a session's name
// and, when it was picked as a particular workout, that workout.
//
//   { name: "Push", workout: "<sync_id>" | null, last: "<sync_id>" | null }
//
// `workout` pins the session to one workout - the one "Repeat" copies, its
// exercises and sets exactly - so two sessions can both be called "Push" and
// still be two different workouts. It is the workout's sync_id, the identity
// it has on every phone, never the local workout_id. An entry without one
// (chosen by name in the editor, or saved before pins existed) finds the
// latest workout of its name, the way the split always has.
//
// `last` is the copy made the last time that pinned session was started from
// the split. Two sessions of the same name share every finished workout of
// that name, so which of them was done last can only come from here.
//
// The cloud keeps the entries in profile_private.split_entries and, beside
// them, the names in split_names - which a build from before pins still reads
// and writes. Until 20261006090000_a-split-pins-its-workouts.sql has run there
// is no split_entries column: the names go up alone and the pins stay on the
// phone, laid back onto the names when they come down (mergeSplitEntries).
//
// Pure, so scripts/test-split-card.js and scripts/test-split-pins.js run it in
// Node.

import { normalizeSplitName } from "./splitGuess";

export const SPLIT_MIN_ENTRIES = 2;
export const SPLIT_MAX_ENTRIES = 6;
const NAME_LIMIT = 60;

function cleanName(value) {
  return String(value ?? "").trim().slice(0, NAME_LIMIT);
}

function cleanSyncId(value) {
  const text = typeof value === "string" ? value.trim() : "";

  return text || null;
}

function columnIsMissing(error, column) {
  const message = `${error?.message ?? ""} ${error?.details ?? ""} ${error?.hint ?? ""}`;

  return (error?.code === "42703" || error?.code === "PGRST204") && new RegExp(`\\b${column}\\b`).test(message);
}

/**
 * The cloud has no split_entries column yet: a read says "column
 * profile_private.split_entries does not exist" (42703), a write "Could not
 * find the 'split_entries' column" (PGRST204). A word match, so a missing
 * split_names is not mistaken for it - that one turns off split sync
 * altogether, this one only the pins.
 */
export function isMissingSplitEntriesColumnError(error) {
  return columnIsMissing(error, "split_entries");
}

export function isMissingSplitNamesColumnError(error) {
  return columnIsMissing(error, "split_names");
}

/** One entry from a stored name, a stored entry or anything else; null for nothing. */
export function normalizeSplitEntry(value) {
  const source = typeof value === "string" ? { name: value } : value;
  const name = cleanName(source?.name);

  if (!normalizeSplitName(name)) {
    return null;
  }

  const workout = cleanSyncId(source?.workout ?? source?.workout_sync_id);

  return {
    name,
    workout,
    // A copy only means something for a pinned session.
    last: workout ? cleanSyncId(source?.last) : null,
  };
}

/** A pinned entry is itself; a name-only one is its name. */
export function splitEntryKey(entry) {
  return entry?.workout ? `workout:${entry.workout}` : `name:${normalizeSplitName(entry?.name)}`;
}

/**
 * Two to six entries in the order given, or null. The same pinned workout
 * counts once, and so does the same name without a pin; two pinned workouts
 * of the same name are two sessions.
 */
export function cleanSplitEntries(values) {
  if (!Array.isArray(values)) {
    return null;
  }

  const seen = new Set();
  const clean = [];

  for (const value of values) {
    const entry = normalizeSplitEntry(value);
    const key = entry ? splitEntryKey(entry) : null;

    if (key && !seen.has(key)) {
      seen.add(key);
      clean.push(entry);
    }
  }

  const limited = clean.slice(0, SPLIT_MAX_ENTRIES);

  return limited.length >= SPLIT_MIN_ENTRIES ? limited : null;
}

export function splitEntryNames(entries) {
  return Array.isArray(entries) ? entries.map((entry) => entry.name) : null;
}

function sameNames(entries, names) {
  return (
    Array.isArray(entries) &&
    Array.isArray(names) &&
    entries.length === names.length &&
    entries.every((entry, index) => normalizeSplitName(entry.name) === normalizeSplitName(names[index]))
  );
}

/**
 * The names as the cloud has them, with the pins `entries` held for them: in
 * order, each name takes the first unused entry of its name. A name no entry
 * has comes in without a pin.
 */
export function mergeSplitEntries(entries, names) {
  if (!Array.isArray(names)) {
    return null;
  }

  const pool = (Array.isArray(entries) ? entries : []).map(normalizeSplitEntry).filter(Boolean);
  const used = new Set();
  const merged = names.map((name) => {
    const key = normalizeSplitName(name);
    const index = pool.findIndex((entry, at) => !used.has(at) && normalizeSplitName(entry.name) === key);

    if (index < 0) {
      return name;
    }

    used.add(index);
    return { ...pool[index], name: cleanName(name) || pool[index].name };
  });

  return cleanSplitEntries(merged);
}

/**
 * The split from what the cloud answered. `names` is split_names, which a
 * build from before pins may have changed since the entries were written, so
 * it decides which sessions there are; `entries` (split_entries, or undefined
 * while the column is missing) and then `cachedEntries` give them their pins.
 */
export function splitEntriesFromCloud({ names, entries, cachedEntries = null }) {
  if (!Array.isArray(names)) {
    return null;
  }

  const pinned = Array.isArray(entries) ? entries : cachedEntries;

  if (sameNames(pinned, names)) {
    return cleanSplitEntries(pinned);
  }

  return mergeSplitEntries(pinned, names);
}

/** The row sent up: the names always, the entries while the column exists. */
export function buildSplitCloudPayload(entries, { withEntries = true } = {}) {
  const clean = cleanSplitEntries(entries);
  const payload = { split_names: splitEntryNames(clean) };

  if (withEntries) {
    payload.split_entries = clean
      ? clean.map((entry) => ({ name: entry.name, workout: entry.workout, last: entry.last }))
      : null;
  }

  return payload;
}

/** What the phone kept: `{ entries, pending }`, or the older `{ names, pending }`. */
export function readSplitCache(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  return {
    entries: cleanSplitEntries(Array.isArray(parsed.entries) ? parsed.entries : parsed.names),
    pending: Boolean(parsed.pending),
  };
}

/**
 * Adds an entry to the split being edited: at the end, once, while there is
 * room. "alreadyIn" is the same pinned workout, or the same name without a
 * pin - another workout of the same name is a session of its own.
 */
export function addSplitEntry(entries = [], value) {
  const entry = normalizeSplitEntry(value);

  if (!entry) {
    return { entries, status: "unnamed" };
  }

  const key = splitEntryKey(entry);

  if (entries.some((existing) => splitEntryKey(existing) === key)) {
    return { entries, status: "alreadyIn" };
  }

  if (entries.length >= SPLIT_MAX_ENTRIES) {
    return { entries, status: "full" };
  }

  // What the editor draws beside it (the pinned day) rides along; saving
  // keeps only the entry itself.
  const extra = value && typeof value === "object" ? value : {};

  return { entries: [...entries, { ...extra, ...entry }], status: "added" };
}

/** The split with `last` set on the pinned entry for `workout`; unchanged when there is none. */
export function withLastCopy(entries, { workout, last }) {
  if (!Array.isArray(entries) || !workout || !last) {
    return entries;
  }

  return entries.map((entry) => (entry.workout === workout ? { ...entry, last } : entry));
}
