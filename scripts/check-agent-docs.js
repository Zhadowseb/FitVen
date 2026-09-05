#!/usr/bin/env node
// Fails when a guide has drifted away from the code.
//
// AGENTS.md, CLAUDE.md and README.md are only worth reading if they are true,
// and the cheapest way to make them worthless is to change the code and leave
// them behind. That is exactly how README ended up claiming this app has no
// backend while five sync loops were running.
//
// Two kinds of check:
//   1. Every repo path a guide names in backticks has to exist.
//   2. Every invariant a guide promises has to still hold.
//
// It cannot read prose. It is a floor, not a substitute for reading.

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const problems = [];

const DOCS = [
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "src/AGENTS.md",
  "src/Pages/AGENTS.md",
  "src/Database/AGENTS.md",
  "src/Services/AGENTS.md",
  "src/Sync/AGENTS.md",
];

function read(rel) {
  const full = path.join(root, rel);

  return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null;
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(path.relative(root, full).split(path.sep).join("/"));
  }

  return out;
}

const allFiles = walk(root);
const allDirs = new Set(
  allFiles.map((f) => path.posix.dirname(f)).flatMap((d) => {
    const parts = d.split("/");

    return parts.map((_, i) => parts.slice(0, i + 1).join("/"));
  })
);

// ---------------------------------------------------------------- paths ----
// Only tokens that actually look like a repo path, so `npm run start`,
// `auth.uid()` and a bare table name are left alone.
const ROOTS = ["src", "docs", "scripts", "supabase", "assets", "plugins", "android"];
const FILE_AT_ROOT = /^(App|index|package|app|eas|tsconfig|babel|metro)\.(js|json)$/;

function looksLikePath(token) {
  if (token.includes(" ") || token.includes("(")) return false;
  if (FILE_AT_ROOT.test(token)) return true;

  const head = token.split("/")[0];

  return token.includes("/") && ROOTS.includes(head);
}

for (const rel of DOCS) {
  const text = read(rel);

  if (text === null) {
    problems.push(`${rel} is listed as a guide but does not exist`);
    continue;
  }

  const seen = new Set();

  for (const match of text.matchAll(/`([^`\n]+)`/g)) {
    // strip a trailing slash, a line reference, and any glob
    const token = match[1].replace(/[:#].*$/, "").replace(/\/$/, "");

    if (!looksLikePath(token) || seen.has(token)) continue;
    seen.add(token);

    if (token.includes("*")) {
      const dir = path.posix.dirname(token);
      const suffix = path.posix.basename(token).replace("*", "");
      const hit = allFiles.some(
        (f) => path.posix.dirname(f) === dir && f.endsWith(suffix)
      );
      if (!hit) problems.push(`${rel} names \`${token}\`, which matches nothing`);
      continue;
    }

    if (!allFiles.includes(token) && !allDirs.has(token)) {
      problems.push(`${rel} names \`${token}\`, which does not exist`);
    }
  }
}

// ------------------------------------------------------------ npm scripts --
const pkg = JSON.parse(read("package.json"));

for (const rel of DOCS) {
  const text = read(rel) ?? "";

  for (const match of text.matchAll(/npm run ([a-z][a-z0-9:-]*)/g)) {
    if (!(match[1] in pkg.scripts)) {
      problems.push(`${rel} tells you to run \`npm run ${match[1]}\`, which is not a script`);
    }
  }
}

// ------------------------------------------------------------ invariants ---
const sourceFiles = allFiles.filter(
  (f) => f.endsWith(".js") && (f.startsWith("src/") || f === "App.js")
);

function sourcesMatching(pattern) {
  return sourceFiles.filter((f) => pattern.test(fs.readFileSync(path.join(root, f), "utf8")));
}

// "Never alias one layer to another layer's name" - root and src AGENTS.md
const aliased = sourcesMatching(/Service as [A-Za-z]+Repository/);

if (aliased.length) {
  problems.push(
    `the guides promise no layer aliasing, but ${aliased.length} file(s) still do it:\n    ` +
      aliased.join("\n    ")
  );
}

// "src/Sync only runs what App.js mounts" - the table in src/Sync/AGENTS.md
const appSource = read("App.js");
const syncTable = read("src/Sync/AGENTS.md") ?? "";

for (const file of allFiles.filter((f) => /^src\/Sync\/.*Sync\.js$/.test(f))) {
  const name = path.posix.basename(file, ".js");

  if (!appSource.includes(`<${name} `) && !appSource.includes(`<${name}/`)) {
    problems.push(`src/Sync/${name}.js is not mounted in App.js - mount it or delete it`);
  }

  if (!syncTable.includes(name)) {
    problems.push(`src/Sync/${name}.js is missing from the table in src/Sync/AGENTS.md`);
  }
}

