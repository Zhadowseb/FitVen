const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const heartRateUtilsPath = path.join(
  rootDir,
  "src",
  "Utils",
  "heartRateUtils.js"
);

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function run() {
  const source = fs.readFileSync(heartRateUtilsPath, "utf8");
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString(
    "base64"
  )}`;
  const { normalizeMaxHeartRate, resolveMaxHeartRate } = await import(moduleUrl);

  assert.deepStrictEqual(
    resolveMaxHeartRate({
      age: 30,
      manualMaxHeartRate: 195,
      measuredMaxHeartRate: 201,
    }),
    { value: 201, source: "measured" }
  );
  assert.deepStrictEqual(
    resolveMaxHeartRate({
      age: 30,
      manualMaxHeartRate: 195,
      measuredMaxHeartRate: null,
    }),
    { value: 195, source: "manual" }
  );
  assert.deepStrictEqual(
    resolveMaxHeartRate({
      age: 30,
      manualMaxHeartRate: null,
      measuredMaxHeartRate: null,
    }),
    { value: 190, source: "calculated" }
  );
  assert.deepStrictEqual(
    resolveMaxHeartRate({
      age: null,
      manualMaxHeartRate: null,
      measuredMaxHeartRate: null,
    }),
    { value: null, source: "calculated" }
  );
  assert.strictEqual(normalizeMaxHeartRate(59), null);
  assert.strictEqual(normalizeMaxHeartRate(60), 60);
  assert.strictEqual(normalizeMaxHeartRate(250), 250);
  assert.strictEqual(normalizeMaxHeartRate(251), null);
  assert.strictEqual(normalizeMaxHeartRate(180.5), null);

  console.log("Heart rate setting checks passed.");
}
