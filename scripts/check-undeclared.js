#!/usr/bin/env node
// Finds identifiers a file uses but never declares or imports.
//
// There is no linter and no type checking here, so a name that goes missing -
// a helper left behind when a file is split, an import removed with the last
// visible use, a typo - fails at runtime, when the screen is opened, and only
// if that path runs. Babel already tracks scopes to compile the file; this
// asks it which references never resolved.

const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");

const root = path.resolve(__dirname, "..");
const projectRequire = createRequire(path.join(root, "package.json"));
const babel = projectRequire("@babel/core");
const traverse = projectRequire("@babel/traverse").default;

// Globals a React Native module may use without importing them.
const AMBIENT = new Set([
  "console", "require", "module", "exports", "process", "global", "globalThis",
  "setTimeout", "clearTimeout", "setInterval", "clearInterval", "fetch",
  "Promise", "Math", "JSON", "Date", "Object", "Array", "String", "Number",
  "Boolean", "Error", "Map", "Set", "WeakMap", "WeakSet", "Symbol", "RegExp",
  "Intl", "parseInt", "parseFloat", "isNaN", "isFinite", "encodeURIComponent",
  "decodeURIComponent", "encodeURI", "decodeURI", "TextEncoder", "TextDecoder",
  "AbortController", "URL", "URLSearchParams", "Buffer", "structuredClone",
  "__DEV__", "React", "Proxy", "Reflect", "BigInt", "queueMicrotask",
  "requestAnimationFrame", "cancelAnimationFrame", "atob", "btoa", "FormData",
  "Blob", "File", "FileReader", "Headers", "Request", "Response", "WebSocket",
  "XMLHttpRequest", "Uint8Array", "Int32Array", "Float64Array", "ArrayBuffer",
  "DataView", "performance", "navigator", "window", "document", "localStorage",
  "arguments", "undefined", "NaN", "Infinity", "Deno",
]);

function firstLine(message) {
  return String(message).split(String.fromCharCode(10))[0];
}

function sourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (full.endsWith(".js")) out.push(full);
  }

  return out;
}

const files = [path.join(root, "App.js"), ...sourceFiles(path.join(root, "src"))];
const problems = [];

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  let ast;

  try {
    // Parsed, not compiled: the scopes have to be the ones the author wrote,
    // before a transform introduces or renames any binding.
    ast = babel.parseSync(source, {
      filename: file,
      babelrc: false,
      configFile: false,
      sourceType: "module",
      parserOpts: { plugins: ["jsx", "classProperties", "objectRestSpread"] },
    });
  } catch (error) {
    problems.push(
      `${path.relative(root, file).split(path.sep).join("/")} does not parse: ${firstLine(error.message)}`
    );
    continue;
  }

  // Babel's own scope analysis. Whatever it could not bind is free.
  const unresolved = [];

  traverse(ast, {
    Program(programPath) {
      for (const name of Object.keys(programPath.scope.globals)) {
        if (!AMBIENT.has(name)) unresolved.push(name);
      }
    },
  });

  if (unresolved.length) {
    problems.push(
      `${path.relative(root, file).split(path.sep).join("/")} uses ${unresolved
        .map((name) => `"${name}"`)
        .join(", ")} without declaring or importing it`
    );
  }
}

if (problems.length) {
  console.error("Names that will be undefined at runtime:\n");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(`\n${problems.length} problem(s).`);
  process.exit(1);
}

console.log(`Undeclared-name checks passed (${files.length} files).`);
