// What the app itself sends for the developer overview (Dev · Overblik), and
// the paths that decide it:
//
//   started_from   where each workout was started from - program, recent,
//                  calendar, empty or other - set once when the row is
//                  created, and synced with it
//   app opening    when, on which platform and in which version the app was
//                  last opened, on your own profile_private row
//
// Run for real: the normaliser and its row in the sync field table, the
// handle that keeps the workout sync going before the migration has run, the
// local schema and the repository SQL against node:sqlite, the app-open rules,
// and the app-open write against a fake Supabase and a fake AsyncStorage.
//
// Read from the source, because nothing else can check it: that every screen
// creating a workout says how it was started, with the value the table below
// names. A new path that creates a workout fails here until it is added to it.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");

// Git checks files out with CRLF on Windows; every search below runs on LF.
function read(relativePath) {
  return fs
    .readFileSync(path.join(root, relativePath), "utf8")
    .split("\r\n")
    .join("\n");
}

function sourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const relative = `${dir}/${entry.name}`;

    if (entry.isDirectory()) {
      sourceFiles(relative, out);
    } else if (entry.name.endsWith(".js")) {
      out.push(relative);
    }
  }

  return out;
}

const SRC_FILES = sourceFiles("src");

/**
 * The text between the parenthesis at `openIndex` and the one that closes
 * it. Strings and comments are skipped, so a bracket inside one does not
 * count.
 */
function argumentsAt(source, openIndex) {
  let depth = 0;
  let quote = null;

  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];

    if (quote) {
      if (char === "\\") {
        index += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
    } else if (char === "/" && source[index + 1] === "/") {
      index = source.indexOf("\n", index);
    } else if (char === "/" && source[index + 1] === "*") {
      index = source.indexOf("*/", index) + 1;
    } else if ("({[".includes(char)) {
      depth += 1;
    } else if (")}]".includes(char)) {
      depth -= 1;

      if (depth === 0) {
        return source.slice(openIndex + 1, index);
      }
    }
  }

  throw new Error(`Unbalanced call at ${openIndex}`);
}

/** Every call matching `pattern` (which must end at the opening parenthesis). */
function callsIn(source, pattern) {
  const calls = [];

  for (const match of source.matchAll(pattern)) {
    const open = match.index + match[0].length - 1;
    assert.strictEqual(source[open], "(", `${pattern} must end at the (`);
    calls.push({ name: match[1], args: argumentsAt(source, open) });
  }

  return calls;
}

/** What a call's arguments say about startedFrom: a STARTED_FROM name, "passed on", or null. */
function startedFromIn(args) {
  const constant = args.match(/\bstartedFrom\s*:\s*STARTED_FROM\.([A-Z]+)\b/);

  if (constant) {
    return constant[1];
  }

  return /\bstartedFrom\b/.test(args) ? "passed on" : null;
}

/* ----------------------------------------------------- the five values -- */

const startedFrom = loadAppModule("src/Utils/startedFrom.js");
const {
  STARTED_FROM,
  STARTED_FROM_VALUES,
  createStartedFromCloudColumn,
  isMissingStartedFromColumnError,
  normalizeStartedFrom,
  withSendableStartedFrom,
} = startedFrom;

assert.deepStrictEqual(
  [...STARTED_FROM_VALUES],
  ["program", "recent", "calendar", "empty", "other"],
  "the five values the cloud's check constraint accepts"
);
assert.deepStrictEqual(
  Object.keys(STARTED_FROM),
  ["PROGRAM", "RECENT", "CALENDAR", "EMPTY", "OTHER"]
);

for (const value of STARTED_FROM_VALUES) {
  assert.strictEqual(normalizeStartedFrom(value), value);
  assert.strictEqual(normalizeStartedFrom(`  ${value.toUpperCase()} `), value);
}

// Anything else is null: an older row, and every value the check would refuse.
for (const value of [null, undefined, "", "   ", "home", "programs", "program!", 0, 1, true, {}, []]) {
  assert.strictEqual(
    normalizeStartedFrom(value),
    null,
    `${JSON.stringify(value)} is not a place a workout was started from`
  );
}

// Stable under a second pass, or a row would look changed against its own upload.
for (const value of ["program", " Recent ", "CALENDAR", "bogus", null, 7]) {
  assert.strictEqual(
    normalizeStartedFrom(normalizeStartedFrom(value)),
    normalizeStartedFrom(value)
  );
}

/* ------------------------------------------ its row in the field table -- */

const fields = loadAppModule("src/Services/cloudSync/cloudSyncFields.js");
const startedFromField = fields.SYNCED_FIELDS.WorkoutTypeInstance.find(
  (field) => field.key === "started_from"
);

assert.ok(startedFromField, "SYNCED_FIELDS.WorkoutTypeInstance has no started_from row");
assert.strictEqual(startedFromField.inSnapshot, true, "started_from has to be in the snapshot - the reconcile reads it from there");
assert.strictEqual(startedFromField.inPayload, true, "started_from has to be uploaded");
assert.strictEqual(startedFromField.fromPayloadHead, false);
assert.strictEqual(
  startedFromField.compare,
  false,
  "started_from is not compared: a row the cloud got before the column would count as changed on every pull"
);

