// The days-since card on Home: which state it is in, how its number rolls,
// where its edge runs, and the keyframe timing everything on it is driven by.
//
// What this pins is what would go wrong quietly: a state picked from the
// wrong threshold (the card and your friend tile disagreeing about where you
// are), a roll that stops on the wrong digit, a comet whose dashes drift
// apart, an edge whose length is not the one the dashes are measured in,
// and an easing curve that is not the one the design used.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");
const card = loadAppModule("src/Utils/daysSinceCard.js");
const timeline = loadAppModule("src/Utils/keyframeTimeline.js");
const { CHARGED_WITHIN_DAYS, COBWEB_FROM_DAYS, wallpaperColorForDays } = loadAppModule(
  "src/Utils/friendsActivityUtils.js"
);
const { Colors } = loadAppModule("src/Resources/GlobalStyling/colors.js");

const close = (actual, expected, epsilon, message) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${message}: ${actual} is not ${expected}`);

/* ---------------------------------------------------------- the state -- */

const stateOf = (days, extra = {}) => card.resolveDaysSinceState({ days, ...extra });

for (const days of [null, 0, 3, 12, 400]) {
  assert.strictEqual(stateOf(days, { isTraining: true }), "live", `training with ${days} days was not live`);
}

assert.strictEqual(stateOf(null), "never", "no workout at all was not 'never'");
assert.strictEqual(stateOf(undefined), "never");
assert.strictEqual(stateOf(0), "today");
assert.strictEqual(stateOf(0, { recordsToday: 1 }), "record", "a record today wore no crown");
assert.strictEqual(stateOf(0, { recordsToday: 0 }), "today");
assert.strictEqual(
  stateOf(0, { isTraining: true, recordsToday: 2 }),
  "live",
  "the crown is for a workout that is over, not one still running"
);
assert.strictEqual(stateOf(2, { recordsToday: 2 }), "charged", "an old record crowned a day without one");

for (let days = 1; days <= CHARGED_WITHIN_DAYS; days += 1) {
  assert.strictEqual(stateOf(days), "charged", `${days} days was not charged`);
}

for (let days = CHARGED_WITHIN_DAYS + 1; days < COBWEB_FROM_DAYS; days += 1) {
  assert.strictEqual(stateOf(days), "cool", `${days} days was not cooling`);
}

for (const days of [COBWEB_FROM_DAYS, 45, 400]) {
  assert.strictEqual(stateOf(days), "cobweb", `${days} days had no cobwebs`);
}

assert.deepStrictEqual(
  card.DAYS_SINCE_STATES.filter(card.showsDayCount),
  ["today", "record", "charged", "cool", "cobweb"],
  "live shows a fire and never a dash - neither shows a count"
);

// The card's colours are its friend tile's.
for (const scheme of ["light", "dark"]) {
  const theme = Colors[scheme];

  assert.strictEqual(card.daysSinceAccent("live", null, theme), theme.fire);
  assert.strictEqual(card.daysSinceAccent("today", 0, theme), theme.secondary);
  assert.strictEqual(card.daysSinceAccent("record", 0, theme), theme.secondary);
  assert.strictEqual(card.daysSinceAccent("charged", 3, theme), theme.charge);
  assert.strictEqual(card.daysSinceAccent("cobweb", 40, theme), theme.quietText);
  assert.strictEqual(card.daysSinceAccent("never", null, theme), theme.quietText);
  assert.strictEqual(
    card.daysSinceAccent("cool", 7, theme),
    wallpaperColorForDays(7, [theme.heatHot, theme.heatWarm, theme.heatCool, theme.quietText]),
    "a cooling card left the friend tiles' day colours"
  );
}

// Cooling runs from the sixth day to the 29th.
assert.strictEqual(card.COOL_FIRST_DAY, 6);
assert.strictEqual(card.COOL_LAST_DAY, 29);
assert.strictEqual(card.coolWarmth(6), 1);
assert.strictEqual(card.coolWarmth(29), 0);
close(card.coolWarmth(17.5), 0.5, 1e-9, "half-way through cooling");

const warm = card.coolLook(6, Colors.dark);
const cold = card.coolLook(29, Colors.dark);

assert.strictEqual(warm.flameScale, 1);
assert.strictEqual(cold.flameScale, 0.58, "the flame shrinks to 0.58 by the end of the cooling");
assert.strictEqual(warm.flameOpacity, 0.95);
assert.strictEqual(cold.flameOpacity, 0.55);
assert.strictEqual(warm.cometLapMs, 9000, "a warm comet laps in 9 s");
assert.strictEqual(cold.cometLapMs, 16000, "a cold comet laps in 16 s");
assert.strictEqual(cold.glowColor.toLowerCase(), Colors.dark.quietText.toLowerCase(), "the glow ends grey");

// The charge's fill: full the day after, a fifth on the fifth day.
assert.strictEqual(card.chargeFillLevel(1), 1);
close(card.chargeFillLevel(5), 0.2, 1e-9, "the fifth day's fill");
close(card.chargeFillLevel(3), 0.6, 1e-9, "the third day's fill");

/* ------------------------------------------------------ the odometer -- */

const digitsAt = (plan, elapsed) =>
  plan.columns
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => (elapsed <= 0 ? column.shownBefore : column.shownAfter))
    .map(({ column, index }) =>
      card.odometerDigitAt(card.odometerPosition(column, index, elapsed, plan.durationMs))
    )
    .join("");

// On the way in: a count spins up from 0 with an extra turn, over 1050 ms.
const five = card.planOdometer({ to: 5 });

assert.strictEqual(five.spin, true);
assert.strictEqual(five.from, 0);
assert.strictEqual(five.durationMs, 1050);
assert.strictEqual(five.columns.length, 1);
assert.strictEqual(five.columns[0].end - five.columns[0].start, 15, "the entrance skipped its extra turn");
assert.strictEqual(digitsAt(five, 0), "0");
assert.strictEqual(digitsAt(five, five.totalMs), "5");

// A day you trained rolls down from 3 to 0 in one step's time, 620 ms.
const today = card.planOdometer({ to: 0 });

assert.strictEqual(today.from, card.TODAY_ROLLS_FROM);
assert.strictEqual(today.down, true);
assert.strictEqual(today.spin, false);
assert.strictEqual(today.durationMs, 620);
assert.strictEqual(digitsAt(today, 0), "3");
assert.strictEqual(digitsAt(today, today.totalMs), "0");
assert.ok(today.columns[0].end < today.columns[0].start, "today's roll went up");

// Columns start 80 ms apart; a column the number grows into fades in.
const twelve = card.planOdometer({ to: 12 });

assert.strictEqual(twelve.columns.length, 2);
assert.strictEqual(twelve.totalMs, 1050 + 80);
assert.deepStrictEqual(
  twelve.columns.map((column) => [column.shownBefore, column.shownAfter]),
  [
    [false, true],
    [true, true],
  ]
);
assert.strictEqual(card.odometerOpacity(twelve.columns[0], 0, 0), 0);
assert.strictEqual(card.odometerOpacity(twelve.columns[0], 0, 300), 1);
assert.strictEqual(card.odometerOpacity(twelve.columns[1], 1, 0), 1);
assert.strictEqual(
  card.odometerPosition(twelve.columns[1], 1, 80, twelve.durationMs),
  twelve.columns[1].start,
  "the second column started before its 80 ms"
);

// Midnight: a single step from the number the card showed, up or down.
const midnight = card.planOdometer({ to: 10, from: 9 });

assert.strictEqual(midnight.spin, false);
assert.strictEqual(midnight.durationMs, 620);
assert.strictEqual(digitsAt(midnight, 0), "9");
assert.strictEqual(digitsAt(midnight, midnight.totalMs), "10");
assert.strictEqual(midnight.columns[1].end - midnight.columns[1].start, 1, "9 to 10 is one step, not a turn");

const shorter = card.planOdometer({ to: 9, from: 10 });

assert.strictEqual(shorter.down, true);
assert.deepStrictEqual(
  shorter.columns.map((column) => column.shownAfter),
  [false, true],
  "the tens were not let go when the number lost a digit"
);
assert.strictEqual(digitsAt(shorter, shorter.totalMs), "9");

// The same number again is no roll from it: the entrance plays instead.
assert.strictEqual(card.planOdometer({ to: 4, from: 4 }).spin, true);

// Every number, from every start, stops on its own digits - and never ends a
// column anywhere but on a whole digit.
for (let to = 0; to <= 400; to += 1) {
  for (const from of [null, 0, 1, 3, 9, 10, 29, 99, 100, 250]) {
    const plan = card.planOdometer({ to, from });

    assert.strictEqual(digitsAt(plan, plan.totalMs), String(to), `${from} -> ${to} stopped wrong`);
    assert.strictEqual(
      digitsAt(plan, 0),
      String(plan.from),
      `${from} -> ${to} did not start from ${plan.from}`
    );

    for (const column of plan.columns) {
      // Five turns of strip - the design's 50 digits - are always enough.
      assert.ok(column.start >= 0 && column.end >= 0 && column.start < 50 && column.end < 50);
    }
  }
}

// The short strip: a position on it is always a line of 0-9 plus the second 0.
for (const position of [0, 9.5, 10, 23.99, 30, 37.2]) {
  const offset = card.odometerStripOffset(position);

  assert.ok(offset >= 0 && offset < 10, `strip offset ${offset} for ${position}`);
}

assert.strictEqual(card.ODOMETER_STRIP.length, 11);
assert.strictEqual(card.ODOMETER_STRIP[10], 0, "the strip needs its second 0 to wrap without a jump");

// The easing overshoots a little and settles exactly.
let furthest = 0;

for (let step = 0; step <= 1000; step += 1) {
  furthest = Math.max(furthest, timeline.cubicBezier(0.2, 0.85, 0.25, 1.08, step / 1000));
}

assert.ok(furthest > 1 && furthest < 1.05, `the roll overshoots by ${furthest}`);
assert.strictEqual(timeline.cubicBezier(0.2, 0.85, 0.25, 1.08, 1), 1);

/* ---------------------------------------------------------- the edge -- */

close(
  card.roundedRectPerimeter(100, 120, 16),
  2 * 220 - (8 - 2 * Math.PI) * 16,
  1e-9,
  "the perimeter formula"
);
close(card.roundedRectPerimeter(10, 10, 5), Math.PI * 10, 1e-9, "a rounded square of full radius is a circle");

// The perimeter is the length of the path the edge draws - which is what
// every dash on it is measured against.
function pathLength(d) {
  const tokens = d.trim().split(/\s+/);
  let x = 0;
  let y = 0;
  let length = 0;
  let index = 0;

  while (index < tokens.length) {
    const command = tokens[index];

    if (command === "M") {
      x = Number(tokens[index + 1]);
      y = Number(tokens[index + 2]);
      index += 3;
    } else if (command === "H") {
      const next = Number(tokens[index + 1]);

      length += Math.abs(next - x);
      x = next;
      index += 2;
    } else if (command === "V") {
      const next = Number(tokens[index + 1]);

      length += Math.abs(next - y);
      y = next;
      index += 2;
    } else if (command === "A") {
      // A quarter circle of radius r between two corners of the edge.
      const r = Number(tokens[index + 1]);
      const nextX = Number(tokens[index + 6]);
      const nextY = Number(tokens[index + 7]);

      assert.ok(Math.abs(Math.abs(nextX - x) - r) < 0.02 && Math.abs(Math.abs(nextY - y) - r) < 0.02);
      length += (Math.PI / 2) * r;
      x = nextX;
      y = nextY;
      index += 8;
    } else if (command === "Z") {
      index += 1;
    } else {
      throw new Error(`unexpected path command ${command}`);
    }
  }

  return length;
}

for (const [width, height] of [
  [102, 122],
  [102, 134],
  [102, 150.5],
]) {
  const edge = card.edgeGeometry(width, height);

  close(pathLength(edge.d), edge.perimeter, 0.05, `the edge of a ${width} x ${height} card`);
  assert.strictEqual(edge.radius, card.EDGE_RADIUS);
  assert.ok(edge.d.startsWith(`M ${card.EDGE_INSET + card.EDGE_RADIUS} ${card.EDGE_INSET}`), edge.d);
  assert.strictEqual((edge.d.match(/A /g) ?? []).length, 4);
}

// Inset 1 inside the 1 dp border, concentric with the card's 18 dp corners.
assert.strictEqual(card.EDGE_INSET, 1);
assert.strictEqual(card.EDGE_RADIUS, 18 - 1 - 1);
assert.ok(card.edgeGeometry(20, 20).radius <= 9, "the radius was not kept inside a tiny box");

// A comet: three dashes, 2.4x, 1.5x and 1x its length, fainter and wider
// towards the tail, each dash and gap together exactly one lap.
const perimeter = card.edgeGeometry(102, 122).perimeter;
const comet = card.cometDashes(9, perimeter);

assert.deepStrictEqual(
  comet.map((dash) => Math.round((dash.length / perimeter) * 1000) / 10),
  [21.6, 13.5, 9]
);
assert.deepStrictEqual(
  comet.map((dash) => dash.strokeWidth),
  [5, 3.2, 2]
);
assert.deepStrictEqual(
  comet.map((dash) => dash.strokeOpacity),
  [0.14, 0.35, 1]
);

for (const dash of comet) {
  close(dash.length + dash.gap, perimeter, 1e-9, "a comet dash and its gap");
}

assert.deepStrictEqual(
  card.cometDashes(7, perimeter, { width: 1.6, opacity: 0.5 }).map((dash) => [dash.strokeWidth, dash.strokeOpacity]),
  [
    [4.6, 0.07],
    [2.8, 0.18],
    [1.6, 0.5],
  ]
);

// The heads stay together all the way round: head = length - offset.
for (const lap of [0, 0.13, 0.5, 0.999]) {
  const heads = comet.map((dash) => dash.length - card.cometOffset(dash.length, perimeter, lap));

  for (const head of heads) {
    close(head, lap * perimeter, 1e-9, `a comet's heads at lap ${lap}`);
  }
}

