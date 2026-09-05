// Until 0.21.11 the project had no babel config and ran on babel-preset-expo's
// defaults. This file keeps those defaults - the preset also injects the
// react-native-worklets plugin that Reanimated 4 needs - and adds two things.
module.exports = function (api) {
  api.cache(true);

  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // Path aliases. The deepest import in the project was nine levels of
      // "../", which is not something you can verify by looking at it, and
      // miscounting by one fails at runtime rather than at build time.
      //
      // Existing imports were deliberately not migrated: 166 of them, no tests,
      // nothing to gain. Use an alias in new code and in files a change is
      // already touching.
      //
      // module-resolver rewrites the path during transform, so Metro only ever
      // sees a relative path and needs no configuration of its own. The same
      // aliases are mirrored in tsconfig.json so editor navigation follows.
      [
        "module-resolver",
        {
          root: ["./"],
          alias: {
            "@contexts": "./src/Contexts",
            "@database": "./src/Database",
            "@repository": "./src/Repository",
            "@resources": "./src/Resources",
            "@services": "./src/Services",
            "@utils": "./src/Utils",
          },
        },
      ],
    ],
    env: {
      production: {
        // console calls are stripped from production bundles. There are ~170 of
        // them, and while none log an email, a token or a password, Supabase
        // error objects carry query details and table names into the device's
        // system log. In dev they stay, because that is where they are useful.
        //
        // error and warn survive: they are what a crash reporter would pick up.
        plugins: [
          ["transform-remove-console", { exclude: ["error", "warn"] }],
        ],
      },
    },
  };
};
