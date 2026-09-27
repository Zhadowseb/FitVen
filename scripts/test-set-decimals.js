// A set keeps its decimals: 102.5 kg, 11.25 kg a side, RPE 8.5.
//
// The cloud sync used to cut a set's weight and RPE to whole numbers on the
// way up (field("weight", int())), because the cloud columns were integers.
// 20261003090000_a-set-keeps-its-decimals.sql makes them numeric, and the app
// can reach users before that has run. Three things can go wrong, and each
// is checked here:
//
//   1. The normaliser truncates again, and the decimals are lost as before.
//   2. Before the migration, the integer column refuses "102.5" (22P02). If
//      the upload does not fall back to the old truncation, that one set
//      fails the whole set sync, for good.
//   3. The comparison sees 102.5 on the phone against 102 in the cloud as a
//      change. Then every pull overwrites the phone's 102.5 with 102 - the
//      data loss this fixes, moved to the phone - or the two sides never
//      settle and the sync uploads the same set forever.
//
// Part one is the pure helpers (Utils/setDecimals.js) and the field table.
// Part two runs the real setSync.js against the real local schema in
// node:sqlite and an in-memory cloud that behaves like the integer column
// before the migration and like numeric after it.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");

/* ================================================= part one: the helpers == */

const decimals = loadAppModule("src/Utils/setDecimals.js");
const fields = loadAppModule("src/Services/cloudSync/cloudSyncFields.js");
const {
  SET_DECIMAL_FIELDS,
  createSetDecimalsCloudColumns,
  hasSetDecimals,
  hasTruncatedSetDecimals,
  isSetDecimalsRefusedError,
  isTruncatedCopy,
  normalizeSetDecimal,
  resolveCloudSetDecimals,
  truncateSetDecimals,
} = decimals;

assert.deepStrictEqual([...SET_DECIMAL_FIELDS], ["weight", "rpe"]);

/* ------------------------------------------------------- the normaliser -- */

for (const [value, expected] of [
  [102.5, 102.5],
  [11.25, 11.25],
  [8.5, 8.5],
  [100, 100],
  [0, 0],
  ["102.5", 102.5],
  [" 97.5 ", 97.5],
  [102.3, 102.3],
  [11.255, 11.26],
  [20.004, 20],
  [1000, 1000],
  [null, null],
  [undefined, null],
  ["", null],
  ["kg", null],
  [Number.NaN, null],
  [Number.POSITIVE_INFINITY, null],
]) {
  assert.strictEqual(
    normalizeSetDecimal(value),
    expected,
    `normalizeSetDecimal(${JSON.stringify(value)})`
  );
}

assert.ok(Object.is(normalizeSetDecimal(-0), 0), "-0 would reach a payload as -0");
assert.ok(Object.is(normalizeSetDecimal(-0.001), 0));

// Stable under a second pass, or a set would look changed against its own
// upload on every comparison.
for (let step = 0; step < 5000; step += 1) {
  const value = (step * 7919) / 1000 - 3;
  const once = normalizeSetDecimal(value);
  assert.strictEqual(normalizeSetDecimal(once), once, `${value} is not stable`);
  assert.ok(Math.abs(once - value) <= 0.005 + 1e-9, `${value} moved to ${once}`);
}

/* ------------------------------------------------------ the field table -- */

const setFields = Object.fromEntries(fields.SYNCED_FIELDS.Set.map((field) => [field.key, field]));

for (const key of SET_DECIMAL_FIELDS) {
  assert.strictEqual(setFields[key].local, normalizeSetDecimal, `Set.${key} is not read with its decimals`);
  assert.strictEqual(setFields[key].cloud, normalizeSetDecimal, `Set.${key} is not uploaded with its decimals`);
  assert.ok(setFields[key].compare && setFields[key].inPayload, `Set.${key} has to be compared and uploaded`);
}

const loggedSet = {
  set_number: 1,
  weight: 102.5,
  rpe: 8.5,
  rm_percentage: 82.6,
  reps: 3,
  pause: 90.9,
  amrap_target: 8.2,
  done: 1,
};

