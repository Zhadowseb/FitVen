// Svgs that must let touches through (src/Resources/Components/PassThroughSvg.js).
//
// On an iPhone the square timer in the bottom bar did nothing when tapped,
// while the same build opened the workout on Android. The ring around the
// square is an Svg drawn on top of the button with pointerEvents="none", and
// react-native-svg's root view on iOS (new architecture) overrides hitTest:
// without reading pointerEvents - it takes every touch inside its bounds. A
// plain View does honour the prop, so every pass-through Svg is wrapped in
// one. This keeps it that way:
//
//   1. no Svg in src/ (default import, Svg*/LocalSvg, or an animated Svg) is
//      handed pointerEvents directly;
//   2. the timer button still opens the workout, and nothing unwrapped is
//      drawn over it, and its slot - not the wrap inside - carries the lift;
//   3. the wrapper renders a View with pointerEvents="none" and lays its box
//      out the way the Svg used to (explicit sizes, percentages, fill).

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");
const projectRequire = createRequire(path.join(root, "package.json"));
const { parse } = projectRequire("@babel/parser");

const SVG_ROOT_EXPORTS = new Set([
  "Svg",
  "SvgXml",
  "SvgUri",
  "SvgCss",
  "SvgCssUri",
  "SvgFromXml",
  "SvgFromUri",
  "LocalSvg",
]);

function walkFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) walkFiles(full, out);
    else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) out.push(full);
  }

  return out;
}

function parseFile(file) {
  const source = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  const plugins = /\.tsx?$/.test(file) ? ["jsx", "typescript"] : ["jsx"];

  return parse(source, { sourceType: "module", plugins });
}

function visit(node, fn, parent = null) {
  if (!node || typeof node.type !== "string") return;

  if (fn(node, parent) === false) return;

  for (const key of Object.keys(node)) {
    if (key === "loc" || key === "start" || key === "end") continue;

    const value = node[key];

    if (Array.isArray(value)) value.forEach((child) => visit(child, fn, node));
    else if (value && typeof value.type === "string") visit(value, fn, node);
  }
}

function jsxName(nameNode) {
  if (nameNode.type === "JSXIdentifier") return nameNode.name;
  if (nameNode.type === "JSXMemberExpression") {
    return `${jsxName(nameNode.object)}.${nameNode.property.name}`;
  }

  return null;
}

function isCreateAnimatedComponent(callee) {
  return (
    (callee.type === "Identifier" && callee.name === "createAnimatedComponent") ||
    (callee.type === "MemberExpression" &&
      !callee.computed &&
      callee.property.name === "createAnimatedComponent")
  );
}

// The local names in `ast` that render an Svg root view.
function svgRootNames(ast) {
  const names = new Set();

  visit(ast, (node) => {
    if (node.type !== "ImportDeclaration") return;
    if (!/^react-native-svg(\/|$)/.test(node.source.value)) return;

    for (const specifier of node.specifiers) {
      if (specifier.type === "ImportDefaultSpecifier") names.add(specifier.local.name);
      if (
        specifier.type === "ImportSpecifier" &&
        SVG_ROOT_EXPORTS.has(specifier.imported.name ?? specifier.imported.value)
      ) {
        names.add(specifier.local.name);
      }
    }
  });

  // `const AnimatedSvg = Animated.createAnimatedComponent(Svg)`, repeated so a
  // wrapper of a wrapper is caught too.
  let grew = true;

  while (grew) {
    grew = false;
    visit(ast, (node) => {
      if (
        node.type === "VariableDeclarator" &&
        node.id.type === "Identifier" &&
        node.init?.type === "CallExpression" &&
        isCreateAnimatedComponent(node.init.callee) &&
        node.init.arguments[0]?.type === "Identifier" &&
        names.has(node.init.arguments[0].name) &&
        !names.has(node.id.name)
      ) {
        names.add(node.id.name);
        grew = true;
      }
    });
  }

  return names;
}

/* ------------------------- 1. no Svg is given pointerEvents directly -- */

const offenders = [];
let svgFiles = 0;

