// Marking a store submission (scripts/git/mark-release.js): the tag, and
// `production` moving forward - never sideways, never by force. Run against
// throwaway repositories made here; nothing in this checkout is touched.

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const script = path.resolve(__dirname, "git", "mark-release.js");
const mark = require("./git/mark-release");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "fitven-mark-release-"));
const env = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function git(repo, args) {
  const result = spawnSync("git", args, { cwd: repo, encoding: "utf8", env, windowsHide: true });

  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }

  return result.stdout.trim();
}

function cli(repo, args) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: repo, encoding: "utf8", env, windowsHide: true });

  return { status: result.status, out: result.stdout, err: result.stderr };
}

function commit(repo, name) {
  fs.writeFileSync(path.join(repo, `${name}.txt`), name);
  git(repo, ["add", `${name}.txt`]);
  git(repo, ["commit", "-q", "-m", name]);

  return git(repo, ["rev-parse", "HEAD"]);
}

function makeRepo(name) {
  const repo = path.join(root, name);
  const remote = path.join(root, `${name}-remote.git`);

  fs.mkdirSync(repo);
  git(repo, ["init", "-q", "-b", "master"]);
  spawnSync("git", ["init", "-q", "--bare", remote], { env, windowsHide: true });
  git(repo, ["remote", "add", "origin", remote]);

  return { repo, remote };
}

const remoteRef = (remote, ref) => {
  const result = spawnSync("git", ["rev-parse", "--verify", "--quiet", ref], { cwd: remote, encoding: "utf8", env, windowsHide: true });

  return result.status === 0 ? result.stdout.trim() : null;
};

