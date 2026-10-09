// KPI-4's commit column: how much work went into each feature since 1/9, and
// whether users have the feature at all.
//
// FEATURE_PATHS is the spec's table (section 5) as git pathspecs. It lives
// here, not in the app, so it can be corrected without a release. The
// pathspecs mean what they mean to `git log -- <pathspec>`, and
// matchesPathspec() below does exactly that, so `git log --oneline -- <one of
// them>` shows the commits a feature is credited with:
//   - without a wildcard, the path itself or anything under it
//     ("src/Pages/WorkoutPage/WorkoutTypes/Run" is the folder, not "RunFoo.js");
//   - with one, a match against the whole path, where `*` also crosses "/"
//     ("src/Pages/Social*" takes in src/Pages/SocialPage/SocialPage.js).
//
// A feature's first commit is the oldest commit that touched its paths. It is
// in the store once a store tag contains that commit, which is why these paths
// have to be about the feature and nothing older: one file from before the
// feature makes it look like it was always there.

const { RECORD, lines, unquotePath } = require("./gitOutput");
const { localMidnight } = require("./dates");
const { PLATFORMS } = require("./storeTags");

const FEATURE_COMMITS_SINCE = "2026-09-01";

// In the spec's order. Two differ from the spec, where its path would have
// measured something else:
//   customExercises  the spec says src/Pages/Exercise*, which is mostly the
//                    Train tab (ExerciseLibraryPage) and the muscle map; the
//                    feature is the files named after it.
//   push             the spec says src/Services/push*, which matches no file;
//                    push lives in notificationService and its sync and pages.
const FEATURE_PATHS = {
  run: ["src/Pages/WorkoutPage/WorkoutTypes/Run"],
  posts: ["src/Pages/Social*", "src/Services/social*"],
  likes: ["src/Pages/Social*", "src/Services/social*"],
  follows: ["src/Pages/Social*", "src/Services/social*"],
  gymLifts: ["src/Pages/Gym*"],
  music: ["src/**/Music*"],
  sickness: ["src/**/Sick*"],
  customExercises: ["src/**/CustomExercise*", "src/**/customExercise*"],
  push: ["src/Services/notificationService.js", "src/Sync/PushNotification*", "src/Pages/Notification*"],
};

const compiled = new Map();

function wildcardPattern(spec) {
  let source = "^";

  for (let index = 0; index < spec.length; index += 1) {
    const character = spec[index];

    if (character === "*") {
      source += ".*";
    } else if (character === "?") {
      source += ".";
    } else if (character === "[" && spec.indexOf("]", index + 2) !== -1) {
      const end = spec.indexOf("]", index + 2);
      const body = spec.slice(index + 1, end).replace(/\\/g, "\\\\");

      source += body.startsWith("!") ? `[^${body.slice(1)}]` : `[${body}]`;
      index = end;
    } else {
      source += character.replace(/[.+^${}()|[\]\\/]/g, "\\$&");
    }
  }

  return new RegExp(`${source}$`);
}

function matchesPathspec(spec, file) {
  if (!/[*?[]/.test(spec)) {
    const base = spec.replace(/\/+$/, "");

    return file === base || file.startsWith(`${base}/`);
  }

  if (!compiled.has(spec)) compiled.set(spec, wildcardPattern(spec));

  return compiled.get(spec).test(file);
}

function touches(specs, files) {
  return files.some((file) => specs.some((spec) => matchesPathspec(spec, file)));
}

// Parses `git log --no-merges --no-renames --name-only
// --format=%x1e%H%x09%ct`: newest first, one record per commit.
function parseNameOnlyLog(output) {
  const commits = [];

  for (const record of String(output ?? "").split(RECORD)) {
    const [header, ...rest] = lines(record);
    const [sha, seconds] = (header ?? "").split("\t");

    if (!/^[0-9a-f]{7,64}$/.test(sha ?? "")) continue;

    commits.push({
      sha,
      time: Number(seconds) * 1000,
      files: rest.filter((line) => line.trim()).map(unquotePath),
    });
  }

  return commits;
}

// commits:    parseNameOnlyLog() over all of master
// tags:       every store tag (storeTags.js)
// latest:     latestByPlatform(tags)
// tagCommits: Map of tag name -> Set of the commits it contains
function summarizeFeatureCommits(
  commits,
  { tags, latest, tagCommits, since = FEATURE_COMMITS_SINCE, featurePaths = FEATURE_PATHS }
) {
  const sinceMs = localMidnight(since);
  const contains = (tag, sha) => Boolean(tag && tagCommits.get(tag.name)?.has(sha));
  const features = {};

  for (const [key, specs] of Object.entries(featurePaths)) {
    let count = 0;
    let first = null;

    for (const commit of commits) {
      if (!touches(specs, commit.files)) continue;
      if (commit.time >= sinceMs) count += 1;
      // Newest first, so on a tie the later record is the older commit.
      if (!first || commit.time <= first.time) first = commit;
    }

    const inStore = first ? tags.filter((tag) => contains(tag, first.sha)) : [];
    const firstInStore = inStore.reduce((earliest, tag) => (!earliest || tag.time < earliest.time ? tag : earliest), null);

    features[key] = {
      commits: count,
      firstInStoreAt: firstInStore ? firstInStore.at : null,
      // In the newest build of either store: somebody has it.
      inLatestStoreTag: Boolean(first) && PLATFORMS.some((platform) => contains(latest[platform], first.sha)),
    };
  }

  return { since, features };
}

module.exports = {
  FEATURE_COMMITS_SINCE,
  FEATURE_PATHS,
  matchesPathspec,
  parseNameOnlyLog,
  summarizeFeatureCommits,
};
