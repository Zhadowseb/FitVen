// The GitHub Action behind the dev overview's git numbers: KPI-6's release
// lag, S1's rework, S8's bug debt and KPI-4's commits per feature.
//
// Everything runs against made-up git and gh output. Nothing here starts git
// or gh or opens a connection: index.js takes its command runner and its fetch
// as arguments, and the fakes below answer for them. What is tested is the
// arithmetic, and the contract the page depends on - the rows, their keys and
// shapes, and the request Supabase gets - not what this repository's history
// happens to say today. The key used below is made up and not a secret.

const assert = require("assert");

const bugDebt = require("./dev-metrics/bugDebt");
const dates = require("./dev-metrics/dates");
const features = require("./dev-metrics/featureCommits");
const { unquotePath } = require("./dev-metrics/gitOutput");
const lag = require("./dev-metrics/releaseLag");
const rework = require("./dev-metrics/rework");
const storeTags = require("./dev-metrics/storeTags");
const versions = require("./dev-metrics/versions");
const { METRICS, main } = require("./dev-metrics/index");

const DAY = 86400;
const seconds = (iso) => Math.floor(Date.parse(iso) / 1000);
// A readable, valid 40-character hash per label.
const sha = (label) => Buffer.from(label).toString("hex").padEnd(40, "0").slice(0, 40);

// A Saturday, in summer time.
const NOW = Date.parse("2026-09-26T12:00:00Z");

/* ------------------------------------------------------------ calendar --- */

assert.deepStrictEqual(
  dates.lastCompleteWeeks(NOW, 4),
  ["2026-08-24", "2026-08-31", "2026-09-07", "2026-09-14"],
  "four complete weeks, oldest first, and not the one running"
);
assert.deepStrictEqual(
  dates.lastCompleteWeeks(Date.parse("2026-09-21T00:30:00+02:00"), 1),
  ["2026-09-14"],
  "half past midnight on a Monday, the week that just ended is the newest"
);
assert.strictEqual(dates.mondayOf(dates.localDate(Date.parse("2026-09-20T23:30:00+02:00"))), "2026-09-14");
assert.strictEqual(
  dates.mondayOf(dates.localDate(Date.parse("2026-09-20T22:30:00Z"))),
  "2026-09-21",
  "22:30 UTC on a Sunday is already Monday in Copenhagen"
);
// Summer time ends on 25 October 2026 and starts on 29 March.
assert.strictEqual(new Date(dates.localMidnight("2026-10-25")).toISOString(), "2026-10-24T22:00:00.000Z");
assert.strictEqual(new Date(dates.localMidnight("2026-10-26")).toISOString(), "2026-10-25T23:00:00.000Z");
assert.strictEqual(new Date(dates.localMidnight("2026-03-29")).toISOString(), "2026-03-28T23:00:00.000Z");
assert.strictEqual(new Date(dates.localMidnight("2026-03-30")).toISOString(), "2026-03-29T22:00:00.000Z");

/* ------------------------------------------------------------ versions --- */

const v = versions.parseVersion;

assert.ok(versions.compareVersions(v("1.2.3-feature-x.1"), v("1.2.3")) < 0, "a branch prerelease is below its target");
assert.ok(versions.compareVersions(v("1.2.3"), v("1.2.4")) < 0);
assert.ok(versions.compareVersions(v("1.1.10"), v("1.1.2")) > 0, "numbers, not strings");
assert.ok(versions.compareVersions(v("2.0.0-rc.10"), v("2.0.0-rc.9")) > 0);
assert.strictEqual(versions.coreOf("2.13.0-feature-dev-kpis.1"), "2.13.0");
assert.strictEqual(versions.coreOf("v1.0.2"), "1.0.2");
assert.strictEqual(v("latest"), null);
assert.strictEqual(versions.packageVersion('{\n  "name": "programapp",\n  "version": "1.0.2"\n}'), "1.0.2");
assert.strictEqual(versions.packageVersion('﻿{"version":"1.0.2"}'), "1.0.2", "a byte order mark is not a reason to fail");
assert.strictEqual(versions.packageVersion("not json"), null);

/* ------------------------------------------------- tag selection per store --- */

// git for-each-ref --format=storeTags.FOR_EACH_REF_FORMAT refs/tags/android refs/tags/ios
const TAG_FIXTURE = [
  // Annotated: the starred fields are the tagged commit's.
  ["android/1.0.2", sha("tag-a102"), sha("A102"), "", seconds("2026-09-13T01:29:46+02:00")],
  // Recovered after the fact: a lower version, whose tag would be the newest by date.
  ["android/1.0.0", sha("tag-a100"), sha("A100"), "", seconds("2026-07-01T10:00:00+02:00")],
  ["ios/1.1.2", sha("tag-i112"), sha("I112"), "", seconds("2026-09-17T00:17:12+02:00")],
  // Lightweight: the ref is the commit, and so is its date. 1.1.10 is above
  // 1.1.2 although it sorts below it as text, and its commit is older.
  ["ios/1.1.10", sha("I1110"), "", seconds("2026-09-10T12:00:00+02:00"), ""],
  // Not a version: left out, and said so.
  ["ios/latest", sha("I999"), "", seconds("2026-09-20T12:00:00+02:00"), ""],
]
  .map((fields) => fields.join("\t"))
  .join("\n");

const parsedTags = storeTags.parseStoreTags(TAG_FIXTURE);
const latest = storeTags.latestByPlatform(parsedTags.tags);

assert.deepStrictEqual(parsedTags.ignored, ["ios/latest"]);
assert.strictEqual(latest.android.name, "android/1.0.2", "the highest version, not the latest tagged");
assert.strictEqual(latest.ios.name, "ios/1.1.10");
assert.strictEqual(latest.android.sha, sha("A102"), "an annotated tag resolves to its commit");
assert.strictEqual(latest.ios.sha, sha("I1110"), "a lightweight tag is its commit");
assert.strictEqual(latest.android.at, "2026-09-12T23:29:46.000Z", "a tag's date is its commit's");
assert.strictEqual(latest.ios.at, "2026-09-10T10:00:00.000Z");
assert.deepStrictEqual(storeTags.latestByPlatform([]), { android: null, ios: null });
assert.deepStrictEqual(
  storeTags.latestByPlatform(parsedTags.tags.filter((tag) => tag.platform === "ios")).android,
  null,
  "one store's tags say nothing about the other"
);

