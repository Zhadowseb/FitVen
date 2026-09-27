// Guards the two ways translations quietly rot.
//
// A key added in English and forgotten in Danish shows Danish users an English
// label; a key used in a component and never added to either shows everyone
// the key itself. Neither fails at build time, and neither is seen by whoever
// wrote it, because they tested in the language they wrote. So:
//   1. en and da carry exactly the same keys, and
//   2. every t("...") / translate("...") literal in src/ and App.js exists in en.
// Plus the behaviour of translate itself: interpolation, plurals, fallback.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");
const i18n = loadAppModule("src/Localization/i18n.js");
const en = i18n.getLocaleTable("en");
const da = i18n.getLocaleTable("da");

/* ------------------------------------------------------------ key parity -- */

function isPluralForms(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    ("one" in value || "other" in value) &&
    Object.keys(value).every((key) => ["zero", "one", "other"].includes(key))
  );
}

function leafKeys(table, prefix = "") {
  const keys = [];

  for (const [key, value] of Object.entries(table ?? {})) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === "object" && !isPluralForms(value)) {
      keys.push(...leafKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys.sort();
}

const enKeys = leafKeys(en);
const daKeys = leafKeys(da);
const missingInDa = enKeys.filter((key) => !daKeys.includes(key));
const missingInEn = daKeys.filter((key) => !enKeys.includes(key));

assert.deepStrictEqual(missingInDa, [], `keys in en but not in da:\n  ${missingInDa.join("\n  ")}`);
assert.deepStrictEqual(missingInEn, [], `keys in da but not in en:\n  ${missingInEn.join("\n  ")}`);
assert.ok(enKeys.length > 0, "the English table is empty");

// Every value is a non-empty string or plural forms of non-empty strings, and
// the two languages use the same placeholders.
function placeholders(text) {
  return [...String(text).matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

function lookup(table, key) {
  return key.split(".").reduce((node, part) => node?.[part], table);
}

for (const key of enKeys) {
  const enValue = lookup(en, key);
  const daValue = lookup(da, key);
  const enForms = isPluralForms(enValue) ? Object.values(enValue) : [enValue];
  const daForms = isPluralForms(daValue) ? Object.values(daValue) : [daValue];

  for (const form of [...enForms, ...daForms]) {
    assert.ok(typeof form === "string" && form.trim().length > 0, `${key} has an empty value`);
  }

  assert.deepStrictEqual(
    isPluralForms(daValue),
    isPluralForms(enValue),
    `${key} is plural forms in one language and a string in the other`
  );
  assert.deepStrictEqual(
    placeholders(daForms.join(" ")),
    placeholders(enForms.join(" ")),
    `${key} uses different placeholders in en and da`
  );
}

/* --------------------------------------------------- keys used in the app -- */

function sourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;

    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) sourceFiles(full, out);
    else if (full.endsWith(".js")) out.push(full);
  }

  return out;
}

