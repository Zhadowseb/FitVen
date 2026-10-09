// What every tile, row and card on the overview says, and the one place the
// page asks `getKpiStatus` for a status.
//
// No limit lives here. A status is whatever `getKpiStatus` in
// `@utils/devDashboard` says it is - for a read that failed and one whose
// migration has not been run as well - so each threshold exists once and is
// tested (`scripts/test-dev-dashboard.js`). The small-numbers rule is that
// file's too (`describeRatio`).
//
// The screen is Danish only, like the rest of the page (see the note at the top
// of DevDashboardPage.js), so the numbers are formatted here the Danish way
// rather than through `@localization`.
import {
  COMES_BACK_LINES,
  KPI_STATUSES,
  describeRatio,
  formatCount,
  formatRating,
  getKpiStatus,
  getWeeksSinceRelease,
  worstStatus,
} from "@utils/devDashboard";

const MINUS = "−";

// What a tile says when `getKpiStatus` could not be asked - it threw, or
// answered with something that is not a status. The page keeps drawing.
const FAILED = { status: "unmeasured", label: "Kunne ikke hentes" };
const UNAVAILABLE = { status: "unmeasured", label: "Ikke koblet på" };
const NO_STATUS = { status: "unmeasured", label: "Ingen status" };

const PLATFORM_NAMES = { android: "Android", ios: "iOS" };

/**
 * The two dashed lines on "Kommer igen". Drawn, not judged: the status comes
 * from `getKpiStatus`, and the lines sit at the limits it judges KPI-2 by, so
 * the numbers exist once.
 */
const COMES_BACK_THRESHOLDS = [
  { value: COMES_BACK_LINES.good, tone: "good" },
  { value: COMES_BACK_LINES.alarm, tone: "alarm" },
];

/**
 * The commit count's colour in KPI-4 (§5): plain, `record` from 20 and
 * `danger` from 40. A colour for how much work went in, not a status - the
 * feature's status is its share of users.
 */
const COMMITS_WATCH = 20;
const COMMITS_ALARM = 40;

/* ------------------------------------------------------------ sources -- */

export const LOADING = { state: "loading", value: null };

function describeError(reason) {
  if (reason instanceof Error && reason.message) {
    return reason.message;
  }

  return typeof reason?.message === "string" ? reason.message : "";
}

/**
 * One `Promise.allSettled` result as a source the builders read:
 * `ok` with its value, `failed`, or `unavailable` - the service's answer when
 * the migration behind it has not been run.
 */
export function fromSettled(result) {
  if (!result) {
    return LOADING;
  }

  if (result.status === "rejected") {
    return { state: "failed", value: null, message: describeError(result.reason) };
  }

  const value = result.value ?? null;

  if (value && typeof value === "object" && value.unavailable === true) {
    return { state: "unavailable", value: null };
  }

  return { state: "ok", value };
}

function okValue(source) {
  return source?.state === "ok" ? source.value : null;
}

/* ------------------------------------------------------------- status -- */

/**
 * `getKpiStatus`, kept from taking the page down with it: if it throws or
 * answers with something that is not a status, the tile gets `fallback`.
 */
function kpiStatus(kpiKey, value, context, fallback = NO_STATUS) {
  try {
    const result = getKpiStatus(kpiKey, value, context);

    if (result && KPI_STATUSES.includes(result.status)) {
      return { status: result.status, label: result.label ?? "" };
    }
  } catch (error) {
    if (__DEV__) {
      console.warn(`getKpiStatus(${kpiKey}) failed`, error);
    }
  }

  return fallback;
}

/**
 * The status a source forces on everything drawn from it - "Kunne ikke hentes"
 * or "Ikke koblet på", as `getKpiStatus` words them - or null when it loaded.
 */
function sourceStatus(source, kpiKey = null) {
  if (source?.state === "failed") {
    return kpiStatus(kpiKey, null, { failed: true }, FAILED);
  }

  if (source?.state === "unavailable") {
    return kpiStatus(kpiKey, { unavailable: true }, {}, UNAVAILABLE);
  }

  return null;
}

