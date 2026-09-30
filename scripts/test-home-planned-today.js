// The workout planned for today, on Home - and your own tile in the friends
// strip while you train.
//
// "Der vises ikke tydeligt, når et workout er planlagt. [...] Når jeg har et
// workout planlagt, så vil jeg godt have at vi kun vise det som forslag (og
// viser det tydeligt). Så skal brugeren istedet bruge plusset i bunden, for at
// starte et helt friskt workout."
//
// Quick start did find the planned workout, and drew it as the same outlined
// button the split's suggestion is drawn as - usually under a name from the
// split - with the empty workout under it. So it read as "nothing planned".
// Now a planned workout is the whole block, and the split marks nothing as
// next. The query also learned to fall back on the day's date and to hide
// what the calendar hides, and to count what the card shows.
//
// "Den viser ikke i friends activity når jeg selv træner." Splitting Home in
// two (a62aacb4) moved the part that told your own tile what today looks like
// on the phone into the new FeedPage, which never draws the strip. Home was
// left with the cloud's profile row, which carries no activity - so your own
// tile rested through every workout.
//
// The real services run against a real SQLite database built from the app's
// own schema, so these are the statements the phone runs.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

/* ----------------------------------------------------------- the world -- */

// Uploads the services queue stop at "signed out"; that is not tested here.
const consoleError = console.error;
console.error = (...args) => {
  if (typeof args[0] === "string" && /cloud push failed/.test(args[0])) {
    return;
  }

  consoleError(...args);
};

const fakeSupabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe() {} } },
    }),
  },
  from() {
    throw new Error("Home's planned workout reached for the cloud while signed out");
  },
  rpc: async () => ({ data: null, error: null }),
  functions: { invoke: async () => ({ data: null, error: null }) },
};

