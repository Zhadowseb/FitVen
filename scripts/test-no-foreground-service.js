// The one Android foreground service and the one background location task
// this app runs are a Walk's, and nothing else may have them.
//
// Google Play held a production release until FOREGROUND_SERVICE_LOCATION was
// declared with a demo video, so the service came out (PR #313) and Run and
// Walk were left without tracking. A Walk tracks with the screen off now, and
// the declaration is the owner's to make in Play Console, which is why this
// guard is not simply gone: it still forbids a foreground service or
// background location for Run and for anything outside the walk, and it
// allows exactly the walk's. Without the permission, starting a location
// foreground service crashes on Android 14+, and with the wrong ones Play asks
// for a second declaration, so this guards the manifest side (app.json and
// expo-location's service) and the code side (src/).

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");

/* ------------------------------------------------------------- app.json -- */

const appJson = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8"));
const android = appJson.expo.android;
const permissions = android.permissions ?? [];
const blocked = android.blockedPermissions ?? [];

// The two FOREGROUND_SERVICE permissions come from expo-location's plugin
// (isAndroidForegroundServiceEnabled), not from the list here, and they must
// not be blocked: a blocked permission is a service that crashes on start.
assert.deepStrictEqual(
  permissions.filter((permission) => /FOREGROUND_SERVICE|ACCESS_BACKGROUND_LOCATION/.test(permission)),
  [],
  "app.json lists no foreground service or background location permission by hand"
);
assert.strictEqual(new Set(permissions).size, permissions.length, "app.json lists a permission twice");
assert.deepStrictEqual(
  blocked.filter((permission) => /FOREGROUND_SERVICE/.test(permission)),
  [],
  "app.json must not block the permissions the walk's service needs"
);
assert.ok(
  blocked.includes("android.permission.ACCESS_BACKGROUND_LOCATION"),
  "app.json must block ACCESS_BACKGROUND_LOCATION, so no library adds it: a foreground service on when-in-use location is all the walk needs, and Play asks for a different, harder declaration for background location"
);

const locationPlugin = appJson.expo.plugins.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === "expo-location"
);
assert.ok(locationPlugin, "the expo-location plugin is configured in app.json");
assert.strictEqual(locationPlugin[1].isAndroidForegroundServiceEnabled, true, "the walk's service needs its permissions");
assert.strictEqual(locationPlugin[1].isAndroidBackgroundLocationEnabled, false, "but not background location");
assert.strictEqual(locationPlugin[1].isIosBackgroundLocationEnabled, true, "iOS needs UIBackgroundModes: location");
assert.ok(
  /screen off/i.test(locationPlugin[1].locationAlwaysAndWhenInUsePermission ?? ""),
  "the purpose string App Review reads for background location says what it is for"
);
assert.ok(/screen off/i.test(locationPlugin[1].locationWhenInUsePermission));
assert.ok(/screen off/i.test(appJson.expo.ios.infoPlist.NSLocationWhenInUseUsageDescription));
assert.ok(
  !appJson.expo.plugins.some((plugin) => /withoutLocationForegroundService/.test(String(Array.isArray(plugin) ? plugin[0] : plugin))),
  "nothing strips expo-location's service from the merged manifest any more"
);
assert.ok(
  !fs.existsSync(path.join(root, "plugins/withoutLocationForegroundService.js")),
  "and the plugin that did is gone"
);

// Android 14 refuses a foreground service that does not declare its type. The
// service is the one in expo-location's own manifest, which is what the merged
// release manifest gets it from; no other service declares a foreground type.
{
  const manifestFile = path.join(root, "node_modules/expo-location/android/src/main/AndroidManifest.xml");
  const manifest = fs.readFileSync(manifestFile, "utf8");
  const service = manifest.match(/<service\b[^>]*LocationTaskService[^>]*>/s);

  assert.ok(service, "expo-location declares LocationTaskService");
  assert.ok(
    /android:foregroundServiceType="location"/.test(service[0]),
    "LocationTaskService declares the foreground service type location"
  );
  assert.ok(/android:exported="false"/.test(service[0]), "and is not exported");
}

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

const LOCATION_SERVICE = "src/Services/locationService.js";
const WALK_TASK_FILE = "src/Services/walkLocationTask.js";
const WALK_TRACKER = "src/Services/walkTrackerService.js";

