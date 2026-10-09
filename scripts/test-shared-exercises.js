// Shared custom exercises: the rules and the shapes in
// src/Utils/customExercises.js, the plan that syncs your own exercises both
// ways, and what the migration promises, read as text.
//
// The utils are run for real. The SQL is read the way the other migration
// checks read theirs: nothing here talks to a database, so those checks are a
// floor, not a proof - the migration itself was run against Postgres 17 with
// every scenario (owners, copies, blocks, reports, paging) when it was
// written. Kept fast: no database, no network, two small modules compiled.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");
// Line endings differ between files and checkouts; the checks read \n.
const read = (file) => fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");
const utils = loadAppModule("src/Utils/customExercises.js");
const enWords = loadAppModule("src/Localization/locales/en/customExercises.js").default;
const daWords = loadAppModule("src/Localization/locales/da/customExercises.js").default;

/* ------------------------------------------------------------- limits -- */

assert.strictEqual(utils.DESCRIPTION_MAX_LENGTH, 120);
assert.strictEqual(utils.STEP_MAX_LENGTH, 140);
assert.strictEqual(utils.MAX_STEPS, 5);
assert.strictEqual(utils.VIDEO_MAX_BYTES, 30 * 1024 * 1024);
assert.strictEqual(utils.DISTRIBUTION_MIN_SETS, 20);
assert.deepStrictEqual(utils.CUSTOM_EXERCISE_SORTS, ["popular", "newest", "gym", "following", "video", "saved"]);

/* --------------------------------------------------------- normalizers -- */

assert.strictEqual(utils.normalizeDescription("  Press   up\nand  in  "), "Press up and in", "whitespace collapses to one line");
assert.strictEqual(utils.normalizeDescription("   "), null, "a blank description is none");
assert.strictEqual(utils.normalizeDescription(null), null);
assert.strictEqual(utils.normalizeDescription("x".repeat(200)).length, 120, "capped at 120");

assert.deepStrictEqual(utils.normalizeSteps(["Kneel", "  ", " Press  up "]), ["Kneel", "Press up"], "blanks drop");
assert.deepStrictEqual(utils.normalizeSteps('["One","Two"]'), ["One", "Two"], "SQLite's JSON");
assert.deepStrictEqual(utils.normalizeSteps("not json"), [], "bad JSON is no steps");
assert.deepStrictEqual(utils.normalizeSteps(null), []);
assert.strictEqual(utils.normalizeSteps(["1", "2", "3", "4", "5", "6", "7"]).length, 5, "at most five");
assert.strictEqual(utils.normalizeSteps(["y".repeat(300)])[0].length, 140, "each at most 140");

assert.strictEqual(utils.normalizeEquipment(" Barbell "), "barbell");
assert.strictEqual(utils.normalizeEquipment("spaceship"), null);
assert.strictEqual(utils.normalizeWeightMode("PER_SIDE"), "per_side");
assert.strictEqual(utils.normalizeWeightMode("nonsense"), "total", "the default weight mode");
assert.strictEqual(utils.normalizeCustomExerciseSort("saved"), "saved");
assert.strictEqual(utils.normalizeCustomExerciseSort("best"), "popular");
assert.strictEqual(utils.normalizeReportReason("offensive"), "offensive");
assert.strictEqual(utils.normalizeReportReason("spam"), null, "a post's reason is not an exercise's");

assert.deepStrictEqual(utils.normalizeCustomExerciseMuscles({ primary: ["chest"], secondary: ["triceps", "chest"] }), {
  primary: ["chest"],
  secondary: ["triceps"],
});
assert.deepStrictEqual(utils.normalizeCustomExerciseMuscles('["quads","glutes"]'), {
  primary: ["quads", "glutes"],
  secondary: [],
}, "the legacy plain array is all primary");
assert.deepStrictEqual(utils.normalizeCustomExerciseMuscles("garbage"), { primary: [], secondary: [] });
assert.strictEqual(utils.primaryMuscleKey({ primary: ["lats"], secondary: [] }), "lats");
assert.strictEqual(utils.primaryMuscleKey(null), null);

