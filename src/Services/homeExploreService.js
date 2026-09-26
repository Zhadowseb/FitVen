// Home's "Fra Udforsk" rail: the parts of Explore it makes its cards from -
// your centre and what is new there, the newest exercises people have shared,
// posts from the centres you train in, and Denmark's strongest. Which of them
// become cards, and in what order, is src/Utils/homeExploreCards.js.
//
// Settled, not all, as Explore's own load is: each part stands on its own, a
// part that fails is null or empty, and a backend without one of the
// migrations is a rail without that card. Nothing here throws.
import * as exerciseService from "./exerciseService";
import * as gymService from "./gymService";
import * as socialPostService from "./socialPostService";
import { getLastSeenOrStart, gymSeenKey } from "@utils/lastSeen";

// At most two exercise cards and never your own, so six leaves room.
const SHARED_EXERCISE_LIMIT = 6;
// At most two post cards; a couple more in case one comes without its centre.
const CENTRE_POST_LIMIT = 4;

export const EMPTY_HOME_EXPLORE_FEED = Object.freeze({
  homeGym: null,
  gymRecords: null,
  exercises: [],
  centrePosts: [],
  strongest: [],
  allFailed: false,
});

// Home asks on every visit, and a migration that has not run fails the same
// way every time: each failure is logged the first time only.
const reported = new Set();

function reportOnce(label, reason) {
  const key = `${label}: ${reason?.message ?? String(reason)}`;

  if (reported.has(key)) {
    return;
  }

  reported.add(key);
  console.warn(`Home's From Explore could not load ${label}:`, reason);
}

function valueOf(result, fallback) {
  return result.status === "fulfilled" ? result.value ?? fallback : fallback;
}

function listOf(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * -> { homeGym, gymRecords, exercises, centrePosts, strongest, allFailed }
 *
 * homeGym      your centre (gymService.mapGym), or null
 * gymRecords   { gym, newCount, latest } since you last looked at the centre,
 *              or null
 * exercises    the newest shared exercises, your own included - the cards
 *              leave those out
 * centrePosts  posts from your centre and the centres you train in
 * strongest    gymService.getNationalStrongest()'s entries
 * allFailed    nothing that was asked for came back - offline, most likely -
 *              so the rail can keep what it already shows
 *
 * "Since you last looked" is the time Explore's centre card counts from. It is
 * only read here, never moved forward: the centre's page does that when it
 * is opened. The very first read stores now as the start, as Explore's does,
 * so that every record that already exists is not suddenly new.
 */
export async function getHomeExploreFeed({ user } = {}) {
  const userId = user?.id ?? null;

  if (!userId) {
    return { ...EMPTY_HOME_EXPLORE_FEED };
  }

  const [homeGymResult, myGymsResult, sharedResult, strongestResult] = await Promise.allSettled([
    gymService.getMyHomeGym(),
    gymService.getMyGyms(),
    exerciseService.getPublicCustomExercises({ sort: "newest", limit: SHARED_EXERCISE_LIMIT }),
    gymService.getNationalStrongest(),
  ]);
  const homeGym = valueOf(homeGymResult, null);
  const centreIds = [
    ...new Set(
      [homeGym?.id, ...listOf(valueOf(myGymsResult, [])).map((gym) => gym?.id)].filter(
        (id) => id !== null && id !== undefined
      )
    ),
  ];
  const asksRecords = Boolean(homeGym);
  const asksPosts = centreIds.length > 0;

  const [recordsResult, postsResult] = await Promise.allSettled([
    asksRecords
      ? getLastSeenOrStart(gymSeenKey(userId, homeGym.id)).then((since) =>
          gymService.getRecentGymRecords({ gymId: homeGym.id, since })
        )
      : Promise.resolve(null),
    asksPosts
      ? socialPostService.getCentrePosts({ user, gymIds: centreIds, limit: CENTRE_POST_LIMIT })
      : Promise.resolve([]),
  ]);

  const asked = [
    ["your centre", homeGymResult],
    ["the centres you train in", myGymsResult],
    ["the shared exercises", sharedResult],
    ["Denmark's strongest", strongestResult],
    ...(asksRecords ? [["the centre's records", recordsResult]] : []),
    ...(asksPosts ? [["the centre posts", postsResult]] : []),
  ];

  for (const [label, result] of asked) {
    if (result.status === "rejected") {
      reportOnce(label, result.reason);
    }
  }

  // A backend without the sharing migration has nothing shared yet.
  const shared = valueOf(sharedResult, null);

  return {
    homeGym,
    gymRecords: valueOf(recordsResult, null),
    exercises: shared && !shared.unavailable ? listOf(shared.items) : [],
    centrePosts: listOf(valueOf(postsResult, [])),
    strongest: listOf(valueOf(strongestResult, [])),
    allFailed: asked.every(([, result]) => result.status === "rejected"),
  };
}
