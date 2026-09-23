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
  buildRestWallpaper,
  wallpaperColorForDays,
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

console.log("Friends tile wallpaper checks passed.");
