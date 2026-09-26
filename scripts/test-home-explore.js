// Home's "Fra Udforsk" rail: which cards it shows and in what order, and the
// promises about the screen that nothing else would catch.
//
// What would go wrong quietly: a new account with an empty rail (the block it
// replaced showed such an account five times 0 %), your own exercise offered
// to you as new, a first card that never changes - or changes on every visit
// - two cards with one key, which React drops without a word, and Home moving
// "last seen" forward, so the records Explore would call new are no longer new
// by the time you get there.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const {
  HOME_EXPLORE_MAX_CARDS,
  HOME_EXPLORE_MAX_CENTRE_POSTS,
  HOME_EXPLORE_MAX_EXERCISES,
  buildHomeExploreCards,
  localDayNumber,
} = loadAppModule("src/Utils/homeExploreCards.js");

const TYPES = ["gymRecords", "exercise", "centrePost", "strongest", "findGym", "customExercises"];
const DAY = 20721; // any day
const types = (cards) => cards.map((card) => card.type);
const keys = (cards) => cards.map((card) => card.key);
const sorted = (list) => [...list].sort();
const days = (count, from = DAY) => Array.from({ length: count }, (_, index) => from + index);
const ofType = (cards, type) => cards.filter((card) => card.type === type);

/* ------------------------------------------------------------- fixtures -- */

const homeGym = {
  id: 7,
  name: "PureGym Aarhus Bruuns Galleri",
  shortName: "Bruuns Galleri",
  city: "Aarhus",
  imageUrl: "https://example.test/gym.jpg",
};
const lift = (overrides = {}) => ({
  exerciseId: 1,
  exerciseName: "Bench press",
  weightKg: 120,
  displayName: "Anna",
  isMe: false,
  performedAt: "2026-09-25T10:00:00Z",
  ...overrides,
});
const exercise = (id, overrides = {}) => ({
  id,
  name: `Exercise ${id}`,
  muscles: { primary: ["chest"], secondary: [] },
  users: 3,
  isMine: false,
  owner: { displayName: `Owner ${id}` },
  ...overrides,
});
const post = (id, overrides = {}) => ({
  id,
  title: `Post ${id}`,
  workoutType: "Resistance",
  createdAt: "2026-09-25T10:00:00Z",
  gym: { id: 7, shortName: "Bruuns Galleri" },
  ...overrides,
});
const strongestEntry = (exerciseId, overrides = {}) => ({
  exerciseId,
  exerciseName: `Lift ${exerciseId}`,
  top: lift({ exerciseId, exerciseName: `Lift ${exerciseId}` }),
  ...overrides,
});

// Somebody with a centre and something in every part.
const everything = (overrides = {}) => ({
  homeGym,
  gymRecords: { newCount: 0, latest: lift() },
  exercises: [exercise(1), exercise(2), exercise(3)],
  centrePosts: [post(11), post(12), post(13)],
  strongest: [strongestEntry(1), strongestEntry(2), strongestEntry(3)],
  dayNumber: DAY,
  ...overrides,
});
// Somebody without a centre, and everything else: seven cards to choose from.
const crowded = (overrides = {}) => ({
  exercises: [exercise(1), exercise(2)],
  centrePosts: [post(11), post(12)],
  strongest: [strongestEntry(1)],
  dayNumber: DAY,
  ...overrides,
});

/* ------------------------------------------------ the empty user -------- */

// No centre, no posts, no exercises, no strongest - or parts that failed, or
// came back as something else: the two cards that need nothing, every day.
for (const input of [
  undefined,
  {},
  { homeGym: null, gymRecords: null, exercises: [], centrePosts: [], strongest: [] },
  { homeGym: { name: "No id" }, gymRecords: "?", exercises: null, centrePosts: "nope", strongest: {} },
  { exercises: [null, 3, "x"], centrePosts: [null], strongest: [null, { exerciseId: 1, top: null }] },
]) {
  for (const dayNumber of [0, 1, DAY, -3]) {
    const cards = buildHomeExploreCards(input === undefined ? undefined : { ...input, dayNumber });

    assert.deepStrictEqual(
      sorted(types(cards)),
      ["customExercises", "findGym"],
      `an empty user got ${JSON.stringify(types(cards))} on day ${dayNumber}`
    );
  }
}

