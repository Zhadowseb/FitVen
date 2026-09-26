// The two pieces of reasoning behind the new Home, and the wiring that would
// otherwise only fail on a phone.
//
// The split guess and the week the split waits for are pure functions, which
// is why they were written as utils rather than inside the service or the
// screen - everything here drives the real code, not a copy of it. The date
// that week counts from is read by the real query, against an in-memory
// SQLite built from the real schema.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");
const splitGuess = loadAppModule("src/Utils/splitGuess.js");
const splitForming = loadAppModule("src/Utils/splitForming.js");

const DAY_MS = 86400000;

/* ---------------------------------------------------- reading the split -- */

// The finding this file did not cover. A workout started from the quick-start
// button carries no label, so the insert falls back to the workout type and
// stores the literal string "Resistance". Treating that as a name matched
// every unnamed session against every other one on the first check, before the
// exercise overlap was ever looked at - an upper-body day and a leg day became
// one card, for exactly the person Home was rebuilt for.
{
  const now = new Date(2026, 8, 22, 12, 0, 0).getTime();
  const unnamed = (id, daysAgo, exercises) => ({
    workoutId: id,
    name: "Resistance",
    workoutType: "Resistance",
    at: now - daysAgo * DAY_MS,
    exerciseIds: exercises,
    exerciseCount: exercises.length,
    setCount: exercises.length * 3,
  });

  assert.strictEqual(
    splitGuess.splitWorkoutName(unnamed(1, 0, [])),
    "",
    "a label that is only the workout type is being read as a name"
  );
  assert.strictEqual(
    splitGuess.splitWorkoutName({ name: "Push A", workoutType: "Resistance" }),
    "push a",
    "a real name stopped counting as one"
  );

  const upperDay = ["bench press", "row", "overhead press", "curl"];
  const lowerDay = ["squat", "deadlift", "leg curl"];
  const twoUnnamed = splitGuess.guessSplitGroups(
    [
      unnamed(10, 2, upperDay),
      unnamed(9, 4, lowerDay),
      unnamed(8, 9, upperDay),
      unnamed(7, 11, lowerDay),
      unnamed(6, 16, upperDay),
      unnamed(5, 18, lowerDay),
    ],
    { now }
  );

  assert.strictEqual(
    twoUnnamed.length,
    2,
    "two unnamed sessions with different exercises collapsed into one group"
  );

  // With no name to show, the cards have to be told apart some other way, and
  // the number has to be stable - the row sorts by who has waited longest.
  assert.ok(
    twoUnnamed.every((group) => group.name === null),
    "an unnamed group is being given a name it was never told"
  );
  assert.deepStrictEqual(
    twoUnnamed.map((group) => group.historyOrder).sort(),
    [0, 1],
    "the groups have no stable number for the card to fall back on"
  );

  const splitCards = fs.readFileSync(
    path.join(root, "src", "Pages", "HomePage", "Components", "SplitCards", "SplitCards.js"),
    "utf8"
  );

  assert.ok(
    /home\.split\.unnamed/.test(splitCards) && /historyOrder/.test(splitCards),
    "a group with no name draws a card with an empty title"
  );

  // The same hole, one component over. The quick-start button is the main
  // action on Home for the person who never names a session, and React drops
  // a null child silently - so the button drew no text at all, while
  // interpolate left the placeholder standing and the screen reader said
  // "Start {name}" out loud.
  const quickStart = fs.readFileSync(
    path.join(root, "src", "Pages", "HomePage", "Components", "QuickStartCard", "QuickStartCard.js"),
    "utf8"
  );

  assert.ok(
    !/\{upNext\.name\}/.test(quickStart) && /home\.split\.unnamed/.test(quickStart),
    "the quick start button prints an unnamed split straight out, which draws nothing"
  );
}

// A Tuesday, so the weekday arithmetic below is checkable by hand.
const now = new Date(2026, 8, 22, 12, 0, 0).getTime();
const workout = (id, name, daysAgo, exercises) => ({
  workoutId: id,
  name,
  at: now - daysAgo * DAY_MS,
  exerciseIds: exercises,
  exerciseCount: exercises.length,
  setCount: exercises.length * 3,
});

const upper = ["bench press", "row", "overhead press", "curl"];
const lower = ["squat", "deadlift", "leg curl"];

const twoDay = splitGuess.guessSplitGroups(
  [
    workout(10, "Upper", 2, upper),
    workout(9, "Lower", 4, lower),
    workout(8, "Upper", 9, upper),
    workout(7, "Lower", 11, lower),
    workout(6, "Upper 2", 16, upper),
    workout(5, "Lower", 18, lower),
  ],
  { now }
);

