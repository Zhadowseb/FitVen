// One exercise the cloud's catalogue does not know must not stop the rest.
//
// exercise_instance.exercise_name is a foreign key to the catalogue. A custom
// exercise - or a name this phone has and the catalogue has not - is answered
// with 23503 ("Key is not present in table Exercise"), and that one answer
// used to throw out of the upload loop. Nothing after it went up: not the
// other exercises of the workout, not one set, not the exercises of any later
// workout. The cloud then held workouts with nothing in them (for one account
// nothing after 17 June), and a post waited behind the same pass.
//
// Now the exercise the catalogue refuses stays on the phone, marked for the
// next pass, once per name per pass, and everything else is uploaded. Any
// other error still stops the pass, as before.
//
// The real sync modules run against a real SQLite database built from the
// app's own schema; a small in-memory cloud stands in for Supabase and refuses
// unknown exercise names the way the real foreign key does.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

/* ------------------------------------------------------------ the cloud -- */

const USER_ID = "user-unknown-exercise";

// PostgREST compares through text, so 7 and "7" are the same id.
const sameValue = (left, right) =>
  left === right ||
  (left !== null &&
    left !== undefined &&
    right !== null &&
    right !== undefined &&
    String(left) === String(right));

/** Supabase's query builder over plain arrays, as much of it as sync uses. */
function createCloud() {
  const tables = new Map();
  // What the user does while a write to a table is in flight: each runs once,
  // after the row was read and sent and before the cloud answers.
  const duringWrites = [];
  let nextId = 1;

  const rowsOf = (table) => {
    if (!tables.has(table)) tables.set(table, []);
    return tables.get(table);
  };

  // The cloud's exercise_instance.exercise_name is a foreign key to the
  // catalogue: a name that is not in it is refused, whatever else is in the
  // request. `failEverything` stands in for any other fault.
  const known = new Set();
  const refusals = [];
  let failEverything = null;

  async function execute(table, state) {
    const matches = (row) => state.filters.every((test) => test(row));

    if (failEverything && state.op !== "select") {
      return { data: null, error: failEverything };
    }

    if (
      table === "exercise_instance" &&
      (state.op === "insert" || state.op === "upsert" || state.op === "update")
    ) {
      for (const payload of [].concat(state.payload)) {
        if (payload?.exercise_name && !known.has(payload.exercise_name)) {
          refusals.push(payload.exercise_name);

          return {
            data: null,
            error: {
              code: "23503",
              details: 'Key is not present in table "Exercise".',
              hint: null,
              message:
                'insert or update on table "exercise_instance" violates foreign key constraint "Exercise_Instance_exercise_name_fkey"',
            },
          };
        }
      }
    }

    if (state.op === "insert" || state.op === "update") {
      const index = duringWrites.findIndex((entry) => entry.table === table);

      if (index !== -1) {
        const [{ run }] = duringWrites.splice(index, 1);
        await run();
      }
    }

    let result = [];

    if (state.op === "insert") {
      result = [].concat(state.payload).map((payload) => ({
        id: nextId++,
        is_deleting: false,
        delete_requested_at: null,
        local_watchers: 0,
        ...payload,
      }));
      rowsOf(table).push(...result);
    } else if (state.op === "update") {
      result = rowsOf(table).filter(matches);
      result.forEach((row) => Object.assign(row, state.payload));
    } else if (state.op === "upsert") {
      const keys = (state.onConflict ?? "").split(",").filter(Boolean);

      for (const payload of [].concat(state.payload)) {
        const existing = rowsOf(table).find(
          (row) =>
            keys.length > 0 &&
            keys.every((key) => sameValue(row[key], payload[key]))
        );

        if (existing) Object.assign(existing, payload);
        else rowsOf(table).push({ id: nextId++, ...payload });
      }
    } else if (state.op === "delete") {
      tables.set(table, rowsOf(table).filter((row) => !matches(row)));
    } else {
      result = rowsOf(table).filter(matches);

      // Last order first, on a stable sort, is the order they were asked in.
      for (const [column, ascending] of [...state.orders].reverse()) {
        result = [...result].sort(
          (a, b) =>
            ((a[column] > b[column]) - (a[column] < b[column])) *
            (ascending ? 1 : -1)
        );
      }

      if (state.limit !== null) result = result.slice(0, state.limit);
    }

    const copies = result.map((row) => ({ ...row }));

    if (state.single === "maybe") return { data: copies[0] ?? null, error: null };
    if (state.single === "one") {
      return copies[0]
        ? { data: copies[0], error: null }
        : { data: null, error: new Error(`no ${table} row came back`) };
    }

    return { data: copies, error: null };
  }

  function from(table) {
    const state = {
      op: "select",
      filters: [],
      orders: [],
      limit: null,
      single: null,
      payload: null,
      onConflict: null,
    };
    const builder = {
      select: () => builder,
      eq(column, value) {
        state.filters.push((row) => sameValue(row[column], value));
        return builder;
      },
      gt(column, value) {
        state.filters.push((row) => row[column] > value);
        return builder;
      },
      order(column, { ascending = true } = {}) {
        state.orders.push([column, ascending]);
        return builder;
      },
      limit(count) {
        state.limit = count;
        return builder;
      },
      insert(payload) {
        Object.assign(state, { op: "insert", payload });
        return builder;
      },
      update(payload) {
        Object.assign(state, { op: "update", payload });
        return builder;
      },
      upsert(payload, options) {
        Object.assign(state, {
          op: "upsert",
          payload,
          onConflict: options?.onConflict ?? null,
        });
        return builder;
      },
      delete() {
        state.op = "delete";
        return builder;
      },
      maybeSingle() {
        state.single = "maybe";
        return builder;
      },
      single() {
        state.single = "one";
        return builder;
      },
      then: (resolve, reject) => execute(table, state).then(resolve, reject),
    };

    return builder;
  }

  return {
    from,
    rows: (table) => rowsOf(table).map((row) => ({ ...row })),
    know: (name) => known.add(name),
    refusals,
    failEverythingWith(error) {
      failEverything = error;
    },
    duringNextWrite(table, run) {
      duringWrites.push({ table, run });
    },
    assertEveryWriteHappened() {
      assert.deepStrictEqual(
        duringWrites.map((entry) => entry.table),
        [],
        "a write the test waited for never reached the cloud, so it tested nothing"
      );
    },
  };
}

