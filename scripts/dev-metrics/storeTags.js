// The store tags: `android/<version>` and `ios/<version>`, one per store
// submission, on the commit the build came from (docs/VERSIONING.md).
//
// "Newest" is the highest version, not the latest date. Tags here get made
// after the fact - the first two were recovered from EAS days after the
// builds - so recovering 1.0.0 today must not make it the newest Android build.
//
// A tag's date is the date of the commit it points at, for the same reason:
// the tagger date of a recovered tag is the day somebody recovered it. The
// commit is never later than the build, and is normally the same day.

const { lines } = require("./gitOutput");
const { compareVersions, parseVersion } = require("./versions");

const PLATFORMS = ["android", "ios"];
const STORE_TAG = /^(android|ios)\/(.+)$/;

// What index.js asks for, so the parser and the question cannot drift apart.
const FOR_EACH_REF_FORMAT = [
  "%(refname:strip=2)",
  "%(objectname)",
  "%(*objectname)",
  "%(committerdate:unix)",
  "%(*committerdate:unix)",
].join("%09");

// Parses `git for-each-ref --format=<FOR_EACH_REF_FORMAT> refs/tags/android
// refs/tags/ios`. An annotated tag names its commit and the commit's date in
// the starred fields; a lightweight tag is the commit, in the plain ones.
function parseStoreTags(output) {
  const tags = [];
  const ignored = [];

  for (const line of lines(output)) {
    if (!line.trim()) continue;

    const [name, objectName, peeledName, ownDate, peeledDate] = line.split("\t");
    const match = STORE_TAG.exec(name);
    const version = match ? parseVersion(match[2]) : null;
    const seconds = Number(peeledDate || ownDate);

    if (!match || !version || !Number.isFinite(seconds) || seconds <= 0) {
      ignored.push(name);
      continue;
    }

    tags.push({
      name,
      platform: match[1],
      version,
      sha: peeledName || objectName,
      time: seconds * 1000,
      at: new Date(seconds * 1000).toISOString(),
    });
  }

  return { tags, ignored };
}

function compareTags(a, b) {
  return (
    compareVersions(a.version, b.version) ||
    a.time - b.time ||
    (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
  );
}

function latestByPlatform(tags) {
  const latest = Object.fromEntries(PLATFORMS.map((platform) => [platform, null]));

  for (const tag of tags) {
    const current = latest[tag.platform];

    if (!current || compareTags(tag, current) > 0) latest[tag.platform] = tag;
  }

  return latest;
}

module.exports = { FOR_EACH_REF_FORMAT, PLATFORMS, compareTags, latestByPlatform, parseStoreTags };