assert.strictEqual(utils.muscleToneToken("chest"), "musclePush");
assert.strictEqual(utils.muscleToneToken("lats"), "musclePull");
assert.strictEqual(utils.muscleToneToken("quads"), "muscleLegs");
assert.strictEqual(utils.muscleToneToken("abs"), "muscleCore");
assert.strictEqual(utils.muscleToneToken("unknown"), "musclePush");

/* ---------------------------------------------------------- label keys -- */

function lookup(table, key) {
  return key.split(".").slice(1).reduce((node, part) => (node ? node[part] : undefined), table);
}

assert.strictEqual(utils.equipmentLabelKey("barbell"), "customExercises.equipment.barbell");
assert.strictEqual(utils.equipmentLabelKey("spaceship"), null);
assert.strictEqual(utils.weightModeLabelKey("per_side"), "customExercises.weightMode.perSide");
assert.strictEqual(utils.weightModeLabelKey(null), "customExercises.weightMode.total");
assert.strictEqual(utils.sortLabelKey("bogus"), "customExercises.sorts.popular");

// The keys are built, so scripts/test-localization.js cannot see them.
const builtKeys = [
  ...utils.EQUIPMENT_KEYS.map(utils.equipmentLabelKey),
  ...utils.WEIGHT_MODES.map(utils.weightModeLabelKey),
  ...utils.CUSTOM_EXERCISE_SORTS.map(utils.sortLabelKey),
];

for (const key of builtKeys) {
  assert.strictEqual(typeof lookup(enWords, key), "string", `${key} is missing in English`);
  assert.strictEqual(typeof lookup(daWords, key), "string", `${key} is missing in Danish`);
}

/* ----------------------------------------------------------- formatting -- */

assert.strictEqual(utils.formatVideoDuration(12400), "0:12");
assert.strictEqual(utils.formatVideoDuration(65000), "1:05");
assert.strictEqual(utils.formatVideoDuration(400), "0:01", "a clip is at least a second");
assert.strictEqual(utils.formatVideoDuration(0), null);
assert.strictEqual(utils.formatVideoDuration(null), null);
assert.strictEqual(utils.formatTypicalSetsReps(3, 10), "3 × 10");
assert.strictEqual(utils.formatTypicalSetsReps(2.6, 9.5), "3 × 10");
assert.strictEqual(utils.formatTypicalSetsReps(null, 10), null);
assert.strictEqual(utils.formatTypicalSetsReps(3, 0), null);
assert.strictEqual(utils.formatBucketLabel({ from: null, to: 50, count: 3 }), "–50");
assert.strictEqual(utils.formatBucketLabel({ from: 90, to: null, count: 3 }), "90+");
assert.strictEqual(utils.formatBucketLabel({ from: 50, to: 60, count: 3 }), "50–60");
assert.strictEqual(utils.formatBucketLabel({ from: 2.5, to: 7.5 }, (value) => String(value).replace(".", ",")), "2,5–7,5");
assert.strictEqual(utils.formatBucketLabel(null), "");
assert.strictEqual(utils.mostCommonBucketIndex([{ count: 2 }, { count: 5 }, { count: 5 }]), 1, "the first on a tie");
assert.strictEqual(utils.mostCommonBucketIndex([{ count: 0 }, { count: 0 }]), -1);
assert.strictEqual(utils.mostCommonBucketIndex(null), -1);

/* ------------------------------------------------------------ the shapes -- */

