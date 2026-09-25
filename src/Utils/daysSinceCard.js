// The maths behind the days-since card on Home: which of its seven states it
// is in, how its number rolls, where its edge runs, and where every spark,
// plume and speck of dust goes.
//
// Pure, so it can be checked without a phone, and seeded, so the card keeps
// the same embers and the same dust from one visit to Home to the next. The
// few functions a worklet calls every frame carry the "worklet" directive;
// in Node it is an ignored string.
//
// Sizes: a layout takes the card's outer size, `width` x `height`, and is
// drawn from the top left of its padding box - the frame the prototype drew
// its surfaces in. The edge takes the padding box itself (see edgeGeometry).
import { mixHexColors } from "./colorMix";
import {
  CHARGED_WITHIN_DAYS,
  COBWEB_FROM_DAYS,
  buildTileCrown,
  buildTileMood,
  wallpaperColorForDays,
} from "./friendsActivityUtils";
import {
  EASE_IN_OUT,
  EASE_OUT,
  cubicBezier,
  loopProgress,
  onceProgress,
  sampleTrack,
} from "./keyframeTimeline";

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

const round = (value) => Math.round(value * 100) / 100;
const between = (random, low, high) => low + random() * (high - low);

/* -------------------------------------------------------------- state -- */

// In the order they are listed in the design.
export const DAYS_SINCE_STATES = ["live", "today", "record", "charged", "cool", "cobweb", "never"];

// The states that show the day count. Live shows a fire in its place, never
// a dash.
const COUNTING_STATES = new Set(["today", "record", "charged", "cool", "cobweb"]);

// Cooling runs from the first day the charge is gone to the last day before
// the cobwebs: 6 to 29, as the friend tiles count it.
export const COOL_FIRST_DAY = CHARGED_WITHIN_DAYS + 1;
export const COOL_LAST_DAY = COBWEB_FROM_DAYS - 1;

/**
 * The card's state, from what Home knows: "live" while a workout is running,
 * "today" once one is done today - "record" if it set a personal record -
 * "charged" for five days after, "cool" until a month has gone, then
 * "cobweb". "never" without a single workout.
 *
 * The same moods as your tile in the friends strip (buildTileMood and
 * buildTileCrown), so the two can never disagree about where you are.
 */
export function resolveDaysSinceState({ days = null, isTraining = false, recordsToday = 0 } = {}) {
  const person = {
    activityState: isTraining ? "live" : undefined,
    daysSinceLastWorkout: Number.isFinite(days) ? days : null,
    recordsToday,
  };

  switch (buildTileMood(person)) {
    case "embers":
      return "live";
    case "steam":
      return buildTileCrown(person) ? "record" : "today";
    case "charged":
      return "charged";
    case "cobweb":
      return "cobweb";
    default:
      return Number.isFinite(days) ? "cool" : "never";
  }
}

export function showsDayCount(state) {
  return COUNTING_STATES.has(state);
}

/** The card's colour in each state - the colour of your friend tile's mood. */
export function daysSinceAccent(state, days, theme) {
  switch (state) {
    case "live":
      return theme.fire;
    case "today":
    case "record":
      return theme.secondary;
    case "charged":
      return theme.charge;
    case "cool":
      return (
        wallpaperColorForDays(days, [
          theme.heatHot,
          theme.heatWarm,
          theme.heatCool,
          theme.quietText,
        ]) ?? theme.quietText
      );
    default:
      return theme.quietText;
  }
}

/**
 * How much fire is left while cooling: 1 on the sixth day, 0 by the 29th.
 * The flame shrinks and dims with it, the ember glow cools towards grey, and
 * the comet round the edge slows from 9 to 16 seconds a lap.
 */
export function coolWarmth(days) {
  const span = COOL_LAST_DAY - COOL_FIRST_DAY;

  return 1 - Math.min(1, Math.max(0, (Number(days) - COOL_FIRST_DAY) / span));
}

export function coolLook(days, theme) {
  const warmth = coolWarmth(days);
  const cold = 1 - warmth;
  const ember = mixHexColors(theme.fire, theme.quietText, cold);

  return {
    warmth,
    flameScale: round(1 - cold * 0.42),
    flameOpacity: round(0.95 - cold * 0.4),
    glowColor: ember,
    glowOpacity: round(0.22 * warmth + 0.05),
    cometColor: ember,
    cometOpacity: round(0.3 + 0.6 * warmth),
    cometLapMs: Math.round(9000 + 7000 * cold),
  };
}

