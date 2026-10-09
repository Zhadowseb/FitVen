// The catalog migration that adds 402 exercises: what it promises in its
// header has to hold in its SQL, since nothing runs it here.

const assert = require("assert");
const fs = require("fs");
const path = require("path");

// With the line endings of every checkout: a Windows one turns LF into CRLF.
const sql = fs
  .readFileSync(path.join(__dirname, "../supabase/migrations/20261010090000_more-catalog-exercises.sql"), "utf8")
  .replace(/\r\n/g, "\n");

// The catalog as it was before this migration: every template has to be one
// of these, or the exercises copying it would get no muscles.
const CATALOG_BEFORE = ["Ab Wheel", "Arnold Press", "Barbell Row", "Bench Dips", "Bench Press", "Bicep Curl", "Bulgarian Split Squat", "Cable Crunch", "Cable Curl", "Cable External Shoulder Rotation", "Cable Flyes", "Cable Overhead Tricep Extension", "Chest Flies", "Chest Supported Row", "Chin-up", "Close Grip Bench Press", "Concentration Curl", "Crunches", "Cycling", "Deadlift", "Decline Bench Press", "Dips", "Dumbbell Press", "Dumbbell Pullover", "EZ Bar Curl", "Elliptical", "Face Pull", "Farmers Carry", "Front Raise", "Glute Bridge", "Goblet Squat", "Hack Squat", "Hammer Curl", "Hanging Leg Raise", "Hip Thrust", "Hip adduction", "Incline Bench Press", "Incline Dumbbell Curl", "Incline Dumbbell Press", "Jump Rope", "Lat Pulldown", "Lateral Raise", "Leg Curl", "Leg Extension", "Leg Press", "Lower Back Extension", "Lunges", "Machine Chest Press", "Machine Row", "Mountain Climbers", "Neck Curl", "Neck Extension", "Overhead Press", "Overhead Triceps Pushdown", "Pec Deck", "Plank", "Preacher Curl", "Pull up", "Push-ups", "Rack Pull", "Rear Delt Flies", "Reverse Curl", "Reverse Pec Deck", "Romanian Deadlift", "Rowing", "Running", "Russian Twist", "Seated Cable Row", "Seated Calf Raise", "Seated Leg Curl", "Shoulder Press", "Shrugs", "Single Arm Dumbbell Row", "Single Arm Tricep Extension", "Skullcrusher", "Sled Push", "Smith Machine Bench Press", "Smith Machine Squat", "Squat", "Stairmaster", "Standing Calf Raise", "Straight Arm Pulldown", "Sumo Deadlift", "T-Bar Row", "Tricep Kickback", "Unilateral Seated Row", "Upright Row", "Walking Lunges", "Wrist Curl"];

const rows = [...sql.matchAll(/^  \('((?:[^']|'')+)', '((?:[^']|'')+)'\)[,;]?$/gm)].map((match) => ({
  name: match[1].replace(/''/g, "'"),
  template: match[2].replace(/''/g, "'"),
}));

assert.strictEqual(rows.length, 402, "402 new exercises");

const normalize = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/s$/, "");
const seen = new Set(CATALOG_BEFORE.map(normalize));
for (const { name } of rows) {
  assert.ok(!seen.has(normalize(name)), `"${name}" is new, under any spelling`);
  seen.add(normalize(name));
}

for (const { name, template } of rows) {
  assert.ok(
    template === "ABDUCTION" || CATALOG_BEFORE.includes(template),
    `"${name}" copies "${template}", one of ours`
  );
}

assert.ok(/^begin;$/m.test(sql) && /^commit;$/m.test(sql), "one transaction");
assert.ok(
  sql.includes('where not exists (\n      select 1 from public."Exercise" e where lower(e.name) = lower(n.name)'),
  "a name already in the catalog, in any case, is left alone"
);
assert.ok(
  sql.includes("where m.exercise_id = a.exercise_id and m.muscle_id = a.muscle_id"),
  "a muscle row an exercise already has is not added twice"
);
assert.ok(
  sql.includes("pg_get_serial_sequence('public.\"Exercise\"', 'id')") &&
    sql.includes("pg_get_serial_sequence('public.\"Muscle_Activation\"', 'id')"),
  "both id sequences are moved past the highest id first - they were behind on 2026-10-06"
);
assert.ok(sql.includes("raise exception 'A template is missing"), "a missing template stops it");
assert.ok(sql.includes("'Captain''s Chair Knee Raise'"), "an apostrophe is escaped");
assert.ok(!/stretch|\bpose\b|pilates/i.test(rows.map((row) => row.name).join("\n")), "no stretches or yoga");

// With them the catalog has 2101 muscle rows, past PostgREST's 1000-row cap,
// so the app reads them a page at a time - and only through that one reader.
const service = fs.readFileSync(path.join(__dirname, "../src/Services/weightliftingService.js"), "utf8");
assert.strictEqual(
  (service.match(/\.from\(MUSCLE_ACTIVATION_TABLE\)/g) ?? []).length,
  1,
  "Muscle_Activation is read in one place"
);
const reader = service.slice(service.indexOf("async function fetchMuscleActivations"));
assert.ok(
  /\.order\("id", \{ ascending: true \}\)[\s\S]*\.limit\(MUSCLE_ACTIVATION_PAGE_SIZE\)[\s\S]*\.gt\("id", lastId\)/.test(
    reader.slice(0, 1200)
  ),
  "that place pages by id, so no exercise past the first 1000 rows comes back without muscles"
);

console.log(
  "More catalog exercises: 402 new names, none ours under another spelling, each copying one of our 89, in one idempotent transaction."
);