/* ---------------------------------------------------- your centre ------- */

{
  const withCentre = buildHomeExploreCards({ homeGym, dayNumber: DAY });

  assert.ok(types(withCentre).includes("gymRecords"), "a home centre has no card");
  assert.ok(!types(withCentre).includes("findGym"), "somebody with a centre is asked to find one");
  // Nothing shared to show: the library still stands in, so there are two.
  assert.deepStrictEqual(sorted(types(withCentre)), ["customExercises", "gymRecords"]);

  const [centre] = ofType(withCentre, "gymRecords");
  assert.strictEqual(centre.gym, homeGym, "the card does not carry the centre");
  assert.strictEqual(centre.newCount, 0);
  assert.strictEqual(centre.latest, null, "no records read as a latest record");
  assert.strictEqual(centre.key, "gymRecords:7");

  const withLatest = ofType(buildHomeExploreCards(everything()), "gymRecords")[0];
  assert.strictEqual(withLatest.latest.exerciseName, "Bench press", "the newest record is not on the card");

  // A record the card could not name - no weight, no exercise - is no record.
  for (const latest of [lift({ weightKg: null }), lift({ weightKg: "heavy" }), lift({ exerciseName: " " })]) {
    const card = ofType(buildHomeExploreCards({ homeGym, gymRecords: { newCount: 0, latest } }), "gymRecords")[0];

    assert.strictEqual(card.latest, null, `${JSON.stringify(latest)} was kept as the newest record`);
  }

  for (const [newCount, expected] of [[3, 3], ["2", 2], [-1, 0], [null, 0], ["x", 0], [2.7, 2]]) {
    const card = ofType(buildHomeExploreCards({ homeGym, gymRecords: { newCount } }), "gymRecords")[0];

    assert.strictEqual(card.newCount, expected, `newCount ${JSON.stringify(newCount)} became ${card.newCount}`);
  }

  // Somebody established - a centre and exercises from others - is not sent
  // to the library's door; somebody new is, whatever else there is.
  assert.ok(!types(buildHomeExploreCards(everything())).includes("customExercises"));
  assert.ok(!types(buildHomeExploreCards(everything())).includes("findGym"));
  assert.ok(
    types(buildHomeExploreCards(everything({ exercises: [exercise(1, { isMine: true })] }))).includes("customExercises"),
    "only your own exercises shared, and no way into the library"
  );
  assert.deepStrictEqual(
    sorted(types(buildHomeExploreCards({ exercises: [exercise(1)], dayNumber: DAY }))),
    ["customExercises", "exercise", "findGym"],
    "a new account with something shared lost one of the ways in"
  );
}

/* ------------------------------------------------- new records first ---- */

for (const dayNumber of days(14)) {
  const cards = buildHomeExploreCards(everything({ gymRecords: { newCount: 3, latest: lift() }, dayNumber }));

  assert.strictEqual(cards[0].type, "gymRecords", `new records were not first on day ${dayNumber}`);
  assert.strictEqual(cards[0].newCount, 3);
  assert.strictEqual(ofType(cards, "gymRecords").length, 1, "the centre is on the rail twice");
}

{
  // Without new records the centre takes its turn like the rest.
  const firsts = days(14).map((dayNumber) => buildHomeExploreCards(everything({ dayNumber }))[0].type);

  assert.ok(firsts.includes("gymRecords"), "the centre never comes first");
  assert.ok(firsts.some((type) => type !== "gymRecords"), "the centre without news is always first");
}

/* ---------------------------------------- at most two, never your own --- */

