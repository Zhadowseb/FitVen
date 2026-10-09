#!/usr/bin/env node
// The git flow, as something that can be run: where the work stands, whether a
// branch is ready to be a PR, and what a release would contain. The rules it
// checks are in docs/VERSIONING.md; this is only the part that can be
// checked by a machine.
//
//   node scripts/git/flow.js state          where things stand (what the session-start hook prints)
//   node scripts/git/flow.js check          is this branch ready to merge?   (npm run pr:check)
//   node scripts/git/flow.js release-plan   what a release would contain     (npm run release:plan)
//
// Flags: --base <ref> (default origin/master), --repo <dir>, --branch <name>,
//        --ci (the branch is GITHUB_HEAD_REF, gh is used with the job's token),
//        --no-gh, --no-fetch.
//
// `state` never fails: it runs when a chat starts, and a broken network or a
// missing gh is not a reason to stop one. `check` exits 1 if anything it calls
// FAIL is true.

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const fragments = require("../changelog-fragments");

const BRANCH_PATTERN =
  /^(major|minor|fix|feat|feature|breaking|hotfix|bugfix|quickfix|minor-feature|major-feature|release)\/[a-z0-9][a-z0-9._-]*$/;
const STABLE_VERSION = /^\d+\.\d+\.\d+$/;
const PROTECTED_BRANCH = /^(master|main)$/;

// Files two branches are likely to both want to change, so an overlap there is
// the kind that conflicts rather than the kind that merges by itself.
const HOT_FILES = new Set([
  "package.json",
  "app.json",
  "CHANGELOG.md",
  "README.md",
  "AGENTS.md",
  "docs/MAP.md",
  "docs/VERSIONING.md",
  "supabase/migrations/README.md",
  "src/Services/weightliftingService.js",
  "src/Services/programService.js",
  "App.js",
]);

function parseArgs(argv) {
  const [command = "state", ...rest] = argv;
  const options = { command, base: null, repo: process.cwd(), branch: null, ci: false, gh: true, fetch: true };

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];

    if (token === "--base") options.base = rest[++index];
    else if (token === "--repo") options.repo = path.resolve(rest[++index]);
    else if (token === "--branch") options.branch = rest[++index];
    else if (token === "--ci") options.ci = true;
    else if (token === "--no-gh") options.gh = false;
    else if (token === "--no-fetch") options.fetch = false;
  }

  return options;
}

function run(command, args, { cwd, timeout = 20000 } = {}) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", timeout, windowsHide: true });

  if (result.error || result.status !== 0) {
    return null;
  }

  return result.stdout.trim();
}

const git = (options, args, timeout) => run("git", args, { cwd: options.repo, timeout });

/** The branch name, or null when HEAD is detached and none was given. */
function currentBranch(options) {
  if (options.branch) {
    return options.branch;
  }

  if (options.ci) {
    return process.env.GITHUB_HEAD_REF || null;
  }

  const name = git(options, ["rev-parse", "--abbrev-ref", "HEAD"]);

  return name && name !== "HEAD" ? name : null;
}

