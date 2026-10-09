// The dev dashboard: the sums behind the boxes, and the two places where
// getting access wrong would be invisible.
//
// The arithmetic is worth a test because none of it is checkable by looking at
// the screen: a bar chart drawn from the wrong buckets looks exactly like one
// drawn from the right ones. The access half is worth a test because the
// screen is reached by one account, so nobody else would ever find out that a
// second one could reach it too.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");
const dashboard = loadAppModule("src/Utils/devDashboard.js");

const migration = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20260921220000_dev-dashboard.sql"),
  "utf8"
);

/* --------------------------------------------------------- the buckets --- */

// A Monday, so the week boundaries below are checkable by hand.
const now = new Date(2026, 8, 21, 12, 0, 0).getTime();
const DAY_MS = 86400000;

function day(daysAgo) {
  const date = new Date(now - daysAgo * DAY_MS);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

const row = (daysAgo, platform, downloads, rating = null, ratingCount = null) => ({
  day: day(daysAgo),
  platform,
  downloads,
  rating,
  rating_count: ratingCount,
});

const ninetyDays = dashboard.buildStoreStats(
  [
    // Inside the window.
    row(1, "ios", 10),
    row(1, "android", 5),
    row(8, "ios", 20),
    row(8, "android", 10),
    // The window before it, which the change line compares against.
    row(100, "ios", 15),
    row(100, "android", 30),
    // Older than both windows: counted for nothing but still a row.
    row(400, "ios", 999),
  ],
  { days: 90, now }
);

assert.strictEqual(ninetyDays.grouping, "week", "90 days is drawn per week");
assert.strictEqual(ninetyDays.platforms.ios.downloads, 30);
assert.strictEqual(ninetyDays.platforms.android.downloads, 15);
assert.strictEqual(ninetyDays.total, 45, "the chart total is both platforms");

// 30 against 15 is a doubling; 15 against 30 is half of it gone.
assert.strictEqual(ninetyDays.platforms.ios.changePercent, 100);
assert.strictEqual(ninetyDays.platforms.android.changePercent, -50);

assert.strictEqual(
  ninetyDays.buckets.length,
  2,
  "one day and eight days ago are different weeks from a Monday"
);
assert.deepStrictEqual(
  ninetyDays.buckets.map((bucket) => bucket.total),
  [30, 15],
  "the buckets are oldest first"
);
assert.strictEqual(ninetyDays.buckets[0].fill, 1, "the tallest bar is full");
assert.strictEqual(ninetyDays.buckets[1].fill, 0.5);

// A period with nothing before it has no comparison. A rise of a hundred
// percent from nothing is a number somebody would act on.
const firstEver = dashboard.buildStoreStats([row(1, "ios", 10)], { days: 90, now });

assert.strictEqual(firstEver.platforms.ios.changePercent, null, "nothing to compare");

// Unknown per store, not per table. Only the App Store has a fetcher, so its
// rows say nothing about Google Play - and a 0 there would be a number nobody
// measured, next to an app that is live on Play.
assert.strictEqual(
  firstEver.platforms.android.downloads,
  null,
  "a store with no rows of its own is drawn as zero because the other store has some"
);
assert.strictEqual(firstEver.platforms.android.changePercent, null);
assert.strictEqual(firstEver.total, 10, "the total is what the stores that answered said");
assert.strictEqual(
  dashboard.buildStoreStats([row(1, "android", 4)], { days: 90, now }).platforms.ios.downloads,
  null,
  "the same holds the other way round"
);

/* ------------------------------------------------- nothing is not zero --- */

// This is the state the screen is in until the store keys are set on the
// server, and it is the one the design document is most specific about.
const nothing = dashboard.buildStoreStats([], { days: 90, now });

assert.strictEqual(nothing.hasData, false);
assert.strictEqual(nothing.platforms.ios.downloads, null, "no answer is not zero");
assert.strictEqual(nothing.platforms.android.downloads, null);
assert.strictEqual(nothing.total, null);
assert.strictEqual(nothing.rating, null);
assert.deepStrictEqual(nothing.buckets, []);

assert.strictEqual(dashboard.formatCount(null), "—");
assert.strictEqual(dashboard.formatRating(null), "—");
assert.strictEqual(dashboard.formatPercent(null), "—");
assert.strictEqual(dashboard.formatCount(0), "0", "zero downloads is a zero");
assert.strictEqual(
  dashboard.formatCount(12345),
  "12 345",
  "thousands are split the Danish way"
);
assert.strictEqual(dashboard.formatRating(4.25), "4,3");

/* ----------------------------------------------------------- groupings --- */

assert.strictEqual(dashboard.pickGrouping(7), "day");
assert.strictEqual(dashboard.pickGrouping(90), "week");
assert.strictEqual(dashboard.pickGrouping(null), "month", "everything is per month");

const sevenDays = dashboard.buildStoreStats(
  [row(1, "ios", 3), row(2, "ios", 4), row(2, "android", 1)],
  { days: 7, now }
);

assert.strictEqual(sevenDays.grouping, "day");
assert.strictEqual(sevenDays.buckets.length, 2, "seven days is one bar per day");

// The month bucket is the one that breaks silently: a naive 30-day divide puts
// the 1st of a month in with the previous one.
const months = dashboard.buildStoreStats(
  [row(1, "ios", 1), row(21, "ios", 1), row(60, "ios", 1)],
  { days: null, now }
);

assert.strictEqual(months.grouping, "month");
assert.strictEqual(
  months.buckets.length,
  3,
  "20 September, 31 August and 23 July are three months' worth of bars"
);

/* ------------------------------------------------------------- ratings --- */

// Weighted by reviews, not the mean of two means: 4.8 from 10 people and 3.0
// from 990 is not a 3.9 app.
const weighted = dashboard.buildStoreStats(
  [row(2, "ios", 0, 4.8, 10), row(2, "android", 0, 3.0, 990)],
  { days: 90, now }
);

assert.ok(
  Math.abs(weighted.rating - 3.018) < 0.001,
  `the rating is a plain average of the two stores (got ${weighted.rating})`
);

// The newest row per platform is the current rating; the rows arrive oldest
// first, so a later row has to win.
const moved = dashboard.buildStoreStats(
  [row(40, "ios", 0, 3.0, 100), row(2, "ios", 0, 4.5, 120)],
  { days: 90, now }
);

assert.strictEqual(moved.rating, 4.5, "an old rating row is still being shown");

/* ------------------------------------------------------------- the age --- */

assert.strictEqual(dashboard.formatAge(new Date(now - 90000).toISOString(), now), "2 m");
assert.strictEqual(dashboard.formatAge(new Date(now - 2 * 3600000).toISOString(), now), "2 t");
assert.strictEqual(dashboard.formatAge(new Date(now - 3 * DAY_MS).toISOString(), now), "3 d");
assert.strictEqual(dashboard.formatAge(null, now), "", "a row with no date says nothing");

assert.strictEqual(
  dashboard.formatMeta({ os: null, device: null, appVersion: "2.4.1" }),
  "v2.4.1",
  "the meta line collapses to what is actually known"
);
assert.strictEqual(
  dashboard.formatMeta({ os: "iOS 18.1", device: "iPhone 14", appVersion: "v2.4.1" }),
  "iOS 18.1 · iPhone 14 · v2.4.1",
  "the meta line doubles the v on a version that already has one"
);
assert.strictEqual(dashboard.formatMeta({}), "");

/* ----------------------------------------------------------- the access -- */

// `profile_private` carries an update policy and an insert policy scoped to
// the row's owner and saying nothing about columns. Without both of these,
// every signed-in account can make itself an admin with one PATCH - and
// nobody would find out, because the screen is opened by one person.
assert.ok(
  /revoke insert \(is_admin\) on table public\.profile_private from authenticated/.test(
    migration
  ) &&
    /revoke update \(is_admin\) on table public\.profile_private from authenticated/.test(
      migration
    ),
  "is_admin is writable by the account it belongs to"
);

assert.ok(
  /create or replace function private\.reject_self_appointed_admin[\s\S]*?raise exception/.test(
    migration
  ),
  "nothing refuses an is_admin written from the app"
);

assert.ok(
  /before insert or update of is_admin on public\.profile_private/.test(migration),
  "the guard is not attached to the column it guards"
);

// A policy expression is evaluated as the querying user, so a function called
// from one has to be executable by that user. Getting this wrong took out
// every avatar in the app once already - see 20260921200000.
assert.ok(
  /grant execute on function private\.is_admin\(\) to authenticated/.test(migration),
  "the policies call a function authenticated may not execute"
);

// Reading feedback and the store numbers has to be refused on the server. The
// row in the profile only decides whether a button is drawn.
for (const [label, pattern] of [
  [
    "feedback is readable by anybody signed in",
    /create policy "Only an admin reads feedback"[\s\S]*?using \(private\.is_admin\(\)\)/,
  ],
  [
    "the store numbers are readable by anybody signed in",
    /create policy "Only an admin reads the store numbers"[\s\S]*?using \(private\.is_admin\(\)\)/,
  ],
]) {
  assert.ok(pattern.test(migration), label);
}

assert.ok(
  /alter table public\."Feedback" enable row level security/.test(migration),
  "RLS is off on the feedback table, so the policies above decide nothing"
);

// The one thing a non-admin must keep being able to do is send a message.
assert.ok(
  /create policy "Anyone signed in can send feedback"[\s\S]*?for insert/.test(migration),
  "turning RLS on took away the feedback form"
);

// The kinds the client writes and the kinds the column accepts are two lists
// in two languages. A fifth on one side only fails the insert in production.
const feedbackService = fs.readFileSync(
  path.join(root, "src", "Services", "feedbackService.js"),
  "utf8"
);
const clientKinds = feedbackService
  .match(/export const FEEDBACK_KINDS = \[([^\]]*)\]/)[1]
  .split(",")
  .map((kind) => kind.trim().replace(/^"|"$/g, ""))
  .filter(Boolean)
  .sort();
