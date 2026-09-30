// Building the split from your own workouts, picked in the calendar: the
// month's rows hold every workout (done and planned), a rename goes through
// the repository write that marks the workout for sync, and a picked
// workout - planned, or renamed from nothing - becomes a session the split
// card can repeat.
//
// The queries run against an in-memory SQLite built from the real schema;
// the split's reasoning is src/Utils/splitCard.js as it is. The service layer
// is left out on purpose: workoutService.updateWorkoutLabel only adds the
// background sync on top of the repository write tested here.
const assert = require("assert/strict");
const { DatabaseSync } = require("node:sqlite");
const loadAppModule = require("./lib/loadAppModule");

const programRepository = loadAppModule("src/Repository/programRepository.js");
const workoutRepository = loadAppModule("src/Repository/workoutRepository.js");
const weightliftingRepository = loadAppModule("src/Repository/weightliftingRepository.js");
const split = loadAppModule("src/Utils/splitCard.js");
const days = loadAppModule("src/Utils/calendarDays.js");
const { programSchemaSql } = loadAppModule("src/Database/schema/program.js");
const { weightliftingSchemaSql } = loadAppModule("src/Database/schema/weightlifting.js");

function database() {
  const raw = new DatabaseSync(":memory:");

  raw.exec(programSchemaSql);
  raw.exec(weightliftingSchemaSql);

  return {
    raw,
    db: {
      execAsync: async (sql) => raw.exec(sql),
      runAsync: async (sql, params = []) => raw.prepare(sql).run(...params),
      getAllAsync: async (sql, params = []) => raw.prepare(sql).all(...params).map((row) => ({ ...row })),
      getFirstAsync: async (sql, params = []) => {
        const row = raw.prepare(sql).get(...params);

        return row ? { ...row } : null;
      },
    },
  };
}

