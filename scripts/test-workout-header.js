// The header a strength workout draws: its options button, the type beside
// its title, and the keep-the-screen-on toggle.
//
// "Restart workout knappen er forsvundet." The three dots top right were
// still in the code. What had changed was the slot beside the title: it
// announced an auto-rename ("Named Push after your exercises") for six
// seconds, and when #294 started passing the workout type to
// workoutDisplayName, a missing name came back as the type's name instead of
// null. So the sentence stood there on every strength workout - "Named
// Strength training after your exercises" - and the slot did not shrink, so
// on a phone it pushed the options button, and with it Restart and Change
// name, off the right edge.
//
// "Der skal bare stå hvad for en type det er": the slot now names the type,
// and the strength type when it cannot tell.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n/g, "\n");

/* ------------------------------------------------ the type beside the title -- */
{
  const i18n = loadAppModule("src/Localization/i18n.js");
  const { strengthWorkoutTypeTag, workoutDisplayName } = loadAppModule(
    "src/Utils/workoutTypeLabel.js"
  );
  const inDanish = (key, params) => i18n.translate(key, params, "da");
  const inEnglish = (key, params) => i18n.translate(key, params, "en");

  // A fresh workout is called after its type: the tag would only repeat it.
  const freshTitle = workoutDisplayName("Resistance", inDanish, "Resistance");
  assert.strictEqual(freshTitle, "Styrketræning");
  assert.strictEqual(strengthWorkoutTypeTag("Resistance", inDanish, freshTitle), null);
  assert.strictEqual(
    strengthWorkoutTypeTag("Upperbody", inDanish, workoutDisplayName("Upperbody", inDanish, "Upperbody")),
    null
  );

  // Named after its exercises, or by somebody: the tag says what it is.
  assert.strictEqual(
    strengthWorkoutTypeTag("Resistance", inDanish, workoutDisplayName("Push", inDanish, "Resistance")),
    "Styrketræning"
  );
  assert.strictEqual(strengthWorkoutTypeTag("Resistance", inEnglish, "Monday heavy"), "Strength training");
  assert.strictEqual(strengthWorkoutTypeTag("StrengthTraining", inDanish, "Mandag"), "Styrketræning");
  assert.strictEqual(strengthWorkoutTypeTag("Upperbody", inDanish, "Mandag"), "Overkrop");

  // No type, or one it does not know: strength training, never a raw id and
  // never a key.
  assert.strictEqual(strengthWorkoutTypeTag(null, inDanish, "Mandag"), "Styrketræning");
  assert.strictEqual(strengthWorkoutTypeTag("", inEnglish, "Monday"), "Strength training");
  assert.strictEqual(strengthWorkoutTypeTag("SomethingNew", inDanish, "Mandag"), "Styrketræning");
  assert.strictEqual(strengthWorkoutTypeTag("Resistance", null, "Mandag"), null);

  // The sentence is gone, in both languages.
  for (const language of ["en", "da"]) {
    const table = i18n.getLocaleTable(language);
    assert.strictEqual(table.workout.session.autoNamed, undefined, `${language}: autoNamed is gone`);
    assert.ok(table.workout.session.keepAwake, `${language}: the keep-awake label`);
  }
}

