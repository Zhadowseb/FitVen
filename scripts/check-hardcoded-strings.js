// Finds text the app shows that is written straight into the code instead of
// going through t(), and so never changes language.
//
// Looks at what reaches a person: text between JSX tags, the string props
// that are read out or shown (title, label, placeholder, message, ...), the
// first arguments of Alert.alert, and `throw new Error("...")` in the
// services, whose messages end up on screen. A string counts when it has a
// word in it - two letters in a row - so "kg", "×" and "·" pass.
//
//   node scripts/check-hardcoded-strings.js            the report
//   node scripts/check-hardcoded-strings.js --summary  counts per file only
//   node scripts/check-hardcoded-strings.js --check    exit 1 when anything
//                                                      new turns up (npm test)
//
// A string that is right as it is - a brand name, a unit, a debug screen -
// goes in ALLOWED below with the reason.

const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");

const root = path.resolve(__dirname, "..");
const projectRequire = createRequire(path.join(root, "package.json"));
const babel = projectRequire("@babel/core");
const traverse = projectRequire("@babel/traverse").default;

const TEXT_PROPS = new Set([
  "title",
  "label",
  "placeholder",
  "message",
  "confirmLabel",
  "cancelLabel",
  "subtitle",
  "description",
  "emptyText",
  "helperText",
  "accessibilityLabel",
  "accessibilityHint",
  "buttonLabel",
  "actionLabel",
  "eyebrow",
  "caption",
  "headerTitle",
  "text",
]);

// Strings that are meant to stay as they are, in any language.
const ALLOWED = new Set([
  "FitVen",
  "AMRAP",
  "RPE",
  "1RM",
  "1RM %",
  "PR",
  "OK",
  "Spotify",
]);

// Text that stays as it is in one file only, with why.
const ALLOWED_IN_FILE = {
  // Developer-facing: names the app config and the Spotify dashboard, and only
  // shows on a build somebody is setting up.
  "src/Pages/MusicSettingsPage/MusicSettingsPage.js": [
    "Spotify needs a client id in the app config and this redirect URI registered in the Spotify dashboard:",
  ],
};

// Files whose text is not for translation here.
const SKIPPED_FILES = [
  /\/Localization\//,
  // Seen by the admin account only.
  /\/DevDashboard/i,
  /\.test\.js$/,
  // Sync errors go to the log and the retry, not to the screen.
  /\/Services\/cloudSync\//,
  // The privacy policy and the terms are legal texts; they stay in English
  // until a Danish version has been read by a person.
  /\/Resources\/Legal\//,
  /\/PrivacyPolicyPage\//,
  /\/TermsOfUsePage\//,
  /\/PrivacyPolicyBody\//,
  // The muscle-group `label`s are identifiers other code groups by; the
  // screens show them through muscleGroupLabel().
  /\/Utils\/exerciseMuscleGroups\.js$/,
];

// "social.relationship.followers": a translation key waiting for t(), not text.
const TRANSLATION_KEY = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9_]+)+$/;

const WORD = /[A-Za-zÆØÅæøå]{2,}/;

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") {
        walk(full, files);
      }
    } else if (entry.name.endsWith(".js")) {
      files.push(full);
    }
  }

  return files;
}

function isUserText(value) {
  const trimmed = String(value ?? "").trim();

  return (
    trimmed.length > 0 &&
    WORD.test(trimmed) &&
    !ALLOWED.has(trimmed) &&
    !TRANSLATION_KEY.test(trimmed)
  );
}

function literalText(node) {
  if (!node) {
    return null;
  }

  if (node.type === "StringLiteral") {
    return node.value;
  }

  if (node.type === "TemplateLiteral") {
    return node.quasis.map((quasi) => quasi.value.cooked).join("{}");
  }

  return null;
}