/** How full the energy fill is on a charged day: 1 the day after, 0.2 on the fifth. */
export function chargeFillLevel(days) {
  const level = (CHARGED_WITHIN_DAYS + 1 - Number(days)) / CHARGED_WITHIN_DAYS;

  return Math.min(1, Math.max(0, level));
}

/* ----------------------------------------------------------- odometer -- */

// One line of the number: its font size and line height, and the height each
// digit column is clipped to.
export const ODOMETER_LINE = 32;
export const ODOMETER_STAGGER_MS = 80;
// An entrance spins a full extra turn; a single step - midnight - does not.
export const ODOMETER_SPIN_MS = 1050;
export const ODOMETER_STEP_MS = 620;
export const ODOMETER_FADE_MS = 300;
export const ODOMETER_CURVE = [0.2, 0.85, 0.25, 1.08];
// A workout today rolls the counter down to zero from here.
export const TODAY_ROLLS_FROM = 3;
// How many digits a column's strip holds: 0-9 and a second 0, so a column
// can pass 9 and come round to 0 without a jump.
export const ODOMETER_STRIP = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

/**
 * How the number rolls in, as a column per digit: where each column's strip
 * starts and ends, counted in digits along a strip of 0-9 repeated, and
 * whether the column is shown before and after (a column only one side has
 * fades in or out).
 *
 *   - `from` is the number the card showed last, when it showed one: it rolls
 *     from there, one step, up or down.
 *   - Otherwise a workout today rolls down from 3 to 0, and anything else
 *     spins up from 0 with an extra turn.
 */
export function planOdometer({ to, from = null }) {
  const target = Math.max(0, Math.trunc(Number(to) || 0));
  const previous = Number.isFinite(from) ? Math.max(0, Math.trunc(from)) : null;
  let start;
  let spin = false;
  let down = false;

  if (previous !== null && previous !== target) {
    start = previous;
    down = target < previous;
  } else if (target === 0) {
    start = TODAY_ROLLS_FROM;
    down = true;
  } else {
    start = 0;
    spin = true;
  }

  const length = Math.max(String(start).length, String(target).length);
  const fromText = String(start).padStart(length, " ");
  const toText = String(target).padStart(length, " ");
  const extra = spin ? 10 : 0;
  const columns = [];

  for (let index = 0; index < length; index += 1) {
    const fromDigit = fromText[index] === " " ? 0 : Number(fromText[index]);
    const toDigit = toText[index] === " " ? 0 : Number(toText[index]);
    const begin = down ? 30 + fromDigit : 10 + fromDigit;
    const end = down
      ? begin - ((fromDigit - toDigit + 10) % 10) - extra
      : begin + ((toDigit - fromDigit + 10) % 10) + extra;

    columns.push({
      start: begin,
      end,
      shownBefore: fromText[index] !== " ",
      shownAfter: toText[index] !== " ",
    });
  }

  const durationMs = spin ? ODOMETER_SPIN_MS : ODOMETER_STEP_MS;

  return {
    from: start,
    to: target,
    spin,
    down,
    durationMs,
    totalMs: durationMs + (length - 1) * ODOMETER_STAGGER_MS,
    columns,
  };
}

/** Where a column's strip is, in digits, `elapsed` ms into the roll. */
export function odometerPosition(column, index, elapsed, durationMs) {
  "worklet";
  const t = (elapsed - index * ODOMETER_STAGGER_MS) / durationMs;
  const eased = cubicBezier(
    ODOMETER_CURVE[0],
    ODOMETER_CURVE[1],
    ODOMETER_CURVE[2],
    ODOMETER_CURVE[3],
    t <= 0 ? 0 : t >= 1 ? 1 : t
  );

  return column.start + (column.end - column.start) * eased;
}

/** A column fading in or out as it gains or loses its digit. */
export function odometerOpacity(column, index, elapsed) {
  "worklet";
  const before = column.shownBefore ? 1 : 0;
  const after = column.shownAfter ? 1 : 0;

  if (before === after) {
    return after;
  }

  const t = onceProgress(elapsed, index * ODOMETER_STAGGER_MS, ODOMETER_FADE_MS);

  return before + (after - before) * cubicBezier(0.25, 0.1, 0.25, 1, t);
}

/**
 * The same position on the short strip: 0 up to (not including) 10, where 10
 * is the strip's second 0. The strip is ODOMETER_STRIP; its line `k` sits at
 * `k * ODOMETER_LINE`.
 */
export function odometerStripOffset(position) {
  "worklet";
  return ((position % 10) + 10) % 10;
}

/** The digit a column reads once it has stopped. */
export function odometerDigitAt(position) {
  return ODOMETER_STRIP[Math.round(odometerStripOffset(position)) % 10];
}

