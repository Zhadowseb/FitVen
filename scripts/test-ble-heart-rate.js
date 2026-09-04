const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const utilityPath = path.join(
  rootDir,
  "src",
  "Utils",
  "bleHeartRateUtils.js"
);

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

function encodeBytes(bytes) {
  return Buffer.from(bytes).toString("base64");
}

async function run() {
  const source = fs.readFileSync(utilityPath, "utf8");
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString(
    "base64"
  )}`;
  const { parseHeartRateMeasurement } = await import(moduleUrl);

  assert.deepStrictEqual(
    parseHeartRateMeasurement(encodeBytes([0x00, 72])),
    { bpm: 72, rrIntervalsMs: [] }
  );

  assert.deepStrictEqual(
    parseHeartRateMeasurement(encodeBytes([0x01, 0x2c, 0x01])),
    { bpm: 300, rrIntervalsMs: [] }
  );

  assert.deepStrictEqual(
    parseHeartRateMeasurement(
      encodeBytes([0x10, 120, 0x00, 0x04, 0x00, 0x02])
    ),
    { bpm: 120, rrIntervalsMs: [1000, 500] }
  );

  assert.deepStrictEqual(
    parseHeartRateMeasurement(
      encodeBytes([0x18, 90, 0x34, 0x12, 0x00, 0x04])
    ),
    { bpm: 90, rrIntervalsMs: [1000] }
  );

  assert.strictEqual(
    parseHeartRateMeasurement(encodeBytes([0x00, 0])),
    null
  );
  assert.strictEqual(
    parseHeartRateMeasurement(encodeBytes([0x01, 44])),
    null
  );

  console.log("BLE heart-rate measurement tests passed.");
}