{
  // At day 0 the base order is untouched: centre, exercise, post, strongest,
  // exercise, post.
  const cards = buildHomeExploreCards(
    everything({
      exercises: [
        exercise(1, { isMine: true }),
        exercise(2),
        exercise(2),
        exercise(3, { isMine: true }),
        exercise(4),
        exercise(5),
        exercise(6, { name: "" }),
      ],
      centrePosts: [post(11, { gym: null }), post(12), post(12), post(13), post(14)],
      dayNumber: 0,
    })
  );

  assert.deepStrictEqual(types(cards), [
    "gymRecords",
    "exercise",
    "centrePost",
    "strongest",
    "exercise",
    "centrePost",
  ]);
  assert.strictEqual(HOME_EXPLORE_MAX_EXERCISES, 2);
  assert.strictEqual(HOME_EXPLORE_MAX_CENTRE_POSTS, 2);
  // The first two of other people's, in the order given - the newest.
  assert.deepStrictEqual(
    ofType(cards, "exercise").map((card) => card.exercise.id),
    [2, 4],
    "not the two newest exercises from others"
  );
  assert.ok(ofType(cards, "exercise").every((card) => !card.exercise.isMine), "your own exercise is offered as new");
  // A post that does not know its centre cannot open it.
  assert.deepStrictEqual(ofType(cards, "centrePost").map((card) => card.post.id), [12, 13]);
}

for (const dayNumber of days(10)) {
  const cards = buildHomeExploreCards(
    everything({ exercises: days(8, 1).map((id) => exercise(id)), centrePosts: days(8, 1).map((id) => post(id)), dayNumber })
  );

  assert.ok(ofType(cards, "exercise").length <= 2, "more than two exercises");
  assert.ok(ofType(cards, "centrePost").length <= 2, "more than two posts");
}

/* ------------------------------------------------------ Denmark's strongest */

{
  const entries = [
    strongestEntry(1),
    { exerciseId: 2, exerciseName: "Lift 2", top: null },
    strongestEntry(3),
    strongestEntry(4, { top: lift({ weightKg: null }) }),
    strongestEntry(5, { exerciseName: null, top: lift({ exerciseId: 5, exerciseName: "From the lift" }) }),
  ];
  const picks = days(12).map(
    (dayNumber) => ofType(buildHomeExploreCards({ strongest: entries, dayNumber }), "strongest")[0]
  );

  assert.ok(picks.every(Boolean), "a day without Denmark's strongest while there are some");
  assert.deepStrictEqual(
    sorted(new Set(picks.map((card) => card.exerciseId))),
    [1, 3, 5],
    "an exercise without a top lift was picked, or one with was never"
  );

  for (let index = 1; index < picks.length; index += 1) {
    assert.notStrictEqual(picks[index].exerciseId, picks[index - 1].exerciseId, "the same lift two days running");
  }

  assert.strictEqual(picks.find((card) => card.exerciseId === 5).exerciseName, "From the lift");
  assert.strictEqual(picks.find((card) => card.exerciseId === 1).lift.weightKg, 120);
  assert.deepStrictEqual(
    picks.map((card) => card.exerciseId),
    days(12).map((dayNumber) => ofType(buildHomeExploreCards({ strongest: entries, dayNumber }), "strongest")[0].exerciseId),
    "the pick is not the same for the same day"
  );
  assert.strictEqual(
    ofType(buildHomeExploreCards({ strongest: [entries[1], entries[3]] }), "strongest").length,
    0,
    "a strongest card with no lift on it"
  );
}

/* --------------------------------------------------------------- the cap -- */

assert.strictEqual(HOME_EXPLORE_MAX_CARDS, 6);

{
  // Seven candidates, six cards - and each of the seven sits a day out once a week.
  const sitsOut = new Set();
  const all = keys(buildHomeExploreCards(crowded({ maxCards: 99 })));

  assert.strictEqual(all.length, 7, `the crowded rail has ${all.length} candidates, not 7`);

  for (const dayNumber of days(7)) {
    const cards = buildHomeExploreCards(crowded({ dayNumber }));

    assert.strictEqual(cards.length, HOME_EXPLORE_MAX_CARDS, `day ${dayNumber} has ${cards.length} cards`);
    all.filter((key) => !keys(cards).includes(key)).forEach((key) => sitsOut.add(key));
  }

  assert.deepStrictEqual(sorted(sitsOut), sorted(all), "some card is never left out, so another always is");

  assert.strictEqual(buildHomeExploreCards(everything({ maxCards: 3 })).length, 3);
  assert.strictEqual(buildHomeExploreCards(everything({ maxCards: 0 })).length, 0);
  assert.strictEqual(buildHomeExploreCards(everything({ maxCards: "lots" })).length, 6, "a strange cap is not the default");
  // News survives any cap.
  assert.deepStrictEqual(
    types(buildHomeExploreCards(everything({ gymRecords: { newCount: 2 }, maxCards: 1 }))),
    ["gymRecords"]
  );
}