function resolveBase(options) {
  const candidates = options.base ? [options.base] : ["origin/master", "master", "origin/main", "main"];

  return candidates.find((ref) => git(options, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`])) ?? null;
}

function validateBranchName(name) {
  if (!name) {
    return "HEAD is detached; the branch has no name";
  }

  if (PROTECTED_BRANCH.test(name)) {
    return `${name} is not a work branch: make a branch first`;
  }

  if (!BRANCH_PATTERN.test(name)) {
    return `"${name}" does not match <major|minor|fix|breaking|...>/<lower-case-name> (docs/VERSIONING.md)`;
  }

  return null;
}

/** `git diff --name-status` as [{ status, file }]. */
function parseNameStatus(text) {
  return String(text ?? "")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [status, ...rest] = line.split("\t");

      return { status: status[0], file: rest[rest.length - 1] };
    });
}

function readJsonAt(options, ref, file) {
  const text = git(options, ["show", `${ref}:${file}`]);

  try {
    return text === null ? null : JSON.parse(text);
  } catch (_error) {
    return null;
  }
}

function readTextAt(options, ref, file) {
  return git(options, ["show", `${ref}:${file}`]);
}

/** Which of `files` another open PR also changes. */
function overlapsWithPullRequests(files, pullRequests, ownBranch) {
  const mine = new Set(files.filter((file) => !file.startsWith(`${fragments.FRAGMENT_DIR}/`)));

  return pullRequests
    .filter((pr) => pr.headRefName !== ownBranch)
    .map((pr) => ({
      number: pr.number,
      branch: pr.headRefName,
      files: (pr.files ?? []).map((entry) => entry.path).filter((file) => mine.has(file)),
    }))
    .filter((overlap) => overlap.files.length > 0);
}

function listOpenPullRequests(options, fields) {
  if (!options.gh) {
    return null;
  }

  const env = options.ci ? { ...process.env, GH_TOKEN: process.env.GH_TOKEN || process.env.GITHUB_TOKEN } : process.env;
  const result = spawnSync("gh", ["pr", "list", "--state", "open", "--limit", "50", "--json", fields], {
    cwd: options.repo,
    encoding: "utf8",
    timeout: 20000,
    windowsHide: true,
    env,
  });

  if (result.error || result.status !== 0) {
    return null;
  }

  try {
    return JSON.parse(result.stdout);
  } catch (_error) {
    return null;
  }
}

function maybeFetch(options) {
  if (options.fetch && !options.ci) {
    git(options, ["fetch", "--quiet", "origin"], 15000);
  }
}

// ---------------------------------------------------------------- check ----

function check(options) {
  const fails = [];
  const warns = [];
  const oks = [];
  const fail = (message) => fails.push(message);
  const warn = (message) => warns.push(message);
  const ok = (message) => oks.push(message);

  maybeFetch(options);

  const branch = currentBranch(options);
  const base = resolveBase(options);
  const bot = options.ci && /\[bot\]$/.test(process.env.GITHUB_ACTOR ?? "");

  if (bot) {
    console.log(`Skipped: ${process.env.GITHUB_ACTOR} is a bot.`);
    return 0;
  }

  const nameProblem = validateBranchName(branch);

  if (nameProblem) {
    fail(nameProblem);
  } else {
    ok(`branch name ${branch}`);
  }

  if (!base) {
    fail("no base branch to compare with (origin/master)");
    return report({ fails, warns, oks });
  }

  const mergeBase = git(options, ["merge-base", base, "HEAD"]);

  if (!mergeBase) {
    fail(`${branch ?? "HEAD"} shares no history with ${base}`);
    return report({ fails, warns, oks });
  }

  const changed = parseNameStatus(git(options, ["diff", "--name-status", "--no-renames", mergeBase, "HEAD"]));
  const changedFiles = changed.map((entry) => entry.file);

  if (changed.length === 0) {
    fail(`nothing differs from ${base}: there is nothing to merge`);
    return report({ fails, warns, oks });
  }

  const basePackage = readJsonAt(options, mergeBase, "package.json");
  const headPackage = readJsonAt(options, "HEAD", "package.json");
  const baseApp = readJsonAt(options, mergeBase, "app.json");
  const headApp = readJsonAt(options, "HEAD", "app.json");
  const versionChanged = Boolean(basePackage && headPackage && basePackage.version !== headPackage.version);
  const appVersionChanged = Boolean(baseApp && headApp && baseApp.expo?.version !== headApp.expo?.version);
  const changelogChanged = changedFiles.includes("CHANGELOG.md");
  const isReleasePr = versionChanged && STABLE_VERSION.test(String(headPackage.version));
  const fragmentFiles = changedFiles.filter(
    (file) => file.startsWith(`${fragments.FRAGMENT_DIR}/`) && file.toLowerCase().endsWith(".md") && !/readme\.md$/i.test(file)
  );

  if (isReleasePr) {
    checkReleasePr({ options, headPackage, headApp, changed, fail, ok, warn });
  } else {
    if (versionChanged) {
      fail(
        `package.json version changed to ${headPackage.version}: a work branch leaves the version alone, the release commit sets it`
      );
    }

    if (appVersionChanged) {
      fail("app.json expo.version changed: a work branch leaves the version alone, the release commit sets it");
    }

    if (changelogChanged) {
      fail(`CHANGELOG.md changed: put the entry in ${fragments.FRAGMENT_DIR}/<branch>.md, the release commit folds it in`);
    }

    const added = changed.filter((entry) => fragmentFiles.includes(entry.file) && entry.status !== "D");

    if (added.length === 0) {
      fail(
        `no changelog fragment in the branch: run npm run version:auto, write ${fragments.FRAGMENT_DIR}/${fragments.fragmentNameForBranch(branch ?? "branch")}, commit it`
      );
    }

    for (const entry of added) {
      const problems = fragments.validateFragment(readTextAt(options, "HEAD", entry.file) ?? "");

      if (problems.length) {
        problems.forEach((problem) => fail(`${entry.file} ${problem}`));
      } else {
        ok(`${entry.file} is a valid fragment`);
      }

      if (branch && path.basename(entry.file) !== fragments.fragmentNameForBranch(branch)) {
        warn(`${entry.file} is not named after the branch (${fragments.fragmentNameForBranch(branch)})`);
      }
    }
  }

  // Conflict markers are a failure; other whitespace is only worth a look.
  const diffCheck = spawnSync("git", ["diff", "--check", mergeBase, "HEAD"], {
    cwd: options.repo,
    encoding: "utf8",
    windowsHide: true,
  });
  const checkLines = (diffCheck.stdout ?? "").split(/\r?\n/).filter((line) => /^[^\s].*:\d+:/.test(line));
  const markers = checkLines.filter((line) => /conflict marker/i.test(line));

  if (markers.length) {
    markers.slice(0, 5).forEach((line) => fail(line));
  }

  if (checkLines.length > markers.length) {
    warn(`git diff --check finds ${checkLines.length - markers.length} whitespace issues (git diff --check ${base}...HEAD)`);
  }

  const behind = Number(git(options, ["rev-list", "--count", `HEAD..${base}`]) ?? 0);

  if (behind > 0) {
    warn(`${behind} commits behind ${base}: merge it in before this is merged if the CI or the overlaps below say so`);
  } else {
    ok(`up to date with ${base}`);
  }

  if (!options.ci) {
    const dirty = (git(options, ["status", "--porcelain"]) ?? "").split(/\r?\n/).filter(Boolean);

    if (dirty.length) {
      warn(`${dirty.length} uncommitted or untracked files are not part of the PR: ${dirty.slice(0, 4).map((line) => line.slice(3)).join(", ")}${dirty.length > 4 ? ", ..." : ""}`);
    }
  }

  const pullRequests = listOpenPullRequests(options, "number,headRefName,files");

  if (pullRequests) {
    const overlaps = overlapsWithPullRequests(changedFiles, pullRequests, branch);

    for (const overlap of overlaps) {
      const hot = overlap.files.filter((file) => HOT_FILES.has(file));

      warn(
        `#${overlap.number} (${overlap.branch}) also changes ${overlap.files.length} of these files` +
          `${hot.length ? `, among them ${hot.join(", ")}` : ""}: ${hot.length ? "expect a conflict, merge them one after the other" : "merges by itself unless the same lines are touched"}`
      );
    }

    if (overlaps.length === 0) {
      ok("no other open PR changes the same files");
    }
  }

  return report({ fails, warns, oks });
}

