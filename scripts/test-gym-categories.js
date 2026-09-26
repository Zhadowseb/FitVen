// Centres worldwide and the four categories they are ranked in.
//
// Five parts:
//   1. the vocabulary the screens and the service share (Utils/gymCategories.js);
//   2. the importer's region helper, held against the migration's own
//      postal-code ranges for every four-digit code there is;
//   3. the service, run for real against a fake Supabase and a fake
//      expo-location: what it sends, and what it makes of every shape that
//      comes back - and of the answers a database without the migration gives;
//   4. the migration read as text: the rules it promises, and who may call
//      what. Nothing here talks to a database, so these are a floor, not a
//      proof - the migration was also run twice against Postgres 17 with a
//      stub of the project and checked row by row (see its header);
//   5. how a category is written (Utils/categoryFormat.js), which a centre's
//      card and the page it opens share: the numbers, units and lines in both
//      languages, the colour as text in every accent theme, and that both
//      screens go through it.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");
// Line endings differ between files and checkouts; the checks read \n.
const read = (file) => fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");
const MIGRATION_FILE = "supabase/migrations/20260929090000_gym-scope-and-categories.sql";
const migration = read(MIGRATION_FILE);

/* ------------------------------------------------------ the test doubles -- */

const fake = {
  rpcs: {},
  rpcCalls: [],
  // Every call of the run, never reset: the last check compares them with the migration.
  history: [],
  queries: [],
  onQuery: () => ({ data: [], error: null }),
  signed: [],
};

function createQuery(table) {
  const query = { table, calls: [], mode: "many" };
  const builder = {};

  for (const method of ["select", "or", "eq", "in", "order", "limit"]) {
    builder[method] = (...args) => {
      query.calls.push([method, ...args]);
      return builder;
    };
  }

  builder.maybeSingle = () => {
    query.mode = "maybe";
    return builder;
  };
  builder.then = (resolve, reject) => Promise.resolve().then(() => fake.onQuery(query)).then(resolve, reject);
  fake.queries.push(query);

  return builder;
}

const fakeSupabase = {
  rpc: async (name, params) => {
    fake.rpcCalls.push({ name, params });
    fake.history.push({ name, params });
    const handler = fake.rpcs[name];

    return handler ? handler(params) : { data: null, error: { code: "PGRST202", message: `Could not find the function public.${name}` } };
  },
  from: (table) => createQuery(table),
  storage: {
    from: () => ({
      createSignedUrls: async (paths) => {
        fake.signed.push(...paths);
        return { data: paths.map((p) => ({ path: p, signedUrl: `https://signed.test/${p}?token=1` })), error: null };
      },
    }),
  },
  auth: {
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    getSession: async () => ({ data: { session: null }, error: null }),
  },
};

const location = {
  permission: { granted: false, canAskAgain: false },
  position: null,
  places: [],
  geocodeError: null,
  positionCalls: 0,
  geocodeCalls: 0,
};

const fakeLocation = {
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: async () => location.permission,
  requestForegroundPermissionsAsync: async () => location.permission,
  hasServicesEnabledAsync: async () => true,
  getCurrentPositionAsync: async () => {
    location.positionCalls += 1;
    return location.position;
  },
  getLastKnownPositionAsync: async () => null,
  reverseGeocodeAsync: async () => {
    location.geocodeCalls += 1;
    if (location.geocodeError) throw location.geocodeError;
    return location.places;
  },
};

loadAppModule.stubModule("@supabase/supabase-js", { createClient: () => fakeSupabase, processLock: () => {} });
loadAppModule.stubModule("react-native", { Platform: { OS: "web" }, I18nManager: {}, NativeModules: {} });
loadAppModule.stubModule("react-native-url-polyfill/auto", {});
loadAppModule.stubModule("expo-sqlite/localStorage/install", {});
loadAppModule.stubModule("expo-secure-store", {});
loadAppModule.stubModule("@react-native-async-storage/async-storage", { __esModule: true, default: {} });
loadAppModule.stubModule("expo-location", fakeLocation);

const categories = loadAppModule("src/Utils/gymCategories.js");
const format = loadAppModule("src/Utils/categoryFormat.js");
const colors = loadAppModule("src/Resources/GlobalStyling/colors.js");
const i18n = loadAppModule("src/Localization/i18n.js");
const service = loadAppModule("src/Services/categoryLeaderboardService.js");
const { MAX_ESTIMATE_REPS } = loadAppModule("src/Utils/oneRepMaxUtils.js");
const regions = require("./import-gyms/regions");
const { normalizeGym } = require("./import-gyms/normalizeGym");

// The service warns once when the migration is missing, and on every read it
// cannot explain; the test reads the warnings rather than printing them.
const warnings = [];
console.warn = (...args) => warnings.push(args.map(String).join(" "));

/* ---------------------------------------------------------- 1. the vocabulary -- */

