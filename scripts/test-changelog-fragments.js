// Changelog fragments: the pure parts, and the release command run for real
// in a throw-away copy of the repository's version files, so what ends up in
// CHANGELOG.md and package.json is checked rather than assumed.

const assert = require("assert");
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const f = require("./changelog-fragments");

// --- Names and bumps --------------------------------------------------------
assert.strictEqual(f.fragmentNameForBranch("minor/more-catalog-exercises"), "minor-more-catalog-exercises.md");
assert.strictEqual(f.fragmentNameForBranch("fix/The_Bug (2)"), "fix-the-bug-2.md", "anything but letters and digits becomes one dash");
assert.strictEqual(f.bumpFromFragmentName("fix-a.md"), "patch");
assert.strictEqual(f.bumpFromFragmentName("minor-a.md"), "patch");
assert.strictEqual(f.bumpFromFragmentName("major-a.md"), "minor");
assert.strictEqual(f.bumpFromFragmentName("feat-a.md"), "minor");
assert.strictEqual(f.bumpFromFragmentName("breaking-a.md"), "major");
assert.strictEqual(f.suggestNextVersion("2.17.5", ["fix-a.md", "minor-b.md"]), "2.17.6");
assert.strictEqual(f.suggestNextVersion("2.17.5", ["fix-a.md", "major-b.md"]), "2.18.0", "the biggest one wins");
assert.strictEqual(f.suggestNextVersion("2.17.5-minor-x.1", ["breaking-a.md"]), "3.0.0", "a prerelease suffix is ignored");

