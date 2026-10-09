// Everything the dev dashboard reads. Nothing else uses this file.
//
// Every function here is guarded on the server as well as here: `is_admin` on
// `profile_private`, the policies on `Feedback`, `store_stats` and
// `dev_metrics`, and the admin check inside every `admin_*` function. The
// checks in this file exist so the screen can say "you are not an admin"
// instead of showing five empty boxes - they are not what stops a non-admin
// reading the data. A hidden button is not access control.
//
// The sums and the shapes live in `@utils/devDashboard`, which a test can
// load; this file imports the Supabase client and therefore react-native, and
// nothing that does can be driven by `npm test`.
//
// The overview's reads (getUserTotals to getSecondaryKpis) each stand alone:
// the page loads them with Promise.allSettled, so one that fails greys out its
// own tiles and nothing else. Each throws the server's error when it fails,
// and answers { unavailable: true } instead when what it reads has not been
// migrated yet (supabase/migrations/20261001090000_dev-kpis.sql).
import { t } from "@localization";
import { supabase } from "@database/supaBaseClient";
import {
  DEFAULT_DEV_DASHBOARD_PERIOD,
  FEEDBACK_STATUSES,
  buildStoreStats,
  buildSupabaseUsageValue,
  getPeriodDays,
  isMissingMigrationError,
  shapeBugReports,
  shapeFeatureUsage,
  shapeReleaseLag,
  shapeSecondaryKpis,
  shapeStartedFrom,
  shapeStoreHealth,
  shapeTrainingKpis,
  shapeUserTotals,
} from "@utils/devDashboard";

const FEEDBACK_TABLE = "Feedback";
const PROFILE_PRIVATE_TABLE = "profile_private";
const STORE_STATS_TABLE = "store_stats";
const DEV_METRICS_TABLE = "dev_metrics";

// The fixed windows the overview shows. Each number has its own; there is no
// period picker any more.
const STARTED_FROM_DAYS = 28;
const FEATURE_USAGE_DAYS = 28;
const BUG_REPORT_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export const FEEDBACK_KINDS = ["bug", "idea", "praise", "other"];

function toIsoDay(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Whether this account may open the dashboard.
 *
 * A row that does not exist, a column that has not been migrated yet and a
 * request that fails all mean the same thing here: no. The dashboard is not
 * worth an error message on the profile screen of somebody who will never open
 * it.
 */
export async function getIsAdmin({ user }) {
  if (!user?.id) {
    return false;
  }

  const { data, error } = await supabase
    .from(PROFILE_PRIVATE_TABLE)
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return false;
  }

  return data?.is_admin === true;
}

/**
 * Downloads per platform over the period, with the buckets the chart draws.
 *
 * A `null` total means that store has no rows in the period - no fetcher yet
 * (Google Play), keys not set, or no sale to report (the App Store, until the
 * app is released) - which the screen draws as an em dash. Zero means the
 * store answered and the answer was zero. Those are different things and the
 * dashboard says so.
 */
