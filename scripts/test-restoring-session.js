// The restoring-session splash: that it is what the app shows while it really
// waits, that its text goes through the translation system in both languages,
// that its colours come from the theme and not from the file, and that it
// respects "Reduce motion". Nothing here renders it - there is no device in
// the tests - so the first look at it on a phone is still to be had.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const projectRequire = createRequire(path.join(root, "package.json"));
const babel = projectRequire("@babel/core");

const component = read("src/Resources/Components/RestoringSession/RestoringSession.js");
const style = read("src/Resources/Components/RestoringSession/RestoringSessionStyle.js");
const app = read("App.js");

// Both files parse as the app's JSX.
for (const [name, source] of [["RestoringSession.js", component], ["RestoringSessionStyle.js", style]]) {
  assert.doesNotThrow(
    () => babel.parseSync(source, { filename: name, presets: [projectRequire.resolve("babel-preset-expo")] }),
    `${name} parses`
  );
}

// --- It is shown for as long as the app waits, and on no timer ---------------
assert.strictEqual((app.match(/<RestoringSession \/>/g) ?? []).length, 2, "both places that waited for the session show it");
assert.ok(
  /if \(isAuthLoading \|\| isThemeLoading \|\| isLanguageLoading\) \{\s*return <RestoringSession \/>;/.test(app),
  "the real loading flags decide, not a fixed delay"
);
assert.ok(!/Restoring session\.\.\./.test(app), "the old plain text is gone, in English and hard-coded");
const appBranch = app.slice(app.indexOf("<RestoringSession />") - 200, app.indexOf("<RestoringSession />") + 60);
assert.ok(!/setTimeout|setInterval/.test(appBranch), "no timer in App.js decides when it goes away");

// --- Its text, in both languages ----------------------------------------------
const keys = ["title", "warmingUp", "loadingPlates", "chalkingUp", "spotting"];

for (const language of ["en", "da"]) {
  const common = read(`src/Localization/locales/${language}/common.js`);
  const block = common.slice(common.indexOf("restoringSession: {"));

  for (const key of keys) {
    assert.ok(new RegExp(`${key}: "[^"]+"`).test(block.slice(0, 400)), `${language} has restoringSession.${key}`);
  }
}
for (const key of keys) {
  assert.ok(component.includes(`common.restoringSession.${key}`), `the splash reads restoringSession.${key}`);
}
assert.ok(!/(?:Warming up|Chalking up|Spotting your session|Loading the plates)/.test(component), "no text is written in the component");

// --- Colours come from the theme ---------------------------------------------
const hex = (source) => (source.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).filter((color) => color.toLowerCase() !== "#000");

assert.deepStrictEqual(hex(component), [], "the component has no colour of its own");
assert.deepStrictEqual(hex(style), [], "and the style file holds layout, with only the shadow's black");
assert.ok(/useColorScheme\(\)/.test(component) && /theme\.primary/.test(component), "the colours are read from the theme, inline");
assert.ok(!/rgba?\(/.test(component + style), "no rgba of its own either: the track is the theme's border");

// --- Motion and accessibility --------------------------------------------------
assert.ok(!/useNativeDriver:\s*false/.test(component), "every animation is on the native driver");
assert.ok((component.match(/useNativeDriver: true/g) ?? []).length >= 4, "the lift, the sweep and the two fades");
assert.ok(/isReduceMotionEnabled/.test(component) && /reduceMotionChanged/.test(component), "it asks for Reduce motion, and follows a change");
assert.ok(/if \(reduceMotion\) \{\s*lift\.setValue\(0\.5\);/.test(component), "with Reduce motion it stands on one still frame");
assert.ok(/if \(reduceMotion\) \{\s*return undefined;\s*\}\s*const id = setInterval/.test(component), "and the message does not cycle");
assert.ok(/clearInterval\(id\)/.test(component) && /lifting\.stop\(\)/.test(component), "everything it starts is stopped on unmount");
assert.ok(/accessibilityRole="progressbar"/.test(component) && /accessibilityLabel=\{shownTitle\}/.test(component), "it is a progress bar with the title as its label");
assert.ok(/no-hide-descendants/.test(component) && /accessibilityElementsHidden/.test(component), "the barbell is hidden from screen readers, on Android and iOS");

// --- Nothing new to install ---------------------------------------------------
assert.ok(!/from "(?!react"|react-native"|@localization"|\.\.?\/)[^"]+"/.test(component), "only react, react-native, the translation hook and the app's own files");

console.log(
  "Restoring session: shown for the real loading flags in both places, no timer; text in en and da; colours from the theme; native driver, Reduce motion and screen readers handled."
);