const cloud = createCloud();

loadAppModule.stubModule("@supabase/supabase-js", {
  createClient: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: USER_ID } } },
        error: null,
      }),
      getUser: async () => ({ data: { user: { id: USER_ID } }, error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe() {} } },
      }),
    },
    from: cloud.from,
    rpc: async () => ({ data: null, error: null }),
    functions: { invoke: async () => ({ data: null, error: null }) },
  }),
  processLock: () => {},
});
loadAppModule.stubModule("react-native", {
  Platform: { OS: "android" },
  AppState: { addEventListener: () => ({ remove() {} }) },
  I18nManager: {},
  NativeModules: {},
});
loadAppModule.stubModule("@react-native-async-storage/async-storage", {
  __esModule: true,
  default: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
    getAllKeys: async () => [],
    multiRemove: async () => {},
  },
});
loadAppModule.stubModule("expo-constants", { default: {} });
loadAppModule.stubModule("react-native-url-polyfill/auto", {});
loadAppModule.stubModule("expo-sqlite/localStorage/install", {});
loadAppModule.stubModule("expo-secure-store", {});

const { programSchemaSql } = loadAppModule("src/Database/schema/program.js");
const { weightliftingSchemaSql } = loadAppModule(
  "src/Database/schema/weightlifting.js"
);
const programRepository = loadAppModule("src/Repository/programRepository.js");
const weightliftingRepository = loadAppModule(
  "src/Repository/weightliftingRepository.js"
);
const workoutRepository = loadAppModule("src/Repository/workoutRepository.js");
// The repositories' own instance: one clock, so an edit made after another one
// is always the newer.
const { createNextSyncVersion } = loadAppModule("src/Utils/syncUtils.js");
const { timestampToCloudTimeString } = loadAppModule(
  "src/Services/cloudSync/cloudSyncFields.js"
);
const { syncProgramsWithCloud } = loadAppModule(
  "src/Services/cloudSync/programSync.js"
);
const { syncMesocyclesWithCloud } = loadAppModule(
  "src/Services/cloudSync/mesocycleSync.js"
);
const { syncMicrocyclesWithCloud } = loadAppModule(
  "src/Services/cloudSync/microcycleSync.js"
);
const { syncDaysWithCloud } = loadAppModule("src/Services/cloudSync/daySync.js");
const { syncWorkoutTypeInstancesWithCloud } = loadAppModule(
  "src/Services/cloudSync/workoutTypeInstanceSync.js"
);
const { syncExerciseInstancesWithCloud } = loadAppModule(
  "src/Services/cloudSync/exerciseInstanceSync.js"
);
const { syncSetsWithCloud } = loadAppModule("src/Services/cloudSync/setSync.js");
const { pushDirtyStrengthHierarchyWithCloud } = loadAppModule(
  "src/Services/cloudSync/hierarchy.js"
);

/* ------------------------------------------------------------ the phone -- */

