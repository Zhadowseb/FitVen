// The arithmetic and the formatting behind the dev dashboard.
//
// It lives here rather than in `adminService` for the same reason
// `cloudActivityUtils` does: that file imports the Supabase client and
// therefore react-native, so nothing in it can be loaded by a test. These are
// pure functions over rows, and they are the only sums on the screen - the
// kind that look right until somebody checks them against a month boundary.

const DAY_MS = 24 * 60 * 60 * 1000;

/** The three the period picker offers. `null` days means everything there is. */
export const DEV_DASHBOARD_PERIODS = [
  { key: "7d", days: 7 },
  { key: "90d", days: 90 },
  { key: "all", days: null },
];

export const DEFAULT_DEV_DASHBOARD_PERIOD = "90d";

/**
 * What has been decided about a message, in the order the chips are drawn.
 *
 * `new` is where every message arrives. `not_fixed` is one state rather than
 * two: "won't fix" and "can't reproduce" read differently to somebody writing
 * a bug tracker and identically to the one person reading this screen.
 */
export const FEEDBACK_STATUSES = ["new", "planned", "fixed", "not_fixed"];

/** Everything except `new` counts as triaged - that is what the header shows. */
export function isTriaged(status) {
  return FEEDBACK_STATUSES.includes(status) && status !== "new";
}

/** Below this the crash-free box turns red. */
export const CRASH_FREE_FLOOR = 99;

export function getPeriodDays(periodKey) {
  const period = DEV_DASHBOARD_PERIODS.find((entry) => entry.key === periodKey);

  return period ? period.days : null;
}

/** Days per bar. A week of days, a quarter of weeks, everything of months. */
export function pickGrouping(days) {
  if (days === null) {
    return "month";
  }

  return days <= 7 ? "day" : "week";
}

function startOfBucket(date, grouping) {
  const bucket = new Date(date);

  bucket.setHours(0, 0, 0, 0);

  if (grouping === "month") {
    bucket.setDate(1);
    return bucket;
  }

  if (grouping === "week") {
    // Monday. getDay() is 0 on Sunday, which is the end of the week here.
    const weekday = (bucket.getDay() + 6) % 7;

    bucket.setDate(bucket.getDate() - weekday);
  }

  return bucket;
}

function buildPlatformBox(hasAnyRow, downloads, previousDownloads) {
  if (!hasAnyRow) {
    return { downloads: null, changePercent: null };
  }

  return {
    downloads,
    // Nothing to compare against is not a rise of a hundred percent. The
    // screen draws the change line only when there is one.
    changePercent:
      previousDownloads > 0
        ? Math.round(((downloads - previousDownloads) / previousDownloads) * 100)
        : null,
  };
}

/** Weighted by how many people left a review, not the mean of two means. */
function buildRating({ ios, android }) {
  const present = [ios, android].filter(
    (entry) => entry && Number.isFinite(entry.rating)
  );

  if (present.length === 0) {
    return null;
  }

  const weight = present.reduce((sum, entry) => sum + (entry.ratingCount || 0), 0);

  if (weight === 0) {
    return present.reduce((sum, entry) => sum + entry.rating, 0) / present.length;
  }

  return (
    present.reduce((sum, entry) => sum + entry.rating * (entry.ratingCount || 0), 0) /
    weight
  );
}

/** The shape the screen draws when the store keys have never been set. */
export const EMPTY_STORE_STATS = {
  hasData: false,
  grouping: "week",
  platforms: {
    ios: { downloads: null, changePercent: null },
    android: { downloads: null, changePercent: null },
  },
  total: null,
  buckets: [],
  rating: null,
};

/**
 * `store_stats` rows into the two boxes and the chart.
 *
 * With no rows at all every number is `null`, never 0. The two mean different
 * things - nobody has told us, against nobody downloaded it - and a dashboard
 * that cannot tell them apart is worse than one that says nothing.
 */
