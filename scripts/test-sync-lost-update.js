// Covers a write that lands while its row is being uploaded.
//
// "Restart workout, then Start, and the workout is not started any more." The
// upload read the row, sent it, and cleared needs_sync by id alone when the
// cloud answered. Start had written timer_start and original_start_time, with
// a new sync_version, while the request was out, so the flag it set was
// cleared with the rest and the restart's version written over its own. The
// download that follows every upload then found a clean local row that
// differed from the cloud, and put the workout back to not started. The start
// was never sent.
//
// Every other level of the strength hierarchy - program, block, week, day,
// exercise instance and set - was marked synced the same way. So a row is now
// only marked synced if its sync_version is still the one the decision was
// made from; otherwise it keeps its flag and its version, records the cloud
// identity it was given, and goes up with the next pass.
//
// The real sync modules run here against a real SQLite database built from
// the app's own schema, and a small in-memory cloud stands in for Supabase.
// The cloud lets the user act while a request is in flight, which is where the
// race lives.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

/* ------------------------------------------------------------ the cloud -- */

const USER_ID = "user-lost-update";

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

  async function execute(table, state) {
    const matches = (row) => state.filters.every((test) => test(row));

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
    databasePath: "test-sync-lost-update",
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

const now = () => Math.trunc(Date.now() / 1000);
const localDate = (date) =>
  [
    String(date.getDate()).padStart(2, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    date.getFullYear(),
  ].join(".");

// Table, primary key, cloud id column, cloud table. One row of each, never
// synced, the way a program looks on the phone that made it.
const LEVELS = [
  ["Program", "program_id", "cloud_program_id", "Program"],
  ["Mesocycle", "mesocycle_id", "cloud_mesocycle_id", "Mesocycle"],
  ["Microcycle", "microcycle_id", "cloud_microcycle_id", "Microcycle"],
  ["Day", "day_id", "cloud_day_id", "Day"],
  [
    "Workout_Type_Instance",
    "workout_id",
    "cloud_workout_type_instance_id",
    "workout_type_instance",
  ],
  [
    "Exercise_Instance",
    "exercise_instance_id",
    "cloud_exercise_instance_id",
    "exercise_instance",
  ],
  ["Set", "sets_id", "cloud_set_id", "set"],
];

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

const localRow = (db, table, idColumn, id) =>
  db.sqlite.prepare(`SELECT * FROM "${table}" WHERE ${idColumn} = ?;`).get(id);

function cloudRow(table, cloudId) {
  const row = cloud.rows(table).find((candidate) => candidate.id === cloudId);
  assert.ok(row, `the cloud has no ${table} row ${cloudId}`);
  return row;
}

/* ------------------------------------------------------------ the tests -- */

async function baselineSyncsEveryLevel(db) {
  // One pass of the lowest level syncs every level above it first.
  await syncSetsWithCloud(db);

  for (const [table, idColumn, cloudIdColumn, cloudTable] of LEVELS) {
    const rows = db.sqlite.prepare(`SELECT * FROM "${table}";`).all();

    assert.strictEqual(rows.length, 1, `${table} has ${rows.length} rows`);
    assert.strictEqual(
      rows[0].needs_sync,
      0,
      `${table} ${rows[0][idColumn]} is still waiting after the first sync`
    );
    assert.ok(
      rows[0][cloudIdColumn] !== null,
      `${table} never learned its cloud id`
    );
    assert.strictEqual(
      cloud.rows(cloudTable).length,
      1,
      `the cloud has ${cloud.rows(cloudTable).length} ${cloudTable} rows`
    );
  }
}

async function startDuringTheRestartUpload(db, { workoutId }) {
  const table = "Workout_Type_Instance";
  const idColumn = "workout_id";
  const startedAt = now();
  let startVersion = null;

  // A workout that was started a minute ago, and the cloud knows it. Without
  // that, a restart changes nothing and there is nothing to upload.
  await workoutRepository.persistWorkoutTimerState(db, {
    workoutId,
    timerStart: startedAt - 60,
    elapsedTime: 0,
  });
  await workoutRepository.setWorkoutOriginalStartTime(db, {
    workoutId,
    startTime: startedAt - 60,
  });
  await syncWorkoutTypeInstancesWithCloud(db);
  assert.strictEqual(localRow(db, table, idColumn, workoutId).needs_sync, 0);

  // Restart: the row is reset and waits to upload.
  await workoutRepository.resetWorkoutStateFields(db, workoutId);
  const restartVersion = localRow(db, table, idColumn, workoutId).sync_version;

  // Start, pressed while that upload is out: the same two writes as
  // workoutService.persistWorkoutTimerState and setWorkoutOriginalStartTime.
  cloud.duringNextWrite("workout_type_instance", async () => {
    await workoutRepository.persistWorkoutTimerState(db, {
      workoutId,
      timerStart: startedAt,
      elapsedTime: 0,
    });
    await workoutRepository.setWorkoutOriginalStartTime(db, {
      workoutId,
      startTime: startedAt,
    });
    startVersion = localRow(db, table, idColumn, workoutId).sync_version;
  });

  // What WorkoutTypeInstanceSync runs: download, upload, download again.
  await syncWorkoutTypeInstancesWithCloud(db);
  cloud.assertEveryWriteHappened();

  let workout = localRow(db, table, idColumn, workoutId);
  const cloudId = workout.cloud_workout_type_instance_id;

  assert.ok(startVersion > restartVersion, "Start did not get a newer version");
  assert.strictEqual(
    workout.timer_start,
    startedAt,
    "the download after the upload put the workout back to not started"
  );
  assert.strictEqual(workout.original_start_time, startedAt);
  assert.strictEqual(workout.is_active, 1);
  assert.strictEqual(
    workout.needs_sync,
    1,
    "the restart's upload cleared the flag the start had set"
  );
  assert.strictEqual(
    workout.sync_version,
    startVersion,
    "the restart's upload wrote its version over the start's"
  );
  assert.strictEqual(
    cloudRow("workout_type_instance", cloudId).timer_start,
    null,
    "the cloud should still hold the restart - the start was not sent yet"
  );

  // The pass the Start queued behind it sends the start.
  await syncWorkoutTypeInstancesWithCloud(db);

  workout = localRow(db, table, idColumn, workoutId);
  const uploaded = cloudRow("workout_type_instance", cloudId);

  assert.strictEqual(workout.needs_sync, 0, "the start never came clean");
  assert.strictEqual(workout.timer_start, startedAt);
  assert.strictEqual(workout.sync_version, startVersion);
  assert.strictEqual(uploaded.timer_start, timestampToCloudTimeString(startedAt));
  assert.strictEqual(
    uploaded.original_start_time,
    timestampToCloudTimeString(startedAt)
  );
  assert.strictEqual(uploaded.sync_version, startVersion);
}

async function noteEditedDuringItsOwnUpload(db, { exerciseId }) {
  const table = "Exercise_Instance";
  const idColumn = "exercise_instance_id";
  const firstNote = "Felt heavy";
  const secondNote = "Felt heavy - drop 5 kg next time";
  let secondVersion = null;

  await weightliftingRepository.updateExerciseNote(db, {
    exerciseId,
    note: firstNote,
  });

  cloud.duringNextWrite("exercise_instance", async () => {
    await weightliftingRepository.updateExerciseNote(db, {
      exerciseId,
      note: secondNote,
    });
    secondVersion = localRow(db, table, idColumn, exerciseId).sync_version;
  });

  await syncExerciseInstancesWithCloud(db);
  cloud.assertEveryWriteHappened();

  let exercise = localRow(db, table, idColumn, exerciseId);
  const cloudId = exercise.cloud_exercise_instance_id;

  assert.strictEqual(
    exercise.note,
    secondNote,
    "the download after the upload put the first note back"
  );
  assert.strictEqual(exercise.needs_sync, 1, "the second note lost its flag");
  assert.strictEqual(exercise.sync_version, secondVersion);
  assert.strictEqual(cloudRow("exercise_instance", cloudId).note, firstNote);

  await syncExerciseInstancesWithCloud(db);

  exercise = localRow(db, table, idColumn, exerciseId);
  assert.strictEqual(exercise.needs_sync, 0, "the second note never came clean");
  assert.strictEqual(exercise.note, secondNote);
  assert.strictEqual(cloudRow("exercise_instance", cloudId).note, secondNote);
  assert.strictEqual(
    cloudRow("exercise_instance", cloudId).sync_version,
    secondVersion
  );
}

async function setTickedOffDuringTheWeightUpload(db, { setId }) {
  const table = "Set";
  const idColumn = "sets_id";
  let doneVersion = null;

  await weightliftingRepository.updateSetField(db, {
    field: "weight",
    value: 105,
    setId,
  });

  cloud.duringNextWrite("set", async () => {
    await weightliftingRepository.updateSetDone(db, { setId, done: true });
    doneVersion = localRow(db, table, idColumn, setId).sync_version;
  });

  await syncSetsWithCloud(db);
  cloud.assertEveryWriteHappened();

  let set = localRow(db, table, idColumn, setId);
  const cloudId = set.cloud_set_id;

  assert.strictEqual(set.done, 1, "the download after the upload unticked the set");
  assert.strictEqual(set.weight, 105);
  assert.strictEqual(set.needs_sync, 1, "the tick lost its flag");
  assert.strictEqual(set.sync_version, doneVersion);
  assert.strictEqual(cloudRow("set", cloudId).weight, 105);
  assert.ok(!cloudRow("set", cloudId).done, "the tick reached the cloud too early");

  await syncSetsWithCloud(db);

  set = localRow(db, table, idColumn, setId);
  assert.strictEqual(set.needs_sync, 0, "the tick never came clean");
  assert.strictEqual(set.done, 1);
  assert.strictEqual(cloudRow("set", cloudId).done, true);
  assert.strictEqual(cloudRow("set", cloudId).sync_version, doneVersion);
}

// Program, block, week and day each upload through a module of their own, and
// each had the same race. One edit per level, the second landing while the
// first is uploading.
async function hierarchyRowEditedDuringItsOwnUpload(db, ids) {
  const EDITS = [
    {
      // Renamed, and the name corrected while the first rename was out.
      table: "Program",
      idColumn: "program_id",
      cloudIdColumn: "cloud_program_id",
      cloudTable: "Program",
      id: ids.programId,
      sync: syncProgramsWithCloud,
      field: "program_name",
      first: "Strength block",
      second: "Strength block - spring",
      write: (programName) =>
        programRepository.updateProgramName(db, {
          programId: ids.programId,
          programName,
        }),
    },
    {
      table: "Mesocycle",
      idColumn: "mesocycle_id",
      cloudIdColumn: "cloud_mesocycle_id",
      cloudTable: "Mesocycle",
      id: ids.mesocycleId,
      sync: syncMesocyclesWithCloud,
      field: "focus",
      first: "Hypertrophy",
      second: "Strength",
      write: (focus) =>
        programRepository.updateMesocycleFocus(db, {
          mesocycleId: ids.mesocycleId,
          focus,
        }),
    },
    {
      table: "Microcycle",
      idColumn: "microcycle_id",
      cloudIdColumn: "cloud_microcycle_id",
      cloudTable: "Microcycle",
      id: ids.microcycleId,
      sync: syncMicrocyclesWithCloud,
      field: "focus",
      first: "Volume",
      second: "Deload",
      write: (focus) =>
        programRepository.updateMicrocycleFocus(db, {
          microcycleId: ids.microcycleId,
          focus,
        }),
    },
    {
      // Marked sick by mistake, and taken back while that was uploading.
      table: "Day",
      idColumn: "day_id",
      cloudIdColumn: "cloud_day_id",
      cloudTable: "Day",
      id: ids.dayId,
      sync: syncDaysWithCloud,
      field: "is_sick",
      first: 1,
      second: 0,
      cloudValue: Boolean,
      write: (isSick) =>
        programRepository.updateDaySick(db, {
          dayId: ids.dayId,
          isSick: isSick === 1,
        }),
    },
  ];

  for (const edit of EDITS) {
    const { table, idColumn, cloudIdColumn, cloudTable, id, sync, field } = edit;
    const { first, second, write } = edit;
    const cloudValue = edit.cloudValue ?? ((value) => value);
    const row = () => localRow(db, table, idColumn, id);
    let secondVersion = null;

    await write(first);

    cloud.duringNextWrite(cloudTable, async () => {
      await write(second);
      secondVersion = row().sync_version;
    });

    await sync(db);
    cloud.assertEveryWriteHappened();

    const cloudId = row()[cloudIdColumn];

    assert.strictEqual(
      row()[field],
      second,
      `${table}: the download after the upload put the first edit back`
    );
    assert.strictEqual(row().needs_sync, 1, `${table}: the second edit lost its flag`);
    assert.strictEqual(
      row().sync_version,
      secondVersion,
      `${table}: the upload wrote its version over the second edit's`
    );
    assert.strictEqual(
      cloudRow(cloudTable, cloudId)[field],
      cloudValue(first),
      `${table}: the cloud should still hold the first edit`
    );

    // The pass the second edit queued behind it sends it.
    await sync(db);

    assert.strictEqual(row().needs_sync, 0, `${table}: the second edit never came clean`);
    assert.strictEqual(row()[field], second);
    assert.strictEqual(cloudRow(cloudTable, cloudId)[field], cloudValue(second));
    assert.strictEqual(cloudRow(cloudTable, cloudId).sync_version, secondVersion);
  }
}

// The push SetSync runs is upload-only. When another phone has edited an
// exercise since this one did, the exercise's own upload leaves it to the
// cloud and it stays waiting. The set under it then looks the exercise up
// (ensureExerciseInstanceCloudIdentity), and that used to write the cloud's
// sync_version onto the waiting row: the next push found the two versions
// equal and sent this phone's older note over the other phone's newer one,
// and no download ever put it back.
async function parentBeatenByTheCloudKeepsItsVersion(db, { exerciseId, setId }) {
  const exercise = () =>
    localRow(db, "Exercise_Instance", "exercise_instance_id", exerciseId);
  const set = () => localRow(db, "Set", "sets_id", setId);

  await weightliftingRepository.updateExerciseNote(db, {
    exerciseId,
    note: "Written on this phone",
  });
  await weightliftingRepository.updateSetField(db, {
    field: "reps",
    value: 7,
    setId,
  });

  const phoneVersion = exercise().sync_version;
  const otherVersion = phoneVersion + 60;
  const cloudId = exercise().cloud_exercise_instance_id;

  // The other phone, a minute later.
  await cloud
    .from("exercise_instance")
    .update({
      note: "Written on the other phone",
      sync_version: otherVersion,
      last_updated: new Date(otherVersion * 1000).toISOString(),
    })
    .eq("id", cloudId);

  await pushDirtyStrengthHierarchyWithCloud(db);

  assert.strictEqual(cloudRow("set", set().cloud_set_id).reps, 7, "the set did not go up");
  assert.strictEqual(
    cloudRow("exercise_instance", cloudId).note,
    "Written on the other phone",
    "the older edit went up over the newer one"
  );
  assert.strictEqual(exercise().needs_sync, 1);
  assert.strictEqual(
    exercise().sync_version,
    phoneVersion,
    "looking the parent up gave the waiting exercise the cloud's version"
  );

  await pushDirtyStrengthHierarchyWithCloud(db);
  assert.strictEqual(
    cloudRow("exercise_instance", cloudId).note,
    "Written on the other phone",
    "the next push sent the older edit over the newer one"
  );

  // The next full sync brings the newer edit down, and it is settled.
  await syncExerciseInstancesWithCloud(db);
  assert.strictEqual(exercise().note, "Written on the other phone");
  assert.strictEqual(exercise().needs_sync, 0);
  assert.strictEqual(exercise().sync_version, otherVersion);
}

// The reconcile marks rows synced through the same functions, from a snapshot
// it read before its own writes, so the rule is checked on them directly as
// well.
async function markSyncedOnlyClearsTheVersionItWasGiven(db, ids) {
  const MARKERS = [
    {
      table: "Program",
      idColumn: "program_id",
      cloudIdColumn: "cloud_program_id",
      mark: (args) =>
        programRepository.markProgramSynced(db, {
          programId: ids.programId,
          cloudProgramId: args.cloudId,
          ...args.rest,
        }),
      dirty: () =>
        programRepository.updateProgramName(db, {
          programId: ids.programId,
          programName: "again",
        }),
      id: ids.programId,
    },
    {
      table: "Mesocycle",
      idColumn: "mesocycle_id",
      cloudIdColumn: "cloud_mesocycle_id",
      mark: (args) =>
        programRepository.markMesocycleSynced(db, {
          mesocycleId: ids.mesocycleId,
          cloudMesocycleId: args.cloudId,
          ...args.rest,
        }),
      dirty: () =>
        programRepository.updateMesocycleFocus(db, {
          mesocycleId: ids.mesocycleId,
          focus: "again",
        }),
      id: ids.mesocycleId,
    },
    {
      table: "Microcycle",
      idColumn: "microcycle_id",
      cloudIdColumn: "cloud_microcycle_id",
      mark: (args) =>
        programRepository.markMicrocycleSynced(db, {
          microcycleId: ids.microcycleId,
          cloudMicrocycleId: args.cloudId,
          ...args.rest,
        }),
      dirty: () =>
        programRepository.updateMicrocycleFocus(db, {
          microcycleId: ids.microcycleId,
          focus: "again",
        }),
      id: ids.microcycleId,
    },
    {
      table: "Day",
      idColumn: "day_id",
      cloudIdColumn: "cloud_day_id",
      mark: (args) =>
        programRepository.markDaySynced(db, {
          dayId: ids.dayId,
          cloudDayId: args.cloudId,
          ...args.rest,
        }),
      dirty: () =>
        programRepository.updateDaySick(db, { dayId: ids.dayId, isSick: true }),
      id: ids.dayId,
    },
    {
      table: "Workout_Type_Instance",
      idColumn: "workout_id",
      cloudIdColumn: "cloud_workout_type_instance_id",
      mark: (args) =>
        programRepository.markWorkoutSynced(db, {
          workoutId: ids.workoutId,
          cloudWorkoutTypeInstanceId: args.cloudId,
          ...args.rest,
        }),
      dirty: () =>
        workoutRepository.updateWorkoutDone(db, {
          workoutId: ids.workoutId,
          done: false,
        }),
      id: ids.workoutId,
    },
    {
      table: "Exercise_Instance",
      idColumn: "exercise_instance_id",
      cloudIdColumn: "cloud_exercise_instance_id",
      mark: (args) =>
        weightliftingRepository.markExerciseSynced(db, {
          exerciseId: ids.exerciseId,
          cloudExerciseInstanceId: args.cloudId,
          ...args.rest,
        }),
      dirty: () =>
        weightliftingRepository.updateExerciseNote(db, {
          exerciseId: ids.exerciseId,
          note: "again",
        }),
      id: ids.exerciseId,
    },
    {
      table: "Set",
      idColumn: "sets_id",
      cloudIdColumn: "cloud_set_id",
      mark: (args) =>
        weightliftingRepository.markSetSynced(db, {
          setId: ids.setId,
          cloudSetId: args.cloudId,
          ...args.rest,
        }),
      dirty: () =>
        weightliftingRepository.updateSetField(db, {
          field: "reps",
          value: 6,
          setId: ids.setId,
        }),
      id: ids.setId,
    },
  ];

  for (const { table, idColumn, cloudIdColumn, mark, dirty, id } of MARKERS) {
    const row = () => localRow(db, table, idColumn, id);

    await dirty();
    const readVersion = row().sync_version;
    await dirty();
    const writtenVersion = row().sync_version;
    const cloudId = row()[cloudIdColumn] + 1000;

    // An upload of the older version answers: the newer write stays dirty.
    await mark({
      cloudId,
      rest: { expectedSyncVersion: readVersion, syncVersion: readVersion },
    });
    assert.strictEqual(row().needs_sync, 1, `${table}: a newer write lost its flag`);
    assert.strictEqual(
      row().sync_version,
      writtenVersion,
      `${table}: a newer write lost its version`
    );
    assert.strictEqual(
      row()[cloudIdColumn],
      cloudId,
      `${table}: the cloud identity the upload got back was dropped`
    );

    // The version the row still has: clean, at the cloud's version.
    await mark({
      cloudId,
      rest: {
        expectedSyncVersion: writtenVersion,
        syncVersion: writtenVersion + 1,
      },
    });
    assert.strictEqual(row().needs_sync, 0, `${table}: an unchanged row stayed dirty`);
    assert.strictEqual(row().sync_version, writtenVersion + 1);

    // Without a version to check, the guard cannot hold. Say so, rather than
    // match nothing and leave the row uploading forever.
    await assert.rejects(
      mark({ cloudId, rest: {} }),
      /expectedSyncVersion/,
      `${table}: marked synced without saying which version was uploaded`
    );
  }
}

// The identity helpers are called for a row the cloud already has: by a
// child's upload for its parent, by a mark*Synced whose version no longer
// matches, and by a reconcile for a row with an edit waiting. A row with
// nothing to upload takes the cloud's version; a waiting one keeps its own
// version and deletion, which belong to its edit.
async function cloudIdentityKeepsAWaitingRowsVersion(db, ids) {
  const HELPERS = [
    ["Program", "program_id", "cloud_program_id", ids.programId,
      (args) => programRepository.updateProgramCloudIdentity(db, { programId: ids.programId, cloudProgramId: args.cloudId, ...args.rest })],
    ["Mesocycle", "mesocycle_id", "cloud_mesocycle_id", ids.mesocycleId,
      (args) => programRepository.updateMesocycleCloudIdentity(db, { mesocycleId: ids.mesocycleId, cloudMesocycleId: args.cloudId, ...args.rest })],
    ["Microcycle", "microcycle_id", "cloud_microcycle_id", ids.microcycleId,
      (args) => programRepository.updateMicrocycleCloudIdentity(db, { microcycleId: ids.microcycleId, cloudMicrocycleId: args.cloudId, ...args.rest })],
    ["Day", "day_id", "cloud_day_id", ids.dayId,
      (args) => programRepository.updateDayCloudIdentity(db, { dayId: ids.dayId, cloudDayId: args.cloudId, ...args.rest })],
    ["Workout_Type_Instance", "workout_id", "cloud_workout_type_instance_id", ids.workoutId,
      (args) => programRepository.updateWorkoutCloudIdentity(db, { workoutId: ids.workoutId, cloudWorkoutTypeInstanceId: args.cloudId, ...args.rest })],
    ["Exercise_Instance", "exercise_instance_id", "cloud_exercise_instance_id", ids.exerciseId,
      (args) => weightliftingRepository.updateExerciseCloudIdentity(db, { exerciseId: ids.exerciseId, cloudExerciseInstanceId: args.cloudId, ...args.rest })],
    ["Set", "sets_id", "cloud_set_id", ids.setId,
      (args) => weightliftingRepository.updateSetCloudIdentity(db, { setId: ids.setId, cloudSetId: args.cloudId, ...args.rest })],
  ];

  for (const [table, idColumn, cloudIdColumn, id, identify] of HELPERS) {
    const row = () => localRow(db, table, idColumn, id);
    const cloudId = row()[cloudIdColumn] + 2000;
    const setRow = (needsSync) =>
      db.sqlite
        .prepare(`UPDATE "${table}" SET needs_sync = ?, sync_version = 500, deleted_at = NULL WHERE ${idColumn} = ?;`)
        .run(needsSync, id);
    const fromTheCloud = {
      syncId: `${table}-cloud-sync-id`,
      syncVersion: 400,
      deletedAt: "2026-09-27T10:00:00.000Z",
    };

    setRow(1);
    await identify({ cloudId, rest: fromTheCloud });
    assert.strictEqual(row()[cloudIdColumn], cloudId, `${table}: the cloud identity was not recorded`);
    assert.strictEqual(row().sync_id, fromTheCloud.syncId, `${table}: the cloud's sync_id was not recorded`);
    assert.strictEqual(row().sync_version, 500, `${table}: a waiting row was given the cloud's version`);
    assert.strictEqual(row().deleted_at, null, `${table}: a waiting row was given the cloud's deletion`);
    assert.strictEqual(row().needs_sync, 1);

    setRow(0);
    await identify({ cloudId, rest: fromTheCloud });
    assert.strictEqual(row().sync_version, 400, `${table}: a row with nothing to upload keeps an old version`);
    assert.strictEqual(row().deleted_at, fromTheCloud.deletedAt);
  }
}

// All seven bind through sqliteParams: an undefined cloud id reaches the
// database as a null, where a raw array hands expo-sqlite a value it may not
// bind. Run against node:sqlite with nothing in between, which refuses one.
async function markSyncedBindsWhatSqliteCanTake(db, ids) {
  const strict = {
    ...db,
    async runAsync(sql, params = []) {
      const result = db.sqlite.prepare(sql).run(...params);

      return {
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: Number(result.changes),
      };
    },
  };
  const MARKERS = [
    ["Program", "program_id", ids.programId,
      (expectedSyncVersion) => programRepository.markProgramSynced(strict, { programId: ids.programId, expectedSyncVersion, cloudProgramId: undefined })],
    ["Mesocycle", "mesocycle_id", ids.mesocycleId,
      (expectedSyncVersion) => programRepository.markMesocycleSynced(strict, { mesocycleId: ids.mesocycleId, expectedSyncVersion, cloudMesocycleId: undefined })],
    ["Microcycle", "microcycle_id", ids.microcycleId,
      (expectedSyncVersion) => programRepository.markMicrocycleSynced(strict, { microcycleId: ids.microcycleId, expectedSyncVersion, cloudMicrocycleId: undefined })],
    ["Day", "day_id", ids.dayId,
      (expectedSyncVersion) => programRepository.markDaySynced(strict, { dayId: ids.dayId, expectedSyncVersion, cloudDayId: undefined })],
    ["Workout_Type_Instance", "workout_id", ids.workoutId,
      (expectedSyncVersion) => programRepository.markWorkoutSynced(strict, { workoutId: ids.workoutId, expectedSyncVersion, cloudWorkoutTypeInstanceId: undefined })],
    ["Exercise_Instance", "exercise_instance_id", ids.exerciseId,
      (expectedSyncVersion) => weightliftingRepository.markExerciseSynced(strict, { exerciseId: ids.exerciseId, expectedSyncVersion, cloudExerciseInstanceId: undefined })],
    ["Set", "sets_id", ids.setId,
      (expectedSyncVersion) => weightliftingRepository.markSetSynced(strict, { setId: ids.setId, expectedSyncVersion, cloudSetId: undefined })],
  ];

  for (const [table, idColumn, id, mark] of MARKERS) {
    const row = () => localRow(db, table, idColumn, id);

    db.sqlite.prepare(`UPDATE "${table}" SET needs_sync = 1 WHERE ${idColumn} = ?;`).run(id);
    await mark(row().sync_version);
    assert.strictEqual(row().needs_sync, 0, `${table}: not marked synced`);

    // And the fallback, for a version that no longer matches.
    db.sqlite.prepare(`UPDATE "${table}" SET needs_sync = 1 WHERE ${idColumn} = ?;`).run(id);
    await mark(row().sync_version - 1);
    assert.strictEqual(row().needs_sync, 1, `${table}: a newer write lost its flag`);
  }
}

// Every call site hands over the version its decision was made from.
function everyCallSitePassesTheVersion() {
  const CALLERS = [
    ["programSync.js", "programRepository.markProgramSynced", 2],
    ["mesocycleSync.js", "programRepository.markMesocycleSynced", 3],
    ["microcycleSync.js", "programRepository.markMicrocycleSynced", 3],
    ["daySync.js", "programRepository.markDaySynced", 3],
    ["workoutTypeInstanceSync.js", "programRepository.markWorkoutSynced", 3],
    ["exerciseInstanceSync.js", "weightliftingRepository.markExerciseSynced", 2],
    ["setSync.js", "weightliftingRepository.markSetSynced", 3],
  ];

  for (const [file, callee, expectedCalls] of CALLERS) {
    const source = read("src", "Services", "cloudSync", file);
    const calls = source.split(`${callee}(`).slice(1);

    assert.strictEqual(
      calls.length,
      expectedCalls,
      `${file} calls ${callee} ${calls.length} times; update this test`
    );

    for (const call of calls) {
      const argument = call.slice(0, call.indexOf("});"));

      assert.ok(
        /expectedSyncVersion: local\w+\.sync_version/.test(argument),
        `${file}: a ${callee} call does not pass the sync_version the row was read at`
      );
    }
  }
}

async function run() {
  const db = createDatabase();
  const ids = seed(db);

  await baselineSyncsEveryLevel(db);
  await startDuringTheRestartUpload(db, ids);
  await noteEditedDuringItsOwnUpload(db, ids);
  await setTickedOffDuringTheWeightUpload(db, ids);
  await hierarchyRowEditedDuringItsOwnUpload(db, ids);
  await parentBeatenByTheCloudKeepsItsVersion(db, ids);
  await markSyncedOnlyClearsTheVersionItWasGiven(db, ids);
  await cloudIdentityKeepsAWaitingRowsVersion(db, ids);
  await markSyncedBindsWhatSqliteCanTake(db, ids);
  everyCallSitePassesTheVersion();

  console.log(
    "Sync lost update: a write during its row's upload keeps its flag and " +
      "goes up next pass, at every level from program to set; looking a " +
      "row up in the cloud never takes the version of an edit still waiting."
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
