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

function buildPlatformBox(hasRows, downloads, previousDownloads) {
  if (!hasRows) {
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

/** The shape the screen draws when no store has written a row yet. */
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
  previousRating: null,
};

/**
 * `store_stats` rows into the two boxes and the chart.
 *
 * With no rows at all every number is `null`, never 0. The two mean different
 * things - nobody has told us, against nobody downloaded it - and a dashboard
 * that cannot tell them apart is worse than one that says nothing.
 *
 * That holds per store, not per table. Only the App Store has a fetcher
 * (`supabase/functions/store-stats`), so rows for iOS say nothing about Google
 * Play, and drawing its box as 0 would be a number nobody measured.
 */
export function buildStoreStats(rows = [], { days, now = Date.now() } = {}) {
  const grouping = pickGrouping(days);
  const currentFrom = days === null ? -Infinity : now - days * DAY_MS;
  const previousFrom = days === null ? -Infinity : now - 2 * days * DAY_MS;
  const totals = { ios: 0, android: 0 };
  const previousTotals = { ios: 0, android: 0 };
  const ratings = { ios: null, android: null };
  // What each store said before the period began: S7's "falling rating" is
  // this against `ratings`.
  const previousRatings = { ios: null, android: null };
  const hasRows = { ios: false, android: false };
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
    hasRows[platform] = true;

    const rating = Number(row?.rating);

    // The newest row per platform wins, and the rows arrive oldest first.
    if (row?.rating !== null && row?.rating !== undefined && Number.isFinite(rating)) {
      ratings[platform] = {
        rating,
        ratingCount: Number(row?.rating_count) || 0,
      };

      if (at < currentFrom) {
        previousRatings[platform] = ratings[platform];
      }
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
      ios: buildPlatformBox(hasRows.ios, totals.ios, previousTotals.ios),
      android: buildPlatformBox(hasRows.android, totals.android, previousTotals.android),
    },
    total: hasAnyRow ? totals.ios + totals.android : null,
    buckets: orderedBuckets.map((bucket) => ({
      ...bucket,
      total: bucket.ios + bucket.android,
      // The tallest bar is full; the rest are drawn against it.
      fill: maxTotal > 0 ? (bucket.ios + bucket.android) / maxTotal : 0,
    })),
    rating: buildRating(ratings),
    previousRating: buildRating(previousRatings),
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

/* ------------------------------------------------------------ the KPIs -- */

// Dev · Overblik: when a number is good, worth a look or an alarm. Every limit
// on the page lives here, once, and scripts/test-dev-dashboard.js holds each
// of them to its edge. The labels are Danish because the page is - it is for
// the admin and is not translated.

const WEEK_MS = 7 * DAY_MS;

/** The five a tile or a row can be in, in no particular order. */
export const KPI_STATUSES = ["good", "watch", "alarm", "baseline", "unmeasured"];

/**
 * Below this many in the denominator a ratio is the counts, not a verdict:
 * 11 of 16 coming back is 69 %, and one person more or less moves it six
 * points. The tile shows "11/16" with the percentage beside it, uncoloured,
 * and the status is `baseline`.
 */
export const SMALL_NUMBER_FLOOR = 30;

/** After a release a number is only watched, not judged, for this long. */
export const BASELINE_WEEKS = 4;

/**
 * KPI-2's limits: good from `good` %, watch from `alarm` %, alarm under it.
 * The page draws its two dashed lines at the same numbers, from here.
 */
export const COMES_BACK_LINES = Object.freeze({ good: 70, alarm: 50 });

const LABELS = {
  good: "Godt",
  watch: "Skal ses på",
  alarm: "Alarm",
  notConnected: "Ikke koblet på",
  notMeasured: "Ikke målt",
  failed: "Kunne ikke hentes",
  fewUsers: "Få brugere",
  baseline: "Baseline",
  noThreshold: "Ingen tærskel",
};

function verdict(status, label) {
  return { status, label };
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function toCount(value) {
  const number = toNumber(value);

  return number === null ? null : Math.round(number);
}

function toTime(value) {
  const at = value ? new Date(value).getTime() : NaN;

  return Number.isFinite(at) ? at : null;
}

/** True when a denominator is too small to colour a ratio - or unknown. */
export function isSmallNumber(denominator) {
  const n = toNumber(denominator);

  return n === null || n < SMALL_NUMBER_FLOOR;
}

/**
 * A ratio the way §2.3 draws it. Under the floor the count is what is worth
 * reading ("11/16") and the percentage goes beside it without a colour; from
 * the floor up the percentage is the value and may take the status colour.
 */
export function describeRatio(numerator, denominator) {
  const part = toNumber(numerator);
  const whole = toNumber(denominator);
  const percent = part !== null && whole !== null && whole > 0 ? (part / whole) * 100 : null;
  const small = isSmallNumber(whole);

  return {
    small,
    count: part === null || whole === null ? "—" : `${formatCount(part)}/${formatCount(whole)}`,
    percent,
    percentText: formatPercent(percent),
    coloured: !small,
  };
}

const SEVERITY = { good: 0, baseline: 1, unmeasured: 2, watch: 3, alarm: 4 };

/**
 * The status a glance should catch first, out of a list of statuses or of
 * `{ status }` objects: alarm, then watch, then not measured, then baseline,
 * then good. Grey outranks green on purpose - a section with a row nobody
 * measures does not get to say that everything is good. Returns the entry
 * itself, as it was given, or null for an empty list.
 */
export function worstStatus(list) {
  let worst = null;

  for (const entry of Array.isArray(list) ? list : []) {
    const status = typeof entry === "string" ? entry : entry?.status;

    if (!(status in SEVERITY)) {
      continue;
    }

    const worstSoFar = typeof worst === "string" ? worst : worst?.status;

    if (worst === null || SEVERITY[status] > SEVERITY[worstSoFar]) {
      worst = entry;
    }
  }

  return worst;
}

/** Whole weeks since a moment, or null when there is no moment. */
export function weeksSince(value, now = Date.now()) {
  const at = toTime(value);

  return at === null ? null : Math.max(0, Math.floor((now - at) / WEEK_MS));
}

/**
 * Whole weeks since the newest store build of either platform, from
 * getReleaseLag(). Null until a store tag exists - and without one there is no
 * release to measure a baseline from.
 */
export function getWeeksSinceRelease(releaseLag, now = Date.now()) {
  const times = ["android", "ios"]
    .map((platform) => toTime(releaseLag?.[platform]?.latestTagAt))
    .filter((at) => at !== null);

  return times.length > 0 ? weeksSince(Math.max(...times), now) : null;
}

// The context names the release either as weeks (`weeksSinceRelease`) or as
// a moment (`lastReleaseAt`, with `now`); both mean the same.
function contextWeeksSinceRelease(context) {
  const weeks = toNumber(context?.weeksSinceRelease);

  if (weeks !== null) {
    return weeks >= 0 ? weeks : null;
  }

  return context?.lastReleaseAt
    ? weeksSince(context.lastReleaseAt, toTime(context.now) ?? Date.now())
    : null;
}

/** "Baseline 2/4 uger" in the four weeks after a release, otherwise null. */
function releaseBaseline(context) {
  const weeks = contextWeeksSinceRelease(context);

  if (weeks === null || weeks >= BASELINE_WEEKS) {
    return null;
  }

  return verdict("baseline", `Baseline ${Math.floor(weeks) + 1}/${BASELINE_WEEKS} uger`);
}

function seriesOf(series, key) {
  return Array.isArray(series) ? series.map((point) => toNumber(point?.[key])) : [];
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * What KPI-3 is compared with: `context.baseline` when the caller has one,
 * otherwise the median over the four weeks after the release, otherwise the
 * oldest four weeks of the series.
 */
function planBaseline(value, context) {
  const given = toNumber(context?.baseline);

  if (given !== null) {
    return given;
  }

  const series = seriesOf(value?.series, "median");
  const weeks = contextWeeksSinceRelease(context);
  let window = [];

  if (weeks !== null) {
    // The last point is now, `weeks` after the release; the one before it a
    // week less. The baseline is the points one to four weeks after it.
    const released = Math.floor(weeks);

    window = series.filter((_, index) => {
      const after = released - (series.length - 1 - index);

      return after >= 1 && after <= BASELINE_WEEKS;
    });
  }

  if (!window.some((point) => point !== null)) {
    window = series.slice(0, BASELINE_WEEKS);
  }

  const known = window.filter((point) => point !== null);

  return known.length > 0 ? mean(known) : null;
}

function rateStatus(rate, { watchFrom, alarmAbove }) {
  const value = toNumber(rate);

  if (value === null) {
    return verdict("unmeasured", LABELS.notConnected);
  }

  if (value > alarmAbove) {
    return verdict("alarm", LABELS.alarm);
  }

  return value >= watchFrom ? verdict("watch", LABELS.watch) : verdict("good", LABELS.good);
}

const KPI_RULES = {
  // KPI-5a, a rate in percent (0.5 is 0.5 %).
  crash: (value) => rateStatus(value, { watchFrom: 0.5, alarmAbove: 1.09 }),
  anr: (value) => rateStatus(value, { watchFrom: 0.2, alarmAbove: 0.47 }),

  // KPI-5b, getBugReports().
  bugs: (value) => {
    if (!value) {
      return verdict("unmeasured", LABELS.notMeasured);
    }

    const sameVersion = (Array.isArray(value.byVersion) ? value.byVersion : []).some(
      (row) => row?.version && (toNumber(row.users) ?? 0) >= 2
    );

    if (sameVersion) {
      return verdict("alarm", "Samme version");
    }

    if ((toNumber(value.oldestNewDays) ?? 0) > 7) {
      return verdict("alarm", "Ubehandlet > 7 d");
    }

    return verdict("good", LABELS.good);
  },

  // KPI-1, getTrainingKpis().trainers7d.
  trainers7d: (value, context) => {
    const current = toNumber(value?.value);

    if (current === null) {
      return verdict("unmeasured", LABELS.notMeasured);
    }

    const baseline = releaseBaseline(context);

    if (baseline) {
      return baseline;
    }

    const previous = toNumber(value?.previous);

    if (isSmallNumber(previous)) {
      return verdict("baseline", LABELS.fewUsers);
    }

    if ((previous - current) / previous > 0.25) {
      return verdict("alarm", "Fald over 25 %");
    }

    const known = seriesOf(value?.series, "value").filter((point) => point !== null);
    const [first, second, third] = known.slice(-3);

    if (known.length >= 3 && third < second && second < first) {
      return verdict("alarm", "Fald 2 uger i træk");
    }

    return verdict("good", LABELS.good);
  },

  // KPI-2, getTrainingKpis().comesBack.
  comesBack: (value) => {
    if (!value) {
      return verdict("unmeasured", LABELS.notMeasured);
    }

    if (isSmallNumber(value.lastWeek)) {
      return verdict("baseline", LABELS.fewUsers);
    }

    const percent = toNumber(value.percent);

    if (percent === null) {
      return verdict("unmeasured", LABELS.notMeasured);
    }

    if (percent >= COMES_BACK_LINES.good) {
      return verdict("good", LABELS.good);
    }

    return percent >= COMES_BACK_LINES.alarm
      ? verdict("watch", LABELS.watch)
      : verdict("alarm", LABELS.alarm);
  },

  // KPI-3, getTrainingKpis().planCompleted.
  planCompleted: (value, context) => {
    if (!value) {
      return verdict("unmeasured", LABELS.notMeasured);
    }

    const baseline = releaseBaseline(context);

    if (baseline) {
      return baseline;
    }

    if (isSmallNumber(value.users)) {
      return verdict("baseline", LABELS.fewUsers);
    }

    const median = toNumber(value.median);

    if (median === null) {
      return verdict("unmeasured", LABELS.notMeasured);
    }

    const reference = planBaseline(value, context);

    if (reference !== null && reference - median >= 10) {
      return verdict("alarm", "Fald ≥ 10 point");
    }

    return verdict("good", LABELS.good);
  },

  // "Startet fra" has no limit; it is there to be read.
  startedFrom: (value) =>
    value ? verdict("baseline", LABELS.noThreshold) : verdict("unmeasured", LABELS.notMeasured),

  // KPI-6, one platform of getReleaseLag(). Release cadence is seven days.
  releaseLag: (value) => {
    if (!value) {
      return verdict("unmeasured", LABELS.notConnected);
    }

    if (value.unreleasedMajor) {
      return verdict("alarm", "Lav en release");
    }

    const days = toNumber(value.days);

    if (days === null) {
      return verdict("unmeasured", "Intet tag endnu");
    }

    if (days > 14) {
      return verdict("alarm", "Lav en release");
    }

    return days > 7 ? verdict("watch", LABELS.watch) : verdict("good", LABELS.good);
  },

  // KPI-4, one row of getFeatureUsage().features. `share` is a percentage;
  // `context.activeUsers` is its denominator.
  feature: (value, context) => {
    if (!value) {
      return verdict("unmeasured", LABELS.notMeasured);
    }

    // Nobody can have used what is not in a store build. It is a chip, not a
    // verdict.
    if (value.inLatestStoreTag === false) {
      return verdict("unmeasured", "Ikke udgivet");
    }

    const weeks = toNumber(value.weeksInStore);

    if (weeks === null) {
      return verdict("baseline", "Intet butikstag");
    }

    if (weeks < BASELINE_WEEKS) {
      return verdict("baseline", `uge ${Math.floor(weeks) + 1} af ${BASELINE_WEEKS}`);
    }

    if (isSmallNumber(context?.activeUsers ?? value.activeUsers)) {
      return verdict("baseline", LABELS.fewUsers);
    }

    const share = toNumber(value.share);

    if (share === null) {
      return verdict("unmeasured", LABELS.notMeasured);
    }

    if (share < 5 && weeks >= 8) {
      return verdict("alarm", "Kandidat til fjernelse");
    }

    return share < 10 ? verdict("watch", "Fastfrys") : verdict("good", LABELS.good);
  },

  // S2 and S6 are being measured before anybody sets a limit on them.
  s2: (value) =>
    value ? verdict("baseline", LABELS.baseline) : verdict("unmeasured", LABELS.notMeasured),
  s6: (value) =>
    value ? verdict("baseline", LABELS.baseline) : verdict("unmeasured", LABELS.notMeasured),

  // S3 needs the phones to report failed outbox rows, and nothing does yet.
  s3: () => verdict("unmeasured", LABELS.notMeasured),

  // S4, getSecondaryKpis().s4.
  s4: (value) => {
    if (!value) {
      return verdict("unmeasured", LABELS.notMeasured);
    }

    const over = toCount(value.overSevenDays) ?? 0;

    return over > 0 ? verdict("alarm", `${over} over 7 d`) : verdict("good", LABELS.good);
  },

  // S5 has no limit either; null until an app has reported its version.
  s5: (value) =>
    Array.isArray(value?.versions) && value.versions.length > 0
      ? verdict("baseline", LABELS.noThreshold)
      : verdict("unmeasured", "Ikke målt endnu"),

  // S7, getStoreStats(): a falling rating, at the one decimal it is shown in.
  s7: (value) => {
    const rating = toNumber(value?.rating);

    if (rating === null) {
      return verdict("unmeasured", LABELS.notConnected);
    }

    const previous = toNumber(value?.previousRating);

    if (previous === null) {
      return verdict("baseline", "Første måling");
    }

    return Math.round(rating * 10) < Math.round(previous * 10)
      ? verdict("alarm", "Faldende")
      : verdict("good", LABELS.good);
  },

  // S9, getSecondaryKpis().s9: the aim is 0, and a rise on a week ago is an
  // alarm rather than something to look at.
  s9: (value) => {
    if (!value) {
      return verdict("unmeasured", LABELS.notMeasured);
    }

    const empty = toCount(value.strengthWithoutSets) ?? 0;
    const duplicates = toCount(value.duplicateSyncIds) ?? 0;

    if (empty + duplicates === 0) {
      return verdict("good", LABELS.good);
    }

    const before = value.weekAgo;
    const rose =
      before &&
      (empty > (toCount(before.strengthWithoutSets) ?? 0) ||
        duplicates > (toCount(before.duplicateSyncIds) ?? 0));

    return rose ? verdict("alarm", "Stigende") : verdict("watch", LABELS.watch);
  },

  // S8, dev_metrics.bug_debt.
  s8: (value) => {
    if (!value) {
      return verdict("unmeasured", LABELS.notConnected);
    }

    return (toNumber(value.oldestDays) ?? 0) > 30
      ? verdict("alarm", "Over 30 dage")
      : verdict("good", LABELS.good);
  },

  // S10, dev_metrics.supabase_usage: the fullest of the four.
  s10: (value) => {
    const readings = ["db", "storage", "egress", "mau"]
      .map((key) => toNumber(value?.[key]))
      .filter((reading) => reading !== null);

    if (readings.length === 0) {
      return verdict("unmeasured", "Ikke aflæst");
    }

    const fullest = Math.max(...readings);

    if (fullest >= 80) {
      return verdict("alarm", LABELS.alarm);
    }

    return fullest >= 60 ? verdict("watch", LABELS.watch) : verdict("good", LABELS.good);
  },

  // S1, dev_metrics.rework: three rises in a row over its four weeks.
  s1: (value) => {
    if (!value) {
      return verdict("unmeasured", LABELS.notConnected);
    }

    const weeks = seriesOf(value.weeks, "percent").filter((point) => point !== null);

    if (weeks.length < 4) {
      return verdict("baseline", LABELS.baseline);
    }

    const [a, b, c, d] = weeks.slice(-4);

    return b > a && c > b && d > c
      ? verdict("alarm", "Stiger 3 uger")
      : verdict("good", LABELS.good);
  },
};

// The names the page uses for the same rules.
KPI_RULES.crashRate = KPI_RULES.crash;
KPI_RULES.anrRate = KPI_RULES.anr;
KPI_RULES.bugReports = KPI_RULES.bugs;
KPI_RULES.featureUsage = KPI_RULES.feature;

/**
 * Good, watch, alarm, baseline or unmeasured, with the short label under it.
 *
 * `value` is what the service returned for that number:
 *   crash, anr            the rate in percent
 *   bugs                  getBugReports()
 *   trainers7d, comesBack, planCompleted
 *                         that part of getTrainingKpis()
 *   startedFrom           getStartedFrom()
 *   releaseLag            one platform of getReleaseLag()
 *   feature               one row of getFeatureUsage().features
 *   s1 ... s10            that part of getSecondaryKpis(); s7 is getStoreStats()
 *
 * `context`: `weeksSinceRelease` (or `lastReleaseAt` and `now`) for
 * trainers7d and planCompleted; `activeUsers` for feature; `baseline` to give
 * planCompleted its reference directly; `failed: true` when the read failed.
 */
export function getKpiStatus(kpiKey, value, context = {}) {
  if (context?.failed) {
    return verdict("unmeasured", LABELS.failed);
  }

  if (value && typeof value === "object" && value.unavailable === true) {
    return verdict("unmeasured", LABELS.notConnected);
  }

  const rule = KPI_RULES[kpiKey];

  return rule ? rule(value, context ?? {}) : verdict("unmeasured", LABELS.notMeasured);
}

/* ------------------------------------------------ the service's shapes -- */

// Each admin RPC answers in snake_case jsonb. These turn an answer into the
// camelCase the page reads, and they are here rather than in adminService so
// the test can hold them to it.

/**
 * What a missing migration answers with, so the page can say "Ikke koblet på"
 * instead of an error: the function, table or column is not there
 * (42883, 42P01, 42703), or not in PostgREST's schema cache (PGRST...).
 */
export const MISSING_MIGRATION_CODES = [
  "42883",
  "42P01",
  "42703",
  "PGRST202",
  "PGRST204",
  "PGRST205",
];

export function isMissingMigrationError(error) {
  return MISSING_MIGRATION_CODES.includes(String(error?.code ?? ""));
}

function counts(source, keys) {
  return Object.fromEntries(keys.map((key) => [key, toCount(source?.[key])]));
}

/** admin_user_totals() */
export function shapeUserTotals(raw) {
  const downloads = raw?.downloads ?? {};
  const active = raw?.active ?? {};

  return {
    downloads: {
      ...counts(downloads, ["ios", "android", "total"]),
      lastWeek: counts(downloads.last_week, ["ios", "android", "total"]),
    },
    active: {
      ...counts(active, ["ios", "android", "total"]),
      source: active.source === "app_open" ? "app_open" : "push_tokens",
      windowDays: toCount(active.window_days) ?? 14,
    },
    computedAt: raw?.computed_at ?? null,
  };
}

/** admin_training_kpis() */
export function shapeTrainingKpis(raw) {
  const trainers = raw?.trainers_7d ?? {};
  const comesBack = raw?.comes_back ?? {};
  const plan = raw?.plan_completed ?? {};
  const points = (series, shape) => (Array.isArray(series) ? series.map(shape) : []);

  return {
    trainers7d: {
      value: toCount(trainers.value),
      previous: toCount(trainers.previous),
      series: points(trainers.series, (point) => ({
        weekStart: point?.week_start ?? null,
        value: toCount(point?.value),
      })),
    },
    comesBack: {
      both: toCount(comesBack.both),
      lastWeek: toCount(comesBack.last_week),
      percent: toNumber(comesBack.percent),
      series: points(comesBack.series, (point) => ({
        weekStart: point?.week_start ?? null,
        percent: toNumber(point?.percent),
        n: toCount(point?.n),
      })),
    },
    planCompleted: {
      median: toNumber(plan.median),
      users: toCount(plan.users),
      series: points(plan.series, (point) => ({
        weekStart: point?.week_start ?? null,
        median: toNumber(point?.median),
        users: toCount(point?.users),
      })),
    },
    computedAt: raw?.computed_at ?? null,
  };
}

/** admin_started_from(days) */
export function shapeStartedFrom(raw) {
  return {
    days: toCount(raw?.days) ?? 28,
    total: toCount(raw?.total),
    counts: counts(raw?.counts, ["program", "recent", "calendar", "empty", "other"]),
    available: raw?.available === true,
    computedAt: raw?.computed_at ?? null,
  };
}

/** admin_feature_usage(days), with the weeks each feature has been in a store. */
export function shapeFeatureUsage(raw, now = Date.now()) {
  return {
    days: toCount(raw?.days) ?? 28,
    activeUsers: toCount(raw?.active_users),
    source: raw?.source === "app_open" ? "app_open" : "push_tokens",
    features: (Array.isArray(raw?.features) ? raw.features : []).map((feature) => ({
      key: feature?.key ?? null,
      users: toCount(feature?.users),
      share: toNumber(feature?.share),
      commits: toCount(feature?.commits),
      firstInStoreAt: feature?.first_in_store_at ?? null,
      inLatestStoreTag:
        typeof feature?.in_latest_store_tag === "boolean" ? feature.in_latest_store_tag : null,
      weeksInStore: weeksSince(feature?.first_in_store_at, now),
    })),
    commitsSince: raw?.commits_since ?? null,
    measuredAt: raw?.measured_at ?? null,
    computedAt: raw?.computed_at ?? null,
  };
}

/** admin_bug_reports(days) */
export function shapeBugReports(raw) {
  return {
    days: toCount(raw?.days) ?? 7,
    total: toCount(raw?.total),
    users: toCount(raw?.users),
    byVersion: (Array.isArray(raw?.by_version) ? raw.by_version : []).map((row) => ({
      version: row?.version ?? null,
      count: toCount(row?.count),
      users: toCount(row?.users),
    })),
    oldestNewDays: toNumber(raw?.oldest_new_days),
    computedAt: raw?.computed_at ?? null,
  };
}

/** The newest store_stats row with a crash or ANR rate, per platform. */
export function shapeStoreHealth({ ios = null, android = null } = {}) {
  const platform = (row) =>
    row
      ? {
          crashRate: toNumber(row.crash_rate),
          anrRate: toNumber(row.anr_rate),
          measuredAt: row.measured_at ?? row.day ?? null,
        }
      : null;

  return { ios: platform(ios), android: platform(android) };
}

/** The dev_metrics release_lag rows, as the Action wrote them. */
export function shapeReleaseLag(rows = []) {
  const byPlatform = { android: null, ios: null };
  let measuredAt = null;

  for (const row of Array.isArray(rows) ? rows : []) {
    if (!(row?.platform in byPlatform) || !row.value || typeof row.value !== "object") {
      continue;
    }

    byPlatform[row.platform] = row.value;

    if (toTime(row.measured_at) !== null && (measuredAt === null || toTime(row.measured_at) > toTime(measuredAt))) {
      measuredAt = row.measured_at;
    }
  }

  return { ...byPlatform, measuredAt };
}

// A dev_metrics value is camelCase already - the Action and the admin write
// it that way - so it is passed on as it is, with when it was measured.
function metricValue(entry) {
  return entry?.value && typeof entry.value === "object" && !Array.isArray(entry.value)
    ? { ...entry.value, measuredAt: entry.measured_at ?? null }
    : null;
}

/** admin_secondary_kpis() */
export function shapeSecondaryKpis(raw) {
  const s2 = raw?.s2;
  const s4 = raw?.s4;
  const s5 = raw?.s5;
  const s6 = raw?.s6;
  const s9 = raw?.s9;

  return {
    s1: metricValue(raw?.s1),
    s2: s2 ? { stale: toCount(s2.stale), started: toCount(s2.started) } : null,
    s3: null,
    s4: s4
      ? {
          medianDays: toNumber(s4.median_days),
          total: toCount(s4.total),
          overSevenDays: toCount(s4.over_seven_days),
        }
      : null,
    s5: s5
      ? {
          versions: (Array.isArray(s5.versions) ? s5.versions : []).map((entry) => ({
            version: entry?.version ?? null,
            users: toCount(entry?.users),
          })),
        }
      : null,
    s6: s6
      ? { newAccounts: toCount(s6.new_accounts), trainedWithin7d: toCount(s6.trained_within_7d) }
      : null,
    s8: metricValue(raw?.s8),
    s9: s9
      ? {
          strengthWithoutSets: toCount(s9.strength_without_sets),
          duplicateSyncIds: toCount(s9.duplicate_sync_ids),
          weekAgo: {
            strengthWithoutSets: toCount(s9.week_ago?.strength_without_sets),
            duplicateSyncIds: toCount(s9.week_ago?.duplicate_sync_ids),
          },
        }
      : null,
    s10: metricValue(raw?.s10),
    computedAt: raw?.computed_at ?? null,
  };
}

/**
 * S10 as the admin typed it: a percentage of the plan for each of the four, or
 * null for one left blank. Over 100 is kept - a project can be over its plan.
 */
export function buildSupabaseUsageValue(
  { db, storage, egress, mau, readAt } = {},
  now = Date.now()
) {
  const percent = (value) => {
    const number = toNumber(value);

    return number === null || number < 0 ? null : Math.round(number * 10) / 10;
  };
  const readTime = toTime(readAt);

  return {
    db: percent(db),
    storage: percent(storage),
    egress: percent(egress),
    mau: percent(mau),
    readAt: new Date(readTime ?? now).toISOString(),
  };
}