// What may exist nowhere, and what may exist in exactly one file.
const forbiddenEverywhere = [
  { pattern: /\brequestBackgroundPermissionsAsync\b/, what: "requestBackgroundPermissionsAsync (the walk runs on when-in-use)" },
  { pattern: /\bstartForeground(Service)?\b/, what: "startForeground" },
  { pattern: /\bstartGeofencingAsync\b/, what: "startGeofencingAsync" },
];
const onlyIn = [
  { pattern: /\bstartLocationUpdatesAsync\b/, what: "startLocationUpdatesAsync", file: LOCATION_SERVICE },
  { pattern: /\bforegroundService\s*:/, what: "a foregroundService option", file: LOCATION_SERVICE },
  { pattern: /expo-task-manager/, what: "expo-task-manager", file: WALK_TASK_FILE },
  { pattern: /\bdefineTask\b/, what: "defineTask", file: WALK_TASK_FILE },
];

const offenders = [];
const files = [...listSourceFiles(path.join(root, "src")), path.join(root, "App.js")];
const sources = new Map();

for (const file of files) {
  const relative = path.relative(root, file).replace(/\\/g, "/");
  const code = stripComments(fs.readFileSync(file, "utf8"));

  sources.set(relative, code);

  for (const { pattern, what } of forbiddenEverywhere) {
    if (pattern.test(code)) {
      offenders.push(`${relative}: ${what}`);
    }
  }

  for (const { pattern, what, file: allowed } of onlyIn) {
    if (pattern.test(code) && relative !== allowed) {
      offenders.push(`${relative}: ${what} (only ${allowed} may have it)`);
    }
  }
}

assert.deepStrictEqual(offenders, [], `found in src/:\n  ${offenders.join("\n  ")}`);

// The one service is the walk's: one start, for one task, and only the walk
// tracker asks for it.
{
  const locationCode = sources.get(LOCATION_SERVICE);
  const starts = [...locationCode.matchAll(/\bstartLocationUpdatesAsync\(\s*([A-Za-z_.]+)/g)].map((match) => match[1]);

  assert.deepStrictEqual(starts, ["WALK_LOCATION_TASK"], "locationService starts one location task, the walk's");
  assert.strictEqual(
    [...locationCode.matchAll(/\bforegroundService\s*:/g)].length,
    1,
    "and gives one task a foreground service"
  );

  const callers = [...sources].filter(
    ([relative, code]) => relative !== LOCATION_SERVICE && /\bstartWalkTracking\b/.test(code)
  );

  assert.deepStrictEqual(
    callers.map(([relative]) => relative),
    [WALK_TRACKER],
    "only the walk tracker starts the walk's tracking"
  );
  assert.ok(!/\bstartRunTracking\b/.test(sources.get(WALK_TRACKER)), "and the walk is not Run's tracking");
  assert.ok(
    /import "\.\/src\/Services\/walkLocationTask"/.test(fs.readFileSync(path.join(root, "App.js"), "utf8")),
    "App.js imports the task's definition, so it exists when the app loads"
  );
}

/* ------------------------------------------------------ locationService -- */

// Starting a run fails before any Location API is touched, and with the code
// the run screen turns into its message.
const touched = [];
const defined = [];

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
loadAppModule.stubModule("expo-task-manager", {
  defineTask: (name) => {
    defined.push(name);
  },
});

const locationService = loadAppModule("src/Services/locationService.js");
const format = loadAppModule("src/Pages/WorkoutPage/WorkoutTypes/Run/runFormatUtils.js");
const availability = loadAppModule("src/Utils/workoutTypeAvailability.js");

(async () => {
  await assert.rejects(
    locationService.startRunTracking(),
    (error) =>
      error.code === locationService.LOCATION_ERROR_CODES.RUN_TRACKING_UNAVAILABLE
  );
  assert.deepStrictEqual(touched, [], "starting a run must not call expo-location");
  assert.strictEqual(availability.isWorkoutTypeComingSoon("Run"), true, "Run is still switched off");
  assert.strictEqual(availability.isWorkoutTypeComingSoon("Walk"), false);

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

  // The startup cleanup of the old run task only ever stops it.
  await locationService.stopLegacyRunLocationTask();
  assert.deepStrictEqual(touched, ["hasStartedLocationUpdatesAsync"]);

  // The task the app defines is the walk's, and nothing else.
  loadAppModule("src/Services/walkLocationTask.js");
  assert.deepStrictEqual(defined, [locationService.WALK_LOCATION_TASK], "the app defines the walk's task only");
  assert.notStrictEqual(locationService.WALK_LOCATION_TASK, "background-location-task", "not the old run task, which is only ever stopped");

  console.log("No foreground service outside the walk checks passed.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