export function buildStoreStats(rows = [], { days, now = Date.now() } = {}) {
  const grouping = pickGrouping(days);
  const currentFrom = days === null ? -Infinity : now - days * DAY_MS;
  const previousFrom = days === null ? -Infinity : now - 2 * days * DAY_MS;
  const totals = { ios: 0, android: 0 };
  const previousTotals = { ios: 0, android: 0 };
  const ratings = { ios: null, android: null };
  const buckets = new Map();
  let hasAnyRow = false;

  for (const row of rows) {
    const platform = row?.platform === "ios" ? "ios" : "android";
    const downloads = Number(row?.downloads) || 0;
    // A date column comes back as "2026-09-21". Read as local midnight, so a
    // bar does not jump a day either side of the date line.
    const at = new Date(`${row?.day}T00:00:00`).getTime();

    if (!Number.isFinite(at)) {
      continue;
    }

    hasAnyRow = true;

    const rating = Number(row?.rating);

    // The newest row per platform wins, and the rows arrive oldest first.
    if (row?.rating !== null && row?.rating !== undefined && Number.isFinite(rating)) {
      ratings[platform] = {
        rating,
        ratingCount: Number(row?.rating_count) || 0,
      };
    }

    if (at < previousFrom) {
      continue;
    }

    if (at < currentFrom) {
      previousTotals[platform] += downloads;
      continue;
    }

    totals[platform] += downloads;

    const bucketKey = startOfBucket(new Date(at), grouping).getTime();
    const bucket = buckets.get(bucketKey) ?? { at: bucketKey, ios: 0, android: 0 };

    bucket[platform] += downloads;
    buckets.set(bucketKey, bucket);
  }

  const orderedBuckets = [...buckets.values()].sort((left, right) => left.at - right.at);
  const maxTotal = orderedBuckets.reduce(
    (highest, bucket) => Math.max(highest, bucket.ios + bucket.android),
    0
  );

  return {
    hasData: hasAnyRow,
    grouping,
    platforms: {
      ios: buildPlatformBox(hasAnyRow, totals.ios, previousTotals.ios),
      android: buildPlatformBox(hasAnyRow, totals.android, previousTotals.android),
    },
    total: hasAnyRow ? totals.ios + totals.android : null,
    buckets: orderedBuckets.map((bucket) => ({
      ...bucket,
      total: bucket.ios + bucket.android,
      // The tallest bar is full; the rest are drawn against it.
      fill: maxTotal > 0 ? (bucket.ios + bucket.android) / maxTotal : 0,
    })),
    rating: buildRating(ratings),
  };
}

/* -------------------------------------------------------- the formatting -- */

/** Danish thousands: a narrow space, not a comma. An em dash for nothing. */
export function formatCount(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "—";
  }

  return Math.round(Number(value))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** One decimal, Danish comma, em dash when the stores have not answered. */
export function formatRating(rating) {
  if (rating === null || rating === undefined || !Number.isFinite(rating)) {
    return "—";
  }

  return rating.toFixed(1).replace(".", ",");
}

export function formatPercent(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return `${value.toFixed(1).replace(".", ",")} %`;
}

/**
 * How long ago, in the shortest form that is still true.
 *
 * Minutes under an hour, hours under a day, then days. Nothing here needs to be
 * exact - it needs to say whether this arrived while you were asleep.
 */
export function formatAge(createdAt, now = Date.now()) {
  const at = createdAt ? new Date(createdAt).getTime() : NaN;

  if (!Number.isFinite(at)) {
    return "";
  }

  const minutes = Math.max(0, Math.round((now - at) / 60000));

  if (minutes < 60) {
    return `${minutes} m`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours} t`;
  }

  return `${Math.round(hours / 24)} d`;
}

/** "iOS 18.1 · iPhone 14 · v2.4.1", with whatever of it is actually known. */
export function formatMeta({ os, device, appVersion } = {}) {
  return [os, device, appVersion ? `v${String(appVersion).replace(/^v/, "")}` : null]
    .filter(Boolean)
    .join(" · ");
}

/** The label under a bar: a weekday letter, a week number, or a month. */
export function formatBucketLabel(at, grouping) {
  const date = new Date(at);

  if (grouping === "day") {
    return ["S", "M", "T", "O", "T", "F", "L"][date.getDay()];
  }

  if (grouping === "month") {
    return String(date.getMonth() + 1);
  }

  // ISO week: the week owning this date's Thursday.
  const thursday = new Date(date);

  thursday.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));

  const firstThursday = new Date(thursday.getFullYear(), 0, 4);

  return String(
    1 +
      Math.round(
        (thursday.getTime() - firstThursday.getTime()) / (7 * DAY_MS)
      )
  );
}