/* ------------------------------------------------------------ the lag ---- */

// git log --first-parent --diff-merges=first-parent -p -U0 <tag>..master -- package.json
const PACKAGE_PATCH = [
  "diff --git a/package.json b/package.json",
  "--- a/package.json",
  "+++ b/package.json",
  "@@ -3 +3 @@",
  '-  "version": "2.12.2-feature-store-stats-ios.1",',
  '+  "version": "2.13.0-feature-dev-kpis.1",',
  "@@ -13 +13 @@",
  '-    "test": "node a.js",',
  '+    "test": "node a.js && node b.js",',
  "diff --git a/package.json b/package.json",
  "@@ -3 +3 @@",
  '+  "version": "2.12.2-feature-store-stats-ios.1",',
  "diff --git a/package.json b/package.json",
  "@@ -3 +3 @@",
  '+  "version": "2.12.2-fix-other.1",',
  "diff --git a/package.json b/package.json",
  "@@ -3 +3 @@",
  '+  "version": "2.0.0-major-centres.1",',
  "diff --git a/package.json b/package.json",
  "@@ -3 +3 @@",
  '-  "version": "1.0.2",',
  '+  "version": "1.1.0",',
].join("\n");

assert.deepStrictEqual(lag.versionsFromPackagePatch(PACKAGE_PATCH), [
  "2.13.0-feature-dev-kpis.1",
  "2.12.2-feature-store-stats-ios.1",
  "2.12.2-fix-other.1",
  "2.0.0-major-centres.1",
  "1.1.0",
]);

const android = latest.android;
const landed = lag.parseCommitTimes(
  [seconds("2026-09-25T10:00:00Z"), seconds("2026-09-20T10:00:00Z"), seconds("2026-09-16T20:50:31Z")].join("\n")
);

assert.deepStrictEqual(
  lag.releaseLag({
    tag: android,
    now: NOW,
    commits: 148,
    landedTimes: landed,
    tagVersion: "1.0.2",
    headVersion: "2.13.0-feature-dev-kpis.1",
    versionsSeen: lag.versionsFromPackagePatch(PACKAGE_PATCH),
  }),
  {
    days: 9,
    commits: 148,
    latestTag: "android/1.0.2",
    latestTagAt: "2026-09-12T23:29:46.000Z",
    oldestUnreleasedAt: "2026-09-16T20:50:31.000Z",
    oldestVersion: "1.0.2",
    newestVersion: "2.13.0",
    // 1.1.0, 2.0.0, 2.12.2 (two branches, one version) and 2.13.0.
    versionCount: 4,
    unreleasedMajor: "2.0.0",
  }
);

const lagOf = (landedIso, extra = {}) =>
  lag.releaseLag({
    tag: android,
    now: NOW,
    commits: 3,
    landedTimes: [Date.parse(landedIso)],
    tagVersion: "1.0.2",
    headVersion: "1.0.3",
    versionsSeen: ["1.0.3"],
    ...extra,
  });

assert.strictEqual(lagOf("2026-09-19T12:00:00Z").days, 7, "exactly seven days is seven");
assert.strictEqual(lagOf("2026-09-19T12:00:01Z").days, 6, "whole days, rounded down");
assert.strictEqual(lagOf("2026-09-27T12:00:00Z").days, 0, "a clock ahead of the runner is not negative");
assert.strictEqual(lagOf("2026-09-19T12:00:00Z", { tagVersion: null }).oldestVersion, "1.0.2", "no package.json at the tag: the tag's own name");
assert.strictEqual(
  lagOf("2026-09-19T12:00:00Z", { tagVersion: "1.1.2-fix-social-post-reliability.1" }).oldestVersion,
  "1.1.2",
  "a tag on a branch build reports the version it was built as"
);

const upToDate = lag.releaseLag({
  tag: android,
  now: NOW,
  commits: 0,
  landedTimes: [Date.parse("2026-09-20T10:00:00Z")],
  tagVersion: "1.0.2",
  headVersion: "1.0.2",
  versionsSeen: [],
});

assert.deepStrictEqual(
  [upToDate.days, upToDate.commits, upToDate.oldestUnreleasedAt, upToDate.versionCount, upToDate.unreleasedMajor],
  [0, 0, null, 0, null],
  "nothing but a merge commit after the tag is nothing waiting"
);

assert.deepStrictEqual(lag.releaseLag({ tag: null, headVersion: "2.13.0-feature-dev-kpis.1" }), {
  days: null,
  commits: null,
  latestTag: null,
  latestTagAt: null,
  oldestUnreleasedAt: null,
  oldestVersion: null,
  newestVersion: "2.13.0",
  versionCount: null,
  unreleasedMajor: null,
});
assert.match(lag.missingTagNote("ios"), /no ios\/\* tag, so days is null/);
assert.match(lag.missingTagNote("ios"), /git tag -a ios\/<version> <commit>/);

/* ------------------------------------------------------ the major bump --- */

assert.strictEqual(lag.unreleasedMajorBetween("1.0.2", "2.12.2"), "2.0.0");
assert.strictEqual(lag.unreleasedMajorBetween("1.0.0", "3.1.0"), "3.0.0", "the major master is on");
assert.strictEqual(lag.unreleasedMajorBetween("1.1.2", "1.9.0"), null);
assert.strictEqual(lag.unreleasedMajorBetween("2.12.2", "2.13.0"), null);
assert.strictEqual(lag.unreleasedMajorBetween("2.0.0", "1.9.0"), null, "a store ahead of master is not a bump");
assert.strictEqual(
  lagOf("2026-09-19T12:00:00Z", { headVersion: "2.0.0-major-centres.1" }).unreleasedMajor,
  "2.0.0",
  "a branch prerelease of 2.0.0 on master is an unreleased 2.0.0"
);

/* -------------------------------------------------------------- rework --- */

// Paths the way git writes them.
assert.strictEqual(unquotePath("src/plain.js"), "src/plain.js");
assert.strictEqual(unquotePath('"src/say \\"hi\\".js"'), 'src/say "hi".js');
assert.strictEqual(unquotePath('"src/\\303\\270l.js"'), "src/øl.js", "octal bytes, as without core.quotePath=false");
assert.strictEqual(unquotePath('"a\\tb"'), "a\tb");

const WEEKS = dates.lastCompleteWeeks(NOW, 4);
const IN_WINDOW = seconds("2026-09-16T10:00:00+02:00");

