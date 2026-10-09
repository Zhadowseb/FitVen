// Version numbers as the version scripts write them.
//
// A work branch carries a prerelease of its target, "2.13.0-feature-dev-kpis.1",
// and merging it puts that string on master. What the page shows is the
// version it is on its way to, so everything here compares and reports the
// core, "2.13.0".

const VERSION = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

function parseVersion(text) {
  const match = VERSION.exec(String(text ?? "").trim());

  if (!match) return null;

  const [, major, minor, patch, prerelease] = match;

  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease: prerelease ?? null,
    core: `${Number(major)}.${Number(minor)}.${Number(patch)}`,
  };
}

function comparePrerelease(left, right) {
  const a = left.split(".");
  const b = right.split(".");

  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if (a[index] === undefined) return -1;
    if (b[index] === undefined) return 1;

    const aNumeric = /^\d+$/.test(a[index]);
    const bNumeric = /^\d+$/.test(b[index]);

    if (aNumeric && bNumeric) {
      const difference = Number(a[index]) - Number(b[index]);

      if (difference) return difference;
    } else if (aNumeric !== bNumeric) {
      return aNumeric ? -1 : 1;
    } else if (a[index] !== b[index]) {
      return a[index] < b[index] ? -1 : 1;
    }
  }

  return 0;
}

// Semver order: 1.2.3-anything < 1.2.3 < 1.2.4.
function compareVersions(a, b) {
  for (const part of ["major", "minor", "patch"]) {
    if (a[part] !== b[part]) return a[part] - b[part];
  }

  if (a.prerelease === b.prerelease) return 0;
  if (a.prerelease === null) return 1;
  if (b.prerelease === null) return -1;

  return comparePrerelease(a.prerelease, b.prerelease);
}

function coreOf(text) {
  return parseVersion(text)?.core ?? null;
}

// The "version" of a package.json as git shows it. Null when the file is not
// JSON or carries no version, so a caller can fall back instead of throwing.
function packageVersion(jsonText) {
  try {
    const version = JSON.parse(String(jsonText).replace(/^﻿/, ""))?.version;

    return typeof version === "string" ? version : null;
  } catch {
    return null;
  }
}

module.exports = { compareVersions, coreOf, packageVersion, parseVersion };
