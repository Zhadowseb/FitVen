// The app must not run an Android foreground service or ask for background
// location.
//
// Google Play refused a production release until the app declared its use of
// FOREGROUND_SERVICE_LOCATION, with a demo video. The only user was GPS
// tracking for Run and Walk, which can no longer be started, so the service
// and its permissions went instead. Without the permission, starting a
// location foreground service crashes on Android 14+, so this guards both the
// manifest side (app.json) and the code side (src/).

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");

// expo-location's own manifest declares LocationTaskService with
// foregroundServiceType="location"; plugins/withoutLocationForegroundService
// removes it from the merged manifest, so Play finds no location foreground
// service. Checked against a real merged release manifest on 2026-10-04.
{
  const plugin = require(path.join(root, "plugins/withoutLocationForegroundService.js"));
  const manifest = {
    $: { "xmlns:android": "http://schemas.android.com/apk/res/android" },
    application: [{ service: [{ $: { "android:name": plugin.LOCATION_TASK_SERVICE } }, { $: { "android:name": "other.Service" } }] }],
  };
  const result = plugin.removeLocationTaskService(manifest);
  const services = result.application[0].service;
  assert.strictEqual(result.$["xmlns:tools"], "http://schemas.android.com/tools", "the tools namespace is declared");
  assert.deepStrictEqual(
    services.filter((service) => service.$["android:name"] === plugin.LOCATION_TASK_SERVICE).map((service) => service.$["tools:node"]),
    ["remove"],
    "LocationTaskService is removed from the merged manifest, once"
  );
  assert.ok(services.some((service) => service.$["android:name"] === "other.Service"), "other services stay");
  const plugins = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8")).expo.plugins;
  assert.ok(plugins.includes("./plugins/withoutLocationForegroundService"), "app.json runs the plugin");
}

/* ------------------------------------------------------------- app.json -- */

const appJson = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8"));
const android = appJson.expo.android;
const permissions = android.permissions ?? [];
const blocked = android.blockedPermissions ?? [];

assert.deepStrictEqual(
  permissions.filter((permission) => /FOREGROUND_SERVICE/.test(permission)),
  [],
  "app.json must not request any FOREGROUND_SERVICE permission"
);
assert.deepStrictEqual(
  permissions.filter((permission) => /ACCESS_BACKGROUND_LOCATION/.test(permission)),
  [],
  "app.json must not request background location"
);
assert.strictEqual(
  new Set(permissions).size,
  permissions.length,
  "app.json lists a permission twice"
);
for (const permission of [
  "android.permission.FOREGROUND_SERVICE_LOCATION",
  "android.permission.FOREGROUND_SERVICE",
]) {
  assert.ok(
    blocked.includes(permission),
    `app.json must block ${permission}, so no library can add it back`
  );
}

const locationPlugin = appJson.expo.plugins.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === "expo-location"
);
assert.ok(locationPlugin, "the expo-location plugin is configured in app.json");
assert.strictEqual(locationPlugin[1].isAndroidForegroundServiceEnabled, false);
assert.strictEqual(locationPlugin[1].isAndroidBackgroundLocationEnabled, false);
assert.strictEqual(locationPlugin[1].isIosBackgroundLocationEnabled, false);

/* ----------------------------------------------------------------- src/ -- */

function listSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);

    if (entry.isDirectory()) return listSourceFiles(full);
    return /\.(js|jsx|ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

// Comments may explain the history; only code counts.
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const forbidden = [
  { pattern: /\bforegroundService\s*:/, what: "a foregroundService option" },
  { pattern: /\bstartLocationUpdatesAsync\b/, what: "startLocationUpdatesAsync" },
  { pattern: /\brequestBackgroundPermissionsAsync\b/, what: "requestBackgroundPermissionsAsync" },
  { pattern: /\bstartForeground(Service)?\b/, what: "startForeground" },
  { pattern: /expo-task-manager/, what: "expo-task-manager" },
];

const offenders = [];
const files = [...listSourceFiles(path.join(root, "src")), path.join(root, "App.js")];

for (const file of files) {
  const code = stripComments(fs.readFileSync(file, "utf8"));

  for (const { pattern, what } of forbidden) {
    if (pattern.test(code)) {
      offenders.push(`${path.relative(root, file)}: ${what}`);
    }
  }
}

assert.deepStrictEqual(offenders, [], `found in src/:\n  ${offenders.join("\n  ")}`);

/* ------------------------------------------------------ locationService -- */

// Starting a run fails before any Location API is touched, and with the code
// the run screen turns into its message.
const touched = [];
loadAppModule.stubModule(
  "expo-location",
  new Proxy(
    {},
    {
      get(_, name) {
        return async () => {
          touched.push(String(name));
          return false;
        };
      },
    }
  )
);

const locationService = loadAppModule("src/Services/locationService.js");
const format = loadAppModule("src/Pages/WorkoutPage/WorkoutTypes/Run/runFormatUtils.js");

(async () => {
  await assert.rejects(
    locationService.startRunTracking(),
    (error) =>
      error.code === locationService.LOCATION_ERROR_CODES.RUN_TRACKING_UNAVAILABLE
  );
  assert.deepStrictEqual(touched, [], "starting a run must not call expo-location");

  const message = format.getRunTrackingStartMessage(
    { code: locationService.LOCATION_ERROR_CODES.RUN_TRACKING_UNAVAILABLE },
    "walk"
  );
  assert.ok(/walk/.test(message), "the message names the activity");
  assert.notStrictEqual(
    message,
    format.getRunTrackingStartMessage(new Error("other")),
    "the switched-off case has its own message, not the generic one"
  );

  // The startup cleanup only ever stops a task an older build left running.
  await locationService.stopLegacyRunLocationTask();
  assert.deepStrictEqual(touched, ["hasStartedLocationUpdatesAsync"]);

  console.log("No foreground service checks passed.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