export async function getStoreStats(periodKey = DEFAULT_DEV_DASHBOARD_PERIOD) {
  const days = getPeriodDays(periodKey);
  const now = Date.now();

  let query = supabase
    .from(STORE_STATS_TABLE)
    .select("day, platform, downloads, rating, rating_count")
    .order("day", { ascending: true });

  if (days !== null) {
    // Two periods back: the boxes compare this one against the one before it.
    query = query.gte("day", toIsoDay(new Date(now - 2 * days * DAY_MS)));
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return buildStoreStats(data ?? [], { days, now });
}

/* ---------------------------------------------------------- the overview -- */

const unavailable = () => ({ unavailable: true });

/**
 * One admin function's answer, shaped. A function that is not there yet, and
 * an answer that is not an object, are both "not connected"; anything else
 * that goes wrong - a non-admin, a timeout - is thrown with the server's own
 * message.
 */
async function readOverviewRpc(name, args, shape) {
  const { data, error } = args
    ? await supabase.rpc(name, args)
    : await supabase.rpc(name);

  if (error) {
    if (isMissingMigrationError(error)) {
      return unavailable();
    }

    throw error;
  }

  return data && typeof data === "object" && !Array.isArray(data)
    ? shape(data)
    : unavailable();
}

/** §3: downloads and active users, Apple | Android | Total. */
export function getUserTotals() {
  return readOverviewRpc("admin_user_totals", null, shapeUserTotals);
}

/** KPI-1, 2 and 3 with their series, oldest point first. */
export function getTrainingKpis() {
  return readOverviewRpc("admin_training_kpis", null, shapeTrainingKpis);
}

/** "Startet fra": finished workouts in the last 28 days by where they began. */
export function getStartedFrom() {
  return readOverviewRpc(
    "admin_started_from",
    { days: STARTED_FROM_DAYS },
    shapeStartedFrom
  );
}

/** KPI-4: each feature's share of the active users, with its commits. */
export function getFeatureUsage() {
  return readOverviewRpc(
    "admin_feature_usage",
    { days: FEATURE_USAGE_DAYS },
    (data) => shapeFeatureUsage(data, Date.now())
  );
}

/** KPI-5b: bug reports this week per app version. */
export function getBugReports() {
  return readOverviewRpc(
    "admin_bug_reports",
    { days: BUG_REPORT_DAYS },
    shapeBugReports
  );
}

/** S1 to S10. S3 is always null: nothing reports it yet. */
export function getSecondaryKpis() {
  return readOverviewRpc("admin_secondary_kpis", null, shapeSecondaryKpis);
}

const MISSING = Symbol("missing");

// The newest row that carries a rate, which need not be the newest row: the
// downloads are written every day, the rates only when something measures
// them.
async function readLatestHealthRow(platform) {
  const { data, error } = await supabase
    .from(STORE_STATS_TABLE)
    .select("day, crash_rate, anr_rate, measured_at")
    .eq("platform", platform)
    .or("crash_rate.not.is.null,anr_rate.not.is.null")
    .order("day", { ascending: false })
    .limit(1);

  if (error) {
    if (isMissingMigrationError(error)) {
      return MISSING;
    }

    throw error;
  }

  return data?.[0] ?? null;
}

/**
 * KPI-5a, read straight from store_stats under its admin-only policy. A
 * platform with no measured rate is null, and so is every platform today:
 * nothing writes the rates yet.
 */
export async function getStoreHealth() {
  const [ios, android] = await Promise.all([
    readLatestHealthRow("ios"),
    readLatestHealthRow("android"),
  ]);

  if (ios === MISSING || android === MISSING) {
    return unavailable();
  }

  return shapeStoreHealth({ ios, android });
}

/**
 * KPI-6, read straight from dev_metrics under its admin-only policy. A
 * platform is null until the Action has written it; its `days` is null until
 * that platform has a store tag.
 */
export async function getReleaseLag() {
  const { data, error } = await supabase
    .from(DEV_METRICS_TABLE)
    .select("platform, value, measured_at")
    .eq("key", "release_lag");

  if (error) {
    if (isMissingMigrationError(error)) {
      return unavailable();
    }

    throw error;
  }

  return shapeReleaseLag(data ?? []);
}

/**
 * S10: the Supabase usage the admin read off the dashboard, as percentages of
 * the plan. One row, overwritten each time. Answers what was stored, or
 * { unavailable: true } when dev_metrics has not been migrated.
 */
export async function setSupabaseUsage({ db, storage, egress, mau, readAt } = {}) {
  const value = buildSupabaseUsageValue({ db, storage, egress, mau, readAt });
  const { error } = await supabase.from(DEV_METRICS_TABLE).upsert(
    {
      key: "supabase_usage",
      platform: "all",
      value,
      measured_at: new Date().toISOString(),
    },
    { onConflict: "key,platform" }
  );

  if (error) {
    if (isMissingMigrationError(error)) {
      return unavailable();
    }

    throw error;
  }

  return value;
}

/**
 * Newest first, always. Unread are not floated to the top: a list that reorders
 * itself as it is read cannot be worked through.
 */
export async function getFeedback({ limit = 20, cursor = null } = {}) {
  let query = supabase
    .from(FEEDBACK_TABLE)
    .select(
      "id, user_id, message, kind, os, device, app_version, read_at, status, status_changed_at, created_at"
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  // The cursor is (created_at, id), not the timestamp alone. `created_at` was
  // added to a table that already had rows, and Postgres evaluates the default
  // once for the whole `alter table` - so every message sent before that
  // migration carries the same instant. A `lt` on the timestamp alone returns
  // nothing for the second page, because the rest are equal to the cursor
  // rather than less than it, and the history becomes unreachable at row 20.
  if (cursor?.createdAt) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},` +
        `and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
    );
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const rows = data ?? [];
  const senderNames = await getSenderNames(rows);

  return {
    rows: rows.map((row) => ({
      id: row.id,
      kind: FEEDBACK_KINDS.includes(row.kind) ? row.kind : "other",
      message: row.message ?? "",
      appVersion: row.app_version ?? null,
      os: row.os ?? null,
      device: row.device ?? null,
      readAt: row.read_at ?? null,
      // A row written before the status migration has no value; it has not
      // been decided about, which is what `new` means.
      status: FEEDBACK_STATUSES.includes(row.status) ? row.status : "new",
      createdAt: row.created_at ?? null,
      senderName: senderNames.get(row.user_id) ?? null,
    })),
    // Counted over the whole table, not over the page's own filter. The count
    // used to ride along on the same filtered request, so paging turned
    // "47 in all" into "0 in all" on the second page.
    total: await countFeedback(),
    nextCursor:
      rows.length === limit && rows[rows.length - 1]
        ? {
            createdAt: rows[rows.length - 1].created_at,
            id: rows[rows.length - 1].id,
          }
        : null,
  };
}

async function countFeedback() {
  const { count, error } = await supabase
    .from(FEEDBACK_TABLE)
    .select("id", { count: "exact", head: true });

  return error ? 0 : count ?? 0;
}

// One request for every name on the page rather than an embedded join: the
// foreign key is `on delete set null`, so a message from a deleted account has
// no profile to join to and an inner join would drop the message itself.
async function getSenderNames(rows) {
  const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];

  if (userIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .in("id", userIds);

  if (error) {
    return new Map();
  }

  return new Map(
    (data ?? []).map((profile) => [
      profile.id,
      profile.display_name || profile.username || null,
    ])
  );
}

export async function getUnreadFeedbackCount() {
  const { count, error } = await supabase
    .from(FEEDBACK_TABLE)
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

/**
 * What was decided about a message.
 *
 * Setting a status also marks the message read: deciding about something you
 * have not looked at is not a thing, and leaving it unread would keep it in
 * the header's count after it had been dealt with.
 */
export async function setFeedbackStatus(id, status) {
  if (!FEEDBACK_STATUSES.includes(status)) {
    throw new Error(t("errors.admin.unknownFeedbackStatus", { status }));
  }

  const { error } = await supabase
    .from(FEEDBACK_TABLE)
    .update({
      status,
      status_changed_at: new Date().toISOString(),
      read_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function markFeedbackRead(id) {
  const { error } = await supabase
    .from(FEEDBACK_TABLE)
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);

  if (error) {
    throw error;
  }
}
