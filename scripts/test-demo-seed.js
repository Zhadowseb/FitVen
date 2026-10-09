// The demo accounts script: that the cast is consistent, that a workout and
// its post are built the way the app builds them, that the safety rails hold,
// and that `plan` and an unconfirmed `apply` touch nothing and need no key.
// Nothing here talks to Supabase.

const assert = require("assert");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const cast = require("./demo/cast");
const seed = require("./demo/seed-demo");

const SCRIPT = path.join(__dirname, "demo", "seed-demo.js");
const keys = cast.CAST.map((member) => member.key);

// --- The cast ---------------------------------------------------------------
assert.strictEqual(new Set(keys).size, keys.length, "cast keys are unique");
assert.strictEqual(cast.CAST.filter((member) => member.login).length, 1, "exactly one account logs in");
for (const member of cast.CAST) {
  assert.ok(/^[a-z0-9_]{3,20}$/.test(member.usernameBase), `${member.key}: username base is valid`);
  assert.ok(member.displayName.length >= 1 && member.displayName.length <= 40, `${member.key}: display name fits`);
  assert.ok(member.bio.length <= 160, `${member.key}: bio fits`);
  assert.ok(cast.demoEmail(member).endsWith(cast.DEMO_EMAIL_SUFFIX), `${member.key}: demo address`);
}
assert.strictEqual(
  new Set(cast.CAST.map((member) => member.usernameBase)).size,
  cast.CAST.length,
  "username bases are unique"
);

// Follows are between the cast, and nobody follows themselves.
const follows = new Set();
for (const [follower, following] of cast.FOLLOWS) {
  assert.ok(keys.includes(follower) && keys.includes(following), `follow ${follower}->${following} is within the cast`);
  assert.notStrictEqual(follower, following, "nobody follows themselves");
  assert.ok(!follows.has(`${follower}>${following}`), "no follow twice");
  follows.add(`${follower}>${following}`);
}

// --- Activities and what is built from them ---------------------------------
const NOW = new Date("2026-10-09T10:00:00Z");

for (const activity of cast.ACTIVITIES) {
  assert.ok(keys.includes(activity.user) && activity.user !== "alex", `${activity.id}: a friend's workout`);
  assert.ok(
    activity.likes.every((liker) => keys.includes(liker) && liker !== activity.user),
    `${activity.id}: likes are the cast's, not the author's`
  );
  assert.ok(
    follows.has("alex>" + activity.user),
    `${activity.id}: alex follows the author, so it is in his feed`
  );

  const { workout, exercises, post } = cast.buildActivityRows(activity, "u-1", NOW);

  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(workout.date), `${activity.id}: ISO date`);
  assert.ok(/^\d{2}:\d{2}:\d{2}$/.test(workout.timer_start), `${activity.id}: HH:MM:SS time`);
  assert.strictEqual(workout.elapsed_time, activity.minutes * 60);
  assert.strictEqual(workout.done, true);
  assert.strictEqual(workout.is_active, false, "a finished workout is not live, so it never raises a start notification");
  assert.strictEqual(workout.gym_id, null, "no centre: the demo never reaches a public leaderboard");
  assert.strictEqual(post.visibility, "following", "a post only the cast's followers - the cast - can read");

  const payload = post.payload;
  assert.strictEqual(payload.exerciseCount, activity.exercises.length);
  assert.strictEqual(payload.topSets.length, activity.exercises.length);
  assert.strictEqual(
    payload.setsCount,
    exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)
  );

  for (const [index, exercise] of activity.exercises.entries()) {
    const top = payload.topSets[index];
    const best = Math.max(...exercise.sets.map(([weight, reps]) => weight * reps));

    assert.strictEqual(top.weight * top.reps, best, `${activity.id}/${exercise.name}: the top set is the best by weight times reps`);
    assert.ok(top.weight > 0 && top.reps > 0, "a top set has weight and reps");
    assert.strictEqual(top.personalRecord, exercise.pr !== undefined, `${activity.id}/${exercise.name}: the record is the top set`);
  }

  const ids = new Set();
  for (const row of [workout, ...exercises.map((entry) => entry.row), ...exercises.flatMap((entry) => entry.sets)]) {
    assert.ok(!ids.has(row.sync_id), "every row has its own sync_id");
    ids.add(row.sync_id);
    assert.strictEqual(row.is_deleting, false);
    assert.strictEqual(row.deleted_at, null);
  }
}
assert.strictEqual(cast.stableUuid("a"), cast.stableUuid("a"), "the same seed, the same uuid");
assert.notStrictEqual(cast.stableUuid("a"), cast.stableUuid("b"));
assert.ok(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(cast.stableUuid("a")));

// A date is relative to the day it runs, in Copenhagen.
assert.strictEqual(
  cast.copenhagenDate(new Date("2026-10-08T22:30:00Z"), 0),
  "2026-10-09",
  "after midnight in Copenhagen it is already the 9th"
);
assert.strictEqual(cast.copenhagenDate(NOW, 3), "2026-10-06");
assert.strictEqual(
  cast.copenhagenInstant("2026-10-06", "17:42:00").toISOString(),
  "2026-10-06T15:42:00.000Z",
  "Copenhagen is two hours ahead of UTC in October"
);