/* ------------------------------------------------------ the timeline -- */

const { cubicBezier, sampleTrack, loopProgress, onceProgress, ease } = timeline;

// The CSS curves: ease at half-way is 0.8024 in every browser.
close(cubicBezier(0.25, 0.1, 0.25, 1, 0.5), 0.8024, 0.0005, "ease at 0.5");
close(ease(timeline.EASE_IN_OUT, 0.5), 0.5, 1e-6, "ease-in-out is symmetric");
close(ease(timeline.EASE_IN_OUT, 0.25) + ease(timeline.EASE_IN_OUT, 0.75), 1, 1e-6, "ease-in-out mirror");
assert.strictEqual(ease(timeline.LINEAR, 0.3), 0.3);
assert.ok(ease(timeline.EASE_OUT, 0.2) > 0.2 && ease(timeline.EASE_IN, 0.2) < 0.2);

let peak = 0;

for (let step = 0; step <= 200; step += 1) {
  peak = Math.max(peak, cubicBezier(0.34, 1.56, 0.64, 1, step / 200));
}

assert.ok(peak > 1.09, "the pop-in's curve lost its overshoot");

// Keyframes ease each stretch on its own, as CSS does.
const track = [
  [0, 0],
  [0.5, 10],
  [1, 0],
];

assert.strictEqual(sampleTrack(track, 0.5, timeline.EASE_OUT), 10);
close(sampleTrack(track, 0.25, timeline.LINEAR), 5, 1e-9, "linear keyframes");
close(
  sampleTrack(track, 0.25, timeline.EASE_OUT),
  10 * ease(timeline.EASE_OUT, 0.5),
  1e-9,
  "the curve was applied to the whole animation, not to the stretch"
);
assert.strictEqual(sampleTrack(track, -1, timeline.LINEAR), 0);
assert.strictEqual(sampleTrack(track, 2, timeline.LINEAR), 0);