function statusFor(source, kpiKey, pick, context) {
  const blocked = sourceStatus(source, kpiKey);

  if (blocked) {
    return blocked;
  }

  const value = okValue(source);

  return kpiStatus(kpiKey, value === null ? null : pick(value), context);
}

/** The worst of a list, as `worstStatus` ranks them; grey for an empty one. */
function worst(statuses) {
  return worstStatus(statuses) ?? NO_STATUS;
}

/** The worst of the measured ones; only grey when nothing is measured. */
function worstMeasured(statuses) {
  const measured = statuses.filter((entry) =>
    ["good", "watch", "alarm"].includes(entry.status)
  );

  return worst(measured.length > 0 ? measured : statuses);
}

/** The colour a status is drawn in. Baseline and unmeasured are both grey. */
export function getStatusColor(status, theme) {
  if (status === "good") {
    return theme.secondary;
  }

  if (status === "watch") {
    return theme.record;
  }

  if (status === "alarm") {
    return theme.danger;
  }

  return theme.quietText;
}

/* --------------------------------------------------------- formatting -- */

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function decimal(value, digits) {
  return value.toFixed(digits).replace(".", ",");
}

/** "12 %", an em dash for nothing. */
export function formatShare(value) {
  const number = toNumber(value);

  return number === null ? "—" : `${Math.round(number)} %`;
}

/** Crash and ANR rates: their limits sit at hundredths, so two decimals. */
function formatRate(value) {
  const number = toNumber(value);

  return number === null ? "—" : `${decimal(number, 2)} %`;
}

function formatSignedCount(value) {
  if (value > 0) {
    return `+${formatCount(value)}`;
  }

  if (value < 0) {
    return `${MINUS}${formatCount(-value)}`;
  }

  return "±0";
}

function formatPoints(value) {
  const rounded = Math.round(value);

  if (rounded > 0) {
    return `+${rounded} pp`;
  }

  if (rounded < 0) {
    return `${MINUS}${-rounded} pp`;
  }

  return "±0 pp";
}

/** "2,5" under ten days, whole days after that. */
function formatDays(value) {
  return value < 10 ? decimal(value, 1) : String(Math.round(value));
}

function toDate(value) {
  if (!value) {
    return null;
  }

  // A bare date ("2026-09-15") is read as local midnight, not UTC midnight,
  // so it does not move a day either side of the date line.
  const at = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
    ? new Date(`${value}T00:00:00`)
    : new Date(value);

  return Number.isFinite(at.getTime()) ? at : null;
}

/** "4/9". */
export function formatDayMonth(value) {
  const at = toDate(value);

  return at ? `${at.getDate()}/${at.getMonth() + 1}` : "—";
}