// --- The safety rails -------------------------------------------------------
const demoUser = { email: "emma.demo@fitven.dk", user_metadata: { [cast.DEMO_MARKER]: true } };
assert.ok(cast.isDemoUser(demoUser), "marker and address: ours");
assert.ok(!cast.isDemoUser({ email: "emma.demo@fitven.dk", user_metadata: {} }), "the address alone is not enough");
assert.ok(!cast.isDemoUser({ email: "real@gmail.com", user_metadata: { [cast.DEMO_MARKER]: true } }), "the marker alone is not enough");
assert.ok(!cast.isDemoUser({ email: "emma@fitven.dk", user_metadata: { [cast.DEMO_MARKER]: true } }), "a fitven.dk address without .demo is not ours");
assert.ok(!cast.isDemoUser({ email: "emma.demo@fitven.dk", user_metadata: { [cast.DEMO_MARKER]: "true" } }), "the marker is the boolean true");
assert.ok(!cast.isDemoUser(null) && !cast.isDemoUser({}));

assert.doesNotThrow(() => seed.assertProjectUrl("https://abc.supabase.co/", "https://abc.supabase.co"));
assert.throws(() => seed.assertProjectUrl("https://other.supabase.co", "https://abc.supabase.co"), /only writes to the project/);
assert.throws(() => seed.assertProjectUrl("", "https://abc.supabase.co"));

// The seed checks its rows against what the cloud says about its tables.
const definitions = {
  set: { required: ["user_id", "weight"], properties: { user_id: {}, weight: {}, reps: {}, rest_counted: {} } },
  exercise_instance: { required: ["user_id"], properties: { user_id: {} } },
};
assert.deepStrictEqual(seed.checkRow(definitions, "set", { user_id: 1, weight: 2, reps: 3 }), {
  table: "set",
  missingTable: false,
  unknown: [],
  missingRequired: [],
});
assert.deepStrictEqual(seed.checkRow(definitions, "set", { user_id: 1, weight: 2, nonsense: 1 }).unknown, ["nonsense"], "a column the table lacks is reported");
assert.deepStrictEqual(seed.checkRow(definitions, "set", { user_id: 1 }).missingRequired, ["weight"], "a required column left empty is reported");
assert.deepStrictEqual(
  seed.checkRow(definitions, "exercise_instance", { user_id: 1, weight_mode: "total" }).unknown,
  [],
  "an optional column the cloud may lack is not an error"
);
// What the database fills in itself is not a gap: the id it counts up, and any column with a default.
const withDefaults = {
  social_post_like: {
    required: ["id", "post_id", "created_at", "stamped_at"],
    properties: { id: {}, post_id: {}, created_at: { default: "timezone('utc'::text, now())" }, stamped_at: {} },
  },
};
assert.deepStrictEqual(
  seed.checkRow(withDefaults, "social_post_like", { post_id: 1 }).missingRequired,
  ["stamped_at"],
  "id and a column with a default are not reported; a required one without a default is"
);
assert.ok(seed.checkRow(definitions, "social_post", {}).missingTable);
assert.ok(
  !("rest_counted" in seed.pruneOptional({ set: { properties: { user_id: {} } } }, "set", { user_id: 1, rest_counted: false })),
  "an optional column the cloud lacks is dropped from the row"
);
assert.ok("rest_counted" in seed.pruneOptional(definitions, "set", { user_id: 1, rest_counted: false }), "and kept when it has it");

// A password the cloud accepts: lower case, upper case and a digit, and never the same twice.
for (const bytes of [18, 24]) {
  const password = seed.strongPassword(bytes);

  assert.ok(/[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password), "all three kinds of character");
  assert.ok(password.length >= 20, "long enough");
}
assert.notStrictEqual(seed.strongPassword(), seed.strongPassword(), "random");

// --- plan and an unconfirmed apply touch nothing and need no key -------------
const noKey = { ...process.env, SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "" };
const run = (...args) => execFileSync(process.execPath, [SCRIPT, ...args], { env: noKey, encoding: "utf8" });

const planOutput = run("plan");
assert.ok(planOutput.includes("Demo cast: 5 accounts"), "plan lists the cast");
assert.ok(!/eyJ|sb_secret|service_role/i.test(planOutput), "plan prints no key");
assert.ok(run("apply").includes("Nothing was done. Add --yes to run it."), "apply without --yes does nothing");
assert.ok(run("reset").includes("Nothing was done. Add --yes to run it."), "reset without --yes does nothing");

// --- The key stays where it is ----------------------------------------------
const source = fs.readFileSync(SCRIPT, "utf8");
assert.ok(
  !/console\.(log|error|warn|info)\([^;]*(SERVICE_ROLE|connection\.key|env\.SUPABASE_|\$\{key\})/.test(source),
  "no console call touches the key or the environment's Supabase settings"
);
assert.ok(!/writeFile|appendFile/.test(source), "the script writes no files");

console.log(
  "Demo accounts: the cast, its follows and its posts are consistent and built like the app's own; only a user with the marker and the address counts as demo; plan and an unconfirmed apply touch nothing."
);
