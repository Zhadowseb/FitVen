import { runningRepository } from "../Repository";
import { withTransaction } from "./shared";

const RUN_WORKING_SET_TYPE = "WORKING_SET";
const AUTO_PAUSE_AFTER_SET_NUMBER = 2;

function normalizeRunSetType(type) {
  const normalizedType = String(type ?? "")
    .trim()
    .replace(/[- ]/g, "_")
    .toUpperCase();

  if (normalizedType === "WARMUP" || normalizedType === "WARM_UP") {
    return "WARMUP";
  }

  if (normalizedType === "COOLDOWN" || normalizedType === "COOL_DOWN") {
    return "COOLDOWN";
  }

  return RUN_WORKING_SET_TYPE;
}

function shouldAddAutomaticPause({ type, setNumber }) {
  return (
    normalizeRunSetType(type) === RUN_WORKING_SET_TYPE &&
    setNumber === AUTO_PAUSE_AFTER_SET_NUMBER
  );
}

export async function getRunSets(db, { workoutId, type }) {
  return runningRepository.getRunSets(db, { workoutId, type });
}

export async function getOrderedRunSetsForWorkout(db, workoutId) {
  return runningRepository.getOrderedRunSetsForWorkout(db, workoutId);
}

export async function addRunSet(db, { workoutId, type }) {
  await withTransaction(db, async () => {
    const row = await runningRepository.countActiveRunSets(db, {
      workoutId,
      type,
    });
    const nextSetNumber = (row?.count ?? 0) + 1;

    await runningRepository.createRunSet(db, {
      workoutId,
      type,
      setNumber: nextSetNumber,
    });

    if (shouldAddAutomaticPause({ type, setNumber: nextSetNumber })) {
      await runningRepository.createRunSet(db, {
        workoutId,
        type,
        setNumber: nextSetNumber,
        isPause: 1,
      });
    }
  });
}

export async function updateRunSetField(db, { runId, field, value }) {
  await runningRepository.updateRunSetField(db, { runId, field, value });
}

export async function updateRunSetDone(db, { runId, done }) {
  await runningRepository.updateRunSetDone(db, { runId, done });
}

export async function renumberWorkingRunSets(db, { workoutId, type }) {
  const rows = await runningRepository.getRunSets(db, { workoutId, type });

  let counter = 1;
  for (const row of rows) {
    if (!row.is_pause) {
      await runningRepository.updateRunSetNumber(db, {
        runId: row.Run_id,
        setNumber: counter,
      });
      counter += 1;
    }
  }
}

export async function deleteRunSet(db, { runId, workoutId, type }) {
  await withTransaction(db, async () => {
    await runningRepository.deleteRunSetById(db, runId);
    await renumberWorkingRunSets(db, { workoutId, type });
  });
}

export async function toggleRunSetPause(
  db,
  { runId, workoutId, type, isPause }
) {
  await withTransaction(db, async () => {
    await runningRepository.updateRunSetPause(db, { runId, isPause });
    await renumberWorkingRunSets(db, { workoutId, type });
  });
}