// Delays, negative delays, and directions.
assert.strictEqual(loopProgress(500, 900, 3000), 0, "an animation ran before its delay");
close(loopProgress(900 + 1500, 900, 3000), 0.5, 1e-9, "half-way through the first beat");
close(loopProgress(900 + 4500, 900, 3000), 0.5, 1e-9, "half-way through the second beat");
close(loopProgress(0, -120, 380), 120 / 380, 1e-9, "a negative delay starts part-way through");
close(loopProgress(0, -120, 380, "reverse"), 1 - 120 / 380, 1e-9, "reverse");
close(loopProgress(560 + 140, 0, 560, "alternate"), 1 - 140 / 560, 1e-9, "alternate comes back");
close(loopProgress(140, 0, 560, "alternate"), 0.25, 1e-9, "alternate goes out");
assert.strictEqual(onceProgress(100, 250, 760), 0);
assert.strictEqual(onceProgress(5000, 250, 760), 1);
close(onceProgress(250 + 380, 250, 760), 0.5, 1e-9, "a single run");

// The live fire's beat: it flares every 3 s from 0.9 s in, and its burst is
// only there for the first quarter of the beat.
assert.strictEqual(card.flarePhase(card.FLARE_DELAY_MS), 0);
close(card.flarePhase(card.FLARE_DELAY_MS + 4500), 0.5, 1e-9, "the fire's beat");
assert.strictEqual(card.burstAt(0.5).opacity, 0, "the burst lingered past its quarter");
assert.ok(card.burstAt(0.05).opacity > 0.99, "the burst never lit");

