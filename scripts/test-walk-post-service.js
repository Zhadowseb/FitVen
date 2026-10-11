// A finished walk becomes a post: the real services against a real SQLite
// database built from the app's own schema, with a fake Supabase that keeps what
// would have been written to the social_post table. What this proves is what
// leaves the phone: the trimmed route and nothing else of it, no post of zeros
// for a walk this phone has no record of, a title the table accepts, and the
// route choice.

const assert = require("assert");
const { DatabaseSync } = require("node:sqlite");
const loadAppModule = require("./lib/loadAppModule");

console.warn = () => {};
console.info = () => {};

const METERS_PER_DEGREE = 111195;
const storage = new Map();
const upserts = [];
let existingPost = null;
let signedIn = true;

function table(name) {
  const state = { name, op: null, row: null };
  const builder = {
    select: () => builder,
    eq: () => builder,
    is: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    insert: (row) => {
      state.op = "insert";
      state.row = row;

      return builder;
    },
    upsert: (row) => {
      state.op = "upsert";
      state.row = row;
      upserts.push({ table: name, row });

      return builder;
    },
    update: () => builder,
    maybeSingle: async () => {
      if (name === "profiles") {
        return {
          data: { id: "user-1", username: "walker#1", username_base: "walker", username_code: "1", display_name: "Walker", bio: "", avatar_path: null, updated_at: null },
          error: null,
        };
      }

      return { data: existingPost, error: null };
    },
    single: async () => {
      if (state.op === "upsert") {
        return {
          data: {
            id: 501,
            author_id: "user-1",
            post_type: "workout_summary",
            source_workout_type_instance_id: state.row.source_workout_type_instance_id,
            visibility: state.row.visibility,
            workout_type: state.row.workout_type,
            title: state.row.title,
            body: state.row.body,
            payload: state.row.payload,
            completed_at: state.row.completed_at,
            created_at: state.row.completed_at,
            updated_at: state.row.updated_at,
            deleted_at: null,
            author: { id: "user-1", username: "walker#1", display_name: "Walker", avatar_path: null, updated_at: null },
          },
          error: null,
        };
      }

      return { data: null, error: null };
    },
    then: (resolve) => resolve({ data: [], error: null }),
  };

  return builder;
}

