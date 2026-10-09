// Changelog fragments: one small file per branch in changelog.d/, folded into
// CHANGELOG.md by the release command.
//
// Why: every branch used to edit the same lines of CHANGELOG.md (the section
// for the next version) and the version in package.json and app.json, so two
// branches open at once conflicted on whichever merged second. A fragment is a
// file only its own branch touches, so branches can be merged in any order, and
// CHANGELOG.md and the versions change in one place: the release commit.
//
// Pure where it can be, so scripts/test-changelog-fragments.js can run it:
// everything that reads or writes files takes the directory it works in.

const fs = require("fs");
const path = require("path");

const FRAGMENT_DIR = "changelog.d";
const PLACEHOLDER = "Describe the change here.";
// The release entry's own placeholder, from before fragments existed.
const LEGACY_PLACEHOLDERS = ["Describe release changes here.", "Describe pending changes here."];
const HEADING_ORDER = ["Added", "Changed", "Fixed", "Removed", "Deprecated", "Security"];

/** "minor/more-catalog-exercises" -> "minor-more-catalog-exercises.md" */
function fragmentNameForBranch(branchName) {
  const slug = String(branchName ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug}.md`;
}

/** What a branch counts as in the next version: the same rule as its prefix always had. */
function bumpFromFragmentName(name) {
  const prefix = String(name ?? "").split("-")[0];

  if (prefix === "breaking") {
    return "major";
  }

  if (["major", "feat", "feature"].includes(prefix)) {
    return "minor";
  }

  return "patch";
}

function skeleton() {
  return `### Changed\n- ${PLACEHOLDER}\n`;
}

/** [{ heading, body }] in the order written; text before the first heading is `preamble`. */
function parseSections(markdown) {
  const lines = String(markdown ?? "").split(/\r?\n/);
  const sections = [];
  const preamble = [];
  let current = null;

  for (const line of lines) {
    const match = line.match(/^###\s+(.+?)\s*$/);

    if (match) {
      current = { heading: match[1], lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    } else {
      preamble.push(line);
    }
  }

  return {
    preamble: preamble.join("\n").trim(),
    sections: sections.map((section) => ({
      heading: section.heading,
      body: section.lines.join("\n").replace(/^\n+|\s+$/g, ""),
    })),
  };
}

function isPlaceholderBody(body) {
  const text = String(body ?? "").trim();

  return (
    text === "" ||
    [PLACEHOLDER, ...LEGACY_PLACEHOLDERS].some((placeholder) => text === `- ${placeholder}` || text === placeholder)
  );
}

/** What is wrong with a fragment, as sentences; empty when it is fine. */
function validateFragment(markdown) {
  const { preamble, sections } = parseSections(markdown);
  const problems = [];

  if (sections.length === 0) {
    problems.push("has no `### Added`, `### Changed` or `### Fixed` heading");
  }

  if (preamble) {
    problems.push("has text before the first ### heading, which a release entry would lose");
  }

  for (const section of sections) {
    if (isPlaceholderBody(section.body)) {
      problems.push(`\`### ${section.heading}\` is empty or still says "${PLACEHOLDER}"`);
    }
  }

  return problems;
}

/** Several markdown texts with ### headings folded into one: the same heading together, in the usual order. */
function mergeSections(markdowns) {
  const byHeading = new Map();

  for (const markdown of markdowns) {
    for (const { heading, body } of parseSections(markdown).sections) {
      if (isPlaceholderBody(body)) {
        continue;
      }

      byHeading.set(heading, [...(byHeading.get(heading) ?? []), body]);
    }
  }

  const known = HEADING_ORDER.filter((heading) => byHeading.has(heading));
  const others = [...byHeading.keys()].filter((heading) => !HEADING_ORDER.includes(heading)).sort();

  return [...known, ...others]
    .map((heading) => `### ${heading}\n${byHeading.get(heading).join("\n")}`)
    .join("\n");
}

/** The fragments in a repository checkout, by name. README.md is the explanation, not a fragment. */
function listFragments(rootDir) {
  const dir = path.join(rootDir, FRAGMENT_DIR);

  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".md") && file.toLowerCase() !== "readme.md")
    .sort()
    .map((file) => ({
      file,
      path: path.join(dir, file),
      text: fs.readFileSync(path.join(dir, file), "utf8"),
    }));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Puts the fragments into the release entry for `version` that is already in
 * the changelog: what that entry says now (its legacy text, if any) and every
 * fragment, merged by heading.
 */
function insertFragmentsIntoChangelog(content, version, fragmentTexts, eol = "\n") {
  const header = new RegExp(`^## \\[${escapeRegExp(version)}\\] - .*$`, "m").exec(content);

  if (!header) {
    throw new Error(`CHANGELOG.md has no section for ${version} to put the fragments in.`);
  }

  const start = header.index + header[0].length;
  const rest = content.slice(start);
  const endRelative = rest.search(/^(---|## \[)/m);
  const end = endRelative < 0 ? content.length : start + endRelative;
  const merged = mergeSections([content.slice(start, end), ...fragmentTexts]);

  if (!merged) {
    return content;
  }

  const body = merged.split("\n").join(eol);

  return `${content.slice(0, start)}${eol}${body}${eol}${eol}${content.slice(end)}`;
}

/** The next version a set of unreleased fragments calls for, from the current stable one. */
function suggestNextVersion(currentVersion, fragmentNames) {
  const [major, minor, patch] = String(currentVersion).split("-")[0].split(".").map(Number);
  const bumps = fragmentNames.map(bumpFromFragmentName);

  if (bumps.includes("major")) {
    return `${major + 1}.0.0`;
  }

  if (bumps.includes("minor")) {
    return `${major}.${minor + 1}.0`;
  }

  return `${major}.${minor}.${patch + 1}`;
}

module.exports = {
  FRAGMENT_DIR,
  PLACEHOLDER,
  bumpFromFragmentName,
  fragmentNameForBranch,
  insertFragmentsIntoChangelog,
  listFragments,
  mergeSections,
  parseSections,
  skeleton,
  suggestNextVersion,
  validateFragment,
};
