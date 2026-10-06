#!/usr/bin/env node
// Builds the SQL that adds the RepDB exercises FitVen does not have yet to the
// cloud catalog (public."Exercise" and public."Muscle_Activation").
//
//   npm run repdb:import            writes supabase/generated/repdb-import.sql
//
// Why the SQL is generated and not committed: RepDB's free tier
// (https://github.com/RepDB/exercise-dataset, LICENSE-DATA.md) allows the data
// inside an app with attribution, but not republishing it - or a modified or
// derived dataset - as a dataset. This repository is public, so the list of
// exercises with their muscles stays out of it. What is committed is our own
// work: which RepDB exercise is one we already have, and which of our muscles
// each of theirs is. The dataset is downloaded when the script runs, and the
// output goes to supabase/generated/, which git ignores.
//
// The attribution - "Exercise data by RepDB (repdb.co)" - is in README.md and
// on the profile screen. Both have to stay while the catalog holds RepDB rows.
//
// The current catalog is read with the app's own public key (the one in
// src/Database/supaBaseClient.js), so an exercise added by hand since is
// still recognised. Nothing is written: the SQL is run by hand in the
// Supabase SQL editor.

const fs = require("fs");
const path = require("path");

const REPDB_URL =
  "https://raw.githubusercontent.com/RepDB/exercise-dataset/main/exercises.json";
const OUTPUT = path.join(__dirname, "..", "supabase", "generated", "repdb-import.sql");
const CLIENT_SOURCE = path.join(__dirname, "..", "src", "Database", "supaBaseClient.js");

// RepDB exercises that are one we already have under another name. Matching by
// name alone misses these ("Barbell Bench Press" is our "Bench Press"), and
// adding them would split one lift's history and records over two names.
// The ones marked "judgement" could have gone either way.
const SAME_AS_OURS = {
  "Ab Wheel Rollout": "Ab Wheel",
  "Bent-Over Barbell Row": "Barbell Row",
  "Barbell Bench Press": "Bench Press",
  "Dumbbell Bicep Curl": "Bicep Curl", // judgement: ours does not say which bar
  "Cable External Rotation": "Cable External Shoulder Rotation",
  "Cable Fly": "Cable Flyes",
  "Dumbbell Fly": "Chest Flies", // judgement
  "Chest-Supported Dumbbell Row": "Chest Supported Row",
  "Chin-Ups": "Chin-up",
  "Close-Grip Bench Press": "Close Grip Bench Press",
  "Stationary Bike": "Cycling",
  "Barbell Deadlift": "Deadlift",
  "Decline Barbell Bench Press": "Decline Bench Press",
  "Chest Dips": "Dips",
  "Dumbbell Bench Press": "Dumbbell Press",
  "EZ-Bar Curl": "EZ Bar Curl",
  "Elliptical Trainer": "Elliptical",
  "Cable Face Pull": "Face Pull",
  "Dumbbell Farmer's Walk": "Farmers Carry",
  "Dumbbell Front Raise": "Front Raise",
  "Dumbbell Hammer Curl": "Hammer Curl",
  "Barbell Hip Thrust": "Hip Thrust",
  "Incline Barbell Bench Press": "Incline Bench Press",
  "Dumbbell Lateral Raise": "Lateral Raise",
  "Lying Leg Curl": "Leg Curl",
  "Back Extension": "Lower Back Extension",
  "Lunge": "Lunges",
  "Barbell Overhead Press": "Overhead Press",
  "Cable Tricep Pushdown": "Overhead Triceps Pushdown", // judgement
  "Pull-Up": "Pull up",
  "Push-Up": "Push-ups",
  "Rear Delt Fly": "Rear Delt Flies",
  "Dumbbell Reverse Fly": "Rear Delt Flies",
  "Rowing Machine": "Rowing",
  "Treadmill Running": "Running", // judgement
  "Dumbbell Shoulder Press": "Shoulder Press", // judgement
  "Barbell Shrug": "Shrugs", // judgement
  "Single-Arm Dumbbell Row": "Single Arm Dumbbell Row",
  "Single-Arm Dumbbell Overhead Tricep Extension": "Single Arm Tricep Extension",
  "Skull Crusher": "Skullcrusher",
  "Stair Climber": "Stairmaster",
  "Straight-Arm Pulldown": "Straight Arm Pulldown",
  "Barbell Back Squat": "Squat",
  "Dumbbell Tricep Kickback": "Tricep Kickback",
  "One-Arm Seated Cable Row": "Unilateral Seated Row",
  "Barbell Upright Row": "Upright Row",
  "Walking Lunge": "Walking Lunges",
  "Barbell Wrist Curl": "Wrist Curl", // judgement
};