const baseWorkout = {
  workout_id: 5,
  date: "01.10.2026",
  label: "Push",
  workout_type: "resistance",
  done: 1,
};

assert.strictEqual(
  fields.buildSnapshot("WorkoutTypeInstance", { ...baseWorkout, started_from: " Recent " }).started_from,
  "recent"
);
assert.strictEqual(
  fields.buildPayloadFields("WorkoutTypeInstance", { ...baseWorkout, started_from: "bogus" }).started_from,
  null,
  "a value the check constraint refuses would fail the whole workout upload"
);
assert.strictEqual(
  fields.buildCloudWorkoutTypeInstancePayload(
    { ...baseWorkout, started_from: "calendar" },
    "user-a",
    9
  ).started_from,
  "calendar",
  "the payload the upload sends carries it"
);
assert.ok(
  fields.snapshotsEqual(
    "WorkoutTypeInstance",
    { ...baseWorkout, started_from: "program" },
    { ...baseWorkout, started_from: null }
  ),
  "a difference in started_from alone is not a change to download"
);
assert.ok(
  !fields.snapshotsEqual(
    "WorkoutTypeInstance",
    { ...baseWorkout, started_from: "program" },
    { ...baseWorkout, label: "Pull", started_from: "program" }
  ),
  "a real change still is"
);

/* ------------------------------- before the migration: the fallback -- */

const MISSING_ON_READ = {
  code: "42703",
  message: "column workout_type_instance.started_from does not exist",
  details: null,
  hint: null,
};
const MISSING_ON_WRITE = {
  code: "PGRST204",
  message: "Could not find the 'started_from' column of 'workout_type_instance' in the schema cache",
  details: null,
  hint: null,
};

assert.ok(isMissingStartedFromColumnError(MISSING_ON_READ));
assert.ok(isMissingStartedFromColumnError(MISSING_ON_WRITE));
assert.ok(
  !isMissingStartedFromColumnError({
    code: "42703",
    message: "column workout_type_instance.gym_id does not exist",
  }),
  "another missing column is somebody else's migration"
);
assert.ok(
  !isMissingStartedFromColumnError({ code: "42703", message: "column started_from_x does not exist" }),
  "a word match, not a substring"
);
assert.ok(!isMissingStartedFromColumnError({ message: "TypeError: Network request failed", code: "" }));
assert.ok(!isMissingStartedFromColumnError(null));

// The payload: null is never sent, and nothing is sent without the column.
assert.deepStrictEqual(
  withSendableStartedFrom({ id: 1, started_from: "program" }),
  { id: 1, started_from: "program" }
);
assert.deepStrictEqual(
  withSendableStartedFrom({ id: 1, started_from: null }),
  { id: 1 },
  "a null would erase what the phone that created the workout sent"
);
assert.deepStrictEqual(
  withSendableStartedFrom({ id: 1, started_from: "program" }, { cloudHasColumn: false }),
  { id: 1 }
);
assert.deepStrictEqual(withSendableStartedFrom({ id: 1 }), { id: 1 });

{
  const payload = { id: 1, started_from: null };
  withSendableStartedFrom(payload);
  assert.deepStrictEqual(payload, { id: 1, started_from: null }, "the row's own payload is not changed");
}

async function fallbackChecks() {
  // A read, the way the reconcile does it: the request reads the handle each
  // time it runs, so the retry leaves the column out.
  {
    let notices = 0;
    const column = createStartedFromCloudColumn({ onMissing: () => (notices += 1) });
    const selects = [];

    assert.ok(column.isAvailable());
    assert.strictEqual(column.selectColumns("id, done"), "id, done, started_from");

    const rows = await column.withFallback(async () => {
      const select = column.selectColumns("id, done");
      selects.push(select);

      if (select.includes("started_from")) {
        throw MISSING_ON_READ;
      }

      return [{ id: 1 }];
    });

    assert.deepStrictEqual(rows, [{ id: 1 }], "the sync goes on without the column");
    assert.deepStrictEqual(selects, ["id, done, started_from", "id, done"], "one retry, without it");
    assert.strictEqual(notices, 1);
    assert.strictEqual(column.isAvailable(), false);

    // And for the rest of the session nothing names it.
    assert.strictEqual(column.selectColumns("id, done"), "id, done");
    assert.deepStrictEqual(column.sendablePayload({ id: 1, started_from: "program" }), { id: 1 });

    let later = 0;
    await column.withFallback(async () => {
      later += 1;
    });
    assert.strictEqual(later, 1);
  }

  // A write, the way the upload does it: the payload is built inside the request.
  {
    const column = createStartedFromCloudColumn();
    const sent = [];

    await column.withFallback(async () => {
      const payload = column.sendablePayload({ id: 7, started_from: "empty" });
      sent.push(payload);

      if ("started_from" in payload) {
        throw MISSING_ON_WRITE;
      }
    });

    assert.deepStrictEqual(sent, [{ id: 7, started_from: "empty" }, { id: 7 }]);
  }

  // Any other failure is the sync's own: thrown, not retried, nothing flipped.
  for (const error of [
    { code: "42703", message: "column workout_type_instance.gym_id does not exist" },
    { code: "", message: "TypeError: Network request failed" },
    { code: "23514", message: 'new row violates check constraint "workout_type_instance_started_from_known"' },
  ]) {
    const column = createStartedFromCloudColumn();
    let runs = 0;

    await assert.rejects(
      column.withFallback(async () => {
        runs += 1;
        throw error;
      }),
      (thrown) => thrown === error
    );
    assert.strictEqual(runs, 1, `${error.message} must not be retried`);
    assert.ok(column.isAvailable(), `${error.message} must not drop the column`);
  }

  // Missing again after the fallback: thrown, and not retried a second time.
  {
    const column = createStartedFromCloudColumn();
    let runs = 0;

    await assert.rejects(
      column.withFallback(async () => {
        runs += 1;
        throw MISSING_ON_WRITE;
      })
    );
    assert.strictEqual(runs, 2);
  }
}

