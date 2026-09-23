// The cobwebs on the tile of a friend who has not trained in a month: webs
// strung across its top corners and its bottom right, a loose strand between
// them, a spider on a thread, and a little dust in the air.
//
// Pure geometry, in the tile's own pixels, so it can be checked without a
// phone. Seeded, so every dusty tile has its own webs and keeps them from one
// render to the next.

// A small, fast, seedable generator: the same seed gives the same webs.
function seededRandom(seed) {
  let state = (Math.trunc(Number(seed) || 0) * 9973 + 17) >>> 0 || 1;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);

    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export const DUST_COUNT = 6;
// The bottom left is where the status line starts: no web there.
export const COBWEB_CORNERS = ["topLeft", "topRight", "bottomRight"];

const round = (value) => Math.round(value * 100) / 100;
const point = ([x, y]) => `${round(x)} ${round(y)}`;

// Where each corner's web hangs from, and the quarter of the circle it fills:
// from one wall to the other.
function cornerFrame(corner, width, height, inset) {
  switch (corner) {
    case "topLeft":
      return { anchor: [inset, inset], from: 0, to: 90 };
    case "topRight":
      return { anchor: [width - inset, inset], from: 90, to: 180 };
    default:
      return { anchor: [width - inset, height - inset], from: 180, to: 270 };
  }
}

/**
 * One corner web, as an old one looks rather than a drawing of one: spokes
 * fanning out from the corner at uneven angles and lengths, rings of silk
 * strung between them at uneven spacing, each sagging back towards the
 * corner under its own weight, some doubled, some missing, a few broken
 * threads hanging loose, and a thin sheet of matted silk close to the corner
 * where the spider walked most.
 */
// Webs are drawn for a 148 dp friend tile; a narrower box gets smaller ones.
const WEB_REFERENCE_WIDTH = 148;

function buildWeb(corner, width, height, cornerRadius, random) {
  const inset = cornerRadius * 0.32;
  const { anchor, from, to } = cornerFrame(corner, width, height, inset);
  const scale = Math.min(1, width / WEB_REFERENCE_WIDTH);
  const size = ((corner === "bottomRight" ? 30 : 38) + random() * 12) * scale;
  const spokeCount = 7 + Math.floor(random() * 2);
  const spokes = Array.from({ length: spokeCount }, (_, index) => {
    const isWall = index === 0 || index === spokeCount - 1;
    const t = index / (spokeCount - 1);
    const jitter = isWall ? 0 : (random() - 0.5) * 16;
    const angle = ((from + (to - from) * t + jitter) * Math.PI) / 180;
    // The two that run along the walls reach furthest: that is where the web
    // is fixed.
    const length = size * (isWall ? 1.1 : 0.58 + random() * 0.42);

    return { angle, length, dx: Math.cos(angle), dy: Math.sin(angle) };
  });
  const at = (spoke, distance) => [anchor[0] + spoke.dx * distance, anchor[1] + spoke.dy * distance];
  const spokePath = spokes.map((spoke) => `M ${point(anchor)} L ${point(at(spoke, spoke.length))}`).join(" ");

  // Uneven spacing, tighter towards the corner.
  const ringCount = 6 + Math.floor(random() * 2);
  const fractions = Array.from({ length: ringCount }, (_, ring) =>
    Math.min(0.97, (((ring + 0.6 + (random() - 0.5) * 0.5) / ringCount) ** 1.15))
  ).sort((left, right) => left - right);

  const rings = [];
  const doubled = [];
  const loose = [];
  const sheets = [];

  fractions.forEach((fraction, ringIndex) => {
    for (let index = 0; index < spokeCount - 1; index += 1) {
      const left = spokes[index];
      const right = spokes[index + 1];
      const reach = Math.min(left.length, right.length) * fraction;

      if (reach < 3) {
        continue;
      }

      const start = at(left, reach * (0.94 + random() * 0.12));
      const end = at(right, reach * (0.94 + random() * 0.12));

      if (random() < 0.12) {
        // Torn: the thread broke and one end hangs down.
        if (random() < 0.6) {
          const drop = 5 + random() * 9;
          loose.push(
            `M ${point(start)} Q ${point([start[0] + (end[0] - start[0]) * 0.25, start[1] + drop * 0.4])} ${point([start[0] + (end[0] - start[0]) * 0.18, start[1] + drop])}`
          );
        }
        continue;
      }

      const middle = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
      const span = Math.hypot(end[0] - start[0], end[1] - start[1]);
      const toAnchor = [anchor[0] - middle[0], anchor[1] - middle[1]];
      const toAnchorLength = Math.hypot(...toAnchor) || 1;
      const sag = span * (0.1 + random() * 0.26);
      // Gravity pulls a little too, whichever corner the web is in.
      const control = [
        middle[0] + (toAnchor[0] / toAnchorLength) * sag,
        middle[1] + (toAnchor[1] / toAnchorLength) * sag + span * 0.06,
      ];
      const thread = `M ${point(start)} Q ${point(control)} ${point(end)}`;

      rings.push(thread);

      if (random() < 0.22) {
        const offset = 0.6 + random() * 0.8;

        doubled.push(
          `M ${point([start[0] + offset, start[1] + offset])} Q ${point([control[0], control[1] + offset * 1.6])} ${point([end[0] + offset, end[1] + offset])}`
        );
      }

      // Matted silk near the corner, filling the odd sector.
      if (ringIndex < 3 && random() < 0.3) {
        sheets.push(`M ${point(anchor)} L ${point(start)} Q ${point(control)} ${point(end)} Z`);
      }
    }
  });

  return {
    corner,
    anchor: anchor.map(round),
    spokes: spokePath,
    rings: rings.join(" "),
    doubled: doubled.join(" "),
    loose: loose.join(" "),
    sheets: sheets.join(" "),
    reach: round(size * 1.1),
  };
}

