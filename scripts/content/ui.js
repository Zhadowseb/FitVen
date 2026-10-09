// Finds things on an Android screen from a `uiautomator dump`, for the content
// capture: where to tap to focus the email field, where the Login button is.
//
//   node scripts/content/ui.js <dump.xml> point  [selectors]   "x y" of the middle of the match, exit 1 if none
//   node scripts/content/ui.js <dump.xml> has    [selectors]   exit 0 if something matches, else 1
//   node scripts/content/ui.js <dump.xml> texts                every text on screen, one per line (for the log)
//
// Selectors (all that are given have to hold, case does not matter):
//   --text <regex>     the whole text, content description or hint matches it
//   --id <regex>       the resource id matches it (a part of it is enough)
//   --class <regex>    the class matches it (a part of it is enough)
//   --clickable        the node is clickable
//   --index <n>        the n-th match, counting from 0 (default 0)
//   --last             the last match - the lowest on screen in a form, where a heading and a
//                      button can both say "Login"
//
// A password field's text is never printed: `texts` skips nodes marked as a password.

const fs = require("fs");

function decode(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&");
}

/** Every node of a dump, with its attributes and its bounds as numbers. */
function parseNodes(xml) {
  const nodes = [];

  for (const match of String(xml).matchAll(/<node\b([^>]*?)\/?>/g)) {
    const attributes = {};

    for (const attribute of match[1].matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) {
      attributes[attribute[1]] = decode(attribute[2]);
    }

    const bounds = (attributes.bounds ?? "").match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);

    if (bounds) {
      attributes.box = bounds.slice(1, 5).map(Number);
      nodes.push(attributes);
    }
  }

  return nodes;
}

function center(node) {
  const [left, top, right, bottom] = node.box;

  return { x: Math.round((left + right) / 2), y: Math.round((top + bottom) / 2) };
}

/** The nodes that satisfy every selector, top to bottom as they are in the dump. */
function matches(nodes, selector) {
  const text = selector.text ? new RegExp(`^(?:${selector.text})$`, "i") : null;
  const id = selector.id ? new RegExp(selector.id, "i") : null;
  const className = selector.class ? new RegExp(selector.class, "i") : null;

  return nodes.filter((node) => {
    const width = node.box[2] - node.box[0];
    const height = node.box[3] - node.box[1];

    return (
      width > 0 &&
      height > 0 &&
      (!text || [node.text, node["content-desc"], node.hint].some((value) => value && text.test(value.trim()))) &&
      (!id || id.test(node["resource-id"] ?? "")) &&
      (!className || className.test(node.class ?? "")) &&
      (!selector.clickable || node.clickable === "true")
    );
  });
}

function select(nodes, selector) {
  const found = matches(nodes, selector);

  if (selector.last) {
    return found[found.length - 1] ?? null;
  }

  return found[selector.index ?? 0] ?? null;
}

function parseSelector(args) {
  const selector = {};

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];

    if (flag === "--text") selector.text = args[++index];
    else if (flag === "--id") selector.id = args[++index];
    else if (flag === "--class") selector.class = args[++index];
    else if (flag === "--index") selector.index = Number(args[++index]);
    else if (flag === "--clickable") selector.clickable = true;
    else if (flag === "--last") selector.last = true;
  }

  return selector;
}

/** What is written on the screen, without a password field's contents. */
function visibleTexts(nodes) {
  return nodes
    .filter((node) => node.password !== "true")
    .flatMap((node) => [node.text, node["content-desc"]])
    .filter((value) => value && value.trim())
    .map((value) => value.trim());
}

function main(argv) {
  const [file, command, ...rest] = argv;

  if (!file || !command) {
    console.error("Usage: ui.js <dump.xml> point|has|texts [--text <regex>] [--id <regex>] [--class <regex>] [--clickable] [--index <n>] [--last]");
    return 2;
  }

  const nodes = parseNodes(fs.readFileSync(file, "utf8"));

  if (command === "texts") {
    console.log(visibleTexts(nodes).join("\n"));
    return 0;
  }

  const node = select(nodes, parseSelector(rest));

  if (!node) {
    return 1;
  }

  if (command === "point") {
    const { x, y } = center(node);

    console.log(`${x} ${y}`);
  }

  return 0;
}

module.exports = { center, matches, parseNodes, parseSelector, select, visibleTexts };

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
