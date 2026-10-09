// The split, for somebody without an active program: the sessions they
// rotate through, which one is next, and what else they might repeat. Worked
// out from the workout library (programService.getWorkoutLibrary rows; on
// Home only the newest of each name, programService.getNewestWorkoutOfEachName) and
// either the split they chose or, until they choose one, the guess Home makes
// (workoutService.getSplitGroups). The Train tab's split card draws it, and
// Home's split cards draw a chosen one (homeGroupsFromSplit).
//
// Pure, so scripts/test-split-card.js runs it in Node.

import { normalizeSplitName, splitWorkoutName } from "./splitGuess";
import { normalizeSplitEntry } from "./splitEntries";
import { isWorkoutTypeId, workoutDisplayName, workoutTypeLabel } from "./workoutTypeLabel";

const DAY_MS = 24 * 60 * 60 * 1000;

export const SPLIT_MIN_SESSIONS = 2;
export const SPLIT_MAX_SESSIONS = 6;
export const REPEAT_ALSO_LIMIT = 8;
// The editor offers the names used in this window, most used first.
export const CANDIDATE_DAYS = 90;
export const CANDIDATE_LIMIT = 12;

const STRENGTH_TYPES = new Set(["Resistance", "StrengthTraining", "Upperbody", "Legs"]);

// The SQL that picks the newest workout of each name for Home
// (programRepository.getNewestWorkoutOfEachName) skips the rows this cannot
// date with a GLOB of the same shape: '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*'.
// Change one and change the other, or Home and the Train tab stop agreeing.
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
      setCount: Number(row.set_count ?? row.setCount) || 0,
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
 * The name a workout joins the split under, or null when nobody named it.
 * A workout nobody named carries its type as its label ("Resistance"), or
 * the type's catalog name from the display queries; neither is a session.
 */
export function splitNameOf(workout) {
  const label = String(workout?.label ?? workout?.name ?? "").trim();
  const workoutType = workout?.workout_type ?? workout?.workoutType ?? "";

  if (!splitWorkoutName({ name: label, workoutType })) {
    return null;
  }

  // "StrengthTraining" on a Resistance workout is the same fallback spelled
  // the other way round.
  if (isWorkoutTypeId(label) && workoutTypeLabel(label, (key) => key) === workoutTypeLabel(workoutType, (key) => key)) {
    return null;
  }

  return label.slice(0, 60);
}

/**
 * What the split picker's name field starts on: the name as the title shows
 * it. A workout named after a type is stored in English ("Upperbody") and
 * read in the reader's language ("Overkrop"). "" for a workout with no name
 * of its own.
 */
export function splitNameDraft(entry, t) {
  const name = splitNameOf(entry);

  return name ? workoutDisplayName(name, t, entry?.workout_type) ?? name : "";
}

/**
 * Whether what is typed in the picker's name field renames the workout. A
 * field left on the name as it is shown - "Overkrop" for a stored
 * "Upperbody" - renames nothing. Compared trimmed.
 */
export function isSplitNameChanged(typed, entry, t) {
  return String(typed ?? "").trim() !== splitNameDraft(entry, t);
}

/**
 * Every named workout in the library, of any type and done or not, newest
 * first. A chosen session with no finished strength workout of its name -
 * picked from the calendar as a planned workout, or a run - still has one of
 * these to repeat.
 */
export function splitTemplates(library = []) {
  return library
    .map((row) => {
      const name = splitNameOf(row);

      return name
        ? {
            workoutId: row.workout_id,
            name,
            workoutType: row.workout_type ?? null,
            key: normalizeSplitName(name),
            at: localDayStart(row.date_iso),
            done: Number(row.done) === 1,
            exerciseCount: Number(row.exercise_count ?? row.exerciseCount) || 0,
            setCount: Number(row.set_count ?? row.setCount) || 0,
          }
        : null;
    })
    .filter((entry) => entry && entry.key && entry.at !== null)
    .sort((left, right) => right.at - left.at || right.workoutId - left.workoutId);
}

/**
 * The pinned workouts (and the copies made from them) by sync_id, from
 * workoutService.getWorkoutsBySyncIds rows. A deleted or not yet downloaded
 * workout is simply not in it.
 */
