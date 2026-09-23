// Set types: the rules, and every place a set is written.
//
// `set_type` is the one truth about what kind of set a set is, and `amrap` is
// kept as its mirror for older app versions. Two columns that must never
// disagree are exactly the kind of thing that drifts one write at a time, so
// this drives every repository function that writes a set against the real
// schema in an in-memory SQLite - a placeholder count off by one would only
// otherwise show up on a phone.

const assert = require("assert");
const { DatabaseSync } = require("node:sqlite");
const loadAppModule = require("./lib/loadAppModule");

const types = loadAppModule("src/Utils/setTypes.js");
const repository = loadAppModule("src/Repository/weightliftingRepository.js");
const { weightliftingSchemaSql } = loadAppModule("src/Database/schema/weightlifting.js");

/* -------------------------------------------------------------- the rule -- */

// set_type wins - except a working set with the flag up, which can only have
// been written by a client that did not know set_type existed.
assert.strictEqual(types.resolveSetType({ set_type: "warmup", amrap: 0 }), "warmup");
assert.strictEqual(types.resolveSetType({ set_type: "drop", amrap: 1 }), "drop");
assert.strictEqual(
  types.resolveSetType({ set_type: "working", amrap: 1 }),
  "amrap",
  "an AMRAP set from an older client is read as a working set, so its AMRAP is lost"
);
assert.strictEqual(
  types.resolveSetType({ amrap: 1 }),
  "amrap",
  "a row with no set_type at all loses its AMRAP"
);
assert.strictEqual(types.resolveSetType({}), "working");
assert.strictEqual(
  types.resolveSetType({ set_type: "superset" }),
  "working",
  "a type this client does not know turns a real set into something it is not"
);

assert.strictEqual(types.amrapFlagFor("amrap"), 1);
assert.strictEqual(types.amrapFlagFor("drop"), 0);

// What a type is allowed to do.
assert.strictEqual(types.countsTowardVolume("warmup"), false, "a warm-up counts toward volume");
assert.strictEqual(types.countsTowardVolume("drop"), true);
assert.strictEqual(types.canBePersonalRecord("warmup"), false, "a warm-up can hold a record");
assert.strictEqual(types.canBePersonalRecord("drop"), false, "a drop set can hold a record");
assert.strictEqual(types.canBePersonalRecord("amrap"), true);
assert.strictEqual(types.canBePersonalRecord("working"), true);

/* ------------------------------------------------------- the numbering -- */

// Warm-ups count on their own, so adding one does not renumber the work. A
// drop set counts from its parent and starts again under the next one.
const sequence = [
  { set_type: "warmup" },
  { set_type: "warmup" },
  { set_type: "working" },
  { set_type: "drop" },
  { set_type: "drop" },
  { set_type: "working", amrap: 1 },
  { set_type: "drop" },
];

assert.deepStrictEqual(
  types.labelSets(sequence).map((entry) => entry.label),
  ["W1", "W2", "1", "D1", "D2", "2", "D1"],
  "the set badges are numbered wrongly"
);

// Warm-ups rise to the top; everything else keeps its order, so a drop set
// stays directly under the set it drops from.
const shuffled = [
  { id: "a", set_type: "working" },
  { id: "b", set_type: "drop" },
  { id: "w1", set_type: "warmup" },
  { id: "c", set_type: "working" },
  { id: "w2", set_type: "warmup" },
];

assert.deepStrictEqual(
  types.orderSetsForDisplay(shuffled).map((set) => set.id),
  ["w1", "w2", "a", "b", "c"],
  "warm-ups do not sort first, or the rest lost their order"
);

// A drop set is shown against the weight of the set it drops from.
const drops = [
  { set_type: "working", weight: 87.5 },
  { set_type: "drop", weight: 70 },
  { set_type: "drop", weight: 60 },
];

assert.strictEqual(types.dropParentWeight(drops, 1), 87.5);
assert.strictEqual(
  types.dropParentWeight(drops, 2),
  87.5,
  "a second drop set compares against the drop above it rather than the working set"
);
assert.strictEqual(types.dropParentWeight(drops, 0), null, "a working set has a drop parent");
assert.strictEqual(
  types.dropParentWeight([{ set_type: "warmup", weight: 40 }, { set_type: "drop", weight: 30 }], 1),
  null,
  "a drop set under a warm-up drops from it"
);

/* ------------------------------------------------ every write, for real -- */

const raw = new DatabaseSync(":memory:");
raw.exec(weightliftingSchemaSql);

const db = {
  runAsync: async (sql, params = []) => {
    const result = raw.prepare(sql).run(...params);

    return { lastInsertRowId: Number(result.lastInsertRowid), changes: result.changes };
  },
  getAllAsync: async (sql, params = []) => raw.prepare(sql).all(...params),
  getFirstAsync: async (sql, params = []) => raw.prepare(sql).get(...params) ?? null,
};

const read = (id) =>
  raw.prepare('SELECT set_type, amrap, amrap_target FROM "Set" WHERE sets_id = ?').get(id);

function assertConsistent(id, expectedType, label) {
  const row = read(id);

  assert.strictEqual(row.set_type, expectedType, `${label}: set_type is ${row.set_type}`);
  assert.strictEqual(
    Number(row.amrap),
    expectedType === "amrap" ? 1 : 0,
    `${label}: amrap is ${row.amrap} beside set_type ${row.set_type} - the mirror and the truth disagree`
  );
}

