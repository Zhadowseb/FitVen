// The widget extension for the lock screen during a strength workout: the
// Live Activity and the Dynamic Island (@bacons/apple-targets v5).
//
// - Every file in this folder is part of the extension, except Info.plist and
//   this config. The files in _shared/ are compiled into the app as well, so
//   the buttons' LiveActivityIntents run in the app's process. Re-run
//   `npx expo prebuild` after adding, renaming or removing one there.
// - Assets.xcassets is committed by hand (the workout icon is a template SVG).
//   Nothing here uses the plugin's `images` or `colors`, which would write
//   generated files into this folder.
// - iOS 16.2 is the first with ActivityContent; the buttons need iOS 17 and
//   are left out before that.
// - The App Group is where the app and the buttons share the card's state and
//   the queue of taps. It must match ios.entitlements in app.json.

/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "widget",
  displayName: config.name,
  bundleIdentifier: ".widget",
  deploymentTarget: "16.2",
  entitlements: {
    "com.apple.security.application-groups": ["group.com.fitven.app"],
  },
});
