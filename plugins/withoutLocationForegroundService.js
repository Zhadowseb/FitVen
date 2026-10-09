const { withAndroidManifest } = require("expo/config-plugins");

// expo-location's own manifest declares LocationTaskService with
// foregroundServiceType="location". FitVen no longer tracks runs, so nothing
// starts it, and the FOREGROUND_SERVICE permissions are blocked in app.json.
// The service is removed from the merged manifest as well, so Google Play
// finds no location foreground service to ask a declaration for.
const LOCATION_TASK_SERVICE = "expo.modules.location.services.LocationTaskService";

function removeLocationTaskService(manifest) {
  manifest.$ = manifest.$ ?? {};
  manifest.$["xmlns:tools"] = manifest.$["xmlns:tools"] ?? "http://schemas.android.com/tools";

  const application = manifest.application?.[0];

  if (!application) {
    return manifest;
  }

  const services = (application.service ?? []).filter(
    (service) => service.$?.["android:name"] !== LOCATION_TASK_SERVICE
  );

  services.push({
    $: {
      "android:name": LOCATION_TASK_SERVICE,
      "tools:node": "remove",
    },
  });
  application.service = services;

  return manifest;
}

const withoutLocationForegroundService = (config) =>
  withAndroidManifest(config, (modConfig) => {
    modConfig.modResults.manifest = removeLocationTaskService(modConfig.modResults.manifest);
    return modConfig;
  });

module.exports = withoutLocationForegroundService;
module.exports.removeLocationTaskService = removeLocationTaskService;
module.exports.LOCATION_TASK_SERVICE = LOCATION_TASK_SERVICE;