// RepDB muscle -> ids in public."Muscle". A RepDB muscle that is a group of
// ours (the quadriceps, the hamstrings) becomes each of them. The ones with no
// match in our 25 - the forearms, the adductors, the
// supraspinatus - are left out; an exercise with only those has no muscles
// in FitVen and does not show up in a muscle filter.
const MUSCLES = {
  pectoralis_major: [1],
  anterior_deltoid: [3],
  lateral_deltoid: [4],
  posterior_deltoid: [5],
  serratus_anterior: [6],
  biceps_brachii: [7],
  brachialis: [7],
  rectus_abdominis: [8],
  transverse_abdominis: [8],
  obliques: [9],
  quadriceps: [10, 11, 12],
  hip_flexors: [10], // Rectus Femoris, as on our Hanging Leg Raise
  gastrocnemius: [14],
  soleus: [13],
  hamstrings: [16, 17, 18],
  gluteus_maximus: [19],
  gluteus_medius: [20],
  abductors: [20],
  latissimus_dorsi: [21],
  erector_spinae: [22],
  quadratus_lumborum: [22],
  trapezius: [23],
  rhomboids: [24],
  triceps_brachii: [25],
  // No muscle of ours.
  adductors: [],
  brachioradialis: [],
  forearm_extensors: [],
  forearm_flexors: [],
  forearms: [],

  supraspinatus: [],
};

// Every catalog exercise has these columns on by default today.
const DEFAULT_VISIBLE_COLUMNS = JSON.stringify({
  rpe: false,
  set: true,
  done: true,
  note: false,
  reps: true,
  rest: true,
  weight: true,
  rm_percentage: false,
});

/** "Push-Ups", "push ups" and "Push-up" are one name. */
function normalizeName(name) {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/s$/, "");
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function readPublicClient() {
  const source = fs.readFileSync(CLIENT_SOURCE, "utf8");
  const url = source.match(/const supabaseUrl = ['"]([^'"]+)['"]/)?.[1];
  const key = source.match(/(eyJ[A-Za-z0-9_.-]+|sb_publishable_[A-Za-z0-9_-]+)/)?.[1];

  if (!url || !key) {
    throw new Error("Could not find the app's Supabase URL and public key.");
  }

  return { url, key };
}

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`);
  }

  return response.json();
}

/**
 * Which RepDB exercises to add, and their muscles. Pure, so the test can run
 * it on a handful of rows.
 */
function planImport(repdbExercises, ourNames, knownMuscleIds) {
  const ours = new Map(ourNames.map((name) => [normalizeName(name), name]));
  const skipped = [];
  const added = [];
  const seen = new Set();
  const unknownMuscles = new Set();

  for (const exercise of repdbExercises) {
    const name = String(exercise.name_en ?? "").trim();
    const key = normalizeName(name);

    if (!name) {
      continue;
    }

    const equivalent = SAME_AS_OURS[name] ?? ours.get(key);

    if (equivalent) {
      skipped.push({ name, ours: equivalent });
      continue;
    }

    if (seen.has(key)) {
      skipped.push({ name, ours: "another RepDB exercise of the same name" });
      continue;
    }

    seen.add(key);

    // Primary wins: a muscle that is both stays primary.
    const levels = new Map();

    for (const [list, level] of [
      [exercise.primary_muscles, "primary"],
      [exercise.secondary_muscles, "secondary"],
    ]) {
      for (const muscle of Array.isArray(list) ? list : []) {
        const ids = MUSCLES[muscle];

        if (!ids) {
          unknownMuscles.add(muscle);
          continue;
        }

        for (const id of ids) {
          if (!knownMuscleIds.has(id)) {
            throw new Error(`Muscle id ${id} (for ${muscle}) is not in public."Muscle".`);
          }

          if (!levels.has(id)) {
            levels.set(id, level);
          }
        }
      }
    }

    added.push({
      name,
      category: exercise.category ?? null,
      muscles: [...levels].map(([muscleId, level]) => ({ muscleId, level })),
    });
  }

  return { added, skipped, unknownMuscles: [...unknownMuscles] };
}

function buildSql(added) {
  const exerciseRows = added
    .map((exercise) => `    (${sqlString(exercise.name)})`)
    .join(",\n");
  const activationRows = added
    .flatMap((exercise) =>
      exercise.muscles.map(
        ({ muscleId, level }) =>
          `    (${sqlString(exercise.name)}, ${muscleId}, ${sqlString(level)})`
      )
    )
    .join(",\n");

  return `-- RepDB exercises FitVen does not have yet: ${added.length} exercises.
-- Generated by scripts/generate-repdb-import.js on ${new Date().toISOString().slice(0, 10)}.
-- Not committed: RepDB's licence allows the data in the app, not republished
-- as a dataset, and the repository is public. See supabase/migrations/README.md.
--
-- Exercise data by RepDB (repdb.co) - https://repdb.co
--
-- Run in the Supabase SQL editor. It is one transaction and can be run again:
-- a name already in the catalog, in any case, is left alone.

-- 1. Optional, before: custom exercises with a name the catalog is about to
--    get. The phone keeps the custom one (the catalog row is ignored there),
--    so nothing is lost, but the owner may want to know.
-- select ce.name
-- from public.custom_exercise ce
-- join (values
${added.map((exercise) => `--   (${sqlString(exercise.name)})`).join(",\n")}
-- ) as n(name) on lower(n.name) = lower(ce.name);