const columnKinds = migration
  .match(/check \(kind in \(([^)]*)\)\)/)[1]
  .split(",")
  .map((kind) => kind.trim().replace(/^'|'$/g, ""))
  .filter(Boolean)
  .sort();

assert.deepStrictEqual(
  clientKinds,
  columnKinds,
  "the feedback kinds the app sends and the ones the column accepts have drifted"
);

// The decision taken when this was built: no device fingerprint on a feedback
// row while the published privacy policy does not list one. If that changes it
// is a policy change and a new consent round, not a quiet edit here.
assert.ok(
  !/expo-device|expo-application/.test(feedbackService),
  "the feedback form reads the device again - the privacy policy has to say so first"
);

const policy = fs.readFileSync(
  path.join(root, "src", "Resources", "Legal", "privacyPolicy.js"),
  "utf8"
);

assert.ok(
  /no crash reporting/.test(policy),
  "the privacy policy stopped promising there is no crash reporting"
);

const adminService = fs.readFileSync(
  path.join(root, "src", "Services", "adminService.js"),
  "utf8"
);

/* ------------------------------------------------ paging the feedback ---- */

// `created_at` was added to a table that already had rows, and Postgres
// evaluates the default once for the whole `alter table` - so every message
// sent before that migration carries the same instant. A cursor on the
// timestamp alone returns nothing for page two, because the rest are equal to
// it rather than less than it, and the history stops being reachable at row 20.
assert.ok(
  /and\(created_at\.eq\.\$\{cursor\.createdAt\},id\.lt\.\$\{cursor\.id\}\)/.test(
    adminService
  ),
  "the feedback cursor is the timestamp alone again, so a page of equal timestamps ends the list"
);

