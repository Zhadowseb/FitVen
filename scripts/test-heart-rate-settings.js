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
  const {
    buildHeartRateZones,
    normalizeMaxHeartRate,
    normalizeMaxHeartRateSource,
    resolveMaxHeartRate,
  } = await import(moduleUrl);

  assert.deepStrictEqual(
    resolveMaxHeartRate({
      age: 30,
      manualMaxHeartRate: 195,
      measuredMaxHeartRate: 201,
    }),
    { value: 195, source: "manual", preferredSource: "auto" }
  );
  assert.deepStrictEqual(
    resolveMaxHeartRate({
      age: 30,
      manualMaxHeartRate: null,
      measuredMaxHeartRate: 201,
    }),
    { value: 190, source: "calculated", preferredSource: "auto" }
  );
  assert.deepStrictEqual(
    resolveMaxHeartRate({
      age: 30,
      manualMaxHeartRate: 195,
      measuredMaxHeartRate: 201,
      preferredSource: "measured",
    }),
    { value: 201, source: "measured", preferredSource: "measured" }
  );
  assert.deepStrictEqual(
    resolveMaxHeartRate({
      age: 30,
      manualMaxHeartRate: 195,
      measuredMaxHeartRate: 201,
      preferredSource: "calculated",
    }),
    { value: 190, source: "calculated", preferredSource: "calculated" }
  );
  assert.deepStrictEqual(
    resolveMaxHeartRate({
      age: 30,
      manualMaxHeartRate: null,
      measuredMaxHeartRate: 201,
      preferredSource: "manual",
    }),
    { value: 190, source: "calculated", preferredSource: "manual" }
  );
  assert.deepStrictEqual(
    resolveMaxHeartRate({
      age: null,
      manualMaxHeartRate: null,
      measuredMaxHeartRate: null,
    }),
    { value: null, source: null, preferredSource: "auto" }
  );
  assert.strictEqual(normalizeMaxHeartRateSource("MEASURED"), "measured");
  assert.strictEqual(normalizeMaxHeartRateSource("unknown"), "auto");
  assert.strictEqual(normalizeMaxHeartRate(59), null);
  assert.strictEqual(normalizeMaxHeartRate(60), 60);
  assert.strictEqual(normalizeMaxHeartRate(250), 250);
  assert.strictEqual(normalizeMaxHeartRate(251), null);
  assert.strictEqual(normalizeMaxHeartRate(180.5), null);
  assert.deepStrictEqual(
    buildHeartRateZones(200).map(({ zone, min, max }) => ({
      zone,
      min,
      max,
    })),
    [
      { zone: 1, min: 0, max: 130 },
      { zone: 2, min: 131, max: 162 },
      { zone: 3, min: 163, max: 178 },
      { zone: 4, min: 179, max: 194 },
      { zone: 5, min: 195, max: 200 },
    ]
  );

  console.log("Heart rate setting checks passed.");
}