export function pinnedWorkouts(rows = []) {
  const bySyncId = new Map();

  for (const row of rows) {
    const at = localDayStart(row?.date_iso);

    if (row?.sync_id && at !== null) {
      bySyncId.set(row.sync_id, {
        workoutId: row.workout_id,
        workoutType: row.workout_type ?? null,
        at,
        done: Number(row.done) === 1,
        exerciseCount: Number(row.exercise_count) || 0,
        setCount: Number(row.set_count) || 0,
      });
    }
  }

  return bySyncId;
}

/**
 * The sessions of a chosen split, in the order chosen - entries
 * (Utils/splitEntries.js) or, as saved before pins, names.
 *
 * What "Repeat" copies (`lastWorkoutId`): a pinned session's own workout,
 * exactly, while it is on the phone. Otherwise - no pin, or the pinned
 * workout deleted or not downloaded yet - the latest finished strength
 * workout of its name, then `templates` (splitTemplates): the latest finished
 * workout of that name of any type, else the latest planned one, which gives
 * "Repeat" something to copy without claiming it was trained.
 *
 * When it was last trained: the latest finished workout of its name - unless
 * another pinned session in the split has the same name. Those share every
 * workout of the name, so a pinned one counts only its own: the pinned
 * workout if it was done, and the copy last started from it (`entry.last`)
 * once that is finished.
 */
export function resolveChosenSplit(entries = [], history = [], { now, templates = [], pinned = new Map() }) {
  const weekStart = startOfThisWeek(now);
  const normalized = entries.map((value) => normalizeSplitEntry(value)).filter(Boolean);
  const nameCounts = new Map();

  normalized.forEach((entry) => {
    const key = normalizeSplitName(entry.name);

    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  });

  const sessions = normalized.map((entry) => {
    const key = normalizeSplitName(entry.name);
    const own = entry.workout ? pinned.get(entry.workout) ?? null : null;
    const trained = history.find((candidate) => candidate.key === key) ?? null;
    const fallback = trained
      ? null
      : templates.find((candidate) => candidate.key === key && candidate.done) ??
        templates.find((candidate) => candidate.key === key) ??
        null;
    const byName = trained ?? fallback;
    const template = own ?? byName;
    let trainedAt;

    if (entry.workout && nameCounts.get(key) > 1) {
      const lastCopy = entry.last ? pinned.get(entry.last) ?? null : null;
      const dates = [own, lastCopy].filter((row) => row?.done).map((row) => row.at);

      trainedAt = dates.length > 0 ? Math.max(...dates) : null;
    } else {
      trainedAt = trained ? trained.at : fallback?.done ? fallback.at : null;
    }

    return {
      name: entry.name,
      entry,
      isPinned: Boolean(own),
      pinnedAt: own?.at ?? null,
      lastWorkoutId: template?.workoutId ?? null,
      workoutType: template?.workoutType ?? null,
      lastTrainedAt: trainedAt,
      daysSince: trainedAt !== null ? daysBetween(trainedAt, now) : null,
      exerciseCount: template?.exerciseCount ?? 0,
      setCount: template?.setCount ?? 0,
      doneThisWeek: trainedAt !== null ? trainedAt >= weekStart : false,
    };
  });

  return markNext(sessions);
}

/**
 * A chosen split as Home's split cards and Quick start draw it
 * (workoutService.getSplitGroups' shape). A session with nothing to copy has
 * no card - Home opens a session on a tap - and when that is the one up next,
 * nothing is marked next, just as the Train tab then offers no Repeat.
 */
export function homeGroupsFromSplit(sessions = []) {
  return sessions
    .map((session, index) => ({ session, index }))
    .filter(({ session }) => session.lastWorkoutId)
    .map(({ session, index }) => ({
      name: session.name,
      entry: session.entry ?? null,
      isChosen: true,
      lastWorkoutId: session.lastWorkoutId,
      workoutType: session.workoutType ?? null,
      lastTrainedAt: session.lastTrainedAt,
      // Never trained has waited longest, as the Train tab counts it; the
      // cards sort by this, so it has to be a number.
      daysSince: session.daysSince ?? Number.MAX_SAFE_INTEGER,
      exerciseCount: session.exerciseCount ?? 0,
      setCount: session.setCount ?? 0,
      weekdays: [],
      historyOrder: index,
      isUpNext: Boolean(session.isUpNext),
    }));
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
