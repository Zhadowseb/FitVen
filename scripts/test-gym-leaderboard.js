// Guards the rules behind centres and the Friends activity tiles that have no
// other coverage: which set of a workout becomes the lift, when a lift is
// written, how a vote count becomes a status, how a centre gets its short name
// from the scraped data, the tile order, and the two SQL invariants the app
// depends on (own-rows-only reads of gym_lift, verified-only across centres).

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");
const gymUtils = loadAppModule("src/Utils/gymUtils.js");
const activityUtils = loadAppModule("src/Utils/friendsActivityUtils.js");
const {
  deriveShortName,
  deriveSingleCentrePrice,
  disambiguateShortNames,
  normalizeGym,
} = require("./import-gyms/normalizeGym");

/* ---------------------------------------------------------- best set -- */

const sets = [
  { cloud_exercise_id: 1, exercise_name: "Bench Press", weight: 100, reps: 3, sync_id: "a" },
  { cloud_exercise_id: 1, exercise_name: "Bench Press", weight: 100, reps: 5, sync_id: "b" },
  { cloud_exercise_id: 1, exercise_name: "Bench Press", weight: 95, reps: 8, sync_id: "c" },
  { cloud_exercise_id: 2, exercise_name: "Squat", weight: "140", reps: "1", sync_id: "d" },
  { cloud_exercise_id: null, exercise_name: "My custom", weight: 200, reps: 1, sync_id: "e" },
  { cloud_exercise_id: 3, exercise_name: "Deadlift", weight: 0, reps: 5, sync_id: "f" },
];
const best = gymUtils.selectBestLiftsPerExercise(sets);

assert.deepStrictEqual(
  best.map((lift) => [lift.exerciseId, lift.weightKg, lift.reps, lift.setSyncId]),
  [
    [1, 100, 5, "b"],
    [2, 140, 1, "d"],
  ],
  "heaviest weight wins, more reps break the tie, custom exercises and empty sets drop"
);

/* ----------------------------------------------------- what to upsert -- */

const existing = [
  { exercise_id: 1, weight_kg: "102.5" },
  { exercise_id: 2, weight_kg: 140 },
];
const toUpsert = gymUtils.selectLiftsToUpsert(best, existing);

assert.deepStrictEqual(
  toUpsert.map((lift) => lift.exerciseId),
  [2],
  "a lighter bench is not written; an equal squat is, so a rep improvement lands"
);
assert.deepStrictEqual(
  gymUtils.selectLiftsToUpsert(best, []).map((lift) => lift.exerciseId),
  [1, 2],
  "everything is written the first time"
);

/* ------------------------------------------------------- vote status -- */

assert.strictEqual(gymUtils.deriveVideoStatus({ hasVideo: false, approvals: 5 }), "none");
assert.strictEqual(gymUtils.deriveVideoStatus({ hasVideo: true, approvals: 0 }), "pending");
assert.strictEqual(gymUtils.deriveVideoStatus({ hasVideo: true, approvals: 3 }), "verified");
assert.strictEqual(gymUtils.deriveVideoStatus({ hasVideo: true, approvals: 3, rejections: 2 }), "rejected", "two rejections beat three approvals");

/* ---------------------------------------------------------- matching -- */

const gyms = [
  { id: 1, latitude: 56.1500, longitude: 10.2039, match_radius_m: 120 },
  { id: 2, latitude: 56.1510, longitude: 10.2039, match_radius_m: 120 },
];

assert.strictEqual(gymUtils.matchGymLocally({ latitude: 56.1501, longitude: 10.2039 }, gyms)?.gym.id, 1, "nearest centre inside its radius");
assert.strictEqual(gymUtils.matchGymLocally({ latitude: 56.1600, longitude: 10.2039 }, gyms), null, "a kilometre away matches nothing");

/* ------------------------------------------------------- formatting -- */

// Pin colours: every chain in the data gets one, no two chains share one, and
// none of them is the accent, the green "you are here" or the record gold -
// those three already mean something else on this map.
const chainsInData = ["PureGym", "SATS", "LOOP Fitness", "FitnessX", "Fit&Sund"];
const chainColors = chainsInData.map((chain) => gymUtils.getChainColor(chain).toLowerCase());

