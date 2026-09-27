const assert = require("assert");
const loadAppModule = require("./lib/loadAppModule");

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function run() {
  // Through the app's own module loader, so the repository's imports - the
  // weight-mode SQL (@utils/weightMode) among them - resolve as in the app.
  const repository = loadAppModule("src/Repository/programRepository.js");
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