/* --------------------------------------------------------------- edge -- */

// The edge runs 1 dp inside the card's padding box - the children are cut
// to it, so a stroke centred on the border itself would lose half its width
// - and bends concentric with the card's corners: 18 less the 1 dp border
// less the 1 dp inset.
export const EDGE_INSET = 1;
export const EDGE_RADIUS = 16;

/** 2(w + h) - (8 - 2 pi) r: a rounded rectangle's perimeter. */
export function roundedRectPerimeter(width, height, radius) {
  return 2 * (width + height) - (8 - 2 * Math.PI) * radius;
}

/**
 * The edge as a path, for a padding box of `width` x `height`: clockwise,
 * starting where the top straight begins, as an SVG rect does in a browser.
 * A path rather than a Rect because Android and iOS start a rounded rect's
 * outline at different corners, and a dash has to start in the same place on
 * both. `perimeter` is its length, the unit every dash below is measured in -
 * pathLength is not reliable in react-native-svg.
 */
export function edgeGeometry(width, height, { inset = EDGE_INSET, radius = EDGE_RADIUS } = {}) {
  const left = inset;
  const top = inset;
  const right = width - inset;
  const bottom = height - inset;
  const r = Math.max(0, Math.min(radius, (right - left) / 2, (bottom - top) / 2));
  const d = [
    `M ${round(left + r)} ${round(top)}`,
    `H ${round(right - r)}`,
    `A ${r} ${r} 0 0 1 ${round(right)} ${round(top + r)}`,
    `V ${round(bottom - r)}`,
    `A ${r} ${r} 0 0 1 ${round(right - r)} ${round(bottom)}`,
    `H ${round(left + r)}`,
    `A ${r} ${r} 0 0 1 ${round(left)} ${round(bottom - r)}`,
    `V ${round(top + r)}`,
    `A ${r} ${r} 0 0 1 ${round(left + r)} ${round(top)}`,
    "Z",
  ].join(" ");

  return {
    d,
    perimeter: roundedRectPerimeter(right - left, bottom - top, r),
    radius: r,
  };
}

/** A dash of `percent` of the way round, in dp. */
export function edgeDash(percent, perimeter) {
  return (percent / 100) * perimeter;
}

// A comet is three dashes whose heads line up: the longer ones fainter and
// wider, so it trails.
export const COMET_TRAIL = [
  { length: 2.4, extraWidth: 3, opacity: 0.14 },
  { length: 1.5, extraWidth: 1.2, opacity: 0.35 },
  { length: 1, extraWidth: 0, opacity: 1 },
];

/**
 * The three dashes of a comet `lengthPercent` of the edge long, tail first:
 * each one's length and gap in dp, its width and its opacity.
 */
export function cometDashes(lengthPercent, perimeter, { width = 2, opacity = 1 } = {}) {
  return COMET_TRAIL.map((part) => {
    const percent = Math.round(lengthPercent * part.length * 10) / 10;
    const length = edgeDash(percent, perimeter);

    return {
      length,
      gap: Math.max(0, perimeter - length),
      strokeWidth: round(width + part.extraWidth),
      strokeOpacity: round(part.opacity * opacity),
    };
  });
}

/**
 * The dash offset that puts a dash's head `lap` of the way round (0 to 1),
 * whatever its length - which is what keeps a comet's heads together.
 */
export function cometOffset(length, perimeter, lap) {
  "worklet";
  return length - perimeter * lap;
}

/* ------------------------------------------------------------ layouts -- */

// The card's own layout is seeded the same every time.
export const DAYS_SINCE_SEED = 7;

/**
 * Live: tongues of fire along the bottom - a row of eight in the fire's
 * gradient and a smaller row of eight in its core colour - the embers that
 * fly up out of the big fire, and the burst of sparks each time it flares.
 */