{
  const { normalizeScope, scopeKey } = categories;

  assert.deepStrictEqual(normalizeScope({ level: "world", country: "DK", gymId: 3 }), { level: "world" }, "the world needs nothing");
  assert.deepStrictEqual(normalizeScope({ level: "country", country: " se " }), { level: "country", country: "SE" });
  assert.deepStrictEqual(normalizeScope({ level: "country", country: "Denmark" }), { level: "country", country: "DK" }, "a name is not a code");
  assert.deepStrictEqual(normalizeScope({ level: "region", country: "dk", region: " fyn " }), { level: "region", country: "DK", region: "fyn" });
  assert.deepStrictEqual(normalizeScope({ level: "region", country: "DK" }), { level: "country", country: "DK" }, "a region level without a region is its country");
  assert.deepStrictEqual(normalizeScope({ level: "gym", gymId: "12" }), { level: "gym", gymId: 12 });
  assert.deepStrictEqual(normalizeScope({ level: "gym", gymId: 0 }), { level: "country", country: "DK" });
  assert.deepStrictEqual(normalizeScope({ level: "moon" }), { level: "country", country: "DK" });
  assert.deepStrictEqual(normalizeScope(undefined), { level: "country", country: "DK" });

  assert.strictEqual(scopeKey({ level: "world" }), "world");
  assert.strictEqual(scopeKey({ level: "country", country: "se" }), "country:SE");
  assert.strictEqual(scopeKey({ level: "region", country: "DK", region: "fyn" }), "region:DK:fyn");
  assert.strictEqual(scopeKey({ level: "gym", gymId: 7 }), "gym:7");

  const { normalizeCategoryFilters } = categories;

  assert.deepStrictEqual(normalizeCategoryFilters("flid"), { tab: "workouts", period: "month", ageGroup: "all" });
  assert.deepStrictEqual(
    normalizeCategoryFilters("flid", { tab: "streak", period: "year", ageGroup: "40+", onlyVideo: true }),
    { tab: "streak", period: "year", ageGroup: "40+" },
    "flid keeps only its own filters"
  );
  assert.deepStrictEqual(normalizeCategoryFilters("powerlifting", { onlyVideo: "yes", ageGroup: "u23" }), { ageGroup: "u23", onlyVideo: false }, "only video is true or nothing");
  assert.deepStrictEqual(normalizeCategoryFilters("fremgang", { tab: "squat", ageGroup: "u23" }), { tab: "squat" }, "progress has no age filter");
  assert.deepStrictEqual(normalizeCategoryFilters("fremgang", { tab: "curl" }), { tab: "all" });
  assert.deepStrictEqual(normalizeCategoryFilters("calisthenics", { ageGroup: "65+" }), { ageGroup: "all" });
  assert.deepStrictEqual(normalizeCategoryFilters("running"), {});

  assert.strictEqual(categories.normalizeGender("women"), "women");
  assert.strictEqual(categories.normalizeGender("female"), "all", "the filter speaks men and women; the server speaks male and female");
  assert.strictEqual(categories.normalizeCategory("fremgang"), "fremgang");
  assert.strictEqual(categories.normalizeCategory("Flid"), null);
  assert.deepStrictEqual(
    categories.CATEGORY_KEYS.map(categories.categoryToneToken),
    ["secondary", "record", "primary", "music"]
  );

  assert.strictEqual(categories.podiumName("Anna Holm"), "Anna H.");
  assert.strictEqual(categories.podiumName("  anna   maria holm "), "anna H.");
  assert.strictEqual(categories.podiumName("Bo"), "Bo");
  assert.strictEqual(categories.podiumName(null), "");
  assert.strictEqual(categories.regionInitials("Sjælland"), "SJ");
  assert.strictEqual(categories.regionInitials("Ærø"), "ÆR");
  assert.strictEqual(categories.regionInitials("  "), "");

  // Every label the helpers can name exists in both languages.
  const keys = [
    ...categories.CATEGORY_KEYS.flatMap((category) => [categories.categoryNameKey(category), categories.categoryDescriptionKey(category)]),
    ...categories.GENDERS.map(categories.genderLabelKey),
    ...categories.AGE_GROUPS.map(categories.ageGroupLabelKey),
    ...categories.FLID_PERIODS.map(categories.periodLabelKey),
    ...categories.FLID_TABS.map(categories.flidTabLabelKey),
    ...categories.FREMGANG_TABS.map(categories.fremgangTabLabelKey),
    categories.countryNameKey("dk"),
    categories.countryWhereKey("DK"),
    "category.weightClasses.all",
    "category.onlyVideo",
    "category.notIn",
    "category.notInFilter",
    "categoryService.errors.offline",
    "categoryService.errors.generic",
    "categoryService.errors.searchFailed",
  ];

  for (const key of keys) {
    for (const language of ["en", "da"]) {
      assert.ok(i18n.hasTranslation(key, language), `${key} is missing in ${language}`);
    }
  }

  assert.strictEqual(categories.BODY_WEIGHT_AVAILABLE, false, "there is no body weight to class by yet");
  assert.strictEqual(categories.PROGRESS_MAX_REPS, MAX_ESTIMATE_REPS, "progress estimates as far as the rest of the app does");
}

/* ------------------------------------------------------ 2. the importer -- */

{
  const { dkRegionForPostalCode, placeOf, normalizeCountryCode } = regions;

  assert.strictEqual(dkRegionForPostalCode("2200"), "sjaelland");
  assert.strictEqual(dkRegionForPostalCode(" 3700 "), "bornholm");
  assert.strictEqual(dkRegionForPostalCode("3799"), "bornholm");
  assert.strictEqual(dkRegionForPostalCode("3800"), "sjaelland", "the Faroese range stays with Zealand; no centre is there");
  assert.strictEqual(dkRegionForPostalCode("4800"), "sjaelland", "Lolland-Falster is Zealand");
  assert.strictEqual(dkRegionForPostalCode("5000"), "fyn");
  assert.strictEqual(dkRegionForPostalCode("6000"), "jylland");
  assert.strictEqual(dkRegionForPostalCode("9999"), "jylland");
  assert.strictEqual(dkRegionForPostalCode("0800"), null, "post boxes have no landsdel");
  assert.strictEqual(dkRegionForPostalCode("21000"), null);
  assert.strictEqual(dkRegionForPostalCode("DK-2100"), null);
  assert.strictEqual(dkRegionForPostalCode(null), null);
  assert.strictEqual(normalizeCountryCode(" dk "), "DK");
  assert.strictEqual(normalizeCountryCode("Danmark"), null);

  assert.deepStrictEqual(placeOf({ country: "DK", postalCode: "5000" }), { country_code: "DK", region_key: "fyn" });
  assert.deepStrictEqual(placeOf({ postalCode: "8000" }), { country_code: "DK", region_key: "jylland" }, "no country is Denmark");
  assert.deepStrictEqual(placeOf({ country: "se", postalCode: "11122" }), { country_code: "SE", region_key: null }, "only Denmark is derived");
  assert.deepStrictEqual(placeOf({ country: "SE", regionKey: " Stockholm " }), { country_code: "SE", region_key: "stockholm" }, "a scraper's own region wins");
  assert.strictEqual(placeOf({ country: "Denmark", postalCode: "2200" }), null, "a country that is not a code is not guessed");

  const row = normalizeGym({
    chain: "PureGym",
    name: "Gentofte, Kildeskovshallen",
    address: { street: "Adolphsvej 25", postal_code: "2820", city: "Gentofte", country: "DK" },
    location: { latitude: 55.74, longitude: 12.55 },
  });
  assert.strictEqual(row.country_code, "DK");
  assert.strictEqual(row.region_key, "sjaelland");
  assert.strictEqual(
    normalizeGym({ chain: "X", name: "Y", address: { country: "Sverige" }, location: { latitude: 1, longitude: 2 } }),
    null,
    "a centre in no known country is skipped"
  );

  // The migration's backfill, read line by line, against the helper - for
  // every four-digit code there is, in the migration's first-match order.
  const ranges = [...migration.matchAll(/when coded\.code between (\d+) and (\d+) then '(\w+)'/g)].map((match) => ({
    from: Number(match[1]),
    to: Number(match[2]),
    region: match[3],
  }));

  assert.deepStrictEqual(
    ranges,
    regions.DK_POSTAL_REGIONS,
    "the migration's postal-code ranges and scripts/import-gyms/regions.js must be the same, in the same order"
  );
  assert.ok(migration.includes("btrim(gym.postal_code) ~ '^[0-9]{4}$'"), "the backfill only reads four-digit codes");
  assert.ok(migration.includes("and gym.region_key is null"), "the backfill never overwrites a region");
  assert.ok(/and coded\.code between 1000 and 9999;/.test(migration), "the backfill leaves codes below 1000 alone");

  const sqlRegionFor = (code) => {
    if (!/^\d{4}$/.test(code) || Number(code) < 1000) return null;
    return ranges.find((range) => Number(code) >= range.from && Number(code) <= range.to)?.region ?? null;
  };

  for (let code = 0; code <= 9999; code += 1) {
    const text = String(code).padStart(4, "0");
    assert.strictEqual(dkRegionForPostalCode(text), sqlRegionFor(text), `postal code ${text}`);
  }

  // The four keys are the ones the migration seeds, in its order.
  const seeded = [...migration.matchAll(/\('DK', '(\w+)', '[^']+', '[^']+', '[^']+', '[^']+', (\d+)\)/g)].map((match) => match[1]);
  assert.deepStrictEqual(seeded, ["sjaelland", "jylland", "fyn", "bornholm"]);
  assert.deepStrictEqual([...new Set(regions.DK_POSTAL_REGIONS.map((range) => range.region))].sort(), [...seeded].sort());

  // Over the real data, when it is there: every centre is Danish and lands in a region.
  const dataDir = path.join(root, "data", "gyms");

  if (fs.existsSync(dataDir)) {
    let centres = 0;

    for (const chainFolder of fs.readdirSync(dataDir, { withFileTypes: true })) {
      if (!chainFolder.isDirectory()) continue;

      for (const entry of fs.readdirSync(path.join(dataDir, chainFolder.name), { withFileTypes: true })) {
        const infoPath = path.join(dataDir, chainFolder.name, entry.name, "info.json");

        if (!entry.isDirectory() || !fs.existsSync(infoPath)) continue;

        const centre = normalizeGym(JSON.parse(fs.readFileSync(infoPath, "utf8")), { folderName: entry.name, chainFolder: chainFolder.name });

        assert.strictEqual(centre?.country_code, "DK", `${infoPath} is Danish`);
        assert.ok(centre.region_key, `${infoPath} (${centre.postal_code}) lands in a region`);
        centres += 1;
      }
    }

    assert.ok(centres > 300, "the real data was read");
  }
}