const ownerId = "7f2c0c4e-0000-4000-8000-000000000001";
const libraryRow = {
  id: 42,
  name: "Landmine press",
  description: "One arm press",
  muscle_group_keys: { primary: ["shoulders"], secondary: ["triceps"] },
  equipment: "barbell",
  weight_mode: "per_side",
  has_video: true,
  video_duration_ms: 12400,
  poster_path: `${ownerId}/42-poster.jpg`,
  users: 4,
  shared_at: "2026-09-26T10:00:00.123456+00:00",
  owner: { id: ownerId, display_name: "", username: "anna#0001", avatar_path: `${ownerId}/avatar` },
  owner_in_your_gym: true,
  is_mine: false,
  is_added: true,
  is_saved: false,
};
const summary = utils.mapCustomExerciseSummaryRow(libraryRow);

assert.strictEqual(summary.id, 42);
assert.strictEqual(summary.weightMode, "per_side");
assert.deepStrictEqual(summary.muscles, { primary: ["shoulders"], secondary: ["triceps"] });
assert.strictEqual(summary.users, 4);
assert.strictEqual(summary.posterUrl, null, "the service signs the poster; the mapping carries none");
assert.deepStrictEqual(summary.owner, {
  id: ownerId,
  displayName: "anna",
  username: "anna#0001",
  avatarUrl: null,
  inYourGym: true,
}, "no display name falls back to the username's base, and no path reaches the screen");
assert.strictEqual(summary.isAdded, true);
assert.strictEqual(utils.mapCustomExerciseSummaryRow({ id: "x" }), null, "no id is no exercise");
assert.strictEqual(utils.mapCustomExerciseSummaryRow({ id: 7, users: 0 }).users, 1, "the owner is always a user");

const buckets = [
  { from: null, to: 40, count: 5 },
  { from: 40, to: 45, count: 4 },
  { from: 45, to: 50, count: 3 },
  { from: 50, to: 55, count: 4 },
  { from: 55, to: 60, count: 2 },
  { from: 60, to: null, count: 10 },
];
const detail = utils.mapCustomExerciseDetailRow({
  ...libraryRow,
  steps: ["Kneel", "Press"],
  video_path: `${ownerId}/42.mp4`,
  created_at: "2026-09-20T08:00:00+00:00",
  owner_gym_name: "Nørrebro",
  viewer_has_gym: true,
  stats: { users: 4, gym_users: 2, typical_sets: 5, typical_reps: 8, typical_weight_kg: "51.0", set_count: 28, buckets },
});

assert.deepStrictEqual(detail.steps, ["Kneel", "Press"]);
assert.strictEqual(detail.videoUrl, null);
assert.strictEqual(detail.ownerGymName, "Nørrebro");
assert.deepStrictEqual(detail.stats, {
  users: 4,
  gymUsers: 2,
  typicalSets: 5,
  typicalReps: 8,
  typicalWeightKg: 51,
  setCount: 28,
  buckets,
});

const noCentre = utils.mapCustomExerciseDetailRow({ ...libraryRow, viewer_has_gym: false, stats: { gym_users: null, set_count: 4, buckets: null } });
assert.strictEqual(noCentre.stats.gymUsers, null, "no centre, no count for it");
assert.strictEqual(noCentre.stats.buckets, null);
assert.strictEqual(
  utils.normalizeWeightBuckets(buckets.map((bucket) => ({ ...bucket, count: 1 }))),
  null,
  "six bars from six sets are a guess, not a distribution"
);
assert.strictEqual(utils.normalizeWeightBuckets(buckets.slice(0, 5)), null, "six bars or none");

const mine = utils.mapMyCustomExerciseRow({
  name: "Landmine press",
  custom_muscle_group_keys: '["shoulders"]',
  description: "One arm press",
  steps: '["Kneel"]',
  equipment: "barbell",
  weight_mode: "total",
  is_public: 1,
  cloud_custom_exercise_id: 42,
  source_exercise_id: null,
  video_path: `${ownerId}/42.mp4`,
  video_duration_ms: 12400,
});