// "Colours must never sit in a *Style.js" - src/Pages/AGENTS.md.
// Shadows and text over photographs are the documented exceptions.
const COLOUR_IN_STYLE = /^\s*(?!shadowColor)[A-Za-z]+:\s*"(#[0-9a-fA-F]{3,8}|rgba?\()/m;
const ALLOWED = new Set(["src/Pages/SearchPage/SearchPageStyle.js"]);
const colouredStyles = allFiles
  .filter((f) => f.endsWith("Style.js") && !ALLOWED.has(f))
  .filter((f) => COLOUR_IN_STYLE.test(fs.readFileSync(path.join(root, f), "utf8")));

if (colouredStyles.length) {
  problems.push(
    `the guides promise no colours in a *Style.js, but ${colouredStyles.length} file(s) have one:\n    ` +
      colouredStyles.join("\n    ")
  );
}

// Every migration has to be in the ledger - supabase/migrations/README.md
const ledger = read("supabase/migrations/README.md") ?? "";

for (const file of allFiles.filter((f) => /^supabase\/migrations\/.*\.sql$/.test(f))) {
  const name = path.posix.basename(file);

  if (!ledger.includes(name)) {
    problems.push(
      `${name} is missing from supabase/migrations/README.md - record whether it has been run`
    );
  }
}

// The guides that the root file points at have to exist
for (const match of (read("AGENTS.md") ?? "").matchAll(/^- `(src\/[^`]+AGENTS\.md)`/gm)) {
  if (!allFiles.includes(match[1])) {
    problems.push(`AGENTS.md points at ${match[1]}, which does not exist`);
  }
}

// The password reset page talks to the same project as the app.
//
// It is a static page outside the bundle, so nothing else connects the two. If
// the project or its anon key ever changes, the app keeps working and the reset
// link quietly stops - and it only fails for somebody who is already locked out
// and cannot report it from inside the app.
const resetPage = read("web/reset-password/index.html");
const client = read("src/Database/supaBaseClient.js");

if (resetPage === null) {
  problems.push(
    "web/reset-password/index.html is missing - the forgot-password email has nowhere to land"
  );
} else if (client !== null) {
  const pairs = [
    ["SUPABASE_URL", /supabaseUrl = '([^']+)'/, /var SUPABASE_URL = "([^"]+)"/],
    ["anon key", /supabaseAnonKey = '([^']+)'/, /var SUPABASE_ANON_KEY = "([^"]+)"/],
  ];

  for (const [label, appPattern, pagePattern] of pairs) {
    const inApp = client.match(appPattern)?.[1];
    const inPage = resetPage.match(pagePattern)?.[1];

    if (!inApp || !inPage) {
      problems.push(
        `Could not read the ${label} out of both supaBaseClient.js and the reset page - the check that keeps them in step is broken`
      );
    } else if (inApp !== inPage) {
      problems.push(
        `web/reset-password/index.html uses a different ${label} than the app - the reset link would reach the wrong project`
      );
    }
  }

  const redirect = read("src/Services/authService.js")?.match(
    /PASSWORD_RESET_REDIRECT = "([^"]+)"/
  )?.[1];

  if (redirect && !redirect.includes("/reset-password/")) {
    problems.push(
      `PASSWORD_RESET_REDIRECT is ${redirect}, which is not the reset page`
    );
  }
}

// The public site serves exactly one directory.
//
// web/README.md promises this, and the promise is the whole reason the privacy
// policy is not generated into docs/. Widening it to "." or "docs" publishes the
// security review, the structure audit, the performance audit, an export query
// and google-services.json, and nothing would say so until somebody found them.
const netlify = read("netlify.toml");

if (netlify === null) {
  problems.push(
    "netlify.toml is missing - without it the host falls back to publishing the whole repository"
  );
} else {
  const publishDirectory = netlify.match(/^\s*publish\s*=\s*"([^"]*)"/m)?.[1];

  if (publishDirectory !== "web") {
    problems.push(
      `netlify.toml publishes "${publishDirectory ?? "nothing declared"}" - it has to be "web", the only directory meant to be public`
    );
  }
}

// ---------------------------------------------------------------- report ---
if (problems.length) {
  console.error("Agent guides have drifted from the code:\n");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    `\n${problems.length} problem(s). Fix the guide or the code, whichever is wrong.`
  );
  process.exit(1);
}

console.log(`Agent guide checks passed (${DOCS.length} documents).`);