async function main() {
  const { raw, db } = database();
  const workout = (id, date, { label, type = "Resistance", done = 1, exercises = [] } = {}) => {
    raw.prepare("INSERT INTO Day (day_id, Weekday, date) VALUES (?, 'Monday', ?)").run(id, date);
    raw
      .prepare(
        `INSERT INTO Workout_Type_Instance (workout_id, day_id, date, label, workout_type, done, sync_version, needs_sync)
         VALUES (?, ?, ?, ?, ?, ?, 1, 0)`
      )
      .run(id, id, date, label ?? type, type, done);
    exercises.forEach((name, index) => {
      const exerciseId = id * 10 + index;

      raw
        .prepare(
          "INSERT INTO Exercise_Instance (exercise_instance_id, workout_type_instance_id, exercise_name) VALUES (?, ?, ?)"
        )
        .run(exerciseId, id, name);
      raw
        .prepare(`INSERT INTO "Set" (sets_id, set_number, exercise_instance_id, reps, weight) VALUES (?, 1, ?, 8, 60)`)
        .run(exerciseId, exerciseId);
    });
  };

  // Thursday 24 September 2026.
  const now = new Date(2026, 8, 24, 12).getTime();

  workout(1, "22.09.2026", { label: "Push", exercises: ["Bench press", "Dips"] });
  workout(2, "18.09.2026", { label: "Pull", exercises: ["Row"] });
  workout(3, "20.09.2026", { exercises: ["Squat", "Lunge"] }); // an unnamed quick start
  workout(4, "28.09.2026", { done: 0, exercises: ["Incline press", "Fly", "Push-up"] }); // planned, unnamed
  workout(5, "13.09.2026", { label: "Long run", type: "Run" });

  /* ------------------------------------------------ the month's workouts -- */

  const september = days.getMonthPage(new Date(now), 0);
  const monthRows = await programRepository.getWorkoutsBetweenDates(db, {
    startIsoDate: september.startIsoDate,
    endIsoDate: september.endIsoDate,
  });

  assert.deepEqual(
    monthRows.map((row) => row.workout_id).sort(),
    [1, 2, 3, 4, 5],
    "the calendar offers every workout of the month, done or planned, of any type"
  );

  const lookups = days.buildCalendarLookups({
    workouts: monthRows,
    startIsoDate: september.startIsoDate,
    endIsoDate: september.endIsoDate,
  });

  assert.equal(lookups.workoutsByDate.get("28.09.2026")[0].workout_id, 4, "a day is looked up by its stored date");

  const planned = monthRows.find((row) => row.workout_id === 4);

  assert.equal(split.splitNameOf(planned), null, "an unnamed workout has to be named before it joins");
  assert.equal(split.addSplitName(["Push"], split.splitNameOf(planned)).status, "unnamed");

  // What was in it, as the detail view reads it.
  const exercises = await weightliftingRepository.getExercisesByWorkout(db, 4);
  const sets = await weightliftingRepository.getSetsByWorkout(db, 4);

  assert.deepEqual(exercises.map((exercise) => exercise.exercise_name).sort(), ["Fly", "Incline press", "Push-up"]);
  assert.equal(sets.length, 3);

  /* ---------------------------------------------------------- the rename -- */

  await workoutRepository.updateWorkoutLabel(db, { workoutId: 4, label: "Chest day" });

  const renamed = raw
    .prepare("SELECT label, needs_sync, sync_version, sync_id FROM Workout_Type_Instance WHERE workout_id = 4")
    .get();

  assert.equal(renamed.label, "Chest day");
  assert.equal(renamed.needs_sync, 1, "a rename is marked for the next upload");
  assert.ok(Number(renamed.sync_version) > 1, "a rename bumps the sync version, so it wins over the cloud's copy");
  assert.ok(renamed.sync_id, "a rename gives the workout a sync id if it had none");
  assert.equal(
    raw.prepare("SELECT needs_sync FROM Workout_Type_Instance WHERE workout_id = 1").get().needs_sync,
    0,
    "no other workout is touched"
  );

  /* ------------------------------------------------------ add to the split -- */

  const [afterRename] = (
    await programRepository.getWorkoutsBetweenDates(db, {
      startIsoDate: september.startIsoDate,
      endIsoDate: september.endIsoDate,
    })
  ).filter((row) => row.workout_id === 4);
  const name = split.splitNameOf(afterRename);

  assert.equal(name, "Chest day");

  let picked = ["Push", "Pull"];

  ({ names: picked } = split.addSplitName(picked, name));
  assert.deepEqual(picked, ["Push", "Pull", "Chest day"]);
  assert.equal(split.addSplitName(picked, name).status, "alreadyIn", "picking it again adds nothing");

  ({ names: picked } = split.addSplitName(picked, split.splitNameOf(monthRows.find((row) => row.workout_id === 5))));
  assert.deepEqual(picked, ["Push", "Pull", "Chest day", "Long run"], "a run joins too");

  // Removing is the editor's untick, then Save: the names without it.
  const saved = picked.filter((entry) => entry !== "Pull");

  // The split card, the way splitService.getSplitCard builds it.
  const library = await programRepository.getWorkoutLibrary(db, { limit: 500 });
  const sessions = split.resolveChosenSplit(saved, split.namedHistory(library), {
    now,
    templates: split.splitTemplates(library),
  });
  const byName = Object.fromEntries(sessions.map((session) => [session.name, session]));

  assert.deepEqual(sessions.map((session) => session.name), ["Push", "Chest day", "Long run"]);
  assert.equal(byName.Push.lastWorkoutId, 1);
  assert.equal(byName["Chest day"].lastWorkoutId, 4, "the picked planned workout is what Repeat copies");
  assert.equal(byName["Chest day"].exerciseCount, 3);
  assert.equal(byName["Chest day"].lastTrainedAt, null, "planned is not trained");
  assert.equal(byName["Chest day"].isUpNext, true, "never trained is next");
  assert.equal(byName["Long run"].lastWorkoutId, 5);
  assert.equal(byName["Long run"].workoutType, "Run");

  // Renamed back to nothing, it no longer answers to the name.
  await workoutRepository.updateWorkoutLabel(db, { workoutId: 4, label: null });

  const cleared = await programRepository.getWorkoutLibrary(db, { limit: 500 });

  assert.equal(split.splitNameOf(cleared.find((row) => row.workout_id === 4)), null);
  assert.equal(
    split.resolveChosenSplit(["Chest day"], split.namedHistory(cleared), {
      now,
      templates: split.splitTemplates(cleared),
    })[0].lastWorkoutId,
    null
  );

  console.log("split-from-calendar: the month's workouts, the rename, adding and removing passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
