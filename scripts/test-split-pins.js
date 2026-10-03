// A split's sessions pinned to particular workouts: two "Push" sessions that
// are two different workouts each repeat their own, on Home as on the Train
// tab; a deleted pin falls back to the name; a split saved as names only
// still resolves; and before 20261006090000_a-split-pins-its-workouts.sql has
// run, the names reach the cloud and the pins stay on the phone.
//
// splitService runs for real against an in-memory SQLite built from the real
// schema, with Supabase and AsyncStorage replaced by fakes that answer the
// way the project does with and without the split_entries column.
const assert = require("assert/strict");
const { DatabaseSync } = require("node:sqlite");
const loadAppModule = require("./lib/loadAppModule");

/* ------------------------------------------------------------ the fakes -- */

const cloud = {
  hasEntriesColumn: false,
  row: null,
  upserts: [],
  selects: [],
};

function missingColumn(code, column) {
  return code === "42703"
    ? { code, message: `column profile_private.${column} does not exist` }
    : { code, message: `Could not find the '${column}' column of 'profile_private' in the schema cache` };
}

const fakeSupabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
  from(table) {
    if (table !== "profile_private") {
      throw new Error(`the split reached for ${table}`);
    }

    return {
      async upsert(row) {
        if ("split_entries" in row && !cloud.hasEntriesColumn) {
          return { error: missingColumn("PGRST204", "split_entries") };
        }

        cloud.upserts.push(row);
        cloud.row = { ...(cloud.row ?? {}), ...row };
        return { error: null };
      },
      select(columns) {
        cloud.selects.push(columns);

        return {
          eq: () => ({
            async maybeSingle() {
              if (/split_entries/.test(columns) && !cloud.hasEntriesColumn) {
                return { data: null, error: missingColumn("42703", "split_entries") };
              }

              const data = {};

              for (const column of columns.split(",").map((part) => part.trim())) {
                data[column] = cloud.row?.[column] ?? null;
              }

              return { data, error: null };
            },
          }),
        };
      },
    };
  },
  rpc: async () => ({ data: null, error: null }),
  functions: { invoke: async () => ({ data: null, error: null }) },
};

const storage = new Map();

loadAppModule.stubModule("@supabase/supabase-js", { createClient: () => fakeSupabase, processLock: () => {} });
loadAppModule.stubModule("react-native", {
  Platform: { OS: "android" },
  AppState: { addEventListener: () => ({ remove() {} }) },
  I18nManager: {},
  NativeModules: {},
});
loadAppModule.stubModule("@react-native-async-storage/async-storage", {
  __esModule: true,
  default: {
    getItem: async (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: async (key, value) => {
      storage.set(key, value);
    },
    removeItem: async (key) => {
      storage.delete(key);
    },
    getAllKeys: async () => [...storage.keys()],
    multiRemove: async (keys) => keys.forEach((key) => storage.delete(key)),
  },
});
loadAppModule.stubModule("expo-location", {
  getForegroundPermissionsAsync: async () => ({ granted: false, canAskAgain: false }),
});
loadAppModule.stubModule("expo-notifications", {
  setNotificationHandler() {},
  getPermissionsAsync: async () => ({ status: "denied" }),
});
loadAppModule.stubModule("expo-constants", { default: {} });
loadAppModule.stubModule("react-native-url-polyfill/auto", {});
loadAppModule.stubModule("expo-sqlite/localStorage/install", {});
loadAppModule.stubModule("expo-secure-store", {});

// Background uploads reach programService through a dynamic import this
// loader leaves to Node; signed out, they would stop anyway.
const consoleError = console.error;
console.error = (...args) => {
  if (typeof args[0] === "string" && /cloud push failed|sync failed/i.test(args[0])) {
    return;
  }

  consoleError(...args);
};
const consoleWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === "string" && /split|sync/i.test(args[0])) {
    return;
  }

  consoleWarn(...args);
};

const splitService = loadAppModule("src/Services/splitService.js");
const entriesUtil = loadAppModule("src/Utils/splitEntries.js");
const splitUtil = loadAppModule("src/Utils/splitCard.js");
const programRepository = loadAppModule("src/Repository/programRepository.js");
const fs = require("fs");
const path = require("path");
const { programSchemaSql } = loadAppModule("src/Database/schema/program.js");
const { weightliftingSchemaSql } = loadAppModule("src/Database/schema/weightlifting.js");
const { runningSchemaSql } = loadAppModule("src/Database/schema/running.js");

