// The Train tab's split card: a chosen split resolved against the history,
// which session is next, what counts as this week, what the editor offers,
// and what "Repeat also" lists.
const assert = require("assert");
const loadAppModule = require("./lib/loadAppModule");

const split = loadAppModule("src/Utils/splitCard.js");
const entries = loadAppModule("src/Utils/splitEntries.js");

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

// Picked from the calendar: any workout joins the split by its name, and
// only a name somebody gave counts as one.
assert.strictEqual(split.splitNameOf({ label: " Push A ", workout_type: "Resistance" }), "Push A");
assert.strictEqual(split.splitNameOf({ label: "Resistance", workout_type: "Resistance" }), null, "an unnamed quick start has no name to join under");
assert.strictEqual(split.splitNameOf({ label: "StrengthTraining", workout_type: "Resistance" }), null, "the same fallback in its older spelling");
assert.strictEqual(split.splitNameOf({ label: "Run", workout_type: "Run" }), null);
assert.strictEqual(split.splitNameOf({ label: "Legs", workout_type: "Resistance" }), "Legs", "a name the app gave from the exercises is still a session");
assert.strictEqual(split.splitNameOf({ label: "Long run", workout_type: "Run" }), "Long run", "a run can be a session too");
assert.strictEqual(split.splitNameOf({ label: "", workout_type: "Resistance" }), null);

// Adding to the split being edited. A name without a pin is the one session
// of that name; a pinned workout is itself, so two of one name are two.
const nameOnly = (name) => ({ name, workout: null, last: null });

assert.deepStrictEqual(entries.addSplitEntry([nameOnly("Push")], "Pull"), {
  entries: [nameOnly("Push"), nameOnly("Pull")],
  status: "added",
});
assert.strictEqual(entries.addSplitEntry([nameOnly("Push")], "push 2").status, "alreadyIn", "\"push 2\" is the Push already in it");
assert.strictEqual(
  entries.addSplitEntry([nameOnly("Push")], { name: "Push", workout: "heavy" }).status,
  "added",
  "a picked Push beside the Push by name"
);
assert.strictEqual(
  entries.addSplitEntry([{ name: "Push", workout: "heavy" }], { name: "Push", workout: "light" }).status,
  "added",
  "two different Push workouts are two sessions"
);
assert.strictEqual(
  entries.addSplitEntry([{ name: "Push", workout: "heavy" }], { name: "Push A", workout: "heavy" }).status,
  "alreadyIn",
  "the same workout twice is not"
);
assert.strictEqual(entries.addSplitEntry(["A", "B", "C", "D", "E", "F"].map(nameOnly), "G").status, "full");
assert.strictEqual(entries.addSplitEntry([nameOnly("Push")], "  ").status, "unnamed");
assert.strictEqual(
  entries.addSplitEntry([], { name: "Push", workout: "heavy", pinnedAt: 5 }).entries[0].pinnedAt,
  5,
  "what the editor draws beside a picked workout rides along"
);

// The templates behind a session with no finished strength workout of its
// name: a planned one, or a run.
const calendarLibrary = [
  ...library,
  row("Chest day", iso(9, 28), { done: 0, exercises: 4 }),
  row("Chest day", iso(9, 26), { done: 0, exercises: 3 }),
  row("Long run", iso(9, 13), { type: "Run", exercises: 0 }),
];
const templates = split.splitTemplates(calendarLibrary);

assert.ok(templates.some((entry) => entry.name === "Mobility" && !entry.done), "a planned workout is a template");
assert.ok(!templates.some((entry) => entry.name === "Resistance"), "an unnamed workout is not");

const picked = split.resolveChosenSplit(["Push", "Chest day", "Long run", "Nothing yet"], history, { now, templates });
const byName = Object.fromEntries(picked.map((session) => [session.name, session]));
const chestDay = calendarLibrary.find((entry) => entry.label === "Chest day" && entry.date_iso === iso(9, 28));
const longRun = calendarLibrary.find((entry) => entry.label === "Long run");

assert.strictEqual(byName.Push.lastWorkoutId, library[0].workout_id, "a finished strength workout still wins");
assert.strictEqual(byName["Chest day"].lastWorkoutId, chestDay.workout_id, "a planned-only session repeats its latest planned workout");
assert.strictEqual(byName["Chest day"].lastTrainedAt, null, "planned is not trained");
assert.strictEqual(byName["Chest day"].doneThisWeek, false);
assert.strictEqual(byName["Chest day"].exerciseCount, 4);
assert.strictEqual(byName["Long run"].lastWorkoutId, longRun.workout_id, "a finished run can be repeated");
assert.strictEqual(byName["Long run"].workoutType, "Run");
assert.strictEqual(byName["Long run"].daysSince, 11);
assert.strictEqual(byName["Nothing yet"].lastWorkoutId, null);
assert.strictEqual(
  picked.find((session) => session.isUpNext).name,
  "Chest day",
  "never trained is next, and the first of those in the split"
);
assert.deepStrictEqual(
  split.resolveChosenSplit(["Chest day"], history, { now }).map((session) => session.lastWorkoutId),
  [null],
  "without templates nothing changes"
);