assert.deepStrictEqual(mine, {
  name: "Landmine press",
  muscles: { primary: ["shoulders"], secondary: [] },
  description: "One arm press",
  steps: ["Kneel"],
  equipment: "barbell",
  weightMode: "total",
  isPublic: true,
  cloudId: 42,
  sourceExerciseId: null,
  hasVideo: true,
  videoDurationMs: 12400,
  posterUrl: null,
  users: null,
});
assert.strictEqual(utils.mapMyCustomExerciseRow({ name: "  " }), null);

/* ------------------------------------------------------ the two halves -- */

assert.deepStrictEqual(
  utils.buildCustomExerciseCloudFields({
    custom_muscle_group_keys: '["quads","glutes"]',
    description: "  Deep  ",
    equipment: "Barbell",
    weight_mode: null,
    steps: null,
  }),
  {
    description: "Deep",
    muscle_group_keys: { primary: ["quads", "glutes"], secondary: [] },
    equipment: "barbell",
    weight_mode: "total",
    steps: [],
  },
  "the cloud always gets the object shape, normalised as the migration checks it"
);

const restored = utils.buildLocalCustomExerciseFields({
  id: 9,
  name: "Pendlay row",
  muscle_group_keys: { primary: ["lats"], secondary: [] },
  is_public: false,
  source_exercise_id: 42,
  description: null,
  steps: ["Pull to the chest"],
  equipment: "barbell",
  weight_mode: "total",
  video_path: null,
  poster_path: null,
  video_duration_ms: null,
  updated_at: "2026-09-26T10:00:00.5+00:00",
});

assert.strictEqual(restored.custom_muscle_group_keys, '["lats"]', "no secondaries stays the legacy plain array createCustomExercise writes");
assert.strictEqual(restored.steps, '["Pull to the chest"]');
assert.strictEqual(restored.cloud_custom_exercise_id, 9);
assert.strictEqual(restored.source_exercise_id, 42, "a copy stays a copy");
assert.strictEqual(restored.is_public, false);
assert.strictEqual(
  utils.buildLocalCustomExerciseFields({ id: 1, name: "X", muscle_group_keys: { primary: ["chest"], secondary: ["triceps"] } })
    .custom_muscle_group_keys,
  '{"primary":["chest"],"secondary":["triceps"]}'
);

assert.strictEqual(utils.isNewerCloudTimestamp("2026-09-26T10:00:01+00:00", "2026-09-26T10:00:00+00:00"), true);
assert.strictEqual(utils.isNewerCloudTimestamp("2026-09-26T10:00:00+00:00", "2026-09-26T10:00:01+00:00"), false);
assert.strictEqual(utils.isNewerCloudTimestamp("2026-09-26T10:00:00.000002+00:00", "2026-09-26T10:00:00.000001+00:00"), true, "microseconds apart");
assert.strictEqual(utils.isNewerCloudTimestamp("2026-09-26T10:00:00+00:00", "2026-09-26T10:00:00+00:00"), false);
assert.strictEqual(utils.isNewerCloudTimestamp("2026-09-26T10:00:00+00:00", null), true, "never seen is older");
assert.strictEqual(utils.isNewerCloudTimestamp(null, "2026-09-26T10:00:00+00:00"), false);

/* -------------------------------------------------------------- the plan -- */

const T1 = "2026-09-20T10:00:00+00:00";
const T2 = "2026-09-26T10:00:00+00:00";
const local = (name, extra = {}) => ({
  name,
  is_custom: 1,
  cloud_custom_exercise_id: null,
  custom_needs_upload: 0,
  cloud_updated_at: null,
  ...extra,
});
const catalog = (name) => ({ name, is_custom: 0, cloud_custom_exercise_id: null, custom_needs_upload: 0 });
const cloud = (id, name, updatedAt = T1) => ({ id, name, updated_at: updatedAt });
const plan = (locals, clouds) => utils.planCustomExerciseSync(locals, clouds);
const only = (result, keep) => {
  for (const key of ["upload", "link", "push", "pull", "restore", "skip"]) {
    if (!keep.includes(key)) {
      assert.deepStrictEqual(result[key], [], `nothing should be in ${key}: ${JSON.stringify(result[key])}`);
    }
  }
};