for (const file of walkFiles(path.join(root, "src"))) {
  const ast = parseFile(file);
  const names = svgRootNames(ast);

  if (names.size === 0) continue;

  svgFiles += 1;
  visit(ast, (node) => {
    if (node.type !== "JSXOpeningElement") return;

    const name = jsxName(node.name);

    if (!names.has(name)) return;

    const hasPointerEvents = node.attributes.some(
      (attribute) =>
        attribute.type === "JSXAttribute" && attribute.name.name === "pointerEvents"
    );

    if (hasPointerEvents) {
      offenders.push(`${path.relative(root, file).split(path.sep).join("/")}:${node.loc.start.line} <${name}>`);
    }
  });
}

assert.ok(svgFiles > 50, `expected to scan the app's Svg files, found ${svgFiles}`);
assert.deepStrictEqual(
  offenders,
  [],
  "An Svg is given pointerEvents directly. iOS ignores it on the Svg root and the " +
    "Svg takes the tap; use PassThroughSvg from @resources/Components/PassThroughSvg:\n  " +
    offenders.join("\n  ")
);

/* ------------------------------------- 2. the timer in the bottom bar -- */

const navFile = path.join(root, "src/Resources/ThemedComponents/ThemedBottomNavigation.js");
const navAst = parseFile(navFile);
const navSvgNames = svgRootNames(navAst);

function styleRefs(openingElement) {
  const attribute = openingElement.attributes.find(
    (item) => item.type === "JSXAttribute" && item.name.name === "style"
  );
  const refs = [];

  if (attribute) {
    visit(attribute.value, (node) => {
      if (
        node.type === "MemberExpression" &&
        node.object.type === "Identifier" &&
        node.object.name === "styles"
      ) {
        refs.push(node.property.name);
      }
    });
  }

  return refs;
}

function attributeExpression(openingElement, attributeName) {
  const attribute = openingElement.attributes.find(
    (item) => item.type === "JSXAttribute" && item.name.name === attributeName
  );

  return attribute?.value?.type === "JSXExpressionContainer" ? attribute.value.expression : null;
}

let timerWrap = null;
let timerSlot = null;

visit(navAst, (node, parent) => {
  if (node.type !== "JSXElement") return;

  const refs = styleRefs(node.openingElement);

  if (refs.includes("liveTimerWrap")) timerWrap = node;
  if (refs.includes("plusSlot") && !timerSlot) timerSlot = node;
});

assert.ok(timerWrap, "the live timer's wrap (styles.liveTimerWrap) is gone from the bottom bar");

const insideWrap = [];

visit(timerWrap, (node) => {
  if (node.type === "JSXElement" && node !== timerWrap) insideWrap.push(node);
});

const timerButtons = insideWrap.filter((node) => {
  if (jsxName(node.openingElement.name) !== "TouchableOpacity") return false;

  const onPress = attributeExpression(node.openingElement, "onPress");

  return onPress?.type === "Identifier" && onPress.name === "handleCenterButtonPress";
});

assert.strictEqual(
  timerButtons.length,
  1,
  "the timer square must be one TouchableOpacity with onPress={handleCenterButtonPress}"
);

const rawSvgsInWrap = insideWrap.filter((node) =>
  navSvgNames.has(jsxName(node.openingElement.name))
);

assert.deepStrictEqual(
  rawSvgsInWrap.map((node) => `line ${node.loc.start.line}`),
  [],
  "a raw Svg sits beside the timer button; on iOS it takes the tap. Use PassThroughSvg."
);

const rings = insideWrap.filter(
  (node) => jsxName(node.openingElement.name) === "PassThroughSvg"
);

assert.strictEqual(rings.length, 2, "the rest ring and the workout ring both go through PassThroughSvg");
assert.ok(
  rings.every((ring) => ring.start > timerButtons[0].start),
  "the rings are drawn after (over) the button - that is what PassThroughSvg is for"
);

// The 13 dp lift belongs to the slot. On the wrap it pushed the top of the
// button outside the slot's bounds, which iOS only hit-tests while nothing
// up the tree clips.
assert.ok(timerSlot, "the bottom bar's centre slot (styles.plusSlot) is gone");
assert.ok(
  styleRefs(timerSlot.openingElement).includes("plusSlotLiveTimer"),
  "the centre slot takes styles.plusSlotLiveTimer while the timer shows"
);

