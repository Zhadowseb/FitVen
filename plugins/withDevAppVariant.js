const fs = require("fs");
const path = require("path");
const { withAppBuildGradle, withDangerousMod } = require("expo/config-plugins");

// Debug-builds installeres som com.anonymous.programapp.dev, så en lokal
// dev-build aldrig kan overskrive release-appen fra Play Store.
const DEV_SUFFIX = ".dev";
const DEV_APP_NAME = "FitVen Dev";

// The ninja bundled with CMake 3.22.1 is 1.10.2 and not long-path aware, so the
// C++ codegen fails on Windows once object paths pass 260 characters.
// 3.31.6 ships ninja 1.12.1. Install it via the Android SDK Manager.
const CMAKE_VERSION = "3.31.6";

function addApplicationIdSuffix(contents) {
  if (contents.includes("applicationIdSuffix")) {
    return contents;
  }

  const debugBlock = /(buildTypes\s*\{[^\n]*\n\s*debug\s*\{[^\n]*\n)/;
  if (!debugBlock.test(contents)) {
    throw new Error(
      "withDevAppVariant: fandt ikke debug-blokken i android/app/build.gradle"
    );
  }

  return contents.replace(
    debugBlock,
    `$1            applicationIdSuffix '${DEV_SUFFIX}'\n`
  );
}

function pinCmakeVersion(contents) {
  if (contents.includes("externalNativeBuild")) {
    return contents;
  }

  const namespaceLine = /(\n\s*namespace\s+'[^']+'\n)/;
  if (!namespaceLine.test(contents)) {
    throw new Error(
      "withDevAppVariant: fandt ikke namespace-linjen i android/app/build.gradle"
    );
  }

  const block = [
    "",
    "    externalNativeBuild {",
    "        cmake {",
    "            version '" + CMAKE_VERSION + "'",
    "        }",
    "    }",
    "",
  ].join("\n");

  return contents.replace(namespaceLine, "$1" + block);
}

const withPinnedCmake = (config) =>
  withAppBuildGradle(config, (config) => {
    config.modResults.contents = pinCmakeVersion(config.modResults.contents);
    return config;
  });

const withDevApplicationId = (config) =>
  withAppBuildGradle(config, (config) => {
    config.modResults.contents = addApplicationIdSuffix(
      config.modResults.contents
    );
    return config;
  });

// app_name ligger allerede i main-source-settet, så navnet skal lægges i
// debug-source-settet, hvor det overskriver frem for at kollidere.
const withDevAppName = (config) =>
  withDangerousMod(config, [
    "android",
    (config) => {
      const valuesDir = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "src",
        "debug",
        "res",
        "values"
      );

      fs.mkdirSync(valuesDir, { recursive: true });
      fs.writeFileSync(
        path.join(valuesDir, "strings.xml"),
        `<resources>\n  <string name="app_name">${DEV_APP_NAME}</string>\n</resources>\n`
      );

      return config;
    },
  ]);

module.exports = (config) =>
  withPinnedCmake(withDevAppName(withDevApplicationId(config)));