/* --------------------------------------------------------- 3. the service -- */

const ANNA = "a0000000-0000-4000-8000-000000000001";
const BO = "b0000000-0000-4000-8000-000000000002";

function reset() {
  fake.rpcs = {};
  fake.rpcCalls = [];
  fake.queries = [];
  fake.onQuery = () => ({ data: [], error: null });
  fake.signed = [];
  warnings.length = 0;
}

const lastRpc = (name) => fake.rpcCalls.filter((call) => call.name === name).pop();

async function testSummary() {
  reset();
  i18n.setLanguage("da");
  fake.rpcs.gym_scope_summary = () => ({
    data: {
      level: "world",
      countries: [
        { code: "DK", gym_count: 365, lifter_count: "42", is_yours: true },
        { code: "se", gym_count: 1, lifter_count: 1, is_yours: false },
        { code: "Denmark", gym_count: 1, lifter_count: 1 },
      ],
    },
    error: null,
  });

  assert.deepStrictEqual(await service.getScopeSummary({ scope: { level: "world" } }), {
    level: "world",
    countries: [
      { code: "DK", gymCount: 365, lifterCount: 42, isYours: true },
      { code: "SE", gymCount: 1, lifterCount: 1, isYours: false },
    ],
  });
  assert.deepStrictEqual(lastRpc("gym_scope_summary").params, { p_level: "world", p_country: null, p_region: null, p_gym_id: null });

  const zealand = { key: "sjaelland", name_da: "Sjælland", name_en: "Zealand", where_da: "på Sjælland", where_en: "on Zealand" };
  fake.rpcs.gym_scope_summary = () => ({
    data: {
      level: "country",
      country: { code: "DK", gym_count: 365, lifter_count: 40 },
      regions: [
        { ...zealand, gym_count: 186, lifter_count: 30 },
        { key: "jylland", name_da: "Jylland", name_en: "Jutland", where_da: "i Jylland", where_en: "in Jutland", gym_count: 153, lifter_count: 10 },
        { name_da: "Uden nøgle" },
      ],
    },
    error: null,
  });

  assert.deepStrictEqual(await service.getScopeSummary({ scope: { level: "country", country: "dk" } }), {
    level: "country",
    country: { code: "DK", gymCount: 365, lifterCount: 40 },
    regions: [
      { key: "sjaelland", name: "Sjælland", where: "på Sjælland", gymCount: 186, lifterCount: 30 },
      { key: "jylland", name: "Jylland", where: "i Jylland", gymCount: 153, lifterCount: 10 },
    ],
  }, "a region follows the app's language: Danish");
  assert.deepStrictEqual(lastRpc("gym_scope_summary").params, { p_level: "country", p_country: "DK", p_region: null, p_gym_id: null });

  i18n.setLanguage("en");
  const english = await service.getScopeSummary({ scope: { level: "country", country: "DK" } });
  assert.deepStrictEqual(english.regions.map((region) => [region.name, region.where]), [["Zealand", "on Zealand"], ["Jutland", "in Jutland"]], "and English");

  fake.rpcs.gym_scope_summary = () => ({
    data: {
      level: "region",
      country: { code: "DK" },
      region: { ...zealand, gym_count: 2 },
      gyms: [
        { id: "1", name: "Kbh N, Nørrebro", short_name: "Nørrebro", chain: "PureGym", city: "København N", image_url: "https://img.test/1.jpg", lifter_count: 2 },
        { id: 2, name: "Lyngby", short_name: null, chain: "SATS", city: null, image_url: null, lifter_count: null },
        { name: "no id" },
      ],
    },
    error: null,
  });

  assert.deepStrictEqual(await service.getScopeSummary({ scope: { level: "region", country: "DK", region: "sjaelland" } }), {
    level: "region",
    country: { code: "DK" },
    region: { key: "sjaelland", name: "Zealand", where: "on Zealand", gymCount: 2 },
    gyms: [
      { id: 1, name: "Kbh N, Nørrebro", shortName: "Nørrebro", chain: "PureGym", city: "København N", imageUrl: "https://img.test/1.jpg", lifterCount: 2 },
      { id: 2, name: "Lyngby", shortName: "Lyngby", chain: "SATS", city: null, imageUrl: null, lifterCount: 0 },
    ],
  });
  assert.deepStrictEqual(lastRpc("gym_scope_summary").params, { p_level: "region", p_country: "DK", p_region: "sjaelland", p_gym_id: null });

  fake.rpcs.gym_scope_summary = () => ({
    data: { level: "gym", country: { code: "DK" }, region: zealand, gym: { id: 1, name: "Kbh N, Nørrebro", short_name: "Nørrebro" } },
    error: null,
  });
  assert.deepStrictEqual(await service.getScopeSummary({ scope: { level: "gym", gymId: 1 } }), {
    level: "gym",
    country: { code: "DK" },
    region: { key: "sjaelland", name: "Zealand", where: "on Zealand" },
    gym: { id: 1, name: "Kbh N, Nørrebro", shortName: "Nørrebro" },
  });
  assert.deepStrictEqual(lastRpc("gym_scope_summary").params, { p_level: "gym", p_country: null, p_region: null, p_gym_id: 1 });

  fake.rpcs.gym_scope_summary = () => ({ data: { level: "gym", country: null, region: null, gym: null }, error: null });
  assert.deepStrictEqual(await service.getScopeSummary({ scope: { level: "gym", gymId: 9 } }), { level: "gym", country: null, region: null, gym: null }, "a centre that is not public");

  // Not signed in: the function answers null.
  fake.rpcs.gym_scope_summary = () => ({ data: null, error: null });
  assert.deepStrictEqual(await service.getScopeSummary({ scope: { level: "world" } }), { level: "world", countries: [] });

  // A database without the migration, in each of the ways it says so.
  for (const code of ["42883", "PGRST202", "PGRST204", "42P01", "PGRST205"]) {
    fake.rpcs.gym_scope_summary = () => ({ data: null, error: { code, message: "missing" } });
    assert.deepStrictEqual(
      await service.getScopeSummary({ scope: { level: "country", country: "DK" } }),
      { level: "country", country: { code: "DK", gymCount: null, lifterCount: null }, regions: [], unavailable: true },
      `${code} reads as not available yet`
    );
  }
  assert.deepStrictEqual(
    await service.getScopeSummary({ scope: { level: "region", country: "DK", region: "fyn" } }),
    { level: "region", country: { code: "DK" }, region: null, gyms: [], unavailable: true }
  );
  assert.strictEqual(warnings.filter((line) => line.includes("20260929090000")).length, 1, "the missing migration is reported once");

  fake.rpcs.gym_scope_summary = () => ({ data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } });
  await assert.rejects(
    service.getScopeSummary({ scope: { level: "world" } }),
    (error) => error.message === i18n.t("categoryService.errors.generic") && error.cause?.code === "57014",
    "anything else is a translated error that keeps the original"
  );

  i18n.setLanguage("da");
  fake.rpcs.gym_scope_summary = () => ({ data: null, error: { message: "TypeError: Network request failed" } });
  await assert.rejects(
    service.getScopeSummary({ scope: { level: "world" } }),
    (error) => error.message === "Du er offline. Prøv igen, når du har forbindelse." && error.kind === "offline",
    "offline in the reader's language"
  );
  i18n.setLanguage("en");
}

