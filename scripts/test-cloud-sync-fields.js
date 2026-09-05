// Guards the field tables in src/Services/cloudSync/cloudSyncFields.js.
//
// The failure this exists to catch: a new column is added to the snapshot and
// forgotten in the payload. The field then works perfectly on the phone it was
// written on and disappears on the next one, after the cloud answers, with
// nothing failing anywhere in between. The structure review called it the most
// common mistake in this codebase.
//
// Now that all three uses come from one row per field, that mistake takes the
// shape of a row with the wrong flags on it - which is what these assertions
// look for.

const assert = require("assert");
const loadAppModule = require("./lib/loadAppModule");

const fields = loadAppModule("src/Services/cloudSync/cloudSyncFields.js");
const { SYNCED_FIELDS, buildSnapshot, snapshotsEqual, buildPayloadFields } = fields;

const ENTITIES = [
  "Program",
  "Mesocycle",
  "Microcycle",
  "Day",
  "WorkoutTypeInstance",
  "ExerciseInstance",
  "Set",
];
const PLURAL = {
  Program: "Programs",
  Mesocycle: "Mesocycles",
  Microcycle: "Microcycles",
  Day: "Days",
  WorkoutTypeInstance: "WorkoutTypeInstances",
  ExerciseInstance: "ExerciseInstances",
  Set: "Sets",
};

assert.deepStrictEqual(
  Object.keys(SYNCED_FIELDS).sort(),
  [...ENTITIES].sort(),
  "every synced entity needs a field table"
);

const SAMPLE_VALUES = [
  null, undefined, 0, 1, 3, "0", "1", "", "  ", "text", "  padded  ", true,
  false, "2026-05-18", "18.05.2026", "10:11:12", 1747562972, 1747562972000,
  "Monday", 2.5, '["weight","reps"]', "ACTIVE",
];

let seed = 987654321;
const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = (values) => values[Math.floor(random() * values.length)];

function sampleRow(entity) {
  const row = {};

  for (const field of SYNCED_FIELDS[entity]) {
    if (random() < 0.85) row[field.key] = pick(SAMPLE_VALUES);
  }

  // the sync metadata every payload carries
  row.sync_id = pick([null, "1f2e3d4c-0000-0000-0000-000000000000"]);
  row.sync_version = pick([null, 0, 4, "7"]);
  row.deleted_at = pick([null, "2026-05-18T10:11:12Z"]);
  row.last_updated = "2026-05-18T10:11:12Z";

  return row;
}

for (const entity of ENTITIES) {
  const table = SYNCED_FIELDS[entity];

  assert.ok(table.length > 0, `${entity} has no fields`);

  const keys = table.map((field) => field.key);
  assert.deepStrictEqual(
    keys,
    [...new Set(keys)],
    `${entity} lists the same column twice`
  );

  for (const field of table) {
    assert.strictEqual(
      typeof field.local,
      "function",
      `${entity}.${field.key} has no local normaliser`
    );
    assert.strictEqual(
      typeof field.cloud,
      "function",
      `${entity}.${field.key} has no cloud normaliser`
    );

    // The one that matters: a field that is compared has to reach the cloud,
    // or the comparison sees a change that the upload never sends.
    if (field.compare && !field.inPayload && !field.fromPayloadHead) {
      assert.fail(
        `${entity}.${field.key} is compared but never uploaded - a change to it would sync forever without ever settling`
      );
    }

    // And a compared field has to be in the snapshot, or it is compared
    // against undefined on both sides and never registers a change.
    if (field.compare) {
      assert.ok(
        field.inSnapshot,
        `${entity}.${field.key} is compared but not in the snapshot`
      );
    }
  }

  for (let attempt = 0; attempt < 500; attempt += 1) {
    const row = sampleRow(entity);
    const snapshot = buildSnapshot(entity, row);
    const payload = buildPayloadFields(entity, row);

    assert.deepStrictEqual(
      Object.keys(snapshot).sort(),
      table.filter((f) => f.inSnapshot).map((f) => f.key).sort(),
      `${entity} snapshot does not match its table`
    );
    assert.deepStrictEqual(
      Object.keys(payload).sort(),
      table.filter((f) => f.inPayload).map((f) => f.key).sort(),
      `${entity} payload does not match its table`
    );

    // Normalising an already-normalised value must not change it again, or a
    // row would look dirty every time it is compared to its own upload.
    const renormalised = buildSnapshot(entity, snapshot);
    for (const field of table.filter((f) => f.inSnapshot && f.compare)) {
      assert.deepStrictEqual(
        renormalised[field.key],
        snapshot[field.key],
        `${entity}.${field.key} is not stable under a second normalisation`
      );
    }

    // A row always equals itself, and equality has to agree with the snapshot
    // it is derived from.
    assert.ok(
      snapshotsEqual(entity, row, row),
      `${entity} does not equal itself`
    );

    const other = sampleRow(entity);
    const comparedKeys = table.filter((f) => f.compare).map((f) => f.key);
    const otherSnapshot = buildSnapshot(entity, other);
    const expected = comparedKeys.every(
      (key) => snapshot[key] === otherSnapshot[key]
    );
    assert.strictEqual(
      snapshotsEqual(entity, row, other),
      expected,
      `${entity} equality disagrees with its own snapshot`
    );
  }

  // the derived functions the rest of the engine calls
  assert.strictEqual(
    typeof fields[`getComparable${entity}Snapshot`],
    "function",
    `${entity} snapshot function is missing`
  );
  assert.strictEqual(
    typeof fields[`areComparable${PLURAL[entity]}Equal`],
    "function",
    `${entity} equality function is missing`
  );
  assert.strictEqual(
    typeof fields[`buildCloud${entity}Payload`],
    "function",
    `${entity} payload function is missing`
  );
}

console.log(
  `Cloud sync field table checks passed (${ENTITIES.length} entities, ` +
    `${ENTITIES.reduce((sum, e) => sum + SYNCED_FIELDS[e].length, 0)} fields).`
);