/* ------------------------------------------------------ the options button -- */
{
  const page = read("src/Pages/WorkoutPage/WorkoutPage.js");
  const resistance = read("src/Pages/WorkoutPage/WorkoutTypes/Resistance/Resistance.js");
  const style = read("src/Pages/WorkoutPage/WorkoutTypes/Resistance/ResistanceStyle.js");

  assert.ok(!/autoNamed/.test(page + resistance), "the auto-rename sentence is not drawn");

  // The strength branch hands the sheet's opener to the header it draws.
  const strengthBranch = page.slice(page.indexOf("if (isStrengthWorkout) {"));
  assert.ok(
    /<Resistance[\s\S]*?onOpenOptions=\{\(\) => setOptionsBottomsheetVisible\(true\)\}/.test(strengthBranch),
    "WorkoutPage opens the options sheet from the strength header"
  );
  assert.ok(
    /workoutTypeTag=\{strengthWorkoutTypeTag\(workoutType, t, strengthTitle\)\}/.test(strengthBranch),
    "the slot gets the type, not a sentence"
  );

  // The sheet: Change name and Restart, and Restart is offered on strength.
  assert.ok(/onPress=\{openLabelModal\}/.test(page), "Change name is in the sheet");
  assert.ok(/workoutService\.updateWorkoutLabel\(db,/.test(page), "the name is saved through the service");
  assert.ok(
    /\{supportsTimerRestart && \([\s\S]*?onPress=\{confirmRestartWorkout\}/.test(page),
    "Restart is in the sheet"
  );
  assert.ok(
    /const supportsTimerRestart =\s*isRunWorkout \|\| isWalkWorkout \|\| isStrengthWorkout;/.test(page),
    "Restart is offered on a strength workout"
  );
  assert.ok(
    /setRestartRequestKey\(Date\.now\(\)\)/.test(page) &&
      /if \(!restartRequestKey\) \{\s*return;\s*\}\s*restartWorkout\(\);/.test(resistance),
    "the confirmed restart reaches the strength screen"
  );

  // The header draws the button, wired to the sheet.
  assert.ok(
    /<TouchableOpacity[^>]*?onPress=\{onOpenOptions\}[\s\S]*?<ThreeDots /.test(resistance),
    "the strength header draws the three dots"
  );

  // And nothing beside the title can push it out of the row: the type sits
  // in the title's own column, which is the one thing in the row that gives.
  const block = (name) => style.match(new RegExp(`\\n  ${name}: \\{([\\s\\S]*?)\\n  \\}`))?.[1] ?? "";
  assert.ok(/flexShrink: 0/.test(block("navButton")), "the header buttons do not shrink");
  assert.ok(
    /flex: 1/.test(block("navTitleGroup")) && /minWidth: 0/.test(block("navTitleGroup")),
    "the title column gives way"
  );
  const navRow = resistance.slice(
    resistance.indexOf("<View style={styles.navRow}>"),
    resistance.indexOf("<View style={styles.timerRow}>")
  );
  const group = navRow.slice(navRow.indexOf("<View style={styles.navTitleGroup}>"));
  const groupEnd = group.indexOf("</View>");
  assert.ok(groupEnd > 0, "the title column is in the header");
  assert.ok(
    group.indexOf("{workoutTypeTag}") > 0 && group.indexOf("{workoutTypeTag}") < groupEnd,
    "the type is inside the title's column, not beside it"
  );
  assert.ok(
    group.indexOf("styles.navTitle}") > 0 && group.indexOf("styles.navTitle}") < groupEnd,
    "and so is the title"
  );
}

/* ----------------------------------------------- the renamed workout syncs -- */
{
  const repository = read("src/Repository/workoutRepository.js");
  const update = repository.match(/export async function updateWorkoutLabel[\s\S]*?\n\}/)?.[0] ?? "";
  assert.ok(/SET label = \?/.test(update) && /needs_sync = 1/.test(update), "a rename is queued for the cloud");
  assert.ok(/sync_version = \?/.test(update), "with a new version");
}

/* --------------------------------------------------- keep the screen on -- */
(async () => {
  const stored = new Map();
  loadAppModule.stubModule("@react-native-async-storage/async-storage", {
    __esModule: true,
    default: {
      getItem: async (key) => (stored.has(key) ? stored.get(key) : null),
      setItem: async (key, value) => {
        stored.set(key, value);
      },
      removeItem: async (key) => {
        stored.delete(key);
      },
    },
  });

  const service = loadAppModule("src/Services/keepAwakeService.js");

  assert.strictEqual(await service.getKeepAwakeEnabled(), false, "off until somebody turns it on");
  await service.setKeepAwakeEnabled(true);
  assert.strictEqual(stored.get("fitven.workout.keepAwake"), "1", "the choice is remembered");
  assert.strictEqual(await service.getKeepAwakeEnabled(), true);
  await service.setKeepAwakeEnabled(false);
  assert.strictEqual(stored.get("fitven.workout.keepAwake"), "0");
  assert.strictEqual(await service.getKeepAwakeEnabled(), false);

  // The hold itself is the screen's: it depends on the clock and on focus.
  const hook = read("src/Pages/WorkoutPage/WorkoutTypes/Resistance/useWorkoutKeepAwake.js");
  assert.ok(
    /const shouldKeepAwake = enabled && isRunning && !isDone && isFocused;/.test(hook),
    "only while on, running, not finished, and in front"
  );
  assert.ok(/useIsFocused\(\)/.test(hook), "leaving the screen lets go, not only unmounting");
  assert.ok(
    /activateKeepAwakeAsync\(KEEP_AWAKE_TAG\)/.test(hook) &&
      /return \(\) => \{[\s\S]*?deactivateKeepAwake\(KEEP_AWAKE_TAG\)/.test(hook),
    "every hold is let go under its own tag"
  );
  assert.ok(
    /try \{\s*keepAwake = require\("expo-keep-awake"\);\s*\} catch/.test(hook),
    "a build without the module keeps the workout screen"
  );

  const services = read("src/Services/index.js");
  assert.ok(/keepAwakeService/.test(services));
  assert.ok(
    !/(from|require\()\s*"expo-keep-awake"/.test(read("src/Services/keepAwakeService.js")),
    "no native module in a service"
  );

  const resistance = read("src/Pages/WorkoutPage/WorkoutTypes/Resistance/Resistance.js");
  assert.ok(/useWorkoutKeepAwake\(\{\s*isRunning,\s*isDone,\s*\}\)/.test(resistance));
  assert.ok(
    /accessibilityLabel=\{t\("workout.session.keepAwake"\)\}\s*accessibilityState=\{\{ selected: keepAwakeEnabled \}\}/.test(
      resistance
    ),
    "the toggle says what it is and whether it is on"
  );

  // The button is a phone whose screen stays on, not a sun - a sun beside
  // the header reads as the light/dark switch - and it shows its state by
  // shape as well as colour: the screen lit and light coming off it.
  assert.ok(!/UI-icons\/Sun"/.test(resistance), "the keep-awake button is still a sun");
  assert.ok(
    /<ScreenOn\s+width=\{18\}\s+height=\{18\}\s+on=\{keepAwakeEnabled\}/.test(resistance),
    "the icon is not told whether the screen is kept on"
  );

  loadAppModule.stubModule("react-native", { useColorScheme: () => "light" });
  loadAppModule.stubModule("react-native-svg", {
    __esModule: true,
    default: "Svg",
    Path: "Path",
    Rect: "Rect",
  });
  const ScreenOn = loadAppModule("src/Resources/Icons/UI-icons/ScreenOn.js").default;
  const parts = (on) =>
    [ScreenOn({ on, color: "#123456" }).props.children]
      .flat(Infinity)
      .filter(Boolean)
      .map((part) => ({ type: part.type, ...part.props }));
  const off = parts(false);
  const on = parts(true);
  const screen = (drawn) => drawn.filter((part) => part.type === "Rect")[1];

  assert.strictEqual(screen(off).fill, "none", "off, the screen is an outline");
  assert.strictEqual(screen(on).fill, "#123456", "on, the screen is lit");
  assert.ok(on.filter((part) => part.type === "Path").length > off.filter((part) => part.type === "Path").length, "on, light comes off it");

  const packageJson = JSON.parse(read("package.json"));
  assert.ok(packageJson.dependencies["expo-keep-awake"], "expo-keep-awake is declared");

  // Tapping the exercise's name with a field open only puts the keyboard
  // away, and the field saves what was typed (the owner's video of 2026-10-03:
  // the card folded and the new weight was lost). Only a press that folds or
  // unfolds the card is held back; the note, the history and the first set
  // work on the first tap, whoever's keyboard is up.
  {
    const { cardPressAction } = loadAppModule("src/Utils/cardPress.js");

    assert.strictEqual(cardPressAction({ keyboardVisible: true, folds: true }), "dismiss", "a fold with a keyboard up only puts it away");
    assert.strictEqual(cardPressAction({ keyboardVisible: false, folds: true }), "run", "without a keyboard the card folds");
    assert.strictEqual(cardPressAction({ keyboardVisible: true, folds: false }), "run", "the note, history or first set waited for a second tap");
    assert.strictEqual(cardPressAction({ keyboardVisible: false, folds: false }), "run");
    assert.strictEqual(cardPressAction(), "run", "no keyboard and no fold said: the press runs");

    // The cell's commit, as ThemedEditableCell runs it from blur, submit,
    // keyboardDidHide and unmount: against what was last committed.
    const { shouldCommitEdit } = loadAppModule("src/Utils/editCommit.js");
    const cell = (value) => {
      const writes = [];
      let committed = value;
      let local = value;

      return {
        writes,
        type: (next) => {
          local = next;
        },
        commit: () => {
          if (!shouldCommitEdit(local, committed)) return;
          committed = local;
          writes.push(local);
        },
      };
    };

    const untouched = cell("60");
    untouched.commit(); // unmount
    assert.deepStrictEqual(untouched.writes, [], "a cell nobody changed wrote on unmount");

    const edited = cell("60");
    edited.type("62.5");
    edited.commit(); // blur
    edited.commit(); // keyboardDidHide
    edited.commit(); // unmount
    assert.deepStrictEqual(edited.writes, ["62.5"], "one change, one write - not one per way of leaving the field");

    edited.type("60");
    edited.commit();
    assert.deepStrictEqual(edited.writes, ["62.5", "60"], "changing it back is a change too");

    const empty = cell(null);
    empty.type("");
    empty.commit();
    assert.deepStrictEqual(empty.writes, [""], "clearing a field is saved");

    // The wiring nothing above can see.
    const row = read("src/Pages/WorkoutPage/WorkoutTypes/Resistance/Components/ExerciseList/Components/ExerciseRow/ExerciseRow.js");
    assert.ok(row.includes("cardPressAction({ keyboardVisible: Keyboard.isVisible(), folds })"), "the card asks cardPressAction");
    assert.ok(row.includes("handleCardPress(onToggleExpanded, { folds: true })"), "folding the card is marked as a fold");
    assert.ok(!row.includes("handleCardPress(onToggleExpanded)"), "a fold of the card is not marked as one");
    const editable = read("src/Resources/ThemedComponents/ThemedEditableCell.js");
    assert.ok(editable.includes("shouldCommitEdit(nextValue, committedValueRef.current)"), "the cell asks shouldCommitEdit");
    assert.ok(editable.includes("useEffect(() => () => commitRef.current?.(), []);"), "a field taken away while edited saves");
    assert.ok(editable.includes('Keyboard.addListener("keyboardDidHide"'), "putting the keyboard away saves the field");
  }

  console.log("workout header: ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
