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
const dateUtils = loadAppModule("src/Utils/dateUtils.js");
const activityUtils = loadAppModule("src/Utils/friendsActivityUtils.js");
const gymServiceSource = fs.readFileSync(
  path.join(root, "src", "Services", "gymService.js"),
  "utf8"
);
const {
  deriveShortName,
  disambiguateShortNames,
  imageObjectPath,
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

// Driven from the constants, not from the numbers they happen to hold today.
// Hardcoded 3s and 2s here are what let the function drift away from them
// without the test noticing.
const { APPROVALS_REQUIRED, REJECTIONS_TO_REMOVE } = gymUtils;

assert.strictEqual(gymUtils.deriveVideoStatus({ hasVideo: false, approvals: APPROVALS_REQUIRED + 2 }), "none");
assert.strictEqual(gymUtils.deriveVideoStatus({ hasVideo: true, approvals: 0 }), "pending");
assert.strictEqual(gymUtils.deriveVideoStatus({ hasVideo: true, approvals: APPROVALS_REQUIRED - 1 }), "pending", "one short is still pending");
assert.strictEqual(gymUtils.deriveVideoStatus({ hasVideo: true, approvals: APPROVALS_REQUIRED }), "verified");
assert.strictEqual(
  gymUtils.deriveVideoStatus({ hasVideo: true, approvals: APPROVALS_REQUIRED, rejections: REJECTIONS_TO_REMOVE }),
  "rejected",
  "enough rejections beat enough approvals"
);

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
  { id: "nothing", activityState: "rest" },
  { id: "trained-long-ago", activityState: "rest", lastWorkoutAt: "2026-08-20" },
  { id: "planned-far", activityState: "rest", nextWorkoutAt: "2026-09-30" },
  { id: "planned", activityState: "planned" },
  { id: "done-old", activityState: "done", activityAt: "2026-09-17T08:00:00Z" },
  { id: "trained-recently", activityState: "rest", lastWorkoutAt: "2026-09-16" },
  { id: "live", activityState: "live" },
  { id: "planned-soon", activityState: "rest", nextWorkoutAt: "2026-09-19" },
  { id: "done-new", activityState: "done", activityAt: "2026-09-17T11:00:00Z" },
]);

assert.deepStrictEqual(
  ordered.map((tile) => tile.id),
  [
    // Today: live, then done newest first, then planned.
    "live",
    "done-new",
    "done-old",
    "planned",
    // Then what is coming, soonest first.
    "planned-soon",
    "planned-far",
    // Then how recently they trained, freshest first.
    "trained-recently",
    "trained-long-ago",
    // Then whoever has nothing either side of today.
    "nothing",
  ],
  "today, then upcoming soonest first, then most recently trained"
);

const now = Date.parse("2026-09-17T12:00:00Z");