assert.strictEqual(twoDay.length, 2, "two sessions on a loop is a two-day split");
assert.deepStrictEqual(
  twoDay.map((group) => group.name).sort(),
  ["Lower", "Upper"],
  "a group is named after the spelling its owner used most"
);

const upNext = twoDay.find((group) => group.isUpNext);

assert.strictEqual(upNext.name, "Lower", "whose turn it is is who has waited longest");
assert.strictEqual(
  twoDay.filter((group) => group.isUpNext).length,
  1,
  "exactly one session is next"
);

// The quick-start button and the highlighted card have to be the same session,
// or the screen contradicts itself.
assert.strictEqual(
  upNext.lastWorkoutId,
  10 - 1,
  "the session that is due points at its own latest occurrence"
);

assert.strictEqual(
  twoDay.find((group) => group.name === "Upper").exerciseCount,
  upper.length,
  "the exercise count comes from the latest occurrence, not an average"
);

// Three occurrences is the floor: twice is a coincidence.
assert.deepStrictEqual(
  splitGuess.guessSplitGroups(
    [
      workout(4, "Upper", 2, upper),
      workout(3, "Lower", 4, lower),
      workout(2, "Upper", 9, upper),
      workout(1, "Lower", 11, lower),
    ],
    { now }
  ),
  [],
  "twice each is not a split"
);

// One session on repeat is not a split either - there is nothing to be next.
assert.deepStrictEqual(
  splitGuess.guessSplitGroups(
    [
      workout(3, "Full body", 2, upper),
      workout(2, "Full body", 5, upper),
      workout(1, "Full body", 8, upper),
    ],
    { now }
  ),
  [],
  "one repeated session is not a split"
);

// Renaming between sessions must not split a group in two: the exercises are
// the same, and that is what the overlap rule is for.
const renamed = splitGuess.guessSplitGroups(
  [
    workout(6, "Push day", 2, upper),
    workout(5, "Lower", 4, lower),
    workout(4, "Overkrop", 9, upper),
    workout(3, "Lower", 11, lower),
    workout(2, "Upper", 16, upper),
    workout(1, "Lower", 18, lower),
  ],
  { now }
);

assert.strictEqual(
  renamed.length,
  2,
  "three names for the same exercises is still one session"
);

/* ------------------------------------------------------------- weekdays -- */

// Every Upper landed on a Sunday, every Lower on a Friday.
assert.deepStrictEqual(
  twoDay.find((group) => group.name === "Upper").weekdays,
  [0],
  "a weekday shows when at least half the group lands on it"
);

// Scattered days qualify for nothing, and the line is left out rather than
// listing every day of the week.
const scattered = splitGuess.guessSplitGroups(
  [
    workout(6, "Upper", 1, upper),
    workout(5, "Lower", 4, lower),
    workout(4, "Upper", 8, upper),
    workout(3, "Lower", 12, lower),
    workout(2, "Upper", 17, upper),
    workout(1, "Lower", 21, lower),
  ],
  { now }
);

assert.ok(
  scattered.every((group) => group.weekdays.length <= 1),
  "training on a different day each week settles on at most one weekday"
);

/* ------------------------------------------------------- names and sets -- */

assert.strictEqual(splitGuess.normalizeSplitName(" Push A 2 "), "push a");
assert.strictEqual(
  splitGuess.normalizeSplitName("push a (2026-01-04)"),
  "push a",
  "a date in brackets is how people number repeats, not how they name sessions"
);
assert.strictEqual(
  splitGuess.normalizeSplitName("Push-Pull"),
  "push-pull",
  "a hyphen is part of a name somebody chose"
);

assert.strictEqual(splitGuess.exerciseOverlap(["a", "b", "c", "d"], ["a", "b", "c", "e"]), 0.6);
assert.strictEqual(splitGuess.exerciseOverlap([], ["a"]), 0, "nothing overlaps with nothing");

/* ---------------------------------------------- the split's first week -- */