/* ------------------------------------------------------------ the phone -- */

function database() {
  const sqlite = new DatabaseSync(":memory:");
  const bind = (params) =>
    (Array.isArray(params) ? params : params === undefined ? [] : [params]).map((value) =>
      value === undefined ? null : typeof value === "boolean" ? Number(value) : value
    );

  sqlite.exec(programSchemaSql);
  sqlite.exec(weightliftingSchemaSql);
  sqlite.exec(runningSchemaSql);

  return {
    databasePath: "test-split-pins",
    sqlite,
    async execAsync(sql) {
      sqlite.exec(sql);
    },
    async runAsync(sql, params) {
      const result = sqlite.prepare(sql).run(...bind(params));
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    async getAllAsync(sql, params) {
      return sqlite.prepare(sql).all(...bind(params)).map((row) => ({ ...row }));
    },
    async getFirstAsync(sql, params) {
      const row = sqlite.prepare(sql).get(...bind(params));
      return row ? { ...row } : null;
    },
    async isInTransactionAsync() {
      return Boolean(sqlite.isTransaction);
    },
  };
}

const USER = "user-1";
const pad = (value) => String(value).padStart(2, "0");
const localDate = (date) => `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
const daysAgo = (days) => {
  const date = new Date();

  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
};

let nextSetId = 1;

function workout(
  db,
  id,
  { label, days, date: storedDate, done = 1, syncId = `sync-${id}`, weight = 60, exercises = ["Bench press", "Dips"], type = "Resistance" }
) {
  const date = storedDate ?? localDate(daysAgo(days));

  db.sqlite.prepare("INSERT INTO Day (day_id, Weekday, date) VALUES (?, 'Monday', ?)").run(id, date);
  db.sqlite
    .prepare(
      `INSERT INTO Workout_Type_Instance (workout_id, day_id, date, label, workout_type, done, sync_id, sync_version, needs_sync)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)`
    )
    .run(id, id, date, label, type, done, syncId);
  exercises.forEach((name, index) => {
    const exerciseId = id * 10 + index;

    db.sqlite
      .prepare(
        `INSERT INTO Exercise_Instance (exercise_instance_id, workout_type_instance_id, exercise_name, exercise_order, sets, done)
         VALUES (?, ?, ?, ?, 1, ?)`
      )
      .run(exerciseId, id, name, index, done);
    db.sqlite
      .prepare(`INSERT INTO "Set" (sets_id, set_number, exercise_instance_id, reps, weight, done) VALUES (?, 1, ?, 8, ?, ?)`)
      .run(nextSetId++, exerciseId, weight, done);
  });
}

function resetPhone() {
  storage.clear();
}

async function main() {
  const db = database();

  // The owner's case: one Push, twice - heavy and light - plus Pull.
  workout(db, 1, { label: "Push", days: 9, weight: 100, syncId: "push-heavy" });
  workout(db, 2, { label: "Push", days: 6, weight: 60, syncId: "push-light" });
  workout(db, 3, { label: "Pull", days: 4, exercises: ["Row"] });
  // The newest Push of all, done as neither.
  workout(db, 4, { label: "Push", days: 1, weight: 80, syncId: "push-other" });

  const chosen = [
    { name: "Push", workout: "push-heavy" },
    { name: "Pull", workout: null },
    { name: "Push", workout: "push-light" },
  ];

  /* ------------------------------------- before the migration has run -- */

  cloud.hasEntriesColumn = false;

  const saved = await splitService.saveChosenSplit({ userId: USER, entries: chosen });

  assert.equal(saved.length, 3, "two sessions of one name are both kept");
  assert.deepEqual(cloud.row.split_names, ["Push", "Pull", "Push"], "the names still reach the cloud, twice Push and all");
  assert.ok(!("split_entries" in cloud.row), "no split_entries is sent once the cloud has said it has none");
  assert.ok(
    cloud.upserts.every((row) => Array.isArray(row.split_names)),
    "a missing split_entries column turned off the names too"
  );

  // Read back: the names from the cloud, the pins from the phone.
  const readBack = await splitService.getChosenSplitEntries({ userId: USER });

  assert.deepEqual(
    readBack.map((entry) => entry.workout),
    ["push-heavy", null, "push-light"],
    "the pins were lost on the way back from a cloud without split_entries"
  );

  const home = await splitService.getHomeSplitGroups(db, { userId: USER });

  assert.deepEqual(home.map((group) => group.lastWorkoutId), [1, 3, 2], "each Push opens its own workout, not the newest Push");
  assert.ok(home.every((group) => group.isChosen));

  const card = await splitService.getSplitCard(db, { userId: USER });

  assert.equal(card.source, "chosen");
  assert.deepEqual(
    card.sessions.map((session) => session.lastWorkoutId),
    home.map((group) => group.lastWorkoutId),
    "Home and the Train tab repeat different workouts"
  );
  assert.deepEqual(
    card.sessions.map((session) => session.isUpNext),
    home.map((group) => group.isUpNext),
    "Home and the Train tab disagree about what is next"
  );
  assert.equal(card.sessions[0].isUpNext, true, "the heavy Push, done nine days ago, has waited longest");
  assert.ok(card.chosenEntries[0].pinnedAt, "the editor is told each picked workout's day");

  // Repeat and Start copy `lastWorkoutId` (programService.repeatWorkoutToday,
  // copyWorkoutToStandaloneDate - unchanged): the heavy Push's own workout,
  // its exercises at its weights, not the newest Push's.
  const weightsOf = (workoutId) =>
    db.sqlite
      .prepare(
        `SELECT s.weight FROM "Set" s JOIN Exercise_Instance ei ON ei.exercise_instance_id = s.exercise_instance_id
         WHERE ei.workout_type_instance_id = ? ORDER BY ei.exercise_order`
      )
      .all(workoutId)
      .map((row) => row.weight);

  assert.deepEqual(weightsOf(home[0].lastWorkoutId), [100, 100], "the heavy Push would be repeated at another Push's weights");
  assert.deepEqual(weightsOf(home[2].lastWorkoutId), [60, 60], "the light Push would be repeated at another Push's weights");

  // The copy that start makes, as it lands: planned today, its sync_id not
  // given yet - which noteSplitSessionStarted sees to.
  workout(db, 5, { label: "Push", days: 0, done: 0, weight: 100, syncId: null });
  const copied = { workout_id: 5 };

  // Started from the split: the copy is kept on its entry, and once it is
  // finished that Push - and only that one - was trained today.
  await splitService.noteSplitSessionStarted(db, { userId: USER, entry: home[0].entry, workoutId: copied.workout_id });

  const afterStart = await splitService.getChosenSplitEntries({ userId: USER });
  const copySyncId = db.sqlite.prepare("SELECT sync_id FROM Workout_Type_Instance WHERE workout_id = ?").get(copied.workout_id).sync_id;

  assert.equal(afterStart[0].last, copySyncId, "the copy was not kept on the heavy Push's entry");
  assert.equal(afterStart[2].last, null, "the light Push got the heavy Push's copy");

  db.sqlite.prepare("UPDATE Workout_Type_Instance SET done = 1 WHERE workout_id = ?").run(copied.workout_id);

  const afterDone = await splitService.getSplitCard(db, { userId: USER });

  assert.equal(afterDone.sessions[0].daysSince, 0, "the heavy Push was done today");
  assert.equal(afterDone.sessions[2].daysSince, 6, "the light Push counted the heavy Push's workout as its own");
  assert.deepEqual(afterDone.sessions.map((session) => session.isUpNext), [false, false, true], "next is the Push that has waited");

  // A new phone before the migration: the names alone, and two Pushes by
  // name are one session - Push and Pull, each its latest workout.
  resetPhone();
  assert.deepEqual(
    (await splitService.getChosenSplitEntries({ userId: USER })).map((entry) => [entry.name, entry.workout]),
    [
      ["Push", null],
      ["Pull", null],
    ]
  );

  /* -------------------------------------------- after the migration -- */

  // A new session of the app, against a project that has run it.
  loadAppModule.stubModule("@supabase/supabase-js", { createClient: () => fakeSupabase, processLock: () => {} });
  const afterMigration = loadAppModule("src/Services/splitService.js");

  cloud.hasEntriesColumn = true;
  cloud.row = null;
  cloud.upserts = [];

  await afterMigration.saveChosenSplit({ userId: USER, entries: chosen });
  assert.deepEqual(
    cloud.row.split_entries.map((entry) => entry.workout),
    ["push-heavy", null, "push-light"],
    "the pins did not reach the cloud"
  );
  assert.deepEqual(cloud.row.split_names, ["Push", "Pull", "Push"], "the names stopped going up beside them");

  // A new phone: the pins come from the cloud.
  resetPhone();

  const fresh = await afterMigration.getHomeSplitGroups(db, { userId: USER });

  assert.ok(
    fresh.every((group) => !group.isChosen),
    "Home does not wait for the cloud: the guess until the cloud's split is on the phone"
  );
  // The fetch behind Home has put the cloud's split on the phone.
  await new Promise((resolve) => setTimeout(resolve, 10));

  const synced = await afterMigration.getHomeSplitGroups(db, { userId: USER });

  assert.deepEqual(synced.map((group) => group.lastWorkoutId), [1, 3, 2], "a new phone lost the pins");

  // A build from before pins edits the split: it writes the names only, and
  // the entries in the cloud are stale.
  cloud.row = { ...cloud.row, split_names: ["Pull", "Push"] };
  resetPhone();

  const edited = await afterMigration.getChosenSplitEntries({ userId: USER });

  assert.deepEqual(
    edited.map((entry) => [entry.name, entry.workout]),
    [
      ["Pull", null],
      ["Push", "push-heavy"],
    ],
    "the older build's names decide the sessions; the first Push keeps its pin"
  );

  /* ------------------------------------------------- a deleted pin -- */

  await afterMigration.saveChosenSplit({ userId: USER, entries: chosen });
  db.sqlite.prepare("UPDATE Workout_Type_Instance SET deleted_at = '2026-09-30T10:00:00Z' WHERE workout_id = 1").run();

  const afterDelete = await afterMigration.getHomeSplitGroups(db, { userId: USER });

  assert.equal(
    afterDelete[0].lastWorkoutId,
    copied.workout_id,
    "a deleted pin repeats the latest Push by name - today's copy - rather than nothing"
  );
  assert.equal(afterDelete[2].lastWorkoutId, 2, "the other Push keeps its own");

  /* ------------------------------------------ names only, from before -- */

  resetPhone();
  storage.set(`fitven.split.${USER}`, JSON.stringify({ names: ["Push", "Pull"], pending: false }));
  cloud.row = { user_id: USER, split_names: ["Push", "Pull"], split_entries: null };

  const legacy = await afterMigration.getHomeSplitGroups(db, { userId: USER });

  assert.deepEqual(
    legacy.map((group) => group.lastWorkoutId),
    [copied.workout_id, 3],
    "a split saved as names finds the latest workout of each name, as it always has"
  );
  assert.deepEqual(
    entriesUtil.readSplitCache({ names: ["Push", "Pull"] }).entries.map((entry) => entry.workout),
    [null, null]
  );

  /* ------------------------------- Home without the workout library -- */

  // Home loads on every focus, so it must not read the library (500 rows,
  // each with its counts and record check) to resolve six sessions. It reads
  // the newest workout of each name instead, and has to land on exactly what
  // the Train tab lands on: names compared normalised ("Push 2" is Push), a
  // planned or run session's fallback, a pin, and the library's 500-workout
  // window.
  const library = database();
  const OTHER_USER = "user-2";

  workout(library, 1, { label: "Ancient", days: 400 });
  // 500 newer workouts push Ancient out of the library's window.
  for (let id = 2; id <= 501; id += 1) {
    workout(library, id, { label: "Filler", days: 30, exercises: [] });
  }
  workout(library, 600, { label: "Push", days: 12, weight: 70 });
  workout(library, 601, { label: "Push 2", days: 3, exercises: ["Bench press", "Dips", "Flyes"] });
  workout(library, 602, { label: "Mobility", days: -2, done: 0, exercises: ["Hip opener"] });
  workout(library, 603, { label: "Easy run", days: 5, type: "Run", exercises: [] });
  workout(library, 604, { label: "Øvre krop", days: 8, type: "Upperbody" });
  workout(library, 605, { label: "Legs", days: 15, syncId: "legs-old", exercises: ["Squat", "Lunge", "Calf raise"] });
  workout(library, 606, { label: "Legs (2026-01-04)", days: 2, exercises: ["Squat"] });
  workout(library, 607, { label: "Resistance", days: 1 }); // an unnamed quick start

  // One exercise of the old Legs deleted with its set left as it was, and one
  // set of a live exercise deleted: neither is counted.
  library.sqlite.prepare("UPDATE Exercise_Instance SET deleted_at = '2026-09-30T10:00:00Z' WHERE exercise_instance_id = 6051").run();
  library.sqlite.prepare(`UPDATE "Set" SET deleted_at = '2026-09-30T10:00:00Z' WHERE exercise_instance_id = 6052`).run();

  await afterMigration.saveChosenSplit({
    userId: OTHER_USER,
    entries: [
      { name: "Push", workout: null },
      { name: "Mobility", workout: null },
      { name: "Easy run", workout: null },
      { name: "Øvre krop", workout: null },
      { name: "Ancient", workout: null },
      { name: "Legs", workout: "legs-old" },
    ],
  });

  const queries = [];
  const getAllAsync = library.getAllAsync;
  const execAsync = library.execAsync;

  library.getAllAsync = async (sql, params) => {
    const rows = await getAllAsync.call(library, sql, params);
    queries.push({ sql, params, rows: rows.length });
    return rows;
  };
  library.execAsync = async (sql) => {
    queries.push({ sql, params: [], rows: 0 });
    return execAsync.call(library, sql);
  };

  const homeGroups = await afterMigration.getHomeSplitGroups(library, { userId: OTHER_USER });
  const homeQueries = queries.splice(0);

  library.getAllAsync = getAllAsync;
  library.execAsync = execAsync;

  assert.ok(homeGroups.every((group) => group.isChosen), "Home drew the guess, not the chosen split");
  assert.ok(
    homeQueries.every(({ sql }) => !/Workout_Favorite|completed_set_count|has_personal_record/.test(sql)),
    "Home read the workout library to resolve its split"
  );
  assert.ok(
    homeQueries.reduce((sum, query) => sum + query.rows, 0) < 20,
    `Home read ${homeQueries.reduce((sum, query) => sum + query.rows, 0)} rows for six sessions`
  );

  const trainCard = await afterMigration.getSplitCard(library, { userId: OTHER_USER });

  assert.equal(trainCard.source, "chosen");
  assert.deepEqual(homeGroups, splitUtil.homeGroupsFromSplit(trainCard.sessions), "Home and the Train tab resolve the split differently");
  assert.deepEqual(
    trainCard.sessions.map((session) => [session.name, session.lastWorkoutId]),
    [
      ["Push", 601],
      ["Mobility", 602],
      ["Easy run", 603],
      ["Øvre krop", 604],
      ["Ancient", null],
      ["Legs", 605],
    ],
    "Push 2 is the newest Push, a planned and a run session repeat their own, Ancient is past the window, the pin is kept"
  );
  assert.equal(trainCard.sessions[1].lastTrainedAt, null, "a planned workout was never trained");
  assert.equal(trainCard.sessions[5].daysSince, 2, "the pinned Legs was last trained with the newest Legs");
  assert.deepEqual(
    [trainCard.sessions[5].exerciseCount, trainCard.sessions[5].setCount],
    [2, 1],
    "the pinned Legs counts a deleted exercise, or the set of one, or a deleted set"
  );
  assert.ok(!homeGroups.some((group) => group.name === "Ancient"), "a session with nothing to copy has no card");

  // The pinned workout is found through its sync_id, and that has an index.
  const indexSql = fs
    .readFileSync(path.join(__dirname, "..", "src", "Database", "db.js"), "utf8")
    .match(/CREATE INDEX IF NOT EXISTS workout_type_instance_sync_id_idx[\s\S]*?;/)?.[0];

  assert.ok(indexSql, "db.js has no index on Workout_Type_Instance(sync_id)");
  library.sqlite.exec(indexSql);

  const bySyncId = homeQueries.find(({ sql }) => /w\.sync_id IN/.test(sql));
  const plan = library.sqlite.prepare(`EXPLAIN QUERY PLAN ${bySyncId.sql}`).all(...bySyncId.params);

  assert.ok(
    plan.some((line) => /workout_type_instance_sync_id_idx/.test(line.detail)),
    "the pinned workouts are looked up by scanning every workout"
  );

  // The counts the library and the pinned lookup give the old Legs: its two
  // live exercises, and the one live set left between them.
  const libraryLegs = (await programRepository.getWorkoutLibrary(library, { limit: 1000 })).find((row) => row.workout_id === 605);
  const pinnedLegs = (await programRepository.getWorkoutsBySyncIds(library, ["legs-old"]))[0];
  const newestLegs = (await programRepository.getNewestWorkoutOfEachName(library, { limit: 1000 })).find(
    (row) => row.workout_id === 605
  );

  for (const [where, row] of [
    ["the library", libraryLegs],
    ["the pinned lookup", pinnedLegs],
    ["the newest of each name", newestLegs],
  ]) {
    assert.deepEqual([row.exercise_count, row.set_count], [2, 1], `${where} counts deleted exercises or sets`);
  }
  assert.equal(libraryLegs.completed_set_count, 1, "the library counts a deleted exercise's done set");

  /* ------------------------------------- the newest of each name, edges -- */

  // Rows the SQL and the split could read differently: a date nobody can
  // read, one name both done and planned, and two of a name on one day.
  // Home (getNewestWorkoutOfEachName) and the Train tab (the library) must
  // land on the same workout for each, and on the right one.
  const edges = database();
  const EDGE_USER = "user-3";

  workout(edges, 800, { label: "Arms", days: 10 });
  // Sorted as text, "not a date" comes before every real date - so it would
  // stand in front of the Arms the split can date, if the SQL kept it.
  workout(edges, 801, { label: "Arms", date: "not a date" });
  workout(edges, 802, { label: "Back", days: 7 });
  workout(edges, 803, { label: "Back", days: -1, done: 0 });
  workout(edges, 804, { label: "Core", days: 4, exercises: ["Plank"] });
  workout(edges, 805, { label: "Core", days: 4, exercises: ["Plank", "Crunch"] });

  await afterMigration.saveChosenSplit({
    userId: EDGE_USER,
    entries: [
      { name: "Arms", workout: null },
      { name: "Back", workout: null },
      { name: "Core", workout: null },
    ],
  });

  const newestRows = await programRepository.getNewestWorkoutOfEachName(edges, { limit: 1000 });

  assert.ok(!newestRows.some((row) => row.workout_id === 801), "a workout with no readable date was kept as the newest of its name");
  assert.deepEqual(
    newestRows.filter((row) => row.label === "Back").map((row) => [row.workout_id, row.done]).sort(),
    [
      [802, 1],
      [803, 0],
    ],
    "a name both done and planned keeps one row of each"
  );
  assert.deepEqual(
    newestRows.filter((row) => row.label === "Core").map((row) => row.workout_id),
    [805],
    "two of a name on one day: the later one, as the library orders them"
  );

  const edgeHome = await afterMigration.getHomeSplitGroups(edges, { userId: EDGE_USER });
  const edgeTrain = await afterMigration.getSplitCard(edges, { userId: EDGE_USER });

  assert.ok(edgeHome.every((group) => group.isChosen), "Home drew the guess, not the chosen split");
  assert.deepEqual(edgeHome, splitUtil.homeGroupsFromSplit(edgeTrain.sessions), "Home and the Train tab disagree on the edge cases");
  assert.deepEqual(
    edgeTrain.sessions.map((session) => [session.name, session.lastWorkoutId]),
    [
      ["Arms", 800],
      ["Back", 802],
      ["Core", 805],
    ],
    "the undatable Arms, the planned Back or the earlier Core was repeated"
  );

  /* --------------------------------------------------- the pure parts -- */

  assert.ok(entriesUtil.isMissingSplitEntriesColumnError(missingColumn("42703", "split_entries")));
  assert.ok(entriesUtil.isMissingSplitEntriesColumnError(missingColumn("PGRST204", "split_entries")));
  assert.ok(!entriesUtil.isMissingSplitEntriesColumnError(missingColumn("42703", "split_names")), "a missing split_names is not a missing split_entries");
  assert.ok(!entriesUtil.isMissingSplitNamesColumnError(missingColumn("42703", "split_entries")), "and the other way round");
  assert.deepEqual(entriesUtil.buildSplitCloudPayload(chosen, { withEntries: false }), { split_names: ["Push", "Pull", "Push"] });
  assert.equal(entriesUtil.cleanSplitEntries([{ name: "Push", workout: "a" }, { name: "Push", workout: "a" }]), null, "the same workout twice is one session");
  assert.equal(entriesUtil.cleanSplitEntries(["Push", "push 2"]), null, "and so is one name twice");
  assert.equal(entriesUtil.cleanSplitEntries(Array.from({ length: 8 }, (_, index) => `S${"abcdefgh"[index]}`)).length, 6);

  console.log(
    "split-pins: two Pushes repeat their own, on Home and Train; the copy that says which was done; a new phone; an older build's names; a deleted pin; names only; and before the migration passed."
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
