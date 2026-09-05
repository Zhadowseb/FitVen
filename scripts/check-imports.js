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

// The alias map comes out of babel.config.js itself, so this can never check
// against a stale copy of it.
function readBabelAliases() {
  const config = require(path.join(root, "babel.config.js"))({ cache: () => {} });
  const resolver = (config.plugins ?? []).find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "module-resolver"
  );

  return resolver?.[1]?.alias ?? {};
}

const aliases = readBabelAliases();

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

  for (const match of source.matchAll(/(?:from|require\()\s*['"]([^'"]+)['"]/g)) {
    const specifier = match[1];
    let target = null;

    if (specifier.startsWith(".")) {
      target = path.resolve(path.dirname(file), specifier);
    } else {
      const alias = Object.keys(aliases).find(
        (name) => specifier === name || specifier.startsWith(`${name}/`)
      );

      if (!alias) {
        // A misspelled alias looks exactly like a package. Anything scoped
        // that has no matching folder in node_modules is ours and is wrong.
        const scope = specifier.split("/")[0];

        if (
          scope.startsWith("@") &&
          !fs.existsSync(path.join(root, "node_modules", scope))
        ) {
          problems.push(
            `${path.relative(root, file).split(path.sep).join("/")} imports "${specifier}", which is neither a package nor a known alias`
          );
        }

        continue;
      }

      target = path.resolve(root, aliases[alias], specifier.slice(alias.length + 1));
    }

    if (!resolves(target)) {
      problems.push(
        `${path.relative(root, file).split(path.sep).join("/")} imports "${specifier}", which does not resolve`
      );
    }
  }
}

// An alias that Metro resolves but the editor does not is a silent trap, so the
// two maps have to agree.
const tsconfig = JSON.parse(
  fs.readFileSync(path.join(root, "tsconfig.json"), "utf8")
);
const tsPaths = tsconfig.compilerOptions?.paths ?? {};

for (const [alias, target] of Object.entries(aliases)) {
  const expected = [path.posix.join(target.replace(/^\.\//, ""))];
  const actual = tsPaths[alias];

  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    problems.push(
      `tsconfig.json maps "${alias}" to ${JSON.stringify(actual)}, but babel.config.js maps it to ${JSON.stringify(expected)}`
    );
  }

  const wildcard = tsPaths[`${alias}/*`];
  const expectedWildcard = [`${target.replace(/^\.\//, "")}/*`];

  if (JSON.stringify(wildcard) !== JSON.stringify(expectedWildcard)) {
    problems.push(
      `tsconfig.json maps "${alias}/*" to ${JSON.stringify(wildcard)}, but babel.config.js implies ${JSON.stringify(expectedWildcard)}`
    );
  }
}

if (problems.length) {
  console.error("Imports that will not resolve on a case-sensitive filesystem:\n");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(`\n${problems.length} problem(s).`);
  process.exit(1);
}

console.log(
  `Import checks passed (${files.length} files, ${Object.keys(aliases).length} aliases).`
);
