// Everything the dev dashboard reads. Nothing else uses this file.
//
// Every function here is guarded on the server as well as here: `is_admin` on
// `profile_private`, the policies on `Feedback` and `store_stats`, and the
// admin check inside `admin_active_users`. The checks in this file exist so the
// screen can say "you are not an admin" instead of showing five empty boxes -
// they are not what stops a non-admin reading the data. A hidden button is not
// access control.
//
// The sums live in `@utils/devDashboard`, which a test can load; this file
// imports the Supabase client and therefore react-native, and nothing that
// does can be driven by `npm test`.
import { supabase } from "@database/supaBaseClient";
import {
  DEFAULT_DEV_DASHBOARD_PERIOD,
  buildStoreStats,
  getPeriodDays,
} from "@utils/devDashboard";

const FEEDBACK_TABLE = "Feedback";
const PROFILE_PRIVATE_TABLE = "profile_private";
const STORE_STATS_TABLE = "store_stats";

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
 * `null` totals mean the store keys have never been set and the table is empty,
 * which the screen draws as an em dash. Zero means the stores answered and the
 * answer was zero. Those are different things and the dashboard says so.
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

/**
 * The three numbers under the chart.
 *
 * `crashFreePercent` is always null. The privacy policy says in as many words
 * that FitVen carries no crash reporting, so there is no number to read - and
 * the design document asks for an em dash rather than a guess in exactly this
 * case. It stays in the shape so the box does not have to change when that
 * decision does.
 */
export async function getOpsStats(periodKey = DEFAULT_DEV_DASHBOARD_PERIOD) {
  const [activeUsers, storeStats] = await Promise.all([
    getActiveUsers(),
    getStoreStats(periodKey),
  ]);

  return {
    activeToday: activeUsers,
    crashFreePercent: null,
    rating: storeStats.rating,
  };
}

async function getActiveUsers() {
  const { data, error } = await supabase.rpc("admin_active_users", {
    window_days: 1,
  });

  if (error) {
    return null;
  }

  return typeof data === "number" ? data : null;
}

/**
 * Newest first, always. Unread are not floated to the top: a list that reorders
 * itself as it is read cannot be worked through.
 */
export async function getFeedback({ limit = 20, cursor = null } = {}) {
  let query = supabase
    .from(FEEDBACK_TABLE)
    .select("id, user_id, message, kind, os, device, app_version, read_at, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error, count } = await query;

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
      createdAt: row.created_at ?? null,
      senderName: senderNames.get(row.user_id) ?? null,
    })),
    total: typeof count === "number" ? count : rows.length,
    nextCursor: rows.length === limit ? rows[rows.length - 1]?.created_at ?? null : null,
  };
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
