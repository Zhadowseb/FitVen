// The background of a resting friend tile: days since the last workout, and
// the colour that goes with it.
//
// The one mistake this can make quietly is showing a number that means
// something else - a zero for somebody who has never trained reads as "today",
// and a tile with something on today getting a "gone cold" wash contradicts
// its own ring - so those are what is pinned here.

const assert = require("assert");
const loadAppModule = require("./lib/loadAppModule");

const {
  buildAvatarAura,
  buildRestWallpaper,
  wallpaperColorForDays,
  FIRE_WITHIN_DAYS,
  ICE_FROM_DAYS,
  WALLPAPER_MOTION_DAYS,
} = loadAppModule("src/Utils/friendsActivityUtils.js");
const { mixHexColors } = loadAppModule("src/Utils/colorMix.js");

const now = new Date(2026, 8, 23, 12, 0, 0).getTime();
const daysAgo = (days) => new Date(2026, 8, 23 - days, 9, 0, 0).toISOString();

// Today already has a colour: live, done and planned get no wallpaper.
for (const activityState of ["live", "done", "planned"]) {
  assert.strictEqual(
    buildRestWallpaper({ activityState, lastWorkoutAt: daysAgo(12) }, now),
    null,
    `a ${activityState} tile was given a resting background`
  );
}

// The tone follows the days, colder the longer it has been.
const toneAt = (days) =>
  buildRestWallpaper({ activityState: "rest", lastWorkoutAt: daysAgo(days) }, now).tone;

assert.strictEqual(toneAt(1), "fresh");
assert.strictEqual(toneAt(2), "warm");
assert.strictEqual(toneAt(3), "warm");
assert.strictEqual(toneAt(4), "cooling");
assert.strictEqual(toneAt(7), "cooling");
assert.strictEqual(toneAt(8), "cold");

assert.strictEqual(
  buildRestWallpaper({ lastWorkoutAt: daysAgo(4) }, now).label,
  "4",
  "a tile with no state at all is not treated as resting"
);

// Never trained: no number, so nothing that reads as "0 days".
assert.deepStrictEqual(
  buildRestWallpaper({ activityState: "rest" }, now),
  { tone: "new", days: null, label: null, energy: 0 },
  "somebody with no workout was shown a day count"
);

// The phone's own count wins over the cloud's date for the viewer's tile,
// and a zero from it is a real zero, not "unknown".
assert.strictEqual(
  buildRestWallpaper({ daysSinceLastWorkout: 2, lastWorkoutAt: daysAgo(9) }, now).label,
  "2",
  "the viewer's own day count lost to a stale cloud date"
);
assert.strictEqual(
  buildRestWallpaper({ daysSinceLastWorkout: 0 }, now).label,
  "0",
  "a workout today from the phone was read as no workout at all"
);
assert.strictEqual(
  buildRestWallpaper({ daysSinceLastWorkout: null, lastWorkoutAt: daysAgo(5) }, now).label,
  "5",
  "a missing phone count hid the cloud date"
);

// Past two digits the number stops growing, so it cannot outgrow the tile.
assert.strictEqual(
  buildRestWallpaper({ lastWorkoutAt: daysAgo(240) }, now).label,
  "99+"
);

// The colour follows the day, not a step: pinned at 0, 2, 5 and 9 days and
// blended in between, so two tiles a day apart are two shades.
const COLORS = ["#ff0000", "#0000ff", "#00ff00", "#808080"];

assert.strictEqual(wallpaperColorForDays(0, COLORS), "#ff0000");
assert.strictEqual(wallpaperColorForDays(1, COLORS), "#800080", "day 1 is not halfway from 0 to 2");
assert.strictEqual(wallpaperColorForDays(2, COLORS), "#0000ff");
assert.strictEqual(wallpaperColorForDays(9, COLORS), "#808080");
assert.strictEqual(wallpaperColorForDays(40, COLORS), "#808080", "a long gap left the scale");
assert.notStrictEqual(
  wallpaperColorForDays(3, COLORS),
  wallpaperColorForDays(4, COLORS),
  "two days in a row came out the same colour"
);

// A colour that cannot be read is handed back, not turned into black.
assert.strictEqual(mixHexColors("#ffffff", "rgba(0,0,0,1)", 0.2), "#ffffff");
assert.strictEqual(mixHexColors("#fff", "#000", 0.5), "#808080");

// It moves within a week and not after, and fresher moves more.
const energyAt = (days) => buildRestWallpaper({ daysSinceLastWorkout: days }, now).energy;

assert.ok(energyAt(0) > energyAt(3), "a tile from today was no livelier than one from three days ago");
assert.ok(energyAt(WALLPAPER_MOTION_DAYS) > 0, "a workout exactly a week ago stopped moving");
assert.strictEqual(energyAt(WALLPAPER_MOTION_DAYS + 1), 0, "a tile older than a week still moves");

