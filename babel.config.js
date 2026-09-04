// Until now the project had no babel config and ran on babel-preset-expo's
// defaults. This file keeps those defaults - the preset also injects the
// react-native-worklets plugin that Reanimated 4 needs - and adds one thing:
//
// console calls are stripped from production bundles. There are ~170 of them,
// and while none log an email, a token or a password, Supabase error objects
// carry query details and table names into the device's system log. In dev
// they stay, because that is where they are useful.
module.exports = function (api) {
  api.cache(true);

  return {
    presets: ["babel-preset-expo"],
    env: {
      production: {
        // error and warn survive: they are what a crash reporter would pick up.
        plugins: [
          ["transform-remove-console", { exclude: ["error", "warn"] }],
        ],
      },
    },
  };
};