(async () => {
  // createSet - the app's own writes.
  const plain = await repository.createSet(db, { setNumber: 1, exerciseId: 1 });
  assertConsistent(plain.lastInsertRowId, "working", "createSet with nothing");

  const warmup = await repository.createSet(db, { setNumber: 2, exerciseId: 1, setType: "warmup" });
  assertConsistent(warmup.lastInsertRowId, "warmup", "createSet as a warm-up");

  const legacy = await repository.createSet(db, { setNumber: 3, exerciseId: 1, amrap: 1 });
  assertConsistent(legacy.lastInsertRowId, "amrap", "createSet from a caller that only knows the flag");

  const target = await repository.createSet(db, {
    setNumber: 4,
    exerciseId: 1,
    setType: "amrap",
    amrapTarget: 6,
  });
  assert.strictEqual(read(target.lastInsertRowId).amrap_target, 6, "the AMRAP target was not stored");

  const strayTarget = await repository.createSet(db, {
    setNumber: 5,
    exerciseId: 1,
    setType: "drop",
    amrapTarget: 6,
  });
  assert.strictEqual(
    read(strayTarget.lastInsertRowId).amrap_target,
    null,
    "a target was stored on a set that is not AMRAP"
  );

  // createSetFromCloud - what a pull writes.
  const fromCloud = await repository.createSetFromCloud(db, {
    cloudSetId: 10,
    remoteLocalSetId: 10,
    syncId: "s-10",
    syncVersion: 1,
    deletedAt: null,
    exerciseId: 1,
    setNumber: 6,
    personalRecord: 0,
    pause: null,
    rpe: null,
    weight: 80,
    rmPercentage: null,
    reps: 8,
    done: 1,
    failed: 0,
    amrap: 0,
    setType: "drop",
    amrapTarget: null,
    note: null,
  });
  assertConsistent(fromCloud.lastInsertRowId, "drop", "createSetFromCloud");

  // An older client in the cloud wrote only the flag.
  const oldClient = await repository.createSetFromCloud(db, {
    cloudSetId: 11,
    remoteLocalSetId: 11,
    syncId: "s-11",
    syncVersion: 1,
    deletedAt: null,
    exerciseId: 1,
    setNumber: 7,
    personalRecord: 0,
    pause: null,
    rpe: null,
    weight: 80,
    rmPercentage: null,
    reps: 8,
    done: 1,
    failed: 0,
    amrap: 1,
    setType: "working",
    amrapTarget: null,
    note: null,
  });
  assertConsistent(oldClient.lastInsertRowId, "amrap", "createSetFromCloud from an older client");

  // updateSetFromCloud.
  await repository.updateSetFromCloud(db, {
    setId: fromCloud.lastInsertRowId,
    cloudSetId: 10,
    remoteLocalSetId: 10,
    syncId: "s-10",
    syncVersion: 2,
    deletedAt: null,
    exerciseId: 1,
    setNumber: 6,
    personalRecord: 0,
    pause: null,
    rpe: null,
    weight: 80,
    rmPercentage: null,
    reps: 8,
    done: 1,
    failed: 0,
    amrap: 0,
    setType: "warmup",
    amrapTarget: null,
    note: null,
  });
  assertConsistent(fromCloud.lastInsertRowId, "warmup", "updateSetFromCloud");

  // updateSetByExerciseAndNumber - turning AMRAP off must take the type with it.
  await repository.updateSetByExerciseAndNumber(db, {
    exerciseId: 1,
    setNumber: 4,
    pause: null,
    rpe: null,
    weight: 80,
    rmPercentage: null,
    reps: 8,
    done: 1,
    failed: 0,
    amrap: 0,
    setType: "working",
    note: null,
  });
  assertConsistent(target.lastInsertRowId, "working", "updateSetByExerciseAndNumber");
  assert.strictEqual(
    read(target.lastInsertRowId).amrap_target,
    null,
    "the AMRAP target survived the set stopping being AMRAP"
  );

  // updateSetType - the only way the type sheet changes a set.
  const typed = await repository.createSet(db, {
    setNumber: 8,
    exerciseId: 1,
    setType: "amrap",
    amrapTarget: 6,
  });

  await repository.updateSetType(db, { setId: typed.lastInsertRowId, setType: "warmup" });
  assertConsistent(typed.lastInsertRowId, "warmup", "updateSetType to a warm-up");
  assert.strictEqual(
    read(typed.lastInsertRowId).amrap_target,
    null,
    "a set that stopped being AMRAP kept its target"
  );

  await repository.updateSetType(db, {
    setId: typed.lastInsertRowId,
    setType: "amrap",
    amrapTarget: 8,
  });
  assertConsistent(typed.lastInsertRowId, "amrap", "updateSetType back to AMRAP");
  assert.strictEqual(read(typed.lastInsertRowId).amrap_target, 8);

  await repository.updateSetType(db, { setId: typed.lastInsertRowId, setType: "nonsense" });
  assertConsistent(
    typed.lastInsertRowId,
    "working",
    "updateSetType with a value it does not know"
  );

  console.log(
    "Set types: the rule, the numbering, the order, drop parents, and every write keeping set_type and amrap in step passed."
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