function checkReleasePr({ options, headPackage, headApp, changed, fail, ok, warn }) {
  const version = headPackage.version;

  ok(`this is the release commit for ${version}`);

  if (headApp?.expo?.version !== version) {
    fail(`app.json expo.version is ${headApp?.expo?.version}, package.json says ${version}`);
  }

  const changelog = readTextAt(options, "HEAD", "CHANGELOG.md") ?? "";
  const dated = new RegExp(`^## \\[${version.replace(/\./g, "\\.")}\\] - \\d{4}-\\d{2}-\\d{2}\\s*$`, "m");

  if (!dated.test(changelog)) {
    fail(`CHANGELOG.md has no dated section for ${version}: run npm run release:prepare -- ${version}`);
  }

  const left = (git(options, ["ls-tree", "-r", "--name-only", "HEAD", fragments.FRAGMENT_DIR]) ?? "")
    .split(/\r?\n/)
    .filter((file) => file && !/readme\.md$/i.test(file));

  if (left.length) {
    fail(`${left.length} changelog fragments are still in the branch (${left.join(", ")}): the release command folds them in and removes them`);
  }

  if (/Describe (release|pending) changes here/.test(changelog)) {
    warn("CHANGELOG.md still has a placeholder entry");
  }

  void changed;
}

function report({ fails, warns, oks }) {
  oks.forEach((message) => console.log(`ok    ${message}`));
  warns.forEach((message) => console.log(`warn  ${message}`));
  fails.forEach((message) => console.log(`FAIL  ${message}`));
  console.log(
    fails.length
      ? `\nNot ready: ${fails.length} to fix${warns.length ? `, ${warns.length} to look at` : ""}.`
      : `\nReady to merge${warns.length ? ` (${warns.length} to look at)` : ""}.`
  );

  return fails.length ? 1 : 0;
}

// ---------------------------------------------------------------- state ----

