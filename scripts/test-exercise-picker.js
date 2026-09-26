// "Add exercise": the + adds, and pressed again takes out - at once for an
// exercise added on this visit, after a question for one that was in the
// workout before the picker opened. And the Android half of the bug: a
// modal's onDismiss, which everything that opens a second modal waits for,
// never fired there.
//
// The mistakes this pins are the quiet ones: a second press that adds a
// duplicate instead of taking the first back out, a question about an
// exercise added a second ago, no question about one with sets from earlier,
// and a delete confirm that never appears on Android.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const picker = loadAppModule("src/Utils/exercisePickerSession.js");

/* ------------------------------------------------------------- a visit -- */

{
  // The workout as the picker opens: Bench twice, Squat once.
  const opened = picker.createPickerSession([
    { exerciseId: 11, exerciseName: "Bench Press" },
    { exerciseId: 12, exerciseName: "Squat" },
    { exerciseId: 13, exerciseName: "bench press" },
    { exerciseId: null, exerciseName: "Broken" },
    { exerciseId: 14, exerciseName: "" },
  ]);

  assert.deepStrictEqual([...opened.snapshot.keys()], ["bench press", "squat"], "the snapshot keeps rows without an id or a name");
  assert.deepStrictEqual(opened.snapshot.get("bench press"), [11, 13], "the same exercise twice is one entry with both ids");

  // Already there: ticked, and taking it out asks first - with every copy.
  assert.strictEqual(picker.isInWorkout(opened, "Squat"), true);
  assert.strictEqual(picker.wasAlreadyThere(opened, "SQUAT"), true, "names are compared without case");
  assert.deepStrictEqual(
    picker.planToggle(opened, "Bench Press"),
    { action: "removeExisting", exerciseIds: [11, 13], count: 2 },
    "taking out an exercise that was there before does not ask first, or leaves a copy"
  );

  // Not there: the + adds it; pressed again it comes straight back out.
  assert.deepStrictEqual(picker.planToggle(opened, "Deadlift"), { action: "add" });
  const added = picker.withAdded(opened, "Deadlift", 21);

  assert.strictEqual(picker.isInWorkout(added, "Deadlift"), true);
  assert.strictEqual(picker.wasAddedThisVisit(added, "deadlift"), true);
  assert.strictEqual(picker.wasAlreadyThere(added, "Deadlift"), false, "an exercise added now reads as there before");
  assert.deepStrictEqual(
    picker.planToggle(added, "Deadlift"),
    { action: "undo", exerciseId: 21 },
    "the second press on an exercise added this visit adds a duplicate, or asks"
  );
  assert.strictEqual(picker.addedThisVisitCount(added), 1);

  const undone = picker.withUndone(added, "Deadlift");

  assert.strictEqual(picker.isInWorkout(undone, "Deadlift"), false, "an undone exercise still reads as in the workout");
  assert.strictEqual(picker.addedThisVisitCount(undone), 0, "Done still counts an exercise taken back out");
  assert.deepStrictEqual(picker.planToggle(undone, "Deadlift"), { action: "add" }, "a third press does not add it again");

  // One from before, taken out after the question, and then put back: it is
  // now this visit's, so the next press takes it out without asking.
  const removed = picker.withRemovedExisting(opened, "Squat");

  assert.strictEqual(picker.isInWorkout(removed, "Squat"), false);
  assert.deepStrictEqual(picker.planToggle(removed, "Squat"), { action: "add" }, "a removed exercise cannot be put back");

  const putBack = picker.withAdded(removed, "Squat", 31);

  assert.strictEqual(picker.isInWorkout(putBack, "Squat"), true);
  assert.deepStrictEqual(
    picker.planToggle(putBack, "Squat"),
    { action: "undo", exerciseId: 31 },
    "an exercise put back on this visit asks before it comes out again"
  );

  // The session is never changed in place: React state and the ref hold it.
  assert.strictEqual(picker.isInWorkout(opened, "Deadlift"), false, "a change to the session edited the one before it");
  assert.deepStrictEqual(picker.planToggle(opened, ""), { action: "none" });

  // A new visit starts from what the workout holds by then: last visit's add
  // is now an exercise that was already there.
  const nextVisit = picker.createPickerSession([{ exerciseId: 21, exerciseName: "Deadlift" }]);

  assert.strictEqual(picker.planToggle(nextVisit, "Deadlift").action, "removeExisting", "last visit's add comes out without a question");
}