const files = [path.join(root, "App.js"), ...sourceFiles(path.join(root, "src"))].filter(
  (file) => !file.includes(`${path.sep}Localization${path.sep}`)
);
const usedKeys = new Map();
const KEY_CALL = /\b(?:t|translate)\(\s*["'`]([A-Za-z0-9_.]+)["'`]/g;

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");

  for (const match of source.matchAll(KEY_CALL)) {
    if (!usedKeys.has(match[1])) usedKeys.set(match[1], []);
    usedKeys.get(match[1]).push(path.relative(root, file));
  }
}

const unknownKeys = [...usedKeys.entries()].filter(([key]) => !i18n.hasTranslation(key, "en"));

assert.deepStrictEqual(
  unknownKeys.map(([key, where]) => `${key} (${[...new Set(where)].join(", ")})`),
  [],
  "t() is called with keys that exist in neither language"
);

/* ------------------------------------------------------------- behaviour -- */

assert.strictEqual(i18n.translate("common.retry", {}, "en"), "Try again");
assert.strictEqual(i18n.translate("common.retry", {}, "da"), "Prøv igen");
assert.strictEqual(i18n.translate("common.sets", { count: 1 }, "en"), "1 set");
assert.strictEqual(i18n.translate("common.sets", { count: 3 }, "en"), "3 sets");
assert.strictEqual(i18n.translate("common.reps", { count: 1 }, "da"), "1 gentagelse");
assert.strictEqual(i18n.translate("common.reps", { count: 5 }, "da"), "5 gentagelser");
assert.strictEqual(i18n.translate("time.daysAgo", { count: 2 }, "da"), "2 dage siden");
assert.strictEqual(i18n.translate("no.such.key", {}, "da"), "no.such.key", "an unknown key comes back as itself");
assert.strictEqual(i18n.translate("time.minutesShort", { count: 12 }, "en"), "12m");
assert.strictEqual(i18n.translate("time.minutesShort", {}, "en"), "{count}m", "a missing placeholder is left visible rather than blanked");

assert.strictEqual(i18n.resolveLanguage("da"), "da");
assert.strictEqual(i18n.resolveLanguage("en-GB"), "en");
assert.ok(i18n.SUPPORTED_LANGUAGES.includes(i18n.resolveLanguage("system")), "system resolves to a supported language");
assert.ok(i18n.SUPPORTED_LANGUAGES.includes(i18n.resolveLanguage("xx")), "an unknown code falls back to a supported language");
assert.strictEqual(i18n.getLocaleTag("da"), "da-DK");

/* ------------------------------------------------ workout type names -- */

// The types are stored in English; Danish users read them through
// workoutTypeLabel. A type id reaching the screen as itself is the bug this
// guards, and a name the user typed being "translated" is the opposite one.
{
  const types = loadAppModule("src/Utils/workoutTypeLabel.js");
  const inDanish = (key, params) => i18n.translate(key, params, "da");
  const inEnglish = (key, params) => i18n.translate(key, params, "en");
  // Every id the app itself knows: the icons' list and the catalog db.js
  // seeds. Read as text - the icon file imports SVG components.
  const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
  const iconIds = [
    ...read("src/Resources/Icons/WorkoutLabels/index.js").matchAll(/\bid:\s*"(\w+)"/g),
  ].map((match) => match[1]);
  const seeded = read("src/Database/db.js").match(/const DEFAULT_WORKOUT_TYPES = \[([\s\S]*?)\];/);

  assert.ok(iconIds.length >= 10 && seeded, "the workout type ids could not be read");

  const seededIds = [...seeded[1].matchAll(/\[\s*"(\w+)"/g)].map((match) => match[1]);
  const storedIds = [...new Set([...iconIds, ...seededIds])];

  assert.ok(storedIds.includes("Walk") && storedIds.includes("StrengthTraining"));

  for (const id of storedIds) {
    assert.ok(types.isWorkoutTypeId(id), `${id} is a type id`);

    for (const t of [inDanish, inEnglish]) {
      const name = types.workoutTypeLabel(id, t);

      assert.ok(name && !name.startsWith("workoutTypes."), `${id} has a name in both languages`);
    }
  }

  assert.strictEqual(types.workoutTypeLabel("Resistance", inDanish), "Styrketræning");
  assert.strictEqual(types.workoutTypeLabel("StrengthTraining", inDanish), "Styrketræning");
  assert.strictEqual(types.workoutTypeLabel("Upperbody", inDanish), "Overkrop");
  assert.strictEqual(types.workoutTypeLabel("Legs", inDanish), "Ben");
  assert.strictEqual(types.workoutTypeLabel("Run", inDanish), "Løb");
  assert.strictEqual(types.workoutTypeLabel("resistance", inDanish), "Styrketræning", "in any case");
  assert.strictEqual(types.workoutTypeLabel("Resistance", inEnglish), "Strength training");
  assert.strictEqual(types.workoutTypeLabel("Upperbody", inEnglish), "Upper body");
  assert.strictEqual(types.workoutTypeLabel("Yoga", inDanish), "Yoga", "a type the app does not know is shown as stored");
  assert.strictEqual(types.workoutTypeLabel(null, inDanish), null);
  assert.strictEqual(types.workoutTypeLabel("  ", inDanish), null);

  assert.strictEqual(
    types.workoutDisplayName("Resistance", inDanish, "Resistance"),
    "Styrketræning",
    "a workout labelled with its type id is shown by the type's name"
  );
  assert.strictEqual(
    types.workoutDisplayName("Ben dag", inDanish, "Resistance"),
    "Ben dag",
    "a name the user typed stays as typed"
  );
  assert.strictEqual(types.workoutDisplayName("Push", inDanish, "Resistance"), "Push");
  assert.strictEqual(
    types.workoutDisplayName("Upper body day", inDanish, "Upperbody"),
    "Upper body day",
    "only a label that is exactly an id is translated"
  );
  assert.strictEqual(
    types.workoutDisplayName("", inDanish, "Upperbody"),
    "Overkrop",
    "no label: the type's name"
  );
  assert.strictEqual(types.workoutDisplayName(null, inDanish, null), null, "neither: the caller's fallback");
}

let notified = null;
const unsubscribe = i18n.subscribeToLanguage((language) => {
  notified = language;
});

i18n.setLanguage("da");
assert.strictEqual(notified, "da", "subscribers hear about a language change");
assert.strictEqual(i18n.translate("common.cancel"), "Annuller", "translate follows the current language");
unsubscribe();
i18n.setLanguage("en");

console.log(`Localization: ${enKeys.length} keys in step across en and da, ${usedKeys.size} keys used in the app, all present.`);
