#!/usr/bin/env node
// Marks a store submission: the tag android/x.y.z or ios/x.y.z on the commit the
// build came from, and moves the `production` branch to it.
//
//   node scripts/git/mark-release.js <android|ios> <x.y.z> <commit> [--push] [--dry-run]
//   npm run release:mark -- android 2.17.7 573c7ffd --dry-run
//
// `production` is what users have. `master` is where work is integrated and is
// routinely ahead of it, so a fix to what is live starts from `production`
// (docs/VERSIONING.md), and a feature that has not been through review never
// ships with it by accident.
//
// It moves by fast-forward only. A new submission is normally a descendant of the
// last one, and then production simply follows it. A build of the *other*
// platform that is older than production leaves production where it is (its tag
// is still made). Anything else - a commit that does not contain what
// production holds - is refused, because it means something went to the stores
// that master does not have (a hotfix nobody merged back), and moving production
// would throw it away.
//
// The commit is not guessed: a build's commit is in `eas build:list --json`
// (`gitCommitHash`), and a tag on the wrong one is worse than no tag. Nothing is
// pushed without --push, and nothing is ever force-pushed. Only the user says a
// build was submitted: this is run after that, not before.

const { spawnSync } = require("child_process");
const path = require("path");

const PLATFORMS = new Set(["android", "ios"]);
const VERSION = /^\d+\.\d+\.\d+$/;
const PRODUCTION = "production";

function git(repo, args) {
  const result = spawnSync("git", args, { cwd: repo, encoding: "utf8", windowsHide: true });

  return { ok: result.status === 0, out: (result.stdout ?? "").trim(), err: (result.stderr ?? "").trim() };
}

function parseArgs(argv) {
  const options = { positional: [], push: false, dryRun: false, repo: process.cwd() };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--push") options.push = true;
    else if (token === "--dry-run") options.dryRun = true;
    else if (token === "--repo") options.repo = path.resolve(argv[++index]);
    else options.positional.push(token);
  }

  return options;
}

/** The commit `production` is at: the local branch, else origin's, else null. */
function productionCommit(repo) {
  for (const ref of [`refs/heads/${PRODUCTION}`, `refs/remotes/origin/${PRODUCTION}`]) {
    const found = git(repo, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);

    if (found.ok && found.out) {
      return found.out;
    }
  }

  return null;
}

const isAncestor = (repo, ancestor, descendant) => git(repo, ["merge-base", "--is-ancestor", ancestor, descendant]).ok;

/**
 * What marking would do, without doing it:
 * { tag, commit, tagExists, production: { from, to, action } } or { error }.
 * `action` is "create", "advance", "keep" (production already holds this commit,
 * or something newer) or "same".
 */
function plan(repo, { platform, version, commit }) {
  if (!PLATFORMS.has(platform)) {
    return { error: `the platform is android or ios, not "${platform}"` };
  }

  if (!VERSION.test(String(version))) {
    return { error: `the version is x.y.z, not "${version}"` };
  }

  if (!commit) {
    return { error: "name the commit the build came from (eas build:list --json has it as gitCommitHash)" };
  }

  const resolved = git(repo, ["rev-parse", "--verify", "--quiet", `${commit}^{commit}`]);

  if (!resolved.ok || !resolved.out) {
    return { error: `there is no commit "${commit}" here (git fetch origin?)` };
  }

  const sha = resolved.out;
  const tag = `${platform}/${version}`;
  const existing = git(repo, ["rev-parse", "--verify", "--quiet", `refs/tags/${tag}^{commit}`]);

  if (existing.ok && existing.out && existing.out !== sha) {
    return { error: `${tag} already exists, on ${existing.out.slice(0, 8)}, not on ${sha.slice(0, 8)}: a tag is not moved` };
  }

  const current = productionCommit(repo);
  let action;

  if (!current) {
    action = "create";
  } else if (current === sha) {
    action = "same";
  } else if (isAncestor(repo, current, sha)) {
    action = "advance";
  } else if (isAncestor(repo, sha, current)) {
    action = "keep";
  } else {
    return {
      error:
        `production (${current.slice(0, 8)}) holds work that ${sha.slice(0, 8)} does not: production only moves forward. ` +
        "Is a hotfix that went out not merged into master yet? Merge it, and release from a commit that has it.",
    };
  }

  return {
    tag,
    commit: sha,
    tagExists: Boolean(existing.ok && existing.out),
    production: { from: current, to: action === "keep" ? current : sha, action },
  };
}