assert.deepStrictEqual(
  pick(fields.buildCloudSetPayload(loggedSet, "user", 7), ["weight", "rpe", "rm_percentage", "pause", "amrap_target"]),
  { weight: 102.5, rpe: 8.5, rm_percentage: 82, pause: 90, amrap_target: 8 },
  "weight and RPE go up with their decimals; 1RM %, the pause and an AMRAP target stay whole, as the phone rounds them"
);
assert.strictEqual(fields.buildSnapshot("Set", loggedSet).weight, 102.5);
assert.strictEqual(fields.buildSnapshot("Set", { ...loggedSet, weight: null }).weight, null, "no weight stays no weight");
assert.ok(
  !fields.areComparableSetsEqual(loggedSet, { ...loggedSet, weight: 102 }),
  "the field table compares exactly - the integer column's cut is handled by resolveCloudSetDecimals, not by a looser comparison"
);

function pick(object, keys) {
  return Object.fromEntries(keys.map((key) => [key, object[key]]));
}

/* ------------------------------------------------ the old truncation ------ */

{
  const payload = { weight: 102.5, rpe: 8.5, reps: 3, note: "tung" };
  assert.deepStrictEqual(truncateSetDecimals(payload), { weight: 102, rpe: 8, reps: 3, note: "tung" });
  assert.deepStrictEqual(payload, { weight: 102.5, rpe: 8.5, reps: 3, note: "tung" }, "the row's own payload is not changed");
  assert.deepStrictEqual(truncateSetDecimals({ weight: null, rpe: null }), { weight: null, rpe: null }, "null stays null");
  assert.deepStrictEqual(truncateSetDecimals({ reps: 5 }), { reps: 5 }, "a field that is not there is not added");
  assert.strictEqual(truncateSetDecimals(null), null);
}

/* ----------------------------------------- the refusal, and only that one -- */

const REFUSED = { code: "22P02", message: 'invalid input syntax for type integer: "102.5"', details: null, hint: null };

assert.ok(isSetDecimalsRefusedError(REFUSED));
assert.ok(isSetDecimalsRefusedError({ code: "22P02", message: 'invalid input syntax for type smallint: "8.5"' }));
for (const error of [
  { code: "22P02", message: 'invalid input syntax for type uuid: "abc"' },
  { code: "42703", message: "column set.weight does not exist" },
  { code: "", message: "TypeError: Network request failed" },
  { code: "23514", message: 'new row for relation "set" violates check constraint "set_type_known"' },
  null,
]) {
  assert.ok(!isSetDecimalsRefusedError(error), `${JSON.stringify(error)} is not the integer column refusing a decimal`);
}

/* ------------------------------------------- what a cut-off copy means ---- */

assert.ok(isTruncatedCopy(102.5, 102));
assert.ok(isTruncatedCopy(11.25, 11));
assert.ok(isTruncatedCopy("8.5", "8"));
assert.ok(!isTruncatedCopy(102.5, 101), "a kilo apart is a real change");
assert.ok(!isTruncatedCopy(102.5, 103));
assert.ok(!isTruncatedCopy(102, 102), "nothing was cut off");
assert.ok(!isTruncatedCopy(102.5, 102.5));
assert.ok(!isTruncatedCopy(102, 102.5), "the cloud having more is not a cut");
assert.ok(!isTruncatedCopy(0.5, null), "no value in the cloud is a change, not a cut");
assert.ok(!isTruncatedCopy(null, 0));
assert.ok(hasTruncatedSetDecimals({ weight: 100, rpe: 8.5 }, { weight: 100, rpe: 8 }));
assert.ok(!hasTruncatedSetDecimals({ weight: 100, rpe: 8 }, { weight: 100, rpe: 8 }));
assert.ok(hasSetDecimals({ weight: 60, rpe: 7.5 }));
assert.ok(!hasSetDecimals({ weight: 60, rpe: 7 }));
assert.ok(!hasSetDecimals({}));