// git log <rework.LOG_ARGS>: one commit with one of everything, then three
// that fall outside the window.
const PATCH_LOG = [
  `\x1e${sha("C1")}\t${sha("P1")}\t${IN_WINDOW}`,
  "",
  "diff --git a/src/Pages/HomePage/HomePage.js b/src/Pages/HomePage/HomePage.js",
  "index 1111111..2222222 100644",
  "--- a/src/Pages/HomePage/HomePage.js",
  "+++ b/src/Pages/HomePage/HomePage.js",
  "@@ -10,2 +10,3 @@ function Home() {",
  "-old line a",
  "-old line b",
  "+new a",
  "+new b",
  "+new c",
  "@@ -40,0 +42,2 @@",
  "+added only",
  "+added only",
  "@@ -50 +52 @@",
  // A removed "-- comment" line. It must not be read as a file header.
  "--- a/not/a/file.js",
  "+-- its replacement",
  "diff --git a/src/Old.js b/src/Old.js",
  "deleted file mode 100644",
  "index 3333333..0000000",
  "--- a/src/Old.js",
  "+++ /dev/null",
  "@@ -1,3 +0,0 @@",
  "-x",
  "-y",
  "-z",
  "diff --git a/src/New.js b/src/New.js",
  "new file mode 100644",
  "index 0000000..4444444",
  "--- /dev/null",
  "+++ b/src/New.js",
  "@@ -0,0 +1,2 @@",
  "+a",
  "+b",
  "diff --git a/assets/icon.png b/assets/icon.png",
  "index 5555555..6666666 100644",
  "Binary files a/assets/icon.png and b/assets/icon.png differ",
  "diff --git a/src/Services/oldName.js b/src/Services/newName.js",
  "similarity index 90%",
  "rename from src/Services/oldName.js",
  "rename to src/Services/newName.js",
  "index 7777777..8888888 100644",
  "--- a/src/Services/oldName.js",
  "+++ b/src/Services/newName.js",
  "@@ -4,2 +4,2 @@",
  "-r1",
  "-r2",
  "+s1",
  "+s2",
  "diff --git a/package-lock.json b/package-lock.json",
  "--- a/package-lock.json",
  "+++ b/package-lock.json",
  "@@ -100,4 +100,4 @@",
  "-l1",
  "-l2",
  "-l3",
  "-l4",
  "diff --git a/CHANGELOG.md b/CHANGELOG.md",
  "--- a/CHANGELOG.md",
  "+++ b/CHANGELOG.md",
  "@@ -3 +3 @@",
  "-## [2.12.2] - Unreleased",
  "+## [2.12.2] - 2026-09-26",
  "diff --git a/docs/my notes.md b/docs/my notes.md",
  "--- a/docs/my notes.md\t",
  "+++ b/docs/my notes.md\t",
  "@@ -1 +1 @@",
  "-old",
  "+new",
  'diff --git "a/src/say \\"hi\\".js" "b/src/say \\"hi\\".js"',
  '--- "a/src/say \\"hi\\".js"',
  '+++ "b/src/say \\"hi\\".js"',
  "@@ -2 +2 @@",
  "-was",
  "+is",
  // Authored in the running week: next Monday's.
  `\x1e${sha("C2")}\t${sha("P2")}\t${seconds("2026-09-22T10:00:00+02:00")}`,
  "",
  "diff --git a/src/A.js b/src/A.js",
  "--- a/src/A.js",
  "+++ b/src/A.js",
  "@@ -1 +1 @@",
  "-a",
  "+b",
  // The root commit: no parent to blame.
  `\x1e${sha("C3")}\t\t${IN_WINDOW}`,
  "",
  "diff --git a/src/A.js b/src/A.js",
  "--- a/src/A.js",
  "+++ b/src/A.js",
  "@@ -1 +1 @@",
  // Authored before the window, merged into it: counted by when it was written.
  `\x1e${sha("C4")}\t${sha("P4")}\t${seconds("2026-08-23T23:00:00+02:00")}`,
  "",
  "diff --git a/src/A.js b/src/A.js",
  "--- a/src/A.js",
  "+++ b/src/A.js",
  "@@ -1 +1 @@",
  "",
].join("\n");

const parsedLog = rework.parsePatchLog(PATCH_LOG);

assert.deepStrictEqual(
  parsedLog.map((commit) => [commit.sha, commit.parent]),
  [
    [sha("C1"), sha("P1")],
    [sha("C2"), sha("P2")],
    [sha("C3"), null],
    [sha("C4"), sha("P4")],
  ]
);
assert.deepStrictEqual(parsedLog[0].files, [
  { oldPath: "src/Pages/HomePage/HomePage.js", newPath: "src/Pages/HomePage/HomePage.js", binary: false, ranges: [[10, 2], [50, 1]] },
  { oldPath: "src/Old.js", newPath: null, binary: false, ranges: [[1, 3]] },
  { oldPath: null, newPath: "src/New.js", binary: false, ranges: [] },
  { oldPath: null, newPath: null, binary: true, ranges: [] },
  { oldPath: "src/Services/oldName.js", newPath: "src/Services/newName.js", binary: false, ranges: [[4, 2]] },
  { oldPath: "package-lock.json", newPath: "package-lock.json", binary: false, ranges: [[100, 4]] },
  { oldPath: "CHANGELOG.md", newPath: "CHANGELOG.md", binary: false, ranges: [[3, 1]] },
  { oldPath: "docs/my notes.md", newPath: "docs/my notes.md", binary: false, ranges: [[1, 1]] },
  { oldPath: 'src/say "hi".js', newPath: 'src/say "hi".js', binary: false, ranges: [[2, 1]] },
]);

const plan = rework.planRework(parsedLog, { weeks: WEEKS });

assert.strictEqual(plan.commits, 1, "only C1 is in the window and has a parent");
assert.deepStrictEqual(
  plan.tasks.map((task) => [task.path, task.lines, task.weekStart, task.parent]),
  [
    ["src/Old.js", 3, "2026-09-14", sha("P1")],
    ["src/Pages/HomePage/HomePage.js", 3, "2026-09-14", sha("P1")],
    ["src/Services/oldName.js", 2, "2026-09-14", sha("P1")],
    ["docs/my notes.md", 1, "2026-09-14", sha("P1")],
    ['src/say "hi".js', 1, "2026-09-14", sha("P1")],
  ],
  "biggest first, blamed under the old name, and nothing that was only added"
);
assert.deepStrictEqual(plan.skipped, {
  binary: { files: 1, lines: 0 },
  lockfile: { files: 1, lines: 4 },
  version: { files: 1, lines: 1 },
});