const annaUser = { id: ANNA, display_name: " Anna Holm ", username: "anna#0001", avatar_path: `${ANNA}/avatar` };
const boUser = { id: BO, display_name: null, username: "bo#0002", avatar_path: null };

async function testCards() {
  reset();
  fake.rpcs.gym_category_cards = () => ({
    data: {
      cards: [
        {
          category: "flid",
          participant_count: 6,
          top: { user: annaUser, value: 11, gym_short_name: "Nørrebro", detail: { workouts: 11, weeks: 3, last_workout_at: "2026-09-23" }, is_me: true },
          me: { rank: 1, value: 11, total: 6, in_scope: true, in_filter: true, progress: 1 },
        },
        {
          category: "powerlifting",
          participant_count: "4",
          top: { user: boUser, value: "530.00", gym_short_name: "Lyngby", detail: { bench: 120, squat: "180.00", deadlift: 230 }, is_me: false },
          me: { rank: 3, value: 160, total: 4, in_scope: true, in_filter: true, progress: 0.3019 },
        },
        {
          category: "fremgang",
          participant_count: 0,
          top: null,
          me: { rank: null, value: null, total: 0, in_scope: false, in_filter: false, progress: null },
        },
        { category: "yoga", participant_count: 99, top: null, me: null },
      ],
    },
    error: null,
  });

  const { cards, unavailable } = await service.getCategoryCards({
    scope: { level: "region", country: "DK", region: "sjaelland" },
    gender: "women",
    friendsOnly: 1,
  });

  assert.strictEqual(unavailable, undefined);
  assert.deepStrictEqual(lastRpc("gym_category_cards").params, {
    p_level: "region",
    p_country: "DK",
    p_region: "sjaelland",
    p_gym_id: null,
    p_gender: "women",
    p_friends_only: false,
  }, "friendsOnly is true or nothing");
  assert.deepStrictEqual(cards.map((card) => card.category), ["flid", "powerlifting", "fremgang"], "the server's order, unknown categories dropped");
  assert.deepStrictEqual(cards[0], {
    category: "flid",
    participantCount: 6,
    top: {
      person: {
        id: ANNA,
        displayName: "Anna Holm",
        username: "anna#0001",
        avatarPath: `${ANNA}/avatar`,
        avatarUrl: `https://signed.test/${ANNA}/avatar?token=1`,
        isMe: true,
      },
      value: 11,
      gymName: "Nørrebro",
      detail: { workouts: 11, weeks: 3, lastWorkoutAt: "2026-09-23" },
    },
    me: { rank: 1, value: 11, total: 6, inScope: true, inFilter: true, progress: 1 },
  });
  assert.deepStrictEqual(cards[1].top.person, { id: BO, displayName: "bo", username: "bo#0002", avatarPath: null, avatarUrl: null, isMe: false }, "no display name falls back to the username");
  assert.deepStrictEqual(cards[1].top.detail, { bench: 120, squat: 180, deadlift: 230, homeGymRank: null });
  assert.strictEqual(cards[1].top.value, 530);
  assert.strictEqual(cards[2].top, null);
  assert.deepStrictEqual(cards[2].me, { rank: null, value: null, total: 0, inScope: false, inFilter: false, progress: null }, "not on Funen");
  assert.deepStrictEqual(fake.signed, [`${ANNA}/avatar`], "avatars are signed in one batch, only where there is one");

  await service.getCategoryCards({ scope: { level: "gym", gymId: 4 }, gender: "female" });
  assert.strictEqual(lastRpc("gym_category_cards").params.p_gender, "all", "an unknown gender asks for everybody");

  fake.rpcs.gym_category_cards = () => ({ data: null, error: { code: "PGRST202", message: "Could not find the function" } });
  assert.deepStrictEqual(await service.getCategoryCards({ scope: { level: "country", country: "DK" } }), { cards: [], unavailable: true });

  fake.rpcs.gym_category_cards = () => ({ data: null, error: null });
  assert.deepStrictEqual(await service.getCategoryCards({ scope: { level: "country", country: "DK" } }), { cards: [] }, "signed out");
}

function listAnswer(extra = {}) {
  return {
    data: {
      category: "powerlifting",
      total: 4,
      podium: [
        { rank: 1, user: boUser, value: 530, gym_short_name: "Lyngby", detail: { bench: 120, squat: 180, deadlift: 230 }, is_me: false },
        { rank: 2, user: annaUser, value: 160, gym_short_name: "Nørrebro", detail: { bench: 60, squat: 100, deadlift: 0 }, is_me: true },
      ],
      rows: [{ rank: 4, user: { id: "x", display_name: "", username: null, avatar_path: null }, value: 50, gym_short_name: null, detail: {} }, { rank: 5 }],
      me: {
        rank: 2,
        user: annaUser,
        value: 160,
        gym_short_name: "Nørrebro",
        detail: { bench: 60, squat: 100, deadlift: 0, home_gym_rank: 2 },
        is_me: true,
        gap_to_next: 370,
        in_filter: true,
        breakdown: null,
      },
      ...extra,
    },
    error: null,
  };
}

