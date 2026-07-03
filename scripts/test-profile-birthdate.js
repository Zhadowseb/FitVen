const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const dateUtilsPath = path.join(rootDir, "src", "Utils", "dateUtils.js");

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function run() {
  const source = fs.readFileSync(dateUtilsPath, "utf8");
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString(
    "base64"
  )}`;
  const {
    calculateAgeFromBirthDate,
    dateToIsoDate,
    isoDateToLocalDate,
  } = await import(moduleUrl);

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