const capped = rework.planRework(parsedLog, { weeks: WEEKS, maxFilesPerCommit: 2, maxLinesPerFile: 2 });

assert.deepStrictEqual(capped.tasks.map((task) => task.path), ["src/Services/oldName.js", "docs/my notes.md"]);
assert.deepStrictEqual(capped.skipped.bulk, { files: 2, lines: 6 }, "over the line limit: a move or a generated file");
assert.deepStrictEqual(capped.skipped.cap, { files: 1, lines: 1 }, "past the file limit: the smallest go");
assert.match(rework.describeSkipped(capped.skipped), /^skipped binary 1 file, bulk 2 files \(6 lines\), cap 1 file \(1 line\),/);
assert.strictEqual(rework.describeSkipped({}), "skipped nothing");

assert.strictEqual(rework.skipReason("web/privacy/index.html", 5), "generated");
assert.strictEqual(rework.skipReason("data/gyms/PureGym/Aarhus/info.json", 5), "data");
assert.strictEqual(rework.skipReason("ios/Podfile.lock", 5), "lockfile");
assert.strictEqual(rework.skipReason("src/Services/package.json.js", 5), null, "only the root package.json is bookkeeping");
assert.strictEqual(rework.skipReason("src/App.js", rework.MAX_LINES_PER_FILE + 1), "bulk");

assert.deepStrictEqual(
  rework.blameArgs({ parent: sha("P1"), path: "src/Old.js", ranges: [[1, 3], [9, 1]] }),
  ["blame", "-w", "--line-porcelain", "-L", "1,+3", "-L", "9,+1", sha("P1"), "--", "src/Old.js"]
);
assert.deepStrictEqual(
  rework.blameArgs({ parent: sha("P1"), path: "src/Old.js", ranges: [[1, 3], [9, 1]] }, 1),
  ["blame", "-w", "--line-porcelain", sha("P1"), "--", "src/Old.js"],
  "many ranges: one blame of the whole file"
);

function porcelainLine(hash, originalLine, finalLine, authorTime, content) {
  return [
    `${hash} ${originalLine} ${finalLine}`,
    "author Somebody",
    "author-mail <somebody@example.com>",
    `author-time ${authorTime}`,
    "author-tz +0200",
    "committer Somebody",
    "committer-mail <somebody@example.com>",
    `committer-time ${authorTime + 3600}`,
    "committer-tz +0200",
    "summary a change",
    "filename src/Old.js",
    `\t${content}`,
  ].join("\n");
}

const BLAME = [
  porcelainLine(sha("L1"), 1, 1, IN_WINDOW - 2 * DAY, "x"),
  porcelainLine(sha("L2"), 5, 2, IN_WINDOW - 20 * DAY, `${sha("L9")} 1 2 3`),
  porcelainLine(sha("L3"), 3, 3, IN_WINDOW - 13 * DAY, "z"),
  "",
].join("\n");

assert.deepStrictEqual(rework.parseBlamePorcelain(BLAME), [
  { line: 1, time: IN_WINDOW - 2 * DAY },
  { line: 2, time: IN_WINDOW - 20 * DAY },
  { line: 3, time: IN_WINDOW - 13 * DAY },
]);
assert.deepStrictEqual(
  rework.changedLineTimes(rework.parseBlamePorcelain(BLAME), [[2, 2]]),
  [IN_WINDOW - 20 * DAY, IN_WINDOW - 13 * DAY],
  "a whole-file blame keeps only the changed lines"
);

const at = (iso) => seconds(iso);
const result = (weekStart, filePath, authorIso, ageDays) => ({
  weekStart,
  path: filePath,
  authorTime: at(authorIso),
  times: ageDays.map((age) => at(authorIso) - Math.round(age * DAY)),
});

const summary = rework.summarizeRework(
  [
    // 13.9 days is rework; exactly 14 is not.
    result("2026-08-31", "src/Pages/HomePage/HomePage.js", "2026-09-02T10:00:00Z", [1, 13.9, 14, 30]),
    result("2026-09-07", "src/Services/socialService.js", "2026-09-08T10:00:00Z", [0, 2, 5]),
    result("2026-09-14", "App.js", "2026-09-15T10:00:00Z", [100, 200, 300]),
    // Outside the four weeks: ignored.
    result("2026-09-21", "src/Services/socialService.js", "2026-09-22T10:00:00Z", [1]),
  ],
  { weeks: WEEKS }
);

assert.deepStrictEqual(summary, {
  percent: 50,
  topFolder: "src/Services",
  weeks: [
    { weekStart: "2026-08-24", percent: null },
    { weekStart: "2026-08-31", percent: 50 },
    { weekStart: "2026-09-07", percent: 100 },
    { weekStart: "2026-09-14", percent: 0 },
  ],
});
assert.strictEqual(
  rework.summarizeRework([result("2026-09-14", "src/A.js", "2026-09-15T10:00:00Z", [1, 20, 30])], { weeks: WEEKS }).percent,
  33.3,
  "one decimal"
);
assert.deepStrictEqual(
  rework.summarizeRework([], { weeks: WEEKS }),
  { percent: null, topFolder: null, weeks: WEEKS.map((weekStart) => ({ weekStart, percent: null })) },
  "no changed lines is no number, not 0 %"
);
assert.strictEqual(rework.folderOf("src/Pages/HomePage/Components/TodayHeroCard/TodayHeroCard.js"), "src/Pages/HomePage");
assert.strictEqual(rework.folderOf("src/Services/socialService.js"), "src/Services");
assert.strictEqual(rework.folderOf("App.js"), ".");
assert.strictEqual(rework.logSince(WEEKS), "2026-08-22T22:00:00.000Z", "a day before the window, as git log goes by commit date");

/* ------------------------------------------------------------ bug debt --- */

const issue = (number, createdAt, state = "OPEN") => ({ number, createdAt, state });