/** node:sqlite behind the part of expo-sqlite's API the sync engine uses. */
function createDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  const bind = (params) =>
    (Array.isArray(params) ? params : params === undefined ? [] : [params]).map(
      (value) =>
        value === undefined
          ? null
          : typeof value === "boolean"
            ? Number(value)
            : value
    );

  sqlite.exec(programSchemaSql);
  sqlite.exec(weightliftingSchemaSql);

  return {
    databasePath: "test-sync-unknown-exercise",
    sqlite,
    async execAsync(sql) {
      sqlite.exec(sql);
    },
    async runAsync(sql, params) {
      const result = sqlite.prepare(sql).run(...bind(params));

      return {
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: Number(result.changes),
      };
    },
    async getAllAsync(sql, params) {
      return sqlite.prepare(sql).all(...bind(params));
    },
    async getFirstAsync(sql, params) {
      return sqlite.prepare(sql).get(...bind(params)) ?? null;
    },
    async isInTransactionAsync() {
      return Boolean(sqlite.isTransaction);
    },
  };
}


/* ------------------------------------------------------------ the phone -- */



const now = () => Math.trunc(Date.now() / 1000);
const localDate = (date) =>
  [
    String(date.getDate()).padStart(2, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    date.getFullYear(),
  ].join(".");

// Table, primary key, cloud id column, cloud table. One row of each, never
// synced, the way a program looks on the phone that made it.
function seed(db) {
  const today = localDate(new Date());
  const insert = (sql, ...params) =>
    Number(db.sqlite.prepare(sql).run(...params).lastInsertRowid);
  const sync = (name) => [`${name}-sync-id`, 1];

  const programId = insert(
    `INSERT INTO Program (sync_id, sync_version, program_name, start_date, status)
     VALUES (?, ?, 'Strength', ?, 'ACTIVE');`,
    ...sync("program"),
    today
  );
  const mesocycleId = insert(
    `INSERT INTO Mesocycle (sync_id, sync_version, program_id, mesocycle_number, weeks)
     VALUES (?, ?, ?, 1, 1);`,
    ...sync("mesocycle"),
    programId
  );
  const microcycleId = insert(
    `INSERT INTO Microcycle (sync_id, sync_version, mesocycle_id, microcycle_number)
     VALUES (?, ?, ?, 1);`,
    ...sync("microcycle"),
    mesocycleId
  );
  const dayId = insert(
    `INSERT INTO Day (sync_id, sync_version, microcycle_id, program_id, Weekday, date)
     VALUES (?, ?, ?, ?, 'Monday', ?);`,
    ...sync("day"),
    microcycleId,
    programId,
    today
  );
  const workoutId = insert(
    `INSERT INTO Workout_Type_Instance (sync_id, sync_version, day_id, workout_type, date)
     VALUES (?, ?, ?, 'Resistance', ?);`,
    ...sync("workout"),
    dayId,
    today
  );
  const exerciseId = insert(
    `INSERT INTO Exercise_Instance
       (sync_id, sync_version, workout_type_instance_id, exercise_name, exercise_order, sets)
     VALUES (?, ?, ?, 'Squat', 1, 1);`,
    ...sync("exercise"),
    workoutId
  );
  const setId = insert(
    `INSERT INTO "Set" (sync_id, sync_version, set_number, exercise_instance_id, weight, reps)
     VALUES (?, ?, 1, ?, 100, 5);`,
    ...sync("set"),
    exerciseId
  );

  return {
    programId,
    mesocycleId,
    microcycleId,
    dayId,
    workoutId,
    exerciseId,
    setId,
  };
}


function addExercise(db, workoutId, name, order) {
  const insert = (sql, ...params) =>
    Number(db.sqlite.prepare(sql).run(...params).lastInsertRowid);
  const exerciseId = insert(
    `INSERT INTO Exercise_Instance
       (sync_id, sync_version, workout_type_instance_id, exercise_name, exercise_order, sets)
     VALUES (?, 1, ?, ?, ?, 1);`,
    `${name}-${order}-sync-id`,
    workoutId,
    name,
    order
  );
  const setId = insert(
    `INSERT INTO "Set" (sync_id, sync_version, set_number, exercise_instance_id, weight, reps)
     VALUES (?, 1, 1, ?, 60, 8);`,
    `${name}-${order}-set-sync-id`,
    exerciseId
  );

  return { exerciseId, setId };
}

const localExercise = (db, id) =>
  db.sqlite.prepare("SELECT * FROM Exercise_Instance WHERE exercise_instance_id = ?;").get(id);
const localSet = (db, id) =>
  db.sqlite.prepare('SELECT * FROM "Set" WHERE sets_id = ?;').get(id);
const cloudNames = () => cloud.rows("exercise_instance").map((row) => row.exercise_name).sort();

/* ------------------------------------------------------------ the tests -- */

(async () => {
  cloud.know("Squat");
  cloud.know("Bench Press");

  const db = createDatabase();
  const base = seed(db);
  // The refused one comes first, and twice: the old loop died on it before
  // Squat, and a second one of the same name must not be asked again.
  const first = addExercise(db, base.workoutId, "Anders", 0);
  const second = addExercise(db, base.workoutId, "Anders", 5);
  addExercise(db, base.workoutId, "Anders", 6);
  const bench = addExercise(db, base.workoutId, "Bench Press", 3);

  // 1. The pass does not throw, and everything else goes up.
  await pushDirtyStrengthHierarchyWithCloud(db);

  assert.deepStrictEqual(
    cloudNames(),
    ["Bench Press", "Squat"],
    "the exercises the catalogue knows go up, the one it does not stays out"
  );
  assert.strictEqual(cloud.rows("set").length, 2, "the sets of those two go up, and only theirs");
  // Three rows carry the name. The pass asks once for it; the repair the set
  // level runs afterwards is a second pass over the exercises and asks once
  // more. Never once per row.
  assert.ok(
    cloud.refusals.length >= 1 && cloud.refusals.length <= 2 && cloud.refusals.every((name) => name === "Anders"),
    "the refused name is asked once per pass over the exercises, not once per row: " + cloud.refusals
  );
  const askedInThePass = cloud.refusals.length;

  const squat = localExercise(db, base.exerciseId);
  assert.ok(squat.cloud_exercise_instance_id, "the Squat has its cloud id");
  assert.strictEqual(Number(squat.needs_sync), 0);
  assert.ok(localExercise(db, bench.exerciseId).cloud_exercise_instance_id, "and so has the Bench Press");

  // 2. The refused exercise, and its sets, wait on the phone for the next pass.
  for (const refused of [first, second]) {
    const row = localExercise(db, refused.exerciseId);
    assert.ok(!row.cloud_exercise_instance_id && !row.cloud_id, "no cloud id for what the cloud refused");
    assert.strictEqual(Number(row.needs_sync), 1, "and it is still marked for upload");
    assert.strictEqual(Number(localSet(db, refused.setId).needs_sync), 1, "its set too");
    assert.ok(!localSet(db, refused.setId).cloud_set_id && !localSet(db, refused.setId).cloud_id);
  }

  // 3. Another pass changes nothing in the cloud, and asks once again.
  const before = JSON.stringify(cloud.rows("exercise_instance"));
  await pushDirtyStrengthHierarchyWithCloud(db);
  assert.strictEqual(JSON.stringify(cloud.rows("exercise_instance")), before);
  assert.strictEqual(cloud.refusals.length, askedInThePass * 2, "the same again in the next pass, and no more");

  // 4. The day the catalogue knows the name, the exercise and its sets follow.
  cloud.know("Anders");
  await pushDirtyStrengthHierarchyWithCloud(db);
  assert.deepStrictEqual(cloudNames(), ["Anders", "Anders", "Anders", "Bench Press", "Squat"]);
  assert.strictEqual(cloud.rows("set").length, 5);
  assert.strictEqual(Number(localExercise(db, first.exerciseId).needs_sync), 0);

  // 5. Any other fault still stops the pass: the guard is for this one answer.
  addExercise(db, base.workoutId, "Squat", 9);
  cloud.failEverythingWith({ code: "XX000", message: "the cloud is down" });
  await assert.rejects(
    () => pushDirtyStrengthHierarchyWithCloud(db),
    (error) => error?.code === "XX000" || /cloud is down/.test(String(error?.message))
  );

  // 6. The name check itself.
  const { isUnknownExerciseNameError } = loadAppModule("src/Services/cloudSync/exerciseInstanceSync.js");
  const fk = {
    code: "23503",
    details: 'Key is not present in table "Exercise".',
    message: 'insert or update on table "exercise_instance" violates foreign key constraint "Exercise_Instance_exercise_name_fkey"',
  };
  assert.strictEqual(isUnknownExerciseNameError(fk), true);
  assert.strictEqual(isUnknownExerciseNameError({ ...fk, code: "23505" }), false, "a duplicate is another matter");
  assert.strictEqual(
    isUnknownExerciseNameError({
      code: "23503",
      details: 'Key (cloud_workout_type_instance_id)=(5) is not present in table "workout_type_instance".',
      message: 'insert or update on table "exercise_instance" violates foreign key constraint "Exercise_Instance_workout_fkey"',
    }),
    false,
    "a missing parent workout is not an unknown exercise: that one still has to be repaired, not skipped"
  );
  assert.strictEqual(isUnknownExerciseNameError(null), false);

  // 7. The loop uses it, and rethrows the rest.
  const sync = read("src/Services/cloudSync/exerciseInstanceSync.js").replace(/\r\n/g, "\n");
  assert.ok(/if \(!isUnknownExerciseNameError\(error\)\) \{\s*throw error;/.test(sync));

  console.log("unknown exercise ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