assert.strictEqual(
  new Set(chainColors).size,
  chainsInData.length,
  "two chains must not share a pin colour"
);
assert.strictEqual(gymUtils.getChainColor("Some New Chain"), "#C4C7CF", "an unknown chain stays neutral");
assert.strictEqual(gymUtils.getChainColor("puregym"), gymUtils.getChainColor("PureGym"), "the lookup ignores case");

for (const reserved of ["#f7742e", "#4ed39a", "#e8b44a"]) {
  assert.ok(!chainColors.includes(reserved), `${reserved} already means something else on the map`);
}

assert.strictEqual(gymUtils.getChainInitials("PureGym"), "PG");
assert.strictEqual(gymUtils.getChainInitials("LOOP Fitness"), "LO");
assert.strictEqual(gymUtils.getChainInitials("Fit&Sund"), "FS");
assert.strictEqual(gymUtils.getChainInitials("Some New Chain"), "SN");
assert.strictEqual(gymUtils.formatDistance(850), "850 m");
assert.strictEqual(gymUtils.formatDistance(2340), "2.3 km");
assert.strictEqual(gymUtils.formatDistance(12400), "12 km");
assert.strictEqual(gymUtils.formatWeightKg("102.50"), "102.5");
assert.strictEqual(gymUtils.shortenDisplayName("Mikkel Rasmussen"), "Mikkel R.");

/* -------------------------------------------------------- short names -- */

assert.strictEqual(deriveShortName({ chain: "PureGym", name: "Gentofte, Kildeskovshallen" }), "Kildeskovshallen");
assert.strictEqual(deriveShortName({ chain: "PureGym", name: "Kbh S., Asger Jorns Allé" }), "Asger Jorns Allé");
assert.strictEqual(deriveShortName({ chain: "LOOP Fitness", name: "LOOP Dragør" }), "Dragør");
assert.strictEqual(deriveShortName({ chain: "Fit&Sund", name: "Fit&Sund Stevns" }), "Stevns");
assert.strictEqual(deriveShortName({ chain: "SATS", name: "KBH - Adelgade", short_name: "Adelgade" }), "Adelgade");
assert.strictEqual(deriveShortName({ chain: "SATS", name: "KBH - Field's" }), "Field's");
assert.strictEqual(deriveShortName({ chain: "SATS", name: "Lyngby – Kanalvej" }), "Kanalvej", "an en dash separates like a hyphen");
assert.strictEqual(deriveShortName({ chain: "SATS", name: "Køge - Strædet", short_name: "Køge - Strædet" }), "Strædet", "an explicit short name that is just the name again does not stop the rules");
assert.strictEqual(deriveShortName({ chain: "LOOP Fitness", name: "LOOP Amager, Strandlodsvej" }), "Strandlodsvej", "the rules apply in turn, not first match");
assert.strictEqual(deriveShortName({ chain: "FitnessX", name: "Ballerup" }), "Ballerup");

/* ------------------------------------------ the single-centre price -- */

// PureGym's normal price, not the campaign one beside it: a campaign is gone
// by the time somebody reads the card.
assert.deepStrictEqual(
  deriveSingleCentrePrice({
    chain: "PureGym",
    price_from: "Priser fra 169,50 DKK/md.",
    price_note: "*Normalpris fra 339 DKK/md.",
  }),
  { price_kr: 339, price_is_from: true, price_note: "Normalpris fra 339 DKK/md." }
);

// SATS Basic for an adult, which their own site calls access to one centre.
assert.deepStrictEqual(
  deriveSingleCentrePrice({
    chain: "SATS",
    memberships: [
      { name: "Basic", member_type: "Voksen", age_group: "under-30", price: "549" },
      { name: "Premium", member_type: "Voksen", age_group: "over-30", price: "799" },
      {
        name: "Basic",
        member_type: "Voksen",
        age_group: "over-30",
        price: "649",
        description: "Adgang til dit favoritcenter",
      },
    ],
  }),
  { price_kr: 649, price_is_from: false, price_note: "Adgang til dit favoritcenter" }
);