/* ---------------------------------------------------------- layouts -- */

const frame = { width: 104, height: 124 };
const live = card.buildLiveLayout(frame);

assert.deepStrictEqual(card.buildLiveLayout(frame), live, "the live layout is not the same every time");
assert.strictEqual(live.tongues.outer.length, 8);
assert.strictEqual(live.tongues.core.length, 8);
assert.strictEqual(live.embers.length, 14);
assert.strictEqual(live.burst.fire.length + live.burst.core.length, 10);
assert.strictEqual(live.tongues.outer[0].x, 6);
assert.strictEqual(live.tongues.outer[7].x, frame.width - 6);

for (const tongue of [...live.tongues.outer, ...live.tongues.core]) {
  assert.ok(tongue.delayMs <= 0 && tongue.delayMs >= -800, "the tongues start part-way through");
  assert.ok(tongue.durationMs >= 320 && tongue.durationMs <= 620);
}

for (const tongue of live.tongues.core) {
  assert.ok(tongue.height <= 14 && tongue.width <= 9, "the core row is half the size");
}

for (const spark of [...live.burst.fire, ...live.burst.core]) {
  close(Math.hypot(spark.x, spark.y), 33, 8, "a spark's reach");
  assert.ok(spark.y < 0, "a spark flew down");
}