// A month out, the scale ends frozen rather than grey.
const FIVE = ["#ff0000", "#0000ff", "#00ff00", "#808080", "#00ffff"];

assert.strictEqual(wallpaperColorForDays(ICE_FROM_DAYS, FIVE), "#00ffff");
assert.strictEqual(wallpaperColorForDays(200, FIVE), "#00ffff", "a long gap thawed back out");

// Fire for anyone active - training now, done today, or trained within the
// last three days - and ice from a month.
const auraAt = (days) => buildAvatarAura({ activityState: "rest", daysSinceLastWorkout: days }, now);

assert.strictEqual(FIRE_WITHIN_DAYS, 3, "active is trained within the last three days");
assert.strictEqual(auraAt(0), "fire");
assert.strictEqual(auraAt(3), "fire", "three days ago no longer counted as active");
assert.strictEqual(auraAt(4), null, "four days ago was still on fire");
assert.strictEqual(auraAt(29), null, "a friend froze before a month was up");
assert.strictEqual(auraAt(30), "ice");
assert.strictEqual(
  buildAvatarAura({ activityState: "live" }, now),
  "fire",
  "somebody training right now was not on fire"
);
assert.strictEqual(
  buildAvatarAura({ activityState: "done", lastWorkoutAt: daysAgo(60) }, now),
  "fire",
  "a workout finished today lost to a stale date and froze"
);
assert.strictEqual(
  buildAvatarAura({ activityState: "rest" }, now),
  null,
  "somebody who has never trained was frozen - they were never warm"
);

/* ------------------------------------------------------ the ice block -- */

const {
  buildFrostGeometry,
  iciclePath,
  FROST_RIM,
  ICICLE_MAX_LENGTH,
  SNOWFLAKE_COUNT,
} = loadAppModule("src/Utils/frostGeometry.js");

assert.strictEqual(buildFrostGeometry({ width: 0, height: 170 }), null, "an unmeasured tile drew frost");

const TILE = { width: 148, height: 170, cornerRadius: 20 };
const frost = buildFrostGeometry({ ...TILE, seed: 3 });

/** Every coordinate pair in a path string. */
function pointsOf(path) {
  const numbers = path.match(/-?\d+(\.\d+)?/g).map(Number);
  const points = [];

  for (let index = 0; index + 1 < numbers.length; index += 2) {
    points.push([numbers[index], numbers[index + 1]]);
  }

  return points;
}

const insideTile = ([x, y]) => x >= 0 && x <= TILE.width && y >= 0 && y <= TILE.height;
const allFrostPaths = [
  frost.crystals,
  ...frost.ferns.flatMap((group) => [group.stems, group.shoots]),
];

for (const path of allFrostPaths) {
  assert.ok(path.length > 0, "a frost layer came out empty");
  assert.ok(pointsOf(path).every(insideTile), "frost reached past the edge of the tile");
}

assert.ok(
  frost.ferns[0].stems.split("M").length > 8 && frost.ferns[1].stems.split("M").length > 8,
  "too few ferns to read as frost on every side"
);

// Icicles hang from under the rim, stay short, and keep out of the corners
// the tile's rounding has cut away.
assert.ok(frost.icicles.length >= 6, "the top edge has almost no icicles");

for (const icicle of frost.icicles) {
  assert.strictEqual(icicle.top, FROST_RIM - 1);
  assert.ok(icicle.length <= ICICLE_MAX_LENGTH, "an icicle hangs down over the music line");
  assert.ok(
    icicle.x >= TILE.cornerRadius && icicle.x <= TILE.width - TILE.cornerRadius,
    "an icicle hangs where the corner is rounded away"
  );
  assert.ok(pointsOf(iciclePath(icicle)).every(insideTile));
}

// Sparkles sit in the rim; snow falls inside it.
for (const sparkle of frost.sparkles) {
  const fromEdge = Math.min(sparkle.x, sparkle.y, TILE.width - sparkle.x, TILE.height - sparkle.y);

  assert.ok(fromEdge <= FROST_RIM, "a sparkle drifted off the rim into the tile");
}

assert.strictEqual(frost.snow.length, SNOWFLAKE_COUNT);
assert.ok(
  frost.snow.every((flake) => flake.x > FROST_RIM && flake.x < TILE.width - FROST_RIM),
  "a snowflake falls through the rim"
);

// The same tile keeps its frost; another tile has its own.
assert.deepStrictEqual(buildFrostGeometry({ ...TILE, seed: 3 }), frost, "the frost changed between renders");
assert.notDeepStrictEqual(
  buildFrostGeometry({ ...TILE, seed: 4 }).icicles,
  frost.icicles,
  "two frozen friends got the same icicles"
);

console.log("Friends tile wallpaper checks passed.");
