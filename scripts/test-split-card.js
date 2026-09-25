// The Train tab's split card: a chosen split resolved against the history,
// which session is next, what counts as this week, what the editor offers,
// and what "Repeat also" lists.
const assert = require("assert");
const loadAppModule = require("./lib/loadAppModule");

const split = loadAppModule("src/Utils/splitCard.js");

// Thursday 24 September 2026, noon. This week began on Monday the 21st.
const now = new Date(2026, 8, 24, 12).getTime();
const iso = (month, day) => `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
let id = 0;
const row = (label, date, extra = {}) => ({
  workout_id: ++id,
  label,
  workout_type: extra.type ?? "Resistance",
  date_iso: date,
  done: extra.done ?? 1,
  exercise_count: extra.exercises ?? 5,
  is_favorite: extra.favorite ? 1 : 0,
});

const library = [
  row("Push", iso(9, 22), { exercises: 6 }),
  row("Pull", iso(9, 18), { exercises: 7 }),
  row("Legs", iso(9, 14), { exercises: 8 }),
  row("Push 2", iso(9, 15)),
  row("Arms", iso(9, 10), { favorite: true }),
  row("Resistance", iso(9, 20)), // an unnamed quick start
  row("Easy run", iso(9, 19), { type: "Run" }),
  row("Mobility", iso(9, 23), { done: 0 }),
  row("Core", iso(8, 1)),
];

const history = split.namedHistory(library);

assert.deepStrictEqual(
  history.map((entry) => entry.name),
  ["Push", "Pull", "Push 2", "Legs", "Arms", "Core"],
  "finished, named strength workouts only, newest first"
);
assert.strictEqual(history.find((entry) => entry.name === "Push 2").key, "push", "\"Push 2\" is the same session as Push");

// A chosen split: Push, Pull and Legs, plus one never done.
const sessions = split.resolveChosenSplit(["Push", "Pull", "Legs", "Chest day"], history, { now });

assert.deepStrictEqual(
  sessions.map((session) => [session.name, session.lastWorkoutId !== null, session.daysSince, session.exerciseCount]),
  [
    ["Push", true, 2, 6],
    ["Pull", true, 6, 7],
    ["Legs", true, 10, 8],
    ["Chest day", false, null, 0],
  ]
);
assert.deepStrictEqual(sessions.map((session) => session.doneThisWeek), [true, false, false, false]);
assert.deepStrictEqual(
  sessions.map((session) => session.isUpNext),
  [false, false, false, true],
  "a session never done is the longest since of all"
);

const done = split.resolveChosenSplit(["Push", "Pull", "Legs"], history, { now });

assert.deepStrictEqual(done.map((session) => session.isUpNext), [false, false, true], "longest since is next");

// The guess, in the card's shape: its own "next", and this week by date.
const guessed = split.sessionsFromGuess(
  [
    { name: "Upper", lastWorkoutId: 1, lastTrainedAt: new Date(2026, 8, 21).getTime(), daysSince: 3, exerciseCount: 6, isUpNext: false },
    { name: null, lastWorkoutId: 2, lastTrainedAt: new Date(2026, 8, 17).getTime(), daysSince: 7, exerciseCount: 5, isUpNext: true },
  ],
  { now }
);

assert.deepStrictEqual(guessed.map((session) => session.doneThisWeek), [true, false], "Monday is this week, last Thursday is not");
assert.deepStrictEqual(guessed.map((session) => session.isUpNext), [false, true]);

// The editor: guessed names first, then names used in the last 90 days by
// how often, then favourites - once each.
const candidates = split.splitCandidates({ guess: [{ name: "Upper" }, { name: "Push" }], history, now });

assert.deepStrictEqual(candidates, ["Upper", "Push", "Pull", "Legs", "Arms", "Core"]);

const older = split.namedHistory([row("Old split", iso(5, 1))]);

assert.deepStrictEqual(
  split.splitCandidates({ guess: [], history: older, now }),
  [],
  "a name last used five months ago is not offered"
);

// Repeat also: the favourite outside the split first, then the rest by date.
const also = split.repeatAlsoItems({ history, splitNames: ["Push", "Pull"], now });

assert.deepStrictEqual(also.map((item) => item.name), ["Arms", "Legs", "Core"]);
assert.deepStrictEqual(also.map((item) => item.daysSince), [14, 10, 54]);
assert.strictEqual(split.repeatAlsoItems({ history, splitNames: [], now, limit: 2 }).length, 2);

// This week begins on Monday, whatever day it is.
assert.strictEqual(split.startOfThisWeek(new Date(2026, 8, 27, 23).getTime()), new Date(2026, 8, 21).getTime(), "Sunday belongs to the week of the Monday before");
assert.strictEqual(split.startOfThisWeek(new Date(2026, 8, 21, 0, 5).getTime()), new Date(2026, 8, 21).getTime());

// Nothing at all.
assert.deepStrictEqual(split.namedHistory([]), []);
assert.deepStrictEqual(split.resolveChosenSplit([], [], { now }), []);
assert.deepStrictEqual(split.repeatAlsoItems({ history: [], now }), []);

console.log("Split card: the chosen split, next, this week, the editor's names and Repeat also passed.");
