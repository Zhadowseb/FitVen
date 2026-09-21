const assert = require("assert");
const loadAppModule = require("./lib/loadAppModule");

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function run() {
  // Through the project's Babel setup rather than a data: URL: dateUtils now
  // imports the translations for its relative-time words, and a data: URL
  // cannot resolve an import.
  const {
    calculateAgeFromBirthDate,
    dateToIsoDate,
    isoDateToLocalDate,
  } = loadAppModule("src/Utils/dateUtils.js");

  assert.strictEqual(
    calculateAgeFromBirthDate("2000-06-28", new Date(2026, 5, 28)),
    26
  );
  assert.strictEqual(
    calculateAgeFromBirthDate("2000-06-29", new Date(2026, 5, 28)),
    25
  );
  assert.strictEqual(
    calculateAgeFromBirthDate("2000-02-29", new Date(2025, 1, 28)),
    24
  );
  assert.strictEqual(
    calculateAgeFromBirthDate("2000-02-29", new Date(2025, 2, 1)),
    25
  );
  assert.strictEqual(
    calculateAgeFromBirthDate("2030-01-01", new Date(2026, 5, 28)),
    null
  );
  assert.strictEqual(calculateAgeFromBirthDate("not-a-date"), null);
  assert.strictEqual(dateToIsoDate(new Date(1995, 10, 7)), "1995-11-07");

  const localDate = isoDateToLocalDate("1995-11-07");
  assert.strictEqual(localDate.getFullYear(), 1995);
  assert.strictEqual(localDate.getMonth(), 10);
  assert.strictEqual(localDate.getDate(), 7);

  console.log("Profile birth date checks passed.");
}