loadAppModule.stubModule("@supabase/supabase-js", {
  createClient: () => fakeSupabase,
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

const { programSchemaSql } = loadAppModule("src/Database/schema/program.js");
const { weightliftingSchemaSql } = loadAppModule("src/Database/schema/weightlifting.js");
const { runningSchemaSql } = loadAppModule("src/Database/schema/running.js");
const workoutService = loadAppModule("src/Services/workoutService.js");
const programService = loadAppModule("src/Services/programService.js");
const friends = loadAppModule("src/Utils/friendsActivityUtils.js");

/** node:sqlite behind the part of expo-sqlite's API the services use. */
function createDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  const bind = (params) =>
    (Array.isArray(params) ? params : params === undefined ? [] : [params]).map(
      (value) =>
        value === undefined ? null : typeof value === "boolean" ? Number(value) : value
    );

  sqlite.exec(programSchemaSql);
  sqlite.exec(weightliftingSchemaSql);
  sqlite.exec(runningSchemaSql);

  return {
    databasePath: "test-home-planned-today",
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

// Today is a Wednesday. The phone stores dd.mm.yyyy; synced and older rows
// can hold the ISO spelling.
const NOW = new Date(2026, 8, 30, 12, 0, 0).getTime();
const TODAY = "30.09.2026";
const TODAY_ISO = "2026-09-30";
const YESTERDAY = "29.09.2026";

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

/**
 * One database with one day and one workout on it. `day` and `workout` are
 * the columns that differ; `program` puts the day in a program.
 */
function worldWith({ day = {}, workout = {}, program = null } = {}) {
  const db = createDatabase();
  const run = (sql, ...params) => db.sqlite.prepare(sql).run(...params);

  if (program) {
    run(
      `INSERT INTO Program (program_id, program_name, start_date, status, deleted_at) VALUES (1, ?, '28.09.2026', ?, ?)`,
      program.name ?? "Plan",
      program.status ?? "ACTIVE",
      program.deletedAt ?? null
    );
  }

  run(
    `INSERT INTO Day (day_id, program_id, Weekday, date, deleted_at) VALUES (1, ?, 'Wednesday', ?, ?)`,
    program ? 1 : null,
    day.date ?? TODAY,
    day.deletedAt ?? null
  );
  run(
    `INSERT INTO Workout_Type_Instance (workout_id, day_id, workout_type, label, date, done, original_start_time, timer_start, elapsed_time)
     VALUES (1, 1, 'Resistance', ?, ?, 0, ?, ?, ?)`,
    workout.label ?? "Push",
    workout.date ?? TODAY,
    workout.originalStartTime ?? null,
    workout.timerStart ?? null,
    workout.elapsedTime ?? 0
  );

  return db;
}

const openToday = (db) => workoutService.getOpenWorkoutsToday(db, { now: NOW });

/* --------------------------------------- the query finds what is planned */

async function checkTheQuery() {
  // Planned the way the app plans one: a program's day, and the workout the
  // calendar adds to it.
  {
    const db = createDatabase();
    const run = (sql, ...params) => db.sqlite.prepare(sql).run(...params);

    run(`INSERT INTO Program (program_id, program_name, start_date, status) VALUES (1, 'Strength block', '28.09.2026', 'ACTIVE')`);
    run(`INSERT INTO Day (day_id, program_id, Weekday, date) VALUES (1, 1, 'Wednesday', ?)`, TODAY);

    const created = await programService.createWorkoutForDay(db, {
      date: TODAY,
      dayId: 1,
      workoutType: "Resistance",
      label: "Push",
    });
    const workoutId = created.lastInsertRowId;

    run(`INSERT INTO Exercise_Instance (exercise_instance_id, workout_type_instance_id, exercise_name) VALUES (10, ?, 'Bench Press')`, workoutId);
    run(`INSERT INTO Exercise_Instance (exercise_instance_id, workout_type_instance_id, exercise_name) VALUES (11, ?, 'Row')`, workoutId);
    // Deleted from the cloud: neither it nor its set is on the card.
    run(`INSERT INTO Exercise_Instance (exercise_instance_id, workout_type_instance_id, exercise_name, deleted_at) VALUES (12, ?, 'Curl', '2026-09-29T10:00:00Z')`, workoutId);
    run(`INSERT INTO "Set" (sets_id, exercise_instance_id, set_number) VALUES (100, 10, 1)`);
    run(`INSERT INTO "Set" (sets_id, exercise_instance_id, set_number) VALUES (101, 10, 2)`);
    run(`INSERT INTO "Set" (sets_id, exercise_instance_id, set_number) VALUES (102, 11, 1)`);
    run(`INSERT INTO "Set" (sets_id, exercise_instance_id, set_number, deleted_at) VALUES (103, 11, 2, '2026-09-29T10:00:00Z')`);
    run(`INSERT INTO "Set" (sets_id, exercise_instance_id, set_number) VALUES (104, 12, 1)`);

    const today = await openToday(db);

    assert.strictEqual(today.count, 1, "the workout planned for today is not found");
    assert.deepStrictEqual(
      {
        workoutId: today.first.workoutId,
        isRunning: today.first.isRunning,
        isStarted: today.first.isStarted,
        exerciseCount: today.first.exerciseCount,
        setCount: today.first.setCount,
        programId: today.first.programId,
        programName: today.first.programName,
        date: today.first.date,
        day: today.first.day,
      },
      {
        workoutId,
        isRunning: false,
        isStarted: false,
        exerciseCount: 2,
        setCount: 3,
        programId: 1,
        programName: "Strength block",
        date: TODAY,
        day: "Wednesday",
      },
      "the planned card does not get what it draws, or counts deleted rows"
    );

    // §6: the plus in the bottom bar stays a plus. Neither the square's
    // running workout nor its "start this one" sees a workout that was only
    // planned, so a press makes a fresh one.
    assert.strictEqual(
      await workoutService.getStartableWorkout(db, { date: TODAY }),
      null,
      "the plus in the bottom bar opens the planned workout instead of making a new one"
    );
    assert.strictEqual(
      await workoutService.getWorkoutInProgress(db),
      null,
      "a workout that was only planned counts as one in progress"
    );
  }

  // The workout's date decides; the day's stands in for an empty one. Both
  // spellings, on both.
  const found = [
    [{ workout: { date: TODAY } }, "the workout's dd.mm.yyyy date"],
    [{ workout: { date: TODAY_ISO } }, "the workout's ISO date"],
    [{ workout: { date: "" }, day: { date: TODAY } }, "the day's dd.mm.yyyy date under an empty one"],
    [{ workout: { date: "" }, day: { date: TODAY_ISO } }, "the day's ISO date under an empty one"],
    [{ program: { status: "ACTIVE" } }, "an active program's day"],
  ];

  for (const [world, what] of found) {
    const today = await openToday(worldWith(world));

    assert.strictEqual(today.count, 1, `a workout planned by ${what} is not found`);
  }

  const hidden = [
    [{ day: { deletedAt: "2026-09-29T10:00:00Z" } }, "on a deleted day"],
    [{ program: { status: "NOT_STARTED" } }, "in a program that has not started"],
    [{ program: { deletedAt: "2026-09-29T10:00:00Z" } }, "in a deleted program"],
    [{ workout: { date: YESTERDAY }, day: { date: TODAY } }, "moved to another date"],
  ];

  for (const [world, what] of hidden) {
    const today = await openToday(worldWith(world));

    assert.strictEqual(today.count, 0, `a workout ${what} is offered as planned today`);
  }

  // No program: the card says it comes from the calendar.
  {
    const today = await openToday(worldWith());

    assert.strictEqual(today.first.programId, null);
    assert.strictEqual(today.first.programName, null);
  }

  // Started and paused: the card continues it, and it outranks a newer one
  // that was only planned.
  {
    const db = worldWith({
      workout: { originalStartTime: 1790000000, timerStart: null, elapsedTime: 25 * 60 },
    });

    db.sqlite
      .prepare(
        `INSERT INTO Workout_Type_Instance (workout_id, day_id, workout_type, label, date, done) VALUES (2, 1, 'Resistance', 'Legs', ?, 0)`
      )
      .run(TODAY);

    const today = await openToday(db);

    assert.strictEqual(today.count, 2);
    assert.strictEqual(today.first.workoutId, 1, "a paused workout is not the one to continue");
    assert.strictEqual(today.first.isStarted, true);
    assert.strictEqual(today.first.isRunning, false);
    assert.strictEqual(today.first.elapsedTime, 25 * 60);
  }

  // Finished: gone, and Quick start is the split's again.
  {
    const db = worldWith();

    db.sqlite.prepare(`UPDATE Workout_Type_Instance SET done = 1`).run();

    assert.strictEqual((await openToday(db)).first, null, "a finished workout is still offered");
  }
}

/* ---------------------------------------------- the block it is drawn as */

function checkTheCard() {
  const quickStart = read("src/Pages/HomePage/Components/QuickStartCard/QuickStartCard.js");
  const card = read("src/Pages/HomePage/Components/QuickStartCard/PlannedWorkoutCard.js");
  const cardStyle = read("src/Pages/HomePage/Components/QuickStartCard/PlannedWorkoutCardStyle.js");
  const home = read("src/Pages/HomePage/HomePage.js");
  const split = read("src/Pages/HomePage/Components/SplitCards/SplitCards.js");

  const runningAt = quickStart.indexOf("if (runningWorkout) {");
  const plannedAt = quickStart.indexOf("if (todayWorkout) {");
  const splitAt = quickStart.indexOf("const primary = upNext");
  // Up to the brace that closes it, two spaces in.
  const plannedBranch =
    quickStart.slice(plannedAt).match(/^[\s\S]*?\r?\n {2}\}\r?\n/)?.[0] ?? "";

  // Running first, then planned, then the split - and the planned one alone.
  assert.ok(
    runningAt > -1 && plannedAt > runningAt && splitAt > plannedAt,
    "Quick start no longer goes running -> planned -> split"
  );
  assert.ok(
    /<PlannedWorkoutCard\b/.test(plannedBranch) &&
      /onContinueToday\?\.\(todayWorkout\)/.test(plannedBranch),
    "a workout planned today is not drawn as the planned card that opens it"
  );
  assert.ok(
    !/onStartEmpty|onStartSplit|emptyWorkout|upNext/.test(plannedBranch),
    "the split's suggestion or the empty workout is offered beside today's plan again"
  );
  assert.ok(
    /todayWorkout\.isStarted\s*\?\s*"home\.quickStart\.continueEyebrow"\s*:\s*"home\.quickStart\.plannedEyebrow"/.test(
      plannedBranch
    ),
    "the eyebrow does not say Planned today, or Continue for a paused one"
  );

  // What the card says.
  for (const key of [
    "home.quickStart.fromProgram",
    "home.quickStart.fromCalendar",
    "home.quickStart.noExercises",
    "home.quickStart.moreToday",
    "home.quickStart.elapsed",
    "home.quickStart.startPlanned",
    "home.quickStart.continueNamed",
    "home.quickStart.todaysWorkout",
    "home.split.meta",
  ]) {
    assert.ok(card.includes(`"${key}"`), `the planned card no longer uses ${key}`);
  }
  assert.ok(
    /workoutDisplayName\(workout\?\.name, t, workout\?\.workoutType\)/.test(card),
    "the planned card draws the stored label instead of the workout's name"
  );
  assert.ok(
    /accessibilityRole="button"/.test(card) && /accessibilityLabel=\{accessibilityLabel\}/.test(card),
    "the planned card is not read out as a button with its name"
  );
  // The whole card is pressed; the circle is only a picture.
  assert.strictEqual(
    (card.match(/<TouchableOpacity\b/g) ?? []).length,
    1,
    "the circle on the planned card became a second button"
  );
  // Colours inline, never in the style sheet (src/Pages/AGENTS.md).
  assert.ok(
    !/#[0-9a-fA-F]{3,8}\b|Color\s*:/.test(cardStyle),
    "a colour is frozen into PlannedWorkoutCardStyle"
  );
  assert.ok(
    /flex: 1/.test(cardStyle.slice(cardStyle.indexOf("card: {"), cardStyle.indexOf("sourceRow"))),
    "the planned card does not fill the block, so it is not as tall as the counter"
  );

  // The split marks nothing as next while there is a plan, and its cards
  // still open their session.
  assert.ok(
    /suppressUpNext=\{Boolean\(openToday\?\.first && !openToday\.first\.isRunning\)\}/.test(home),
    "Home does not tell the split to stop marking a card as next while a workout is planned"
  );
  assert.ok(
    /const isUpNext = Boolean\(group\.isUpNext\) && !suppressUpNext;/.test(split) &&
      !/group\.isUpNext \?/.test(split) &&
      !/\n\s*group\.isUpNext\n/.test(split),
    "a split card is still marked as next while a workout is planned"
  );
  assert.ok(
    /onPress=\{\(\) => onPress\?\.\(group\)\}/.test(split),
    "the split cards can no longer be pressed"
  );

  // Opening the planned workout creates nothing, and hands WorkoutPage the
  // same fields every other way in does.
  const continueToday = home.slice(
    home.indexOf("const continueToday = useCallback("),
    home.indexOf("const upNext = ")
  );

  assert.ok(
    !/startWorkout\(|createQuickWorkout|copyWorkoutToStandaloneDate/.test(continueToday) &&
      /program_id: workout\.programId/.test(continueToday) &&
      /date: workout\.date/.test(continueToday),
    "opening today's planned workout makes a new one, or opens it without its day"
  );

  // §6: the plus in the bottom bar still makes a new workout.
  const nav = read("src/Resources/ThemedComponents/ThemedBottomNavigation.js");
  const createHandler = nav.slice(
    nav.indexOf("const handleCreateQuickWorkout = async"),
    nav.indexOf("navigationRef.navigate(\"WorkoutPage\"", nav.indexOf("const handleCreateQuickWorkout = async"))
  );

  assert.ok(
    /programService\.createWorkoutForDay\(/.test(createHandler) &&
      /programService\.createQuickWorkout\(/.test(createHandler),
    "the plus in the bottom bar no longer creates a new workout"
  );
  assert.ok(
    !/getOpenWorkoutsToday/.test(nav),
    "the bottom bar took over Home's planned workout, so the plus opens it"
  );
}

/* ---------------------------------------------- your own tile, training -- */

async function checkYourOwnTile() {
  // While your workout runs, the phone says so - the cloud's profile row does
  // not carry it.
  const db = worldWith({
    workout: { originalStartTime: 1790000000, timerStart: 1790000000 },
  });
  const summary = await programService.getTodayActivitySummary(db, { date: TODAY });

  assert.strictEqual(summary.activityState, "live", "a running workout today is not live on your own tile");
  assert.strictEqual(summary.workoutId, 1);

  const planned = await programService.getTodayActivitySummary(worldWith(), { date: TODAY });

  assert.strictEqual(planned.activityState, "planned");

  // What the strip does with it: your tile burns and says you are training.
  const ownTile = { displayName: "Seb", activityState: summary.activityState, daysSinceLastWorkout: 2 };

  assert.strictEqual(friends.buildTileMood(ownTile, NOW), "embers");
  assert.strictEqual(
    friends.buildActivityStatusLabel(ownTile, { isCurrentUser: true, now: NOW }),
    friends.buildActivityStatusLabel({ activityState: "live" }, { isCurrentUser: true, now: NOW })
  );
  assert.strictEqual(friends.buildRestWallpaper(ownTile, NOW), null);
}

// That Home hands this to your own tile is pinned in
// scripts/test-friends-wallpaper.js, beside the tile's other checks.

(async () => {
  await checkTheQuery();
  checkTheCard();
  await checkYourOwnTile();
  await settle();

  console.log(
    "Home planned today: the query finds the plan in both spellings and hides what the calendar hides, Quick start shows it alone, the split marks nothing next, the plus still makes a new workout, and your own tile trains with you."
  );
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