function apply(repo, result) {
  if (!result.tagExists) {
    const tagged = git(repo, ["tag", result.tag, result.commit]);

    if (!tagged.ok) {
      return { error: `could not tag: ${tagged.err}` };
    }
  }

  if (["create", "advance"].includes(result.production.action)) {
    // update-ref rather than `branch -f`: production may be checked out in another worktree.
    const moved = git(repo, ["update-ref", `refs/heads/${PRODUCTION}`, result.commit]);

    if (!moved.ok) {
      return { error: `could not move ${PRODUCTION}: ${moved.err}` };
    }
  }

  return {};
}

function push(repo, result) {
  const lines = [];
  const tagPush = git(repo, ["push", "origin", `refs/tags/${result.tag}`]);

  lines.push(tagPush.ok ? `pushed ${result.tag}` : `could not push ${result.tag}: ${tagPush.err}`);

  if (["create", "advance"].includes(result.production.action)) {
    // A plain push: it is a fast-forward, and if the remote has moved it fails rather than rewrites.
    const branchPush = git(repo, ["push", "origin", `${result.commit}:refs/heads/${PRODUCTION}`]);

    lines.push(branchPush.ok ? `pushed ${PRODUCTION}` : `could not push ${PRODUCTION}: ${branchPush.err}`);

    return { lines, ok: tagPush.ok && branchPush.ok };
  }

  return { lines, ok: tagPush.ok };
}

function describe(result) {
  const short = (value) => (value ? value.slice(0, 8) : "(none)");
  const lines = [`${result.tag} -> ${short(result.commit)}${result.tagExists ? " (tag already there)" : ""}`];
  const { from, to, action } = result.production;

  lines.push(
    action === "create"
      ? `${PRODUCTION}: created at ${short(to)}`
      : action === "advance"
        ? `${PRODUCTION}: ${short(from)} -> ${short(to)} (fast-forward)`
        : action === "keep"
          ? `${PRODUCTION}: stays at ${short(from)} (it already holds this commit: the other platform's older build)`
          : `${PRODUCTION}: already at ${short(from)}`
  );

  return lines;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const [platform, version, commit] = options.positional;
  const result = plan(options.repo, { platform, version, commit });

  if (result.error) {
    console.error(`mark-release: ${result.error}`);
    console.error("Usage: mark-release.js <android|ios> <x.y.z> <commit> [--push] [--dry-run]");
    process.exitCode = 1;
    return;
  }

  describe(result).forEach((line) => console.log(line));

  if (options.dryRun) {
    console.log("(dry run: nothing was changed)");
    return;
  }

  const applied = apply(options.repo, result);

  if (applied.error) {
    console.error(`mark-release: ${applied.error}`);
    process.exitCode = 1;
    return;
  }

  if (options.push) {
    const pushed = push(options.repo, result);

    pushed.lines.forEach((line) => console.log(line));
    process.exitCode = pushed.ok ? 0 : 1;
    return;
  }

  const publish = [`git push origin refs/tags/${result.tag}`];

  if (["create", "advance"].includes(result.production.action)) {
    publish.push(`git push origin ${result.commit}:refs/heads/${PRODUCTION}`);
  }

  console.log(`Made locally. To publish it: ${publish.join(" && ")}`);
}

module.exports = { plan, apply, productionCommit };

if (require.main === module) {
  main();
}
