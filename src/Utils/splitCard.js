// The Train tab's split card, for somebody without an active program: the
// sessions they rotate through, which one is next, and what else they might
// repeat. Worked out from the workout library (programService.getWorkoutLibrary
// rows) and either the split they chose or, until they choose one, the guess
// Home already makes (workoutService.getSplitGroups).
//
// Pure, so scripts/test-split-card.js runs it in Node.

import { normalizeSplitName, splitWorkoutName } from "./splitGuess";

const DAY_MS = 24 * 60 * 60 * 1000;

export const SPLIT_MIN_SESSIONS = 2;
export const SPLIT_MAX_SESSIONS = 6;
export const REPEAT_ALSO_LIMIT = 8;
// The editor offers the names used in this window, most used first.
export const CANDIDATE_DAYS = 90;
export const CANDIDATE_LIMIT = 12;

const STRENGTH_TYPES = new Set(["Resistance", "StrengthTraining", "Upperbody", "Legs"]);

function localDayStart(isoDate) {
  const match = String(isoDate ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);

  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime() : null;
}

/** Monday 00:00 of the week holding `now`, local time. */
export function startOfThisWeek(now) {
  const date = new Date(now);

  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));

  return date.getTime();
}

function daysBetween(at, now) {
  const today = new Date(now);

  today.setHours(0, 0, 0, 0);

  return Math.max(0, Math.round((today.getTime() - at) / DAY_MS));
}

/**
 * The finished strength workouts that carry a name somebody gave them, newest
 * first, as `{ workoutId, name, workoutType, key, at, exerciseCount,
 * isFavorite }`. `key` is the name as the split compares it.
 */
export function namedHistory(library = []) {
  return library
    .filter((row) => Number(row?.done) === 1 && STRENGTH_TYPES.has(row?.workout_type))
    .map((row) => ({
      workoutId: row.workout_id,
      name: String(row.label ?? "").trim(),
      workoutType: row.workout_type,
      key: splitWorkoutName({ name: row.label, workoutType: row.workout_type }),
      at: localDayStart(row.date_iso),
      exerciseCount: Number(row.exercise_count ?? row.exerciseCount) || 0,
      isFavorite: Number(row.is_favorite) === 1 || row.isFavorite === true,
    }))
    .filter((entry) => entry.key && entry.at !== null)
    .sort((left, right) => right.at - left.at || right.workoutId - left.workoutId);
}

function markNext(sessions) {
  // Longest since is next; never done at all is the longest of all. On a tie
  // the one that comes first in the split.
  let next = null;

  sessions.forEach((session, index) => {
    const since = session.lastTrainedAt === null ? Infinity : session.daysSince;
    const best = next === null ? -1 : next.since;

    if (since > best) {
      next = { index, since };
    }
  });

  return sessions.map((session, index) => ({ ...session, isUpNext: next !== null && index === next.index }));
}

/**
 * The sessions of a chosen split, in the order chosen, each with its latest
 * finished workout (the one "Repeat" copies), when that was, and whether it
 * was this week.
 */
export function resolveChosenSplit(names = [], history = [], { now }) {
  const weekStart = startOfThisWeek(now);
  const sessions = names.map((name) => {
    const key = normalizeSplitName(name);
    const latest = history.find((entry) => entry.key === key) ?? null;

    return {
      name,
      lastWorkoutId: latest?.workoutId ?? null,
      workoutType: latest?.workoutType ?? null,
      lastTrainedAt: latest?.at ?? null,
      daysSince: latest ? daysBetween(latest.at, now) : null,
      exerciseCount: latest?.exerciseCount ?? 0,
      doneThisWeek: latest ? latest.at >= weekStart : false,
    };
  });

  return markNext(sessions);
}

/** The guessed split in the card's shape. Its "next" is the guess's own. */
export function sessionsFromGuess(groups = [], { now }) {
  const weekStart = startOfThisWeek(now);

  return groups.map((group) => ({
    name: group.name ?? null,
    lastWorkoutId: group.lastWorkoutId ?? null,
    lastTrainedAt: group.lastTrainedAt ?? null,
    daysSince: group.daysSince ?? null,
    exerciseCount: group.exerciseCount ?? 0,
    doneThisWeek: Number.isFinite(group.lastTrainedAt) && group.lastTrainedAt >= weekStart,
    isUpNext: Boolean(group.isUpNext),
  }));
}

/**
 * What the editor offers to choose from: the guessed sessions first, then
 * the names used in the last 90 days (most used first), then favourites.
 * One entry per name, as it was last spelled.
 */
export function splitCandidates({ guess = [], history = [], now }) {
  const seen = new Set();
  const out = [];
  const add = (name) => {
    const key = normalizeSplitName(name);

    if (!key || seen.has(key) || out.length >= CANDIDATE_LIMIT) {
      return;
    }

    seen.add(key);
    out.push(String(name).trim());
  };

  guess.forEach((group) => group.name && add(group.name));

  const since = now - CANDIDATE_DAYS * DAY_MS;
  const counts = new Map();

  for (const entry of history) {
    if (entry.at >= since) {
      const current = counts.get(entry.key) ?? { name: entry.name, count: 0, at: entry.at };

      current.count += 1;
      counts.set(entry.key, current);
    }
  }

  [...counts.values()]
    .sort((left, right) => right.count - left.count || right.at - left.at)
    .forEach((entry) => add(entry.name));

  history.filter((entry) => entry.isFavorite).forEach((entry) => add(entry.name));

  return out;
}

/**
 * "Repeat also": favourites outside the split, then the most recently done
 * workouts outside it, one chip per name, at most eight.
 */
export function repeatAlsoItems({ history = [], splitNames = [], now, limit = REPEAT_ALSO_LIMIT }) {
  const excluded = new Set(splitNames.map(normalizeSplitName).filter(Boolean));
  const seen = new Set();
  const items = [];
  const add = (entry) => {
    if (items.length >= limit || excluded.has(entry.key) || seen.has(entry.key)) {
      return;
    }

    seen.add(entry.key);

    // The latest workout of that name, whichever entry put it on the list.
    const latest = history.find((candidate) => candidate.key === entry.key) ?? entry;

    items.push({
      key: entry.key,
      name: latest.name,
      workoutId: latest.workoutId,
      workoutType: latest.workoutType ?? null,
      daysSince: daysBetween(latest.at, now),
    });
  };

  history.filter((entry) => entry.isFavorite).forEach(add);
  history.forEach(add);

  return items;
}