// A custom exercise made on this phone: up it goes.
let result = plan([local("Landmine press"), catalog("Squat")], []);
assert.deepStrictEqual(result.upload, [{ name: "Landmine press", staleCloudId: null }], "a new local exercise is uploaded");
only(result, ["upload"]);

// An edit made here: pushed.
result = plan([local("Landmine press", { cloud_custom_exercise_id: 5, custom_needs_upload: 1, cloud_updated_at: T1 })], [cloud(5, "Landmine press", T1)]);
assert.deepStrictEqual(result.push, [{ name: "Landmine press", cloudId: 5 }], "a dirty row is pushed");
only(result, ["push"]);

// An edit here and a newer cloud row: the phone's edit wins.
result = plan([local("Landmine press", { cloud_custom_exercise_id: 5, custom_needs_upload: 1, cloud_updated_at: T1 })], [cloud(5, "Landmine press", T2)]);
assert.deepStrictEqual(result.push.map((step) => step.cloudId), [5], "local dirty beats cloud newer");
only(result, ["push"]);

// A clean row with a newer cloud row: the cloud's version comes down.
result = plan([local("Landmine press", { cloud_custom_exercise_id: 5, cloud_updated_at: T1 })], [cloud(5, "Landmine press", T2)]);
assert.deepStrictEqual(result.pull.map((step) => [step.name, step.cloudId]), [["Landmine press", 5]], "cloud newer and local clean is pulled");
only(result, ["pull"]);

// Nothing changed on either side: nothing to do.
result = plan([local("Landmine press", { cloud_custom_exercise_id: 5, cloud_updated_at: T2 })], [cloud(5, "Landmine press", T2)]);
only(result, []);

// A reinstall: the cloud has what the phone lost.
result = plan([catalog("Squat")], [cloud(7, "Pendlay row")]);
assert.deepStrictEqual(result.restore.map((step) => [step.name, step.cloudId]), [["Pendlay row", 7]], "a cloud-only row is restored");
only(result, ["restore"]);

// The phone already uses the name - here the catalog does: skipped, never overwritten.
result = plan([catalog("Squat")], [cloud(8, "squat")]);
assert.deepStrictEqual(result.skip, [{ name: "squat", cloudId: 8, reason: "name_taken" }], "a name collision is skipped");
only(result, ["skip"]);

// An upload whose answer never came back: the name finds the cloud row.
result = plan([local("Landmine press")], [cloud(5, "landmine press", T1)]);
assert.deepStrictEqual(
  result.link.map((step) => [step.name, step.cloudId, step.then]),
  [["Landmine press", 5, "pull"]],
  "linked by name, then the cloud's version"
);
only(result, ["link"]);

result = plan([local("Landmine press", { custom_needs_upload: 1 })], [cloud(5, "Landmine press", T1)]);
assert.deepStrictEqual(result.link.map((step) => step.then), ["push"], "linked by name, then the phone's edit");
only(result, ["link"]);

// A cloud id the cloud no longer has: uploaded again, never dropped.
result = plan([local("Landmine press", { cloud_custom_exercise_id: 99, cloud_updated_at: T1 })], []);
assert.deepStrictEqual(result.upload, [{ name: "Landmine press", staleCloudId: 99 }]);
only(result, ["upload"]);

// Two custom rows that differ only in case: one goes up, the other waits.
result = plan([local("Face pull"), local("face pull")], []);
assert.strictEqual(result.upload.length, 1);
assert.deepStrictEqual(result.skip, [{ name: "face pull", cloudId: null, reason: "duplicate_name" }]);

