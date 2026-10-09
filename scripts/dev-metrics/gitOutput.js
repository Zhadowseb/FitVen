// Small pieces shared by the parsers of git's output.

// Every commit record in a `git log --format=%x1e...` stream starts with this
// byte. No line of a patch or a file list can start with it.
const RECORD = "\x1e";

function lines(text) {
  return String(text ?? "").split(/\r?\n/);
}

// Git wraps a path in double quotes, C style, when it holds a quote, a
// backslash or a control character (and every non-ASCII byte unless
// core.quotePath is false, which every call here sets).
const ESCAPES = { a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13 };

function unquotePath(text) {
  if (!text.startsWith('"') || !text.endsWith('"') || text.length < 2) return text;

  const characters = Array.from(text.slice(1, -1));
  const bytes = [];

  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index];

    if (character !== "\\") {
      bytes.push(...Buffer.from(character, "utf8"));
      continue;
    }

    const next = characters[index + 1] ?? "";

    if (/[0-7]/.test(next)) {
      bytes.push(parseInt(characters.slice(index + 1, index + 4).join(""), 8));
      index += 3;
    } else {
      bytes.push(ESCAPES[next] ?? next.charCodeAt(0));
      index += 1;
    }
  }

  return Buffer.from(bytes).toString("utf8");
}

module.exports = { RECORD, lines, unquotePath };