// The count used to ride along on the page's own filtered request, so paging
// turned "47 in all" into "0 in all" while the rest became unreachable.
assert.ok(
  /async function countFeedback/.test(adminService) &&
    !/\.select\("id, user_id[^)]*\{\s*count: "exact"/.test(adminService),
  "the feedback total is counted over the page's own filter again"
);

/* ------------------------------------------------ Dev · Overblik: KPIs --- */

// Every limit on the overview lives in getKpiStatus, once. Each is held to
// both sides of its edge here: a limit that moved by one would still look
// right on the screen, because nobody knows what the right colour is.

const { getKpiStatus, worstStatus } = dashboard;
const statusOf = (key, value, context) => getKpiStatus(key, value, context).status;
const labelOf = (key, value, context) => getKpiStatus(key, value, context).label;

for (const [key, value, context, status] of [
  // KPI-5a crash: good under 0.5 %, watch 0.5-1.09 %, alarm above 1.09 %.
  ["crash", 0, {}, "good"],
  ["crash", 0.49, {}, "good"],
  ["crash", 0.5, {}, "watch"],
  ["crash", 1.09, {}, "watch"],
  ["crash", 1.1, {}, "alarm"],
  ["crash", null, {}, "unmeasured"],
  // ANR: good under 0.2 %, watch 0.2-0.47 %, alarm above 0.47 %.
  ["anr", 0.19, {}, "good"],
  ["anr", 0.2, {}, "watch"],
  ["anr", 0.47, {}, "watch"],
  ["anr", 0.48, {}, "alarm"],
  ["anr", undefined, {}, "unmeasured"],
  // The page's names for the same two.
  ["crashRate", 1.1, {}, "alarm"],
  ["anrRate", 0.2, {}, "watch"],
]) {
  assert.strictEqual(statusOf(key, value, context), status, `${key} at ${value} should be ${status}`);
}

assert.strictEqual(labelOf("crash", null), "Ikke koblet på", "no crash data says where it would come from");

// KPI-5b: two people on one version in a week, or a bug left new over a week.
const bugsWith = (byVersion, oldestNewDays = 0) => ({ total: 3, users: 3, byVersion, oldestNewDays });

assert.strictEqual(statusOf("bugs", bugsWith([{ version: "2.13.0", count: 3, users: 1 }])), "good");
assert.strictEqual(
  statusOf("bugs", bugsWith([{ version: "2.13.0", count: 1, users: 1 }, { version: "2.12.0", count: 1, users: 1 }])),
  "good",
  "two people on two versions is not the same version"
);
assert.deepStrictEqual(
  getKpiStatus("bugs", bugsWith([{ version: "2.13.0", count: 2, users: 2 }])),
  { status: "alarm", label: "Samme version" }
);
assert.strictEqual(
  statusOf("bugs", bugsWith([{ version: null, count: 4, users: 2 }])),
  "good",
  "reports with no version are not the same version"
);
assert.strictEqual(statusOf("bugs", bugsWith([], 7)), "good", "seven days new is not over seven");
assert.deepStrictEqual(getKpiStatus("bugs", bugsWith([], 7.1)), { status: "alarm", label: "Ubehandlet > 7 d" });
assert.strictEqual(statusOf("bugReports", bugsWith([], 8)), "alarm", "the page's name for the same rule");
assert.strictEqual(statusOf("bugs", null), "unmeasured");

// KPI-1: a baseline for four weeks after a release, then an alarm after two
// falling weeks or a fall of more than 25 % in one - once n is 30.
const trainers = (value, previous, series) => ({
  value,
  previous,
  series: (series ?? [previous, value]).map((point) => ({ weekStart: "2026-09-01", value: point })),
});

assert.deepStrictEqual(
  getKpiStatus("trainers7d", trainers(10, 100), { weeksSinceRelease: 0 }),
  { status: "baseline", label: "Baseline 1/4 uger" },
  "the week of a release is baseline, however far it fell"
);
assert.strictEqual(labelOf("trainers7d", trainers(40, 40), { weeksSinceRelease: 3.9 }), "Baseline 4/4 uger");
assert.strictEqual(statusOf("trainers7d", trainers(40, 40), { weeksSinceRelease: 4 }), "good", "four weeks on it is judged");
assert.strictEqual(
  statusOf("trainers7d", trainers(10, 29), { weeksSinceRelease: 10 }),
  "baseline",
  "a fall from 29 is too few people to call"
);
assert.strictEqual(labelOf("trainers7d", trainers(10, 29), {}), "Få brugere");
assert.strictEqual(statusOf("trainers7d", trainers(30, 40), {}), "good", "exactly 25 % down is not more than 25 %");
assert.deepStrictEqual(getKpiStatus("trainers7d", trainers(29, 40), {}), { status: "alarm", label: "Fald over 25 %" });
assert.deepStrictEqual(
  getKpiStatus("trainers7d", trainers(38, 40, [44, 40, 38]), {}),
  { status: "alarm", label: "Fald 2 uger i træk" }
);
assert.strictEqual(statusOf("trainers7d", trainers(38, 40, [40, 40, 38]), {}), "good", "one falling week is not two");
assert.strictEqual(statusOf("trainers7d", trainers(40, 40, [44, 40, 40]), {}), "good", "a flat week after a fall is not a second fall");
assert.strictEqual(statusOf("trainers7d", trainers(45, 40, [44, 40, 45]), {}), "good");
assert.strictEqual(statusOf("trainers7d", null, {}), "unmeasured");

// The page names the release as a moment instead of in weeks.
const kpiNow = new Date("2026-09-26T12:00:00Z").getTime();

assert.strictEqual(
  labelOf("trainers7d", trainers(40, 40), { lastReleaseAt: new Date(kpiNow - 9 * DAY_MS).toISOString(), now: kpiNow }),
  "Baseline 2/4 uger",
  "nine days after a release is its second week"
);
assert.strictEqual(
  statusOf("trainers7d", trainers(40, 40), { lastReleaseAt: new Date(kpiNow - 28 * DAY_MS).toISOString(), now: kpiNow }),
  "good"
);
assert.strictEqual(
  statusOf("trainers7d", trainers(10, 40), { lastReleaseAt: null, now: kpiNow }),
  "alarm",
  "with no store tag yet there is no baseline period to hide in"
);

// KPI-2: good from 70, watch from 50, alarm under - with 30 in last week.
const comesBack = (percent, lastWeek = 40) => ({ both: 0, lastWeek, percent, series: [] });

assert.strictEqual(statusOf("comesBack", comesBack(70)), "good");
assert.strictEqual(statusOf("comesBack", comesBack(69.9)), "watch");
assert.strictEqual(statusOf("comesBack", comesBack(50)), "watch");
assert.strictEqual(statusOf("comesBack", comesBack(49.9)), "alarm");
assert.strictEqual(statusOf("comesBack", comesBack(10, 29)), "baseline", "29 people last week is too few");
assert.strictEqual(statusOf("comesBack", comesBack(10, 30)), "alarm", "30 is enough");
assert.strictEqual(statusOf("comesBack", comesBack(null, 0)), "baseline", "nobody last week is too few, not an error");

// The page draws its two dashed lines from the same pair the rule judges by.
assert.deepStrictEqual({ ...dashboard.COMES_BACK_LINES }, { good: 70, alarm: 50 });

const devDashboardView = fs.readFileSync(
  path.join(root, "src", "Pages", "DevDashboardPage", "devDashboardView.js"),
  "utf8"
);

assert.ok(
  /COMES_BACK_LINES\.good/.test(devDashboardView) && /COMES_BACK_LINES\.alarm/.test(devDashboardView),
  "the Kommer igen lines have their own copy of the limits again"
);

// KPI-3: a baseline for four weeks, then an alarm at a fall of ten points
// against it.
const plan = (median, users = 40, series = []) => ({
  median,
  users,
  series: series.map((point) => ({ weekStart: "2026-09-01", median: point, users })),
});

assert.strictEqual(labelOf("planCompleted", plan(20), { weeksSinceRelease: 1 }), "Baseline 2/4 uger");
assert.strictEqual(statusOf("planCompleted", plan(20, 29), { baseline: 80 }), "baseline", "29 people is too few");
assert.deepStrictEqual(
  getKpiStatus("planCompleted", plan(70), { baseline: 80 }),
  { status: "alarm", label: "Fald ≥ 10 point" },
  "exactly ten points down is an alarm"
);
assert.strictEqual(statusOf("planCompleted", plan(70.1), { baseline: 80 }), "good");
// Six weeks after a release the baseline is the four points one to four weeks
// after it: here 80 each, against 69 now.
assert.strictEqual(
  statusOf("planCompleted", plan(69, 40, [50, 50, 80, 80, 80, 80, 75, 69]), { weeksSinceRelease: 6 }),
  "alarm"
);
assert.strictEqual(
  statusOf("planCompleted", plan(71, 40, [50, 50, 80, 80, 80, 80, 75, 71]), { weeksSinceRelease: 6 }),
  "good"
);
// With no store tag the oldest four weeks of the series stand in.
assert.strictEqual(statusOf("planCompleted", plan(69, 40, [79, 79, 79, 79, 75, 69]), {}), "alarm");
assert.strictEqual(statusOf("planCompleted", plan(null, 40), { baseline: 80 }), "unmeasured");

// KPI-6: good at seven days or less, watch at 8-14, alarm above 14 or with an
// unreleased major.
const lag = (days, unreleasedMajor = null) => ({ days, commits: 3, latestTag: "android/2.12.0", unreleasedMajor });

assert.strictEqual(statusOf("releaseLag", lag(0)), "good");
assert.strictEqual(statusOf("releaseLag", lag(7)), "good");
assert.strictEqual(statusOf("releaseLag", lag(8)), "watch");
assert.strictEqual(statusOf("releaseLag", lag(14)), "watch");
assert.deepStrictEqual(getKpiStatus("releaseLag", lag(15)), { status: "alarm", label: "Lav en release" });
assert.deepStrictEqual(
  getKpiStatus("releaseLag", lag(2, "3.0.0")),
  { status: "alarm", label: "Lav en release" },
  "an unreleased major is an alarm whatever the days"
);
assert.deepStrictEqual(
  getKpiStatus("releaseLag", { days: null, commits: 40, latestTag: null, unreleasedMajor: null }),
  { status: "unmeasured", label: "Intet tag endnu" },
  "without a store tag there is nothing to count from, and the tile says so"
);
assert.strictEqual(statusOf("releaseLag", null), "unmeasured");

// KPI-4: "uge n af 4" before four weeks in a store, Fastfrys under 10 %, and
// Kandidat til fjernelse under 5 % once it has had eight weeks.
const feature = (share, weeksInStore, inLatestStoreTag = true) => ({
  key: "music",
  users: 1,
  share,
  commits: 4,
  firstInStoreAt: "2026-08-01T00:00:00Z",
  inLatestStoreTag,
  weeksInStore,
});
const active = { activeUsers: 40 };

assert.deepStrictEqual(getKpiStatus("feature", feature(1, 0), active), { status: "baseline", label: "uge 1 af 4" });
assert.deepStrictEqual(getKpiStatus("feature", feature(1, 3), active), { status: "baseline", label: "uge 4 af 4" });
assert.deepStrictEqual(getKpiStatus("feature", feature(9.9, 4), active), { status: "watch", label: "Fastfrys" });
assert.strictEqual(statusOf("feature", feature(10, 4), active), "good", "10 % is not under 10 %");
assert.strictEqual(statusOf("feature", feature(4.9, 7), active), "watch", "under 5 % at seven weeks is only Fastfrys");
assert.deepStrictEqual(
  getKpiStatus("feature", feature(4.9, 8), active),
  { status: "alarm", label: "Kandidat til fjernelse" }
);
assert.strictEqual(statusOf("feature", feature(5, 8), active), "watch", "5 % is not under 5 %");
assert.strictEqual(statusOf("feature", feature(1, 8), { activeUsers: 29 }), "baseline", "29 active users is too few");
assert.deepStrictEqual(
  getKpiStatus("feature", feature(1, 8, false), active),
  { status: "unmeasured", label: "Ikke udgivet" },
  "a feature no store build has is not judged"
);
assert.strictEqual(labelOf("feature", feature(1, null), active), "Intet butikstag");
assert.strictEqual(statusOf("featureUsage", feature(4.9, 8), active), "alarm", "the page's name for the same rule");

// S2 and S6 are baselines; S3 is not measured by anything yet.
assert.strictEqual(statusOf("s2", { stale: 3, started: 10 }), "baseline");
assert.strictEqual(statusOf("s6", { newAccounts: 4, trainedWithin7d: 1 }), "baseline");
assert.strictEqual(statusOf("s2", null), "unmeasured");
assert.strictEqual(statusOf("s3", null), "unmeasured");

// S9: the aim is 0, above it is worth a look, a rise on a week ago an alarm.
const quality = (empty, duplicates, weekAgoEmpty = empty, weekAgoDuplicates = duplicates) => ({
  strengthWithoutSets: empty,
  duplicateSyncIds: duplicates,
  weekAgo: { strengthWithoutSets: weekAgoEmpty, duplicateSyncIds: weekAgoDuplicates },
});

assert.strictEqual(statusOf("s9", quality(0, 0)), "good");
assert.strictEqual(statusOf("s9", quality(1, 0)), "watch");
assert.strictEqual(statusOf("s9", quality(2, 0, 3, 0)), "watch", "falling is not rising");
assert.deepStrictEqual(getKpiStatus("s9", quality(2, 0, 1, 0)), { status: "alarm", label: "Stigende" });
assert.strictEqual(statusOf("s9", quality(0, 1, 0, 0)), "alarm", "a new duplicate is a rise");

// S8: bug debt is an alarm once the oldest open bug is over 30 days old.
assert.strictEqual(statusOf("s8", { open: 3, oldestDays: 30, labels: ["bug"] }), "good");
assert.deepStrictEqual(getKpiStatus("s8", { open: 3, oldestDays: 31, labels: ["bug"] }), { status: "alarm", label: "Over 30 dage" });
assert.strictEqual(statusOf("s8", null), "unmeasured");

// S10: watch from 60 % of the plan, alarm from 80 %, on the fullest of four.
const usage = (egress) => ({ db: 12, storage: 40, egress, mau: 3, readAt: "2026-09-25T10:00:00Z" });

assert.strictEqual(statusOf("s10", usage(59.9)), "good");
assert.strictEqual(statusOf("s10", usage(60)), "watch");
assert.strictEqual(statusOf("s10", usage(79.9)), "watch");
assert.strictEqual(statusOf("s10", usage(80)), "alarm");
assert.deepStrictEqual(getKpiStatus("s10", null), { status: "unmeasured", label: "Ikke aflæst" });

// S4: an alarm with any message left new for more than seven days.
assert.strictEqual(statusOf("s4", { medianDays: 2.5, total: 9, overSevenDays: 0 }), "good");
assert.deepStrictEqual(getKpiStatus("s4", { medianDays: 2.5, total: 9, overSevenDays: 2 }), { status: "alarm", label: "2 over 7 d" });

// S7: a falling rating, at the one decimal the screen shows.
assert.strictEqual(statusOf("s7", { rating: 4.5, previousRating: 4.5 }), "good");
assert.strictEqual(statusOf("s7", { rating: 4.52, previousRating: 4.54 }), "good", "a fall nobody can see on the screen");
assert.deepStrictEqual(getKpiStatus("s7", { rating: 4.4, previousRating: 4.5 }), { status: "alarm", label: "Faldende" });
assert.strictEqual(statusOf("s7", { rating: 4.4, previousRating: null }), "baseline", "one reading has nothing to fall from");
assert.strictEqual(statusOf("s7", { rating: null, previousRating: null }), "unmeasured");

// S1: rework rising three weeks in a row.
const rework = (...weeks) => ({ percent: weeks[weeks.length - 1], topFolder: "src/Pages", weeks: weeks.map((percent) => ({ weekStart: "2026-09-01", percent })) });

assert.deepStrictEqual(getKpiStatus("s1", rework(10, 11, 12, 13)), { status: "alarm", label: "Stiger 3 uger" });
assert.strictEqual(statusOf("s1", rework(10, 11, 11, 13)), "good", "a flat week breaks the run");
assert.strictEqual(statusOf("s1", rework(12, 11, 12, 13)), "good", "two rises are not three");
assert.strictEqual(statusOf("s1", rework(10, 11, 12)), "baseline", "three weeks cannot rise three times");

// Whatever the key: a read that failed, a migration not run, a key not known.
assert.deepStrictEqual(getKpiStatus("comesBack", comesBack(80), { failed: true }), { status: "unmeasured", label: "Kunne ikke hentes" });
assert.deepStrictEqual(getKpiStatus("s9", { unavailable: true }), { status: "unmeasured", label: "Ikke koblet på" });
assert.strictEqual(statusOf("no-such-kpi", 1), "unmeasured");

for (const key of [
  "crash", "anr", "bugs", "trainers7d", "comesBack", "planCompleted", "startedFrom", "releaseLag",
  "feature", "s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10",
]) {
  const answer = getKpiStatus(key, null, {});

  assert.ok(dashboard.KPI_STATUSES.includes(answer.status), `${key} answered a status the page cannot draw`);
  assert.ok(typeof answer.label === "string" && answer.label.length > 0, `${key} answered no label`);
}

// The worst of a section: alarm, watch, not measured, baseline, good - grey
// above green, so nothing unmeasured hides behind a good row.
assert.strictEqual(worstStatus(["good", "watch", "baseline"]), "watch");
assert.strictEqual(worstStatus(["good", "alarm", "watch"]), "alarm");
assert.strictEqual(worstStatus(["good", "unmeasured"]), "unmeasured");
assert.strictEqual(worstStatus(["good", "baseline"]), "baseline");
assert.deepStrictEqual(
  worstStatus([{ status: "good", label: "Godt" }, { status: "watch", label: "Fastfrys" }]),
  { status: "watch", label: "Fastfrys" },
  "it hands back the entry it was given, label and all"
);
assert.strictEqual(worstStatus([]), null);

// The small-numbers rule: under 30, the count and no colour.
assert.deepStrictEqual(
  dashboard.describeRatio(11, 16),
  { small: true, count: "11/16", percent: 68.75, percentText: "68,8 %", coloured: false }
);
assert.strictEqual(dashboard.describeRatio(21, 30).coloured, true, "30 in the denominator is enough");
assert.strictEqual(dashboard.describeRatio(0, 0).percent, null, "nothing over nothing is no percentage");
assert.strictEqual(dashboard.isSmallNumber(29), true);
assert.strictEqual(dashboard.isSmallNumber(30), false);
assert.strictEqual(dashboard.isSmallNumber(null), true, "an unknown denominator is not a big one");

// Weeks since the newest store tag of either platform.
assert.strictEqual(
  dashboard.getWeeksSinceRelease(
    {
      android: { latestTagAt: new Date(kpiNow - 20 * DAY_MS).toISOString() },
      ios: { latestTagAt: new Date(kpiNow - 8 * DAY_MS).toISOString() },
    },
    kpiNow
  ),
  1,
  "the newer platform's tag counts"
);
assert.strictEqual(dashboard.getWeeksSinceRelease({ android: { latestTagAt: null }, ios: null }, kpiNow), null);

/* ---------------------------------------- Dev · Overblik: the shapes --- */

// The admin functions answer in snake_case; the page reads camelCase. The
// shapes are the contract between the two, so a renamed key fails here rather
// than as an empty tile.
const totals = dashboard.shapeUserTotals({
  downloads: { ios: 12, android: null, total: 12, last_week: { ios: 5, android: null, total: 5 } },
  active: { ios: 2, android: 1, total: 3, source: "app_open", window_days: 14 },
  computed_at: "2026-09-26T10:00:00Z",
});

assert.deepStrictEqual(totals, {
  downloads: { ios: 12, android: null, total: 12, lastWeek: { ios: 5, android: null, total: 5 } },
  active: { ios: 2, android: 1, total: 3, source: "app_open", windowDays: 14 },
  computedAt: "2026-09-26T10:00:00Z",
});

const training = dashboard.shapeTrainingKpis({
  trainers_7d: { value: 2, previous: 2, series: [{ week_start: "2026-09-19", value: 2 }] },
  comes_back: { both: 2, last_week: 4, percent: 50.0, series: [{ week_start: "2026-09-14", percent: null, n: 0 }] },
  plan_completed: { median: 50.0, users: 4, series: [{ week_start: "2026-09-19", median: 50.0, users: 4 }] },
  computed_at: "2026-09-26T10:00:00Z",
});

assert.deepStrictEqual(training.trainers7d, { value: 2, previous: 2, series: [{ weekStart: "2026-09-19", value: 2 }] });
assert.deepStrictEqual(training.comesBack, { both: 2, lastWeek: 4, percent: 50, series: [{ weekStart: "2026-09-14", percent: null, n: 0 }] });
assert.deepStrictEqual(training.planCompleted, { median: 50, users: 4, series: [{ weekStart: "2026-09-19", median: 50, users: 4 }] });

assert.deepStrictEqual(
  dashboard.shapeStartedFrom({
    days: 28,
    available: false,
    total: 5,
    counts: { program: 2, recent: null, calendar: null, empty: null, other: null },
  }),
  {
    days: 28,
    total: 5,
    counts: { program: 2, recent: null, calendar: null, empty: null, other: null },
    available: false,
    computedAt: null,
  },
  "before started_from is used, only the program count is a number"
);

const usageAnswer = dashboard.shapeFeatureUsage(
  {
    days: 28,
    active_users: 4,
    source: "app_open",
    features: [
      { key: "run", users: 1, share: 25.0, commits: 12, first_in_store_at: new Date(kpiNow - 30 * DAY_MS).toISOString(), in_latest_store_tag: true },
      { key: "posts", users: 1, share: 25.0, commits: null, first_in_store_at: null, in_latest_store_tag: null },
    ],
    measured_at: "2026-09-26T04:00:00Z",
  },
  kpiNow
);

assert.strictEqual(usageAnswer.activeUsers, 4);
assert.deepStrictEqual(usageAnswer.features[0], {
  key: "run",
  users: 1,
  share: 25,
  commits: 12,
  firstInStoreAt: new Date(kpiNow - 30 * DAY_MS).toISOString(),
  inLatestStoreTag: true,
  weeksInStore: 4,
});
assert.strictEqual(usageAnswer.features[1].weeksInStore, null, "no store tag, no weeks in a store");
assert.strictEqual(usageAnswer.features[1].inLatestStoreTag, null);
assert.strictEqual(usageAnswer.measuredAt, "2026-09-26T04:00:00Z");

assert.deepStrictEqual(
  dashboard.shapeBugReports({
    days: 7,
    total: 4,
    users: 2,
    by_version: [{ version: "2.13.0", count: 2, users: 2 }],
    oldest_new_days: 10.0,
  }),
  { days: 7, total: 4, users: 2, byVersion: [{ version: "2.13.0", count: 2, users: 2 }], oldestNewDays: 10, computedAt: null }
);

assert.deepStrictEqual(
  dashboard.shapeStoreHealth({ ios: null, android: { day: "2026-09-25", crash_rate: 0.4, anr_rate: null, measured_at: null } }),
  { ios: null, android: { crashRate: 0.4, anrRate: null, measuredAt: "2026-09-25" } },
  "a platform nothing has measured is null, not zero"
);

assert.deepStrictEqual(
  dashboard.shapeReleaseLag([
    { platform: "android", value: { days: 3, latestTag: "android/2.12.0" }, measured_at: "2026-09-26T04:00:00Z" },
    { platform: "all", value: { days: 1 }, measured_at: "2026-09-27T04:00:00Z" },
  ]),
  { android: { days: 3, latestTag: "android/2.12.0" }, ios: null, measuredAt: "2026-09-26T04:00:00Z" }
);

const secondary = dashboard.shapeSecondaryKpis({
  s1: { value: { percent: 12.5, topFolder: "src/Pages", weeks: [] }, measured_at: "2026-09-26T04:00:00Z" },
  s2: { stale: 1, started: 3 },
  s3: null,
  s4: { median_days: 5.5, total: 2, over_seven_days: 1 },
  s5: null,
  s6: { new_accounts: 2, trained_within_7d: 1 },
  s8: null,
  s9: { strength_without_sets: 2, duplicate_sync_ids: 3, week_ago: { strength_without_sets: 1, duplicate_sync_ids: 1 } },
  s10: { value: { db: 12, readAt: "2026-09-25T10:00:00Z" }, measured_at: "2026-09-25T10:00:00Z" },
});

assert.deepStrictEqual(secondary.s1, { percent: 12.5, topFolder: "src/Pages", weeks: [], measuredAt: "2026-09-26T04:00:00Z" });
assert.deepStrictEqual(secondary.s4, { medianDays: 5.5, total: 2, overSevenDays: 1 });
assert.deepStrictEqual(secondary.s6, { newAccounts: 2, trainedWithin7d: 1 });
assert.deepStrictEqual(secondary.s9, {
  strengthWithoutSets: 2,
  duplicateSyncIds: 3,
  weekAgo: { strengthWithoutSets: 1, duplicateSyncIds: 1 },
});
assert.strictEqual(secondary.s5, null, "no version reported yet is null, not an empty list");
assert.strictEqual(secondary.s8, null);
assert.strictEqual(secondary.s3, null);
assert.strictEqual(secondary.s10.db, 12);

assert.deepStrictEqual(
  dashboard.buildSupabaseUsageValue({ db: "62", storage: 101.26, egress: -4, mau: null, readAt: "2026-09-25T10:00:00Z" }, kpiNow),
  { db: 62, storage: 101.3, egress: null, mau: null, readAt: "2026-09-25T10:00:00.000Z" },
  "S10 keeps a project over its plan, and drops what is not a percentage"
);
assert.strictEqual(dashboard.buildSupabaseUsageValue({}, kpiNow).readAt, new Date(kpiNow).toISOString());

// A migration not run yet is "not connected", everything else an error.
for (const code of ["42883", "42P01", "42703", "PGRST202", "PGRST204", "PGRST205"]) {
  assert.strictEqual(dashboard.isMissingMigrationError({ code }), true, `${code} is a missing migration`);
}
assert.strictEqual(dashboard.isMissingMigrationError({ code: "42501" }), false, "a non-admin is an error, not a missing table");
assert.strictEqual(dashboard.isMissingMigrationError(null), false);

// S7's falling rating needs what the store said before the 90 days began.
const ratingMoved = dashboard.buildStoreStats(
  [row(120, "ios", 0, 4.6, 100), row(100, "ios", 0, 4.5, 100), row(2, "ios", 0, 4.3, 110)],
  { days: 90, now }
);

assert.strictEqual(ratingMoved.rating, 4.3);
assert.strictEqual(ratingMoved.previousRating, 4.5, "the newest rating before the period is the one to fall from");
assert.strictEqual(nothing.previousRating, null);

/* ----------------------------------------- Dev · Overblik: the migration --- */

const kpiMigration = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20261001090000_dev-kpis.sql"),
  "utf8"
);

