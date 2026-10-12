import { Platform } from "react-native";

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

// A refresh looks this far back each time: watches and health apps hand their
// steps over a little late.
const RECENT_DAYS = 3;
// The first time a source answers, as far back as it will tell. Health Connect
// only shows the 30 days before the permission was first given, so Android asks
// for less than that rather than for something it may refuse; the iPhone's own
// motion history is a week.
const backfillDays = (source) => (source === "health" ? (Platform.OS === "android" ? 29 : 90) : 6);
// And how far back the cloud is asked about when the phones meet.
const CLOUD_WINDOW_DAYS = 120;

const CLOUD_TABLE = "daily_steps";

/* ------------------------------------------------------------------ local -- */

const SOURCE_READERS = {
  health: (fromIso, toIso) => healthStepsService.readDailySteps(fromIso, toIso),
  motion: (fromIso, toIso) => stepCounterService.readMotionDailySteps(fromIso, toIso),
};

/**
 * Reads the sources for the days and keeps what is better than what is there.
 * Returns { written, answered } - how many days were written, and which sources
 * could be asked at all (one that has not been given permission answers nothing,
 * and that is not a quiet week).
 *
 * Nothing is read until the person has said yes to their steps being read (the
 * Allow on the steps card or page): the motion permission may have been given
 * for a walk, and that is not a yes to the whole day.
 */
export async function refreshDailySteps(db, { fromIso, toIso, sources = Object.keys(SOURCE_READERS), now = Date.now() }) {
  const none = { written: 0, answered: { health: false, motion: false } };

  if (!(await stepsRepository.getStepsEnabled(db))) {
    return none;
  }

  const [readings, rows] = await Promise.all([
    Promise.all(sources.map((source) => SOURCE_READERS[source](fromIso, toIso))),
    stepsRepository.getDailySteps(db, { fromIso, toIso }),
  ]);
  const byName = Object.fromEntries(sources.map((source, index) => [source, readings[index]]));
  const writes = planRefresh({
    days: datesBetween(fromIso, toIso),
    readings: byName,
    existing: new Map(rows.map((row) => [row.day, row])),
    now,
  });

  for (const write of writes) {
    await stepsRepository.writeDailyStep(db, write);
  }

  return {
    written: writes.length,
    answered: { health: byName.health != null, motion: byName.motion != null },
  };
}

/**
 * The last few days, and - once for each source, the first time it answers - its
 * history. That is per source and not "when the table is empty": a better source
 * that comes later (Apple Health turned on after the phone's motion history
 * had filled the table, or a new phone that got its days from the cloud before
 * the health app was allowed) still gets its history read. A source is only
 * marked done when it answered, so a first opening before the question has been
 * asked uses nothing up.
 */
export async function refreshRecentDailySteps(db, { now = Date.now() } = {}) {
  const todayIso = localIsoDate(new Date(now));
  const recentFrom = addDays(todayIso, -(RECENT_DAYS - 1));
  const recent = await refreshDailySteps(db, { fromIso: recentFrom, toIso: todayIso, now });
  let written = recent.written;

  for (const source of Object.keys(SOURCE_READERS)) {
    if (!recent.answered[source] || (await stepsRepository.getBackfillDoneAt(db, source)) > 0) {
      continue;
    }

    const result = await refreshDailySteps(db, {
      fromIso: addDays(todayIso, -backfillDays(source)),
      toIso: addDays(recentFrom, -1),
      sources: [source],
      now,
    });

    written += result.written;

    // Only a read that really answered counts: a window the source refuses is
    // tried again next time, not marked done.
    if (result.answered[source]) {
      await stepsRepository.setBackfillDoneAt(db, source, now);
    }
  }

  return written;
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