// --- Validating a fragment --------------------------------------------------
assert.deepStrictEqual(f.validateFragment("### Fixed\n- The start sheet follows the accent.\n"), []);
assert.ok(f.validateFragment(f.skeleton()).some((problem) => /still says/.test(problem)), "the skeleton is not a finished fragment");
assert.ok(f.validateFragment("- no heading\n").some((problem) => /no `### Added/.test(problem)));
assert.ok(f.validateFragment("Some intro\n### Fixed\n- x\n").some((problem) => /before the first ### heading/.test(problem)));
assert.ok(f.validateFragment("### Added\n\n### Fixed\n- x\n").some((problem) => /Added.*empty/.test(problem)), "an empty heading is a problem");

// --- Merging ----------------------------------------------------------------
const merged = f.mergeSections([
  "### Fixed\n- one\n### Added\n- two\n",
  "### Added\n- three\n  - nested\n### Odd\n- four\n",
  "### Changed\n- Describe the change here.\n",
]);
assert.strictEqual(
  merged,
  "### Added\n- two\n- three\n  - nested\n### Fixed\n- one\n### Odd\n- four",
  "same heading together, usual order, unknown headings last, placeholders dropped"
);

// --- Folding into the changelog ---------------------------------------------
const changelog = [
  "# Changelog",
  "",
  "## [2.17.6] - 2026-10-09",
  "### Changed",
  "- Describe release changes here.",
  "",
  "---",
  "",
  "## [2.17.5] - 2026-10-04",
  "### Fixed",
  "- Older.",
  "",
].join("\n");
const folded = f.insertFragmentsIntoChangelog(changelog, "2.17.6", ["### Added\n- a\n", "### Fixed\n- b\n"], "\n");

assert.ok(folded.includes("## [2.17.6] - 2026-10-09\n### Added\n- a\n### Fixed\n- b\n\n---"), "the entry holds the fragments and keeps its separator");
assert.ok(!folded.includes("Describe release changes here"), "the placeholder is gone");
assert.ok(folded.includes("## [2.17.5] - 2026-10-04\n### Fixed\n- Older."), "the older entry is untouched");
assert.strictEqual(
  f.insertFragmentsIntoChangelog("## [1.0.0] - 2026-01-01\n### Added\n- first\n\n---\n", "1.0.0", ["### Added\n- more\n"], "\n"),
  "## [1.0.0] - 2026-01-01\n### Added\n- first\n- more\n\n---\n",
  "an entry that already has text keeps it, first"
);
assert.ok(
  f.insertFragmentsIntoChangelog("## [1.0.0] - 2026-01-01\n### Added\n- first\n\n---\n", "1.0.0", ["### Added\n- more\n"], "\r\n").includes("- first\r\n- more\r\n"),
  "line endings follow the file"
);
assert.throws(() => f.insertFragmentsIntoChangelog("# Changelog\n", "9.9.9", ["### Added\n- x\n"]), /no section for 9.9.9/);

// --- The release command, for real -------------------------------------------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fitven-release-"));

try {
  fs.mkdirSync(path.join(tmp, "scripts"));
  fs.mkdirSync(path.join(tmp, "changelog.d"));
  for (const file of ["version.js", "changelog-fragments.js"]) {
    fs.copyFileSync(path.join(__dirname, file), path.join(tmp, "scripts", file));
  }
  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "x", version: "2.17.5" }, null, 2));
  fs.writeFileSync(path.join(tmp, "app.json"), JSON.stringify({ expo: { version: "2.17.5" } }, null, 2));
  fs.writeFileSync(path.join(tmp, "CHANGELOG.md"), "# Changelog\n\n## [2.17.5] - 2026-10-04\n### Fixed\n- Older.\n");
  fs.writeFileSync(path.join(tmp, "changelog.d", "README.md"), "How this folder works.\n");
  fs.writeFileSync(path.join(tmp, "changelog.d", "fix-b.md"), "### Fixed\n- The bug.\n");
  fs.writeFileSync(path.join(tmp, "changelog.d", "minor-a.md"), "### Added\n- The feature.\n### Fixed\n- Another bug.\n");

  const version = (...args) =>
    execFileSync(process.execPath, [path.join(tmp, "scripts", "version.js"), ...args], { cwd: tmp, encoding: "utf8" });

  // On a work branch the command only makes the fragment: no version, no changelog.
  const before = fs.readFileSync(path.join(tmp, "CHANGELOG.md"), "utf8");
  const started = version("auto", "branch=minor/my-thing");

  assert.ok(fs.existsSync(path.join(tmp, "changelog.d", "minor-my-thing.md")), "auto creates the branch's fragment");
  assert.ok(started.includes("package.json, app.json and CHANGELOG.md are left alone"), "and says what it leaves alone");
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(tmp, "package.json"), "utf8")).version, "2.17.5", "the version is not touched");
  assert.strictEqual(fs.readFileSync(path.join(tmp, "CHANGELOG.md"), "utf8"), before, "CHANGELOG.md is not touched");
  assert.ok(version("auto", "branch=minor/other", "dry-run").includes("[dry-run]"));
  assert.ok(!fs.existsSync(path.join(tmp, "changelog.d", "minor-other.md")), "a dry run writes nothing");
  fs.unlinkSync(path.join(tmp, "changelog.d", "minor-my-thing.md"));

  // A dry run of the release changes nothing either.
  version("release", "2.17.6", "dry-run");
  assert.ok(fs.existsSync(path.join(tmp, "changelog.d", "fix-b.md")), "a dry run keeps the fragments");

  // The release folds the fragments in, bumps both versions and removes them.
  const released = version("release", "2.17.6");
  const text = fs.readFileSync(path.join(tmp, "CHANGELOG.md"), "utf8");

  assert.ok(released.includes("2 fragments folded into the entry and removed"), "it says what it did");
  assert.ok(/^## \[2\.17\.6\] - \d{4}-\d{2}-\d{2}\n### Added\n- The feature\.\n### Fixed\n- The bug\.\n- Another bug\.\n/m.test(text), "the entry merges both fragments by heading, in file name order");
  assert.ok(text.indexOf("## [2.17.6]") < text.indexOf("## [2.17.5]"), "the new entry is first");
  assert.ok(!text.includes("Describe release changes here"), "no placeholder");
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(tmp, "package.json"), "utf8")).version, "2.17.6");
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(tmp, "app.json"), "utf8")).expo.version, "2.17.6");
  assert.deepStrictEqual(fs.readdirSync(path.join(tmp, "changelog.d")), ["README.md"], "only the explanation is left");
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(
  "Changelog fragments: names and bumps, validation, merging by heading, folding into an entry, and the release command in a copy - a work branch only makes its fragment, a release folds them in and removes them."
);