const row = card.tongueRowPath(live.tongues.outer, frame.height, 0, 1234);

assert.strictEqual((row.match(/M/g) ?? []).length, 8, "a row is eight tongues");
assert.strictEqual((row.match(/Z/g) ?? []).length, 8);

const burst = card.burstPath(live.burst.fire, 48, 50, 1, 1.5);

assert.strictEqual((burst.match(/M/g) ?? []).length, live.burst.fire.length);

const plumes = card.buildPlumes({ width: frame.width, count: 5 });

assert.deepStrictEqual(
  plumes.map((plume) => plume.x),
  [14, 33, 52, 71, 90],
  "the plumes were not spread evenly along the bottom"
);
assert.strictEqual(card.buildPlumes({ width: frame.width, count: 3, slow: 1.3 }).length, 3);

const record = card.buildRecordLayout(frame);

assert.strictEqual(record.confetti.length, 24);
assert.strictEqual(record.glitter.length, 7);
assert.ok(record.confetti.every((piece) => piece.delayMs >= 1150 && piece.delayMs <= 1310));
assert.ok(
  record.glitter.every(
    (spark) => spark.left >= 8 && spark.left <= frame.width - 16 && spark.top >= 8 && spark.top <= frame.height - 16
  )
);

const charged = card.buildChargeLayout({ ...frame, days: 1 });

assert.strictEqual(charged.top, 10, "a full charge reaches 10 dp from the top");
assert.strictEqual(charged.bubbles.length, 7);
assert.ok(charged.bubbles.every((bubble) => bubble.rise === -(frame.height - charged.top - 8)));
close(
  card.buildChargeLayout({ ...frame, days: 5 }).top,
  frame.height - 0.2 * (frame.height - 10),
  0.01,
  "the fifth day's fill"
);
assert.ok(card.wavePath(40, frame.width, frame.height).endsWith("Z"));

const dust = card.buildDust(frame);

assert.strictEqual(dust.length, 11);
assert.ok(dust.every((speck) => speck.delayMs <= 0));
assert.strictEqual(card.buildFlint().length, 6);

/* -------------------------------------------------------- the wiring -- */

const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const cardFolder = "src/Pages/HomePage/Components/DaysSinceCard";
const cardSources = fs
  .readdirSync(path.join(root, cardFolder))
  .filter((file) => file.endsWith(".js"))
  .map((file) => read(`${cardFolder}/${file}`))
  .join("\n");

// The card's size and shape are not the animation's to change.
const style = read(`${cardFolder}/DaysSinceCardStyle.js`);

for (const rule of [
  "width: 104",
  "gap: 7",
  "paddingVertical: 16",
  "paddingHorizontal: 10",
  "borderRadius: 18",
  "borderWidth: 1",
  "fontSize: 32",
  "lineHeight: 32",
  "fontSize: 9.5",
  "lineHeight: 12",
]) {
  assert.ok(style.includes(rule), `the card's style lost "${rule}"`);
}

// Its own layers replace the friend tiles' frames - which stay for the tiles.
for (const frameName of ["EmberFrame", "SteamFrame", "ChargeFrame", "CobwebFrame"]) {
  assert.ok(!cardSources.includes(frameName), `the card still draws the tiles' ${frameName}`);
  assert.ok(
    fs.existsSync(path.join(root, `src/Resources/Components/FriendsActivity/${frameName}.js`)),
    `${frameName} is gone, and the friend tiles draw it`
  );
}

assert.ok(cardSources.includes("useAnimationsEnabled"), "the card stopped honouring reduce motion");

// Training now says so in both languages.
const en = loadAppModule("src/Localization/locales/en/home.js").default;
const da = loadAppModule("src/Localization/locales/da/home.js").default;

assert.strictEqual(en.daysSince.live, "Training\nnow");
assert.strictEqual(da.daysSince.live, "Træner\nnu");
assert.deepStrictEqual(Object.keys(en.daysSince).sort(), Object.keys(da.daysSince).sort());

console.log(
  "Days-since card: the states, the odometer, the edge and its comets, the keyframe timing and the layouts passed."
);