async function testLeaderboards() {
  reset();
  fake.rpcs.gym_category_leaderboard = () => listAnswer();

  const board = await service.getCategoryLeaderboard({
    category: "powerlifting",
    scope: { level: "country", country: "DK" },
    gender: "men",
    filters: { onlyVideo: true, ageGroup: "u23", tab: "streak" },
    limit: 500,
  });

  assert.deepStrictEqual(lastRpc("gym_category_leaderboard").params, {
    p_category: "powerlifting",
    p_level: "country",
    p_country: "DK",
    p_region: null,
    p_gym_id: null,
    p_gender: "men",
    p_filters: { age_group: "u23", only_video: true },
    p_friends_only: false,
    p_limit: 100,
  }, "the filters go as the server reads them, and the limit is capped");
  assert.strictEqual(board.total, 4);
  assert.deepStrictEqual(board.podium.map((row) => [row.rank, row.person.displayName, row.value, row.gymName]), [[1, "bo", 530, "Lyngby"], [2, "Anna Holm", 160, "Nørrebro"]]);
  assert.strictEqual(board.podium[1].person.isMe, true);
  assert.deepStrictEqual(board.rows.map((row) => [row.rank, row.person.displayName, row.gymName]), [[4, i18n.t("common.member"), null]], "no name at all reads as a member; a row without a person is dropped");
  assert.deepStrictEqual(board.me, {
    rank: 2,
    person: { id: ANNA, displayName: "Anna Holm", username: "anna#0001", avatarPath: `${ANNA}/avatar`, avatarUrl: `https://signed.test/${ANNA}/avatar?token=1`, isMe: true },
    value: 160,
    gymName: "Nørrebro",
    detail: { bench: 60, squat: 100, deadlift: 0, homeGymRank: 2 },
    gapToNext: 370,
    inFilter: true,
    breakdown: null,
  });

  for (const [limit, sent] of [[0, 1], ["abc", 50], [12.7, 12], [undefined, 50]]) {
    await service.getCategoryLeaderboard({ category: "flid", scope: { level: "world" }, limit });
    assert.strictEqual(lastRpc("gym_category_leaderboard").params.p_limit, sent, `limit ${limit}`);
  }

  // Consistency: the tab decides the detail.
  fake.rpcs.gym_category_leaderboard = () => ({
    data: {
      total: 1,
      podium: [{ rank: 1, user: annaUser, value: 3, detail: { weeks: 3, last_workout_at: "2026-09-23", workouts: 99 }, is_me: true }],
      rows: [],
      me: { rank: 1, user: annaUser, value: 3, detail: { weeks: 3, last_workout_at: "2026-09-23" }, is_me: true, gap_to_next: null, in_filter: true, breakdown: null },
    },
    error: null,
  });
  const streak = await service.getCategoryLeaderboard({ category: "flid", scope: { level: "gym", gymId: 1 }, filters: { tab: "streak", period: "week", onlyVideo: true } });
  assert.deepStrictEqual(lastRpc("gym_category_leaderboard").params.p_filters, { tab: "streak", period: "week", age_group: "all" });
  assert.deepStrictEqual(streak.podium[0].detail, { weeks: 3, lastWorkoutAt: "2026-09-23" });
  assert.strictEqual(streak.me.gapToNext, null);

  const workouts = await service.getCategoryLeaderboard({ category: "flid", scope: { level: "gym", gymId: 1 } });
  assert.deepStrictEqual(workouts.podium[0].detail, { workouts: 99, weeks: 3, lastWorkoutAt: "2026-09-23" });

  // Progress: never a podium, and the personal card.
  fake.rpcs.gym_category_leaderboard = () => ({
    data: {
      total: 2,
      podium: [{ rank: 1, user: boUser, value: 15, detail: { lift: "deadlift", before: 200, now: 230, percent: 15 } }],
      rows: [
        { rank: 1, user: boUser, value: 15, detail: { lift: "deadlift", before: "200.0", now: "230.0", percent: 15 } },
        { rank: 2, user: annaUser, value: 10, detail: { lift: "curl", before: 1, now: 2, percent: 100 }, is_me: true },
      ],
      me: {
        rank: 2,
        user: annaUser,
        value: 10,
        detail: { lift: "bench", before: 56.5, now: 62, percent: 10 },
        is_me: true,
        gap_to_next: 5,
        in_filter: true,
        breakdown: { bench: { before: 56.5, now: 62, percent: 10 }, squat: null },
      },
    },
    error: null,
  });
  const progress = await service.getCategoryLeaderboard({ category: "fremgang", scope: { level: "country", country: "DK" }, filters: { tab: "bench", ageGroup: "u23" } });
  assert.deepStrictEqual(lastRpc("gym_category_leaderboard").params.p_filters, { tab: "bench" }, "progress sends no age");
  assert.deepStrictEqual(progress.podium, [], "progress has no podium, whatever arrives");
  assert.deepStrictEqual(progress.rows[0].detail, { lift: "deadlift", before: 200, now: 230, percent: 15 });
  assert.strictEqual(progress.rows[1].detail, null, "a lift that is not one of the three is no detail");
  assert.deepStrictEqual(progress.me.breakdown, { bench: { before: 56.5, now: 62, percent: 10 }, squat: null, deadlift: null });

  // Calisthenics: points, reps, and the factor an empty event still has.
  fake.rpcs.gym_category_leaderboard = () => ({
    data: {
      total: 1,
      podium: [{ rank: 1, user: annaUser, value: 90, detail: { pullups: 10, dips: "15", pushups: 30 }, is_me: true }],
      rows: [],
      me: {
        rank: 1,
        user: annaUser,
        value: 90,
        detail: { pullups: 10, dips: 15, pushups: 30 },
        is_me: true,
        gap_to_next: null,
        in_filter: false,
        breakdown: {
          pullups: { reps: 10, factor: 3, points: 30 },
          dips: { reps: 15, factor: "2", points: 30 },
          pushups: { reps: 0, factor: null, points: 0 },
        },
      },
    },
    error: null,
  });
  const calisthenics = await service.getCategoryLeaderboard({ category: "calisthenics", scope: { level: "world" }, friendsOnly: true });
  assert.strictEqual(lastRpc("gym_category_leaderboard").params.p_friends_only, true);
  assert.deepStrictEqual(calisthenics.podium[0].detail, { pullups: 10, dips: 15, pushups: 30 });
  assert.strictEqual(calisthenics.me.inFilter, false);
  assert.deepStrictEqual(calisthenics.me.breakdown, {
    pullups: { reps: 10, factor: 3, points: 30 },
    dips: { reps: 15, factor: 2, points: 30 },
    pushups: { reps: 0, factor: categories.CALISTHENICS_FACTORS.pushups, points: 0 },
  });

  // Not a member of the level: no me.
  fake.rpcs.gym_category_leaderboard = () => listAnswer({ me: null });
  assert.strictEqual((await service.getCategoryLeaderboard({ category: "powerlifting", scope: { level: "world" } })).me, null);

  const calls = fake.rpcCalls.length;
  assert.deepStrictEqual(await service.getCategoryLeaderboard({ category: "running", scope: { level: "world" } }), { podium: [], rows: [], me: null, total: 0 });
  assert.strictEqual(fake.rpcCalls.length, calls, "an unknown category asks nothing");

  fake.rpcs.gym_category_leaderboard = () => ({ data: null, error: { code: "42883", message: "function does not exist" } });
  assert.deepStrictEqual(
    await service.getCategoryLeaderboard({ category: "flid", scope: { level: "world" } }),
    { podium: [], rows: [], me: null, total: 0, unavailable: true }
  );
}