// Pinned sessions: each repeats its own workout, and two of one name are
// told apart by what each has done itself.
{
  const pinnedRow = (syncId, workoutId, date, extra = {}) => ({
    sync_id: syncId,
    workout_id: workoutId,
    workout_type: "Resistance",
    date_iso: date,
    done: extra.done ?? 1,
    exercise_count: extra.exercises ?? 5,
    set_count: extra.sets ?? 15,
  });
  const pinned = split.pinnedWorkouts([
    pinnedRow("heavy", 101, iso(9, 7), { sets: 20 }),
    pinnedRow("light", 102, iso(9, 9), { sets: 12 }),
    pinnedRow("heavy-copy", 103, iso(9, 21)),
    pinnedRow("light-copy", 104, iso(9, 23), { done: 0 }),
  ]);
  const chosen = [
    { name: "Push", workout: "heavy", last: "heavy-copy" },
    "Pull",
    { name: "Push", workout: "light", last: "light-copy" },
  ];
  const sessions = split.resolveChosenSplit(chosen, history, { now, pinned, templates: split.splitTemplates(library) });

  assert.deepStrictEqual(sessions.map((session) => session.lastWorkoutId), [101, library[1].workout_id, 102], "each Push repeats its own workout");
  assert.deepStrictEqual(sessions.map((session) => session.setCount), [20, 0, 12]);
  assert.strictEqual(sessions[0].lastTrainedAt, new Date(2026, 8, 21).getTime(), "the heavy Push was last done as its copy on Monday");
  assert.strictEqual(sessions[0].doneThisWeek, true);
  assert.strictEqual(
    sessions[2].lastTrainedAt,
    new Date(2026, 8, 9).getTime(),
    "the light Push's copy is not finished, so it counts its own workout - not the heavy Push's Monday"
  );
  assert.deepStrictEqual(sessions.map((session) => session.isUpNext), [false, false, true], "the light Push has waited longest");
  assert.strictEqual(sessions[0].pinnedAt, new Date(2026, 8, 7).getTime(), "the editor is told the pinned workout's day");

  // A pinned workout deleted, or not on this phone yet: the session falls
  // back to its name.
  const gone = split.resolveChosenSplit([{ name: "Push", workout: "deleted" }, "Pull"], history, { now, pinned });

  assert.strictEqual(gone[0].lastWorkoutId, library[0].workout_id, "the latest Push, as a session by name");
  assert.strictEqual(gone[0].isPinned, false);

  // Only one pinned Push: its name counts every Push, as before.
  const single = split.resolveChosenSplit([{ name: "Push", workout: "light" }, "Pull"], history, { now, pinned });

  assert.strictEqual(single[0].lastWorkoutId, 102, "still its own workout to repeat");
  assert.strictEqual(single[0].daysSince, 2, "but trained whenever a Push was");

  // Home's cards: the same sessions, the same next, and only what can be opened.
  const groups = split.homeGroupsFromSplit(split.resolveChosenSplit([...chosen, "Chest day"], history, { now, pinned }));

  assert.deepStrictEqual(groups.map((group) => group.lastWorkoutId), [101, library[1].workout_id, 102], "a session with nothing to copy has no card");
  assert.ok(groups.every((group) => group.isChosen && Number.isFinite(group.daysSince)));
  assert.deepStrictEqual(groups.map((group) => group.isUpNext), [false, false, false], "Chest day is next and has no card, so no card is next - as Train then offers no Repeat");
  assert.deepStrictEqual(groups.map((group) => group.entry?.workout ?? null), ["heavy", null, "light"]);
  const planned = split.homeGroupsFromSplit(
    split.resolveChosenSplit(["Chest day", "Pull"], history, { now, templates: split.splitTemplates(calendarLibrary) })
  );

  assert.strictEqual(planned[0].daysSince, Number.MAX_SAFE_INTEGER, "never trained sorts as waiting longest");
  assert.strictEqual(planned[0].isUpNext, true, "and a planned session can be next on Home too");
}

// Nothing at all.
assert.deepStrictEqual(split.namedHistory([]), []);
assert.deepStrictEqual(split.resolveChosenSplit([], [], { now }), []);
assert.deepStrictEqual(split.repeatAlsoItems({ history: [], now }), []);

console.log("Split card: the chosen split, next, this week, the editor's names and Repeat also passed.");