const fakeSupabase = {
  auth: {
    getSession: async () => ({ data: { session: signedIn ? { user: { id: "user-1" } } : null }, error: null }),
    getUser: async () => ({ data: { user: signedIn ? { id: "user-1" } : null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
  from: table,
  storage: { from: () => ({ createSignedUrls: async () => ({ data: [], error: null }) }) },
  rpc: async () => ({ data: null, error: null }),
  functions: { invoke: async () => ({ data: null, error: null }) },
};

loadAppModule.stubModule("@supabase/supabase-js", { createClient: () => fakeSupabase, processLock: () => {} });
loadAppModule.stubModule("react-native", {
  Platform: { OS: "android" },
  AppState: { addEventListener: () => ({ remove() {} }) },
  I18nManager: {},
  NativeModules: {},
});
loadAppModule.stubModule("@react-native-async-storage/async-storage", {
  __esModule: true,
  default: {
    getItem: async (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: async (key, value) => storage.set(key, String(value)),
    removeItem: async (key) => storage.delete(key),
    getAllKeys: async () => [...storage.keys()],
    multiRemove: async (keys) => keys.forEach((key) => storage.delete(key)),
  },
});
loadAppModule.stubModule("expo-location", {});
loadAppModule.stubModule("expo-sensors", {});
loadAppModule.stubModule("expo-notifications", {
  setNotificationHandler() {},
  getPermissionsAsync: async () => ({ status: "granted" }),
  scheduleNotificationAsync: async () => "n1",
  cancelScheduledNotificationAsync: async () => {},
  setNotificationChannelAsync: async () => {},
  SchedulableTriggerInputTypes: { DATE: "date" },
  AndroidImportance: { HIGH: 4 },
});
loadAppModule.stubModule("expo-constants", { default: {} });
loadAppModule.stubModule("react-native-url-polyfill/auto", {});
loadAppModule.stubModule("expo-sqlite/localStorage/install", {});
loadAppModule.stubModule("expo-secure-store", {});

const { programSchemaSql } = loadAppModule("src/Database/schema/program.js");
const { weightliftingSchemaSql } = loadAppModule("src/Database/schema/weightlifting.js");
const { runningSchemaSql } = loadAppModule("src/Database/schema/running.js");
const { locationSchemaSql } = loadAppModule("src/Database/schema/location.js");

function createDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  const bind = (params) =>
    (Array.isArray(params) ? params : params === undefined ? [] : [params]).map((value) =>
      value === undefined ? null : typeof value === "boolean" ? Number(value) : value
    );

  sqlite.exec(programSchemaSql);
  sqlite.exec(weightliftingSchemaSql);
  sqlite.exec(runningSchemaSql);
  sqlite.exec(locationSchemaSql);

  return {
    sqlite,
    async execAsync(sql) {
      sqlite.exec(sql);
    },
    async runAsync(sql, params) {
      const result = sqlite.prepare(sql).run(...bind(params));

      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    async getAllAsync(sql, params) {
      return sqlite.prepare(sql).all(...bind(params));
    },
    async getFirstAsync(sql, params) {
      return sqlite.prepare(sql).get(...bind(params)) ?? null;
    },
    async isInTransactionAsync() {
      return Boolean(sqlite.isTransaction);
    },
  };
}

const posts = loadAppModule("src/Services/socialPostService.js");
const walkPost = loadAppModule("src/Utils/walkPost.js");
const walkPostService = loadAppModule("src/Services/walkPostService.js");

const running = loadAppModule("src/Repository/runningRepository.js");
const user = { id: "user-1" };

// A walk on the phone: a day, the workout (finished, with a cloud id), its one
// segment and its route as LocationLog keeps it - a position every 5 m, one
// break marker where the person paused.
async function makeWalk(db, { label = null, meters = 3420, seconds = 2538, steps = 4860, withSegment = true, cloudId = 77 } = {}) {
  db.sqlite.prepare(`INSERT INTO Day (Weekday, date) VALUES ('Sat', '2026-10-10')`).run();

  const dayId = Number(db.sqlite.prepare(`SELECT MAX(day_id) AS id FROM Day`).get().id);

  db.sqlite
    .prepare(
      `INSERT INTO Workout_Type_Instance (day_id, workout_type, label, date, done, cloud_workout_type_instance_id, elapsed_time, original_start_time) VALUES (?, 'Walk', ?, '2026-10-10', 1, ?, ?, ?)`
    )
    .run(dayId, label, cloudId, seconds, 1791000000);

  const workoutId = Number(db.sqlite.prepare(`SELECT MAX(workout_id) AS id FROM Workout_Type_Instance`).get().id);

  if (withSegment) {
    await running.saveWalkSegment(db, {
      workoutId,
      distanceKm: meters / 1000,
      durationSeconds: seconds,
      paceMinutes: null,
      steps,
      done: true,
    });
  }

  const insert = db.sqlite.prepare(`INSERT INTO LocationLog (workout_id, latitude, longitude, accuracy, timestamp) VALUES (?, ?, ?, 6, ?)`);
  let time = 1791000000000;

  for (let at = 0; at <= meters; at += 5) {
    insert.run(workoutId, 55 + at / METERS_PER_DEGREE, 12 + Math.sin(at / 90) * 0.00008, time);
    time += 3500;

    if (at === 1500) {
      insert.run(workoutId, null, null, time);
    }
  }

  return workoutId;
}

async function main() {
  const db = createDatabase();
  const workoutId = await makeWalk(db);

  // The walk as the post reads it.
  const read = await walkPostService.readWalkForPost(db, workoutId);

  assert.strictEqual(Math.round(read.distanceMeters), 3420);
  assert.strictEqual(read.movingSeconds, 2538);
  assert.strictEqual(read.steps, 4860);

  // Posted with its route (the person's choice): trimmed, simplified, at most 150 points.
  const post = await posts.createWorkoutSummaryPostForCompletedWorkout(db, { workoutId, source: "manual", note: "Lovely", shareRoute: true });

  assert.strictEqual(upserts.length, 1);

  const sent = upserts[0].row;

  assert.strictEqual(upserts[0].table, "social_post");
  assert.strictEqual(sent.workout_type, "Walk");
  assert.strictEqual(sent.title, "Walk", "a walk nobody named is titled with its type - the table does not accept a blank title");
  assert.strictEqual(sent.body, "Lovely");
  assert.strictEqual(sent.source_workout_type_instance_id, 77);
  assert.deepStrictEqual(Object.keys(sent.payload).sort(), ["cadence", "distanceMeters", "movingSeconds", "postMode", "route", "steps", "version"]);
  assert.deepStrictEqual(
    [sent.payload.version, sent.payload.distanceMeters, sent.payload.movingSeconds, sent.payload.steps, sent.payload.cadence],
    [1, 3420, 2538, 4860, 115]
  );
  assert.ok(!("pace" in sent.payload) && !("stepsPerKm" in sent.payload), "pace and steps/km are worked out when it is drawn");
  assert.ok(sent.payload.route.points.length >= 2 && sent.payload.route.points.length <= 150);

  // What leaves the phone is the trimmed route: nothing within 200 m of where it started or ended.
  const startPoint = { latitude: 55, longitude: 12 };
  const endPoint = { latitude: 55 + 3420 / METERS_PER_DEGREE, longitude: 12 + Math.sin(3420 / 90) * 0.00008 };

  for (const [latitude, longitude] of sent.payload.route.points) {
    assert.ok(walkPost.distanceBetween({ latitude, longitude }, startPoint) >= 200, "never within 200 m of the start");
    assert.ok(walkPost.distanceBetween({ latitude, longitude }, endPoint) >= 200, "never within 200 m of the end");
  }

  // The raw positions are not in the post: what is sent is a few points of it, rounded to five decimals.
  const rawCount = db.sqlite.prepare(`SELECT COUNT(*) AS n FROM LocationLog WHERE latitude IS NOT NULL`).get().n;

  assert.ok(sent.payload.route.points.length < rawCount / 4, `a few points, not the ${rawCount} the phone kept`);

  for (const coordinate of sent.payload.route.points.flat()) {
    assert.ok((String(coordinate).split(".")[1] ?? "").length <= 5, "five decimals at most");
  }

  assert.strictEqual(post.workoutType, "Walk");
  assert.strictEqual(post.payload.distanceMeters, 3420);

  // Without the route: the choice is kept in what is sent.
  upserts.length = 0;
  await posts.createWorkoutSummaryPostForCompletedWorkout(db, { workoutId, source: "manual", shareRoute: false });
  assert.strictEqual(upserts[0].row.payload.route, null);

  // With no choice given, the person's own default decides - shared until they say no.
  upserts.length = 0;
  assert.strictEqual(await posts.getWalkPostShareRoute({ user }), true);
  await posts.createWorkoutSummaryPostForCompletedWorkout(db, { workoutId, source: "manual" });
  assert.ok(upserts[0].row.payload.route, "shared by default");
  await posts.setWalkPostShareRoute({ user, shareRoute: false });
  assert.strictEqual(await posts.getWalkPostShareRoute({ user }), false);
  upserts.length = 0;
  await posts.createWorkoutSummaryPostForCompletedWorkout(db, { workoutId, source: "manual" });
  assert.strictEqual(upserts[0].row.payload.route, null, "and the default they set");
  await posts.setWalkPostShareRoute({ user, shareRoute: true });

  // "Summary only" never carries a route, whatever was asked.
  storage.set(`fitven:workout-summary-post-mode:${user.id}`, "summary_only");
  upserts.length = 0;
  await posts.createWorkoutSummaryPostForCompletedWorkout(db, { workoutId, source: "manual", shareRoute: true });
  assert.strictEqual(upserts[0].row.payload.route, null);
  assert.strictEqual(upserts[0].row.payload.postMode, "summary_only");
  storage.delete(`fitven:workout-summary-post-mode:${user.id}`);

  // Posts turned off: an automatic one is not made.
  storage.set(`fitven:workout-summary-post-mode:${user.id}`, "off");
  upserts.length = 0;
  assert.deepStrictEqual(await posts.createWorkoutSummaryPostForCompletedWorkout(db, { workoutId }), { skipped: true, reason: "automatic_posts_disabled" });
  assert.strictEqual(upserts.length, 0);
  storage.delete(`fitven:workout-summary-post-mode:${user.id}`);

  // A walk the person named keeps its name as the title.
  const named = await makeWalk(db, { label: "Morning loop", cloudId: 78 });

  upserts.length = 0;
  await posts.createWorkoutSummaryPostForCompletedWorkout(db, { workoutId: named, source: "manual" });
  assert.strictEqual(upserts[0].row.title, "Morning loop");
  assert.strictEqual(walkPostService.walkPostTitle({ label: "walk", workout_type: "Walk" }), "Walk", "the type spelt back is not a name");
  assert.strictEqual(walkPostService.walkPostTitle({ label: "  ", workout_type: "Walk" }), "Walk");

  // A walk this phone has no record of (tracked on another phone: Run and the
  // route are not in the cloud): no post, and a post that is out is not touched.
  const foreign = await makeWalk(db, { withSegment: false, cloudId: 79 });

  db.sqlite.prepare(`DELETE FROM LocationLog WHERE workout_id = ?`).run(foreign);
  existingPost = { id: 9, payload: { version: 1, distanceMeters: 5000, movingSeconds: 3000, steps: 6000, cadence: 120, route: null }, deleted_at: null, visibility: "following", body: "" };
  upserts.length = 0;
  assert.deepStrictEqual(await posts.createWorkoutSummaryPostForCompletedWorkout(db, { workoutId: foreign, source: "manual" }), { skipped: true, reason: "nothing_recorded" });
  assert.strictEqual(upserts.length, 0, "a good post is never overwritten with zeros");
  existingPost = null;

  // A walk with nothing in it.
  const empty = await makeWalk(db, { meters: 0, seconds: 0, steps: 0, cloudId: 80 });

  db.sqlite.prepare(`DELETE FROM LocationLog WHERE workout_id = ?`).run(empty);
  assert.deepStrictEqual(await posts.createWorkoutSummaryPostForCompletedWorkout(db, { workoutId: empty, source: "manual" }), { skipped: true, reason: "nothing_recorded" });
  assert.strictEqual(upserts.length, 0);

  // A walk with steps and no GPS: posted, with no distance - not zero - and no route.
  const noGps = await makeWalk(db, { meters: 0, seconds: 1800, steps: 2400, cloudId: 81 });

  db.sqlite.prepare(`DELETE FROM LocationLog WHERE workout_id = ?`).run(noGps);
  await posts.createWorkoutSummaryPostForCompletedWorkout(db, { workoutId: noGps, source: "manual" });
  assert.deepStrictEqual(
    [upserts[0].row.payload.distanceMeters, upserts[0].row.payload.steps, upserts[0].row.payload.route],
    [null, 2400, null]
  );

  // The offer after a walk: whether there is anything to post, and whether a route could go with it.
  assert.deepStrictEqual(await walkPostService.getWalkPostOffer(db, workoutId), { canPost: true, canShareRoute: true });
  assert.deepStrictEqual(await walkPostService.getWalkPostOffer(db, noGps), { canPost: true, canShareRoute: false }, "no route, no switch");
  assert.deepStrictEqual(await walkPostService.getWalkPostOffer(db, foreign), { canPost: false, canShareRoute: false });
  const shortWalk = await makeWalk(db, { meters: 600, seconds: 420, steps: 800, cloudId: 82 });

  assert.deepStrictEqual(await walkPostService.getWalkPostOffer(db, shortWalk), { canPost: true, canShareRoute: false }, "under 800 m the route is not offered");

  // Signed out: nothing is posted.
  signedIn = false;
  assert.deepStrictEqual(await posts.createWorkoutSummaryPostForCompletedWorkout(db, { workoutId, source: "manual" }), { skipped: true, reason: "signed_out" });
  signedIn = true;

  // On "Your posts": the card of a walk is built from the walk on this phone, and
  // a walk this phone has no record of has none.
  const local = await posts.buildLocalWorkoutSummaryPost(db, {
    workout: { workout_id: workoutId, workout_type: "Walk", label: null, cloud_workout_type_instance_id: 77, date: "2026-10-10" },
    author: { id: "user-1", displayName: "Walker" },
  });

  assert.strictEqual(local.workoutType, "Walk");
  assert.strictEqual(local.title, "Walk");
  assert.strictEqual(local.payload.distanceMeters, 3420);
  assert.strictEqual(
    await posts.buildLocalWorkoutSummaryPost(db, {
      workout: { workout_id: foreign, workout_type: "Walk", label: null, cloud_workout_type_instance_id: 79, date: "2026-10-10" },
      author: { id: "user-1" },
    }),
    null
  );
}

main()
  .then(() => {
    console.log(
      "Walk post service: the trimmed route and nothing of the raw one, the title the table accepts, the route choice and the default, summary only, a walk this phone has no record of is no post, no GPS, and the card on Your posts."
    );
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
