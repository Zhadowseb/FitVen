#!/usr/bin/env node
// `npm test`: the checks, then every scripts/test-*.js, one after the other.
//
// It used to be one long line in package.json - `npm run test:a && npm run
// test:b && ...` - which every branch that added a test had to edit, so two
// branches that each added one conflicted on that line, and a test that was
// written but never added to it (scripts/test-username-search.js, for a
// while) was never run by anyone. Now a file named scripts/test-*.js is run
// because it exists. A new test is one new file and no edit to package.json.
//
//   npm test                    the checks and every test, stopping at the first failure
//   npm test -- --all           all of them, and the list of failures at the end
//   npm test -- --only <text>   just the files whose name contains <text>
//
// The `test:<name>` scripts in package.json still work for running one.

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Not named test-*.js, so they are listed. Each is `node <file> [args]`.
const CHECKS = [
  ["scripts/check-agent-docs.js"],
  ["scripts/check-imports.js"],
  ["scripts/check-undeclared.js"],
  ["scripts/check-privacy-policy.js"],
  ["scripts/build-privacy-policy-page.js", "--check"],
  ["scripts/build-terms-page.js", "--check"],
  ["scripts/check-hardcoded-strings.js", "--check"],
];

// Node warns that the scripts have no module type (package.json has none, and
// adding one would change every other script here). Off for all of them.
const NODE_FLAGS = ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON"];

function parseArgs(argv) {
  const options = { all: false, only: null, root: path.resolve(__dirname, ".."), checks: true };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--all") options.all = true;
    else if (token === "--only") options.only = argv[++index];
    else if (token === "--root") options.root = path.resolve(argv[++index]);
    else if (token === "--no-checks") options.checks = false;
  }

  return options;
}

/** Every command to run, in order: [{ label, args }]. */
function listCommands({ root, checks, only }) {
  const commands = [];

  if (checks) {
    for (const [file, ...rest] of CHECKS) {
      commands.push({ label: [file, ...rest].join(" "), file, args: rest });
    }
  }

  const dir = path.join(root, "scripts");
  const tests = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((name) => /^test-.+\.js$/.test(name)).sort()
    : [];

  for (const name of tests) {
    commands.push({ label: `scripts/${name}`, file: `scripts/${name}`, args: [] });
  }

  return only ? commands.filter((command) => command.label.includes(only)) : commands;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const commands = listCommands(options);
  const failures = [];
  const started = Date.now();

  if (commands.length === 0) {
    console.error("No checks or tests to run.");
    process.exit(1);
  }

  for (const [index, command] of commands.entries()) {
    console.log(`\n[${index + 1}/${commands.length}] ${command.label}`);

    const file = path.join(options.root, command.file);
    const result = fs.existsSync(file)
      ? spawnSync(process.execPath, [...NODE_FLAGS, file, ...command.args], { cwd: options.root, stdio: "inherit" })
      : { status: 1, error: new Error("the file is not there") };

    if (result.status !== 0) {
      failures.push(command.label);
      console.error(`\nFAILED: ${command.label}${result.status ? ` (exit ${result.status})` : ""}`);

      if (!options.all) {
        break;
      }
    }
  }

  const seconds = Math.round((Date.now() - started) / 1000);

  if (failures.length) {
    console.error(`\n${failures.length} failed in ${seconds}s:\n  ${failures.join("\n  ")}`);
    process.exit(1);
  }

  console.log(`\nAll ${commands.length} passed in ${seconds}s.`);
}

module.exports = { CHECKS, listCommands };

if (require.main === module) {
  main();
}
