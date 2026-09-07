// Covers the reason a deleted exercise used to come back.
//
// A sync pass fetches the cloud rows first and writes what it found after. On
// the device the two steps straddled the user's delete: the local row was gone
// by 01:41:15, the pass wrote it back at 01:41:16 from a snapshot taken before
// that, and the tombstone only reached the cloud at 01:41:19. Once the row was
// back and something marked it dirty, the next upload cleared the tombstone and
// the delete was undone for good - and the row came back carrying every cloud
// set still pointing at it, including sets it never had.
//
// Two things keep that from happening, and this checks both:
//
//   1. The reconcile reads the delete queue inside the transaction it writes
//      in, not alongside the fetch, so a delete that landed mid-pass counts.
//      It matches on all three identities, because a queued delete may only
//      know one of them.
//   2. Deleting an exercise queues the deletes for its sets too, so the cloud
//      rows beneath it are recorded as gone rather than left live.
//
// The index is read out of the source and run; the ordering and the queueing
// are checked against the source itself, since that is where they broke.

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

const sharedSource = read("src", "Services", "cloudSync", "cloudSyncShared.js");
const exerciseSyncSource = read(
  "src",
  "Services",
  "cloudSync",
  "exerciseInstanceSync.js"
);
const setSyncSource = read("src", "Services", "cloudSync", "setSync.js");
const weightliftingSource = read("src", "Services", "weightliftingService.js");
const programSource = read("src", "Services", "programService.js");

/* --------------------------------------------------------- the index runs -- */

const indexStart = sharedSource.indexOf(
  "export function createPendingDeleteIndex("
);
assert.ok(indexStart !== -1, "createPendingDeleteIndex is gone");

const indexSource = sharedSource.slice(
  indexStart,
  sharedSource.indexOf("\n}", indexStart) + 2
);
const createPendingDeleteIndex = new Function(
  "normalizeOptionalInteger",
  "normalizeSyncId",
  `${indexSource.replace("export function", "function")}
   return createPendingDeleteIndex;`
)(
  (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && value !== null && value !== ""
      ? Math.trunc(parsed)
      : fallback;
  },
  (value) => (typeof value === "string" && value ? value : null)
);

const COLUMNS = {
  cloudIdColumn: "cloud_exercise_instance_id",
  localIdColumn: "remote_local_exercise_instance_id",
};

// What the queue holds after deleting three exercises: one the cloud already
// knows by id, one only this device has ever seen, and one known by sync id.
const queued = [
  {
    cloud_exercise_instance_id: 1691,
    remote_local_exercise_instance_id: 54,
    sync_id: "5f65eaf2-488d-4d79-9c90-bd763649a403",
  },
  {
    cloud_exercise_instance_id: null,
    remote_local_exercise_instance_id: 77,
    sync_id: null,
  },
  {
    cloud_exercise_instance_id: null,
    remote_local_exercise_instance_id: null,
    sync_id: "0f0b7c0e-6d1f-4a63-a0d4-3a2a0dbb5a11",
  },
];
const pending = createPendingDeleteIndex(queued, COLUMNS);

// The row from the device: the reconcile knows it by cloud id, by sync id and
// by the local id the cloud carries. Any one of them must be enough.
assert.ok(
  pending.has({ cloudId: 1691, syncId: null, localId: null }),
  "a queued delete known by cloud id was not recognised"
);
assert.ok(
  pending.has({ cloudId: null, syncId: null, localId: 54 }),
  "a queued delete known by local id was not recognised"
);
assert.ok(
  pending.has({
    cloudId: null,
    syncId: "5f65eaf2-488d-4d79-9c90-bd763649a403",
    localId: null,
  }),
  "a queued delete known by sync id was not recognised"
);
assert.ok(
  pending.has({ cloudId: 9999, syncId: null, localId: 77 }),
  "a delete queued before the row ever reached the cloud was not recognised"
);
assert.ok(
  pending.has({
    cloudId: null,
    syncId: "0f0b7c0e-6d1f-4a63-a0d4-3a2a0dbb5a11",
    localId: null,
  }),
  "a delete carrying only a sync id was not recognised"
);

