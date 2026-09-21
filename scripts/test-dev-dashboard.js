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
assert.strictEqual(
  firstEver.platforms.android.downloads,
  0,
  "a platform with rows elsewhere in the table is zero, not unknown"
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

assert.ok(
  /crashFreePercent: null/.test(adminService),
  "the dashboard has a crash-free number, and the privacy policy says there is no crash reporting"
);

console.log(
  "Dev dashboard: the buckets, the empty state, the weighted rating, the ages and the access guards passed."
);