begin;

create temporary table repdb_exercise (name text primary key);
insert into repdb_exercise (name) values
${exerciseRows};

create temporary table repdb_activation (
  exercise_name text not null,
  muscle_id integer not null,
  activation_level text not null
);
insert into repdb_activation (exercise_name, muscle_id, activation_level) values
${activationRows};

do $$
declare
  exercise_id_has_default boolean;
  activation_id_has_default boolean;
begin
  select column_default is not null or is_identity = 'YES'
    into exercise_id_has_default
  from information_schema.columns
  where table_schema = 'public' and table_name = 'Exercise' and column_name = 'id';

  select column_default is not null or is_identity = 'YES'
    into activation_id_has_default
  from information_schema.columns
  where table_schema = 'public' and table_name = 'Muscle_Activation' and column_name = 'id';

  if exercise_id_has_default then
    insert into public."Exercise" (name, default_visible_columns, official)
    select r.name, ${sqlString(DEFAULT_VISIBLE_COLUMNS)}, true
    from repdb_exercise r
    where not exists (
      select 1 from public."Exercise" e where lower(e.name) = lower(r.name)
    )
    order by r.name;
  else
    insert into public."Exercise" (id, name, default_visible_columns, official)
    select
      (select coalesce(max(id), 0) from public."Exercise")
        + row_number() over (order by r.name),
      r.name, ${sqlString(DEFAULT_VISIBLE_COLUMNS)}, true
    from repdb_exercise r
    where not exists (
      select 1 from public."Exercise" e where lower(e.name) = lower(r.name)
    );
  end if;

  if activation_id_has_default then
    insert into public."Muscle_Activation" (exercise_id, muscle_id, activation_level)
    select e.id, a.muscle_id, a.activation_level
    from repdb_activation a
    join public."Exercise" e on e.name = a.exercise_name
    where not exists (
      select 1 from public."Muscle_Activation" m
      where m.exercise_id = e.id and m.muscle_id = a.muscle_id
    );
  else
    insert into public."Muscle_Activation" (id, exercise_id, muscle_id, activation_level)
    select
      (select coalesce(max(id), 0) from public."Muscle_Activation")
        + row_number() over (order by e.id, a.muscle_id),
      e.id, a.muscle_id, a.activation_level
    from repdb_activation a
    join public."Exercise" e on e.name = a.exercise_name
    where not exists (
      select 1 from public."Muscle_Activation" m
      where m.exercise_id = e.id and m.muscle_id = a.muscle_id
    );
  end if;
end $$;

commit;

-- 2. The result: the RepDB names now in the catalog, and their muscle rows.
--    Expected: ${added.length} exercises.
select
  (select count(*) from repdb_exercise) as repdb_exercises,
  (select count(*) from public."Exercise" e
     join repdb_exercise r on r.name = e.name) as in_catalog,
  (select count(*) from public."Muscle_Activation" m
     join public."Exercise" e on e.id = m.exercise_id
     join repdb_exercise r on r.name = e.name) as muscle_rows,
  (select count(*) from public."Exercise") as catalog_total;
`;
}

async function main() {
  const { url, key } = readPublicClient();
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const [repdb, ourExercises, muscles] = await Promise.all([
    fetchJson(REPDB_URL),
    fetchJson(`${url}/rest/v1/Exercise?select=name&limit=5000`, headers),
    fetchJson(`${url}/rest/v1/Muscle?select=id&limit=5000`, headers),
  ]);

  const repdbExercises = Array.isArray(repdb) ? repdb : repdb.exercises;
  const plan = planImport(
    repdbExercises,
    ourExercises.map((row) => row.name),
    new Set(muscles.map((row) => Number(row.id)))
  );

  if (plan.unknownMuscles.length > 0) {
    throw new Error(
      `RepDB has muscles this script does not map yet: ${plan.unknownMuscles.join(", ")}`
    );
  }

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, buildSql(plan.added));

  const byCategory = {};
  for (const exercise of plan.added) {
    byCategory[exercise.category] = (byCategory[exercise.category] ?? 0) + 1;
  }
  const withoutPrimary = plan.added.filter(
    (exercise) => !exercise.muscles.some((muscle) => muscle.level === "primary")
  );

  console.log(`RepDB: ${repdbExercises.length} exercises. Our catalog: ${ourExercises.length}.`);
  console.log(`Already ours: ${plan.skipped.length}. To add: ${plan.added.length}.`);
  console.log(`To add by category: ${JSON.stringify(byCategory)}`);
  console.log(
    `No primary muscle of ours (${withoutPrimary.length}): ${withoutPrimary
      .map((exercise) => exercise.name)
      .join(", ")}`
  );
  console.log(`Written: ${path.relative(process.cwd(), OUTPUT)}`);
}

module.exports = { planImport, buildSql, normalizeName, SAME_AS_OURS, MUSCLES };

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message ?? error);
    process.exit(1);
  });
}
