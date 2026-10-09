// The PR readiness check, run against real throw-away git repositories: a
// branch is ready when it has a changelog fragment and leaves the version and
// CHANGELOG.md alone; a release commit is ready when it does the opposite.
// gh and the network are off (--no-gh --no-fetch).

const assert = require("assert");
const { execFileSync, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const flow = require("./git/flow");

// --- The pure parts ---------------------------------------------------------
for (const good of ["minor/more-catalog", "fix/the-bug", "major/new-ui", "breaking/schema", "feat/x", "release/2.17.6", "minor/v2.1-fix"]) {
  assert.strictEqual(flow.validateBranchName(good), null, `${good} is a fine name`);
}
for (const bad of ["wip", "Fix/The-Bug", "fix/", "fix/Upper", "feature-x", "fixes/x", "minor/with space"]) {
  assert.ok(flow.validateBranchName(bad), `${bad} is not`);
}
assert.ok(/not a work branch/.test(flow.validateBranchName("master")));
assert.ok(/detached/.test(flow.validateBranchName(null)));

assert.deepStrictEqual(flow.parseNameStatus("A\tdocs/a.md\nM\tpackage.json\nD\told.js\n"), [
  { status: "A", file: "docs/a.md" },
  { status: "M", file: "package.json" },
  { status: "D", file: "old.js" },
]);

const pullRequests = [
  { number: 1, headRefName: "fix/mine", files: [{ path: "package.json" }] },
  { number: 2, headRefName: "minor/other", files: [{ path: "package.json" }, { path: "src/a.js" }, { path: "changelog.d/minor-other.md" }] },
  { number: 3, headRefName: "minor/elsewhere", files: [{ path: "docs/x.md" }] },
];
assert.deepStrictEqual(
  flow.overlapsWithPullRequests(["package.json", "src/a.js", "changelog.d/fix-mine.md"], pullRequests, "fix/mine"),
  [{ number: 2, branch: "minor/other", files: ["package.json", "src/a.js"] }],
  "other PRs that change the same files, never this branch itself, and never a fragment (they are one file per branch)"
);

// --- A throw-away repository -------------------------------------------------
const FLOW = path.join(__dirname, "git", "flow.js");

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fitven-flow-"));
  const git = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

  git("init", "-q", "-b", "master");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "Test");
  git("config", "core.autocrlf", "false");
  fs.mkdirSync(path.join(dir, "changelog.d"));
  fs.mkdirSync(path.join(dir, "src"));
  fs.writeFileSync(path.join(dir, "package.json"), `${JSON.stringify({ name: "x", version: "2.17.5" }, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, "app.json"), `${JSON.stringify({ expo: { version: "2.17.5" } }, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, "CHANGELOG.md"), "# Changelog\n\n## [2.17.5] - 2026-10-04\n### Fixed\n- Older.\n");
  fs.writeFileSync(path.join(dir, "changelog.d", "README.md"), "How this works.\n");
  fs.writeFileSync(path.join(dir, "src", "a.js"), "module.exports = 1;\n");
  git("add", "-A");
  git("commit", "-q", "-m", "start");

  return {
    dir,
    git,
    write(file, content) {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      fs.writeFileSync(path.join(dir, file), content);
    },
    commit(message = "work") {
      git("add", "-A");
      git("commit", "-q", "-m", message);
    },
    check(...extra) {
      const result = spawnSync(process.execPath, [FLOW, "check", "--repo", dir, "--base", "master", "--no-gh", "--no-fetch", ...extra], {
        encoding: "utf8",
      });

      return { code: result.status, out: result.stdout };
    },
  };
}

const repos = [];
function scenario(branch) {
  const repo = makeRepo();

  repos.push(repo.dir);
  if (branch) {
    repo.git("switch", "-q", "-c", branch);
  }

  return repo;
}