try {
  /* ------------------------------------------------ the first submission -- */

  const { repo, remote } = makeRepo("main");
  const c1 = commit(repo, "one");
  const c2 = commit(repo, "two");
  const c3 = commit(repo, "three");

  git(repo, ["push", "-q", "origin", "master"]);

  // The commit has to be named, and it has to exist; the platform and the version have to be right.
  assert.match(mark.plan(repo, { platform: "android", version: "2.17.6" }).error, /name the commit/);
  assert.match(mark.plan(repo, { platform: "android", version: "2.17.6", commit: "nope" }).error, /no commit "nope"/);
  assert.match(mark.plan(repo, { platform: "windows", version: "2.17.6", commit: c1 }).error, /android or ios/);
  assert.match(mark.plan(repo, { platform: "ios", version: "2.17", commit: c1 }).error, /x\.y\.z/);

  // A dry run says what it would do and changes nothing.
  const dry = cli(repo, ["android", "2.17.6", c1, "--dry-run"]);

  assert.strictEqual(dry.status, 0);
  assert.match(dry.out, /android\/2\.17\.6 -> /);
  assert.match(dry.out, /production: created at/);
  assert.match(dry.out, /nothing was changed/);
  assert.strictEqual(git(repo, ["tag"]), "", "no tag from a dry run");
  assert.strictEqual(mark.productionCommit(repo), null);

  // The first one creates production, locally; nothing is pushed without --push.
  const first = cli(repo, ["android", "2.17.6", c1]);

  assert.strictEqual(first.status, 0, first.err);
  assert.strictEqual(git(repo, ["rev-parse", "android/2.17.6^{commit}"]), c1);
  assert.strictEqual(git(repo, ["rev-parse", "production"]), c1);
  assert.strictEqual(remoteRef(remote, "refs/tags/android/2.17.6"), null, "not pushed without --push");
  assert.strictEqual(remoteRef(remote, "refs/heads/production"), null);
  assert.match(first.out, /Made locally\. To publish it: git push origin refs\/tags\/android\/2\.17\.6/);

  // The next one is a descendant: production follows it, and --push publishes the tag and the branch.
  const second = cli(repo, ["android", "2.17.7", c3, "--push"]);

  assert.strictEqual(second.status, 0, second.err);
  assert.match(second.out, /production: [0-9a-f]{8} -> [0-9a-f]{8} \(fast-forward\)/);
  assert.strictEqual(git(repo, ["rev-parse", "production"]), c3);
  assert.strictEqual(remoteRef(remote, "refs/tags/android/2.17.7"), c3);
  assert.strictEqual(remoteRef(remote, "refs/heads/production"), c3, "the branch is on the remote, by a plain push");

  // The other platform's older build: its tag is made, production stays where it is.
  const older = cli(repo, ["ios", "2.17.5", c2, "--push"]);

  assert.strictEqual(older.status, 0, older.err);
  assert.match(older.out, /production: stays at/);
  assert.strictEqual(git(repo, ["rev-parse", "ios/2.17.5^{commit}"]), c2);
  assert.strictEqual(git(repo, ["rev-parse", "production"]), c3, "production does not go backwards");
  assert.strictEqual(remoteRef(remote, "refs/heads/production"), c3);
  assert.doesNotMatch(older.out, /could not/);

  // The same again changes nothing and is not an error.
  const again = cli(repo, ["android", "2.17.7", c3, "--push"]);

  assert.strictEqual(again.status, 0, again.err);
  assert.match(again.out, /already at/);
  assert.match(again.out, /tag already there/);

  // A tag is not moved.
  const moved = cli(repo, ["android", "2.17.7", c2]);

  assert.strictEqual(moved.status, 1);
  assert.match(moved.err, /already exists, on [0-9a-f]{8}, not on [0-9a-f]{8}: a tag is not moved/);
  assert.strictEqual(git(repo, ["rev-parse", "production"]), c3);

  /* --------------------------------------------- work that went out alone -- */

  // A hotfix that was released and not merged into master: a commit that does
  // not contain what production holds is refused, and nothing is changed.
  git(repo, ["checkout", "-q", "-b", "stray", c1]);

  const stray = commit(repo, "stray");

  git(repo, ["checkout", "-q", "master"]);

  const refused = cli(repo, ["android", "2.17.8", stray]);

  assert.strictEqual(refused.status, 1);
  assert.match(refused.err, /production \([0-9a-f]{8}\) holds work that [0-9a-f]{8} does not/);
  assert.match(refused.err, /hotfix/);
  assert.strictEqual(git(repo, ["tag", "-l", "android/2.17.8"]), "", "no tag for a refused mark");
  assert.strictEqual(git(repo, ["rev-parse", "production"]), c3);

  // production checked out in another worktree is not in the way: it is moved with update-ref.
  const c4 = commit(repo, "four");
  const worktree = path.join(root, "main-production-worktree");

  git(repo, ["worktree", "add", "-q", worktree, "production"]);

  const checkedOut = cli(repo, ["android", "2.17.8", c4]);

  assert.strictEqual(checkedOut.status, 0, checkedOut.err);
  assert.strictEqual(git(repo, ["rev-parse", "production"]), c4);

  /* ----------------------------------------------- the remote moved on -- */

  // Somebody else moved production on the remote: the plain push fails rather than rewrites it.
  const { repo: second_repo, remote: second_remote } = makeRepo("raced");
  const r1 = commit(second_repo, "one");
  const r2 = commit(second_repo, "two");

  git(second_repo, ["push", "-q", "origin", "master"]);
  git(second_repo, ["push", "-q", "origin", `${r1}:refs/heads/production`]);

  // The remote's production is ahead of this clone's, on a line of its own.
  const other = path.join(root, "other");

  git(root, ["clone", "-q", second_remote, other]);
  git(other, ["checkout", "-q", "-b", "side", r1]);

  const side = commit(other, "side");

  git(other, ["push", "-q", "origin", `${side}:refs/heads/production`, "--force"]);

  const raced = cli(second_repo, ["android", "2.17.9", r2, "--push"]);

  assert.strictEqual(raced.status, 1, "the push of production is refused, not forced");
  assert.match(raced.out, /could not push production/);
  assert.strictEqual(remoteRef(second_remote, "refs/heads/production"), side, "the other line was not overwritten");

  console.log("Marking a release: the tag, production following the newest submission by fast-forward, the other platform's older build, a dry run, a tag that is not moved, a commit that would drop work, a worktree, and a push that never forces.");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