// The split waits a week from the first finished workout. Somebody who trains
// one muscle group a day, six days a week, has nothing to recognise before the
// week has gone round once, so until then the row fills a dot a day - even
// when the guess could already make groups.
{
  const at = (day, hour = 0, minute = 0) => new Date(2026, 8, day, hour, minute).getTime();
  // What getFirstWorkoutAt hands over: the start of that day, local time.
  const firstDay = at(14);
  const state = (now, groupCount = 2, firstWorkoutAt = firstDay) =>
    splitForming.splitFormingState({ firstWorkoutAt, now, groupCount });

  assert.deepStrictEqual(
    splitForming.splitFormingState({ firstWorkoutAt: null, now: at(22, 12), groupCount: 3 }),
    { daysIn: null, filledDots: 0, showSplit: false, weekIsOver: false },
    "an account with no finished workout fills a dot, or is shown a split"
  );

  // The day of the first workout is the first dot, from its first minute to
  // its last.
  assert.deepStrictEqual(
    [state(at(14, 0, 1)).filledDots, state(at(14, 23, 59)).filledDots],
    [1, 1],
    "the day of the first workout is not the first dot"
  );

  // Calendar days, not 24-hour blocks: a workout late last night and a look
  // this morning is day two, though only hours have passed.
  assert.deepStrictEqual(
    state(at(15, 7), 0, at(14, 23, 30)),
    { daysIn: 1, filledDots: 2, showSplit: false, weekIsOver: false },
    "the first week is counted in 24-hour blocks, not calendar days"
  );

  // The seventh dot fills on the seventh day. The split shows seven days on,
  // and not before, whatever the guess had made by then.
  assert.deepStrictEqual(
    state(at(20, 23, 59), 3),
    { daysIn: 6, filledDots: 7, showSplit: false, weekIsOver: false },
    "the split shows before the first week is over"
  );
  assert.deepStrictEqual(
    state(at(21, 0, 1), 3),
    { daysIn: 7, filledDots: 7, showSplit: true, weekIsOver: true },
    "the split still waits once the first week is over"
  );

  assert.strictEqual(state(at(30, 12)).filledDots, 7, "more than seven dots are filled");
  assert.strictEqual(
    state(at(30, 12), 0).showSplit,
    false,
    "a split with no groups is shown in place of the row"
  );
  // Past the week with nothing to show, the row stops promising "after your
  // first week" - that week is over - and says what it waits for.
  assert.strictEqual(
    state(at(30, 12), 0).weekIsOver,
    true,
    "the row still promises the first week after it is over"
  );

  // A first workout dated ahead - a planned one ticked off early - is the
  // first day, not a negative one.
  assert.strictEqual(state(at(12, 9)).filledDots, 1, "a first workout dated ahead fills no dot");

  // The week the clocks go forward is an hour short - 29 March 2026, in
  // Denmark - and dividing by a day and rounding down makes it six days.
  assert.strictEqual(
    splitForming.splitFormingState({
      firstWorkoutAt: new Date(2026, 2, 26).getTime(),
      now: new Date(2026, 3, 2, 9).getTime(),
      groupCount: 2,
    }).showSplit,
    true,
    "the week across the spring clock change is counted as six days"
  );
}

/* ------------------------------------------------------------- wiring -- */

// Profile is not a tab any more, so the avatar is the only way in from Home.
const headerSource = fs.readFileSync(
  path.join(root, "src", "Pages", "HomePage", "Components", "GreetingHeader", "GreetingHeader.js"),
  "utf8"
);

assert.ok(
  /onOpenProfile/.test(headerSource) && /UserAvatar/.test(headerSource),
  "the header lost the avatar, and with it the way to the profile"
);

const navSource = fs.readFileSync(
  path.join(root, "src", "Resources", "ThemedComponents", "ThemedBottomNavigation.js"),
  "utf8"
);

assert.ok(
  /nav\.tabs\.feed/.test(navSource),
  "the bar has no Feed tab"
);
assert.ok(
  !/nav\.tabs\.profile/.test(navSource),
  "Profile is back in the bar, where it was reached by nobody"
);

// The running timer is the plus with a countdown in it, so it has to be the
// same shape. It used to turn back into a circle the moment a workout started,
// which read as a different control appearing mid-session - and the ring
// around it was a circle drawn around a square button.
assert.ok(
  !/borderRadius: 999/.test(navSource),
  "the running timer is a circle again, while the plus beside it is a rounded square"
);

assert.ok(
  !/<Circle|AnimatedCircle/.test(navSource),
  "the timer ring is a circle again"
);

// The countdown depletes a dash the length of the outline. A rounded rect's
// outline is its four straight runs plus four corner quarters - one full
// circle of the corner radius - and getting that wrong leaves the rest timer
// finishing early or never.
assert.ok(
  /4 \* \(LIVE_RING_SIDE - 2 \* LIVE_RING_CORNER\) \+ 2 \* Math\.PI \* LIVE_RING_CORNER/.test(
    navSource
  ),
  "the ring length is not the rounded rect's outline, so the rest countdown does not match it"
);