/** "08:05", in the phone's own time zone. */
export function formatClock(value) {
  const at = toDate(value);

  if (!at) {
    return "";
  }

  return `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
}

function plural(count, one, other) {
  return `${formatCount(count)} ${count === 1 ? one : other}`;
}

function formatVersion(version) {
  return version ? `v${String(version).replace(/^v/, "")}` : "ukendt";
}

function seriesValues(series, key) {
  return Array.isArray(series) ? series.map((point) => toNumber(point?.[key])) : [];
}

/**
 * The last step of a series: this week against the one before. Nothing when
 * either week is missing, rather than a step between two older weeks.
 */
function lastChange(series) {
  if (series.length < 2) {
    return null;
  }

  const latest = series[series.length - 1];
  const before = series[series.length - 2];

  return latest === null || before === null ? null : latest - before;
}

function clampFill(value) {
  return Math.min(1, Math.max(0, value));
}

/* ------------------------------------------------------------ context -- */

/**
 * What `getKpiStatus` needs to know about releases: KPI-1 and KPI-3 are a
 * baseline for four weeks after one. Weeks since the newest store tag of either
 * platform, or null before there is one.
 */
export function getReleaseContext(releaseLagSource, now = Date.now()) {
  return { weeksSinceRelease: getWeeksSinceRelease(okValue(releaseLagSource), now) };
}

/** The header's "opdateret": the newest `computedAt` any source reported. */
export function newestComputedAt(sources) {
  let newest = null;

  for (const source of sources) {
    const at = toDate(okValue(source)?.computedAt)?.getTime();

    if (Number.isFinite(at) && (newest === null || at > newest)) {
      newest = at;
    }
  }

  return newest;
}

/* -------------------------------------------------------------- users -- */

const USER_COLUMNS = ["ios", "android", "total"];

function downloadsNote(downloads, lastWeek) {
  if (downloads === null) {
    return { text: "ikke koblet på", tone: "quiet" };
  }

  if (lastWeek === null) {
    return null;
  }

  // Downloads in the last seven days. Green for some, grey for none.
  if (lastWeek < 0) {
    return { text: `${MINUS}${formatCount(-lastWeek)} uge`, tone: "alarm" };
  }

  return { text: `+${formatCount(lastWeek)} uge`, tone: lastWeek > 0 ? "good" : "quiet" };
}

function activeNote(active, downloads, pushOnly) {
  if (active === null) {
    return { text: "ikke koblet på", tone: "quiet" };
  }

  // Push tokens are a subset of the people who opened the app, so a share of
  // downloads would be a number that means nothing.
  if (pushOnly || !downloads) {
    return null;
  }

  return { text: `${Math.round((active / downloads) * 100)} % af dl.`, tone: "quiet" };
}

/** §3: downloads and active users, Apple | Android | Total. */
export function buildUsersTable(source) {
  const totals = okValue(source);
  const downloads = totals?.downloads ?? null;
  const active = totals?.active ?? null;
  const pushOnly = active?.source === "push_tokens";
  const windowDays = toNumber(active?.windowDays) ?? 14;

  return {
    columns: USER_COLUMNS.map((key) => {
      const downloadCount = toNumber(downloads?.[key]);
      const activeCount = toNumber(active?.[key]);

      return {
        key,
        downloads: formatCount(downloadCount),
        downloadsNote: totals ? downloadsNote(downloadCount, toNumber(downloads?.lastWeek?.[key])) : null,
        active: formatCount(activeCount),
        activeNote: totals ? activeNote(activeCount, downloadCount, pushOnly) : null,
      };
    }),
    pushOnly: Boolean(totals) && pushOnly,
    eyebrow: pushOnly
      ? `aktive = push-token set · ${windowDays} dage`
      : `aktive = åbnet appen · ${windowDays} dage`,
    note: sourceStatus(source)?.label ?? null,
  };
}

/* ------------------------------------------------------ does it work? -- */

/** KPI-5a. The worse platform's crash rate, with the worse ANR under it. */
export function buildStoreHealthTile(source) {
  const health = okValue(source);
  const readings = ["android", "ios"].map((platform) => ({
    platform,
    crashRate: toNumber(health?.[platform]?.crashRate),
    anrRate: toNumber(health?.[platform]?.anrRate),
  }));
  const highest = (key) =>
    readings
      .filter((reading) => reading[key] !== null)
      .sort((left, right) => right[key] - left[key])[0] ?? null;
  const crash = highest("crashRate");
  const anr = highest("anrRate");
  const crashStatus = kpiStatus("crashRate", crash?.crashRate ?? null, {
    platform: crash?.platform ?? null,
  });
  const anrStatus = kpiStatus("anrRate", anr?.anrRate ?? null, {
    platform: anr?.platform ?? null,
  });

  return {
    value: formatRate(crash?.crashRate),
    detail: { text: `ANR ${formatRate(anr?.anrRate)}`, status: anrStatus.status },
    window: crash ? `28 dage · ${PLATFORM_NAMES[crash.platform]}` : "28 dage",
    status: sourceStatus(source, "crashRate") ?? worstMeasured([crashStatus, anrStatus]),
  };
}

const MAX_VERSION_ROWS = 3;

/** KPI-5b. Bug reports this week, and which versions they came from. */
export function buildBugReportsTile(source) {
  const report = okValue(source);
  const users = toNumber(report?.users);
  const versions = (Array.isArray(report?.byVersion) ? report.byVersion : [])
    .map((row) => ({
      version: row?.version ?? null,
      count: toNumber(row?.count) ?? 0,
    }))
    .filter((row) => row.count > 0)
    .sort((left, right) => right.count - left.count);
  const highest = versions[0]?.count ?? 0;
  const shown = versions.slice(0, MAX_VERSION_ROWS);

  return {
    value: formatCount(toNumber(report?.total)),
    side: users === null ? null : `fra ${plural(users, "bruger", "brugere")}`,
    rows: shown.map((row) => ({
      key: String(row.version ?? "ukendt"),
      label: formatVersion(row.version),
      count: formatCount(row.count),
      fill: highest > 0 ? row.count / highest : 0,
    })),
    more: versions.length - shown.length,
    window: "7 dage",
    status: statusFor(source, "bugReports", (value) => value),
  };
}

/* ----------------------------------------------------- is it used? -- */

/** KPI-1. People who trained in the last seven days. */
export function buildTrainersTile(source, context) {
  const kpi = okValue(source)?.trainers7d ?? null;
  const value = toNumber(kpi?.value);
  const previous = toNumber(kpi?.previous);

  return {
    value: formatCount(value),
    side: value !== null && previous !== null ? formatSignedCount(value - previous) : null,
    series: seriesValues(kpi?.series, "value"),
    window: "12 uger",
    status: statusFor(source, "trainers7d", (entry) => entry.trainers7d ?? null, context),
  };
}

/**
 * KPI-2. Trained last week and again this week, of those who trained last week.
 *
 * Below the small-numbers floor the value is the two counts and the percentage
 * sits beside it in grey. Above it the percentage is the value, the counts go to
 * the window line, and the change against the week before takes the colour.
 */
export function buildComesBackTile(source) {
  const kpi = okValue(source)?.comesBack ?? null;
  const ratio = describeRatio(kpi?.both, kpi?.lastWeek);
  const percent = toNumber(kpi?.percent);
  const series = seriesValues(kpi?.series, "percent");
  const change = lastChange(series);

  return {
    value: ratio.small ? ratio.count : formatShare(percent),
    side: ratio.small
      ? percent === null ? null : formatShare(percent)
      : change === null ? null : formatPoints(change),
    sideQuiet: !ratio.coloured,
    series,
    thresholds: COMES_BACK_THRESHOLDS,
    window: ratio.small ? "8 uger" : `8 uger · ${ratio.count}`,
    status: statusFor(source, "comesBack", (entry) => entry.comesBack ?? null),
  };
}

/** KPI-3. The median user's share of their planned workouts done. */
export function buildPlanTile(source, context) {
  const kpi = okValue(source)?.planCompleted ?? null;
  const users = toNumber(kpi?.users);
  const series = seriesValues(kpi?.series, "median");
  const change = lastChange(series);

  return {
    value: formatShare(kpi?.median),
    side: change === null ? null : formatPoints(change),
    series,
    window: users === null ? "12 uger" : `12 uger · ${plural(users, "bruger", "brugere")}`,
    status: statusFor(source, "planCompleted", (entry) => entry.planCompleted ?? null, context),
  };
}

const STARTED_FROM_ROWS = [
  { key: "program", label: "Program" },
  { key: "recent", label: "Seneste" },
  { key: "calendar", label: "Kalender" },
  { key: "empty", label: "Tom træning" },
];

/**
 * Where finished workouts were started from, as a share of them. Until any row
 * carries `started_from`, only "Program" can be told apart (from the program
 * the workout belongs to), so that is the only bar.
 */
export function buildStartedFromTile(source) {
  const data = okValue(source);
  const total = toNumber(data?.total);
  const available = data?.available === true;
  const keys = !data ? [] : available ? STARTED_FROM_ROWS : STARTED_FROM_ROWS.slice(0, 1);
  const rows = keys.map(
    ({ key, label }) => {
      const count = toNumber(data?.counts?.[key]);

      return {
        key,
        label,
        count,
        percent: count !== null && total ? (count / total) * 100 : null,
      };
    }
  );
  const largest = rows.reduce(
    (best, row) => ((row.count ?? 0) > (best?.count ?? 0) ? row : best),
    null
  );

  return {
    rows: rows.map((row) => ({
      key: row.key,
      label: row.label,
      share: formatShare(row.percent),
      fill: row.percent === null ? 0 : clampFill(row.percent / 100),
      tone: row === largest ? "strong" : row.key === "empty" ? "faint" : "medium",
    })),
    note: data && !available ? "resten kræver started_from" : null,
    window: total === null ? "28 dage" : `28 dage · ${plural(total, "træning", "træninger")}`,
    status: statusFor(source, "startedFrom", (value) => value),
  };
}

/* -------------------------------------- is development moving right? -- */

function stripPlatform(tag, platform) {
  return String(tag).replace(new RegExp(`^${platform}/`), "");
}

/**
 * KPI-6: how long the oldest commit not in a store build has waited, per
 * platform. With no store tag yet there is nothing to measure against, and the
 * card says what to do about that rather than showing a number.
 */
export function buildReleaseLag(source) {
  const lag = okValue(source);
  const blocked = sourceStatus(source, "releaseLag");
  const platforms = ["android", "ios"].map((platform) => {
    const entry = lag?.[platform] ?? null;
    const days = toNumber(entry?.days);
    const commits = toNumber(entry?.commits);
    let detail = "ikke målt endnu";

    if (entry && !entry.latestTag) {
      detail = "intet tag endnu";
    } else if (entry) {
      detail = [
        commits === null ? null : plural(commits, "commit", "commits"),
        stripPlatform(entry.latestTag, platform),
      ]
        .filter(Boolean)
        .join(" · ");
    }

    return {
      key: platform,
      name: PLATFORM_NAMES[platform],
      entry,
      days: formatCount(days),
      unit: days === 1 ? "dag" : "dage",
      detail,
      status: blocked ?? kpiStatus("releaseLag", entry, { platform }),
    };
  });
  // The row under the hairline describes the platform that is further behind:
  // the worse status, and of two equal ones the more days.
  const measured = platforms
    .filter((platform) => platform.entry)
    .sort((left, right) => (toNumber(right.entry.days) ?? -1) - (toNumber(left.entry.days) ?? -1));
  const behind = worstStatus(
    measured.map((platform) => ({ status: platform.status.status, platform }))
  )?.platform;
  const untagged = platforms.filter((platform) => platform.entry && !platform.entry.latestTag);
  let summary = null;

  if (behind) {
    const entry = behind.entry;
    const versionCount = toNumber(entry.versionCount);

    summary = {
      text: [
        entry.oldestVersion && entry.newestVersion
          ? `${entry.oldestVersion} → ${entry.newestVersion}`
          : null,
        versionCount === null ? null : plural(versionCount, "version", "versioner"),
      ]
        .filter(Boolean)
        .join(" · "),
      unreleasedMajor: entry.unreleasedMajor ? `UUDGIVET ${entry.unreleasedMajor}` : null,
      hint:
        untagged.length > 0
          ? `Tag butiksbuilds som ${untagged.map((platform) => `${platform.key}/*`).join(" og ")}`
          : null,
    };
  }

  return {
    platforms,
    status: blocked ?? worst(platforms.map((platform) => platform.status)),
    summary,
  };
}

/* ---------------------------------------------------- what is used? -- */

const FEATURE_NAMES = {
  run: "Løb",
  posts: "Opslag",
  likes: "Likes",
  follows: "Følger",
  gymLifts: "Center-løft",
  music: "Musik",
  sickness: "Sygdom",
  customExercises: "Egne øvelser",
  push: "Push",
};

/** Screens that only exist on the phone, so nothing on the server sees them used. */
export const UNMEASURED_SCREENS = "Rekorder, Statistik, 1RM-beregner, øvelseskort";

const BADGE_STATUSES = ["watch", "alarm", "baseline"];

function commitTone(commits) {
  if (commits === null) {
    return "plain";
  }

  if (commits >= COMMITS_ALARM) {
    return "alarm";
  }

  return commits >= COMMITS_WATCH ? "watch" : "plain";
}

/**
 * KPI-4. Released features, lowest share first, each with its verdict as a
 * badge. A feature that is not in the latest store build has been used by
 * nobody yet, so it is not judged: it becomes a chip with its commit count.
 */
export function buildFeatureUsage(source) {
  const usage = okValue(source);
  const activeUsers = toNumber(usage?.activeUsers);
  const features = Array.isArray(usage?.features) ? usage.features : [];
  const rows = [];
  const chips = [];

  features.forEach((feature, index) => {
    const key = String(feature?.key ?? index);
    const name = FEATURE_NAMES[feature?.key] ?? key;
    const commits = toNumber(feature?.commits);

    if (feature?.inLatestStoreTag === false) {
      chips.push({
        key,
        text: commits === null ? name : `${name} · ${plural(commits, "commit", "commits")}`,
      });
      return;
    }

    const share = toNumber(feature?.share);
    const users = toNumber(feature?.users);
    const status = kpiStatus("featureUsage", feature, { activeUsers });

    rows.push({
      key,
      name,
      shareValue: share,
      share: formatShare(share),
      counts: users === null || activeUsers === null ? null : `${formatCount(users)}/${formatCount(activeUsers)}`,
      fill: share === null ? 0 : clampFill(share / 100),
      commits: formatCount(commits),
      commitsTone: commitTone(commits),
      inStore: feature?.firstInStoreAt ? `i butik ${formatDayMonth(feature.firstInStoreAt)}` : null,
      status,
      badge: BADGE_STATUSES.includes(status.status) && status.label ? status : null,
    });
  });

  rows.sort(
    (left, right) => (left.shareValue ?? Infinity) - (right.shareValue ?? Infinity)
  );

  return {
    blocked: sourceStatus(source, "featureUsage"),
    rows,
    chips,
    isEmpty: usage !== null && features.length === 0,
  };
}

/* ----------------------------------------------------------- feedback -- */

/** S4 in the feedback header: how long a message waits for a decision. */
export function buildFeedbackTiming(source) {
  const s4 = okValue(source)?.s4 ?? null;

  if (!s4) {
    return null;
  }

  const median = toNumber(s4.medianDays);
  const over = toNumber(s4.overSevenDays) ?? 0;
  const status = kpiStatus("s4", s4);

  return {
    text: [
      median === null ? null : `median ${formatDays(median)} døgn`,
      over > 0 ? `${formatCount(over)} over 7 d` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    alarm: status.status === "alarm",
  };
}

/* ------------------------------------------------ when a number moves -- */

export const SECONDARY_SECTIONS = [
  { key: "stability", title: "Stabilitet", ids: "S2 · S3 · S5 · S9" },
  { key: "growth", title: "Vækst", ids: "S6 · S7" },
  { key: "development", title: "Udvikling", ids: "S1 · S8" },
  { key: "operations", title: "Drift", ids: "S10" },
];

export const DEFAULT_OPEN_SECTIONS = ["stability"];

// S1, S8 and S10 are `dev_metrics` rows: the service hands over the reading
// with `measuredAt`, when the Action (or the admin) wrote it, merged in.
function measuredNote(reading) {
  return reading?.measuredAt ? `målt ${formatDayMonth(reading.measuredAt)}` : null;
}

function versionsNote(versions) {
  const sorted = [...versions]
    .map((entry) => ({ version: entry?.version ?? null, users: toNumber(entry?.users) ?? 0 }))
    .sort((left, right) => right.users - left.users);
  const shown = sorted.slice(0, 3).map((entry) => `${formatVersion(entry.version)}: ${formatCount(entry.users)}`);
  const rest = sorted.slice(3).reduce((sum, entry) => sum + entry.users, 0);

  return [...shown, rest > 0 ? `ældre: ${formatCount(rest)}` : null].filter(Boolean).join(" · ");
}

function usageParts(usage) {
  return [
    ["DB", usage.db],
    ["storage", usage.storage],
    ["egress", usage.egress],
    ["MAU", usage.mau],
  ]
    .map(([label, value]) => [label, toNumber(value)])
    .filter(([, value]) => value !== null);
}

function summarize(statuses) {
  const count = (status) => statuses.filter((entry) => entry.status === status).length;
  const alarms = count("alarm");
  const watches = count("watch");

  if (alarms > 0) {
    return alarms === 1 ? "1 alarm" : `${alarms} alarmer`;
  }

  if (watches > 0) {
    return `${watches} skal ses på`;
  }

  if (count("good") === statuses.length) {
    return "alt godt";
  }

  if (count("good") > 0) {
    return "ingen alarmer";
  }

  return count("baseline") > 0 ? "måles stadig" : "ikke målt";
}

/**
 * The four folding sections, S1 to S10. Each row: id, name, a note saying what
 * is counted, the value, and its status; each section: the worst of its rows
 * and a summary of them.
 */
export function buildSecondarySections(source, storeStatsSource) {
  const kpis = okValue(source) ?? {};
  const isBlocked = sourceStatus(source) !== null;
  const statusOf = (key, value) => sourceStatus(source, key) ?? kpiStatus(key, value ?? null);
  const s1 = kpis.s1 ?? null;
  const s2 = kpis.s2 ?? null;
  const s5 = kpis.s5 ?? null;
  const s6 = kpis.s6 ?? null;
  const s8 = kpis.s8 ?? null;
  const s9 = kpis.s9 ?? null;
  const s10 = kpis.s10 ?? null;
  const storeStats = okValue(storeStatsSource);
  const s5Versions = Array.isArray(s5?.versions) ? s5.versions : [];
  const s1Weeks = seriesValues(s1?.weeks, "percent").filter((value) => value !== null);
  const s10Parts = s10 ? usageParts(s10) : [];
  const s10Highest = s10Parts.length > 0 ? Math.max(...s10Parts.map(([, value]) => value)) : null;
  const s10ReadAt = s10?.readAt ?? s10?.measuredAt ?? null;
  const s8Labels = Array.isArray(s8?.labels) && s8.labels.length > 0 ? s8.labels.join("/") : "bug/Fix/codex-fix";

  const rows = {
    stability: [
      {
        id: "S2",
        name: "Påbegyndt, ikke afsluttet",
        note: "startet for over 12 t siden og ikke afsluttet / alle påbegyndte · uge",
        value: s2 ? `${formatCount(toNumber(s2.stale))}/${formatCount(toNumber(s2.started))}` : "—",
        status: statusOf("s2", s2),
      },
      {
        // Needs the phones to report failed outbox rows; nothing does yet, so
        // it is not measured whatever the other sources answered.
        id: "S3",
        name: "Synk der hænger",
        note: "Sync_Outbox-rækker med failed pr. enhed · kræver instrumentering",
        value: "—",
        status: kpiStatus("s3", null),
      },
      {
        id: "S5",
        name: "Versioner i brug",
        note: s5Versions.length > 0 ? versionsNote(s5Versions) : "aktive pr. last_app_version",
        value: s5Versions.length > 0 ? formatCount(s5Versions.length) : "—",
        status: statusOf("s5", s5),
      },
      {
        id: "S9",
        name: "Datakvalitet",
        note: "gennemførte styrketræninger uden sæt · dubletter af sync_id",
        value: s9
          ? `${formatCount(toNumber(s9.strengthWithoutSets))} · ${formatCount(toNumber(s9.duplicateSyncIds))}`
          : "—",
        status: statusOf("s9", s9),
      },
    ],
    growth: [
      {
        id: "S6",
        name: "Ny bruger → første træning",
        note: "konti fra denne uge med en gennemført træning inden for 7 dage",
        value: s6
          ? `${formatCount(toNumber(s6.trainedWithin7d))}/${formatCount(toNumber(s6.newAccounts))}`
          : "—",
        status: statusOf("s6", s6),
      },
      {
        id: "S7",
        name: "Downloads og bedømmelse",
        note:
          storeStats && (storeStats.hasData || storeStats.rating !== null)
            ? `bedømmelse · ${formatCount(storeStats.total)} downloads på 90 dage`
            : "ingen tal fra butikkerne endnu · 90 dage",
        value: formatRating(storeStats?.rating ?? null),
        status: sourceStatus(storeStatsSource, "s7") ?? kpiStatus("s7", storeStats),
        expands: "downloads",
      },
    ],
    development: [
      {
        id: "S1",
        name: "Omarbejde inden for 14 dage",
        note: s1
          ? [
              s1.topFolder ? `mest i ${s1.topFolder}` : null,
              s1Weeks.length > 0 ? `4 uger: ${s1Weeks.map((value) => Math.round(value)).join(" → ")} %` : null,
              measuredNote(s1),
            ]
              .filter(Boolean)
              .join(" · ") || "ændrede linjer under 14 dage gamle"
          : "ændrede linjer under 14 dage gamle · git blame",
        value: formatShare(s1?.percent),
        status: statusOf("s1", s1),
      },
      {
        id: "S8",
        name: "Gammel fejlgæld",
        note: [`åbne issues med ${s8Labels} · antal · ældste`, measuredNote(s8)]
          .filter(Boolean)
          .join(" · "),
        value: s8
          ? `${formatCount(toNumber(s8.open))} · ${formatCount(toNumber(s8.oldestDays))} d`
          : "—",
        status: statusOf("s8", s8),
      },
    ],
    operations: [
      {
        id: "S10",
        name: "Supabase mod planens loft",
        note:
          s10Parts.length > 0
            ? [
                s10ReadAt ? `Aflæst ${formatDayMonth(s10ReadAt)}` : null,
                `${s10Parts.map(([label, value]) => `${label} ${Math.round(value)}`).join(" · ")} %`,
              ]
                .filter(Boolean)
                .join(" · ")
            : "DB, storage, egress og MAU i % af planen · aflæses i Supabase",
        value: formatShare(s10Highest),
        status: statusOf("s10", s10),
        form: isBlocked ? null : "supabaseUsage",
        reading: s10,
      },
    ],
  };

  return SECONDARY_SECTIONS.map((section) => {
    const sectionRows = rows[section.key];
    const statuses = sectionRows.map((row) => row.status);

    return {
      ...section,
      rows: sectionRows,
      status: worst(statuses),
      summary: summarize(statuses),
    };
  });
}

/** The S10 fields as the admin types them: a percentage each, or blank. */
export function parseUsageReading(fields, now = new Date()) {
  const reading = {};
  let typed = 0;

  for (const key of ["db", "storage", "egress", "mau"]) {
    const raw = String(fields[key] ?? "").trim().replace(",", ".");

    if (raw === "") {
      reading[key] = null;
      continue;
    }

    const value = Number(raw);

    if (!Number.isFinite(value) || value < 0 || value > 999) {
      return { error: "Skriv procent som tal, fx 62." };
    }

    reading[key] = value;
    typed += 1;
  }

  if (typed === 0) {
    return { error: "Skriv mindst ét tal." };
  }

  return { reading: { ...reading, readAt: now.toISOString() } };
}

/** The S10 fields filled from the last reading. */
export function usageFields(reading) {
  const field = (value) => {
    const number = toNumber(value);

    return number === null ? "" : String(number).replace(".", ",");
  };

  return {
    db: field(reading?.db),
    storage: field(reading?.storage),
    egress: field(reading?.egress),
    mau: field(reading?.mau),
  };
}