// And it must not swallow rows the user did not delete.
assert.ok(
  !pending.has({ cloudId: 1692, syncId: "other", localId: 55 }),
  "a row nobody deleted was treated as deleted"
);
assert.ok(
  !pending.has({ cloudId: null, syncId: null, localId: null }),
  "a row with no identity at all matched the queue"
);
assert.ok(
  !pending.has({}),
  "a row with no identity at all matched the queue"
);
assert.ok(
  !createPendingDeleteIndex([], COLUMNS).has({
    cloudId: 1691,
    syncId: "5f65eaf2-488d-4d79-9c90-bd763649a403",
    localId: 54,
  }),
  "an empty queue matched something"
);
assert.ok(
  !createPendingDeleteIndex(null, COLUMNS).has({ cloudId: 1691 }),
  "a missing queue matched something"
);

/* ------------------------------------------- the read happens late enough -- */

/**
 * Where a name first appears inside a named function's body.
 */
function positionInside(source, functionName, needle) {
  const start = source.indexOf(`function ${functionName}(`);
  assert.ok(start !== -1, `${functionName} is gone`);

  // The closing brace of a top-level function, in either line ending.
  const close = /\r?\n\}\r?\n/g;
  close.lastIndex = start;

  const end = close.exec(source);
  assert.ok(end, `${functionName} has no closing brace`);

  const body = source.slice(start, end.index);

  return { at: body.indexOf(needle), body };
}

const RECONCILES = [
  [
    exerciseSyncSource,
    "reconcileExerciseInstancesFromCloud",
    "getQueuedExerciseInstanceDeletes(db)",
  ],
  [setSyncSource, "reconcileSetsFromCloud", "getQueuedSetDeletes(db)"],
];

for (const [source, functionName, queueCall] of RECONCILES) {
  const { at: queueAt, body } = positionInside(source, functionName, queueCall);
  const transactionAt = body.indexOf("withTransaction(db,");

  assert.ok(queueAt !== -1, `${functionName} no longer reads its delete queue`);
  assert.ok(transactionAt !== -1, `${functionName} no longer opens a transaction`);
  assert.ok(
    queueAt > transactionAt,
    `${functionName} reads the delete queue before opening its transaction, so a delete made while the pass was in flight would be missed and the row put back`
  );
  assert.ok(
    /createPendingDeleteIndex\(/.test(body),
    `${functionName} no longer builds a pending-delete index`
  );
  assert.ok(
    /pendingDeletes\.has\(\{[\s\S]*?cloudId:[\s\S]*?syncId:[\s\S]*?localId:/.test(
      body
    ),
    `${functionName} checks the pending deletes by fewer than all three identities`
  );
}

/* ------------------------------------------ the children are queued too -- */

const { at: queueSetsAt, body: deleteExerciseBody } = positionInside(
  weightliftingSource,
  "deleteExercise",
  "queueCloudDeletesForExerciseSets(db, exerciseId)"
);
const removeSetsAt = deleteExerciseBody.indexOf(
  "deleteSetsByExercise(db, exerciseId)"
);

assert.ok(
  queueSetsAt !== -1,
  "deleteExercise no longer records its sets as deleted, so the cloud copies stay live"
);
assert.ok(
  removeSetsAt !== -1,
  "deleteExercise no longer removes the local sets"
);
assert.ok(
  queueSetsAt < removeSetsAt,
  "deleteExercise removes the sets before queueing them, and by then their sync ids are gone"
);

const { at: queueChildrenAt, body: deleteWorkoutBody } = positionInside(
  programSource,
  "deleteWorkout",
  "queueCloudDeletesForWorkoutChildren(db, workoutId)"
);
const removeChildrenAt = deleteWorkoutBody.indexOf(
  "deleteSetsByWorkout(db, workoutId)"
);

assert.ok(
  queueChildrenAt !== -1,
  "deleteWorkout no longer records its exercises and sets as deleted"
);
assert.ok(
  queueChildrenAt < removeChildrenAt,
  "deleteWorkout removes its children before queueing them"
);

// The two queueing helpers must read identities before anything is removed.
for (const helper of [
  "queueCloudDeletesForExerciseSets",
  "queueCloudDeletesForWorkoutChildren",
]) {
  const { body } = positionInside(sharedSource, helper, "");

  assert.ok(
    !/delete[A-Z]\w*\(/.test(body),
    `${helper} deletes rows itself; it must only record what is about to go`
  );
  assert.ok(
    /queue\w*DeleteSync\(/.test(body),
    `${helper} no longer queues anything`
  );
}

console.log(
  "Delete stays deleted: the pending-delete index matches on all three " +
    "identities, both reconciles read the queue inside their transaction, and " +
    "deleting an exercise or a workout records its children first."
);