function scan(file) {
  const allowedHere = new Set(ALLOWED_IN_FILE[path.relative(root, file).split(path.sep).join("/")] ?? []);
  const source = fs.readFileSync(file, "utf8");
  const found = [];
  let ast;

  try {
    ast = babel.parseSync(source, {
      filename: file,
      babelrc: false,
      configFile: false,
      sourceType: "module",
      parserOpts: { plugins: ["jsx", "classProperties", "objectRestSpread"] },
    });
  } catch {
    return found;
  }

  const add = (node, text, kind) => {
    if (isUserText(text) && !allowedHere.has(text.trim().replace(/\s+/g, " "))) {
      found.push({ line: node.loc?.start.line ?? 0, text: text.trim().replace(/\s+/g, " "), kind });
    }
  };

  traverse(ast, {
    JSXText(p) {
      add(p.node, p.node.value, "jsx");
    },
    JSXExpressionContainer(p) {
      // {"literal"} or {`literal`} as a child.
      if (p.parent.type === "JSXElement" || p.parent.type === "JSXFragment") {
        const text = literalText(p.node.expression);

        if (text !== null) {
          add(p.node, text, "jsx");
        }
      }
    },
    JSXAttribute(p) {
      const name = p.node.name?.name;

      if (!TEXT_PROPS.has(name) || !p.node.value) {
        return;
      }

      const value =
        p.node.value.type === "StringLiteral"
          ? p.node.value.value
          : p.node.value.type === "JSXExpressionContainer"
            ? literalText(p.node.value.expression)
            : null;

      if (value !== null) {
        add(p.node, value, `prop:${name}`);
      }
    },
    CallExpression(p) {
      const callee = p.node.callee;
      const isAlert =
        callee.type === "MemberExpression" &&
        callee.object?.name === "Alert" &&
        callee.property?.name === "alert";

      if (isAlert) {
        p.node.arguments.slice(0, 2).forEach((argument) => {
          const text = literalText(argument);

          if (text !== null) {
            add(argument, text, "alert");
          }
        });
      }
    },
    NewExpression(p) {
      // Error messages from the services reach the screen through
      // `error.message`.
      if (p.node.callee?.name === "Error" && /\/Services\//.test(file.split(path.sep).join("/"))) {
        const text = literalText(p.node.arguments[0]);

        if (text !== null) {
          add(p.node, text, "error");
        }
      }
    },
    ObjectProperty(p) {
      // { label: "Minutes" } and the like, in option lists handed to controls.
      const key = p.node.key?.name ?? p.node.key?.value;

      if (!["label", "title", "subtitle", "description", "message", "placeholder"].includes(key)) {
        return;
      }

      const text = literalText(p.node.value);

      if (text !== null) {
        add(p.node, text, `object:${key}`);
      }
    },
  });

  return found;
}

const files = walk(path.join(root, "src"))
  .map((file) => file.split(path.sep).join("/"))
  .filter((file) => !SKIPPED_FILES.some((pattern) => pattern.test(file)));

const report = files
  .map((file) => ({ file: path.relative(root, file).split(path.sep).join("/"), hits: scan(file) }))
  .filter((entry) => entry.hits.length > 0)
  .sort((left, right) => right.hits.length - left.hits.length);

const total = report.reduce((sum, entry) => sum + entry.hits.length, 0);
const mode = process.argv[2];

if (mode === "--summary") {
  report.forEach((entry) => console.log(`${String(entry.hits.length).padStart(4)}  ${entry.file}`));
  console.log(`${total} strings in ${report.length} files`);
} else if (mode === "--check") {
  if (total > 0) {
    report.forEach((entry) =>
      entry.hits.forEach((hit) => console.error(`${entry.file}:${hit.line}  ${hit.text}`))
    );
    console.error(`\n${total} strings in ${report.length} files are written into the code instead of going through t().`);
    process.exit(1);
  }

  console.log(`Hard-coded strings: none in ${files.length} files.`);
} else {
  report.forEach((entry) => {
    console.log(`\n${entry.file} (${entry.hits.length})`);
    entry.hits.forEach((hit) => console.log(`  ${hit.line}\t[${hit.kind}] ${hit.text}`));
  });
  console.log(`\n${total} strings in ${report.length} files`);
}
