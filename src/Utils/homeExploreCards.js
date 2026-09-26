// Home's "Fra Udforsk" rail: which cards it shows, and in what order.
//
// Pure - no React Native, no supabase - so scripts/test-home-explore.js loads
// it on its own. src/Services/homeExploreService.js gathers the parts, the
// rail (src/Pages/HomePage/Components/ExploreCarousel) says what each card
// reads, and this decides which cards there are.
//
// The rail replaced "Last month", which showed a new account five times 0 %,
// so it has to have something from the first day: before a single workout,
// and without a centre. Two cards need nothing at all - "Find your centre"
// when there is no centre, and the way into the shared exercises when there
// are none to show or the account is new. Everything else is a card when
// there is something to put on it.
//
// The order: your centre's new records first when there are any, because
// that is news. Then the rest in a base order that turns one step a day, so
// what comes first changes daily and stays put within the day. Then the cap.

export const HOME_EXPLORE_MAX_CARDS = 6;
export const HOME_EXPLORE_MAX_EXERCISES = 2;
export const HOME_EXPLORE_MAX_CENTRE_POSTS = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The phone's calendar day as a whole number: the same from midnight to
 * midnight, one more the next day. Counted from the local date rather than
 * the timestamp, so a change to or from summer time does not move it.
 */
export function localDayNumber(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);

  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

function hasId(value) {
  return (
    (typeof value === "number" && Number.isFinite(value)) ||
    (typeof value === "string" && value.trim().length > 0)
  );
}

function listOf(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

function textOf(value) {
  return typeof value === "string" ? value.trim() : "";
}

function finiteOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

// `value` mod `length` for any whole number, negative ones included.
function turn(value, length) {
  const whole = Math.trunc(finiteOrNull(value) ?? 0);

  return ((whole % length) + length) % length;
}

function rotate(items, steps) {
  if (items.length < 2) {
    return items.slice();
  }

  const offset = turn(steps, items.length);

  return [...items.slice(offset), ...items.slice(0, offset)];
}

// A lift a card can name: an exercise and a weight.
function isNamedLift(lift, exerciseName) {
  return Boolean(lift) && textOf(exerciseName).length > 0 && finiteOrNull(lift.weightKg) !== null;
}

/**
 * The cards, in order: `[{ key, type, ... }]`, at most `maxCards`.
 *
 *   gymRecords       there is a home centre: { gym, newCount, latest } - the
 *                    records set since you last looked, the newest record
 *                    (or null), the centre
 *   exercise         a shared exercise: { exercise }. At most two, in the
 *                    order given - the service asks for the newest - and
 *                    never your own
 *   centrePost       a post from a centre you train in: { post }. At most
 *                    two, and only posts that know their centre, which the
 *                    card opens
 *   strongest        one of Denmark's strongest, picked by the day:
 *                    { exerciseId, exerciseName, lift }
 *   findGym          there is no home centre
 *   customExercises  the way into the library, when there is no exercise to
 *                    show or the account is new - no centre, which is what a
 *                    new account is
 *
 * Every part may be missing, null or empty; a user with nothing still gets
 * findGym and customExercises. `dayNumber` is localDayNumber() - the caller
 * passes it, so this stays the same for the same day.
 */
export function buildHomeExploreCards({
  homeGym = null,
  gymRecords = null,
  exercises = [],
  centrePosts = [],
  strongest = [],
  dayNumber = 0,
  maxCards = HOME_EXPLORE_MAX_CARDS,
} = {}) {
  const gym = homeGym && typeof homeGym === "object" && hasId(homeGym.id) ? homeGym : null;
  let centre = { key: "findGym", type: "findGym" };

  if (gym) {
    const records = gymRecords && typeof gymRecords === "object" ? gymRecords : null;
    const latest = records?.latest ?? null;

    centre = {
      key: `gymRecords:${gym.id}`,
      type: "gymRecords",
      gym,
      newCount: Math.max(0, Math.trunc(finiteOrNull(records?.newCount) ?? 0)),
      latest: isNamedLift(latest, latest?.exerciseName) ? latest : null,
    };
  }

  const exerciseCards = [];
  const exerciseIds = new Set();

  for (const item of listOf(exercises)) {
    if (exerciseCards.length >= HOME_EXPLORE_MAX_EXERCISES) {
      break;
    }

    if (item.isMine || !hasId(item.id) || !textOf(item.name) || exerciseIds.has(String(item.id))) {
      continue;
    }

    exerciseIds.add(String(item.id));
    exerciseCards.push({ key: `exercise:${item.id}`, type: "exercise", exercise: item });
  }

  const postCards = [];
  const postIds = new Set();

  for (const post of listOf(centrePosts)) {
    if (postCards.length >= HOME_EXPLORE_MAX_CENTRE_POSTS) {
      break;
    }

    if (!hasId(post.id) || !hasId(post.gym?.id) || postIds.has(String(post.id))) {
      continue;
    }

    postIds.add(String(post.id));
    postCards.push({ key: `centrePost:${post.id}`, type: "centrePost", post });
  }

  // The featured exercises that have a top lift at all, one of them a day.
  const lifts = listOf(strongest).filter(
    (entry) =>
      hasId(entry.exerciseId) &&
      isNamedLift(entry.top, textOf(entry.exerciseName) || textOf(entry.top?.exerciseName))
  );
  const pick = lifts.length > 0 ? lifts[turn(dayNumber, lifts.length)] : null;
  const strongestCard = pick
    ? {
        key: `strongest:${pick.exerciseId}`,
        type: "strongest",
        exerciseId: pick.exerciseId,
        exerciseName: textOf(pick.exerciseName) || textOf(pick.top.exerciseName),
        lift: pick.top,
      }
    : null;

  const library =
    exerciseCards.length === 0 || !gym ? { key: "customExercises", type: "customExercises" } : null;
  const pinned = centre.type === "gymRecords" && centre.newCount > 0 ? centre : null;

  // Kinds take turns, so the first six after any day's turn are a mix.
  const base = [
    pinned ? null : centre,
    exerciseCards[0],
    postCards[0],
    strongestCard,
    exerciseCards[1],
    postCards[1],
    library,
  ].filter(Boolean);
  const limit = Math.max(0, Math.trunc(finiteOrNull(maxCards) ?? HOME_EXPLORE_MAX_CARDS));

  return [...(pinned ? [pinned] : []), ...rotate(base, dayNumber)].slice(0, limit);
}