assert.strictEqual(
  activityUtils.buildActivityStatusLabel({ activityState: "done", workoutLabel: "Push", activityAt: "2026-09-17T10:00:00Z" }, { now }),
  "Push · 2h"
);
assert.strictEqual(activityUtils.buildActivityStatusLabel({ activityState: "live", activityDetail: "12 min in" }), "12 min in");
assert.strictEqual(activityUtils.buildActivityStatusLabel({ activityState: "live" }, { isCurrentUser: true }), "Training now");
assert.strictEqual(activityUtils.buildActivityStatusLabel({ activityState: "planned", workoutLabel: "Run", plannedTime: "18:30" }), "Run · 18:30");
// Resting: what is coming beats what has been, and "No activity" is only for
// somebody with neither.
assert.strictEqual(
  activityUtils.buildActivityStatusLabel(
    { activityState: "rest", nextWorkoutAt: "2026-09-18", lastWorkoutAt: "2026-09-15" },
    { now }
  ),
  "Next workout · Tomorrow"
);
assert.strictEqual(
  activityUtils.buildActivityStatusLabel({ activityState: "rest", lastWorkoutAt: "2026-09-15" }, { now }),
  "2 days ago"
);
assert.strictEqual(
  activityUtils.buildActivityStatusLabel({ activityState: "rest", lastWorkoutAt: "2026-09-16" }, { now }),
  "Yesterday"
);
assert.strictEqual(activityUtils.buildActivityStatusLabel({ activityState: "rest" }, { now }), "No activity");

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
const offeredReasons = [...gymServiceSource.matchAll(/\{ value: "([a-z]+)", label:/g)].map((match) => match[1]);
const acceptedReasons = migration.match(/reason in \(([^)]+)\)/)[1].match(/'([a-z]+)'/g).map((value) => value.replace(/'/g, ""));

assert.deepStrictEqual(offeredReasons.sort(), acceptedReasons.sort(), "rejection reasons in the app and the column check must match");

/* ------------------------- a component that uses the theme declares it -- */

// A file can hold more than one component, and the second does not inherit the
// first one's hooks. Babel compiles a missing `theme` happily and it throws at
// render - the same shape as the dead-zone crashes below, and just as invisible
// to a suite that renders nothing. RejectedBadge was exactly this.
for (const file of [
  "src/Resources/Components/GymLeaderboard/LiftStatusPill.js",
  "src/Resources/Components/GymLeaderboard/LeaderboardRow.js",
]) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const componentCount = (source.match(/^export (default )?function /gm) ?? []).length;
  const themeDeclarations = (source.match(/const theme = Colors\[/g) ?? []).length;
  const componentsUsingTheme = source
    .split(/^export (?:default )?function /m)
    .slice(1)
    .filter((piece) => piece.includes("theme.")).length;

  assert.ok(componentCount >= 1, `${file} exports no component any more`);
  assert.ok(
    themeDeclarations >= componentsUsingTheme,
    `${file} has ${componentsUsingTheme} components reading theme but only ${themeDeclarations} declaring it`
  );
}

/* --------------------------- nothing is used before it is declared ------ */

// useGymSearch takes the screen's setErrorMessage. Both screens once called it
// two lines above that state's own const, which throws a ReferenceError on
// every render - the Centres tab could not be opened at all, and nothing in
// the suite renders a screen, so it passed. Cheap to keep honest by reading.
// A dependency array is evaluated as the component body runs, so a const named
// in one but declared further down throws on every render. This happened twice
// in this branch, both times in code that had just been refactored, and both
// times npm test stayed green because nothing here renders a screen. The rule
// is cheap to read for.
{
  const declaredAfterUse = [
    ["src/Pages/GymExerciseLeaderboardPage/GymExerciseLeaderboardPage.js", "openReview"],
  ];

  for (const [file, name] of declaredAfterUse) {
    const lines = fs.readFileSync(path.join(root, file), "utf8").split(/\r?\n/);
    const declared = lines.findIndex((line) => line.includes(`const ${name} = `));
    const inDeps = lines.findIndex((line) => /^s*[.*]$/.test(line) && line.includes(name));

    assert.ok(declared >= 0, `${file} no longer declares ${name}`);
    assert.ok(
      inDeps === -1 || declared < inDeps,
      `${file} names ${name} in a dependency array before declaring it`
    );
  }
}

for (const file of [
  "src/Pages/GymsPage/GymsPage.js",
  "src/Pages/GymLeaderboardPage/Components/ChangeGymSheet.js",
]) {
  const lines = fs.readFileSync(path.join(root, file), "utf8").split(/\r?\n/);
  const declared = lines.findIndex((line) =>
    line.includes("const [errorMessage, setErrorMessage]")
  );
  const used = lines.findIndex((line) => line.includes("useGymSearch("));

  assert.ok(declared >= 0 && used >= 0, `${file} no longer has both lines`);
  assert.ok(
    declared < used,
    `${file} passes setErrorMessage to useGymSearch before declaring it`
  );
}

/* ------------------------------- the tiles' fallback state machine ------ */

// What a tile shows when the cloud cannot answer in the 2.0 shape - which is
// every client whose database has not had the migrations yet, so it is what
// most people see. It used to live inside socialService, where a test could
// not reach it because that module pulls in the Supabase client.
const cloudActivity = loadAppModule("src/Utils/cloudActivityUtils.js");

assert.strictEqual(
  cloudActivity.buildCloudActivityPreview([]).activityState,
  "rest",
  "no workouts is a rest day"
);

// live beats done beats planned, whatever order the rows arrive in.
const mixed = [
  { id: 1, done: 1, workout_type: "Resistance" },
  { id: 2, done: 0, workout_type: "Resistance", is_active: 1 },
  { id: 3, done: 0, workout_type: "Resistance" },
];

assert.strictEqual(
  cloudActivity.buildCloudActivityPreview(mixed).activityState,
  "live",
  "a live workout wins over a finished and a planned one"
);
assert.strictEqual(
  cloudActivity.buildCloudActivityPreview(mixed).workoutId,
  2,
  "the live workout is the one reported"
);
assert.strictEqual(
  cloudActivity.buildCloudActivityPreview(mixed.filter((row) => row.id !== 2))
    .activityState,
  "planned",
  "with nothing live, a planned workout wins over a finished one"
);
assert.strictEqual(
  cloudActivity.buildCloudActivityPreview([{ id: 9, done: 1 }]).activityState,
  "done",
  "only finished workouts is done"
);

// A row whose timer_start is a wall clock, not a timestamp: the workout is
// live even though is_active says nothing.
assert.ok(
  cloudActivity.isCloudWorkoutLive({
    done: 0,
    date: "01.01.2026",
    timer_start: "07:30",
  }),
  "a workout with a start time and no is_active flag is still live"
);

assert.strictEqual(
  cloudActivity.getCloudWorkoutTimerStartSeconds({
    date: "01.01.2026",
    timer_start: "07:30",
  }),
  Math.trunc(new Date(2026, 0, 1, 7, 30, 0).getTime() / 1000),
  "HH:MM plus a dd.mm.yyyy date resolves to that local instant"
);

// The parser validates ranges, so a nonsense time reads as no time at all
// rather than as a date somewhere else.
assert.strictEqual(cloudActivity.normalizeCloudTimeString("25:00"), null, "hour 25");
assert.strictEqual(cloudActivity.normalizeCloudTimeString("07:99"), null, "minute 99");
assert.strictEqual(cloudActivity.normalizeCloudTimeString("7:30"), null, "one-digit hour");
assert.strictEqual(cloudActivity.normalizeCloudTimeString(730), null, "not a string");
assert.strictEqual(cloudActivity.normalizeCloudTimeString(" 07:30 "), "07:30:00");
assert.strictEqual(cloudActivity.normalizeCloudTimeString("07:30:15"), "07:30:15");

assert.strictEqual(
  cloudActivity.isCloudWorkoutLive({ done: 0, date: "01.01.2026", timer_start: "25:00" }),
  false,
  "an invalid time does not make a workout live"
);

/* --------------------------------------- the day boundaries hold -------- */

// formatRelativeDay is what a friend's tile says when they have nothing on
// today, and the comment above it points at BUG-20, which was a mistake at
// exactly one of these edges. Nothing tested them.
{
  const dayMs = 86400000;
  const now = new Date(2026, 5, 15, 12, 0, 0).getTime();
  const ago = (days) => dateUtils.formatRelativeDay(now - days * dayMs, now);

  assert.strictEqual(ago(0), "Today");
  assert.strictEqual(ago(1), "Yesterday");
  assert.strictEqual(ago(2), "2 days ago");
  assert.strictEqual(ago(6), "6 days ago", "six days is still counted in days");
  assert.strictEqual(ago(7), "1 week ago", "seven days is the first week");
  assert.strictEqual(ago(30), "4 weeks ago", "thirty days is still weeks");
  assert.strictEqual(ago(31), "1 month ago", "thirty-one days is the first month");
  assert.strictEqual(ago(365), "12 months ago");

  // A day in the future is today's business, not "in -1 days".
  assert.strictEqual(ago(-3), "Today", "a future day does not count backwards");
  assert.strictEqual(dateUtils.formatRelativeDay(null), "", "no date, no words");
}

{
  const now = Date.now();

  assert.strictEqual(dateUtils.formatTimeAgo(null), "Just now", "nothing reads as just now");
  assert.strictEqual(dateUtils.formatTimeAgo("not a date"), "Just now");
  assert.strictEqual(dateUtils.formatTimeAgo(now - 30 * 1000), "Just now", "under a minute");
  assert.strictEqual(dateUtils.formatTimeAgo(now - 5 * 60 * 1000), "5m ago");
  assert.strictEqual(dateUtils.formatTimeAgo(now - 2 * 3600 * 1000), "2h ago");
}

/* ------------------------------------ the two search filters are tested -- */

// buildSearchFilter in socialService has scripts/test-username-search.js,
// written after a real bug. The centre search's copy had nothing.
{
  // The function lives in gymService, which pulls in the Supabase client and
  // cannot be loaded here, so the rule is lifted out of the source and run -
  // the same regex the app uses, not a copy of it.
  const match = gymServiceSource.match(
    /export function buildGymSearchFilter\(query\) \{[\s\S]*?\n\}/
  );

  assert.ok(match, "gymService no longer exports buildGymSearchFilter");

  const allowList = match[0].match(/\.replace\((\/\[\^[^/]+\/gu), " "\)/);

  assert.ok(allowList, "the centre search filter is not an allowlist any more");

  const filter = (query) =>
    String(query ?? "")
      .replace(new RegExp(allowList[1].slice(1, -3), "gu"), " ")
      .replace(/\s+/g, " ")
      .trim();

  // The characters that delimit a PostgREST .or(...) filter have to go, or a
  // search box becomes a query editor.
  for (const dangerous of ["(", ")", ",", "*", "%", ".", "'"]) {
    assert.ok(
      !filter(`a${dangerous}b`).includes(dangerous),
      `the centre search lets ${dangerous} through into the filter string`
    );
  }

  // And the characters a Danish centre name actually uses have to stay.
  assert.strictEqual(filter("Fit&Sund"), "Fit&Sund");
  assert.strictEqual(filter("Nørrebro"), "Nørrebro");
  assert.strictEqual(filter("Fitness World"), "Fitness World");
  assert.strictEqual(filter("  K.B.  Hallen "), "K B Hallen", "gaps collapse");
}

/* ---------------------------------- an image lands where it is expected -- */

// A wrong slug is an image that never shows, with nothing to say so.
assert.strictEqual(
  imageObjectPath("PureGym", "Adolphsvej 25, 2820 Gentofte", ".jpg"),
  "puregym/adolphsvej-25-2820-gentofte.jpg"
);
assert.strictEqual(
  imageObjectPath("Fit&Sund", "Nørrebrogade 4, 2200 København N", "PNG"),
  "fit-sund/norrebrogade-4-2200-kobenhavn-n.png",
  "Danish letters and the extension are folded down"
);
assert.strictEqual(
  imageObjectPath("LOOP", "Åboulevarden 1, 8000 Århus C", "jpg"),
  "loop/aboulevarden-1-8000-arhus-c.jpg"
);

/* ------------------------------------------- the midnight rule holds ---- */

// calendarDaysBetween exists because elapsed milliseconds gave the wrong
// answer for "yesterday". The only coverage it had passed plain date strings,
// where a millisecond count would agree with it - so the bug it was written
// against would not have been caught. Two instants on the same day is the case
// that tells them apart.
assert.strictEqual(
  dateUtils.calendarDaysBetween(
    new Date(2026, 0, 1, 7, 0, 0),
    new Date(2026, 0, 1, 23, 30, 0)
  ),
  0,
  "sixteen hours inside one day is still the same calendar day"
);

assert.strictEqual(
  dateUtils.calendarDaysBetween(
    new Date(2026, 0, 1, 23, 30, 0),
    new Date(2026, 0, 2, 0, 30, 0)
  ),
  1,
  "an hour that crosses midnight is one calendar day"
);

/* ------------------------------- a lift video stays inside its centre ---- */

// The follow-up migration. The original shipped these three open and is
// already live, so the checks belong here rather than in a diff nobody reads.
const videoFollowUp = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20260921140000_lift-videos-stay-in-the-centre.sql"),
  "utf8"
);

assert.ok(
  /create policy "Centre members can read lift videos"[\s\S]*?private\.can_watch_lift_video\(name\)/.test(
    videoFollowUp
  ),
  "the lift-videos read policy no longer goes through the membership check"
);

assert.ok(
  /create or replace function private\.can_watch_lift_video[\s\S]*?security definer/.test(
    videoFollowUp
  ),
  "the membership check is not security definer, so it cannot read gym_lift"
);

assert.ok(
  /and private\.trains_at_gym\(\(select id from viewer\), target_gym_id\);/.test(videoFollowUp),
  "the verification queue hands out video paths without checking membership"
);

assert.strictEqual(
  (videoFollowUp.match(/A lift video has to be your own upload\./g) ?? []).length,
  2,
  "the own-upload rule has to guard both the insert and the update of video_path"
);

assert.ok(
  /event_type = 'lift_verification_requested'[\s\S]*?interval '10 minutes'[\s\S]*?return 0;/.test(
    videoFollowUp
  ),
  "request_lift_verification can be called in a loop again"
);

console.log("Gym leaderboard checks passed.");
