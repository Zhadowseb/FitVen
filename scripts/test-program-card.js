// The Train tab's program card: the block and week you are in, the week's
// progress, its seven days, and which active program the card shows.
//
// src/Utils/programCard.js is pure, so it runs here as it is.
const assert = require("assert");
const loadAppModule = require("./lib/loadAppModule");

const card = loadAppModule("src/Utils/programCard.js");

// Two blocks: block 1 of two weeks, block 2 of three. Each week is Monday to
// Sunday; Monday, Wednesday and Friday hold a workout.
function program() {
  const rows = [];
  let day = 0;
  const start = new Date(2026, 8, 7); // Monday 7 September 2026

  [[1, 2], [2, 3]].forEach(([blockNumber, weekCount]) => {
    for (let week = 1; week <= weekCount; week += 1) {
      for (let weekday = 0; weekday < 7; weekday += 1) {
        const date = new Date(start);

        date.setDate(start.getDate() + day);
        day += 1;

        const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        const training = weekday === 0 || weekday === 2 || weekday === 4;

        rows.push({
          mesocycle_id: blockNumber,
          mesocycle_number: blockNumber,
          mesocycle_focus: blockNumber === 2 ? "Hypertrophy" : "No focus set",
          microcycle_id: blockNumber * 10 + week,
          microcycle_number: week,
          day_id: day,
          date_sort: iso,
          weekday: card.WEEKDAY_NAMES[weekday],
          is_sick: 0,
          workout_count: training ? 1 : 0,
          // Everything before Wednesday 30 September is done.
          done_count: training && iso < "2026-09-30" ? 1 : 0,
        });
      }
    }
  });

  return rows;
}

{
  // Wednesday 30 September: block 2, week 2 (block 2 starts on the 21st).
  const built = card.buildProgramCard(program(), { todayIso: "2026-09-30" });

  assert.strictEqual(built.blockNumber, 2);
  assert.strictEqual(built.blockCount, 2);
  assert.strictEqual(built.focus, "Hypertrophy");
  assert.strictEqual(built.weekNumber, 2, "the week holding today");
  assert.strictEqual(built.weekCount, 3);
  assert.strictEqual(built.weekPlanned, 3);
  assert.strictEqual(built.weekDone, 1, "Monday is done, Wednesday and Friday are not");
  assert.deepStrictEqual(
    built.segments.map((segment) => segment.state),
    ["past", "current", "upcoming"]
  );
  assert.deepStrictEqual(
    built.segments.map((segment) => Math.round(segment.fraction * 100)),
    [100, 33, 0],
    "a segment fills by the share of its workouts done"
  );
  assert.deepStrictEqual(
    built.days.map((entry) => entry.state),
    ["done", "rest", "planned", "rest", "planned", "rest", "rest"]
  );
  assert.deepStrictEqual(
    built.days.map((entry) => entry.isToday),
    [false, false, true, false, false, false, false]
  );
  assert.strictEqual(built.lastDoneIso, "2026-09-28");
}

{
  // Before the program starts: its first week. After it ends: its last.
  const before = card.buildProgramCard(program(), { todayIso: "2026-08-01" });

  assert.strictEqual(before.blockNumber, 1);
  assert.strictEqual(before.weekNumber, 1);
  assert.ok(before.days.every((entry) => !entry.isToday));

  const after = card.buildProgramCard(program(), { todayIso: "2026-12-24" });

  assert.strictEqual(after.blockNumber, 2);
  assert.strictEqual(after.weekNumber, 3);
}

{
  // A week without days still counts as a week, and a program with no weeks
  // has no card.
  const rows = [
    { mesocycle_id: 1, mesocycle_number: 1, microcycle_id: 11, microcycle_number: 1, day_id: null },
    { mesocycle_id: 1, mesocycle_number: 1, microcycle_id: 12, microcycle_number: 2, day_id: null },
  ];
  const built = card.buildProgramCard(rows, { todayIso: "2026-09-30" });

  assert.strictEqual(built.weekCount, 2);
  assert.strictEqual(built.weekPlanned, 0);
  assert.ok(built.days.every((entry) => entry.state === "rest"));
  assert.strictEqual(card.buildProgramCard([], { todayIso: "2026-09-30" }), null);
}

{
  // Which program: the one with a workout today, else the most recent, else
  // the first.
  const a = { id: "a", hasWorkoutToday: false, lastDoneIso: "2026-09-20" };
  const b = { id: "b", hasWorkoutToday: false, lastDoneIso: "2026-09-28" };
  const c = { id: "c", hasWorkoutToday: true, lastDoneIso: null };

  assert.strictEqual(card.pickCardProgram([a, b, c]).id, "c");
  assert.strictEqual(card.pickCardProgram([a, b]).id, "b");
  assert.strictEqual(card.pickCardProgram([{ id: "x" }, { id: "y" }]).id, "x");
  assert.strictEqual(card.pickCardProgram([]), null);
}

console.log("Program card: block, week, progress, the seven days and which program passed.");