/* ------------------------------------------------ the turn of the day --- */

{
  // Stable within a day: the same day, the same rail - also when the day
  // number comes from the clock at either end of it.
  assert.deepStrictEqual(keys(buildHomeExploreCards(everything())), keys(buildHomeExploreCards(everything())));

  const morning = localDayNumber(new Date(2026, 8, 26, 0, 0, 1));
  const night = localDayNumber(new Date(2026, 8, 26, 23, 59, 59));
  const nextMorning = localDayNumber(new Date(2026, 8, 27, 0, 0, 1));

  assert.strictEqual(morning, night, "the day changed during the day");
  assert.strictEqual(nextMorning, night + 1, "midnight did not move the day by one");
  assert.ok(Number.isInteger(morning));
  // Summer time starts and ends on the last Sundays of March and October: a
  // 23- and a 25-hour day, and still one day each.
  assert.strictEqual(localDayNumber(new Date(2026, 2, 30, 12)) - localDayNumber(new Date(2026, 2, 28, 12)), 2);
  assert.strictEqual(localDayNumber(new Date(2026, 9, 26, 12)) - localDayNumber(new Date(2026, 9, 24, 12)), 2);
  assert.strictEqual(localDayNumber(new Date(2026, 2, 29, 0, 30)), localDayNumber(new Date(2026, 2, 29, 23, 30)));
  assert.strictEqual(localDayNumber(new Date(2026, 9, 25, 0, 30)), localDayNumber(new Date(2026, 9, 25, 23, 30)));
  assert.strictEqual(localDayNumber(new Date(2026, 8, 26).getTime()), morning, "a timestamp is not read as its day");
  assert.strictEqual(localDayNumber(new Date("not a date")), 0);

  // Changes across days: another card first every day, the same kinds of card
  // underneath (which of Denmark's strongest is the day's own pick), and over
  // as many days as there are cards each one leads once.
  for (const dayNumber of days(12)) {
    const today = buildHomeExploreCards(everything({ dayNumber }));
    const tomorrow = buildHomeExploreCards(everything({ dayNumber: dayNumber + 1 }));

    assert.notStrictEqual(today[0].key, tomorrow[0].key, `day ${dayNumber} and the next start alike`);
    assert.deepStrictEqual(sorted(types(today)), sorted(types(tomorrow)), "the turn changed which cards there are");
  }

  assert.strictEqual(
    new Set(days(6).map((dayNumber) => buildHomeExploreCards(everything({ dayNumber }))[0].key)).size,
    6,
    "not every card gets a day in front"
  );

  // With the records pinned, what comes after them still turns.
  const pinned = (dayNumber) => buildHomeExploreCards(everything({ gymRecords: { newCount: 1 }, dayNumber }));
  assert.notStrictEqual(pinned(DAY)[1].key, pinned(DAY + 1)[1].key, "nothing turns under new records");

  // Two cards alone swap places from one day to the next.
  assert.deepStrictEqual(
    [...keys(buildHomeExploreCards({ dayNumber: DAY }))].reverse(),
    keys(buildHomeExploreCards({ dayNumber: DAY + 1 }))
  );
}

/* ----------------------------------------------------------- the keys ---- */