// A row that knows its cloud id keeps it even when an unlinked row has its name.
result = plan([local("face pull"), local("Face pull", { cloud_custom_exercise_id: 3, cloud_updated_at: T1 })], [cloud(3, "Face pull", T1)]);
assert.deepStrictEqual(result.link, [], "a linked row's cloud row is not taken by name");
assert.deepStrictEqual(result.skip.map((step) => step.reason), ["duplicate_name"]);

// Everything at once, and the plan accounts for every row without deleting any.
result = plan(
  [
    catalog("Squat"),
    local("New one"),
    local("Edited", { cloud_custom_exercise_id: 1, custom_needs_upload: 1, cloud_updated_at: T1 }),
    local("Stale here", { cloud_custom_exercise_id: 2, cloud_updated_at: T1 }),
    local("Same", { cloud_custom_exercise_id: 3, cloud_updated_at: T2 }),
  ],
  [cloud(1, "Edited", T2), cloud(2, "Stale here", T2), cloud(3, "Same", T2), cloud(4, "From another phone"), cloud(6, "SQUAT")]
);
assert.deepStrictEqual(result.upload.map((step) => step.name), ["New one"]);
assert.deepStrictEqual(result.push.map((step) => step.name), ["Edited"]);
assert.deepStrictEqual(result.pull.map((step) => step.name), ["Stale here"]);
assert.deepStrictEqual(result.restore.map((step) => step.name), ["From another phone"]);
assert.deepStrictEqual(result.skip.map((step) => step.name), ["SQUAT"]);
assert.ok(!("delete" in result), "the plan has no way to delete");
assert.deepStrictEqual(utils.planCustomExerciseSync(null, undefined), { upload: [], link: [], push: [], pull: [], restore: [], skip: [] });

/* ----------------------------------------------------------- the migration -- */

const migrationFile = "supabase/migrations/20260928090000_custom-exercises-can-be-shared.sql";
const migration = read(migrationFile);
// Comments say what the migration does not do, in words the checks look for;
// only the statements count.
const sql = migration.replace(/--[^\n]*/g, "");

assert.ok(/^\s*begin;/m.test(sql) && /^\s*commit;\s*$/m.test(sql), "the migration runs in one transaction");
assert.ok(migration.includes("Run after 20260927110000_a-block-hides-public-posts-too.sql"), "the header says what it runs after");
assert.ok(/Until this has run/.test(migration) && /Safe to run twice/.test(migration), "the header says what happens before it runs");
assert.ok(!/placeholder/i.test(migration), "the placeholder is gone");

for (const table of ["public.custom_exercise", "public.custom_exercise_save", "public.custom_exercise_report", "private.custom_exercise_stats"]) {
  assert.ok(sql.includes(`alter table ${table} enable row level security;`), `${table} has row level security`);
}

