// The phone's own step counter turned into steps for each day: the rules in
// Utils/stepSensor.js, and a look at the native module's files (Kotlin cannot be
// compiled on Windows, so the shape the JS depends on is checked here, and the
// compiling is done by .github/workflows/android-native-check.yml).
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const loadAppModule = require("./lib/loadAppModule");

const sensor = loadAppModule("src/Utils/stepSensor.js");
const root = path.resolve(__dirname, "..");

// Local times, so the test means the same in any time zone.
const at = (day, hour, minute = 0) => new Date(2026, 9, day, hour, minute).getTime();
const read = (time, counter, bootTime = at(1, 6)) => ({ time, counter, bootTime });
const total = (days) => Object.values(days).reduce((sum, value) => sum + value, 0);
const near = (actual, expected, tolerance = 0.5) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not ${expected} (+-${tolerance})`);

/* ----------------------------------------------------------- spreading steps -- */

{
  near(total(sensor.spreadOverDays(at(5, 10), at(5, 10, 30), 600)), 600, 1e-9);
  assert.deepStrictEqual(Object.keys(sensor.spreadOverDays(at(5, 10), at(5, 10, 30), 600)), ["2026-10-05"]);

  // A short walk over midnight is split by the time: 20 minutes before, 10 after.
  const split = sensor.spreadOverDays(at(5, 23, 40), at(6, 0, 10), 300);

  near(split["2026-10-05"], 200, 1e-6);
  near(split["2026-10-06"], 100, 1e-6);

  // A long silence over a night: the steps go to the hours somebody is awake.
  const night = sensor.spreadOverDays(at(5, 22), at(6, 8), 1000);

  assert.ok(night["2026-10-06"] > 800, "the morning, not the night, gets them");
  near(total(night), 1000, 1e-6);

  // Whole days of silence: spread over the days, evenly by waking hours.
  const days = sensor.spreadOverDays(at(5, 8), at(8, 8), 3000);

  assert.strictEqual(Object.keys(days).length, 4);
  near(total(days), 3000, 1e-6);
  assert.ok(days["2026-10-06"] > days["2026-10-05"], "the full days get more than the part days at either end");

  assert.deepStrictEqual(sensor.spreadOverDays(at(5, 10), at(5, 10), 100), {}, "no time, no steps");
  assert.deepStrictEqual(sensor.spreadOverDays(at(5, 10), at(5, 11), 0), {});
}

/* ------------------------------------------------------------ the readings -- */

{
  // A day of 15-minute readings, every one 100 steps on: 100 steps per quarter.
  const readings = [];

  for (let step = 0; step <= 8; step += 1) {
    readings.push(read(at(5, 9) + step * 15 * 60000, 1000 + step * 100));
  }

  const { days, anchor } = sensor.incrementsFromReadings(readings, null);

  near(days["2026-10-05"], 800, 1e-6);
  assert.strictEqual(anchor.counter, 1800, "the last reading is where counting goes on from");

  // The first reading ever only starts the count: nothing before it is guessed.
  assert.deepStrictEqual(sensor.incrementsFromReadings([read(at(5, 9), 5000)], null).days, {});
  assert.strictEqual(sensor.incrementsFromReadings([read(at(5, 9), 5000)], null).anchor.counter, 5000);
  assert.deepStrictEqual(sensor.incrementsFromReadings([], null), { days: {}, anchor: null });
}

{
  // In two batches the result is the same as in one.
  const readings = [read(at(5, 8), 100), read(at(5, 12), 700), read(at(5, 18), 1900), read(at(6, 9), 2500), read(at(6, 20), 4000)];
  const whole = sensor.incrementsFromReadings(readings, null);
  const first = sensor.incrementsFromReadings(readings.slice(0, 3), null);
  const second = sensor.incrementsFromReadings(readings.slice(0, 5), first.anchor);
  const sum = { ...first.days };

  for (const [day, value] of Object.entries(second.days)) {
    sum[day] = (sum[day] ?? 0) + value;
  }

  for (const day of Object.keys(whole.days)) {
    near(sum[day], whole.days[day], 1e-6);
  }

  assert.deepStrictEqual(second.anchor, whole.anchor);

  // Readings already counted are not counted again.
  assert.deepStrictEqual(sensor.incrementsFromReadings(readings.slice(0, 3), first.anchor).days, {}, "counting the same readings twice adds nothing");
}

{
  // A restart: the counter goes back to zero and the phone started again at 10:00.
  const bootA = at(5, 6);
  const bootB = at(5, 10);
  const { days } = sensor.incrementsFromReadings(
    [read(at(5, 9, 30), 4000, bootA), read(at(5, 11), 250, bootB)],
    null
  );

  assert.deepStrictEqual(Object.keys(days), ["2026-10-05"]);
  near(days["2026-10-05"], 250, 1e-6, "the steps since the start - not 250 minus 4000");
  assert.ok(Object.values(days).every((value) => value >= 0));

  // Told by the start moving, even when the counter has not yet gone below the old one.
  const byBoot = sensor.incrementsFromReadings([read(at(5, 9, 30), 100, bootA), read(at(5, 11), 450, bootB)], null);

  near(total(byBoot.days), 450, 1e-6);

  // The clock's own drift is not a restart.
  const drift = sensor.incrementsFromReadings([read(at(5, 9), 100, bootA), read(at(5, 9, 15), 160, bootA + 40000)], null);

  near(total(drift.days), 60, 1e-6);
}

{
  // A number no body could walk is clamped; a counter that did not move is nothing.
  const glitch = sensor.incrementsFromReadings([read(at(5, 9), 0), read(at(5, 9, 1), 900000)], null);

  assert.ok(total(glitch.days) <= 60 * sensor.MAX_STEPS_PER_SECOND + 1e-6, "no more than a minute of sprinting");
  assert.deepStrictEqual(sensor.incrementsFromReadings([read(at(5, 9), 700), read(at(5, 10), 700)], null).days, {});

  // Duplicates, readings out of order, damaged readings.
  const messy = sensor.incrementsFromReadings(
    [read(at(5, 10), 200), read(at(5, 9), 100), read(at(5, 10), 200), { time: "x", counter: 1 }, null, read(at(5, 11), -5), read(at(5, 11), 350)],
    null
  );

  near(total(messy.days), 250, 1e-6, "100 -> 200 -> 350, each reading once");
}

/* ----------------------------------------------------------- the native module -- */

{
  const dir = path.join(root, "modules", "step-sensor");
  const kotlin = (name) => fs.readFileSync(path.join(dir, "android", "src", "main", "java", "expo", "modules", "stepsensor", name), "utf8");
  const module = kotlin("StepSensorModule.kt");
  const js = fs.readFileSync(path.join(dir, "index.js"), "utf8");
  const config = JSON.parse(fs.readFileSync(path.join(dir, "expo-module.config.json"), "utf8"));
  const gradle = fs.readFileSync(path.join(dir, "android", "build.gradle"), "utf8");
  const manifest = fs.readFileSync(path.join(dir, "android", "src", "main", "AndroidManifest.xml"), "utf8");

  assert.deepStrictEqual(config.platforms, ["android"], "Android only: the iPhone has Core Motion");
  assert.deepStrictEqual(config.android.modules, ["expo.modules.stepsensor.StepSensorModule"]);
  assert.ok(/Name\("StepSensor"\)/.test(module) && /requireOptionalNativeModule\("StepSensor"\)/.test(js), "the two sides use the same name");

  // Every function the JS calls exists on the native side.
  for (const name of ["isAvailable", "hasPermission", "readNow", "startRecording", "stopRecording", "isRecording", "readSnapshots", "trimSnapshots"]) {
    assert.ok(new RegExp(`(Function|AsyncFunction)(<\\w+>)?\\("${name}"\\)`).test(module), `${name} is defined natively`);
    assert.ok(new RegExp(`native\\.${name}\\(`).test(js), `${name} is called from JS`);
  }

  // No foreground service, no background location, and nothing the manifest has to declare.
  const everything = ["StepSensorModule.kt", "StepSensorReader.kt", "StepSensorStore.kt", "StepSensorWork.kt", "StepSensorWorker.kt"].map(kotlin).join("\n");

  assert.ok(!/startForeground|ForegroundService|FOREGROUND_SERVICE|ACCESS_BACKGROUND_LOCATION|LocationManager|FusedLocation/.test(everything), "it only reads the step counter");
  assert.ok(/TYPE_STEP_COUNTER/.test(kotlin("StepSensorReader.kt")), "the cumulative counter, which keeps counting while the app is closed");
  assert.ok(/15,\s*\n?\s*TimeUnit\.MINUTES/.test(kotlin("StepSensorWork.kt")), "every fifteen minutes, the shortest WorkManager allows");
  assert.ok(/ExistingPeriodicWorkPolicy\.KEEP/.test(kotlin("StepSensorWork.kt")), "asking again changes nothing");
  assert.ok(/commit\(\)/.test(kotlin("StepSensorStore.kt")), "a reading survives the process being killed");
  assert.ok(/work-runtime/.test(gradle));
  assert.ok(!/uses-permission|<service/.test(manifest.replace(/<!--[\s\S]*?-->/g, "")), "nothing declared natively");

  // The permission the counter needs is the app's own, asked for in JS.
  const app = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8")).expo;

  assert.ok(app.android.permissions.includes("android.permission.ACTIVITY_RECOGNITION"));
  assert.ok(!app.android.permissions.some((permission) => /FOREGROUND_SERVICE/.test(permission)), "the no-foreground-service rule still holds");
}

console.log("Step sensor: steps spread over days (midnight, long gaps), counting in batches, a restart, clamps and damaged readings, and the native module's shape.");