// A single thread drooping across the top of the tile between the two top
// webs, like the first strand of a web nobody finished.
function buildStrand(width, cornerRadius, random) {
  const y = cornerRadius * 0.32 + 2;
  const start = [width * (0.22 + random() * 0.06), y];
  const end = [width * (0.72 + random() * 0.06), y];
  const sag = 7 + random() * 6;
  const control = [(start[0] + end[0]) / 2, y + sag * 2];

  return `M ${point(start)} Q ${point(control)} ${point(end)}`;
}

// Where the spider hangs: from the top edge, right of the avatar so it never
// crosses the face, over the watermark rather than the text.
function buildSpider(width, random) {
  return {
    x: round(width * (0.78 + random() * 0.08)),
    top: 0,
    restDrop: round(16 + random() * 6),
    maxDrop: round(46 + random() * 14),
  };
}

// Specks of dust drifting down through the tile, slowly.
function buildDust(width, random) {
  return Array.from({ length: DUST_COUNT }, () => ({
    x: round(12 + random() * (width - 24)),
    size: round(0.8 + random() * 1.1),
    durationMs: Math.round(9000 + random() * 7000),
    delayMs: Math.round(random() * 8000),
    drift: round((random() - 0.5) * 16),
  }));
}

/**
 * Everything a dusty tile draws, for a tile of `width` x `height`, or null
 * until the tile has been measured.
 */
export function buildCobwebGeometry({ width, height, seed = 1, cornerRadius = 20 }) {
  if (!(width > 0) || !(height > 0)) {
    return null;
  }

  const random = seededRandom(seed);

  return {
    width,
    height,
    webs: COBWEB_CORNERS.map((corner) => buildWeb(corner, width, height, cornerRadius, random)),
    strand: buildStrand(width, cornerRadius, random),
    spider: buildSpider(width, random),
    dust: buildDust(width, random),
  };
}

/**
 * The small web over the corner of a dusty avatar, in the 100 x 100 box the
 * avatar auras are drawn in, anchored on the ring at its upper left and
 * reaching in over the picture.
 */
export function buildAvatarWeb(avatarRadius) {
  const anchorAngle = (-135 * Math.PI) / 180;
  const anchor = [50 + Math.cos(anchorAngle) * avatarRadius, 50 + Math.sin(anchorAngle) * avatarRadius];
  const spokes = [-40, -20, 0, 20, 40].map((offset, index) => {
    const angle = ((45 + offset) * Math.PI) / 180;
    const length = [15, 18, 20, 18, 15][index];

    return { dx: Math.cos(angle), dy: Math.sin(angle), length };
  });
  const at = (spoke, distance) => [anchor[0] + spoke.dx * distance, anchor[1] + spoke.dy * distance];
  const spokePath = spokes.map((spoke) => `M ${point(anchor)} L ${point(at(spoke, spoke.length))}`).join(" ");
  const rings = [];

  for (const fraction of [0.35, 0.6, 0.85]) {
    for (let index = 0; index < spokes.length - 1; index += 1) {
      const start = at(spokes[index], spokes[index].length * fraction);
      const end = at(spokes[index + 1], spokes[index + 1].length * fraction);
      const control = [
        (start[0] + end[0]) / 2 + (anchor[0] - (start[0] + end[0]) / 2) * 0.18,
        (start[1] + end[1]) / 2 + (anchor[1] - (start[1] + end[1]) / 2) * 0.18,
      ];

      rings.push(`M ${point(start)} Q ${point(control)} ${point(end)}`);
    }
  }

  return { spokes: spokePath, rings: rings.join(" ") };
}