// Switching tabs must not rebuild Home. handleHomePress used to call
// resetRoot, which threw the stack away and mounted a new Home from nothing -
// skeleton, every query cold, friends and avatar fetched again. Measured on a
// phone with three months of history: 2.3 s before anything showed, 4.1 s
// before it was all there, on every tap. Handing the existing Home route
// back through reset() keeps its key, so the instance and what it drew
// survive.
const homeHandler = navSource.slice(
  navSource.indexOf("const handleHomePress = () => {"),
  navSource.indexOf("};", navSource.indexOf("const handleHomePress = () => {"))
);

assert.ok(
  !/resetRoot/.test(homeHandler),
  "the Home tab rebuilds Home from scratch on every press again"
);

assert.ok(
  /routes: \[home\]/.test(navSource) && /routes: \[home, existing \?\? \{ name: routeName \}\]/.test(navSource),
  "the tabs no longer hand the existing Home route back, so Home is remounted"
);

// In React Navigation 7, navigate() to a screen that is not on top pushes a
// new copy of it. Tabs that use it stack up duplicates, each mounted from
// nothing: Train -> Feed -> Train was two Trains.
for (const route of ["FeedPage", "ExplorePage", "ExerciseLibraryPage"]) {
  assert.ok(
    navSource.includes(`goToTab("${route}")`) &&
      !navSource.includes(`navigationRef.navigate("${route}")`),
    `the ${route} tab pushes a new copy of itself onto the stack again`
  );
}

// The indicator holds its space when transparent, or the active tab's icon
// sits above the others.
assert.ok(
  /backgroundColor: is\w+Active \? indicatorColor : "transparent"/.test(navSource),
  "the tab indicator no longer keeps its place when inactive"
);

const homeSource = fs.readFileSync(
  path.join(root, "src", "Pages", "HomePage", "HomePage.js"),
  "utf8"
);

assert.ok(
  !/WorkoutSummaryCard|workoutSummaryPosts/.test(homeSource),
  "posts are back on Home"
);

/* --------------------------------------------- today before a suggestion -- */

// Somebody who planned a session this morning, or left one half-done at lunch,
// wants that one back. Offering to start a second one beside it is almost
// never what was meant, so an unfinished workout on today outranks the split's
// suggestion. The empty workout stays either way.
const quickStartSource = fs.readFileSync(
  path.join(root, "src", "Pages", "HomePage", "Components", "QuickStartCard", "QuickStartCard.js"),
  "utf8"
);

assert.ok(
  /const primary = todayWorkout[\s\S]*?: upNext/.test(quickStartSource),
  "the split's suggestion is offered before an unfinished workout already on today"
);

assert.ok(
  /home\.quickStart\.emptyWorkout/.test(quickStartSource) &&
    !/primary \? null : null/.test(quickStartSource),
  "the empty workout is no longer always there"
);

// The outline went: every button inside already draws one, and the block is
// the screen's main action rather than a widget sitting on it.
const quickStartStyle = fs.readFileSync(
  path.join(root, "src", "Pages", "HomePage", "Components", "QuickStartCard", "QuickStartCardStyle.js"),
  "utf8"
);
const cardStyle = quickStartStyle.slice(
  quickStartStyle.indexOf("card: {"),
  quickStartStyle.indexOf("eyebrow: {")
);

assert.ok(
  !/borderWidth|borderRadius|padding:/.test(cardStyle),
  "the quick start block has its box back"
);

assert.ok(
  /getOpenWorkoutsToday/.test(homeSource),
  "Home no longer asks what is already open today"
);

/* ------------------------------------------------- a failure looks like one */

// The other finding. loadHome caught, logged to the console and set
// hasLoadedHome either way, and the three reads sat in one Promise.all - so
// one rejection emptied all three fields and told somebody with months of
// history that she had never trained. That is the same screen a real empty
// account gets, which is the one thing this page must not get wrong.
assert.ok(
  /Promise\.allSettled/.test(homeSource),
  "the reads are back in one Promise.all, so one failure blanks them all"
);

assert.ok(
  /setHomeError/.test(homeSource) && /home\.couldNotLoad/.test(homeSource),
  "a failed load leaves no trace on the screen again"
);

assert.ok(
  /home\.retry/.test(homeSource),
  "the error says something went wrong but offers no way to try again"
);