// A LOOP membership covers every LOOP centre, so there is no single-centre
// price and the card must show none rather than the all-centre one.
assert.strictEqual(
  deriveSingleCentrePrice({
    chain: "LOOP Fitness",
    memberships: [{ name: "Kampagne", price_per_month: 289, local_gym_only: false }],
  }),
  null
);
assert.strictEqual(deriveSingleCentrePrice({ chain: "FitnessX", price_teaser: "fra kun 250 kr./md." }), null);
assert.strictEqual(deriveSingleCentrePrice({ chain: "Fit&Sund" }), null);

const colliding = disambiguateShortNames([
  { chain: "PureGym", name: "Odense C., Dannebrogsgade", short_name: "Dannebrogsgade", city: "Odense C" },
  { chain: "PureGym", name: "Aalborg, Dannebrogsgade", short_name: "Dannebrogsgade", city: "Aalborg" },
  { chain: "SATS", name: "KBH - Adelgade", short_name: "Adelgade", city: "København K" },
  { chain: "PureGym", name: "Skanderborg, Adelgade", short_name: "Adelgade", city: "Skanderborg" },
]);

assert.deepStrictEqual(
  colliding.map((row) => row.short_name),
  ["Dannebrogsgade, Odense C.", "Dannebrogsgade, Aalborg", "Adelgade", "Adelgade"],
  "a clash inside one chain gets the city; the same name in two chains is left alone"
);

// Over the real data, when it is there: every centre gets a non-empty short
// name and a row, and after disambiguation no two centres in a chain share
// a short name.
const dataDir = path.join(root, "data", "gyms");

if (fs.existsSync(dataDir)) {
  const allRows = [];

  for (const chainFolder of fs.readdirSync(dataDir, { withFileTypes: true })) {
    if (!chainFolder.isDirectory()) continue;

    const names = new Set();

    for (const entry of fs.readdirSync(path.join(dataDir, chainFolder.name), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;

      const infoPath = path.join(dataDir, chainFolder.name, entry.name, "info.json");

      if (!fs.existsSync(infoPath)) continue;

      const info = JSON.parse(fs.readFileSync(infoPath, "utf8"));
      const row = normalizeGym(info, { folderName: entry.name, chainFolder: chainFolder.name });

      assert.ok(row, `${infoPath} should normalise to a row`);
      assert.ok(row.short_name.length > 0, `${infoPath} needs a short name`);
      assert.ok(!names.has(row.name), `${chainFolder.name} has two centres named ${row.name}`);
      names.add(row.name);
      allRows.push(row);
    }
  }

  disambiguateShortNames(allRows);

  const shortNames = new Set();

  for (const row of allRows) {
    const key = `${row.chain}|${row.short_name.toLowerCase()}`;

    assert.ok(!shortNames.has(key), `${row.chain} has two centres shown as ${row.short_name}`);
    shortNames.add(key);
  }
}

/* ------------------------------------------------------------- tiles -- */

const ordered = activityUtils.sortActivityTiles([
  { id: "rest", activityState: "rest" },
  { id: "planned", activityState: "planned" },
  { id: "done-old", activityState: "done", activityAt: "2026-09-17T08:00:00Z" },
  { id: "live", activityState: "live" },
  { id: "done-new", activityState: "done", activityAt: "2026-09-17T11:00:00Z" },
]);

assert.deepStrictEqual(
  ordered.map((tile) => tile.id),
  ["live", "done-new", "done-old", "planned", "rest"],
  "live, then done newest first, then planned, then rest"
);

const now = Date.parse("2026-09-17T12:00:00Z");

assert.strictEqual(
  activityUtils.buildActivityStatusLabel({ activityState: "done", workoutLabel: "Push", activityAt: "2026-09-17T10:00:00Z" }, { now }),
  "Push · 2h"
);
assert.strictEqual(activityUtils.buildActivityStatusLabel({ activityState: "live", activityDetail: "12 min in" }), "12 min in");
assert.strictEqual(activityUtils.buildActivityStatusLabel({ activityState: "live" }, { isCurrentUser: true }), "Training now");
assert.strictEqual(activityUtils.buildActivityStatusLabel({ activityState: "planned", workoutLabel: "Run", plannedTime: "18:30" }), "Run · 18:30");
assert.strictEqual(activityUtils.buildActivityStatusLabel({ activityState: "rest" }), "No activity");

const playing = activityUtils.classifyMusicRow(
  { track: "Blinding Lights", artist: "The Weeknd", played_at: new Date(now - 30000).toISOString() },
  { activityState: "live", now }
);
const stale = activityUtils.classifyMusicRow(
  { track: "Blinding Lights", artist: "The Weeknd", played_at: new Date(now - 120000).toISOString() },
  { activityState: "live", now }
);

assert.strictEqual(playing.state, "playing", "a row under 90 s old on a live workout is playing");
assert.strictEqual(stale.state, "last", "an older row is the last track");
assert.strictEqual(activityUtils.classifyMusicRow(playing, { activityState: "done", now })?.state, "last", "a finished workout only ever has a last track");
assert.strictEqual(activityUtils.classifyMusicRow(null, { activityState: "live" }), null);
assert.strictEqual(activityUtils.resolveMusicBandState(null, "live"), "none");
assert.strictEqual(activityUtils.resolveMusicBandState({ track: "x", state: "playing" }, "done"), "last", "playing needs a live workout");
assert.strictEqual(activityUtils.formatMusicLine({ track: "Blinding Lights", artist: "The Weeknd" }), "Blinding Lights · The Weeknd");
assert.strictEqual(activityUtils.shouldTickerScroll(200, 120), true);
assert.strictEqual(activityUtils.shouldTickerScroll(100, 120), false, "text that fits stands still");

/* ------------------------------------------------------- the SQL side -- */

const migration = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20260917120000_gyms-and-lift-verification.sql"),
  "utf8"
);