assert.deepStrictEqual(
  bugDebt.summarizeBugDebt(
    [
      [issue(1, "2026-06-28T12:00:00Z"), issue(2, "2026-09-20T12:00:00Z")],
      // The same issue under a second label is one issue.
      [issue(2, "2026-09-20T12:00:00Z"), issue(3, "2026-09-25T13:00:00Z")],
      [issue(1, "2026-06-28T12:00:00Z"), issue(4, "2026-01-01T00:00:00Z", "CLOSED")],
    ],
    NOW
  ),
  { open: 3, oldestDays: 90, labels: ["bug", "Fix", "codex-fix"] }
);
assert.deepStrictEqual(bugDebt.summarizeBugDebt([[], [], []], NOW), {
  open: 0,
  oldestDays: null,
  labels: ["bug", "Fix", "codex-fix"],
});
assert.deepStrictEqual(bugDebt.BUG_LABELS, ["bug", "Fix", "codex-fix"], "the labels S8 names");

/* ------------------------------------------------- feature pathspecs ---- */

const matches = features.matchesPathspec;

// Without a wildcard: the path, or anything under it - never a longer name.
assert.ok(matches("src/Pages/WorkoutPage/WorkoutTypes/Run", "src/Pages/WorkoutPage/WorkoutTypes/Run/Run.js"));
assert.ok(matches("src/Pages/WorkoutPage/WorkoutTypes/Run", "src/Pages/WorkoutPage/WorkoutTypes/Run/Components/Row/Row.js"));
assert.ok(!matches("src/Pages/WorkoutPage/WorkoutTypes/Run", "src/Pages/WorkoutPage/WorkoutTypes/RunSummary.js"));
assert.ok(matches("src/Services/notificationService.js", "src/Services/notificationService.js"));
assert.ok(!matches("src/Services/notificationService.js", "src/Services/notificationServiceXjs"));
// With one, `*` crosses "/" the way it does for git log.
assert.ok(matches("src/Pages/Social*", "src/Pages/SocialPage/SocialPage.js"));
assert.ok(matches("src/Pages/Social*", "src/Pages/SocialUserListPage/SocialUserListPage.js"));
assert.ok(!matches("src/Pages/Social*", "src/Pages/PublicProfilePage/PublicProfilePage.js"));
assert.ok(!matches("src/Pages/Social*", "src/Services/socialService.js"));
assert.ok(matches("src/**/Music*", "src/Pages/MusicSettingsPage/MusicSettingsPage.js"));
assert.ok(matches("src/**/Music*", "src/Resources/Icons/UI-icons/MusicNote.js"));
assert.ok(!matches("src/**/Music*", "src/Services/musicService.js"), "case matters, as it does to git");
assert.ok(matches("src/**/Sick*", "src/Pages/SicknessPage/SicknessPage.js"));
assert.ok(matches("src/Pages/Gym*", "src/Pages/GymsPage/GymsPage.js"));
assert.ok(!matches("src/Pages/Gym*", "src/Pages/WorkoutPage/Gym.js"));
assert.ok(!matches("src/*/WorkoutTypes/Run", "src/Pages/WorkoutPage/WorkoutTypes/Run/Run.js"), "a wildcard has to match the whole path");
assert.ok(!matches("src/a.b*", "src/aXb/c.js"), "a dot is a dot");
assert.ok(matches("src/Pages/Gym?Page", "src/Pages/GymsPage") && matches("src/[AB]pp.js", "src/App.js"));
// The two paths that differ from the spec.
assert.ok(matches("src/**/CustomExercise*", "src/Pages/ExerciseCatalogPage/Components/CustomExerciseModal/CustomExerciseModal.js"));
assert.ok(!features.FEATURE_PATHS.customExercises.some((spec) => matches(spec, "src/Pages/ExerciseLibraryPage/ExerciseLibraryPage.js")), "the Train tab is not custom exercises");
assert.ok(features.FEATURE_PATHS.push.some((spec) => matches(spec, "src/Services/notificationService.js")));
assert.ok(features.FEATURE_PATHS.push.some((spec) => matches(spec, "src/Sync/PushNotificationRegistrationSync.js")));

assert.deepStrictEqual(
  Object.keys(features.FEATURE_PATHS),
  ["run", "posts", "likes", "follows", "gymLifts", "music", "sickness", "customExercises", "push"],
  "the brief's feature keys, in the spec's order"
);

for (const [key, specs] of Object.entries(features.FEATURE_PATHS)) {
  assert.ok(Array.isArray(specs) && specs.length > 0, `${key} has no paths`);

  for (const spec of specs) {
    assert.ok(!spec.startsWith(":"), `${key}: "${spec}" uses pathspec magic, which matchesPathspec does not read`);
  }
}

// git log --no-merges --no-renames --name-only --format=%x1e%H%x09%ct, newest first
const nameRecord = (hash, iso, files) => `\x1e${hash}\t${seconds(iso)}\n\n${files.join("\n")}\n`;
const NAME_LOG = [
  nameRecord(sha("F5"), "2026-09-20T10:00:00+02:00", ["src/Pages/GymsPage/GymsPage.js", "src/Pages/MusicSettingsPage/MusicSettingsPage.js"]),
  // Half past midnight on 1/9 in Copenhagen counts; half past eleven the night before does not.
  nameRecord(sha("F4"), "2026-09-01T00:30:00+02:00", ["src/Pages/SocialPage/SocialPage.js"]),
  nameRecord(sha("F3"), "2026-08-31T23:30:00+02:00", ["src/Services/socialService.js"]),
  nameRecord(sha("F2"), "2026-06-08T17:17:19+02:00", [
    "src/Pages/ExerciseCatalogPage/Components/CustomExerciseModal/CustomExerciseModal.js",
    '"src/Pages/SocialPage/say \\"hi\\".js"',
  ]),
  nameRecord(sha("F1"), "2026-02-06T20:38:21+01:00", ["src/Pages/WorkoutPage/WorkoutTypes/Run/Run.js", "src/Pages/SocialPage/Old.js"]),
].join("");

const nameLog = features.parseNameOnlyLog(NAME_LOG);

assert.deepStrictEqual(nameLog[3].files[1], 'src/Pages/SocialPage/say "hi".js');