/* ------------------------------------------------- the first day ------- */

// Somebody who has just installed the app has no split and no sets, and used
// to meet a Home with holes in it. Every block now says what it will become,
// or has something to show without a history. A block that only appears weeks
// later cannot be looked forward to.

const splitSource = fs.readFileSync(
  path.join(root, "src", "Pages", "HomePage", "Components", "SplitCards", "SplitCards.js"),
  "utf8"
);
const formingSource = fs.readFileSync(
  path.join(root, "src", "Pages", "HomePage", "Components", "SplitCards", "SplitForming.js"),
  "utf8"
);

const splitBlock = splitSource.slice(splitSource.indexOf("export default function SplitCards("));

// Until the split shows, the forming row stands in for it. It does not vanish,
// and it does not wait for groups to exist.
assert.ok(
  !/return null/.test(splitBlock) &&
    /splitFormingState\(/.test(splitBlock) &&
    /showSplit \?[\s\S]*?:\s*\(?\s*<SplitForming /.test(splitBlock),
  "the split block vanishes again for somebody who has not trained yet"
);

// Named in both states, so the block says what it is for before there is a
// card to carry a name.
assert.ok(
  /home\.split\.eyebrow/.test(splitBlock) &&
    splitBlock.indexOf("home.split.eyebrow") < splitBlock.indexOf("showSplit ?"),
  "the split block is only named once there is a split"
);
assert.ok(
  /t\("home\.split\.forming"\)/.test(formingSource) &&
    /home\.split\.formingA11y/.test(formingSource),
  "the forming row says nothing about what the block will become"
);
assert.ok(
  !/TouchableOpacity|Pressable|onPress|accessibilityRole="button"/.test(formingSource),
  "the forming row can be pressed, with nothing to open"
);

/* ----------------------------------------------------- the first workout */

// Only when the empty workout is the only choice: nothing open today and
// nothing due in the split. With either, and while a workout runs, Quick start
// is what it was.
const firstWorkoutSource = fs.readFileSync(
  path.join(root, "src", "Pages", "HomePage", "Components", "QuickStartCard", "FirstWorkoutButton.js"),
  "utf8"
);
const firstWorkoutStyle = fs.readFileSync(
  path.join(root, "src", "Pages", "HomePage", "Components", "QuickStartCard", "FirstWorkoutButtonStyle.js"),
  "utf8"
);
const onlyEmptyAt = quickStartSource.indexOf("if (!primary) {");
const onlyEmptyBranch =
  quickStartSource.slice(onlyEmptyAt).match(/^[\s\S]*?\r?\n {2}\}\r?\n/)?.[0] ?? "";

assert.ok(
  onlyEmptyAt > quickStartSource.indexOf("if (runningWorkout) {") &&
    /<FirstWorkoutButton onPress=\{onStartEmpty\} isFirst=\{!hasTrained\} \/>/.test(onlyEmptyBranch),
  "the first workout is not what Quick start offers when the empty workout is the only choice"
);
assert.strictEqual(
  (quickStartSource.match(/<FirstWorkoutButton\b/g) ?? []).length,
  1,
  "the first workout is drawn beside a primary button, or in place of the live panel"
);
assert.ok(
  !/secondaryButtonAlone/.test(quickStartSource),
  "the quiet empty workout fills the block on its own again"
);

// The light is drawn only while it may move. With animations off - off
// screen, in the background, reduce motion - there is no stripe at all, not
// one standing still.
assert.ok(
  /const \{ animate \} = useAnimationsEnabled\(\)/.test(firstWorkoutSource) &&
    /\{animate && size \? <Shine /.test(firstWorkoutSource) &&
    (firstWorkoutSource.match(/<Shine\b/g) ?? []).length === 1,
  "the light on the first workout is drawn with animations off"
);

const shineSource = firstWorkoutSource.slice(
  firstWorkoutSource.indexOf("function Shine("),
  firstWorkoutSource.indexOf("export default function FirstWorkoutButton")
);

assert.ok(
  /pointerEvents="none"/.test(shineSource) &&
    /accessibilityElementsHidden/.test(shineSource) &&
    /importantForAccessibility="no-hide-descendants"/.test(shineSource),
  "the light takes touches, or is read out"
);
assert.ok(
  /accessibilityLabel=\{t\(isFirst \? "home\.quickStart\.startFirst" : "home\.quickStart\.startEmpty"\)\}/.test(
    firstWorkoutSource
  ),
  "the first workout reads out as something else"
);

// The same block comes up for somebody with months of history - today's
// session done, or nothing repeating yet - and "First workout" would be a
// lie to them. Home says which it is, from the history it already loads.
assert.ok(
  /t\(isFirst \? "home\.quickStart\.firstWorkout" : "home\.quickStart\.emptyWorkout"\)/.test(firstWorkoutSource) &&
    /t\(isFirst \? "home\.quickStart\.firstWorkoutSub" : "home\.quickStart\.emptyWorkoutSub"\)/.test(firstWorkoutSource),
  "the first workout is called that for somebody who has trained"
);
assert.ok(
  /hasTrained=\{daysSinceLastWorkout !== null \|\| firstWorkoutAt !== null\}/.test(homeSource),
  "Home no longer tells Quick start whether somebody has ever trained"
);

// iOS draws no shadow outside a view that hides its overflow, and the light
// has to be clipped - so the two sit on different views.
const buttonStyle = firstWorkoutStyle.slice(
  firstWorkoutStyle.indexOf("button: {"),
  firstWorkoutStyle.indexOf("surface: {")
);

assert.ok(
  /shadowRadius/.test(buttonStyle) &&
    !/overflow/.test(buttonStyle) &&
    /overflow: "hidden"/.test(firstWorkoutStyle),
  "the first workout's shadow is on the view that clips, where iOS does not draw it"
);

/* ------------------------------------------------------- from Explore --- */

// "Last month" showed somebody new five times 0 %. Explore has something from
// the first day, so it takes that place for everybody, after the friends.
assert.ok(
  !/MuscleGlance|muscleGlance|getMuscleGroupDeltas/.test(homeSource),
  "Last month is back on Home"
);
assert.ok(
  /<ExploreCarousel refreshKey=\{exploreRefreshKey\} \/>/.test(homeSource) &&
    homeSource.indexOf("<ExploreCarousel") > homeSource.indexOf("<FriendsActivity"),
  "Home does not show Explore where Last month was"
);

const handleRefresh = homeSource.slice(
  homeSource.indexOf("const handleRefresh = useCallback("),
  homeSource.indexOf("}, [loadCirclePreview, loadHome, refreshUnreadNotificationCount]);")
);

assert.ok(
  /setExploreRefreshKey\(/.test(handleRefresh),
  "pull-to-refresh does not reach the Explore rail"
);
assert.ok(
  /workoutService\.getFirstWorkoutAt\(db\)/.test(homeSource) &&
    /firstWorkoutAt=\{firstWorkoutAt\}/.test(homeSource),
  "the split is not told when the first workout was, so it never stops waiting"
);

/* ------------------------------------------ the first finished workout -- */

// The date the first week counts from, through the real query. A MIN over
// dates sees what a MAX never does: a date in neither spelling sorts before
// every real one, and read as the first day it would make months of history
// look like none.
async function checkFirstWorkoutQuery() {
  const repository = loadAppModule("src/Repository/weightliftingRepository.js");
  const { programSchemaSql } = loadAppModule("src/Database/schema/program.js");
  const raw = new DatabaseSync(":memory:");

  raw.exec(programSchemaSql);

  const db = {
    getFirstAsync: async (sql, params = []) => raw.prepare(sql).get(...params) ?? null,
  };

  assert.strictEqual(
    await repository.getFirstCompletedWorkoutDate(db),
    null,
    "an account with no workouts has a first one"
  );

  [
    { date: "2026-09-20", done: 1 },
    { date: "05.09.2026", done: 1 }, // the first, in the other spelling
    { date: "2026-09-01", done: 0 }, // planned, never finished
    { date: "2026-08-15", done: 1, deletedAt: "2026-08-16T10:00:00Z" },
    { date: "", done: 1 }, // neither spelling
  ].forEach((row, index) => {
    raw
      .prepare(
        "INSERT INTO Workout_Type_Instance (workout_id, day_id, date, done, deleted_at) VALUES (?, ?, ?, ?, ?)"
      )
      .run(index + 1, index + 1, row.date, row.done, row.deletedAt ?? null);
  });

  assert.strictEqual(
    await repository.getFirstCompletedWorkoutDate(db),
    "2026-09-05",
    "the first finished workout is not the earliest one finished, in either spelling"
  );
}

checkFirstWorkoutQuery()
  .then(() => {
    console.log(
      "Home quick start: the split guess, the weekday rule, the split's first week and the query it counts from, the first workout, Explore in place of last month, and the wiring passed."
    );
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