async function testSearch() {
  reset();
  assert.deepStrictEqual(await service.searchGyms({ query: " a " }), [], "one letter searches nothing");
  assert.strictEqual(fake.queries.length, 0);

  fake.onQuery = () => ({
    data: [{ id: "3", chain: "SATS", name: "K.B. Hallen", short_name: null, city: "Frederiksberg", image_url: null }, { name: "no id" }],
    error: null,
  });

  const found = await service.searchGyms({ query: "K.B. Hallen" });
  assert.deepStrictEqual(found, [{ id: 3, name: "K.B. Hallen", shortName: "K.B. Hallen", chain: "SATS", city: "Frederiksberg", imageUrl: null }]);
  assert.deepStrictEqual(fake.queries[0].calls, [
    ["select", "id, chain, name, short_name, city, image_url"],
    ["or", "name.ilike.%K B Hallen%,short_name.ilike.%K B Hallen%,chain.ilike.%K B Hallen%,city.ilike.%K B Hallen%"],
    ["order", "short_name", { ascending: true }],
    ["limit", 40],
  ], "no scope is the whole world; the query goes through the same allowlist as gymService");

  const filtersFor = async (scope) => {
    fake.queries = [];
    await service.searchGyms({ query: "fit,world)", scope });
    return fake.queries[0].calls.filter((call) => call[0] === "eq");
  };

  assert.deepStrictEqual(await filtersFor({ level: "world" }), []);
  assert.deepStrictEqual(await filtersFor({ level: "country", country: "dk" }), [["eq", "country_code", "DK"]]);
  assert.deepStrictEqual(await filtersFor({ level: "region", country: "DK", region: "fyn" }), [["eq", "country_code", "DK"], ["eq", "region_key", "fyn"]]);
  assert.deepStrictEqual(await filtersFor({ level: "gym", gymId: 8 }), [["eq", "id", 8]]);
  assert.ok(!fake.queries[0].calls.some((call) => call[0] === "or" && /[,()]world/.test(call[1].split(",")[0])), "commas and brackets never reach the filter");

  // Before the migration there is no column to filter by: search everything.
  fake.queries = [];
  fake.onQuery = (query) =>
    query.calls.some((call) => call[0] === "eq")
      ? { data: null, error: { code: "42703", message: "column gym.region_key does not exist" } }
      : { data: [{ id: 1, name: "Odense", short_name: "Odense", chain: "LOOP Fitness", city: "Odense C", image_url: null }], error: null };
  const fallback = await service.searchGyms({ query: "odense", scope: { level: "region", country: "DK", region: "fyn" } });
  assert.deepStrictEqual(fallback.map((gym) => gym.id), [1]);
  assert.strictEqual(fake.queries.length, 2, "one filtered search, then one without");

  fake.onQuery = () => ({ data: null, error: { code: "500", message: "boom" } });
  await assert.rejects(service.searchGyms({ query: "odense", scope: { level: "country", country: "DK" } }), (error) => error.message === i18n.t("categoryService.errors.searchFailed"));
}

async function testStartCountry() {
  reset();

  // No position (the permission can no longer be asked for), no centre: Denmark.
  fake.rpcs.my_home_gym = () => ({ data: null, error: null });
  assert.deepStrictEqual(await service.resolveStartCountry(), { country: "DK", fromLocation: false });
  assert.strictEqual(location.positionCalls, 0, "a permission that cannot be asked for is not asked for");

  // Your centre's country.
  fake.rpcs.my_home_gym = () => ({ data: { id: 5, name: "Stockholm City", short_name: "Stockholm" }, error: null });
  fake.onQuery = (query) => (query.table === "gym" ? { data: { country_code: "se" }, error: null } : { data: null, error: null });
  assert.deepStrictEqual(await service.resolveStartCountry(), { country: "SE", fromLocation: false });
  const lookup = fake.queries.pop();
  assert.deepStrictEqual(lookup.calls, [["select", "country_code"], ["eq", "id", 5]]);
  assert.strictEqual(lookup.mode, "maybe");

  // Before the migration the centre has no country column: Denmark, quietly.
  fake.onQuery = () => ({ data: null, error: { code: "42703", message: "column gym.country_code does not exist" } });
  warnings.length = 0;
  assert.deepStrictEqual(await service.resolveStartCountry(), { country: "DK", fromLocation: false });
  assert.strictEqual(warnings.length, 0);

  // my_home_gym itself fails: still an answer.
  fake.rpcs.my_home_gym = () => ({ data: null, error: { code: "PGRST202", message: "Could not find the function public.my_home_gym" } });
  assert.deepStrictEqual(await service.resolveStartCountry(), { country: "DK", fromLocation: false });

  // A position, but geocoding fails: the centre decides.
  location.permission = { granted: true };
  location.position = { coords: { latitude: 59.33, longitude: 18.06, accuracy: 20 } };
  location.geocodeError = new Error("Geocoder is not available");
  fake.rpcs.my_home_gym = () => ({ data: { id: 5 }, error: null });
  fake.onQuery = () => ({ data: { country_code: "SE" }, error: null });
  assert.deepStrictEqual(await service.resolveStartCountry(), { country: "SE", fromLocation: false });
  assert.strictEqual(location.geocodeCalls, 1);

  // A place without a usable code is no answer either.
  location.geocodeError = null;
  location.places = [{ isoCountryCode: null, country: "Sverige" }];
  fake.rpcs.my_home_gym = () => ({ data: null, error: null });
  assert.deepStrictEqual(await service.resolveStartCountry(), { country: "DK", fromLocation: false });

  // The position's country - once for both screens asking at once, and then
  // from memory for the rest of the half hour.
  location.places = [{ isoCountryCode: null }, { isoCountryCode: "no" }];
  const before = location.positionCalls;
  const [first, second] = await Promise.all([service.resolveStartCountry(), service.resolveStartCountry()]);
  assert.deepStrictEqual(first, { country: "NO", fromLocation: true });
  assert.deepStrictEqual(second, first);
  assert.strictEqual(location.positionCalls, before + 1, "two callers share one fix");

  location.places = [{ isoCountryCode: "DE" }];
  assert.deepStrictEqual(await service.resolveStartCountry(), { country: "NO", fromLocation: true });
  assert.strictEqual(location.positionCalls, before + 1, "the answer is remembered");
}

/* ------------------------------------------------------- 4. the migration -- */

