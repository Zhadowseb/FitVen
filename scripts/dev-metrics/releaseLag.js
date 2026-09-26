// KPI-6: how long finished work has waited for users, per platform.
//
// The unreleased commits are `git rev-list <tag>..<master>`. The clock starts
// when the oldest of them landed on master: the oldest commit on master's
// first-parent line after the tag, which is the merge that brought it in. A
// branch commit keeps the date it was written, so starting from that would
// charge the release for how long a branch was open. On the day this was
// written, one June commit on a branch merged in September would have made
// Android 101 days late instead of 9.
//
// The commit count leaves merge commits out. They are how work arrives, not
// work, and the feature counts leave them out the same way.

const { isoTime, wholeDaysBetween } = require("./dates");
const { lines } = require("./gitOutput");
const { compareVersions, coreOf, parseVersion } = require("./versions");

// `git log --format=%ct` -> epoch milliseconds.
function parseCommitTimes(output) {
  return lines(output)
    .map((line) => Number(line.trim()))
    .filter((seconds) => Number.isFinite(seconds) && seconds > 0)
    .map((seconds) => seconds * 1000);
}

// The versions master has been through, from
// `git log --first-parent -m -p <tag>..<master> -- package.json`: every line
// that set "version".
function versionsFromPackagePatch(patch) {
  const versions = [];

  for (const line of lines(patch)) {
    const match = /^\+\s*"version"\s*:\s*"([^"]+)"/.exec(line);

    if (match) versions.push(match[1]);
  }

  return versions;
}

// How many versions lie after `oldest`: distinct cores above it. Branch
// prereleases of the same target count once.
function countVersionsAfter(oldest, versions) {
  const floor = parseVersion(oldest);
  const cores = new Set();

  for (const text of versions) {
    const core = coreOf(text);

    if (core && (!floor || compareVersions(parseVersion(core), floor) > 0)) cores.add(core);
  }

  return cores.size;
}

function unreleasedMajorBetween(oldest, newest) {
  const from = parseVersion(oldest);
  const to = parseVersion(newest);

  return from && to && to.major > from.major ? `${to.major}.0.0` : null;
}

function releaseLagWithoutTag(headVersion) {
  return {
    days: null,
    commits: null,
    latestTag: null,
    latestTagAt: null,
    oldestUnreleasedAt: null,
    oldestVersion: null,
    newestVersion: coreOf(headVersion),
    versionCount: null,
    unreleasedMajor: null,
  };
}

function missingTagNote(platform) {
  return (
    `release_lag/${platform}: there is no ${platform}/* tag, so days is null. ` +
    `Tag the commit each ${platform} store build came from: ` +
    `git tag -a ${platform}/<version> <commit> -m "<store and build number>", then git push origin ${platform}/<version>.`
  );
}

// tag:          the platform's newest store tag, from storeTags.js, or null
// commits:      non-merge commits in <tag>..<master>
// landedTimes:  commit times (ms) of master's first-parent line in <tag>..<master>
// tagVersion:   package.json "version" at the tag (null falls back to the tag's name)
// headVersion:  package.json "version" at master
// versionsSeen: versionsFromPackagePatch() over <tag>..<master>
function releaseLag({ tag, now, commits, landedTimes, tagVersion, headVersion, versionsSeen }) {
  if (!tag) return releaseLagWithoutTag(headVersion);

  const oldestVersion = coreOf(tagVersion) ?? tag.version.core;
  const newestVersion = coreOf(headVersion);
  const waiting = commits > 0;
  const landed = waiting ? landedTimes.filter(Number.isFinite) : [];
  const oldest = landed.length ? Math.min(...landed) : null;

  return {
    days: oldest === null ? 0 : wholeDaysBetween(oldest, now),
    commits,
    latestTag: tag.name,
    latestTagAt: tag.at,
    oldestUnreleasedAt: oldest === null ? null : isoTime(oldest),
    oldestVersion,
    newestVersion,
    versionCount: waiting ? countVersionsAfter(oldestVersion, [...versionsSeen, headVersion]) : 0,
    unreleasedMajor: waiting ? unreleasedMajorBetween(oldestVersion, newestVersion) : null,
  };
}

module.exports = {
  countVersionsAfter,
  missingTagNote,
  parseCommitTimes,
  releaseLag,
  unreleasedMajorBetween,
  versionsFromPackagePatch,
};
