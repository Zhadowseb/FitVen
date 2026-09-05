#!/usr/bin/env node
// Every relative import has to resolve, with the exact casing on disk.
//
// Windows and macOS have case-insensitive filesystems; Android, iOS and CI do
// not. So `from "./MuscleMasks/..."` pointing at a folder actually named
// `Muscle_masks` works on the machine it was written on and fails only once it
// is built - which is the worst place to find out. The same goes for a folder
// that gets moved and one importer left behind: nothing fails until that screen
// is opened, because there is no build-time module check in this project.

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const EXTENSIONS = ["", ".js", ".jsx", ".json", ".ts", ".tsx", ".svg", ".png", ".jpg"];
const problems = [];

function sourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (full.endsWith(".js")) out.push(full);
  }

  return out;
}

// fs.existsSync answers case-insensitively on Windows, so the check walks the
// path segment by segment and compares against what readdir actually reports.
function existsWithExactCase(target) {
  const relative = path.relative(root, target);

  if (relative.startsWith("..")) {
    return true;
  }

  let current = root;

  for (const segment of relative.split(path.sep)) {
    let entries;

    try {
      entries = fs.readdirSync(current);
    } catch {
      return false;
    }

    if (!entries.includes(segment)) {
      return false;
    }

    current = path.join(current, segment);
  }

  return true;
}

function resolves(target) {
  for (const extension of EXTENSIONS) {
    if (existsWithExactCase(target + extension)) {
      const full = target + extension;

      if (fs.statSync(full).isFile()) {
        return true;
      }
    }
  }

  return existsWithExactCase(path.join(target, "index.js"));
}

const files = [path.join(root, "App.js"), ...sourceFiles(path.join(root, "src"))];

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");

  for (const match of source.matchAll(/(?:from|require\()\s*['"](\.[^'"]+)['"]/g)) {
    const target = path.resolve(path.dirname(file), match[1]);

    if (!resolves(target)) {
      problems.push(
        `${path.relative(root, file).split(path.sep).join("/")} imports "${match[1]}", which does not resolve`
      );
    }
  }
}

if (problems.length) {
  console.error("Imports that will not resolve on a case-sensitive filesystem:\n");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(`\n${problems.length} problem(s).`);
  process.exit(1);
}

console.log(`Import checks passed (${files.length} files).`);