function testMigration() {
  assert.ok(migration.includes("Run after 20260928090000_custom-exercises-can-be-shared.sql"), "the run-after header");
  assert.ok(/\nbegin;\n/.test(migration) && /\ncommit;\n\nnotify pgrst, 'reload schema';\n/.test(migration), "one transaction, then the schema reload");
  assert.ok(read("supabase/migrations/README.md").includes("`20260929090000_gym-scope-and-categories.sql` |"), "the ledger names the migration");

  const functions = [...migration.matchAll(/create or replace function ([\w.]+)\(([\s\S]*?)\)\s*returns([\s\S]*?)\nas \$\$([\s\S]*?)\n\$\$;/g)].map((match) => ({
    name: match[1],
    params: [...match[2].matchAll(/\b(p_\w+)\b/g)].map((param) => param[1]),
    header: match[3],
    body: match[4],
  }));
  const byName = Object.fromEntries(functions.map((fn) => [fn.name, fn]));
  const publicRpcs = ["public.gym_scope_summary", "public.gym_category_cards", "public.gym_category_leaderboard"];

  assert.deepStrictEqual(
    functions.map((fn) => fn.name).sort(),
    [...publicRpcs, "private.scope_gyms", "private.scope_members", "private.category_rows", "private.category_ranking", "private.category_person"].sort()
  );

  for (const fn of functions) {
    assert.ok(/\bsecurity definer\b/.test(fn.header), `${fn.name} is security definer`);
    assert.ok(fn.header.includes("set search_path = ''"), `${fn.name} has an empty search_path`);
  }

  // Who may call what: the three reads, by authenticated, and nothing else.
  const grants = [...migration.matchAll(/^grant [^;]+;/gm)].map((match) => match[0].replace(/\s+/g, " "));
  for (const grant of grants) {
    assert.ok(
      /^grant execute on function public\.gym_(scope_summary|category_cards|category_leaderboard)\([^)]*\) to authenticated;$/.test(grant) ||
        grant === "grant select on public.gym_region to authenticated;",
      `nothing else is granted: ${grant}`
    );
  }
  for (const name of publicRpcs) {
    assert.ok(new RegExp(`revoke all on function ${name.replace(".", "\\.")}\\([^)]*\\)\\s+from public, anon;`).test(migration), `${name} is revoked from public and anon`);
    assert.ok(grants.some((grant) => grant.startsWith(`grant execute on function ${name}(`)), `${name} is granted to authenticated`);
  }
  for (const fn of functions.filter((candidate) => candidate.name.startsWith("private."))) {
    assert.ok(
      new RegExp(`revoke all on function ${fn.name.replace(".", "\\.")}\\([^)]*\\)\\s+from public, anon, authenticated;`).test(migration),
      `${fn.name} is callable by nobody in the app`
    );
  }
  assert.ok(migration.includes("alter table public.gym_region enable row level security;"), "regions have row level security");
  assert.ok(migration.includes("revoke all on public.gym_region from anon, authenticated;"));
  assert.ok(migration.includes("revoke all on private.calisthenics_event from public, anon, authenticated;"));

  // Who counts, and the rules the categories count by, against the constants.
  const members = byName["private.scope_members"].body;
  assert.ok(members.includes("private.blocked_between(p_viewer, people.user_id)"), "a block either way leaves somebody out");
  assert.ok(members.includes(`- ${categories.SCOPE_ACTIVE_DAYS}\n`), "members trained there in the last 90 days");
  assert.ok(members.includes("follow.follower_id = p_viewer"), "friends are the people the viewer follows");
  assert.ok(members.includes("workout.done::text in ('true', '1', 't')"), "flags compare as text, as 20260924090000 does");

  const rows = byName["private.category_rows"];
  assert.ok(rows.header.includes("set enable_nestloop = off") && rows.header.includes("set plan_cache_mode = force_custom_plan"), "the planner settings the lists were measured with");
  assert.strictEqual((rows.body.match(new RegExp(`weekly\\.workouts >= ${categories.STREAK_MIN_WORKOUTS}\\n`, "g")) ?? []).length, 2, "a streak week has three workouts, last week and this");
  assert.ok(rows.body.includes("weekly.week_start < v_week_start"), "the streak counts back from last week");

  const powerlifting = rows.body.slice(rows.body.indexOf("elsif p_category = 'powerlifting'"), rows.body.indexOf("elsif p_category = 'fremgang'"));
  assert.ok(powerlifting.includes("and logged_set.reps = 1\n"), "powerlifting counts singles only");
  assert.ok(powerlifting.includes("judged.video_status = 'rejected'") && powerlifting.includes("judged.reps = 1") && powerlifting.includes("trunc(judged.weight_kg) <= logged_set.weight"), "a rejected single stays out");
  assert.ok(powerlifting.includes("lift.video_status = 'verified'") && powerlifting.includes("and lift.reps = 1\n"), "only video is verified singles");
  assert.ok(powerlifting.includes("private.featured_exercises()"), "the three lifts are the catalogue's");

  const progress = rows.body.slice(rows.body.indexOf("elsif p_category = 'fremgang'"), rows.body.indexOf("elsif p_category = 'calisthenics'"));
  assert.ok(progress.includes("logged_set.weight::numeric / (1.0278 - 0.0278 * logged_set.reps)"), "Brzycki");
  assert.ok(read("src/Utils/oneRepMaxUtils.js").includes("1.0278 - 0.0278 * reps"), "the same Brzycki as the app");
  assert.ok(progress.includes(`logged_set.reps between 1 and ${categories.PROGRESS_MAX_REPS}\n`), "estimates up to 12 reps");
  assert.ok(progress.includes(`windows.now_sets >= ${categories.PROGRESS_MIN_SETS}\n`) && progress.includes(`windows.before_sets >= ${categories.PROGRESS_MIN_SETS}\n`), "three sets in each window");
  assert.ok(progress.includes(`v_today - ${categories.PROGRESS_WINDOW_DAYS - 1})`) && progress.includes(`v_today - ${2 * categories.PROGRESS_WINDOW_DAYS - 1} and v_today`), "two 30-day windows, the first including today");
  assert.ok(!progress.includes("gym_id = any(v_gyms)"), "progress is the person's own, wherever they trained");

  const calisthenics = rows.body.slice(rows.body.indexOf("elsif p_category = 'calisthenics'"));
  assert.ok(calisthenics.includes("(logged_set.weight is null or logged_set.weight = 0)"), "no added weight");
  assert.ok(calisthenics.includes("workout.gym_id = any(v_gyms)"), "calisthenics counts at the level's centres");

  const seeded = [...migration.matchAll(/\('([^']+)', '(pullups|dips|pushups)', (\d+(?:\.\d+)?)\)/g)];
  assert.ok(seeded.length >= 18, "the spellings are seeded");
  for (const [, spelling, event, factor] of seeded) {
    assert.strictEqual(Number(factor), categories.CALISTHENICS_FACTORS[event], `${spelling} is worth ${categories.CALISTHENICS_FACTORS[event]}`);
    assert.ok(!/chin|bench/.test(spelling), `${spelling} is not a chin-up or a bench dip`);
  }
  assert.ok(seeded.some(([, spelling]) => spelling === "armstrækninger"));

  const ranking = byName["private.category_ranking"].body;
  assert.ok(ranking.includes("rank() over (\n        order by board.score desc, board.achieved_at asc nulls last, board.member_id asc"), "value, then whoever got there first, then the id");
  assert.ok(ranking.includes("board.score > 0"), "nobody is on a list with nothing");

  // The service sends exactly the parameters the functions take.
  for (const name of publicRpcs) {
    const sent = fake.history.filter((call) => `public.${call.name}` === name).pop();
    assert.ok(sent, `the service calls ${name}`);
    assert.deepStrictEqual(Object.keys(sent.params).sort(), [...byName[name].params].sort(), `${name}: the service's parameters are the function's`);
  }
}

/* ---------------------------------------- 5. how a category is written -- */

