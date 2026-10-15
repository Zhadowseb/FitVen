// The exercises the most people train regularly (Utils/exercisePopularity.js),
// asked of the server: public.popular_exercises from
// supabase/migrations/20261016090000_popular-exercises.sql, which counts
// everybody's workouts and hands back only an exercise name and two counts.
//
// Never throws. Not signed in, offline, or the migration not run: an empty
// list, and the library simply has no "Popular" section. The answer is kept
// for ten minutes, since the counts move over weeks and the library is opened
// often.
import { supabase } from "@database/supaBaseClient";
import {
  POPULAR_MIN_USERS,
  POPULAR_SECTION_SIZE,
  normalizePopularRows,
} from "@utils/exercisePopularity";

const KEEP_MS = 10 * 60 * 1000;

let kept = null;
let pending = null;

/**
 * [{ exerciseName, regularUsers, triedUsers }], most popular first. `refresh`
 * skips the kept answer.
 */
export async function getPopularExercises({ limit = POPULAR_SECTION_SIZE * 2, refresh = false } = {}) {
  if (!refresh && kept && Date.now() - kept.at < KEEP_MS && kept.limit >= limit) {
    return kept.rows.slice(0, limit);
  }

  if (!pending) {
    pending = (async () => {
      try {
        const { data, error } = await supabase.rpc("popular_exercises", {
          p_limit: limit,
          p_min_users: POPULAR_MIN_USERS,
        });

        if (error) {
          // 42883 / PGRST202: the migration has not been run. Not an error to
          // shout about - the section just is not there.
          if (error.code !== "42883" && error.code !== "PGRST202") {
            console.warn("Could not read the popular exercises:", error.message ?? error);
          }

          return [];
        }

        const rows = normalizePopularRows(data);

        kept = { at: Date.now(), limit, rows };

        return rows;
      } catch (error) {
        console.warn("Could not read the popular exercises:", error);
        return [];
      } finally {
        pending = null;
      }
    })();
  }

  const rows = await pending;

  return rows.slice(0, limit);
}

/** Forgets the kept answer: a sign-out must not show the next person the last one's. */
export function clearPopularExercises() {
  kept = null;
}