/* ------------------------------------------------------------- wiring -- */

const catalogPage = read("src/Pages/ExerciseCatalogPage/ExerciseCatalogPage.js");

// The snapshot is taken once, when the picker opens - a focus is not a new
// visit, and the muscle modal or a new custom exercise refocuses nothing.
assert.ok(
  /useEffect\(\(\) => \{\s*if \(!isWorkoutPicker\)[\s\S]*?getWorkoutExerciseEntries\(db, workoutPickerId\)/.test(catalogPage),
  "the picker no longer snapshots the workout when it opens"
);
assert.ok(
  !/useFocusEffect\([\s\S]{0,200}getWorkoutExerciseEntries/.test(catalogPage),
  "the snapshot is taken on focus, so every return to the picker starts a new visit"
);
assert.ok(
  /plan\.action === "removeExisting"[\s\S]*?setRemoveRequest\(/.test(catalogPage) &&
    /<ThemedConfirmModal[\s\S]*?removeExistingTitle[\s\S]*?onConfirm=\{confirmRemoveExisting\}/.test(catalogPage),
  "taking out an exercise from before the picker opened no longer asks"
);
assert.ok(
  /plan\.action === "undo"[\s\S]*?deleteExercise\(db, exerciseId\)/.test(catalogPage) &&
    // The fallback that finds the copy never picks one from before the visit.
    /!before\.has\(entry\.exerciseId\)/.test(catalogPage),
  "undoing an add no longer takes the exercise out"
);
assert.ok(
  /!isSessionReady/.test(catalogPage),
  "the + works before the picker knows what the workout holds, and adds duplicates"
);

// The add hands back the new exercise's id - the only way to take it out again.
const weightliftingService = read("src/Services/weightliftingService.js");

assert.ok(
  /export async function addExerciseToWorkout[\s\S]*?return \{ exerciseId \};\s*\}/.test(weightliftingService),
  "addExerciseToWorkout no longer returns the new exercise's id"
);

// Only the + adds; a tap on the row shows the muscles.
const list = read("src/Pages/ExerciseLibraryPage/Components/ExerciseLibraryList/ExerciseLibraryList.js");
const pickerRow = list.slice(list.indexOf("const addedHere = wasAddedHere(exercise);"));

assert.ok(
  /onPress=\{\(\) => setSelectedExercise\(exercise\)\}/.test(pickerRow.slice(0, 1500)),
  "a tap on the picker row adds the exercise again, instead of showing its muscles"
);
assert.ok(
  /onToggleExercise\?\.\(exercise\)/.test(pickerRow) && /removeFromWorkoutA11y/.test(pickerRow),
  "the picker's + no longer takes an exercise back out"
);
assert.ok(
  !/addAnotherToWorkoutA11y/.test(pickerRow.slice(0, 4000)),
  "the picker row still offers to add the same exercise again"
);

/* ------------------------------------------------ Android's onDismiss -- */

// React Native fires Modal's onDismiss on iOS only. ThemedModal fires it on
// Android from `visible` turning false, or the delete confirm opened from an
// exercise's settings - and "Discard" leaving Edit profile - never happen.
const reactNativeModal = fs.readFileSync(
  require.resolve("react-native/Libraries/Modal/Modal.js", { paths: [root] }),
  "utf8"
);
const themedModal = read("src/Resources/ThemedComponents/ThemedModal.js");

if (/OnDismiss is implemented on iOS only/.test(reactNativeModal)) {
  assert.ok(
    /Platform\.OS === "ios" \|\| !wasVisible \|\| visible/.test(themedModal) &&
      /onDismissRef\.current\?\.\(\)/.test(themedModal),
    "ThemedModal leaves onDismiss to React Native, which never fires it on Android"
  );
  assert.ok(
    /onDismiss=\{Platform\.OS === "ios" \? onDismiss : undefined\}/.test(themedModal),
    "ThemedModal can fire onDismiss twice on iOS"
  );
}

console.log(
  "Exercise picker: the + adds and takes out, the question only for what was there before, one snapshot a visit, and onDismiss on Android passed."
);
