// Where the moving parts of an active friend's tile go: the embers rising off
// somebody training right now, the steam coming off somebody done for the
// day, and the motes of energy drifting round somebody who trained in the
// last three days. (Cobwebs, for a friend gone a month, are in
// cobwebGeometry.js.)
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
// Motes of energy per charge level: 3 the day after a workout, 1 by the third.
export const MOTES_PER_LEVEL = 2;

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
 * The energy on somebody who trained in the last three days: a few motes of
 * light drifting lazily about the tile, each wandering its own slow loop
 * and glowing up and down. Calm on purpose - energy kept in reserve, not
 * going off. `level` is 3 the day after a workout, 1 on the third day, and
 * sets how many motes there are.
 */
export function buildCharge({ width, height, seed = 1, level = 3 }) {
  if (!(width > 0) || !(height > 0)) {
    return null;
  }

  const random = seededRandom(seed);
  const count = Math.max(1, Math.min(3, Math.round(level))) * MOTES_PER_LEVEL;

  return {
    width,
    height,
    motes: Array.from({ length: count }, () => ({
      x: round(18 + random() * (width - 36)),
      y: round(22 + random() * (height - 44)),
      rangeX: round(10 + random() * 14),
      rangeY: round(8 + random() * 12),
      periodXMs: Math.round(5200 + random() * 3600),
      periodYMs: Math.round(6400 + random() * 4200),
      pulseMs: Math.round(2600 + random() * 1800),
      size: round(1.6 + random() * 1.4),
    })),
  };
}