function testFormat() {
  const { t } = i18n;
  // Local noon, so no time zone moves a workout to another day.
  const noon = (day) => new Date(2026, 8, day, 12);
  const line = (category, detail, extra = {}) =>
    format.rowSubtitle({ category, row: { detail, gymName: "Lyngby" }, scopeLevel: "gym", t, now: noon(25), ...extra });
  const lifts = { bench: 120, squat: 142.5, deadlift: 0 };

  // What a card counts is what the page opens on: its first tab.
  assert.deepStrictEqual(categories.CATEGORY_KEYS.map((category) => format.valueKind(category)), ["workouts", "kg", "percent", "points"]);
  assert.strictEqual(format.valueKind("flid", "streak"), "weeks");
  assert.deepStrictEqual(["kg", "percent", "workouts", "weeks", "points"].map(format.unitBesideValue), [true, true, false, false, false]);

  i18n.setLanguage("da");
  assert.strictEqual(format.formatValue("kg", 412.5), "412,5", "kilos with the language's decimal comma");
  assert.strictEqual(format.formatValue("kg", "530.00"), "530", "a total as the server sends it");
  assert.strictEqual(format.formatValue("kg", 1002.5), "1.002,5");
  assert.strictEqual(format.formatKg(142.25), "142,25", "a single is written as it was lifted");
  assert.strictEqual(format.formatEstimateKg(62.3), "62,5", "an estimate goes to the half kilo a bar is loaded in");
  assert.strictEqual(format.formatEstimateKg(62.2), "62");
  assert.strictEqual(format.formatValue("percent", 2.54), "+2,5", "one decimal on a rise under ten per cent");
  assert.strictEqual(format.formatValue("percent", 12.4), "+12", "none from ten up");
  assert.strictEqual(format.formatValue("percent", 5, { signed: false }), "5", "a gap has no sign");
  assert.strictEqual(format.formatValue("workouts", 17.6), "18");

  for (const missing of [null, undefined, "", "abc"]) {
    assert.strictEqual(format.formatValue("kg", missing), format.NO_VALUE, `${JSON.stringify(missing)} is no value`);
  }

  assert.deepStrictEqual(
    [["workouts", 1], ["workouts", 18], ["weeks", 2], ["points", 1], ["points", 90], ["kg", 3], ["percent", 3]].map(([kind, value]) =>
      format.unitLabel(kind, value, t)
    ),
    ["træning", "træninger", "uger", "point", "point", "kg", "%"]
  );

  // The line under a name - on the page's rows, and under #1 on a centre's card.
  assert.strictEqual(line("flid", { workouts: 11, weeks: 3, lastWorkoutAt: noon(24) }), "3 uger i træk · sidst i går");
  assert.strictEqual(line("flid", { weeks: 3, lastWorkoutAt: noon(24) }, { tab: "streak" }), "sidst i går", "on the streak tab the weeks are the value");
  assert.strictEqual(line("flid", { workouts: 1, weeks: 0, lastWorkoutAt: null }), "");
  assert.strictEqual(line("powerlifting", lifts), "B 120 · S 142,5 · D 0", "a lift not done counts 0, and says so");
  assert.strictEqual(line("powerlifting", lifts, { scopeLevel: "country" }), "B 120 · S 142,5 · D 0 · Lyngby", "above centre level, the centre too");
  assert.strictEqual(line("fremgang", { lift: "bench", before: 56.4, now: 62.2, percent: 10 }), "Bænk 56,5 → 62 kg", "both estimates to the half kilo");
  assert.strictEqual(line("fremgang", { lift: "bench", before: null, now: 62 }), "", "one estimate is no line");
  assert.strictEqual(line("fremgang", null), "", "nor is a lift that is not one of the three");
  assert.strictEqual(line("calisthenics", { pullups: 10, dips: 15, pushups: 30 }), "Pull 10 · Dip 15 · Arm 30");

  assert.strictEqual(format.meSubtitle({ category: "fremgang", me: { rank: 3, gapToNext: 2.25 }, t }), "2,3 % til #2");
  assert.strictEqual(
    format.meSubtitle({ category: "powerlifting", me: { rank: 2, gapToNext: 370, detail: { homeGymRank: 2 } }, t }),
    "370 kg til #1 · #2 i dit center"
  );
  assert.strictEqual(format.meSubtitle({ category: "flid", me: { rank: 4, gapToNext: 0 }, t }), "Lige med #3");

  i18n.setLanguage("en");
  assert.strictEqual(format.formatValue("kg", 1002.5), "1,002.5", "and English's decimal point");
  assert.strictEqual(format.formatEstimateKg(62.3), "62.5");
  assert.strictEqual(format.unitLabel("workouts", 1, t), "workout");
  assert.strictEqual(line("fremgang", { lift: "squat", before: 100, now: 112.4 }), "Squat 100 → 112.5 kg");
  assert.strictEqual(line("calisthenics", { pullups: 10, dips: 15, pushups: 30 }), "Pull 10 · Dip 15 · Push 30");

  // The colour as text. 4.5:1 on everything it is written on, for every
  // category in every accent theme, light and dark - and left as it is where
  // it already reads.
  assert.strictEqual(format.contrastRatio("#000000", "#ffffff").toFixed(2), "21.00");
  assert.strictEqual(format.contrastRatio("#fff", "#FFFFFF"), 1);
  assert.strictEqual(format.contrastRatio("rgba(0, 0, 0, 1)", "#ffffff"), null, "what cannot be read is not guessed at");
  assert.strictEqual(format.readableTone("#16191f", ["#ffffff"], "#000000"), "#16191f", "a colour that reads stays");
  assert.ok(format.contrastRatio(format.readableTone("#ffffff", ["#ffffff"], "#16191f"), "#ffffff") >= 4.5, "one that does not is drawn toward the ink");
  assert.strictEqual(format.readableTone("#ffffff", ["#ffffff"], "#fefefe"), "#fefefe", "and when nothing reads, it is the ink");

  const surfaces = ["cardBackground", "background", "uiBackground"];

  for (const accent of Object.keys(colors.AccentThemes)) {
    colors.applyAccentTheme(accent);

    for (const scheme of ["light", "dark"]) {
      const theme = colors.Colors[scheme];

      for (const category of categories.CATEGORY_KEYS) {
        const token = categories.categoryToneToken(category);
        const text = token === "primary" ? theme.primaryText : theme[token];
        const { tone, toneText } = format.categoryTone(theme, category);
        const where = `${category} in ${accent}, ${scheme}`;

        assert.strictEqual(tone, theme[token], `${where}: a fill keeps the tone itself`);

        for (const surface of surfaces) {
          const ratio = format.contrastRatio(toneText, theme[surface]);

          assert.ok(ratio >= 4.5, `${where}: ${toneText} on ${surface} ${theme[surface]} is ${ratio?.toFixed(2)}:1`);
        }

        if (surfaces.every((surface) => format.contrastRatio(text, theme[surface]) >= 4.5)) {
          assert.strictEqual(toneText, text, `${where}: a colour that reads is not darkened`);
        }
      }
    }
  }

  colors.applyAccentTheme(colors.DEFAULT_ACCENT_THEME);

  // The card and the page write through the file, and nothing else turns a
  // category into a colour or works out a contrast of its own.
  const card = read("src/Resources/Components/CategoryCard/CategoryCard.js");
  const page = read("src/Pages/CategoryLeaderboardPage/CategoryLeaderboardPage.js");

  for (const [name, source] of [["the card", card], ["the page", page]]) {
    assert.ok(source.includes('from "@utils/categoryFormat"'), `${name} writes through Utils/categoryFormat.js`);
    assert.ok(source.includes("categoryTone(theme, category)"), `${name} takes its colour from categoryTone`);
  }

  assert.ok(["formatValue(", "unitLabel(", "rowSubtitle("].every((call) => card.includes(call)), "the card's value, unit and #1's line are the page's");

  const sourceFiles = (dir) =>
    fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
      const file = `${dir}/${entry.name}`;

      if (entry.isDirectory()) return sourceFiles(file);
      return file.endsWith(".js") ? [file] : [];
    });
  const ownRules = sourceFiles("src").filter(
    (file) =>
      !["src/Utils/categoryFormat.js", "src/Utils/gymCategories.js"].includes(file) &&
      /categoryToneToken\(|function (luminance|contrastRatio|readableTone)\b/.test(read(file))
  );

  assert.deepStrictEqual(ownRules, [], "a category's colour and the contrast rule live in Utils/categoryFormat.js only");
}

async function run() {
  await testSummary();
  await testCards();
  await testLeaderboards();
  await testSearch();
  await testStartCountry();
  testMigration();
  testFormat();

  console.log("Gym categories: vocabulary, importer regions, service mapping, migration checks and how a category is written passed.");
}

run()
  .then(() => {
    // gymService.getCurrentPosition races the fix against a 12 s timer it
    // never clears; that timer is all that would keep the process open.
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
