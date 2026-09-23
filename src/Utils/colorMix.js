// Blending two colours, for a colour that follows a number rather than a
// handful of steps. Hex only: every colour in the theme that is mixed is one,
// and withAlpha - which the result is usually handed to next - reads only hex.

function parseHex(color) {
  if (typeof color !== "string" || !color.startsWith("#")) {
    return null;
  }

  let hex = color.slice(1);

  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }

  if (hex.length === 8) {
    hex = hex.slice(0, 6);
  }

  if (!/^[0-9a-f]{6}$/i.test(hex)) {
    return null;
  }

  return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}

function toHex(channel) {
  return Math.round(channel).toString(16).padStart(2, "0");
}

/**
 * `from` at 0, `to` at 1, a straight line between them in RGB. A colour that
 * cannot be read is not guessed at: the nearer of the two comes back as it is.
 */
export function mixHexColors(from, to, amount) {
  const share = Math.min(1, Math.max(0, Number(amount) || 0));
  const start = parseHex(from);
  const end = parseHex(to);

  if (!start || !end) {
    return share < 0.5 ? from : to;
  }

  return `#${start
    .map((channel, index) => toHex(channel + (end[index] - channel) * share))
    .join("")}`;
}