/* ------------------------- the sync module goes through that handle -- */

{
  const shared = read("src/Services/cloudSync/cloudSyncShared.js");
  const baseSelect = shared.match(
    /WORKOUT_TYPE_INSTANCE_CLOUD_SYNC_SELECT =\s*"([^"]+)"/
  )?.[1];

  assert.ok(baseSelect, "WORKOUT_TYPE_INSTANCE_CLOUD_SYNC_SELECT is gone");
  assert.ok(
    !/\bstarted_from\b/.test(baseSelect),
    "the shared select must not name started_from - the queued deletes use it without the fallback"
  );

  const sync = read("src/Services/cloudSync/workoutTypeInstanceSync.js");
  const guarded = callsIn(sync, /startedFromColumn\.(withFallback)\(/g);

  assert.strictEqual(guarded.length, 2, "the reconcile's read and the upload, both through the handle");

  const [upload, reconcileRead] = guarded;

  assert.ok(upload.args.includes("syncDirtyLocalRowToCloud("), "the upload goes through the handle");
  assert.ok(
    upload.args.includes("startedFromColumn.selectColumns(") &&
      upload.args.includes("startedFromColumn.sendablePayload(payload)"),
    "the upload builds its select and payload inside the request, so the retry rebuilds both"
  );
  assert.ok(
    reconcileRead.args.includes(".from(WORKOUT_TYPE_INSTANCE_CLOUD_TABLE)") &&
      reconcileRead.args.includes("startedFromColumn.selectColumns(WORKOUT_TYPE_INSTANCE_CLOUD_SYNC_SELECT)"),
    "the reconcile reads through the handle"
  );
  assert.ok(
    !/\.select\(WORKOUT_TYPE_INSTANCE_CLOUD_SYNC_SELECT\)/.test(sync),
    "no read of the table outside the handle"
  );

  // Every write the reconcile makes carries the cloud's value.
  const writes = callsIn(
    sync,
    /programRepository\.(createWorkoutFromCloud|updateWorkoutFromCloud)\(/g
  );

  assert.strictEqual(writes.length, 3, "one create and two updates");
  for (const write of writes) {
    assert.ok(
      /startedFrom:\s*comparableCloudWorkout\.started_from/.test(write.args),
      `${write.name} in the reconcile does not carry started_from - a pulled workout would lose it`
    );
  }
}

/* ----------------------------- the local schema and the repository -- */

async function repositoryChecks() {
  const { programSchemaSql } = loadAppModule("src/Database/schema/program.js");
  const raw = new DatabaseSync(":memory:");
  raw.exec(programSchemaSql);

  const column = raw
    .prepare("PRAGMA table_info(Workout_Type_Instance)")
    .all()
    .find((entry) => entry.name === "started_from");

  assert.ok(column, "a fresh install has no Workout_Type_Instance.started_from");
  assert.strictEqual(column.type, "TEXT");

  // The existing install gets the same column from db.js.
  const dbSource = read("src/Database/db.js");
  const ensureAt = dbSource.indexOf('ensureTableColumns(db, "Workout_Type_Instance", [');
  assert.ok(ensureAt !== -1, "db.js no longer ensures the Workout_Type_Instance columns");
  assert.ok(
    argumentsAt(dbSource, dbSource.indexOf("(", ensureAt)).includes('["started_from", "TEXT"]'),
    "an existing install never gets started_from - add it to ensureTableColumns in db.js"
  );

  const db = {
    runAsync: async (sql, params = []) => {
      const result = raw.prepare(sql).run(...params);
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    getAllAsync: async (sql, params = []) =>
      raw.prepare(sql).all(...params).map((row) => ({ ...row })),
    getFirstAsync: async (sql, params = []) => {
      const row = raw.prepare(sql).get(...params);
      return row ? { ...row } : null;
    },
  };
  const repository = loadAppModule("src/Repository/programRepository.js");
  const storedStartedFrom = (workoutId) =>
    raw.prepare("SELECT started_from FROM Workout_Type_Instance WHERE workout_id = ?").get(workoutId)
      .started_from;

  raw.prepare("INSERT INTO Day (day_id, Weekday, date) VALUES (1, 'Thursday', '01.10.2026')").run();

  const empty = await repository.createWorkout(db, {
    date: "01.10.2026",
    dayId: 1,
    workoutType: "resistance",
    label: null,
    startedFrom: STARTED_FROM.EMPTY,
  });
  assert.strictEqual(storedStartedFrom(empty.lastInsertRowId), "empty");

  // The repository stores what it is given; a value that is not one of the
  // five never reaches the cloud, whose check constraint would refuse it.
  const unknown = await repository.createWorkout(db, {
    date: "01.10.2026",
    dayId: 1,
    workoutType: "resistance",
    label: null,
    startedFrom: "somewhere",
  });
  const [unknownRow] = (await repository.getWorkoutsForCloudSync(db)).filter(
    (row) => row.workout_id === unknown.lastInsertRowId
  );
  assert.deepStrictEqual(
    withSendableStartedFrom(fields.buildCloudWorkoutTypeInstancePayload(unknownRow, "user-a", 9)).started_from,
    undefined,
    "an unrecognised value is normalised to null, and a null is not sent"
  );

  const unsaid = await repository.createWorkout(db, {
    date: "01.10.2026",
    dayId: 1,
    workoutType: "resistance",
    label: null,
  });
  assert.strictEqual(storedStartedFrom(unsaid.lastInsertRowId), null, "no value is null, not a guess");

  const copy = await repository.copyWorkoutIntoDay(db, {
    date: "02.10.2026",
    dayId: 1,
    workoutId: empty.lastInsertRowId,
    startedFrom: STARTED_FROM.RECENT,
  });
  assert.strictEqual(
    storedStartedFrom(copy.lastInsertRowId),
    "recent",
    "a copy is started from how it was copied, not from what the original was"
  );

  const pulled = await repository.createWorkoutFromCloud(db, {
    cloudWorkoutTypeInstanceId: 40,
    remoteLocalWorkoutTypeInstanceId: 400,
    syncId: "1f2e3d4c-0000-0000-0000-000000000000",
    syncVersion: 3,
    deletedAt: null,
    dayId: 1,
    workoutType: "resistance",
    date: "01.10.2026",
    label: "Push",
    done: false,
    isActive: false,
    originalStartTime: null,
    timerStart: null,
    elapsedTime: 0,
    gymId: null,
    startedFrom: "calendar",
  });
  const pulledId = pulled.lastInsertRowId;
  assert.strictEqual(storedStartedFrom(pulledId), "calendar", "a pulled workout keeps where it was started from");

  const pullUpdate = (startedFromValue) =>
    repository.updateWorkoutFromCloud(db, {
      workoutId: pulledId,
      cloudWorkoutTypeInstanceId: 40,
      remoteLocalWorkoutTypeInstanceId: 400,
      syncId: "1f2e3d4c-0000-0000-0000-000000000000",
      syncVersion: 4,
      deletedAt: null,
      dayId: 1,
      workoutType: "resistance",
      date: "01.10.2026",
      label: "Push",
      done: true,
      isActive: false,
      originalStartTime: null,
      timerStart: null,
      elapsedTime: 1200,
      gymId: null,
      startedFrom: startedFromValue,
    });

  await pullUpdate(null);
  assert.strictEqual(
    storedStartedFrom(pulledId),
    "calendar",
    "a pull that does not know it must not wipe it"
  );

  await pullUpdate("program");
  assert.strictEqual(storedStartedFrom(pulledId), "program", "a pull that does know it wins, as any field does");

  const forSync = await repository.getWorkoutsForCloudSync(db);
  const synced = forSync.find((row) => row.workout_id === copy.lastInsertRowId);
  assert.strictEqual(synced.started_from, "recent", "the upload reads started_from with the row");
  assert.strictEqual(
    fields.buildCloudWorkoutTypeInstancePayload(synced, "user-a", 9).started_from,
    "recent",
    "and sends it"
  );
}

/* ------------------------------------- every INSERT carries the column -- */

{
  let inserts = 0;

  for (const file of SRC_FILES) {
    const source = read(file);

    for (const match of source.matchAll(/INSERT INTO Workout_Type_Instance\s*\(/g)) {
      const columns = argumentsAt(source, match.index + match[0].length - 1);
      inserts += 1;

      assert.ok(
        /\bstarted_from\b/.test(columns),
        `${file} inserts a workout without started_from`
      );
    }
  }

  // createWorkout, copyWorkoutIntoDay, createWorkoutFromCloud and the import.
  assert.strictEqual(inserts, 4, "a new INSERT INTO Workout_Type_Instance - decide its started_from and add it here");

  for (const file of SRC_FILES) {
    if (file === "src/Services/programService.js") continue;

    assert.ok(
      !/programRepository\.(createWorkout|copyWorkoutIntoDay)\(/.test(read(file)),
      `${file} creates a workout past programService - its started_from is not checked here`
    );
  }

  assert.ok(
    /started_from\s*\) VALUES[\s\S]*?STARTED_FROM\.PROGRAM/.test(
      read("src/Services/programTransferService.js")
    ),
    "an imported program's workouts are program workouts"
  );
}

/* ------------------------------------------------- the services pass it -- */

const CREATING_SERVICES = [
  "createWorkoutForDay",
  "createQuickWorkout",
  "repeatWorkoutToday",
  "copyWorkoutToProgramDay",
  "copyWorkoutToDate",
  "copyProgramWorkoutToDate",
  "copyWorkoutToStandaloneDate",
];

{
  const service = read("src/Services/programService.js");

  for (const name of CREATING_SERVICES) {
    const at = service.indexOf(`export async function ${name}(`);
    assert.ok(at !== -1, `programService.${name} is gone`);

    assert.ok(
      argumentsAt(service, service.indexOf("(", at)).includes("startedFrom = STARTED_FROM.OTHER"),
      `programService.${name} does not take startedFrom from its caller`
    );
  }

  // Each hop hands it on: to the repository, and from one copy to the next.
  const hops = callsIn(
    service,
    /(?:programRepository\.)?\b(createWorkout|copyWorkoutIntoDay|copyWorkoutToProgramDay|copyWorkoutToStandaloneDate)\((?=db,)/g
  );

  assert.ok(hops.length >= 10, "the creation calls inside programService were not found");
  for (const hop of hops) {
    assert.ok(startedFromIn(hop.args), `a call to ${hop.name} in programService drops startedFrom`);
  }

  const copyWeekAt = service.indexOf("export async function copyMicrocycleWorkouts(");
  const copyWeek = service.slice(copyWeekAt, service.indexOf("\nexport ", copyWeekAt + 1));
  const [copyWeekCreate] = callsIn(copyWeek, /programRepository\.(createWorkout)\(/g);

  assert.strictEqual(
    startedFromIn(copyWeekCreate.args),
    "PROGRAM",
    "copying a week is building the program"
  );
}

/* ------------------------------------------ the screens: path -> value -- */

// The table in the report. Per file, every creation call in source order and
// the value it passes. Anything that calls one of these and is not listed
// fails, so a new path has to decide its value here.
const CREATION_CALL = new RegExp(
  `programService\\.(${[...CREATING_SERVICES, "copyMicrocycleWorkouts"].join("|")})\\(`,
  "g"
);

const PATHS = {
  // "Dit split" and the quick start's "Start {name}" copy from your split;
  // "Tom træning" / "Første træning" is the empty one.
  "src/Pages/HomePage/HomePage.js": [
    ["copyWorkoutToStandaloneDate", "RECENT"],
    ["createQuickWorkout", "EMPTY"],
  ],
  // The Train tab: repeat today, plan into the program, plan on a date.
  "src/Pages/ExerciseLibraryPage/ExerciseLibraryPage.js": [
    ["repeatWorkoutToday", "RECENT"],
    ["copyWorkoutToProgramDay", "RECENT"],
    ["copyWorkoutToStandaloneDate", "RECENT"],
  ],
  "src/Pages/WorkoutLibraryPage/WorkoutLibraryPage.js": [
    ["repeatWorkoutToday", "RECENT"],
    ["copyWorkoutToProgramDay", "RECENT"],
  ],
  // Copying a workout to another day in the calendar.
  "src/Pages/WorkoutCalendarPage/WorkoutCalendarPage.js": [
    ["copyWorkoutToProgramDay", "CALENDAR"],
    ["copyWorkoutToStandaloneDate", "CALENDAR"],
    ["copyProgramWorkoutToDate", "CALENDAR"],
  ],
  // A program's week and its list of weeks.
  "src/Pages/WeekPage/Components/Day/Day.js": [["copyProgramWorkoutToDate", "PROGRAM"]],
  "src/Pages/MicrocyclePage/Components/MicrocycleList/MicrocycleList.js": [
    // Its value is set in the service, checked above.
    ["copyMicrocycleWorkouts", null],
    ["copyProgramWorkoutToDate", "PROGRAM"],
  ],
  // "Copy to date" on the workout's own page.
  "src/Pages/WorkoutPage/WorkoutPage.js": [
    ["copyWorkoutToProgramDay", "OTHER"],
    ["copyWorkoutToStandaloneDate", "OTHER"],
  ],
};

// The start sheet behind the centre button is not this change's file. Until
// the patch in the report is applied its four calls fall back to OTHER; once
// it is, every one of them has to pass startedFrom - empty for a new workout
// and recent for a repeated one, unless the screen that opened the sheet said
// otherwise.
const START_SHEET = "src/Resources/ThemedComponents/ThemedBottomNavigation.js";
let startSheetWired = false;

for (const file of SRC_FILES) {
  if (file === "src/Services/programService.js") continue;

  const calls = callsIn(read(file), CREATION_CALL).map((call) => [call.name, startedFromIn(call.args)]);

  if (!calls.length) {
    assert.ok(!(file in PATHS), `${file} no longer creates a workout - take it out of the table`);
    continue;
  }

  if (file === START_SHEET) {
    const passing = calls.filter(([, value]) => value !== null).length;

    assert.ok(
      passing === 0 || passing === calls.length,
      `${START_SHEET} passes startedFrom on ${passing} of its ${calls.length} creation calls`
    );
    assert.strictEqual(calls.length, 4, `${START_SHEET} has a creation call this test does not know`);

    if (passing) {
      const sheet = read(START_SHEET);

      assert.ok(/target\?\.startedFrom\s*\?\?\s*STARTED_FROM\.EMPTY/.test(sheet), "a new workout from the sheet is empty unless its opener said otherwise");
      assert.ok(/target\?\.startedFrom\s*\?\?\s*STARTED_FROM\.RECENT/.test(sheet), "a repeated workout from the sheet is recent unless its opener said otherwise");
      assert.ok(/startedFrom:\s*target\.startedFrom/.test(sheet), "the sheet has to keep its opener's startedFrom");
      startSheetWired = true;
    }

    continue;
  }

  assert.ok(file in PATHS, `${file} creates a workout and is not in the table - decide its started_from`);
  assert.deepStrictEqual(calls, PATHS[file], `${file} does not pass the started_from the table names`);
}

// What the screens that open the start sheet tell it.
const SHEET_OPENERS = {
  "src/Pages/WorkoutCalendarPage/WorkoutCalendarPage.js": ["CALENDAR"],
  "src/Pages/WeekPage/Components/Day/Day.js": ["PROGRAM"],
  "src/Pages/MicrocyclePage/Components/MicrocycleList/MicrocycleList.js": ["PROGRAM"],
  // The empty feed opens it as the centre button does.
  "src/Pages/FeedPage/FeedPage.js": [null],
};

for (const file of SRC_FILES) {
  // Where the function itself is declared.
  if (file === "src/Utils/quickWorkoutMenuEvents.js") continue;

  const openers = callsIn(read(file), /\b(requestOpenQuickWorkoutMenu)\(/g).map((call) =>
    startedFromIn(call.args)
  );

  if (!openers.length) continue;

  assert.ok(file in SHEET_OPENERS, `${file} opens the start sheet and is not in the table`);
  assert.deepStrictEqual(openers, SHEET_OPENERS[file], `${file} opens the start sheet with the wrong startedFrom`);
}

/* ----------------------------------------------------- app opening: rules -- */

const appOpen = loadAppModule("src/Utils/appOpen.js");
const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 1, 8, 0, 0);

assert.strictEqual(appOpen.APP_OPEN_INTERVAL_MS, HOUR);

assert.ok(appOpen.shouldRecordAppOpen({ lastRecordedAt: null, now: NOW }), "never recorded");
assert.ok(appOpen.shouldRecordAppOpen({ lastRecordedAt: "", now: NOW }));
assert.ok(appOpen.shouldRecordAppOpen({ lastRecordedAt: "not a time", now: NOW }), "an unreadable value is no record");
assert.ok(!appOpen.shouldRecordAppOpen({ lastRecordedAt: NOW - HOUR + 1, now: NOW }), "within the hour");
assert.ok(!appOpen.shouldRecordAppOpen({ lastRecordedAt: String(NOW - 5 * 60 * 1000), now: NOW }), "as AsyncStorage returns it");
assert.ok(appOpen.shouldRecordAppOpen({ lastRecordedAt: NOW - HOUR, now: NOW }), "an hour on");
assert.ok(appOpen.shouldRecordAppOpen({ lastRecordedAt: NOW - 3 * HOUR, now: NOW }));
assert.ok(
  appOpen.shouldRecordAppOpen({ lastRecordedAt: NOW + 6 * HOUR, now: NOW }),
  "a clock set back does not hold the next record for hours"
);

assert.notStrictEqual(
  appOpen.getAppOpenStorageKey("user-a"),
  appOpen.getAppOpenStorageKey("user-b"),
  "one key per user"
);
assert.ok(appOpen.getAppOpenStorageKey("user-a").includes("user-a"));

assert.strictEqual(appOpen.normalizeAppOpenPlatform("ios"), "ios");
assert.strictEqual(appOpen.normalizeAppOpenPlatform("android"), "android");
for (const os of ["web", "windows", "macos", "", undefined, null]) {
  assert.strictEqual(appOpen.normalizeAppOpenPlatform(os), null, `${os} is not recorded`);
}

assert.strictEqual(appOpen.normalizeAppVersionForCloud("v2.13.0 | build 24"), "v2.13.0 | build 24");
assert.strictEqual(appOpen.normalizeAppVersionForCloud("  v2.13.0  "), "v2.13.0");
assert.strictEqual(appOpen.normalizeAppVersionForCloud(null), null);
assert.strictEqual(appOpen.normalizeAppVersionForCloud(""), null);
assert.strictEqual(appOpen.normalizeAppVersionForCloud("x".repeat(90)).length, appOpen.APP_VERSION_MAX_LENGTH);

assert.ok(appOpen.isMissingAppOpenColumnError({ code: "42703" }));
assert.ok(appOpen.isMissingAppOpenColumnError({ code: "PGRST204" }));
assert.ok(!appOpen.isMissingAppOpenColumnError({ code: "23514" }));
assert.ok(!appOpen.isMissingAppOpenColumnError({ message: "TypeError: Network request failed" }));

/* ----------------------------------------------- app opening: the write -- */

const POLICY = "2026-09-26.3";

function createFakeAsyncStorage() {
  const values = new Map();

  return {
    values,
    getItem: async (key) => (values.has(key) ? values.get(key) : null),
    setItem: async (key, value) => {
      values.set(key, String(value));
    },
    removeItem: async (key) => {
      values.delete(key);
    },
  };
}

/** Enough of the client for one update with two filters and a select. */
function createFakeSupabase(rows) {
  const state = { rows, requests: [], failWith: null };

  return {
    state,
    // supaBaseClient subscribes to this when it loads.
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from(table) {
      return {
        update(values) {
          const filters = {};
          const query = {
            eq(column, value) {
              filters[column] = value;
              return query;
            },
            select(columns) {
              state.requests.push({ table, values, filters: { ...filters }, columns });

              if (state.failWith) {
                return Promise.resolve({ data: null, error: state.failWith });
              }

              const matching = state.rows.filter(
                (row) =>
                  table === "profile_private" &&
                  Object.entries(filters).every(([column, value]) => row[column] === value)
              );

              for (const row of matching) Object.assign(row, values);

              return Promise.resolve({
                data: matching.map((row) => ({ user_id: row.user_id })),
                error: null,
              });
            },
          };

          return query;
        },
        upsert() {
          throw new Error("app opening must update, never upsert");
        },
      };
    },
  };
}

function loadAppOpenService({ asyncStorage, supabase }) {
  loadAppModule.stubModule("@react-native-async-storage/async-storage", {
    __esModule: true,
    default: asyncStorage,
  });
  loadAppModule.stubModule("@supabase/supabase-js", {
    createClient: () => supabase,
    processLock: () => {},
  });
  loadAppModule.stubModule("react-native", { Platform: { OS: "web" } });
  loadAppModule.stubModule("react-native-url-polyfill/auto", {});
  loadAppModule.stubModule("expo-sqlite/localStorage/install", {});
  loadAppModule.stubModule("expo-secure-store", {});

  return loadAppModule("src/Services/appOpenService.js");
}

async function appOpenChecks() {
  const asyncStorage = createFakeAsyncStorage();
  const supabase = createFakeSupabase([
    { user_id: "user-a", privacy_policy_version: POLICY },
    { user_id: "user-b", privacy_policy_version: POLICY },
    // Has not accepted the policy this build carries.
    { user_id: "user-c", privacy_policy_version: "2026-09-26" },
  ]);
  const { recordAppOpen } = loadAppOpenService({ asyncStorage, supabase });
  const open = (overrides = {}) =>
    recordAppOpen({
      userId: "user-a",
      platform: "android",
      appVersion: "v2.13.0 | build 24",
      privacyPolicyVersion: POLICY,
      now: NOW,
      ...overrides,
    });
  const requests = () => supabase.state.requests.length;

  // Nothing to record, and no request made.
  assert.deepStrictEqual(await open({ userId: null }), { recorded: false, reason: "signed_out" });
  assert.deepStrictEqual(await open({ platform: "web" }), { recorded: false, reason: "platform" });
  assert.strictEqual(requests(), 0);

  // The first open: exactly the three columns, on your own row, if accepted.
  assert.deepStrictEqual(await open(), { recorded: true });
  assert.strictEqual(requests(), 1);
  assert.deepStrictEqual(supabase.state.requests[0], {
    table: "profile_private",
    values: {
      last_opened_at: new Date(NOW).toISOString(),
      last_opened_platform: "android",
      last_app_version: "v2.13.0 | build 24",
    },
    filters: { user_id: "user-a", privacy_policy_version: POLICY },
    columns: "user_id",
  });
  assert.strictEqual(supabase.state.rows[0].last_opened_platform, "android");
  assert.strictEqual(
    asyncStorage.values.get(appOpen.getAppOpenStorageKey("user-a")),
    String(NOW),
    "remembered across launches"
  );

  // Within the hour: nothing sent. An hour on: sent again.
  assert.deepStrictEqual(await open({ now: NOW + 59 * 60 * 1000 }), {
    recorded: false,
    reason: "recently_recorded",
  });
  assert.strictEqual(requests(), 1);
  assert.deepStrictEqual(await open({ now: NOW + HOUR, platform: "ios" }), { recorded: true });
  assert.strictEqual(requests(), 2);
  assert.strictEqual(supabase.state.rows[0].last_opened_platform, "ios");

  // Another account on the same phone has an hour of its own.
  assert.deepStrictEqual(await open({ userId: "user-b", now: NOW + HOUR + 1000 }), { recorded: true });
  assert.strictEqual(requests(), 3);

  // Not accepted: nothing written and nothing remembered, so it asks again.
  assert.deepStrictEqual(await open({ userId: "user-c" }), {
    recorded: false,
    reason: "policy_not_accepted",
  });
  assert.strictEqual(supabase.state.rows[2].last_opened_at, undefined);
  assert.ok(!asyncStorage.values.has(appOpen.getAppOpenStorageKey("user-c")));
  await open({ userId: "user-c", now: NOW + 60 * 1000 });
  assert.strictEqual(requests(), 5, "tried again at the next open");

  // A version too long for the column is cut, not refused.
  await open({ userId: "user-b", now: NOW + 3 * HOUR, appVersion: `v${"9".repeat(60)}` });
  assert.strictEqual(
    supabase.state.requests.at(-1).values.last_app_version.length,
    appOpen.APP_VERSION_MAX_LENGTH
  );

  // Offline: the request fails, nothing is remembered, and it is tried again.
  const before = asyncStorage.values.get(appOpen.getAppOpenStorageKey("user-a"));
  supabase.state.failWith = { code: "", message: "TypeError: Network request failed" };
  await assert.rejects(open({ now: NOW + 4 * HOUR }));
  assert.strictEqual(asyncStorage.values.get(appOpen.getAppOpenStorageKey("user-a")), before);
  const afterOffline = requests();

  // The migration has not run: said once, then not asked again this session.
  supabase.state.failWith = {
    code: "PGRST204",
    message: "Could not find the 'last_opened_at' column of 'profile_private' in the schema cache",
  };
  assert.deepStrictEqual(await open({ now: NOW + 4 * HOUR }), {
    recorded: false,
    reason: "missing_columns",
  });
  assert.strictEqual(requests(), afterOffline + 1);
  assert.deepStrictEqual(await open({ now: NOW + 9 * HOUR }), {
    recorded: false,
    reason: "missing_columns",
  });
  assert.strictEqual(requests(), afterOffline + 1, "no request once the columns are known to be missing");
}

/* ---------------------------------------- app opening: when it is asked -- */

{
  const component = read("src/Sync/AppOpenSync.js");
  const [call] = callsIn(component, /appOpenService\.(recordAppOpen)\(/g);

  assert.ok(call, "AppOpenSync no longer records anything");
  for (const [needle, why] of [
    ["platform: Platform.OS", "the platform is Platform.OS"],
    ["appVersion: feedbackService.getAppVersion()", "the version is the one a bug report carries"],
    ["privacyPolicyVersion: PRIVACY_POLICY_VERSION", "only once the policy this build carries is accepted"],
    ["userId", "per user"],
  ]) {
    assert.ok(call.args.includes(needle), `AppOpenSync: ${why}`);
  }

  assert.ok(/AppState\.addEventListener\("change"/.test(component), "AppOpenSync has to ask on return to the foreground");
  assert.ok(/nextState === "active"/.test(component));
  assert.ok(/!isAuthenticated/.test(component), "signed in only");
  assert.ok(/<AppOpenSync\s*\/>/.test(read("App.js")), "AppOpenSync is not mounted");
  assert.ok(
    /export function getAppVersion\(/.test(read("src/Services/feedbackService.js")),
    "feedbackService.getAppVersion is what the version comes from"
  );
}

/* --------------------------------- the migration takes what is sent -- */

{
  const migration = read("supabase/migrations/20261001090000_dev-kpis.sql");
  const listIn = (pattern, what) => {
    const match = migration.match(pattern);
    assert.ok(match, `20261001090000_dev-kpis.sql no longer checks ${what} - keep this test in step with it`);
    return [...match[1].matchAll(/'([^']+)'/g)].map((value) => value[1]);
  };

  assert.deepStrictEqual(
    listIn(/started_from in \(([^)]*)\)/, "started_from"),
    [...STARTED_FROM_VALUES],
    "the app would send a started_from the cloud refuses - and fail the whole workout upload"
  );
  assert.deepStrictEqual(
    listIn(/last_opened_platform in \(([^)]*)\)/, "last_opened_platform"),
    [...appOpen.APP_OPEN_PLATFORMS]
  );

  const versionLimit = migration.match(/char_length\(last_app_version\) <= (\d+)/);
  assert.ok(versionLimit, "20261001090000_dev-kpis.sql no longer limits last_app_version");
  assert.strictEqual(Number(versionLimit[1]), appOpen.APP_VERSION_MAX_LENGTH);
}

/* ------------------------------------------------------------------ run -- */

(async () => {
  await fallbackChecks();
  await repositoryChecks();
  await appOpenChecks();

  console.log(
    "Dev KPI sources: the five started_from values, the field row, the fallback before the migration, " +
      "the schema and the repository, every creation path and its value, " +
      "and the app opening - its hour, its key, its consent and its failures - passed." +
      (startSheetWired ? "" : `\n  Not wired yet: ${START_SHEET} (its four calls fall back to OTHER).`)
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
