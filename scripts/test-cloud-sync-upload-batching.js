// Covers the two cheap halves of the upload path: reading only dirty rows, and
// looking a parent up once instead of once per child.
//
// Uploading used to read the whole table across the bridge and drop the clean
// rows in JavaScript - on a full history that is every row to find the handful
// that changed - and then ask the cloud for a row's parent identity again for
// every child of that parent.
//
// Both are quiet if they break. A `dirtyOnly` flag that stops filtering means
// the app re-uploads everything it owns; one that filters where it should not
// means reconcile stops seeing local rows and starts duplicating them. A parent
// cache that returns a stale answer sends rows to the wrong parent, and one that
// caches across runs would defeat the repair pass that follows a missing parent.
//
// The SQL and the cache are read out of the source rather than copied.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const root = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

const programSource = read("src", "Repository", "programRepository.js");
const weightliftingSource = read("src", "Repository", "weightliftingRepository.js");
const sharedSource = read("src", "Services", "cloudSync", "cloudSyncShared.js");

/* ------------------------------------------------- part one: dirty rows -- */

/** Builds a named repository query for a given `dirtyOnly`. */
function queryFrom(source, functionName, dirtyOnly) {
  const start = source.indexOf(`export async function ${functionName}`);
  assert.ok(start !== -1, `${functionName} is gone from the repository`);

  const body = source.slice(start, source.indexOf("\nexport ", start + 1));
  const match = body.match(/getAllAsync\(\s*(`[\s\S]*?`)/);
  assert.ok(match, `${functionName} no longer runs a single query`);

  return new Function("dirtyOnly", `return ${match[1]};`)(dirtyOnly);
}

const CLOUD_SYNC_QUERIES = [
  [programSource, "getProgramsForCloudSync", "Program"],
  [programSource, "getMesocyclesForCloudSync", "Mesocycle"],
  [programSource, "getMicrocyclesForCloudSync", "Microcycle"],
  [programSource, "getDaysForCloudSync", "Day"],
  [programSource, "getWorkoutsForCloudSync", "Workout_Type_Instance"],
  [weightliftingSource, "getExercisesForCloudSync", "Exercise_Instance"],
  [weightliftingSource, "getSetsForCloudSync", "Set"],
];

/** The column names a query selects, so the fixture can be built from them. */
function selectedColumns(sql) {
  const between = sql.slice(
    sql.indexOf("SELECT") + "SELECT".length,
    sql.indexOf("FROM")
  );

  return between
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean)
    .map((entry) => {
      // A few of these alias a column, e.g. `Weekday AS weekday`. The fixture
      // needs the real name; the assertions need the name it comes back as.
      const match = entry.match(
        /^([A-Za-z_][A-Za-z0-9_]*)(?:\s+AS\s+([A-Za-z_][A-Za-z0-9_]*))?$/
      );

      assert.ok(
        match,
        `${entry} is an expression, not a plain column - this test assumes plain ones`
      );

      return { column: match[1], alias: match[2] ?? match[1] };
    });
}

for (const [source, functionName, table] of CLOUD_SYNC_QUERIES) {
  const everything = queryFrom(source, functionName, false);
  const dirtyOnly = queryFrom(source, functionName, true);
  const columns = selectedColumns(everything);

  const idColumn = columns[0].column;
  const idAlias = columns[0].alias;

  assert.ok(
    columns.some((column) => column.alias === "needs_sync"),
    `${functionName} must select needs_sync - both paths read it`
  );
  assert.ok(
    !/\bWHERE\b/.test(everything),
    `${functionName} must return every local row when dirtyOnly is off - reconcile matches cloud rows against them`
  );
  assert.deepStrictEqual(
    selectedColumns(dirtyOnly),
    columns,
    `${functionName} returns different columns depending on dirtyOnly`
  );

  const db = new DatabaseSync(":memory:");
  const quoted = `"${table}"`;

  db.exec(
    `CREATE TABLE ${quoted} (${columns
      .map(
        ({ column }, index) =>
          `${column}${index === 0 ? " INTEGER PRIMARY KEY" : ""}`
      )
      .join(", ")});`
  );

  const insert = db.prepare(
    `INSERT INTO ${quoted} (${columns.map(({ column }) => column).join(", ")})
     VALUES (${columns.map(() => "?").join(", ")});`
  );

  // Four rows: two waiting to upload, one already clean, one that never had the
  // flag set at all. NULL must count as clean - `Number(null) !== 1` did.
  const rows = [
    { id: 1, needs_sync: 1 },
    { id: 2, needs_sync: 0 },
    { id: 3, needs_sync: 1 },
    { id: 4, needs_sync: null },
  ];

  for (const row of rows) {
    insert.run(
      ...columns.map(({ column }) => {
        if (column === idColumn) return row.id;
        if (column === "needs_sync") return row.needs_sync;
        return null;
      })
    );
  }

  const all = db.prepare(everything).all();
  const dirty = db.prepare(dirtyOnly).all();

  assert.strictEqual(
    all.length,
    4,
    `${functionName} stopped returning every row with dirtyOnly off`
  );
  assert.deepStrictEqual(
    dirty.map((row) => row[idAlias]),
    [1, 3],
    `${functionName} returned the wrong rows with dirtyOnly on`
  );
  assert.deepStrictEqual(
    dirty.map((row) => row.needs_sync),
    [1, 1],
    `${functionName} let a clean row through`
  );

  db.close();
}

