const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const repositoryPath = path.join(
  rootDir,
  "src",
  "Repository",
  "programRepository.js"
);

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function run() {
  const source = fs
    .readFileSync(repositoryPath, "utf8")
    .replace(
      'import { createNextSyncVersion, SQLITE_UUID_SQL } from "../Utils/syncUtils";',
      'const createNextSyncVersion = () => 0; const SQLITE_UUID_SQL = "NULL";'
    )
    .replace(
      'import { normalizeIsoDateString } from "../Utils/dateUtils";',
      'const normalizeIsoDateString = (value) => value;'
    );
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  const repository = await import(moduleUrl);
  const queries = [];
  const db = {
    getAllAsync: async (query) => {
      queries.push(query);
      return [];
    },
    getFirstAsync: async (query) => {
      queries.push(query);
      return {};
    },
  };

  await repository.getProgramsOverview(db);
  await repository.getMesocycleWorkoutCountsByProgram(db, 1);
  await repository.getProgramOverviewStats(db, 1);
  await repository.getProgramWeekCompletionStats(db, 1);

  assert.strictEqual(queries.length, 4);
  queries.forEach((query) => {
    assert.match(query, /COALESCE\(d\.is_sick, 0\) = 1/);
    assert.match(query, /date\('now', 'localtime'\)/);
    assert.match(query, /date\(CASE[\s\S]*d\.date[\s\S]*\) < date\('now', 'localtime'\)/);
  });

  console.log("Program sickness progress query checks passed.");
}
