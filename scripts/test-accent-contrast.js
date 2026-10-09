// Accent themes: the label on a primary button, and the accent as text.
//
// Every accent theme overrides `primary` per scheme, and with it the ink drawn
// on it (`ink`, `textInverted`) - the label on every primary button, chip and
// badge. Nothing on a screen shows the ratio, so an ink a shade too light, or a
// primary nudged a shade lighter, ships unnoticed: Ultraviolet's near-white
// read 3.06:1 on its dark-scheme purple until 2.10.1. This measures every
// theme in both schemes with the WCAG 2 formula, on the palette exactly as
// applyAccentTheme leaves it.

const assert = require("assert");
const loadAppModule = require("./lib/loadAppModule");

const { Colors, AccentThemes, applyAccentTheme } = loadAppModule(
  "src/Resources/GlobalStyling/colors.js"
);

// WCAG 2 AA for normal-size text.
const AA = 4.5;

function channels(color) {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);

  if (hex) {
    const digits =
      hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit).join("") : hex[1];

    return [0, 2, 4].map((index) => parseInt(digits.slice(index, index + 2), 16));
  }

  const rgb = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(color);

  assert.ok(rgb, `${color} is not an opaque colour this test can measure`);

  return rgb.slice(1).map(Number);
}

function luminance(color) {
  const [r, g, b] = channels(color).map((value) => {
    const channel = value / 255;

    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);

  return (lighter + 0.05) / (darker + 0.05);
}

// Known answers, so a slip in the formula cannot quietly pass every theme:
// #767676 is the lightest grey that still clears 4.5:1 on white.
assert.strictEqual(contrast("#000000", "#FFFFFF").toFixed(2), "21.00");
assert.strictEqual(contrast("#767676", "#FFFFFF").toFixed(2), "4.54");
assert.strictEqual(contrast("#777777", "rgb(255, 255, 255)").toFixed(2), "4.48");

const PAIRS = [
  ["textInverted", "primary"],
  ["ink", "primary"],
  ["primaryText", "cardBackground"],
  ["primaryText", "background"],
];

for (const [key, accent] of Object.entries(AccentThemes)) {
  applyAccentTheme(key);

  for (const scheme of ["dark", "light"]) {
    const theme = Colors[scheme];

    for (const [ink, fill] of PAIRS) {
      const ratio = contrast(theme[ink], theme[fill]);

      assert.ok(
        ratio >= AA,
        `${accent.name} ${scheme}: ${ink} ${theme[ink]} on ${fill} ${theme[fill]} is ` +
          `${ratio.toFixed(2)}:1, under ${AA}:1`
      );
    }
  }
}

console.log(
  "Accent contrast: the ink on primary, and primaryText on the card and the background, clear 4.5:1 in every accent theme, dark and light."
);
