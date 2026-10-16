// The popular exercises at the top of the exercise library.
//
// "Populære øvelser: de mest populære øvelser pr. bruger - antallet af brugere,
// øvelsen er brugt af. Bygge et system ind, der tjekker hvor hyppigt: bruger
// brugeren øvelsen hver uge, eller er det en one-off? Prøver de den én gang,
// er det bare en prøvelse. En nedre kant, der er ret lav."
//
// The rule (Utils/exercisePopularity.js), its twin in the migration that counts
// it on the server, and the screen that draws it.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const popularity = loadAppModule("src/Utils/exercisePopularity.js");

/* ------------------------------------------------------ one person's habit -- */

assert.deepStrictEqual(
  [popularity.POPULAR_WINDOW_DAYS, popularity.POPULAR_MIN_WORKOUTS, popularity.POPULAR_MIN_SHARE, popularity.POPULAR_MIN_USERS],
  [90, 3, 0.15, 2]
);

const regular = (workoutsWith, totalWorkouts) => popularity.isRegularExercise({ workoutsWith, totalWorkouts });

assert.strictEqual(regular(1, 4), false, "tried once is a try, however few workouts there are");
assert.strictEqual(regular(2, 5), false, "twice is not yet a habit");
assert.strictEqual(regular(3, 10), true, "three of ten is");
assert.strictEqual(regular(3, 20), true, "three of twenty is 15 %: the bar is that low");
assert.strictEqual(regular(3, 21), false, "three of twenty-one is under it: a lot of workouts and a few times");
assert.strictEqual(regular(12, 80), true, "every seventh workout or more");
assert.strictEqual(regular(10, 80), false, "10 of 80 is 12.5 %");
assert.strictEqual(regular(3, 0), false, "no workouts, no habit");
assert.strictEqual(regular(undefined, 10), false);
assert.strictEqual(regular(5, "abc"), false);

/* ------------------------------------------------------------ the answer -- */

assert.deepStrictEqual(
  popularity.normalizePopularRows([
    { exercise_name: " Bench Press ", regular_users: 7, tried_users: 12 },
    { exercise_name: "Only one", regular_users: 1, tried_users: 3 },
    { exercise_name: "", regular_users: 9, tried_users: 9 },
    { regular_users: 9 },
    null,
    { exercise_name: "Squat", regular_users: "5", tried_users: null },
  ]),
  [
    { exerciseName: "Bench Press", regularUsers: 7, triedUsers: 12 },
    { exerciseName: "Squat", regularUsers: 5, triedUsers: 0 },
  ],
  "a row is a name and counts; one popular for fewer than two people is never listed"
);
assert.deepStrictEqual(popularity.normalizePopularRows(null), []);

const library = [
  { exercise_name: "Squat" },
  { exercise_name: "bench press" },
  { exercise_name: "Deadlift" },
];
const entries = popularity.popularLibraryEntries(
  [
    { exerciseName: "Bench Press", regularUsers: 9 },
    { exerciseName: "Not in this library", regularUsers: 8 },
    { exerciseName: "Squat", regularUsers: 6 },
    { exerciseName: "Deadlift", regularUsers: 3 },
  ],
  library,
  { limit: 2 }
);

assert.deepStrictEqual(
  entries.map((entry) => [entry.exercise.exercise_name, entry.regularUsers]),
  [["bench press", 9], ["Squat", 6]],
  "the server's order, the library's own exercise, an unknown one skipped, and no more than asked for"
);
assert.deepStrictEqual(popularity.popularLibraryEntries(undefined, undefined), []);

/* -------------------------------------------- the server counts the same -- */

const migration = read("supabase/migrations/20261016090000_popular-exercises.sql");