const storeTagFixture = storeTags.parseStoreTags(
  [
    ["android/1.0.0", sha("tag-a100"), sha("F2"), "", seconds("2026-07-01T10:00:00+02:00")],
    ["android/1.0.2", sha("tag-a102"), sha("F3"), "", seconds("2026-09-13T01:29:46+02:00")],
    ["ios/1.1.2", sha("tag-i112"), sha("F4"), "", seconds("2026-09-17T00:17:12+02:00")],
  ]
    .map((fields) => fields.join("\t"))
    .join("\n")
).tags;
const tagCommits = new Map([
  ["android/1.0.0", new Set([sha("F1"), sha("F2")])],
  ["android/1.0.2", new Set([sha("F1"), sha("F2"), sha("F3")])],
  ["ios/1.1.2", new Set([sha("F1"), sha("F2"), sha("F3"), sha("F4")])],
]);
const featureContext = { tags: storeTagFixture, latest: storeTags.latestByPlatform(storeTagFixture), tagCommits };
const featureSummary = features.summarizeFeatureCommits(nameLog, featureContext);
const JULY_FIRST = "2026-07-01T08:00:00.000Z";

assert.strictEqual(featureSummary.since, "2026-09-01");
assert.deepStrictEqual(featureSummary.features, {
  run: { commits: 0, firstInStoreAt: JULY_FIRST, inLatestStoreTag: true },
  posts: { commits: 1, firstInStoreAt: JULY_FIRST, inLatestStoreTag: true },
  likes: { commits: 1, firstInStoreAt: JULY_FIRST, inLatestStoreTag: true },
  follows: { commits: 1, firstInStoreAt: JULY_FIRST, inLatestStoreTag: true },
  gymLifts: { commits: 1, firstInStoreAt: null, inLatestStoreTag: false },
  music: { commits: 1, firstInStoreAt: null, inLatestStoreTag: false },
  sickness: { commits: 0, firstInStoreAt: null, inLatestStoreTag: false },
  customExercises: { commits: 0, firstInStoreAt: JULY_FIRST, inLatestStoreTag: true },
  push: { commits: 0, firstInStoreAt: null, inLatestStoreTag: false },
});

const onlyOnIos = features.summarizeFeatureCommits(nameLog, {
  ...featureContext,
  featurePaths: { widget: ["src/Pages/SocialPage/SocialPage.js"] },
}).features.widget;

assert.deepStrictEqual(
  onlyOnIos,
  { commits: 1, firstInStoreAt: "2026-09-16T22:17:12.000Z", inLatestStoreTag: true },
  "in the newest build of one store is in the store: somebody has it"
);

const hotfixOnly = features.summarizeFeatureCommits(nameLog, {
  tags: storeTagFixture,
  latest: { android: storeTagFixture[1], ios: null },
  tagCommits: new Map([
    ["android/1.0.0", new Set([sha("F1"), sha("F2")])],
    // A hotfix branched off before the feature.
    ["android/1.0.2", new Set([sha("F1")])],
  ]),
  featurePaths: { customExercises: features.FEATURE_PATHS.customExercises },
}).features.customExercises;

assert.deepStrictEqual(
  hotfixOnly,
  { commits: 0, firstInStoreAt: JULY_FIRST, inLatestStoreTag: false },
  "shipped once is not the same as in the newest build"
);

/* ------------------------------------------- the whole run, with fakes ---- */

const BRIEF_SHAPES = {
  release_lag: ["days", "commits", "latestTag", "latestTagAt", "oldestUnreleasedAt", "oldestVersion", "newestVersion", "versionCount", "unreleasedMajor"],
  rework: ["percent", "topFolder", "weeks"],
  bug_debt: ["open", "oldestDays", "labels"],
  feature_commits: ["since", "features"],
};
const FEATURE_KEYS = ["run", "posts", "likes", "follows", "gymLifts", "music", "sickness", "customExercises", "push"];
const FAKE_URL = "https://example.supabase.co/";
const FAKE_KEY = "made-up-service-key-for-the-test";

const E2E_TAGS = [
  ["android/1.0.2", sha("tag-a102"), sha("A102"), "", seconds("2026-09-13T01:29:46+02:00")],
  ["ios/1.1.2", sha("tag-i112"), sha("I112"), "", seconds("2026-09-17T00:17:12+02:00")],
  ["ios/latest", sha("I999"), "", seconds("2026-09-20T12:00:00+02:00"), ""],
]
  .map((fields) => fields.join("\t"))
  .join("\n");

// Answers a blame with one line per requested -L line: two days old in
// HomePage.js, a hundred everywhere else.
function fakeBlame(args) {
  const young = args.includes("src/Pages/HomePage/HomePage.js");
  const blamed = [];

  args.forEach((arg, index) => {
    if (args[index - 1] !== "-L") return;

    const [start, count] = arg.split(",+").map(Number);

    for (let line = start; line < start + count; line += 1) {
      blamed.push(porcelainLine(sha(`L${line}`), line, line, IN_WINDOW - (young ? 2 : 100) * DAY, "x"));
    }
  });

  return `${blamed.join("\n")}\n`;
}

function fakeRun({ tags = E2E_TAGS, ghFails = false } = {}) {
  const calls = [];

  const run = async (file, args) => {
    calls.push([file, ...args]);

    if (file === "gh") {
      if (ghFails) throw new Error("gh issue list failed: gh: not logged in");

      const label = args[args.indexOf("--label") + 1];
      const lists = { bug: [issue(7, "2026-09-01T12:00:00Z")], Fix: [issue(7, "2026-09-01T12:00:00Z")], "codex-fix": [] };

      return JSON.stringify(lists[label] ?? []);
    }

    assert.strictEqual(file, "git");

    const rest = args[0] === "-c" ? args.slice(2) : args;
    const [command] = rest;

    if (command === "rev-parse") return `${sha("M")}\n`;
    if (command === "for-each-ref") return tags;
    if (command === "show") {
      if (rest[1] === "origin/master:package.json" || rest[1] === "HEAD:package.json") {
        return '{ "version": "2.13.0-feature-dev-kpis.1" }';
      }
      if (rest[1] === `${sha("A102")}:package.json`) return '{ "version": "1.0.2" }';
      if (rest[1] === `${sha("I112")}:package.json`) return '{ "version": "1.1.2-fix-social-post-reliability.1" }';
    }
    if (command === "rev-list" && rest.includes("--count")) return rest.includes(`${sha("A102")}..origin/master`) ? "148\n" : "132\n";
    if (command === "rev-list") return `${sha("F1")}\n${sha("F2")}\n`;
    if (command === "log" && rest.includes("--name-only")) return NAME_LOG;
    if (command === "log" && rest.includes("-w")) return PATCH_LOG;
    if (command === "log" && rest.includes("package.json")) return PACKAGE_PATCH;
    if (command === "log" && rest.includes("--format=%ct")) return `${seconds("2026-09-20T10:00:00Z")}\n${seconds("2026-09-17T10:00:00Z")}\n`;
    if (command === "blame") return fakeBlame(rest);

    throw new Error(`the fake has no answer for: ${file} ${args.join(" ")}`);
  };

  return { run, calls };
}

