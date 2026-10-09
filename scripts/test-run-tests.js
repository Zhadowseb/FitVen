// `npm test` is scripts/run-tests.js: it runs the checks and every
// scripts/test-*.js. That only holds if nothing the old long line in
// package.json ran can slip out of it, and if a failing test fails the run.

const assert = require("assert");
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { CHECKS, listCommands } = require("./run-tests");

const root = path.join(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

assert.strictEqual(pkg.scripts.test, "node scripts/run-tests.js", "npm test is the runner, not a line every branch edits");

// Everything a test:<name> script runs is run by the runner, so moving to it dropped nothing.
const covered = new Set(listCommands({ root, checks: true, only: null }).map((command) => command.file));

for (const [name, command] of Object.entries(pkg.scripts)) {
  const match = name.startsWith("test:") && command.match(/scripts\/([a-z0-9-]+\.js)/);

  if (match) {
    assert.ok(covered.has(`scripts/${match[1]}`), `${name} runs scripts/${match[1]}, which npm test would not`);
  }
}
for (const [file] of CHECKS) {
  assert.ok(fs.existsSync(path.join(root, file)), `${file} exists`);
}

// Every test-*.js is in: a test nobody added to a list is the case this exists for.
const onDisk = fs.readdirSync(__dirname).filter((name) => /^test-.+\.js$/.test(name));
for (const name of onDisk) {
  assert.ok(covered.has(`scripts/${name}`), `${name} is run`);
}

// --- Failing, for real -------------------------------------------------------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fitven-runner-"));

try {
  fs.mkdirSync(path.join(tmp, "scripts"));
  fs.writeFileSync(path.join(tmp, "scripts", "test-a.js"), "console.log('a runs');\n");
  fs.writeFileSync(path.join(tmp, "scripts", "test-b.js"), "console.error('b breaks'); process.exit(3);\n");
  fs.writeFileSync(path.join(tmp, "scripts", "test-c.js"), "console.log('c runs');\n");
  fs.writeFileSync(path.join(tmp, "scripts", "helper.js"), "console.log('not a test');\n");

  const run = (...args) =>
    spawnSync(process.execPath, [path.join(__dirname, "run-tests.js"), "--root", tmp, "--no-checks", ...args], { encoding: "utf8" });

  let result = run();
  assert.strictEqual(result.status, 1, "a failing test fails the run");
  assert.ok(result.stdout.includes("a runs") && !result.stdout.includes("c runs"), "it stops at the first failure");
  assert.ok(result.stderr.includes("FAILED: scripts/test-b.js (exit 3)"), "and names it");
  assert.ok(!result.stdout.includes("not a test"), "a file not named test-*.js is not a test");

  result = run("--all");
  assert.strictEqual(result.status, 1);
  assert.ok(result.stdout.includes("c runs"), "--all goes on past a failure");
  assert.ok(/1 failed[\s\S]*scripts\/test-b\.js/.test(result.stderr), "and lists what failed");

  result = run("--only", "test-a");
  assert.strictEqual(result.status, 0, "--only runs just those");
  assert.ok(!result.stdout.includes("c runs"));

  fs.rmSync(path.join(tmp, "scripts", "test-b.js"));
  result = run();
  assert.strictEqual(result.status, 0);
  assert.ok(/All 2 passed/.test(result.stdout), "a new test file is run with no list to add it to");

  // A check that is not there fails, it is not skipped.
  fs.rmSync(path.join(tmp, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "scripts"));
  const withChecks = spawnSync(process.execPath, [path.join(__dirname, "run-tests.js"), "--root", tmp], { encoding: "utf8" });
  assert.strictEqual(withChecks.status, 1, "a missing check is a failure");
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(
  "Test runner: npm test is the runner, it runs everything the old line did and every scripts/test-*.js on disk, stops at the first failure or lists them with --all, and a missing check fails."
);