export function buildLiveLayout({ width, height, seed = DAYS_SINCE_SEED }) {
  const random = seededRandom(seed);
  const row = (scale) =>
    Array.from({ length: 8 }, (_, index) => ({
      x: round(6 + (index * (width - 12)) / 7),
      height: round(between(random, 14, 28) * scale),
      width: round(between(random, 13, 18) * scale),
      durationMs: Math.round(between(random, 320, 620)),
      delayMs: -Math.round(between(random, 0, 800)),
    }));
  const tongues = { outer: row(1), core: row(0.5) };
  const embers = Array.from({ length: 14 }, (_, index) => ({
    size: round(1.6 + random() * 2),
    // fire, the colour between fire and charge, chargeCore - in turn.
    tone: index % 3,
    x: Math.round((random() - 0.5) * 46),
    rise: Math.round(38 + random() * 30),
    durationMs: Math.round(900 + random() * 900),
    delayMs: Math.round(700 + random() * 1500),
  }));
  // Ten sparks fanned over the top half of a circle, 26 to 40 dp out; every
  // other one in the core colour, so each colour can be one path.
  const burst = { fire: [], core: [] };

  for (let index = 0; index < 10; index += 1) {
    const angle = Math.PI * (0.05 + (0.9 * index) / 9);
    const reach = 26 + (index % 3) * 7;

    (index % 2 === 1 ? burst.core : burst.fire).push({
      x: Math.round(-Math.cos(angle) * reach),
      y: Math.round(-Math.sin(angle) * reach),
    });
  }

  return { width, height, tongues, embers, burst };
}

// A tongue's keyframes, played to and fro: scale about the middle of its foot.
export const TONGUE_SCALE_X = [
  [0, 0.75],
  [0.5, 1.1],
  [1, 0.9],
];
export const TONGUE_SCALE_Y = [
  [0, 0.55],
  [0.5, 1.05],
  [1, 1.25],
];

/**
 * One row of tongues as a single path, at `time` ms: each tongue licking at
 * its own pace, the row `rise` dp below where it ends up. One path a row
 * keeps sixteen flames down to two animated nodes.
 */
export function tongueRowPath(tongues, baseY, rise, time) {
  "worklet";
  let d = "";
  const y = baseY + rise;

  for (let index = 0; index < tongues.length; index += 1) {
    const tongue = tongues[index];
    const p = loopProgress(time, tongue.delayMs, tongue.durationMs, "alternate");
    const w = tongue.width * sampleTrack(TONGUE_SCALE_X, p, EASE_IN_OUT);
    const h = tongue.height * sampleTrack(TONGUE_SCALE_Y, p, EASE_IN_OUT);
    const x = tongue.x;
    // Rounded to a tenth: a shorter string for the path parser, every frame.
    const left = Math.round((x - w / 2) * 10) / 10;
    const right = Math.round((x + w / 2) * 10) / 10;
    const innerLeft = Math.round((x - w * 0.12) * 10) / 10;
    const innerRight = Math.round((x + w * 0.12) * 10) / 10;
    const shoulder = Math.round((y - h * 0.4) * 10) / 10;
    const waist = Math.round((y - h * 0.7) * 10) / 10;
    const tip = Math.round((y - h) * 10) / 10;
    const foot = Math.round(y * 10) / 10;

    d +=
      `M${left} ${foot}C${left} ${shoulder} ${innerLeft} ${waist} ${x} ${tip}` +
      `C${innerRight} ${waist} ${right} ${shoulder} ${right} ${foot}Z`;
  }

  return d;
}

// The burst each time the fire flares: every spark leaves the fire's foot
// at once and flies out along its own line, shrinking as it goes.
export const BURST_REACH = [
  [0, 0],
  [0.03, 0],
  [0.24, 1],
  [1, 0],
];
export const BURST_SCALE = [
  [0, 1.4],
  [0.03, 1.4],
  [0.24, 0.3],
  [1, 1],
];
export const BURST_OPACITY = [
  [0, 0],
  [0.03, 0],
  [0.05, 1],
  [0.24, 0],
  [1, 0],
];
export const BURST_SPARK_RADIUS = 1.5;