try {
  // Nothing to merge.
  let repo = scenario("minor/thing");
  let result = repo.check();
  assert.strictEqual(result.code, 1);
  assert.ok(/nothing differs from master/.test(result.out));

  // Code without a fragment.
  repo.write("src/a.js", "module.exports = 2;\n");
  repo.commit();
  result = repo.check();
  assert.strictEqual(result.code, 1);
  assert.ok(/no changelog fragment in the branch/.test(result.out), "a branch with no fragment is not ready");

  // The skeleton is not a fragment.
  repo.write("changelog.d/minor-thing.md", "### Changed\n- Describe the change here.\n");
  repo.commit();
  result = repo.check();
  assert.strictEqual(result.code, 1);
  assert.ok(/still says "Describe the change here."/.test(result.out), "a fragment that still says the placeholder is not ready");

  // A finished fragment: ready.
  repo.write("changelog.d/minor-thing.md", "### Fixed\n- The thing.\n");
  repo.commit();
  result = repo.check();
  assert.strictEqual(result.code, 0, result.out);
  assert.ok(/Ready to merge/.test(result.out) && /is a valid fragment/.test(result.out));

  // A work branch that sets the version, or edits the changelog, is not.
  repo.write("package.json", `${JSON.stringify({ name: "x", version: "2.17.6-minor-thing.1" }, null, 2)}\n`);
  repo.commit();
  result = repo.check();
  assert.strictEqual(result.code, 1);
  assert.ok(/a work branch leaves the version alone/.test(result.out), "the version is the release commit's");

  repo.git("revert", "--no-edit", "HEAD");
  repo.write("CHANGELOG.md", "# Changelog\n\n## [2.17.6] - Unreleased\n### Fixed\n- Mine.\n\n## [2.17.5] - 2026-10-04\n### Fixed\n- Older.\n");
  repo.commit();
  result = repo.check();
  assert.strictEqual(result.code, 1);
  assert.ok(/CHANGELOG.md changed: put the entry in changelog.d/.test(result.out), "the changelog is the release commit's too");

  // A name that is not the convention.
  repo = scenario("wip");
  repo.write("changelog.d/wip.md", "### Fixed\n- x\n");
  repo.commit();
  result = repo.check();
  assert.strictEqual(result.code, 1);
  assert.ok(/does not match/.test(result.out), "wip is not a branch name");

  // master is not a work branch.
  repo = scenario();
  repo.write("src/a.js", "x\n");
  repo.commit();
  assert.ok(/not a work branch/.test(repo.check("--base", "HEAD~1").out));

  // Conflict markers are a failure whatever else is right.
  repo = scenario("fix/markers");
  repo.write("changelog.d/fix-markers.md", "### Fixed\n- x\n");
  repo.write("src/a.js", "<<<<<<< HEAD\nx\n=======\ny\n>>>>>>> other\n");
  repo.commit();
  result = repo.check();
  assert.strictEqual(result.code, 1);
  assert.ok(/conflict marker/.test(result.out), "a leftover conflict marker fails");

  // Behind master is a warning, not a failure.
  repo = scenario("fix/behind");
  repo.write("changelog.d/fix-behind.md", "### Fixed\n- x\n");
  repo.commit();
  repo.git("switch", "-q", "master");
  repo.write("src/b.js", "y\n");
  repo.commit("master moves on");
  repo.git("switch", "-q", "fix/behind");
  result = repo.check();
  assert.strictEqual(result.code, 0, result.out);
  assert.ok(/warn\s+1 commits behind master/.test(result.out), "behind master is worth a look, not a failure");

  // The release commit: it bumps both versions, dates its entry and has used up the fragments.
  repo = scenario("minor/release-2.17.6");
  repo.write("package.json", `${JSON.stringify({ name: "x", version: "2.17.6" }, null, 2)}\n`);
  repo.write("app.json", `${JSON.stringify({ expo: { version: "2.17.6" } }, null, 2)}\n`);
  repo.write("CHANGELOG.md", "# Changelog\n\n## [2.17.6] - 2026-10-09\n### Fixed\n- The thing.\n\n---\n\n## [2.17.5] - 2026-10-04\n### Fixed\n- Older.\n");
  repo.commit("Release 2.17.6");
  result = repo.check();
  assert.strictEqual(result.code, 0, result.out);
  assert.ok(/this is the release commit for 2.17.6/.test(result.out), "a stable version in package.json makes it a release commit");

  // ... not with a fragment left over, a missing entry, or versions that disagree.
  repo.write("changelog.d/fix-left.md", "### Fixed\n- x\n");
  repo.commit();
  assert.ok(/1 changelog fragments are still in the branch/.test(repo.check().out));
  repo.git("rm", "-q", "changelog.d/fix-left.md");
  repo.commit();

  repo.write("app.json", `${JSON.stringify({ expo: { version: "2.17.5" } }, null, 2)}\n`);
  repo.commit();
  assert.ok(/app.json expo.version is 2.17.5, package.json says 2.17.6/.test(repo.check().out));

  repo = scenario("minor/release-2.17.7");
  repo.write("package.json", `${JSON.stringify({ name: "x", version: "2.17.7" }, null, 2)}\n`);
  repo.write("app.json", `${JSON.stringify({ expo: { version: "2.17.7" } }, null, 2)}\n`);
  repo.commit();
  assert.ok(/no dated section for 2.17.7/.test(repo.check().out), "a release without its changelog entry is not ready");

  // The release plan reads the fragments that are in the checkout.
  repo = scenario();
  repo.write("changelog.d/fix-a.md", "### Fixed\n- a\n");
  repo.write("changelog.d/major-b.md", "### Added\n- b\n");
  repo.commit();
  const plan = spawnSync(process.execPath, [FLOW, "release-plan", "--repo", repo.dir, "--no-gh", "--no-fetch"], { encoding: "utf8" });
  assert.ok(/Unreleased \(2\)/.test(plan.stdout) && /Suggested version: 2\.18\.0/.test(plan.stdout), plan.stdout);

  // `state` never fails, in a repository or out of one.
  const inRepo = spawnSync(process.execPath, [FLOW, "state", "--repo", repo.dir, "--no-gh", "--no-fetch"], { encoding: "utf8" });
  assert.strictEqual(inRepo.status, 0);
  assert.ok(/You are on master\. Do not edit here/.test(inRepo.stdout), "on master it says to make a branch first");
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "fitven-nogit-"));
  repos.push(outside);
  assert.strictEqual(
    spawnSync(process.execPath, [FLOW, "state", "--repo", outside, "--no-gh", "--no-fetch"], { encoding: "utf8" }).status,
    0,
    "state is for the start of a chat: it does not fail"
  );
} finally {
  for (const dir of repos) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log(
  "Git flow: branch names, the PR check on real repositories (fragment, version and changelog left alone, conflict markers, behind master), the release commit's own rules, the release plan, and a state that never fails."
);
