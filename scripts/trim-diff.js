#!/usr/bin/env node
// Cuts the review agents' diff down to a size they can read
// (.github/workflows/pr-review.yml, the context job).
//
//   node scripts/trim-diff.js <diff> <limit in bytes> <omitted-files list>
//
// A diff at or under the limit is left alone, and no list is written. Over
// it, whole files are kept in the diff's own order, and a file that does not
// fit is skipped so the smaller ones after it still go in. The skipped files
// are written one per line to the list, and named again in a note at the end
// of the diff: before, it only said "the rest is in the repository", and a PR
// of 151 files had 89 in it without the agents knowing which 62 to read.
//
// Built-ins only: the context job runs it with the runner's own Node, before
// any `npm ci`. Bytes are bytes - the diff is read and written as latin1, so
// a length is a byte count and nothing is re-encoded on the way through.
//
// scripts/test-trim-diff.js runs it on a small diff with a low limit.

const fs = require("fs");

/** The path a `diff --git` line names, as git wrote it (quoted when it had to be). */
function pathOf(header) {
  const quoted = header.replace(/^diff --git "a\/.*" "b\//, "");

  if (quoted !== header) {
    return quoted.replace(/"$/, "");
  }

  return header.replace(/^diff --git a\/.* b\//, "");
}

/**
 * `diff` is the whole diff as a latin1 string. Returns null when it fits, or
 * `{ text, omitted }`: the kept files followed by the note, and the paths of
 * the files left out.
 */
function trimDiff(diff, limit) {
  const size = diff.length;

  if (size <= limit) {
    return null;
  }

  const lines = diff.split("\n");

  // A final newline ends the last line; it does not start an empty one.
  if (lines[lines.length - 1] === "") {
    lines.pop();
  }

  const kept = [];
  const omitted = [];
  let written = 0;
  let file = null;

  const flush = () => {
    if (!file || file.lines.length === 0) {
      return;
    }

    if (written + file.bytes <= limit) {
      kept.push(...file.lines);
      written += file.bytes;
    } else {
      omitted.push(file.path);
    }
  };

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      flush();
      file = { path: pathOf(line), lines: [], bytes: 0 };
    } else if (!file) {
      // Anything before the first file is a part of its own, with no name.
      file = { path: "", lines: [], bytes: 0 };
    }

    file.lines.push(line);
    file.bytes += line.length + 1;
  }

  flush();

  const note =
    `\n\n[AFKORTET: diffet fylder ${size} bytes, og kun hele filer op til ${limit} bytes staar ovenfor. ` +
    `Diffet for disse ${omitted.length} filer er udeladt - laes dem i repoet, og se i ` +
    `pr-context/changed-files.txt hvad der er sket med dem:]\n` +
    omitted.map((path) => `- ${path}\n`).join("");

  return {
    text: kept.map((line) => `${line}\n`).join("") + note,
    omitted,
  };
}

function main([diffPath, limitArgument, omittedPath]) {
  const limit = Number(limitArgument);

  if (!diffPath || !omittedPath || !Number.isInteger(limit) || limit < 0) {
    console.error("usage: node scripts/trim-diff.js <diff> <limit in bytes> <omitted-files list>");
    process.exit(2);
  }

  const result = trimDiff(fs.readFileSync(diffPath, "latin1"), limit);

  if (!result) {
    return;
  }

  fs.writeFileSync(omittedPath, result.omitted.map((path) => `${path}\n`).join(""), "latin1");
  fs.writeFileSync(diffPath, result.text, "latin1");
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = { trimDiff, pathOf };