function state(options) {
  const lines = ["FitVen git state"];
  const branch = currentBranch(options);

  maybeFetch(options);

  const base = resolveBase(options);
  const gitDir = git(options, ["rev-parse", "--git-dir"]);
  const commonDir = git(options, ["rev-parse", "--git-common-dir"]);
  const inWorktree =
    gitDir && commonDir && path.resolve(options.repo, gitDir) !== path.resolve(options.repo, commonDir);
  const worktrees = (git(options, ["worktree", "list", "--porcelain"]) ?? "")
    .split(/\r?\n/)
    .filter((line) => line.startsWith("worktree "));
  const dirty = (git(options, ["status", "--porcelain"]) ?? "").split(/\r?\n/).filter(Boolean);
  const warnings = [];

  lines.push(`Branch: ${branch ?? "(detached)"} in ${inWorktree ? "its own worktree" : "the main checkout"}`);

  if (base) {
    const ahead = git(options, ["rev-list", "--count", `${base}..HEAD`]);
    const behind = git(options, ["rev-list", "--count", `HEAD..${base}`]);

    lines.push(`Against ${base}: ${ahead ?? "?"} ahead, ${behind ?? "?"} behind`);

    if (branch && !PROTECTED_BRANCH.test(branch) && Number(behind) > 0) {
      warnings.push(`${behind} commits behind ${base}: merge it in before opening or merging a PR`);
    }
  }

  lines.push(`Uncommitted: ${dirty.length} files. Worktrees: ${Math.max(worktrees.length, 1)}.`);

  if (branch && PROTECTED_BRANCH.test(branch)) {
    warnings.push(
      "You are on " +
        branch +
        ". Do not edit here: make a work branch first, in its own worktree if another chat may be working " +
        "(git worktree add ../FitVen-<name> -b <type>/<name> origin/master)."
    );
  } else if (branch) {
    const nameProblem = validateBranchName(branch);

    if (nameProblem) {
      warnings.push(nameProblem);
    }

    const fragmentName = fragments.fragmentNameForBranch(branch);

    if (!fs.existsSync(path.join(options.repo, fragments.FRAGMENT_DIR, fragmentName))) {
      warnings.push(`no changelog fragment yet: npm run version:auto creates ${fragments.FRAGMENT_DIR}/${fragmentName}`);
    }
  }

  if (!inWorktree && worktrees.length > 1) {
    warnings.push("Other worktrees exist, so other chats may be running: do not switch branches in this checkout.");
  }

  const pullRequests = listOpenPullRequests(options, "number,headRefName,title,mergeStateStatus");

  if (pullRequests) {
    lines.push(`Open PRs: ${pullRequests.length}`);
    for (const pr of pullRequests.slice(0, 12)) {
      lines.push(`  #${pr.number} ${pr.headRefName}  [${String(pr.mergeStateStatus ?? "?").toLowerCase()}]`);
    }

    const conflicted = pullRequests.filter((pr) => pr.mergeStateStatus === "DIRTY");

    if (conflicted.length) {
      warnings.push(`PRs with conflicts: ${conflicted.map((pr) => `#${pr.number}`).join(", ")}`);
    }
  }

  warnings.forEach((message) => lines.push(`! ${message}`));
  lines.push(
    "Rules: docs/VERSIONING.md. Before a PR: npm run pr:check. For branch base, conflicts, merge order and releases: ask the git-steward agent."
  );
  console.log(lines.join("\n"));

  return 0;
}

// ---------------------------------------------------------- release-plan ----

function releasePlan(options) {
  const pkg = JSON.parse(fs.readFileSync(path.join(options.repo, "package.json"), "utf8"));
  const found = fragments.listFragments(options.repo);
  const branch = currentBranch(options);

  console.log(`Version now: ${pkg.version}`);

  if (branch && !PROTECTED_BRANCH.test(branch)) {
    console.log(`Note: this is ${branch}, not master; what is merged to master is what a release contains.`);
  }

  if (found.length === 0) {
    console.log("No unreleased changelog fragments: nothing to release.");
    return 0;
  }

  console.log(`Unreleased (${found.length}):`);
  found.forEach((fragment) => console.log(`  ${fragment.file}  (${fragments.bumpFromFragmentName(fragment.file)})`));

  const next = fragments.suggestNextVersion(pkg.version, found.map((fragment) => fragment.file));

  console.log(`\nSuggested version: ${next}`);
  console.log(`The release commit: npm run release:prepare -- ${next}   (on its own branch, e.g. minor/release-${next})`);

  const pullRequests = listOpenPullRequests(options, "number,headRefName");

  if (pullRequests && pullRequests.length) {
    console.log(`\nOpen PRs are not in it until they are merged: ${pullRequests.map((pr) => `#${pr.number}`).join(", ")}`);
  }

  return 0;
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  try {
    if (options.command === "check") {
      process.exitCode = check(options);
    } else if (options.command === "release-plan") {
      process.exitCode = releasePlan(options);
    } else if (options.command === "state") {
      process.exitCode = state(options);
    } else {
      console.log("Usage: flow.js state | check | release-plan [--base <ref>] [--repo <dir>] [--branch <name>] [--ci] [--no-gh] [--no-fetch]");
      process.exitCode = 1;
    }
  } catch (error) {
    // `state` runs at the start of every chat and must not get in its way.
    console.log(`flow ${options.command}: ${String(error?.message ?? error)}`);
    process.exitCode = options.command === "state" ? 0 : 1;
  }
}

module.exports = { overlapsWithPullRequests, parseNameStatus, validateBranchName };

if (require.main === module) {
  main();
}
