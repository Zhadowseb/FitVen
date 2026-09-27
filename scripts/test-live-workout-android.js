// The Android lock-screen card's resources: what the review of #287 found
// and what must not come back.
//
// - The weight buttons' text is readable: 4.5:1 or more on a light and on a
//   dark notification shade, against the shade itself and against the
//   button's own 0.16 tint laid over it (their text is 13/800 and 17/700,
//   so not large text).
// - Both button rows on the open card are 48 dp, Android's touch target.
// - The dimmed minus button is disabled, so TalkBack does not offer it.
//
// Plain file reads: the notification cannot be drawn without a phone.

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const res = path.join(__dirname, "..", "modules", "live-workout", "android", "src", "main", "res");
const read = (file) => fs.readFileSync(path.join(res, file), "utf8");

function colorsOf(xml) {
  const colors = {};

  for (const [, name, value] of xml.matchAll(/<color name="([^"]+)">#([0-9A-Fa-f]{6,8})<\/color>/g)) {
    colors[name] = value.toUpperCase();
  }

  return colors;
}

// "AARRGGBB" or "RRGGBB" -> { rgb: [0..1] x3, alpha: 0..1 }
function parse(hex) {
  const argb = hex.length === 8 ? hex : `FF${hex}`;
  const byte = (at) => parseInt(argb.slice(at, at + 2), 16) / 255;

  return { alpha: byte(0), rgb: [byte(2), byte(4), byte(6)] };
}

const over = (fg, alpha, bg) => fg.map((value, index) => value * alpha + bg[index] * (1 - alpha));
const channel = (value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);

  return (high + 0.05) / (low + 0.05);
}

const light = colorsOf(read("values/colors.xml"));
const night = { ...light, ...colorsOf(read("values-night/colors.xml")) };

// The shades a notification is drawn on: white, One UI, a Material 3
// surface, a grey; and the design's dark card, AOSP's, One UI's, black.
const LIGHT_SHADES = ["FFFFFF", "F7F7F7", "F3EDF7", "EEF0F3"];
const DARK_SHADES = ["1D2027", "202124", "171717", "000000"];

for (const [theme, colors, shades] of [
  ["light", light, LIGHT_SHADES],
  ["night", night, DARK_SHADES],
]) {
  for (const side of ["minus", "plus"]) {
    for (const part of ["text", "fill"]) {
      assert.ok(colors[`live_workout_weight_${side}_${part}`], `${theme}: live_workout_weight_${side}_${part} is missing`);
    }

    const text = parse(colors[`live_workout_weight_${side}_text`]).rgb;
    const fill = parse(colors[`live_workout_weight_${side}_fill`]);

    for (const shade of shades) {
      const card = parse(shade).rgb;
      const onCard = contrast(text, card);
      const onFill = contrast(text, over(fill.rgb, fill.alpha, card));

      assert.ok(
        Math.min(onCard, onFill) >= 4.5,
        `${theme} ${side}: the weight text is ${onCard.toFixed(2)}:1 on #${shade} and ` +
          `${onFill.toFixed(2)}:1 on its tint there - under 4.5:1`
      );
    }
  }
}

const styles = read("values/styles.xml");

for (const side of ["Minus", "Plus"]) {
  const lower = side.toLowerCase();

  for (const style of [`LiveWorkout.Text.Heavy.Button.Weight${side}`, `LiveWorkout.Text.Bold.WeightSign.${side}`]) {
    const block = styles.match(new RegExp(`<style name="${style.replace(/\./g, "\\.")}"[^>]*>([\\s\\S]*?)</style>`));

    assert.ok(block, `${style} is missing`);
    assert.ok(
      block[1].includes(`@color/live_workout_weight_${lower}_text`),
      `${style} must use the text colour, not the fill's`
    );
  }
}

const expanded = read("layout/live_workout_expanded.xml");

for (const id of ["live_workout_buttons", "live_workout_rest_buttons"]) {
  const tag = expanded.match(new RegExp(`<LinearLayout[^>]*android:id="@\\+id/${id}"[^>]*>`));

  assert.ok(tag, `${id} is missing`);
  assert.ok(/android:layout_height="48dp"/.test(tag[0]), `${id} must be 48 dp high`);
}

const off = styles.match(/<style name="LiveWorkout\.Button\.Off"[^>]*>([\s\S]*?)<\/style>/);

assert.ok(off && /name="android:enabled">false</.test(off[1]), "the dimmed minus button must be disabled");

console.log("live-workout android: weight text contrast, 48 dp buttons and the disabled minus hold");