/* ---------------------------------------------- part two: parent lookups -- */

const cacheStart = sharedSource.indexOf("export function createParentCloudIdCache(");
assert.ok(cacheStart !== -1, "createParentCloudIdCache is gone from cloudSyncShared");

const cacheSource = sharedSource.slice(
  cacheStart,
  sharedSource.indexOf("\n}", cacheStart) + 2
);
const createParentCloudIdCache = new Function(
  `${cacheSource.replace("export function", "function")}\nreturn createParentCloudIdCache;`
)();

/** A resolver that records what it was asked, and answers from a table. */
function countingResolver(answers) {
  const calls = [];

  return {
    calls,
    resolve: async (db, userId, parent, ...rest) => {
      assert.strictEqual(rest.length, 0, "the resolver was handed the cache key");
      calls.push({ db, userId, parent });

      return answers.get(parent) ?? null;
    },
  };
}

async function run() {
  // Twenty-five sets over five exercises: five lookups, not twenty-five.
  const answers = new Map([
    ["exercise-1", 11],
    ["exercise-2", 12],
    ["exercise-3", 13],
    ["exercise-4", 14],
    ["exercise-5", 15],
  ]);
  const { calls, resolve } = countingResolver(answers);
  const resolveParentCloudId = createParentCloudIdCache(resolve);
  const seen = [];

  for (let setIndex = 0; setIndex < 25; setIndex += 1) {
    const parentKey = (setIndex % 5) + 1;

    seen.push(
      await resolveParentCloudId("db", "user", `exercise-${parentKey}`, parentKey)
    );
  }

  assert.strictEqual(
    calls.length,
    5,
    `the cache asked ${calls.length} times for five parents`
  );
  assert.deepStrictEqual(
    seen.slice(0, 10),
    [11, 12, 13, 14, 15, 11, 12, 13, 14, 15],
    "the cache handed back the wrong parent's cloud id"
  );
  assert.deepStrictEqual(
    calls.map((call) => call.parent),
    ["exercise-1", "exercise-2", "exercise-3", "exercise-4", "exercise-5"],
    "the resolver was called with the wrong parents"
  );
  assert.deepStrictEqual(
    calls.map((call) => [call.db, call.userId]),
    Array.from({ length: 5 }, () => ["db", "user"]),
    "the resolver lost its db or user argument"
  );

  // A parent with no cloud row answers null, and that answer is worth keeping:
  // every child of it hits the same repair pass afterwards either way.
  const missing = countingResolver(new Map());
  const resolveMissing = createParentCloudIdCache(missing.resolve);

  assert.strictEqual(await resolveMissing("db", "user", "gone", 7), null);
  assert.strictEqual(await resolveMissing("db", "user", "gone", 7), null);
  assert.strictEqual(
    missing.calls.length,
    1,
    "a missing parent was looked up again for the next child"
  );

  // No key, no caching - the caller could not tell two parents apart.
  const unkeyed = countingResolver(new Map([["p", 1]]));
  const resolveUnkeyed = createParentCloudIdCache(unkeyed.resolve);

  await resolveUnkeyed("db", "user", "p", null);
  await resolveUnkeyed("db", "user", "p", null);
  await resolveUnkeyed("db", "user", "p", undefined);
  await resolveUnkeyed("db", "user", "p", undefined);
  assert.strictEqual(
    unkeyed.calls.length,
    4,
    "an unkeyed parent was cached, and two of those cannot be told apart"
  );

  // A second run starts empty, which is what makes the repair pass work: the
  // parent it just created must be looked up again rather than read as missing.
  const repaired = countingResolver(new Map([["exercise-1", 11]]));
  const firstRun = createParentCloudIdCache(repaired.resolve);
  const secondRun = createParentCloudIdCache(repaired.resolve);

  await firstRun("db", "user", "exercise-1", 1);
  await secondRun("db", "user", "exercise-1", 1);
  assert.strictEqual(
    repaired.calls.length,
    2,
    "the cache outlived its upload run - a repair pass would read a stale answer"
  );

  // Every upload loop must actually use it.
  const CALLERS = [
    ["daySync.js", "resolveParentMicrocycleCloudId"],
    ["exerciseInstanceSync.js", "resolveParentWorkoutCloudId"],
    ["mesocycleSync.js", "resolveParentProgramCloudId"],
    ["microcycleSync.js", "resolveParentMesocycleCloudId"],
    ["setSync.js", "resolveParentExerciseCloudId"],
    ["workoutTypeInstanceSync.js", "resolveParentDayCloudId"],
  ];

  for (const [file, cacheName] of CALLERS) {
    const source = read("src", "Services", "cloudSync", file);

    assert.ok(
      source.includes(`const ${cacheName} = createParentCloudIdCache(`),
      `${file} no longer builds a parent cache`
    );
    assert.ok(
      new RegExp(`await ${cacheName}\\(`).test(source),
      `${file} builds a parent cache it does not use`
    );
    assert.ok(
      /dirtyOnly: true/.test(source),
      `${file} stopped asking for only the rows waiting to upload`
    );
  }

  console.log(
    `Cloud sync upload: dirty-row filtering holds for ` +
      `${CLOUD_SYNC_QUERIES.length} tables, and ${CALLERS.length} upload loops ` +
      `look each parent up once.`
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