function sink() {
  const stream = { text: "", write: (chunk) => ((stream.text += chunk), true) };

  return stream;
}

function fakeFetch(respond = () => ({ ok: true, status: 201, text: async () => "" })) {
  const requests = [];
  const fetchImpl = async (endpoint, init) => {
    requests.push({ endpoint, init });

    return respond(endpoint, init);
  };

  return { fetchImpl, requests };
}

async function runAll() {
  // --- a dry run prints exactly the brief's rows and writes nothing
  {
    const { run, calls } = fakeRun();
    const { fetchImpl, requests } = fakeFetch();
    const stdout = sink();
    const stderr = sink();
    const code = await main({ argv: ["--dry-run"], env: {}, run, fetchImpl, now: NOW, stdout, stderr });

    assert.strictEqual(code, 0);
    assert.strictEqual(requests.length, 0, "a dry run never reaches Supabase");

    const rows = JSON.parse(stdout.text);

    assert.deepStrictEqual(
      rows.map((row) => `${row.key}/${row.platform}`),
      ["release_lag/android", "release_lag/ios", "rework/all", "bug_debt/all", "feature_commits/all"]
    );

    for (const row of rows) {
      assert.deepStrictEqual(Object.keys(row).sort(), ["key", "platform", "value"]);
      assert.deepStrictEqual(Object.keys(row.value).sort(), [...BRIEF_SHAPES[row.key]].sort(), `${row.key} has the brief's keys, and only those`);
    }

    const [androidLag, iosLag, reworkRow, bugRow, featureRow] = rows.map((row) => row.value);

    assert.deepStrictEqual(androidLag, {
      days: 9,
      commits: 148,
      latestTag: "android/1.0.2",
      latestTagAt: "2026-09-12T23:29:46.000Z",
      oldestUnreleasedAt: "2026-09-17T10:00:00.000Z",
      oldestVersion: "1.0.2",
      newestVersion: "2.13.0",
      versionCount: 4,
      unreleasedMajor: "2.0.0",
    });
    assert.strictEqual(iosLag.oldestVersion, "1.1.2");
    assert.strictEqual(iosLag.commits, 132);
    assert.strictEqual(iosLag.versionCount, 3, "2.0.0, 2.12.2 and 2.13.0; 1.1.0 is below the store");

    // The clock starts at the merge, never at a commit on the merged branch.
    const landedCalls = calls.filter((call) => call.includes("--format=%ct"));

    assert.strictEqual(landedCalls.length, 2);
    assert.ok(landedCalls.every((call) => call.includes("--first-parent")), "landing times come from master's own line");

    assert.strictEqual(reworkRow.weeks.length, 4);
    assert.deepStrictEqual(reworkRow.weeks.map((week) => week.weekStart), WEEKS, "Mondays, oldest first");
    assert.ok(reworkRow.weeks.every((week) => week.percent === null || typeof week.percent === "number"));
    // C1's five files, ten changed lines, of which HomePage.js's three are young.
    assert.deepStrictEqual(reworkRow, {
      percent: 30,
      topFolder: "src/Pages/HomePage",
      weeks: [
        { weekStart: "2026-08-24", percent: null },
        { weekStart: "2026-08-31", percent: null },
        { weekStart: "2026-09-07", percent: null },
        { weekStart: "2026-09-14", percent: 30 },
      ],
    });
    assert.ok(
      calls.filter((call) => call.includes("blame")).every((call) => call.includes("-w") && call.includes(sha("P1"))),
      "blamed on the parent, ignoring whitespace"
    );
    assert.ok(stderr.text.includes("rework: 2026-08-24 to 2026-09-20, 1 commit, 5 files blamed"), "what was measured is said");
    assert.ok(stderr.text.includes("skipped binary 1 file, lockfile 1 file (4 lines), version 1 file (1 line)"), "and what was not");

    assert.deepStrictEqual(bugRow, { open: 1, oldestDays: 25, labels: ["bug", "Fix", "codex-fix"] });
    assert.ok(
      calls.filter((call) => call[0] === "gh").every((call) => call.filter((arg) => arg === "--label").length === 1),
      "one label per gh call, since repeated labels mean AND"
    );

    assert.ok(stderr.text.includes("store tags left out, as their names are not <platform>/<version>: ios/latest."));
    assert.strictEqual(
      calls.filter((call) => call.includes("rev-list") && !call.includes("--count")).length,
      2,
      "the commits of every store tag, and of nothing else"
    );

    assert.strictEqual(featureRow.since, "2026-09-01");
    assert.deepStrictEqual(Object.keys(featureRow.features), FEATURE_KEYS);

    for (const [key, feature] of Object.entries(featureRow.features)) {
      assert.deepStrictEqual(Object.keys(feature).sort(), ["commits", "firstInStoreAt", "inLatestStoreTag"], key);
      assert.ok(Number.isInteger(feature.commits), key);
      assert.ok(feature.firstInStoreAt === null || !Number.isNaN(Date.parse(feature.firstInStoreAt)), key);
      assert.strictEqual(typeof feature.inLatestStoreTag, "boolean", key);
    }

    for (const lagRow of [androidLag, iosLag]) {
      assert.ok(Number.isInteger(lagRow.days) && Number.isInteger(lagRow.commits) && Number.isInteger(lagRow.versionCount));
      assert.ok(typeof lagRow.latestTag === "string" && typeof lagRow.newestVersion === "string");
    }
  }

  // --- no tags yet: days is null, and the run says what to do
  {
    const { run } = fakeRun({ tags: "" });
    const stdout = sink();
    const stderr = sink();
    const code = await main({ argv: ["--dry-run"], env: { GITHUB_ACTIONS: "true" }, run, now: NOW, stdout, stderr });
    const rows = JSON.parse(stdout.text);

    assert.strictEqual(code, 0);
    assert.deepStrictEqual(
      rows.filter((row) => row.key === "release_lag").map((row) => [row.platform, row.value.days, row.value.latestTag, row.value.newestVersion]),
      [
        ["android", null, null, "2.13.0"],
        ["ios", null, null, "2.13.0"],
      ]
    );
    assert.ok(stderr.text.includes("::notice title=dev-metrics::release_lag/android: there is no android/* tag"));
    assert.ok(stderr.text.includes("git tag -a ios/<version> <commit>"));

    const featureRow = rows.find((row) => row.key === "feature_commits").value;

    assert.ok(
      Object.values(featureRow.features).every((feature) => feature.firstInStoreAt === null && feature.inLatestStoreTag === false),
      "without tags nothing is in the store, so KPI-4 judges nothing"
    );
  }

  // --- the write: one upsert per row, the service key as apikey and bearer
  {
    const { run } = fakeRun();
    const { fetchImpl, requests } = fakeFetch();
    const stdout = sink();
    const stderr = sink();
    const env = { SUPABASE_URL: FAKE_URL, SUPABASE_SERVICE_ROLE_KEY: FAKE_KEY };
    const code = await main({ argv: [], env, run, fetchImpl, now: NOW, stdout, stderr });

    assert.strictEqual(code, 0);
    assert.strictEqual(requests.length, METRICS.length);

    for (const { endpoint, init } of requests) {
      assert.strictEqual(endpoint, "https://example.supabase.co/rest/v1/dev_metrics?on_conflict=key,platform");
      assert.strictEqual(init.method, "POST");
      assert.strictEqual(init.headers.apikey, FAKE_KEY);
      assert.strictEqual(init.headers.Authorization, `Bearer ${FAKE_KEY}`);
      assert.strictEqual(init.headers["Content-Type"], "application/json");
      assert.match(init.headers.Prefer, /(^|,)resolution=merge-duplicates(,|$)/);

      const body = JSON.parse(init.body);

      assert.ok(Array.isArray(body) && body.length === 1);
      assert.deepStrictEqual(Object.keys(body[0]).sort(), ["key", "measured_at", "platform", "value"]);
      assert.strictEqual(body[0].measured_at, new Date(NOW).toISOString(), "measured_at is set, or an update would keep the old one");
      assert.ok(["all", "android", "ios"].includes(body[0].platform));
    }

    assert.ok(stderr.text.includes("wrote 5 of 5 rows to dev_metrics"));
    assert.ok(!stderr.text.includes(FAKE_KEY) && !stdout.text.includes(FAKE_KEY), "the key is never printed");
    assert.ok(!stderr.text.includes("example.supabase.co"), "nor is the project address");
  }

  // --- one metric failing costs that row, not the run
  {
    const { run } = fakeRun({ ghFails: true });
    const { fetchImpl, requests } = fakeFetch();
    const stderr = sink();
    const env = { SUPABASE_URL: FAKE_URL, SUPABASE_SERVICE_ROLE_KEY: FAKE_KEY, GITHUB_ACTIONS: "true" };
    const code = await main({ argv: [], env, run, fetchImpl, now: NOW, stdout: sink(), stderr });

    assert.strictEqual(code, 0, "four of five written is a success with a warning");
    assert.deepStrictEqual(
      requests.map((request) => JSON.parse(request.init.body)[0].key),
      ["release_lag", "release_lag", "rework", "feature_commits"]
    );
    assert.ok(stderr.text.includes("::warning title=dev-metrics::bug_debt/all was not measured: gh issue list failed"));
  }

  // --- a refused write is reported with PostgREST's reason, and nothing written is a failure
  {
    const { run } = fakeRun();
    const { fetchImpl } = fakeFetch(() => ({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ code: "PGRST205", message: "Could not find the table 'public.dev_metrics'" }),
    }));
    const stderr = sink();
    const env = { SUPABASE_URL: FAKE_URL, SUPABASE_SERVICE_ROLE_KEY: FAKE_KEY };
    const code = await main({ argv: [], env, run, fetchImpl, now: NOW, stdout: sink(), stderr });

    assert.strictEqual(code, 1, "nothing written is the one failure");
    assert.ok(stderr.text.includes("release_lag/android was not written: HTTP 404: PGRST205 - Could not find the table"));
    assert.ok(stderr.text.includes("wrote 0 of 5 rows"));
  }

  // --- a network error says what kind, not where
  {
    const { run } = fakeRun();
    const { fetchImpl } = fakeFetch(() => {
      throw Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("getaddrinfo ENOTFOUND example.supabase.co"), { code: "ENOTFOUND" }) });
    });
    const stderr = sink();
    const env = { SUPABASE_URL: FAKE_URL, SUPABASE_SERVICE_ROLE_KEY: FAKE_KEY };
    const code = await main({ argv: [], env, run, fetchImpl, now: NOW, stdout: sink(), stderr });

    assert.strictEqual(code, 1);
    assert.ok(stderr.text.includes("was not written: fetch failed (ENOTFOUND)"));
    assert.ok(!stderr.text.includes("example.supabase.co"));
  }

  // --- without the secrets it does nothing, and says so
  {
    const { run, calls } = fakeRun();
    const { fetchImpl, requests } = fakeFetch();
    const stderr = sink();
    const code = await main({ argv: [], env: { SUPABASE_URL: FAKE_URL, GITHUB_ACTIONS: "true" }, run, fetchImpl, now: NOW, stdout: sink(), stderr });

    assert.strictEqual(code, 0, "missing secrets are a setup step, not a failure");
    assert.strictEqual(calls.length, 0, "nothing is measured");
    assert.strictEqual(requests.length, 0, "nothing is written");
    assert.ok(stderr.text.includes("::warning title=dev-metrics::SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not both set"));
  }

  // --- options
  {
    const { run, calls } = fakeRun();
    const stdout = sink();
    const code = await main({ argv: ["--dry-run", "--ref", "HEAD"], env: {}, run, now: NOW, stdout, stderr: sink() });

    assert.strictEqual(code, 0);
    assert.ok(!calls.some((call) => call.includes("rev-parse")), "an explicit --ref is not second-guessed");
    assert.ok(calls.some((call) => call.includes("HEAD:package.json")));
    assert.strictEqual(await main({ argv: ["--dry-rum"], env: {}, run, now: NOW, stdout: sink(), stderr: sink() }), 2, "a typo is not a dry run");
  }
}

runAll().then(
  () => console.log("test-dev-metrics-action: release lag, rework, bug debt, feature commits and the write passed."),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  }
);
