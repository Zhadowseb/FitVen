// Where the moving parts of an active friend's tile go: the embers rising off
// somebody training right now, the steam coming off somebody done for the
// day, and the little bolts popping round somebody who trained in the last
// five days. (Cobwebs, for a friend gone a month, are in cobwebGeometry.js.)
//
// Pure geometry, in the tile's own pixels, so it can be checked without a
// phone. Seeded, so every tile has its own and keeps it between renders.

// A small, fast, seedable generator: the same seed gives the same layout.
function seededRandom(seed) {
  let state = (Math.trunc(Number(seed) || 0) * 9973 + 17) >>> 0 || 1;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);

    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export const EMBER_COUNT = 12;
export const STEAM_PUFF_COUNT = 7;
// Little bolts per charge level: 3 just after a workout, 1 by the fifth day.
export const BOLTS_PER_LEVEL = 2;
// The avatar's centre and the room kept round it, so no bolt pops on a face.
// 56 is BAND_HEIGHT - AVATAR_OVERLAP + AVATAR_SIZE / 2 in FriendsActivityStyle.
export const AVATAR_CENTRE_Y = 56;
export const AVATAR_CLEARANCE = 36;

const round = (value) => Math.round(value * 100) / 100;

/* ------------------------------------------------------------- embers -- */

/**
 * Sparks rising off the bottom of the tile: each from its own point along
 * the bottom edge, drifting sideways as it climbs, some yellow-hot, some
 * orange.
 */
export function buildEmbers({ width, seed = 1 }) {
  const random = seededRandom(seed);

  return Array.from({ length: EMBER_COUNT }, () => ({
    x: round(10 + random() * (width - 20)),
    bottom: round(3 + random() * 14),
    size: round(1.2 + random() * 1.8),
    hot: random() < 0.5,
    rise: round(90 + random() * 70),
    drift: round((random() - 0.5) * 36),
    durationMs: Math.round(2400 + random() * 2400),
    delayMs: Math.round(random() * 3200),
  }));
}

/* -------------------------------------------------------------- steam -- */

/**
 * Steam coming off somebody done for the day, as soft puffs rather than
 * lines: each welling up from low in the tile, swelling as it rises and
 * thinning out before the top, overlapping the others so it reads as one
 * flowing mist.
 */
export function buildSteam({ width, height, seed = 1 }) {
  const random = seededRandom(seed);

  return Array.from({ length: STEAM_PUFF_COUNT }, (_, index) => {
    const lane = (width * (index + 0.5)) / STEAM_PUFF_COUNT;
    const size = 46 + random() * 34;

    return {
      x: round(lane + (random() - 0.5) * 18),
      y: round(height * (0.62 + random() * 0.3)),
      size: round(size),
      rise: round(height * (0.45 + random() * 0.25)),
      drift: round((random() - 0.5) * 22),
      durationMs: Math.round(4200 + random() * 2600),
      delayMs: Math.round(random() * 4200),
    };
  });
}

/* ------------------------------------------------------------- charge -- */

/**
 * The charge on somebody who trained in the last five days, ready to go
 * again: a glow pulsing steadily behind the avatar, and tiny bolts popping
 * up here and there around it, each in its own spot on its own timing.
 *
 * `level` is 3 just after a workout and 1 on the fifth day (chargeLevelFor).
 * It sets how many bolts there are and how often they pop - a lot and often
 * at first, the odd one by the end.
 */
export function buildCharge({
  width,
  height,
  seed = 1,
  level = 3,
  // What the glow sits behind and the bolts keep clear of: a friend tile's
  // avatar by default, the number on the days-since card.
  centre = null,
  clearance = AVATAR_CLEARANCE,
}) {
  if (!(width > 0) || !(height > 0)) {
    return null;
  }

  const random = seededRandom(seed);
  const clampedLevel = Math.max(1, Math.min(3, Math.round(level)));
  const count = clampedLevel * BOLTS_PER_LEVEL + 1;
  const focus = centre ?? { x: round(width / 2), y: AVATAR_CENTRE_Y };
  const bolts = [];
  let attempts = 0;

  while (bolts.length < count && attempts < 400) {
    attempts += 1;

    const x = 12 + random() * (width - 24);
    const y = 12 + random() * (height - 24);
    const nearAvatar = Math.hypot(x - focus.x, y - focus.y) < clearance;
    const nearAnother = bolts.some((bolt) => Math.hypot(bolt.x - x, bolt.y - y) < 22);

    if (nearAvatar || nearAnother) {
      continue;
    }

    bolts.push({
      x: round(x),
      y: round(y),
      size: round(7 + random() * 5),
      rotate: Math.round((random() - 0.5) * 50),
      // Rarer than it could be: a bolt means more when it is not constant.
      gapMs: Math.round(((1400 + random() * 2200) * (4 - clampedLevel) * 0.6 + 600) * 1.6),
      delayMs: Math.round(random() * 3000),
    });
  }

  return { width, height, centre: focus, bolts };
}

/**
 * A small lightning bolt, point down, in a `size` tall box centred on
 * (0, 0): the zig, the zag and the tail of the familiar sign, kept slim so it
 * reads as a spark rather than an icon.
 */
export function boltPath(size) {
  const unit = size / 10;
  const points = [
    [0.8, -5],
    [-1.6, 0.6],
    [-0.1, 0.6],
    [-0.9, 5],
    [1.7, -1.2],
    [0.25, -1.2],
    [1.2, -5],
  ];

  return (
    points
      .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${round(x * unit)} ${round(y * unit)}`)
      .join(" ") + " Z"
  );
}