{
  const local = { weight: 102.5, rpe: 8.5, reps: 3 };
  const cloud = { weight: 102, rpe: 8, reps: 3 };
  const withLocal = { weight: 102.5, rpe: 8.5, reps: 3 };
  const decide = (cloudKeepsDecimals, versionOrder, cloudSnapshot = cloud) =>
    resolveCloudSetDecimals({ localSnapshot: local, cloudSnapshot, cloudKeepsDecimals, versionOrder });

  // Integer column: 102 is all it can say. Agreement, whatever the versions.
  assert.deepStrictEqual(decide(false, 0), { cloudSnapshot: withLocal, reupload: false });
  assert.deepStrictEqual(decide(false, -1), { cloudSnapshot: withLocal, reupload: false }, "a newer cloud edit elsewhere still cannot know the .5");
  assert.deepStrictEqual(
    decide(false, -1, { ...cloud, reps: 5 }),
    { cloudSnapshot: { ...withLocal, reps: 5 }, reupload: false },
    "the other device's reps are taken, the phone's decimals kept"
  );

  // Numeric column, same edit: the cloud holds it cut off from before. Up again.
  assert.deepStrictEqual(decide(true, 0), { cloudSnapshot: withLocal, reupload: true });
  assert.deepStrictEqual(decide(true, 1), { cloudSnapshot: withLocal, reupload: true });
  // Numeric column, newer cloud edit: somebody may have meant 102.
  assert.deepStrictEqual(decide(true, -1), { cloudSnapshot: cloud, reupload: false });

  // Not known yet: keep the phone's, send nothing; a newer cloud edit wins.
  assert.deepStrictEqual(decide(null, 0), { cloudSnapshot: withLocal, reupload: false });
  assert.deepStrictEqual(decide(null, -1), { cloudSnapshot: cloud, reupload: false });

  // Nothing cut off: the cloud's snapshot, untouched, whatever else differs.
  const other = { weight: 100, rpe: 8.5, reps: 3 };
  assert.strictEqual(decide(true, 0, other).cloudSnapshot, other);
  assert.strictEqual(decide(false, 0, other).reupload, false);
}

/* --------------------------------------------------------- the handle ---- */

async function handleChecks() {
  // An upload, the way setSync does it: the payload is built inside the
  // request, so the retry sends it cut off.
  {
    let notices = 0;
    const columns = createSetDecimalsCloudColumns({ onRefused: () => (notices += 1) });
    const sent = [];

    assert.strictEqual(columns.cloudKeepsDecimals(), null);

    const result = await columns.withFallback(async () => {
      const payload = columns.sendablePayload({ id: 1, weight: 102.5, rpe: 8.5 });
      sent.push(payload);

      if (!Number.isInteger(payload.weight)) {
        throw REFUSED;
      }

      return "uploaded";
    });

    assert.strictEqual(result, "uploaded", "the set still reaches the cloud");
    assert.deepStrictEqual(sent, [{ id: 1, weight: 102.5, rpe: 8.5 }, { id: 1, weight: 102, rpe: 8 }], "one retry, cut off");
    assert.strictEqual(notices, 1);
    assert.strictEqual(columns.cloudKeepsDecimals(), false);

    // The rest of the session goes up cut off from the first attempt.
    assert.deepStrictEqual(columns.sendablePayload({ weight: 97.5, rpe: null }), { weight: 97, rpe: null });
    columns.learnFrom([{ weight: 12.5 }]);
    assert.strictEqual(columns.cloudKeepsDecimals(), false, "once refused, the session does not flip back");

    // Refused even when sent cut off: something else is wrong. Thrown, not retried.
    let runs = 0;
    await assert.rejects(
      columns.withFallback(async () => {
        runs += 1;
        throw REFUSED;
      })
    );
    assert.strictEqual(runs, 1);
  }

  // Any other failure is the sync's own: thrown, not retried, nothing flipped.
  for (const error of [
    { code: "", message: "TypeError: Network request failed" },
    { code: "22P02", message: 'invalid input syntax for type uuid: "x"' },
    { code: "42501", message: "permission denied for table set" },
  ]) {
    const columns = createSetDecimalsCloudColumns();
    let runs = 0;

    await assert.rejects(
      columns.withFallback(async () => {
        runs += 1;
        throw error;
      }),
      (thrown) => thrown === error
    );
    assert.strictEqual(runs, 1, `${error.message} must not be retried`);
    assert.strictEqual(columns.cloudKeepsDecimals(), null, `${error.message} says nothing about the column`);
  }

  // Learning that the column keeps decimals.
  {
    const columns = createSetDecimalsCloudColumns();
    columns.learnFrom([{ weight: 100, rpe: 8 }, null]);
    assert.strictEqual(columns.cloudKeepsDecimals(), null, "whole numbers prove nothing");
    columns.learnFrom([{ weight: 100 }, { weight: 102.5 }]);
    assert.strictEqual(columns.cloudKeepsDecimals(), true, "a cloud row with decimals does");
    assert.deepStrictEqual(columns.sendablePayload({ weight: 102.5 }), { weight: 102.5 });
  }

  // The probe.
  {
    const refused = createSetDecimalsCloudColumns();
    assert.strictEqual(await refused.resolve(async () => { throw REFUSED; }), false);

    const answered = createSetDecimalsCloudColumns();
    let probes = 0;
    assert.strictEqual(await answered.resolve(async () => { probes += 1; }), true);
    assert.strictEqual(await answered.resolve(async () => { probes += 1; }), true);
    assert.strictEqual(probes, 1, "asked once a session");

    const offline = createSetDecimalsCloudColumns();
    assert.strictEqual(
      await offline.resolve(async () => { throw { code: "", message: "Network request failed" }; }),
      null,
      "a failed probe leaves the question open"
    );
    assert.strictEqual(await offline.resolve(async () => {}), true, "and it is asked again next time");
  }
}