for (const input of [
  {},
  everything(),
  everything({ gymRecords: { newCount: 5, latest: lift() } }),
  crowded(),
  everything({ exercises: [exercise(1), exercise(1), exercise("1"), exercise(2)] }),
  everything({ centrePosts: [post("a-1"), post("a-1"), post(1), post("1")] }),
  everything({ strongest: [strongestEntry(1), strongestEntry(1)] }),
]) {
  for (const dayNumber of days(9)) {
    const cards = buildHomeExploreCards({ ...input, dayNumber });

    assert.strictEqual(new Set(keys(cards)).size, cards.length, `two cards share a key: ${keys(cards).join(", ")}`);
    assert.ok(cards.every((card) => TYPES.includes(card.type)), `an unknown card type in ${types(cards).join(", ")}`);
    assert.ok(cards.every((card) => typeof card.key === "string" && card.key.length > 0), "a card without a key");
    assert.ok(cards.length >= 1, "an empty rail");
  }
}

/* ------------------------------------------------------ the screen ------ */

const carouselDir = "src/Pages/HomePage/Components/ExploreCarousel";
const carouselFiles = fs
  .readdirSync(path.join(root, carouselDir))
  .filter((file) => file.endsWith(".js"))
  .map((file) => `${carouselDir}/${file}`);
const carousel = read(`${carouselDir}/ExploreCarousel.js`);
const service = read("src/Services/homeExploreService.js");

// Home only looks. "Last seen" moves when the centre's page is opened
// (GymLeaderboardPage); if Home moved it, Explore's card would say "no new
// records" about records nobody has looked at.
const MARKS_SEEN = /\bmark[A-Za-z]*Seen\b|\bsetLastSeen\b|\bmarkRead\b/;

for (const file of [...carouselFiles, "src/Services/homeExploreService.js", "src/Utils/homeExploreCards.js"]) {
  assert.ok(!MARKS_SEEN.test(read(file)), `${file} marks something as seen`);
}

assert.ok(
  service.includes("getLastSeenOrStart(gymSeenKey(userId, homeGym.id))") &&
    read("src/Pages/ExplorePage/ExplorePage.js").includes("getLastSeenOrStart(gymSeenKey(userId, homeGym.id))"),
  "Home's new records are not counted from the time Explore's centre card counts from"
);
assert.ok(service.includes("Promise.allSettled("), "one part failing takes the others with it");

// Screens call services: the rail asks homeExploreService, never supabase.
assert.ok(
  /import \{[^}]*\bhomeExploreService\b[^}]*\} from "@services";/.test(carousel) &&
    /homeExploreService\s*\.getHomeExploreFeed\(/.test(carousel),
  "the rail does not load through homeExploreService"
);

for (const file of carouselFiles) {
  const source = read(file);

  assert.ok(
    !/supabase|supaBaseClient|@database|@repository|\/Database\/|\/Repository\//i.test(source),
    `${file} reaches past the service`
  );
  assert.ok(!/from "@services\//.test(source), `${file} imports a service file instead of the barrel`);
}

// Every kind of card has something to say; one without would be dropped.
for (const type of TYPES) {
  assert.ok(carousel.includes(`case "${type}":`), `the rail cannot draw a ${type} card`);
}

// Every card and the header open a screen the stack knows. navigate() to a
// name it does not know only warns, in development.
const registered = new Set(
  [...read("App.js").matchAll(/<Stack\.Screen\s+name="([A-Za-z]+)"/g)].map((match) => match[1])
);
const targets = [
  ...new Set(
    carouselFiles.flatMap((file) =>
      [...read(file).matchAll(/navigation\.navigate\(\s*"([A-Za-z]+)"/g)].map((match) => match[1])
    )
  ),
];

assert.deepStrictEqual(sorted(targets), [
  "CenterPostsPage",
  "CustomExerciseDetailPage",
  "CustomExercisesPage",
  "ExplorePage",
  "GymLeaderboardPage",
  "GymsPage",
  "NationalExerciseLeaderboardPage",
]);

for (const target of targets) {
  assert.ok(registered.has(target), `the rail opens ${target}, which App.js does not register`);
}

console.log(
  "Home explore: the empty user, your centre, new records first, two exercises (never yours) and two posts, Denmark's strongest by the day, the cap, the daily turn, unique keys, and a rail that only looks, through its service, passed."
);