/** The sparks of one colour as a single path of circles, `reach` of the way out. */
export function burstPath(sparks, originX, originY, reach, radius) {
  "worklet";
  let d = "";
  const r = Math.round(radius * 100) / 100;

  for (let index = 0; index < sparks.length; index += 1) {
    const cx = Math.round((originX + sparks[index].x * reach) * 10) / 10;
    const cy = Math.round((originY + sparks[index].y * reach) * 10) / 10;

    d += `M${Math.round((cx - r) * 100) / 100} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
  }

  return d;
}

/**
 * Plumes of steam or smoke rising across the card, evenly spaced along the
 * bottom, each on its own timing. `slow` stretches them (smoke is slower).
 */
export function buildPlumes({ width, count, slow = 1, seed = DAYS_SINCE_SEED }) {
  const random = seededRandom(seed * 31 + count);

  return Array.from({ length: count }, (_, index) => ({
    x: round(14 + (index * (width - 28)) / Math.max(1, count - 1)),
    durationMs: Math.round(between(random, 4200, 6000) * slow),
    delayMs: Math.round(index * 900 + between(random, 0, 600)),
    drift: Math.round(between(random, -8, 8)),
  }));
}

/** A plume's S of steam, 12 x 42, drawn up from (x, y). */
export function plumePath(x, y) {
  return `M${x} ${y} c-6 -8 6 -14 0 -22 s-6 -12 0 -20`;
}

/**
 * Record: the confetti that flies when the crown lands - out and up, then
 * spinning down out of the card - and the gold glints that follow.
 */
export function buildRecordLayout({ width, height, seed = DAYS_SINCE_SEED }) {
  const random = seededRandom(seed * 17 + 3);
  const confetti = Array.from({ length: 24 }, (_, index) => ({
    // gold, secondary, ruby, deep gold - in turn.
    tone: index % 4,
    x: Math.round(between(random, -52, 52)),
    up: Math.round(between(random, -34, -14)),
    rotate: Math.round(between(random, 180, 720)),
    durationMs: Math.round(between(random, 1500, 2400)),
    delayMs: Math.round(1150 + between(random, 0, 160)),
  }));
  const glitter = Array.from({ length: 7 }, () => ({
    left: Math.round(between(random, 8, width - 16)),
    top: Math.round(between(random, 8, height - 16)),
    delayMs: Math.round(between(random, 1800, 4400)),
  }));

  return { confetti, glitter };
}

/**
 * Charged: an energy fill as high as the charge left - full the day after,
 * a fifth on the fifth day - with bubbles rising to just under its surface.
 */
export function buildChargeLayout({ width, height, days, seed = DAYS_SINCE_SEED }) {
  const random = seededRandom(seed * 13 + 5);
  const level = chargeFillLevel(days);
  const top = round(height - level * (height - 10));
  const bubbles = Array.from({ length: 7 }, (_, index) => ({
    cx: Math.round(between(random, 10, width - 10)),
    radius: round(between(random, 0.9, 1.8)),
    core: index % 2 === 1,
    durationMs: Math.round(between(random, 1500, 2800)),
    delayMs: Math.round(between(random, 600, 2600)),
    rise: -Math.round(height - top - 8),
  }));

  return { level, top, bubbles };
}

// One wave of the fill: 26 dp from crest to crest, and it slides one wave to
// the left per loop, so it can repeat without a seam.
export const WAVE_LENGTH = 26;

/** The fill's surface as a wave `y` from the top, filled down to the bottom. */
export function wavePath(y, width, height) {
  let d = `M-${WAVE_LENGTH} ${y}`;

  for (let x = -WAVE_LENGTH; x < width + WAVE_LENGTH * 2; x += WAVE_LENGTH) {
    d += " q6.5 -3 13 0 t13 0";
  }

  return `${d} V${height} H-${WAVE_LENGTH} Z`;
}

/** Cobweb: dust floating in the still air of the card. */
export function buildDust({ width, height, seed = DAYS_SINCE_SEED }) {
  const random = seededRandom(seed * 19 + 11);

  return Array.from({ length: 11 }, () => ({
    left: Math.round(between(random, 6, width - 8)),
    top: Math.round(between(random, 6, height - 8)),
    dx: Math.round(between(random, -9, 9)),
    dy: Math.round(between(random, -9, 9)),
    durationMs: Math.round(between(random, 4000, 8000)),
    delayMs: -Math.round(between(random, 0, 6000)),
  }));
}

/** Never: the flint's sparks, struck each time the unlit flame is drawn. */
export function buildFlint({ seed = DAYS_SINCE_SEED } = {}) {
  const random = seededRandom(seed * 23 + 13);

  return Array.from({ length: 6 }, (_, index) => ({
    x: Math.round(between(random, -16, 16)),
    y: Math.round(between(random, -8, 12)),
    delayMs: index * 12,
  }));
}

// A lap of the live fire's shared beat: it flares, flashes, bursts and lights
// the edge every three seconds, from 0.9 s in.
export const FLARE_DELAY_MS = 900;
export const FLARE_PERIOD_MS = 3000;

/** How far into its beat the live fire is, 0 to 1. */
export function flarePhase(time) {
  "worklet";
  return loopProgress(time, FLARE_DELAY_MS, FLARE_PERIOD_MS);
}

/** The burst's reach, spark size and opacity at a point in the beat. */
export function burstAt(phase) {
  "worklet";
  return {
    reach: sampleTrack(BURST_REACH, phase, EASE_OUT),
    radius: BURST_SPARK_RADIUS * sampleTrack(BURST_SCALE, phase, EASE_OUT),
    opacity: sampleTrack(BURST_OPACITY, phase, EASE_OUT),
  };
}
