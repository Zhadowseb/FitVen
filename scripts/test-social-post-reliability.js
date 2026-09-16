// Exercise the real service functions with failed requests and unrelated dirty
// workouts. No credentials, production posts or device database are used.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { DatabaseSync } = require("node:sqlite");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const quietConsole = { error() {}, warn() {}, info() {} };

function load(file, dependencies = {}, replacements = []) {
  let source = read(file).replace(/^import[\s\S]*?;\r?\n/gm, "").replace(/\bexport /g, "");
  for (const [from, to] of replacements) source = source.replaceAll(from, to);
  const context = vm.createContext({ console: quietConsole, ...dependencies });
  vm.runInContext(source, context, { filename: file });
  return context;
}

async function postingFlow() {
  const scheduler = load("src/Services/syncScheduler.js");
  const calls = [];
  let missing = false;
  let repairSucceeds = true;
  let failure = null;
  const post = { id: 123, body: "A note", visibility: "following" };
  const service = load("src/Services/workoutService.js", {
    enqueueSync: scheduler.enqueueSync,
    startBackgroundSync: () => { calls.push(["background"]); },
    postMock: { createWorkoutSummaryPostForCompletedWorkout: async (db, options) => {
      calls.push(["post", options.workoutId, options.note]);
      if (failure) throw failure;
      return missing ? { skipped: true, reason: "missing_cloud_workout_id" } : post;
    } },
    programMock: {
      prepareWorkoutForSummaryPost: async (db, id) => {
        calls.push(["repair", id]);
        if (repairSucceeds) missing = false;
      },
      syncWorkoutTypeInstancesWithCloud: async () => { throw new Error("Unrelated workout type FK"); },
      pushDirtyStrengthHierarchyWithCloud: async () => { throw new Error("Unrelated workout type FK"); },
    },
  }, [
    ['import("./programService")', "Promise.resolve(programMock)"],
    ['import("./socialPostService")', "Promise.resolve(postMock)"],
  ]);
  assert.equal(await service.repostWorkoutSummaryPost({}, { workoutId: 7, note: "A note" }), post);
  assert.deepEqual(calls, [["post", 7, "A note"]], "Existing identity must not depend on hierarchy sync");
  calls.length = 0;
  missing = true;
  await service.repostWorkoutSummaryPost({}, { workoutId: 7, note: "A note" });
  assert.deepEqual(calls, [["post", 7, "A note"], ["repair", 7], ["post", 7, "A note"]]);

  calls.length = 0;
  missing = true;
  repairSucceeds = false;
  await assert.rejects(service.repostWorkoutSummaryPost({}, { workoutId: 7 }), /not synced/);
  assert.equal(calls.length, 3, "An unsuccessful repair must stop after one retry");
  missing = false;

  failure = new Error("Network request failed");
  await assert.rejects(service.repostWorkoutSummaryPost({}, { workoutId: 7 }), /Network request failed/);
  failure = null;
  assert.equal(await service.repostWorkoutSummaryPost({}, { workoutId: 7 }), post, "A failed request must not poison the queue");

  calls.length = 0;
  let release;
  const blocker = scheduler.enqueueSync(() => new Promise((resolve) => { release = resolve; }));
  await Promise.resolve();
  const pendingPost = service.repostWorkoutSummaryPost({}, { workoutId: 7 });
  await Promise.resolve();
  assert.equal(calls.length, 0, "Posting must wait for background sync to release the shared queue");
  release();
  await blocker;
  await pendingPost;
  assert.equal(calls.length, 1);

  calls.length = 0;
  failure = new Error("Network request failed");
  await service.syncWorkoutSummaryPostForCompletionState({}, { workoutId: 7, done: true });
  assert.deepEqual(calls, [["post", 7, null], ["background"]], "Workout completion still syncs after posting fails");
}

async function scopedUpload() {
  const uploaded = [];
  let parentReady = false;
  let parentRepairs = 0;
  let existingCloudId = null;
  const workouts = [
    { workout_id: 1, day_id: 5, needs_sync: 1, workout_type: "InvalidLegacyType", done: 1 },
    { workout_id: 2, day_id: 5, needs_sync: 1, workout_type: "Resistance", done: 1 },
  ];
  const service = load("src/Services/cloudSync/workoutTypeInstanceSync.js", {
    programRepository: {
      getWorkoutsForCloudSync: async () => workouts,
      getDaysForCloudSync: async () => [{ day_id: 5 }],
      markWorkoutSynced: async () => {},
    },
    getAuthenticatedUserId: async () => "user",
    ensureWorkoutTypeInstanceCloudIdentity: async () => existingCloudId,
    createParentCloudIdCache: (resolve) => resolve,
    ensureDayCloudIdentity: async () => parentReady ? 55 : null,
    syncDaysWithCloud: async () => { parentRepairs++; parentReady = true; },
    buildCloudWorkoutTypeInstancePayload: (row) => ({ local_workout_type_instance_id: row.workout_id, workout_type: row.workout_type, date: "2026-09-15" }),
    WORKOUT_TYPE_INSTANCE_CLOUD_TABLE: "workout_type_instance",
    WORKOUT_TYPE_INSTANCE_CLOUD_SYNC_SELECT: "id",
    parseCloudWorkoutTypeInstanceId: (value) => value ?? null,
    resolveSideBySideCloudId: () => null,
    normalizeSyncId: (value) => value ?? null,
    normalizeSyncVersion: (value) => value ?? 0,
    normalizeDeletedAt: (value) => value ?? null,
    resolveWorkoutTypeInstanceCloudLocalId: () => null,
    syncDirtyLocalRowToCloud: async ({ localEntity }) => {
      uploaded.push(localEntity.workout_id);
      if (localEntity.workout_type === "InvalidLegacyType") throw new Error("workout_type_instance_workout_type_fkey");
      return { uploaded: true, cloudRecord: { id: 22 } };
    },
  });
  await service.prepareWorkoutForSummaryPost({}, 2);
  assert.deepEqual(uploaded, [2], "Even after parent repair, only the selected workout can upload");
  assert.equal(parentRepairs, 1);
  uploaded.length = 0;
  existingCloudId = 22;
  await service.prepareWorkoutForSummaryPost({}, 2);
  assert.equal(uploaded.length, 0, "A recovered cloud identity needs no upload");
  assert.equal(parentRepairs, 1);
  // The default background batch must still process every dirty workout.
  await assert.rejects(service.uploadDirtyWorkoutTypeInstances({}, "user"), /workout_type_instance_workout_type_fkey/);
  assert.deepEqual(uploaded, [1]);
}