assert.ok(
  sql.includes("grant execute on function private.can_view_exercise_media(text) to authenticated;"),
  "the storage policy's function has to be callable by the reader, or every storage read fails (20260921200000)"
);
assert.ok(
  /values \('exercise-videos', 'exercise-videos', false, (\d+),/.test(sql) &&
    Number(sql.match(/values \('exercise-videos', 'exercise-videos', false, (\d+),/)[1]) === utils.VIDEO_MAX_BYTES,
  "the private exercise-videos bucket, at VIDEO_MAX_BYTES"
);
assert.ok(sql.includes("array['video/mp4', 'video/quicktime', 'image/jpeg']"), "clips and their posters");
assert.ok(!/grant usage on schema private/i.test(sql), "authenticated gets no usage on private");

// The limits the phone holds are the ones the cloud checks.
assert.ok(sql.includes("char_length(name) between 2 and 80"), "name 2-80");
assert.ok(sql.includes(`char_length(description) <= ${utils.DESCRIPTION_MAX_LENGTH}`), "description limit");
assert.ok(sql.includes(`coalesce(array_length(candidate, 1), 0) <= ${utils.MAX_STEPS}`), "step count");
assert.ok(sql.includes(`char_length(step.content) > ${utils.STEP_MAX_LENGTH}`), "step length");
assert.ok(sql.includes(`video_duration_ms between 1 and ${utils.VIDEO_MAX_DURATION_MS + 1000}`), "clip length, with a second for the trim");
assert.ok(sql.includes(`char_length(note) <= ${utils.REPORT_NOTE_MAX_LENGTH}`), "report note limit");
assert.ok(sql.includes(`coalesce(array_length(lifted_kg, 1), 0) >= ${utils.DISTRIBUTION_MIN_SETS}`), "no distribution under DISTRIBUTION_MIN_SETS");

const quoted = (values) => values.map((value) => `'${value}'`).join(", ");
assert.ok(sql.includes(`equipment in (${quoted(utils.EQUIPMENT_KEYS)})`), "equipment list");
assert.ok(sql.includes(`weight_mode in (${quoted(utils.WEIGHT_MODES)})`), "weight modes");
assert.ok(sql.includes(`reason in (${quoted(utils.REPORT_REASONS)})`), "report reasons");
assert.ok(sql.includes(`not in (${quoted(utils.CUSTOM_EXERCISE_SORTS)})`), "the six sorts");

assert.ok(sql.includes("unique index if not exists custom_exercise_user_name_key") && sql.includes("(user_id, lower(name))"), "names unique per person, whatever the case");
assert.ok(sql.includes("check (not (is_public and source_exercise_id is not null))"), "a copy is never shared");
assert.ok(/grant insert \(name, description, muscle_group_keys, equipment, weight_mode, steps\)/.test(sql), "the insert grant names its columns");
assert.ok(
  /grant update \(description, muscle_group_keys, equipment, weight_mode, steps, is_public, video_path, poster_path, video_duration_ms\)/.test(sql),
  "the update grant names its columns - never the name, the owner or the counters"
);
assert.ok(sql.includes("reporter_total < 3"), "three different reporters hide an exercise");

// Every function the app calls: definer, empty search_path, callable by
// authenticated and nobody else.
const rpcs = [...sql.matchAll(/create or replace function (public\.[a-z_]+)\(([\s\S]*?)\$\$/g)];

assert.deepStrictEqual(
  rpcs.map(([, name]) => name).sort(),
  [
    "public.adopt_custom_exercise",
    "public.browse_custom_exercises",
    "public.custom_exercise_detail",
    "public.report_custom_exercise",
    "public.set_custom_exercise_saved",
  ],
  "the migration's public surface changed"
);

for (const [, name, header] of rpcs) {
  const escaped = name.replace(".", "\\.");

  assert.ok(/\bsecurity definer\b/.test(header), `${name} must be security definer`);
  assert.ok(/set search_path = ''/.test(header), `${name} must run with an empty search_path`);
  assert.ok(new RegExp(`revoke all on function ${escaped}\\([^)]*\\) from public, anon;`).test(sql), `${name} is taken from public and anon`);
  assert.ok(new RegExp(`grant execute on function ${escaped}\\([^)]*\\) to authenticated;`).test(sql), `${name} is granted to authenticated`);
}

for (const [, name] of sql.matchAll(/create or replace function (private\.[a-z_]+)\(/g)) {
  assert.ok(sql.includes(`revoke all on function ${name}(`), `${name} has its default execute taken away`);
}

// Blocks go through the definer function, never a policy expression.
assert.ok((sql.match(/private\.blocked_between\(/g) ?? []).length >= 3, "blocks are checked through private.blocked_between");
assert.ok(!/create policy[^;]*user_blocks/.test(sql), "a policy that reads user_blocks silently passes");

/* ------------------------------------------------ the app against the SQL -- */

const service = read("src/Services/exerciseService.js");

for (const code of ["42883", "PGRST202", "PGRST204", "42P01", "PGRST205"]) {
  assert.ok(service.includes(`"${code}"`), `a database without the migration (${code}) has to read as "not available yet"`);
}

const copyConstraint = service.match(/COPY_IS_PRIVATE_CONSTRAINT = "([^"]+)"/)?.[1];
const blockedSentence = service.match(/BLOCKED_TERMS_MESSAGE = "([^"]+)"/)?.[1];
assert.ok(copyConstraint && sql.includes(`add constraint ${copyConstraint}`), "the service names the constraint the migration adds");
assert.ok(blockedSentence && migration.includes(blockedSentence), "the service recognises the term filter's sentence");

for (const rpc of ["browse_custom_exercises", "custom_exercise_detail", "adopt_custom_exercise", "set_custom_exercise_saved", "report_custom_exercise"]) {
  assert.ok(service.includes(`supabase.rpc("${rpc}"`), `the service calls ${rpc}`);
}

assert.ok(/require\("expo-video-thumbnails"\)/.test(service), "the poster module is required lazily");
assert.ok(!/^import[^\n]*expo-video-thumbnails/m.test(service), "an old build without the module must still load the service");
assert.ok(service.includes(".createSignedUrls("), "a page's posters are signed in one request");

// The fresh install and the existing one end up with the same Exercise.
const db = read("src/Database/db.js");
const schema = read("src/Database/schema/weightlifting.js");
const extraColumns = [...(db.match(/const EXERCISE_EXTRA_COLUMNS = \[([\s\S]*?)\n\];/)?.[1] ?? "").matchAll(/\["([a-z_]+)", "([^"]+)"/g)];
const exerciseTable = schema.match(/CREATE TABLE IF NOT EXISTS Exercise \(([\s\S]*?)\n  \);/)?.[1] ?? "";

assert.ok(extraColumns.length >= 15, "db.js no longer lists the extra Exercise columns");
for (const [, column, definition] of extraColumns) {
  assert.ok(
    new RegExp(`\\n\\s*${column} ${definition.replace(/[()']/g, "\\$&")},?\\n`).test(`${exerciseTable}\n`),
    `Exercise.${column} (${definition}) is in db.js but not the same in schema/weightlifting.js`
  );
}
assert.ok(/\.\.\.EXERCISE_EXTRA_COLUMNS\.map/.test(db), "ensureTableColumns adds the extra columns on an existing install");
assert.ok(/extraColumns\.map\(\(\{ value \}\) => value\)/.test(db), "the catalog rebuild carries the extra columns across");
assert.ok(!/owner_id/.test(exerciseTable), "the database is per user: no owner column");

const repository = read("src/Repository/weightliftingRepository.js");
assert.ok(
  repository.includes("DELETE FROM Exercise WHERE COALESCE(is_custom, 0) = 0;"),
  "the catalog replace must never delete a custom exercise"
);
assert.ok(
  read("src/Repository/index.js").includes('export * as customExerciseRepository from "./customExerciseRepository";'),
  "the repository barrel exports customExerciseRepository"
);

const librarySync = read("src/Sync/ExerciseLibrarySync.js");
assert.ok(
  librarySync.indexOf("syncExerciseLibraryFromCloud") < librarySync.indexOf("syncCustomExercisesWithCloud") &&
    librarySync.indexOf("syncExerciseLibraryFromCloud") !== -1,
  "the custom exercises sync after the catalog"
);

const createCustom = read("src/Services/weightliftingService.js").match(/export async function createCustomExercise[\s\S]*?\n}\n/)?.[0] ?? "";
assert.ok(createCustom.includes("syncCustomExercisesInBackground(db)"), "a new custom exercise goes up in the background");

const deleteAccount = read("supabase/functions/delete-account/index.ts");
assert.ok(deleteAccount.includes('"exercise-videos"') && deleteAccount.includes("EXERCISE_VIDEO_BUCKET"), "deleting an account empties the exercise-videos folder");

console.log(
  "Shared exercises: normalizers, labels, formatting, shapes, the sync plan, the migration's promises and the wiring passed."
);
