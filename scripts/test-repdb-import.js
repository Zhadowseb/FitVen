// The RepDB import: which exercises count as ones we have, how their muscles
// become ours, and that the SQL can be run twice and survives an apostrophe.
// Runs on a handful of made-up rows; the real dataset is never downloaded
// here.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  planImport,
  buildSql,
  normalizeName,
  SAME_AS_OURS,
  MUSCLES,
} = require("./generate-repdb-import");

const MUSCLE_IDS = new Set(Array.from({ length: 25 }, (_, index) => index + 1));

// One name, however it is written.
assert.strictEqual(normalizeName("Push-Ups"), normalizeName("push up"));
assert.strictEqual(normalizeName("Hip Adduction"), normalizeName("Hip adduction"));
assert.notStrictEqual(normalizeName("Leg Press"), normalizeName("Leg Curl"));

const plan = planImport(
  [
    // Ours under another name.
    { name_en: "Barbell Bench Press", primary_muscles: ["pectoralis_major"] },
    // Ours, written differently.
    { name_en: "Push Ups", primary_muscles: ["pectoralis_major"] },
    // New, with a muscle that is three of ours and one that is both.
    {
      name_en: "Front Squat",
      category: "strength",
      primary_muscles: ["quadriceps", "gluteus_maximus"],
      secondary_muscles: ["gluteus_maximus", "erector_spinae"],
    },
    // New, with an apostrophe, and only muscles we do not have.
    {
      name_en: "Captain's Chair Knee Raise",
      category: "strength",
      primary_muscles: ["forearm_flexors"],
      secondary_muscles: ["adductors"],
    },
    // The same name twice in RepDB.
    { name_en: "Front squat", primary_muscles: ["quadriceps"] },
  ],
  ["Bench Press", "Push-ups"],
  MUSCLE_IDS
);

assert.deepStrictEqual(
  plan.skipped.map((row) => row.name),
  ["Barbell Bench Press", "Push Ups", "Front squat"],
  "an exercise we have, under any spelling, is not added again"
);
assert.deepStrictEqual(plan.added.map((row) => row.name), [
  "Front Squat",
  "Captain's Chair Knee Raise",
]);

const frontSquat = plan.added[0];
assert.deepStrictEqual(
  frontSquat.muscles,
  [
    { muscleId: 10, level: "primary" },
    { muscleId: 11, level: "primary" },
    { muscleId: 12, level: "primary" },
    { muscleId: 19, level: "primary" },
    { muscleId: 22, level: "secondary" },
  ],
  "the quadriceps are our three, and a muscle that is both stays primary"
);
assert.deepStrictEqual(plan.added[1].muscles, [], "no muscle of ours is no muscle row");

// A muscle the script has not been told about stops it, rather than vanishing.
assert.deepStrictEqual(
  planImport([{ name_en: "Odd Lift", primary_muscles: ["pinky_toe"] }], [], MUSCLE_IDS)
    .unknownMuscles,
  ["pinky_toe"]
);
assert.throws(
  () => planImport([{ name_en: "Lift", primary_muscles: ["triceps_brachii"] }], [], new Set([1])),
  /not in public."Muscle"/,
  "a muscle id the cloud does not have is an error"
);

// Every equivalent names one of the RepDB names it is meant for exactly once,
// and every mapped muscle id is one of our 25.
assert.strictEqual(new Set(Object.keys(SAME_AS_OURS)).size, Object.keys(SAME_AS_OURS).length);
for (const ids of Object.values(MUSCLES)) {
  for (const id of ids) {
    assert.ok(MUSCLE_IDS.has(id), `muscle id ${id} is one of ours`);
  }
}

// The SQL: idempotent, apostrophes escaped, and no row inserted by hand id
// when the cloud gives ids itself.
const sql = buildSql(plan.added);
assert.ok(sql.includes("'Captain''s Chair Knee Raise'"), "an apostrophe is escaped");
assert.ok(
  /where not exists \(\s*select 1 from public."Exercise" e where lower\(e.name\) = lower\(r.name\)/.test(sql),
  "a name already in the catalog, in any case, is left alone"
);
assert.ok(sql.includes("begin;") && sql.includes("commit;"), "one transaction");
assert.ok(sql.includes("Exercise data by RepDB (repdb.co)"), "the SQL carries the attribution");

// The generated file stays out of the public repository, and the attribution
// the licence asks for is where it says.
const root = path.join(__dirname, "..");
assert.ok(
  fs.readFileSync(path.join(root, ".gitignore"), "utf8").includes("supabase/generated/"),
  "the generated SQL is ignored by git"
);
assert.ok(
  fs.readFileSync(path.join(root, "README.md"), "utf8").includes("Exercise data by [RepDB](https://repdb.co)"),
  "README.md credits RepDB"
);

const profile = fs.readFileSync(path.join(root, "src/Pages/ProfilePage/ProfilePage.js"), "utf8");
assert.ok(
  profile.includes('const REPDB_URL = "https://repdb.co";') &&
    profile.includes('t("profile.exerciseDataCredit")') &&
    profile.includes("Linking.openURL(REPDB_URL)"),
  "the profile screen shows the credit and links to repdb.co"
);
for (const locale of ["en", "da"]) {
  const source = fs.readFileSync(
    path.join(root, `src/Localization/locales/${locale}/profile.js`),
    "utf8"
  );
  assert.ok(
    source.includes('exerciseDataCredit: "Exercise data by RepDB (repdb.co)"'),
    `the ${locale} credit is RepDB's own wording`
  );
}

console.log(
  "RepDB import: equivalents and spellings are skipped, muscles map to ours with primary winning, the SQL is idempotent and escaped, and the data stays out of git with RepDB credited."
);
