// Where the moving parts of a frozen friend tile go: the sparkles that blink
// along its icy rim and the flakes of snow that fall through it. The frost
// itself is a picture (scripts/art/generate-frost-texture.py); this is only
// what is drawn on top of it.
//
// Pure geometry, in the tile's own pixels, so it can be checked without a
// phone. Seeded, so every frozen tile sparkles in its own places and keeps
// them from one render to the next.

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

// How thick the ice is around the edge - the same 7 dp the texture draws.
export const FROST_RIM = 7;
export const SNOWFLAKE_COUNT = 5;
const SPARKLE_COUNT = 9;

const round = (value) => Math.round(value * 100) / 100;

// Glints on the rim, clear of the rounded corners, in three groups that
// twinkle out of step.
function buildSparkles(width, height, cornerRadius, random) {
  const middle = FROST_RIM / 2;
  const perimeter = [
    (d) => [cornerRadius + d * (width - cornerRadius * 2), middle],
    (d) => [width - middle, cornerRadius + d * (height - cornerRadius * 2)],
    (d) => [cornerRadius + d * (width - cornerRadius * 2), height - middle],
    (d) => [middle, cornerRadius + d * (height - cornerRadius * 2)],
  ];

  return Array.from({ length: SPARKLE_COUNT }, (_, index) => {
    const [x, y] = perimeter[index % 4](random());

    return { x: round(x), y: round(y), group: index % 3, size: round(2.4 + random() * 1.6) };
  });
}

// A few flakes falling inside the rim, each on its own speed and start.
function buildSnow(width, random) {
  return Array.from({ length: SNOWFLAKE_COUNT }, () => ({
    x: round(FROST_RIM + 6 + random() * (width - FROST_RIM * 2 - 12)),
    size: round(1.4 + random() * 1.4),
    durationMs: Math.round(6000 + random() * 4500),
    delayMs: Math.round(random() * 6000),
  }));
}

/**
 * The sparkles and snow for a tile of `width` x `height`, or null until the
 * tile has been measured.
 */
export function buildFrostGeometry({ width, height, seed = 1, cornerRadius = 20 }) {
  if (!(width > 0) || !(height > 0)) {
    return null;
  }

  const random = seededRandom(seed);

  return {
    width,
    height,
    sparkles: buildSparkles(width, height, cornerRadius, random),
    snow: buildSnow(width, random),
  };
}
