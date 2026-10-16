// What makes an exercise popular, for the top of the exercise library.
//
// An exercise is popular for a person when they keep coming back to it, not
// when they tried it once. Over their last POPULAR_WINDOW_DAYS days of finished
// workouts it has to be in at least POPULAR_MIN_WORKOUTS of them and in at
// least POPULAR_MIN_SHARE of all of them - a low bar on purpose: about one
// workout in every seven. An exercise's score is the number of people it is
// popular for.
//
// The count itself is made on the server, where everybody's workouts are
// (public.popular_exercises, supabase/migrations/20261016090000_popular-exercises.sql),
// and its numbers have to be these: scripts/test-exercise-popularity.js reads
// the migration and fails if they drift. This file holds the rule in one place
// for the app, and shapes the answer for the list. Pure.

export const POPULAR_WINDOW_DAYS = 90;
export const POPULAR_MIN_WORKOUTS = 3;
export const POPULAR_MIN_SHARE = 0.15;
// An exercise popular for fewer people than this is not listed: a list should
// never say "one person".
export const POPULAR_MIN_USERS = 2;
// How many the library shows at the top.
export const POPULAR_SECTION_SIZE = 5;

/**
 * Whether one person does an exercise regularly: `workoutsWith` of their
 * `totalWorkouts` finished workouts in the window had it, with a set done.
 */
export function isRegularExercise({ workoutsWith, totalWorkouts }) {
  const withIt = Number(workoutsWith);
  const total = Number(totalWorkouts);

  if (!Number.isFinite(withIt) || !Number.isFinite(total) || total <= 0) {
    return false;
  }

  return withIt >= POPULAR_MIN_WORKOUTS && withIt / total >= POPULAR_MIN_SHARE;
}

/** The server's rows as the app uses them; anything that is not a name and a count is dropped. */
export function normalizePopularRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => ({
      exerciseName: typeof row?.exercise_name === "string" ? row.exercise_name.trim() : "",
      regularUsers: Math.max(0, Math.trunc(Number(row?.regular_users)) || 0),
      triedUsers: Math.max(0, Math.trunc(Number(row?.tried_users)) || 0),
    }))
    .filter((row) => row.exerciseName !== "" && row.regularUsers >= POPULAR_MIN_USERS);
}

const nameKey = (name) => String(name ?? "").trim().toLocaleLowerCase();

/**
 * The popular exercises that this phone's library has, in the server's order,
 * each with the people it is popular for - the library's own exercise object,
 * so a row looks and works like every other. The server lists the catalogue;
 * one the phone does not know yet is left out rather than drawn without a figure.
 */
export function popularLibraryEntries(popular, exercises, { limit = POPULAR_SECTION_SIZE } = {}) {
  const byName = new Map();

  for (const exercise of exercises ?? []) {
    const key = nameKey(exercise?.exercise_name);

    if (key && !byName.has(key)) {
      byName.set(key, exercise);
    }
  }

  const entries = [];

  for (const row of popular ?? []) {
    const exercise = byName.get(nameKey(row.exerciseName));

    if (exercise) {
      entries.push({ exercise, regularUsers: row.regularUsers });
    }

    if (entries.length >= limit) {
      break;
    }
  }

  return entries;
}