function styleObject(ast, key) {
  let found = null;

  visit(ast, (node) => {
    if (
      node.type === "ObjectProperty" &&
      (node.key.name ?? node.key.value) === key &&
      node.value.type === "ObjectExpression"
    ) {
      found = node.value;
    }
  });

  return found;
}

const wrapStyle = styleObject(navAst, "liveTimerWrap");
const slotLiftStyle = styleObject(navAst, "plusSlotLiveTimer");

assert.ok(
  !wrapStyle.properties.some((property) => property.key.name === "marginTop"),
  "liveTimerWrap has no marginTop; the lift is on plusSlotLiveTimer"
);
assert.ok(
  slotLiftStyle.properties.some((property) => property.key.name === "marginTop"),
  "plusSlotLiveTimer carries the timer's lift"
);

/* ------------------------------------------------ 3. the wrapper itself -- */

function flatten(style) {
  if (!style) return undefined;
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten));

  return style;
}

const absoluteFill = { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 };

loadAppModule.stubModule("react-native", {
  View: "View",
  StyleSheet: { flatten, absoluteFill },
});
loadAppModule.stubModule("react-native-svg", { __esModule: true, default: "Svg" });

// The loader compiles JSX to React.createElement.
global.React = projectRequire("react");

const passThrough = loadAppModule("src/Resources/Components/PassThroughSvg.js");
const PassThroughSvg = passThrough.default;
const { passThroughBoxStyle } = passThrough;

const ringStyle = { position: "absolute", top: 0, left: 0, width: 66, height: 66 };
const element = PassThroughSvg({
  style: ringStyle,
  width: 66,
  height: 66,
  viewBox: "0 0 66 66",
  children: "ring",
});

assert.strictEqual(element.type, "View", "the outer element is a plain View");
assert.strictEqual(element.props.pointerEvents, "none");
assert.deepStrictEqual(flatten(element.props.style), { ...ringStyle, flex: 0 });

const svg = element.props.children;

assert.strictEqual(svg.type, "Svg", "the Svg is inside the View");
assert.strictEqual(svg.props.pointerEvents, undefined, "the Svg itself gets no pointerEvents");
assert.strictEqual(svg.props.viewBox, "0 0 66 66");
assert.strictEqual(svg.props.width, "100%");
assert.strictEqual(svg.props.height, "100%");
assert.strictEqual(svg.props.children, "ring");

// The box follows react-native-svg's own rule.
// No size anywhere: it fills its parent.
assert.deepStrictEqual(flatten(passThroughBoxStyle(absoluteFill)), {
  ...absoluteFill,
  width: "100%",
  height: "100%",
  flex: 0,
});
// Explicit sizes win over the style - the body map's 200% crop stays 200% of
// the container, not 200% of a box that is already 200%.
assert.deepStrictEqual(
  flatten(
    passThroughBoxStyle(
      { position: "absolute", top: 0, left: 0, width: "100%", height: "200%" },
      "100%",
      "200%"
    )
  ),
  { position: "absolute", top: 0, left: 0, width: "100%", height: "200%", flex: 0 }
);
// Only one dimension known (the band's edge fade): the style is left alone.
const edgeFade = { position: "absolute", left: 0, top: 0, bottom: 0, width: 8 };

assert.strictEqual(passThroughBoxStyle(edgeFade), edgeFade);
// A numeric string becomes a number, as the Svg read it.
assert.deepStrictEqual(flatten(passThroughBoxStyle(undefined, "24", "100%")), {
  width: 24,
  height: "100%",
  flex: 0,
});
// Medal ring: absoluteFill plus the outer size.
assert.deepStrictEqual(flatten(passThroughBoxStyle(absoluteFill, 49, 49)), {
  ...absoluteFill,
  width: 49,
  height: 49,
  flex: 0,
});

console.log(
  "pass-through-svg: no Svg in src/ takes pointerEvents itself; the timer square opens the workout with nothing unwrapped over it; the wrapper is a View with pointerEvents=\"none\" sized the way the Svg was."
);