assert.ok(
  /create policy "Users can view their own lifts"[\s\S]*?using \(\(select auth\.uid\(\)\) = user_id\)/.test(migration),
  "gym_lift must only answer for the viewer's own rows; the leaderboard functions are the public surface"
);
assert.ok(
  !/create policy "[^"]*"\s+on public\.gym_lift\s+for select\s+to authenticated\s+using \(true\)/.test(migration),
  "no policy may open gym_lift to everyone"
);
assert.ok(
  migration.includes("and (target_gym_id is not null or lift.video_status = 'verified')"),
  "across centres only verified lifts rank"
);
assert.ok(
  migration.includes("raise exception 'You cannot vote on your own lift.'"),
  "voting on your own lift is refused in the database, not just hidden in the app"
);
assert.ok(
  /when rejection_count >= 2 then 'rejected'[\s\S]*?when approval_count >= 3 then 'verified'/.test(migration),
  "two rejections are checked before three approvals"
);
assert.ok(
  !/grant update \([^)]*\b(approvals|rejections|video_status)\b[^)]*\)\s+on public\.gym_lift/.test(migration),
  "clients must not be able to update the status columns"
);

const musicMigration = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20260917120100_workout-music.sql"),
  "utf8"
);

assert.ok(
  musicMigration.includes("follow.follower_id = (select auth.uid())"),
  "workout music is read through user_follows, so a block cuts it off like everything else"
);

// The reasons the reject step offers have to be the ones the column accepts.
const gymServiceSource = fs.readFileSync(path.join(root, "src", "Services", "gymService.js"), "utf8");
const offeredReasons = [...gymServiceSource.matchAll(/\{ value: "([a-z]+)", label:/g)].map((match) => match[1]);
const acceptedReasons = migration.match(/reason in \(([^)]+)\)/)[1].match(/'([a-z]+)'/g).map((value) => value.replace(/'/g, ""));

assert.deepStrictEqual(offeredReasons.sort(), acceptedReasons.sort(), "rejection reasons in the app and the column check must match");

console.log("Gym leaderboard checks passed.");
