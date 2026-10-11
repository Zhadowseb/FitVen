import { supabase } from "@database/supaBaseClient";
import { stepsRepository } from "../Repository";
import { addDays, datesBetween, localIsoDate } from "../Utils/dailySteps";
import {
  isMissingDailyStepsTableError,
  normalizeDayRow,
  planCloudMerge,
  planRefresh,
} from "../Utils/dailyStepLog";
import * as healthStepsService from "./healthStepsService";
import * as stepCounterService from "./stepCounterService";

// The one number a day keeps - on the phone (Daily_Steps) and in the cloud
// (public.daily_steps) - and how it gets there. Utils/dailyStepLog.js has the
// rules: the sources are tried best first, never added together, and a worse
// one never replaces a better one.
//
// Reading the sources is what fills the table; the screens read the table. So a
// day stays even when the phone's health app is switched off or has forgotten
// it, and a new phone gets its history back from the cloud.

// A refresh looks this far back each time: ure and health apps hand their
// steps over a little late.
const RECENT_DAYS = 3;
// The first time, as far back as the sources will tell.
const BACKFILL_DAYS = 90;
// And how far back the cloud is asked about when the phones meet.
const CLOUD_WINDOW_DAYS = 120;
const BACKFILL_RETRY_MS = 24 * 60 * 60 * 1000;

const CLOUD_TABLE = "daily_steps";

/* ------------------------------------------------------------------ local -- */

/**
 * Reads the sources for the days and keeps what is better than what is there.
 * Returns { written, answered }: how many days were written, and whether any
 * source could be asked at all (a phone that has not been asked for permission
 * yet answers nothing, and that is not a quiet week).
 */
export async function refreshDailySteps(db, { fromIso, toIso, now = Date.now() }) {
  const [health, motion, rows] = await Promise.all([
    healthStepsService.readDailySteps(fromIso, toIso),
    stepCounterService.readMotionDailySteps(fromIso, toIso),
    stepsRepository.getDailySteps(db, { fromIso, toIso }),
  ]);
  const writes = planRefresh({
    days: datesBetween(fromIso, toIso),
    readings: { health, motion },
    existing: new Map(rows.map((row) => [row.day, row])),
    now,
  });

  for (const write of writes) {
    await stepsRepository.writeDailyStep(db, write);
  }

  return { written: writes.length, answered: health !== null || motion !== null };
}

/**
 * The last few days, and - once, if nothing older was ever kept and a source is
 * answering - the history. A try is only counted when a source answered: the
 * first opening before the question has been asked must not use it up.
 */
export async function refreshRecentDailySteps(db, { now = Date.now() } = {}) {
  const todayIso = localIsoDate(new Date(now));
  const recentFrom = addDays(todayIso, -(RECENT_DAYS - 1));
  const recent = await refreshDailySteps(db, { fromIso: recentFrom, toIso: todayIso, now });
  let written = recent.written;

  if (
    recent.answered &&
    (await stepsRepository.countDailyStepsBefore(db, recentFrom)) === 0 &&
    (await backfillIsDue(db, now))
  ) {
    await stepsRepository.setBackfillTriedAt(db, now);
    written += (
      await refreshDailySteps(db, {
        fromIso: addDays(todayIso, -BACKFILL_DAYS),
        toIso: addDays(recentFrom, -1),
        now,
      })
    ).written;
  }

  return written;
}

// Kept in the person's own database, so another account on the phone is not held
// back by this one having looked.
async function backfillIsDue(db, now) {
  const last = await stepsRepository.getBackfillTriedAt(db);

  return last <= 0 || now - last >= BACKFILL_RETRY_MS;
}

/** The kept days from `fromIso` to `toIso`, as { "2026-10-05": { steps, source } }. */
export async function readDailyStepRows(db, { fromIso, toIso }) {
  const rows = await stepsRepository.getDailySteps(db, { fromIso, toIso });

  return new Map(rows.map((row) => [row.day, { steps: row.steps, source: row.source }]));
}

/* ------------------------------------------------------------------ cloud -- */

// Health data goes up only for somebody who has accepted the policy this build
// carries; the table's own policy refuses a write before any version has been
// accepted, and this asks for the right one.
async function hasAcceptedPolicy(userId, policyVersion) {
  const { data, error } = await supabase
    .from("profile_private")
    .select("privacy_policy_version")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(policyVersion) && data?.privacy_policy_version === policyVersion;
}

/**
 * Meets the cloud: the days it has that this phone does not (a new phone gets
 * its history back), the days where the cloud's number is the better one, and
 * then what this phone has that the cloud does not. Resolves to what was done,
 * or to why nothing was. Never throws for a cloud that is not there yet or a
 * policy that has not been accepted: the days stay on the phone until it is.
 */
export async function syncDailyStepsWithCloud(db, { userId, policyVersion, now = Date.now() }) {
  if (!userId) {
    return { skipped: "signed_out" };
  }

  if (!(await hasAcceptedPolicy(userId, policyVersion))) {
    return { skipped: "policy_not_accepted" };
  }

  const todayIso = localIsoDate(new Date(now));
  const fromIso = addDays(todayIso, -CLOUD_WINDOW_DAYS);
  const { data: cloudRows, error: pullError } = await supabase
    .from(CLOUD_TABLE)
    .select("day, steps, source")
    .eq("user_id", userId)
    .gte("day", fromIso)
    .order("day", { ascending: true });

  if (pullError) {
    if (isMissingDailyStepsTableError(pullError)) {
      return { skipped: "cloud_missing" };
    }

    throw pullError;
  }

  const localRows = await stepsRepository.getDailySteps(db, { fromIso, toIso: todayIso });
  const plan = planCloudMerge({
    local: new Map(localRows.map((row) => [row.day, row])),
    cloud: cloudRows ?? [],
    now,
  });

  for (const write of plan.writeLocal) {
    await stepsRepository.writeDailyStep(db, write);
  }

  // The phone's number won against what the cloud holds: it has to go up.
  for (const day of plan.goUp) {
    const row = localRows.find((entry) => entry.day === day);

    if (row) {
      await stepsRepository.writeDailyStep(db, {
        day,
        steps: row.steps,
        source: row.source,
        updatedAt: row.updated_at,
        needsSync: true,
      });
    }
  }

  const dirty = (await stepsRepository.getDirtyDailySteps(db))
    .map((row) => ({ row, normalized: normalizeDayRow(row) }))
    .filter((entry) => entry.normalized);

  if (dirty.length === 0) {
    return { pulled: plan.writeLocal.length, pushed: 0 };
  }

  const { error: pushError } = await supabase.from(CLOUD_TABLE).upsert(
    dirty.map(({ row, normalized }) => ({
      user_id: userId,
      day: normalized.day,
      steps: normalized.steps,
      source: normalized.source,
      updated_at: new Date(row.updated_at).toISOString(),
    })),
    { onConflict: "user_id,day" }
  );

  if (pushError) {
    if (isMissingDailyStepsTableError(pushError)) {
      return { skipped: "cloud_missing" };
    }

    throw pushError;
  }

  for (const { row } of dirty) {
    await stepsRepository.markDailyStepSynced(db, { day: row.day, updatedAt: row.updated_at });
  }

  return { pulled: plan.writeLocal.length, pushed: dirty.length };
}
