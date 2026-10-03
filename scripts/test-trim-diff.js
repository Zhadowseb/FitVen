// The review agents' diff, cut down to size (scripts/trim-diff.js, called by
// .github/workflows/pr-review.yml): whole files in the diff's own order, a
// file that does not fit skipped while smaller ones after it still go in, and
// the ones left out named in pr-context/omitted-files.txt and in a note at the
// end. Runs the script as the workflow does, on a small diff with a low limit.

const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const script = path.join(__dirname, "trim-diff.js");
const { pathOf } = require(script);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "trim-diff-"));
const diffFile = path.join(dir, "pr.diff");
const omittedFile = path.join(dir, "omitted-files.txt");
const run = (limit) => execFileSync(process.execPath, [script, diffFile, String(limit), omittedFile]);

/** One file's part of a diff, `lines` lines of body. */
const part = (header, lines, { body = "+x" } = {}) =>
  [header, "--- a", "+++ b", "@@ -0,0 +1 @@", ...Array.from({ length: lines }, () => body)].join("\n") + "\n";
const bytes = (text) => Buffer.byteLength(text, "utf8");

try {
  // The paths, as git writes them: quoted when it must (here a non-ASCII
  // name, escaped), not for a space alone.
  assert.equal(pathOf("diff --git a/src/a.js b/src/a.js"), "src/a.js");
  assert.equal(pathOf("diff --git a/assets/big file.txt b/assets/big file.txt"), "assets/big file.txt");
  assert.equal(pathOf('diff --git "a/docs/my notes\\303\\270.md" "b/docs/my notes\\303\\270.md"'), "docs/my notes\\303\\270.md");

  const a = part("diff --git a/src/a.js b/src/a.js", 2, { body: "+const name = \"Overkrop øvelse\";" });
  const big = part('diff --git "a/docs/my notes\\303\\270.md" "b/docs/my notes\\303\\270.md"', 200);
  const spaced = part("diff --git a/src/with space.js b/src/with space.js", 2);
  const middle = part("diff --git a/assets/big file.txt b/assets/big file.txt", 40);
  // The last file of a diff that does not end in a newline.
  const last = part("diff --git a/src/e.js b/src/e.js", 1).replace(/\n$/, "");
  const diff = a + big + spaced + middle + last;
  // Room for a, the spaced file and the last one, and a few bytes more - not
  // for the middle file after the first two.
  const limit = bytes(a) + bytes(spaced) + bytes(last) + 1 + 5;

  assert.ok(bytes(middle) > bytes(last) + 1 + 5, "the fixture's middle file has to be too big to fit");

  /* ------------------------------------------------- a diff that fits -- */

  fs.writeFileSync(diffFile, diff);
  run(bytes(diff));
  assert.equal(fs.readFileSync(diffFile, "utf8"), diff, "a diff at the limit was changed");
  assert.ok(!fs.existsSync(omittedFile), "a diff that fits has a list of omitted files");

  /* ------------------------------------------------ a diff that does not -- */

  run(limit);

  const trimmed = fs.readFileSync(diffFile, "utf8");
  const omitted = ["docs/my notes\\303\\270.md", "assets/big file.txt"];
  const note =
    `\n\n[AFKORTET: diffet fylder ${bytes(diff)} bytes, og kun hele filer op til ${limit} bytes staar ovenfor. ` +
    `Diffet for disse 2 filer er udeladt - laes dem i repoet, og se i pr-context/changed-files.txt hvad der er sket med dem:]\n` +
    omitted.map((name) => `- ${name}\n`).join("");

  assert.equal(
    trimmed,
    a + spaced + last + "\n" + note,
    "whole files in order, the big ones skipped, the smaller ones after them kept, and the note naming what is left out"
  );
  assert.equal(fs.readFileSync(omittedFile, "utf8"), omitted.map((name) => `${name}\n`).join(""), "the list of omitted files");
  assert.ok(bytes(a + spaced + last + "\n") <= limit, "more than the limit was kept");
  assert.ok(trimmed.includes("Overkrop øvelse"), "a kept file's text was re-encoded");

  /* ----------------------------------------- nothing fits but the note -- */

  fs.writeFileSync(diffFile, diff);
  fs.rmSync(omittedFile);
  run(10);
  assert.equal(
    fs.readFileSync(omittedFile, "utf8").split("\n").filter(Boolean).length,
    5,
    "every file too big is listed"
  );
  assert.ok(fs.readFileSync(diffFile, "utf8").startsWith("\n\n[AFKORTET: "), "only the note is left");
  assert.ok(fs.readFileSync(diffFile, "utf8").includes("Diffet for disse 5 filer er udeladt"));

  /* ------------------------------------------------------ the workflow -- */

  const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "pr-review.yml"), "utf8");

  assert.ok(
    workflow.includes('node "$RUNNER_TEMP/trim-diff.js" pr-context/pr.diff "$DIFF_LIMIT" pr-context/omitted-files.txt'),
    "the review workflow no longer cuts its diff with scripts/trim-diff.js"
  );
  assert.ok(!/\bawk\b/.test(workflow), "the workflow cuts the diff with its own awk again");

  console.log("trim-diff: a diff that fits is left alone; one that does not keeps whole files, skips the big ones, and names them.");
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
