// The shapes that turn a friend tile into a block of ice: a thick glassy rim,
// frost ferns growing in from every edge, a scatter of crystals, short
// icicles under the top of the rim, sparkles along it and a little falling
// snow.
//
// Pure geometry, in the tile's own pixels, so it can be checked without a
// phone. Seeded, so every frozen tile has its own frost and a tile keeps the
// same frost from one render to the next.

// A small, fast, seedable generator: the same seed gives the same frost.
function seededRandom(seed) {
  let state = (Math.trunc(Number(seed) || 0) * 9973 + 17) >>> 0 || 1;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);

    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

// How thick the ice is around the edge.
export const FROST_RIM = 7;
// No icicle is longer than this, so the music line at the top stays readable.
export const ICICLE_MAX_LENGTH = 12;
export const SNOWFLAKE_COUNT = 5;

const round = (value) => Math.round(value * 100) / 100;

function clampPoint(x, y, width, height) {
  return [round(Math.min(width, Math.max(0, x))), round(Math.min(height, Math.max(0, y)))];
}

function segment(from, to) {
  return `M ${from[0]} ${from[1]} L ${to[0]} ${to[1]}`;
}

/**
 * One frost fern: a stem growing from (x, y) at `angle` degrees, feathered
 * with side shoots that shorten towards the tip, and a small fork at the end.
 * With `detail`, every shoot grows two twigs of its own - the big feathery
 * sprays in the corners. Returned as two path strings, because the stem and
 * the shoots are drawn at different weights.
 */
function fern(x, y, angle, length, width, height, detail = false) {
  const rad = (angle * Math.PI) / 180;
  const at = (distance, offsetAngle = 0, from = [x, y]) => [
    from[0] + Math.cos(rad + offsetAngle) * distance,
    from[1] + Math.sin(rad + offsetAngle) * distance,
  ];
  const tip = at(length);
  const stems = [segment(clampPoint(x, y, width, height), clampPoint(...tip, width, height))];
  const shoots = [];

  for (const along of [0.22, 0.38, 0.54, 0.7, 0.84]) {
    const base = at(length * along);
    const shootLength = length * 0.36 * (1 - along * 0.6);

    for (const side of [-1, 1]) {
      const shootTip = at(shootLength, side * 0.95, base);

      shoots.push(
        segment(clampPoint(...base, width, height), clampPoint(...shootTip, width, height))
      );

      if (detail) {
        const twigBase = [(base[0] + shootTip[0]) / 2, (base[1] + shootTip[1]) / 2];

        for (const twigSide of [-1, 1]) {
          shoots.push(
            segment(
              clampPoint(...twigBase, width, height),
              clampPoint(
                ...at(shootLength * 0.45, side * 0.95 + twigSide * 0.8, twigBase),
                width,
                height
              )
            )
          );
        }
      }
    }
  }

  for (const side of [-1, 1]) {
    shoots.push(
      segment(
        clampPoint(...tip, width, height),
        clampPoint(...at(length * 0.14, side * 0.5, tip), width, height)
      )
    );
  }

  return { stem: stems.join(" "), shoots: shoots.join(" ") };
}

// Ferns along every edge, in from the rim, and a denser, longer spray out of
// each rounded corner. Alternate ferns go into two groups, which shimmer out
// of step.
function buildFerns(width, height, cornerRadius, random) {
  const groups = [
    { stems: [], shoots: [] },
    { stems: [], shoots: [] },
  ];
  let count = 0;
  const add = (x, y, angle, length, detail = false) => {
    const { stem, shoots } = fern(x, y, angle, length, width, height, detail);
    const group = groups[count % 2];

    group.stems.push(stem);
    group.shoots.push(shoots);
    count += 1;
  };
  const edges = [
    // [along-length, point for a distance along, inward angle, length range]
    { span: height, point: (d) => [FROST_RIM, d], angle: 0, min: 9, max: 19 },
    { span: height, point: (d) => [width - FROST_RIM, d], angle: 180, min: 9, max: 19 },
    { span: width, point: (d) => [d, height - FROST_RIM], angle: -90, min: 9, max: 18 },
    // The top is where the music line and the avatar are: shorter frost.
    { span: width, point: (d) => [d, FROST_RIM], angle: 90, min: 5, max: 10 },
  ];

  for (const edge of edges) {
    let distance = cornerRadius + random() * 8;

    while (distance < edge.span - cornerRadius) {
      const [x, y] = edge.point(distance);

      add(x, y, edge.angle + (random() - 0.5) * 44, edge.min + random() * (edge.max - edge.min));
      distance += 11 + random() * 8;
    }
  }

  const inset = cornerRadius * (1 - Math.SQRT1_2) + FROST_RIM * 0.6;
  // The corners are where frost starts on glass, so they get the most: five
  // feathered branches fanning out, reaching well into the tile.
  const corners = [
    { x: inset, y: inset, angle: 45, scale: 0.65 },
    { x: width - inset, y: inset, angle: 135, scale: 0.65 },
    { x: inset, y: height - inset, angle: -45, scale: 1 },
    { x: width - inset, y: height - inset, angle: -135, scale: 1 },
  ];

  for (const corner of corners) {
    for (let branch = 0; branch < 5; branch += 1) {
      add(
        corner.x,
        corner.y,
        corner.angle + (branch - 2) * 21 + (random() - 0.5) * 10,
        (22 + random() * 14) * corner.scale * (branch === 2 ? 1.15 : 1),
        true
      );
    }
  }

  return groups.map((group) => ({
    stems: group.stems.join(" "),
    shoots: group.shoots.join(" "),
  }));
}