async function statusAndErrors() {
  const social = load("src/Services/socialPostService.js", {
    normalizeElapsedDurationSeconds: (value) => value ?? 0,
  });
  const db = {
    getFirstAsync: async () => ({ exercise_count: 1, done_set_count: 1 }),
    getAllAsync: async () => [],
  };
  let profileFails = true;
  let postsFail = false;
  const own = load("src/Services/ownWorkoutPostService.js", {
    ensureOwnProfile: async () => { if (profileFails) throw new Error("Profile unavailable"); return {}; },
    getOwnPostedWorkoutSummaries: async () => {
      if (postsFail) throw new Error("Network request failed");
      return new Map([[101, { postId: 900 }]]);
    },
    getHiddenWorkoutSummaryExerciseIds: async () => { throw new Error("Settings unavailable"); },
    buildLocalWorkoutSummaryPost: (unused, args) => social.buildLocalWorkoutSummaryPost(db, args),
  });
  const ownDb = { getAllAsync: async () => [{ workout_id: 1, cloud_workout_type_instance_id: 101 }] };
  let cards = await own.getOwnWorkoutPosts(ownDb, { user: { id: "user" } });
  assert.equal(cards.length, 1);
  assert.equal(cards[0].isPosted, true, "Profile/settings failures must not discard successful post lookup");
  assert.equal(cards[0].postId, 900);
  profileFails = false;
  postsFail = true;
  cards = await own.getOwnWorkoutPosts(ownDb, { user: { id: "user" } });
  assert.equal(cards[0].isPosted, null, "Unknown status must not become Not posted");
  const permissionError = { code: "42501", message: 'permission denied for table "social_post"' };
  const constraintError = { code: "23503", message: "social_post_source_workout_fkey" };
  assert.equal(social.normalizeSocialPostError(permissionError), permissionError);
  assert.equal(social.normalizeSocialPostError(constraintError), constraintError);
  assert.match(social.normalizeSocialPostError({ code: "42P01" }).message, /not set up/);
}

async function postDialog() {
  const source = read("src/Pages/WorkoutPage/WorkoutTypes/Resistance/Resistance.js");
  const handler = source.slice(source.indexOf("  const postWorkoutSummary = async"), source.indexOf("  const restartWorkout = async"));
  let shouldFail = true;
  let visible = true;
  let busy = false;
  let errorMessage = "";
  const receivedNotes = [];
  const ui = vm.createContext({
    console: quietConsole, isPostingSummary: false, db: {}, workout_id: 7, postNote: "Keep this note",
    workoutService: { repostWorkoutSummaryPost: async (db, args) => {
      receivedNotes.push(args.note);
      if (shouldFail) throw new Error("Network request failed");
    } },
    setPostConfirmVisible: (value) => { visible = value; },
    setIsPostingSummary: (value) => { busy = value; },
    setPostError: (value) => { errorMessage = value; },
  });
  vm.runInContext(handler + "\nglobalThis.runPost = postWorkoutSummary;", ui);
  await ui.runPost();
  assert.equal(visible, true);
  assert.equal(busy, false);
  assert.equal(errorMessage, "Network request failed");
  shouldFail = false;
  await ui.runPost();
  assert.equal(visible, false);
  assert.equal(errorMessage, "");
  assert.deepEqual(receivedNotes, ["Keep this note", "Keep this note"]);
}

function catalogRepair() {
  // The seed SQL uses syntax shared with SQLite, so exercise its data effects
  // against real foreign keys. This is not a substitute for a PostgreSQL check.
  const db = new DatabaseSync(":memory:");
  db.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE workout_type(type TEXT PRIMARY KEY, display_name TEXT, is_active BOOLEAN);
    CREATE TABLE workout_type_instance(workout_type TEXT REFERENCES workout_type(type));
    INSERT INTO workout_type VALUES ('Resistance', 'My strength label', false);`);
  assert.throws(() => db.exec("INSERT INTO workout_type_instance VALUES ('Walk')"), /FOREIGN KEY/);
  const migration = read("supabase/migrations/20260915120000_repair-workout-type-catalog.sql").replaceAll("public.", "");
  db.exec(migration);
  db.exec(migration);
  db.exec("INSERT INTO workout_type_instance VALUES ('Walk')");
  assert.equal(db.prepare("SELECT count(*) AS n FROM workout_type").get().n, 6);
  const resistance = db.prepare("SELECT * FROM workout_type WHERE type = 'Resistance'").get();
  assert.equal(resistance.display_name, "My strength label");
  assert.equal(resistance.is_active, 0);
  assert.throws(() => db.exec("INSERT INTO workout_type_instance VALUES ('InvalidLegacyType')"), /FOREIGN KEY/);
  db.close();
}

(async () => {
  await postingFlow();
  await scopedUpload();
  await statusAndErrors();
  await postDialog();
  catalogRepair();
  console.log("Social posting: isolated upload, shared queue, retry, post status, error messages and catalog repair passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