assert.ok(/v_today - 89 and v_today/.test(migration), "the window is 90 days, today included");
assert.ok(/used\.workouts_with >= 3/.test(migration), "three workouts in the migration");
assert.ok(/used\.workouts_with \/ per_person\.total >= 0\.15/.test(migration), "15 % in the migration");
assert.ok(/p_min_users integer default 2/.test(migration), "two people in the migration");
assert.ok(/logged_set\.done::text in \('true', '1', 't'\)/.test(migration), "a set must be ticked off, not only planned");
assert.ok(/security definer/.test(migration) && /set search_path = ''/.test(migration), "it counts everybody's workouts, so it runs as its owner");
assert.ok(
  /revoke all on function public\.popular_exercises\(integer, integer\) from public, anon;/.test(migration) &&
    /grant execute on function public\.popular_exercises\(integer, integer\) to authenticated;/.test(migration),
  "only signed-in people may call it"
);
assert.ok(/auth\.uid\(\) is null/.test(migration), "nobody signed in gets nothing");
assert.ok(/from public\."Exercise" exercise/.test(migration), "only catalogue exercises are listed: a custom name is its owner's text");
assert.ok(
  /\| `20261016090000_popular-exercises\.sql` \| no \|/.test(read("supabase/migrations/README.md")),
  "the migration is in the ledger, not run"
);

/* ------------------------------------------------- the service and screen -- */

const service = read("src/Services/exercisePopularityService.js");

assert.ok(/supabase\.rpc\("popular_exercises"/.test(service), "the service asks public.popular_exercises");
assert.ok(/42883/.test(service) && /PGRST202/.test(service), "the migration not being run is not an error");
assert.ok(/export async function getPopularExercises/.test(service));
assert.ok(/exercisePopularityService/.test(read("src/Services/index.js")), "the service is exported");

const list = read("src/Pages/ExerciseLibraryPage/Components/ExerciseLibraryList/ExerciseLibraryList.js");
const listStyle = read("src/Pages/ExerciseLibraryPage/Components/ExerciseLibraryList/ExerciseLibraryListStyle.js");
const page = read("src/Pages/ExerciseCatalogPage/ExerciseCatalogPage.js");

assert.ok(!/ThemedCard/.test(list), "the library is drawn on the background, not on a card");
assert.ok(!/styles\.card\b/.test(list));
assert.ok(!/backgroundColor: cardSurface,\s*borderColor: cardBorder,\s*\},\s*\]\}\s*ListEmptyComponent/.test(list), "the picker's list is not a card either");
assert.ok(!/pickerExerciseList: \{[^}]*border/.test(listStyle), "no border round the picker's list");
assert.ok(/exercisePopularityService\.getPopularExercises\(\)/.test(list), "the library asks for the popular exercises");
assert.ok(
  /showPopular =\s*popularEntries\.length > 0 && normalizedSearchQuery === "" && activeFilterCount === 0/.test(list),
  "the section is at the top until the person searches or filters"
);
assert.strictEqual((list.match(/renderPopularSection\(/g) ?? []).length, 2, "the section is drawn in the catalogue and in the picker");
assert.ok(/exercises\.library\.popularUsers/.test(list), "each popular row says how many train it");
assert.ok(/ListHeaderComponent=\{/.test(list), "the catalogue's search and map are the list's header");
assert.ok(!/<ScrollView[^>]*keyboardDismissMode="on-drag"[\s\S]{0,200}\{exerciseList\}/.test(page), "the page has no scroll view round a list that scrolls itself");
assert.ok(/\{exerciseList\}<\/View>/.test(page));

for (const language of ["en", "da"]) {
  const words = read(`src/Localization/locales/${language}/exercises.js`);

  assert.ok(/\bpopular: "/.test(words) && /popularUsers: \{ one: "\{count\}/.test(words), `${language} names the section and its count`);
}

console.log(
  "Popular exercises: a habit is three workouts and 15 % of a person's last 90 days, the server counts the same, only signed-in people ask, " +
    "the library shows the top of it until you search, and it is drawn on the background, not on a card."
);