/* ======================================= part two: the sync, end to end == */

const USER = "00000000-0000-0000-0000-0000000000a1";
const CLOUD_EXERCISE_ID = 7;

/**
 * The cloud, in memory: enough of PostgREST for the set sync. `set.weight`
 * and `set.rpe` behave like the real columns - `integer` refuses a value with
 * decimals in a write or a filter with 22P02, exactly as Postgres words it,
 * and `numeric` keeps what it is sent.
 */
function createCloud() {
  const tables = new Map();
  const cloud = {
    setColumns: "integer",
    log: [],
    rows(table) {
      if (!tables.has(table)) tables.set(table, []);
      return tables.get(table);
    },
    count(predicate) {
      return cloud.log.filter(predicate).length;
    },
  };
  let nextId = 1000;

  const copy = (value) => (value === undefined ? value : JSON.parse(JSON.stringify(value)));

  function refusal(table, record) {
    if (table !== "set" || cloud.setColumns !== "integer") return null;

    for (const key of SET_DECIMAL_FIELDS) {
      const value = record?.[key];
      if (value !== null && value !== undefined && !Number.isInteger(Number(value))) {
        return { code: "22P02", message: `invalid input syntax for type integer: "${value}"`, details: null, hint: null };
      }
    }

    return null;
  }

  function matches(row, filters) {
    return filters.every(([op, column, value]) => {
      if (op === "eq") return row[column] === value || Number(row[column]) === Number(value) && typeof value === "number";
      if (op === "gt") return row[column] > value;
      if (op === "in") return value.includes(row[column]);
      return true;
    });
  }

  function project(row, columns) {
    if (!columns || columns.trim() === "*") return copy(row);
    return Object.fromEntries(
      columns.split(",").map((column) => column.trim()).filter(Boolean).map((column) => [column, row[column] ?? null])
    );
  }

  function execute(query) {
    const { table, op, filters } = query;
    const rows = cloud.rows(table);
    cloud.log.push({ table, op, filters: copy(filters), values: copy(query.values) });

    for (const [kind, column, value] of filters) {
      if (kind === "eq" && SET_DECIMAL_FIELDS.includes(column)) {
        const error = refusal(table, { [column]: value });
        if (error) return { data: null, error, refused: true };
      }
    }

    if (op === "insert" || op === "update" || op === "upsert") {
      const records = Array.isArray(query.values) ? query.values : [query.values];
      for (const record of records) {
        const error = refusal(table, record);
        if (error) {
          query.refused = true;
          cloud.log[cloud.log.length - 1].refused = true;
          return { data: null, error };
        }
      }
    }

    let result = [];

    if (op === "select") {
      result = rows.filter((row) => matches(row, filters));
    } else if (op === "insert") {
      const records = Array.isArray(query.values) ? query.values : [query.values];
      result = records.map((record) => {
        const row = { id: nextId++, is_deleting: false, deleted_at: null, delete_requested_at: null, local_watchers: 0, ...copy(record) };
        rows.push(row);
        return row;
      });
    } else if (op === "update") {
      result = rows.filter((row) => matches(row, filters));
      for (const row of result) Object.assign(row, copy(query.values));
    } else if (op === "upsert") {
      const keys = (query.options?.onConflict ?? "id").split(",").map((key) => key.trim());
      const records = Array.isArray(query.values) ? query.values : [query.values];
      result = records.map((record) => {
        const existing = rows.find((row) => keys.every((key) => row[key] === record[key]));
        if (existing) return Object.assign(existing, copy(record));
        const row = { id: nextId++, ...copy(record) };
        rows.push(row);
        return row;
      });
    }

    for (const [column, ascending] of [...query.order].reverse()) {
      result = [...result].sort((a, b) => (a[column] > b[column] ? 1 : a[column] < b[column] ? -1 : 0) * (ascending ? 1 : -1));
    }
    if (query.limit !== null) result = result.slice(0, query.limit);

    const count = query.count ? result.length : null;
    const data = query.head ? null : result.map((row) => project(row, query.columns));

    if (query.mode === "single") {
      return data?.length === 1 ? { data: data[0], error: null } : { data: null, error: { code: "PGRST116", message: "not one row" } };
    }
    if (query.mode === "maybe") {
      return { data: data?.[0] ?? null, error: null };
    }

    return { data, error: null, count };
  }

  function from(table) {
    const query = { table, op: "select", filters: [], order: [], limit: null, mode: "many", columns: "*", values: null, head: false, count: null };
    const builder = {
      select(columns = "*", options = {}) {
        query.columns = columns;
        query.head = Boolean(options.head);
        query.count = options.count ?? null;
        return builder;
      },
      insert(values) { query.op = "insert"; query.values = values; return builder; },
      update(values) { query.op = "update"; query.values = values; return builder; },
      upsert(values, options) { query.op = "upsert"; query.values = values; query.options = options; return builder; },
      eq(column, value) { query.filters.push(["eq", column, value]); return builder; },
      gt(column, value) { query.filters.push(["gt", column, value]); return builder; },
      in(column, values) { query.filters.push(["in", column, values]); return builder; },
      order(column, { ascending = true } = {}) { query.order.push([column, ascending]); return builder; },
      limit(count) { query.limit = count; return builder; },
      maybeSingle() { query.mode = "maybe"; return builder; },
      single() { query.mode = "single"; return builder; },
      then(resolve, reject) {
        return Promise.resolve().then(() => execute(query)).then(resolve, reject);
      },
    };

    return builder;
  }

  cloud.client = {
    from,
    auth: {
      getSession: async () => ({ data: { session: { user: { id: USER } } }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  };

  return cloud;
}

const cloud = createCloud();
const infos = [];
console.info = (...args) => infos.push(args.map(String).join(" "));

const storage = new Map();
loadAppModule.stubModule("react-native", { Platform: { OS: "web" }, I18nManager: {}, NativeModules: {} });
loadAppModule.stubModule("react-native-url-polyfill/auto", {});
loadAppModule.stubModule("expo-sqlite/localStorage/install", {});
loadAppModule.stubModule("expo-secure-store", {});
loadAppModule.stubModule("@react-native-async-storage/async-storage", {
  __esModule: true,
  default: {
    getItem: async (key) => storage.get(key) ?? null,
    setItem: async (key, value) => storage.set(key, value),
    removeItem: async (key) => storage.delete(key),
  },
});

/** A new app session: every module, and with it the session's answer about the column, starts over. */
function startSession() {
  loadAppModule.stubModule("@supabase/supabase-js", { createClient: () => cloud.client, processLock: () => {} });

  return loadAppModule("src/Services/cloudSync/setSync.js");
}

const { programSchemaSql } = loadAppModule("src/Database/schema/program.js");
const { weightliftingSchemaSql } = loadAppModule("src/Database/schema/weightlifting.js");

let databaseCount = 0;

// The triggers db.js puts on every synced table, so last_updated follows
// sync_version as it does on a phone. Read out of db.js rather than copied:
// compareEntitySyncVersions reads last_updated first, and without them every
// pulled version would look older than the cloud's.
const createSyncMetadataTriggers = (() => {
  const source = read("src/Database/db.js");
  const extract = (signature) => {
    const start = source.indexOf(signature);
    assert.ok(start !== -1, `${signature} is gone from db.js`);
    return source.slice(start, source.indexOf("\n}\n", start) + 2);
  };

  return new Function(
    [
      extract("function quoteIdentifier("),
      extract("function syncVersionToLastUpdatedSql("),
      extract("async function createSideBySideSyncMetadataTriggers("),
      "return createSideBySideSyncMetadataTriggers;",
    ].join("\n")
  )();
})();

/** A phone: the real schema in SQLite, with the exercise the sets belong to already synced. */
async function createPhone() {
  const raw = new DatabaseSync(":memory:");
  raw.exec(programSchemaSql);
  raw.exec(weightliftingSchemaSql);
  await createSyncMetadataTriggers({ execAsync: async (sql) => raw.exec(sql) }, "Set", "sets_id", "cloud_set_id");
  raw
    .prepare(
      `INSERT INTO Exercise_Instance (exercise_instance_id, cloud_id, cloud_exercise_instance_id, remote_local_exercise_instance_id,
         sync_id, sync_version, workout_type_instance_id, exercise_name, needs_sync)
       VALUES (1, ?, ?, 1, 'exercise-sync', 1759000000, 1, 'Bench Press', 0)`
    )
    .run(CLOUD_EXERCISE_ID, CLOUD_EXERCISE_ID);

  const bind = (params) => (params ?? []).map((value) => (typeof value === "boolean" ? Number(value) : value ?? null));
  databaseCount += 1;

  return {
    raw,
    databasePath: `test-set-decimals-${databaseCount}`,
    getAllAsync: async (sql, params) => raw.prepare(sql).all(...bind(params)),
    getFirstAsync: async (sql, params) => raw.prepare(sql).get(...bind(params)) ?? null,
    runAsync: async (sql, params) => {
      const result = raw.prepare(sql).run(...bind(params));
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    execAsync: async (sql) => raw.exec(sql),
    isInTransactionAsync: async () => raw.isTransaction,
    set(setId) {
      return raw.prepare('SELECT weight, rpe, reps, needs_sync, sync_version, cloud_set_id FROM "Set" WHERE sets_id = ?').get(setId);
    },
    logSet({ setId, setNumber, weight, rpe = null, reps = 1, version = 1759000100 }) {
      raw
        .prepare(
          `INSERT INTO "Set" (sets_id, sync_id, sync_version, last_updated, set_number, exercise_instance_id, weight, rpe, reps, done, needs_sync)
           VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, 1, 1)`
        )
        .run(setId, `set-sync-${setId}`, version, version, setNumber, weight, rpe, reps);
    },
  };
}

cloud.rows("exercise_instance").push({
  id: CLOUD_EXERCISE_ID,
  user_id: USER,
  local_exercise_instance_id: 1,
  sync_id: "exercise-sync",
  sync_version: 1759000000,
  deleted_at: null,
  is_deleting: false,
});

const cloudSet = (syncId) => cloud.rows("set").find((row) => row.sync_id === syncId);
const setWrites = () => cloud.count((entry) => entry.table === "set" && entry.op !== "select");
const refusedWrites = () => cloud.count((entry) => entry.table === "set" && entry.refused);
const probes = () => cloud.count((entry) => entry.table === "set" && entry.filters.some(([, column]) => column === "weight"));

/** One set sync, in the order syncSetsWithCloud runs it. */
async function syncPass(setSync, phone) {
  const deleted = await setSync.processQueuedSetDeletes(phone, USER);
  const downloaded = await setSync.reconcileSetsFromCloud(phone, USER);
  const uploaded = await setSync.uploadDirtySets(phone, USER);
  const settled = uploaded > 0 || deleted > 0 ? await setSync.reconcileSetsFromCloud(phone, USER) : 0;

  return { downloaded: downloaded + settled, uploaded };
}

async function syncChecks() {
  /* ------------------------------------ before the migration: integer -- */

  cloud.setColumns = "integer";
  const phone = await createPhone();
  let setSync = startSession();

  phone.logSet({ setId: 1, setNumber: 1, weight: 102.5, rpe: 8.5, reps: 3 });

  assert.strictEqual(await setSync.uploadDirtySets(phone, USER), 1, "the set with decimals is uploaded, not stuck");
  assert.strictEqual(refusedWrites(), 1, "the integer column refused it once");
  assert.deepStrictEqual(
    pick(cloudSet("set-sync-1"), ["weight", "rpe", "reps"]),
    { weight: 102, rpe: 8, reps: 3 },
    "and it went up again cut off, as it always did"
  );
  assert.deepStrictEqual(
    pick(phone.set(1), ["weight", "rpe", "needs_sync"]),
    { weight: 102.5, rpe: 8.5, needs_sync: 0 },
    "the phone keeps 102.5 and counts the set as synced"
  );
  assert.strictEqual(infos.length, 1, "one notice for the session");

  // The rest of the session goes up cut off from the first attempt.
  phone.logSet({ setId: 2, setNumber: 2, weight: 97.5, reps: 5 });
  assert.strictEqual(await setSync.uploadDirtySets(phone, USER), 1);
  assert.strictEqual(refusedWrites(), 1, "remembered for the session: no second refusal");
  assert.strictEqual(cloudSet("set-sync-2").weight, 97);

  // Pull after pull: 102 in the cloud is agreement, not a change.
  const writesBefore = setWrites();
  for (let pass = 0; pass < 3; pass += 1) {
    assert.deepStrictEqual(await syncPass(setSync, phone), { downloaded: 0, uploaded: 0 }, `pass ${pass} saw a change`);
  }
  assert.strictEqual(setWrites(), writesBefore, "nothing was uploaded again");
  assert.deepStrictEqual(pick(phone.set(1), ["weight", "rpe", "needs_sync"]), { weight: 102.5, rpe: 8.5, needs_sync: 0 }, "the pull did not overwrite 102.5 with 102");
  assert.strictEqual(phone.set(2).weight, 97.5);

  // Another phone changes the reps. Its reps win; this phone's .5 stays.
  Object.assign(cloudSet("set-sync-1"), { reps: 4, sync_version: 1759000500, last_updated: new Date(1759000500 * 1000).toISOString() });
  assert.strictEqual((await syncPass(setSync, phone)).downloaded, 1);
  assert.deepStrictEqual(pick(phone.set(1), ["weight", "reps", "needs_sync"]), { weight: 102.5, reps: 4, needs_sync: 0 });
  assert.deepStrictEqual(await syncPass(setSync, phone), { downloaded: 0, uploaded: 0 }, "and then it is settled");

  // The next app session asks before the first pull, and finds out without writing.
  setSync = startSession();
  const probesBefore = probes();
  const refusalsBefore = refusedWrites();
  assert.deepStrictEqual(await syncPass(setSync, phone), { downloaded: 0, uploaded: 0 });
  assert.strictEqual(probes() - probesBefore, 1, "one probe in the new session");
  assert.deepStrictEqual(pick(phone.set(1), ["weight", "needs_sync"]), { weight: 102.5, needs_sync: 0 });
  phone.logSet({ setId: 3, setNumber: 3, weight: 60.5, reps: 8 });
  assert.strictEqual(await setSync.uploadDirtySets(phone, USER), 1);
  assert.strictEqual(refusedWrites(), refusalsBefore, "the probe already knew: the new set went up cut off at once");
  assert.strictEqual(cloudSet("set-sync-3").weight, 60);
  await syncPass(setSync, phone);
  assert.strictEqual(probes() - probesBefore, 1, "and it is not asked again that session");

  /* -------------------------------------- the migration has run: numeric -- */

  cloud.setColumns = "numeric";
  setSync = startSession();

  // The first pull finds the cloud's copies cut off, and sends the phone's up.
  const first = await syncPass(setSync, phone);
  assert.deepStrictEqual(first, { downloaded: 0, uploaded: 3 }, "the three cut-off sets go up again, and nothing comes down");
  assert.deepStrictEqual(pick(cloudSet("set-sync-1"), ["weight", "rpe", "reps"]), { weight: 102.5, rpe: 8.5, reps: 4 });
  assert.strictEqual(cloudSet("set-sync-2").weight, 97.5);
  assert.strictEqual(cloudSet("set-sync-3").weight, 60.5);
  assert.deepStrictEqual(pick(phone.set(1), ["weight", "rpe", "needs_sync"]), { weight: 102.5, rpe: 8.5, needs_sync: 0 });

  // And then it is settled, pass after pass, and in the next session too.
  const settledWrites = setWrites();
  for (let pass = 0; pass < 3; pass += 1) {
    assert.deepStrictEqual(await syncPass(setSync, phone), { downloaded: 0, uploaded: 0 }, `pass ${pass} did not settle`);
  }
  setSync = startSession();
  assert.deepStrictEqual(await syncPass(setSync, phone), { downloaded: 0, uploaded: 0 });
  assert.strictEqual(setWrites(), settledWrites, "nothing is uploaded again, ever");

  // A new set goes up as it is.
  phone.logSet({ setId: 4, setNumber: 4, weight: 11.25, rpe: 7.5, reps: 12 });
  assert.strictEqual((await syncPass(setSync, phone)).uploaded, 1);
  assert.deepStrictEqual(pick(cloudSet("set-sync-4"), ["weight", "rpe"]), { weight: 11.25, rpe: 7.5 });
  assert.strictEqual(refusedWrites(), 1, "nothing refused since the migration");

  // An edit from 80 to 80.5 is an edit: the pull before the upload must not
  // read the cloud's 80 as the same set and mark it synced.
  phone.logSet({ setId: 5, setNumber: 5, weight: 80, reps: 5 });
  await syncPass(setSync, phone);
  assert.strictEqual(cloudSet("set-sync-5").weight, 80);
  await loadAppModule("src/Repository/weightliftingRepository.js").updateSetField(phone, { field: "weight", value: 80.5, setId: 5 });
  assert.deepStrictEqual(await syncPass(setSync, phone), { downloaded: 0, uploaded: 1 });
  assert.strictEqual(cloudSet("set-sync-5").weight, 80.5);
  assert.deepStrictEqual(pick(phone.set(5), ["weight", "needs_sync"]), { weight: 80.5, needs_sync: 0 });
  cloud.rows("set").splice(cloud.rows("set").indexOf(cloudSet("set-sync-5")), 1);
  phone.raw.prepare('DELETE FROM "Set" WHERE sets_id = 5').run();

  // A new phone restores the history with its decimals.
  const newPhone = await createPhone();
  const restoring = startSession();
  assert.strictEqual(await restoring.reconcileSetsFromCloud(newPhone, USER), 4);
  assert.deepStrictEqual(
    newPhone.raw.prepare('SELECT weight, rpe FROM "Set" ORDER BY set_number').all().map((row) => ({ ...row })),
    [
      { weight: 102.5, rpe: 8.5 },
      { weight: 97.5, rpe: null },
      { weight: 60.5, rpe: null },
      { weight: 11.25, rpe: 7.5 },
    ]
  );

  // Somebody really means 102 now, from the other phone: that edit wins.
  Object.assign(cloudSet("set-sync-1"), { weight: 102, sync_version: 1759000900, last_updated: new Date(1759000900 * 1000).toISOString() });
  assert.deepStrictEqual(await syncPass(setSync, phone), { downloaded: 1, uploaded: 0 });
  assert.deepStrictEqual(pick(phone.set(1), ["weight", "needs_sync"]), { weight: 102, needs_sync: 0 });
  assert.deepStrictEqual(await syncPass(setSync, phone), { downloaded: 0, uploaded: 0 }, "and it is not sent back as 102.5");
}

/* ============================ the other paths that read a set from the cloud == */

{
  // The workout hydration reads sets from the cloud on its own path.
  const service = read("src/Services/weightliftingService.js");
  const hydrate = service.slice(
    service.indexOf("async function hydrateWorkoutStrengthDataFromCloud("),
    service.indexOf("export async function syncStrengthWorkoutDataFromCloud(")
  );

  assert.ok(hydrate.length > 0, "hydrateWorkoutStrengthDataFromCloud is gone");
  assert.ok(!/normalizeOptionalInteger\(cloudSet\?\.(weight|rpe)/.test(hydrate), "the hydration truncates a set's weight or RPE again");
  assert.ok(/normalizeSetDecimal\(cloudSet\?\.weight\)/.test(hydrate) && /normalizeSetDecimal\(cloudSet\?\.rpe\)/.test(hydrate));
  assert.ok(/resolveCloudSetDecimals\(/.test(hydrate), "the hydration lets a cut-off copy overwrite the phone's decimals");
  assert.ok(/setDecimalColumns\.learnFrom\(cloudSets\)/.test(hydrate));

  // Importing a program file.
  const transfer = read("src/Services/programTransferService.js");
  assert.ok(!/toIntegerOrNull\(set\.(weight|rpe)\)/.test(transfer), "a program import truncates a set's weight or RPE");

  // The upload builds its payload inside the fallback, so the retry rebuilds it.
  const setSyncSource = read("src/Services/cloudSync/setSync.js");
  assert.ok(
    /setDecimalColumns\.withFallback\(\(\) =>\s*syncDirtyLocalRowToCloud\(\{[\s\S]*?payload: setDecimalColumns\.sendablePayload\(payload\)/.test(setSyncSource),
    "the set upload must build its payload inside setDecimalColumns.withFallback"
  );

  // And the migration it all waits for is in the ledger.
  const migration = "20261003090000_a-set-keeps-its-decimals.sql";
  assert.ok(fs.existsSync(path.join(root, "supabase", "migrations", migration)), `${migration} is gone`);
  assert.ok(read("supabase/migrations/README.md").includes(`| \`${migration}\` |`), `${migration} is not in the ledger`);
}

handleChecks()
  .then(syncChecks)
  .then(() => {
    console.log(
      "Set decimals: weight and RPE keep two decimals both ways; before the migration an upload falls back to whole numbers " +
        "once a session and the phone keeps its own; afterwards the cut-off sets go up once and everything settles."
    );
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