// Every admin function is its own guard: security definer to count across
// everybody, and is_admin checked in the body so the grant hands out the
// count to one account only. None of them is callable by anon.
const adminFunctions = [
  "admin_user_totals",
  "admin_training_kpis",
  "admin_started_from",
  "admin_feature_usage",
  "admin_bug_reports",
  "admin_secondary_kpis",
];

for (const name of adminFunctions) {
  const body = kpiMigration.match(
    new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`)
  )?.[0];

  assert.ok(body, `${name} is not defined in the dev-kpis migration`);
  assert.ok(/returns jsonb/.test(body), `${name} must answer one object of counts, never rows`);
  assert.ok(/security definer/.test(body), `${name} is not security definer`);
  assert.ok(/set search_path = ''/.test(body), `${name} does not pin its search_path`);
  assert.ok(
    /if not private\.is_admin\(\) then\s+raise exception[\s\S]*?errcode = '42501'/.test(body),
    `${name} does not refuse a non-admin with an error`
  );
  assert.ok(
    new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public, anon, service_role;`).test(kpiMigration),
    `${name} is still executable by anon`
  );
  assert.ok(
    new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to authenticated;`).test(kpiMigration),
    `${name} is not granted to authenticated`
  );
}

assert.ok(
  !/returns (table|setof)/i.test(
    kpiMigration.replace(/create or replace function private\.duplicate_sync_ids[\s\S]*?\n\$\$;/, "")
  ),
  "an admin function returns rows - the admin gets counts, never rows"
);

// dev_metrics: admin-only, and nothing at all for anon.
assert.ok(/alter table public\.dev_metrics enable row level security/.test(kpiMigration), "RLS is off on dev_metrics");
assert.ok(/revoke all on table public\.dev_metrics from anon, authenticated;/.test(kpiMigration), "anon keeps a grant on dev_metrics");
for (const command of ["select", "insert", "update"]) {
  assert.ok(
    new RegExp(`on public\\.dev_metrics\\s+for ${command}\\s+to authenticated\\s+(using|with check) \\(private\\.is_admin\\(\\)\\)`).test(kpiMigration),
    `dev_metrics ${command} is not admin-only`
  );
}

// That the admin guard runs as its caller is scripts/test-admin-guard.js.

// The five values the app sends are the five the column accepts.
const startedFromUtil = loadAppModule("src/Utils/startedFrom.js");
const startedFromColumn = kpiMigration
  .match(/started_from in \(([^)]*)\)/)[1]
  .split(",")
  .map((value) => value.trim().replace(/^'|'$/g, ""))
  .sort();

assert.deepStrictEqual(
  [...startedFromUtil.STARTED_FROM_VALUES].sort(),
  startedFromColumn,
  "the started_from values the app sends and the ones the column accepts have drifted"
);

// The service answers "not connected" on exactly the codes the util knows.
assert.ok(
  /isMissingMigrationError\(error\)/.test(adminService) && /export async function setSupabaseUsage/.test(adminService),
  "the overview's reads no longer tell a missing migration from an error"
);

console.log(
  "Dev dashboard: the buckets, the empty state, the weighted rating, the ages, the paging, the access guards, every KPI limit, the shapes and the dev-kpis migration passed."
);