// Loose six-armed crystals, near the edges but not on them.
function buildCrystals(width, height, random) {
  const paths = [];

  for (let index = 0; index < 8; index += 1) {
    const side = index % 4;
    const inward = FROST_RIM + 8 + random() * 14;
    const along = 0.18 + random() * 0.64;
    const [x, y] =
      side === 0
        ? [inward, height * along]
        : side === 1
          ? [width - inward, height * along]
          : side === 2
            ? [width * along, height - inward]
            : [width * along, FROST_RIM + 6 + random() * 6];
    const arm = 2 + random() * 2.5;

    for (const angle of [0, 60, 120]) {
      const rad = (angle * Math.PI) / 180;

      paths.push(
        segment(
          clampPoint(x - Math.cos(rad) * arm, y - Math.sin(rad) * arm, width, height),
          clampPoint(x + Math.cos(rad) * arm, y + Math.sin(rad) * arm, width, height)
        )
      );
    }
  }

  return paths.join(" ");
}

// Short icicles hanging from the underside of the rim along the top, kept
// out of the rounded corners.
function buildIcicles(width, cornerRadius, random) {
  const icicles = [];
  let x = cornerRadius + random() * 6;

  while (x < width - cornerRadius) {
    const isLong = random() < 0.3;
    const length = isLong ? 7 + random() * (ICICLE_MAX_LENGTH - 7) : 3 + random() * 3.5;
    const iceWidth = isLong ? 4 + random() * 2 : 2.5 + random() * 1.5;

    icicles.push({ x: round(x), width: round(iceWidth), length: round(length), top: FROST_RIM - 1, isLong });
    x += iceWidth + 3 + random() * 7;
  }

  return icicles;
}

// Glints on the rim, in three groups that twinkle out of step.
function buildSparkles(width, height, cornerRadius, random) {
  const middle = FROST_RIM / 2;
  const perimeter = [
    (d) => [cornerRadius + d * (width - cornerRadius * 2), middle],
    (d) => [width - middle, cornerRadius + d * (height - cornerRadius * 2)],
    (d) => [cornerRadius + d * (width - cornerRadius * 2), height - middle],
    (d) => [middle, cornerRadius + d * (height - cornerRadius * 2)],
  ];

  return Array.from({ length: 9 }, (_, index) => {
    const [x, y] = perimeter[index % 4](random());

    return { x: round(x), y: round(y), group: index % 3, size: round(2.4 + random() * 1.6) };
  });
}

// A few flakes falling through the tile, each on its own speed and start.
function buildSnow(width, random) {
  return Array.from({ length: SNOWFLAKE_COUNT }, () => ({
    x: round(FROST_RIM + 6 + random() * (width - FROST_RIM * 2 - 12)),
    size: round(1.4 + random() * 1.4),
    durationMs: Math.round(6000 + random() * 4500),
    delayMs: Math.round(random() * 6000),
  }));
}

/**
 * Everything a frozen tile draws, for a tile of `width` x `height`, or null
 * until the tile has been measured.
 */
export function buildFrostGeometry({ width, height, seed = 1, cornerRadius = 20 }) {
  if (!(width > 0) || !(height > 0)) {
    return null;
  }

  const random = seededRandom(seed);

  return {
    width,
    height,
    rim: FROST_RIM,
    ferns: buildFerns(width, height, cornerRadius, random),
    crystals: buildCrystals(width, height, random),
    icicles: buildIcicles(width, cornerRadius, random),
    sparkles: buildSparkles(width, height, cornerRadius, random),
    snow: buildSnow(width, random),
  };
}

/** One icicle as a path: a slightly lopsided drop, point down. */
export function iciclePath({ x, width, length, top }) {
  const half = width / 2;
  const tip = top + length;

  return [
    `M ${round(x - half)} ${top}`,
    `Q ${round(x - width * 0.3)} ${round(top + length * 0.5)} ${round(x)} ${round(tip)}`,
    `Q ${round(x + width * 0.25)} ${round(top + length * 0.45)} ${round(x + half)} ${top}`,
    "Z",
  ].join(" ");
}
