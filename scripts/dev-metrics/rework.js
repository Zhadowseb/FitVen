// S1: rework - the share of changed lines that were under 14 days old.
//
// For every commit on master in the last four complete weeks, each line it
// removed or changed is blamed on the commit's parent, which says when that
// line was last written. A line that was under 14 days old when it was changed
// again is rework. Added lines have no previous version, so they count on
// neither side. Ages are author times, which survive a rebase.
//
// Whitespace is ignored on both sides (`-w`): re-indenting old code, or a file
// going from CRLF to LF, is not rework, and blame looks past it.
//
// It is kept cheap, and says what it left out:
//   lockfile   package-lock.json and friends
//   version    CHANGELOG.md, package.json and app.json, which `npm run
//              version:auto` rewrites on every branch - the version line would
//              be rework every week without anybody reworking anything
//   generated  the built privacy and terms pages, minified files, source maps
//   data       the gym import data under data/
//   binary     anything git will not diff
//   bulk       over MAX_LINES_PER_FILE lines of one file in one commit - a
//              generated file or a move, and one of them would decide the
//              month on its own
//   cap        past the MAX_FILES_PER_COMMIT biggest files of a commit

const { RECORD, lines, unquotePath } = require("./gitOutput");
const { addDays, localDate, localMidnight, mondayOf } = require("./dates");

const REWORK_WEEKS = 4;
const REWORK_AGE_DAYS = 14;
// Measured in September 2026: 20 left 14 % of the changed lines out, 50 leaves
// 3 % for a fifth more blames. The files left out are a commit's smallest.
const MAX_FILES_PER_COMMIT = 50;
const MAX_LINES_PER_FILE = 2000;
// Above this many ranges, one blame of the whole file is cheaper than a
// command line full of -L.
const MAX_RANGES_PER_BLAME = 100;

const SKIP_RULES = [
  ["lockfile", /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|Podfile\.lock|Gemfile\.lock)$/],
  ["version", /^(CHANGELOG\.md|package\.json|app\.json)$/],
  ["generated", /^web\/(privacy|terms)\/index\.html$|(^|\/)(dist|build)\/|\.min\.(js|css)$|\.map$/],
  ["data", /^data\//],
];

// What index.js asks git log for. -U0 leaves only the changed lines, whose
// old-side ranges are what gets blamed.
const LOG_ARGS = [
  "log",
  "--no-merges",
  "-p",
  "-w",
  "-U0",
  "-M",
  "--no-color",
  "--no-ext-diff",
  "--no-textconv",
  "--src-prefix=a/",
  "--dst-prefix=b/",
  "--format=%x1e%H%x09%P%x09%at",
];

const HUNK = /^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@/;

function headerPath(raw, prefix) {
  // Git ends the name with a tab when it holds a space.
  const text = unquotePath(raw.replace(/\t$/, ""));

  if (text === "/dev/null") return null;

  return text.startsWith(prefix) ? text.slice(prefix.length) : text;
}

// Parses `git log <LOG_ARGS>`: per commit its parent, author time (seconds)
// and, per file, the old path and the old-side line ranges [start, count].
function parsePatchLog(output) {
  const commits = [];

  for (const record of String(output ?? "").split(RECORD)) {
    const [header, ...body] = lines(record);
    const [sha, parents = "", seconds] = (header ?? "").split("\t");

    if (!/^[0-9a-f]{7,64}$/.test(sha ?? "")) continue;

    const files = [];
    let file = null;

    for (const line of body) {
      if (line.startsWith("diff --git ")) {
        file = { oldPath: null, newPath: null, binary: false, ranges: [], inHunks: false };
        files.push(file);
        continue;
      }

      if (!file) continue;

      if (line.startsWith("@@ ")) {
        file.inHunks = true;

        const match = HUNK.exec(line);
        const count = match ? (match[2] === undefined ? 1 : Number(match[2])) : 0;

        if (count > 0) file.ranges.push([Number(match[1]), count]);
        continue;
      }

      // After the first hunk every line is a changed line, and a removed
      // "-- comment" reads "--- comment". Only the header is parsed.
      if (file.inHunks) continue;

      if (line.startsWith("--- ")) file.oldPath = headerPath(line.slice(4), "a/");
      else if (line.startsWith("+++ ")) file.newPath = headerPath(line.slice(4), "b/");
      else if (line.startsWith("Binary files ") || line === "GIT binary patch") file.binary = true;
    }

    commits.push({
      sha,
      parent: parents.split(" ").filter(Boolean)[0] ?? null,
      authorTime: Number(seconds),
      files: files.map(({ inHunks, ...rest }) => rest),
    });
  }

  return commits;
}

function oldLineCount(file) {
  return file.ranges.reduce((sum, [, count]) => sum + count, 0);
}

function skipReason(path, lineCount, maxLinesPerFile = MAX_LINES_PER_FILE) {
  for (const [reason, pattern] of SKIP_RULES) {
    if (pattern.test(path)) return reason;
  }

  return lineCount > maxLinesPerFile ? "bulk" : null;
}

// Which files of which commits to blame, and what was left out.
function planRework(
  commits,
  { weeks, maxFilesPerCommit = MAX_FILES_PER_COMMIT, maxLinesPerFile = MAX_LINES_PER_FILE }
) {
  const window = new Set(weeks);
  const tasks = [];
  const skipped = {};
  let commitCount = 0;

  const skip = (reason, lineCount) => {
    const entry = skipped[reason] ?? (skipped[reason] = { files: 0, lines: 0 });

    entry.files += 1;
    entry.lines += lineCount;
  };

  for (const commit of commits) {
    if (!commit.parent || !Number.isFinite(commit.authorTime)) continue;

    const weekStart = mondayOf(localDate(commit.authorTime * 1000));

    if (!window.has(weekStart)) continue;

    commitCount += 1;

    const candidates = [];

    for (const file of commit.files) {
      const lineCount = oldLineCount(file);

      if (file.binary) {
        skip("binary", 0);
        continue;
      }

      if (!lineCount || !file.oldPath) continue;

      const reason = skipReason(file.oldPath, lineCount, maxLinesPerFile);

      if (reason) skip(reason, lineCount);
      else candidates.push({ path: file.oldPath, ranges: file.ranges, lines: lineCount });
    }

    candidates.sort((a, b) => b.lines - a.lines || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

    candidates.forEach((candidate, index) => {
      if (index >= maxFilesPerCommit) {
        skip("cap", candidate.lines);
      } else {
        tasks.push({ sha: commit.sha, parent: commit.parent, authorTime: commit.authorTime, weekStart, ...candidate });
      }
    });
  }

  return { tasks, skipped, commits: commitCount };
}

function blameArgs(task, maxRanges = MAX_RANGES_PER_BLAME) {
  const args = ["blame", "-w", "--line-porcelain"];

  if (task.ranges.length <= maxRanges) {
    for (const [start, count] of task.ranges) args.push("-L", `${start},+${count}`);
  }

  return [...args, task.parent, "--", task.path];
}

// Parses `git blame --line-porcelain`: per line, its number in the blamed
// revision and when it was written (author time, seconds).
function parseBlamePorcelain(output) {
  const entries = [];
  let current = null;

  for (const line of lines(output)) {
    if (line.startsWith("\t")) {
      if (current && Number.isFinite(current.time)) entries.push(current);
      current = null;
      continue;
    }

    const header = /^[0-9a-f]{40,64} \d+ (\d+)(?: \d+)?$/.exec(line);

    if (header) current = { line: Number(header[1]), time: null };
    else if (current && line.startsWith("author-time ")) current.time = Number(line.slice(12));
  }

  return entries;
}

// The ages that belong to the changed ranges. A blame run with -L returns
// only those; a whole-file blame returns every line.
function changedLineTimes(entries, ranges) {
  return entries
    .filter(({ line }) => ranges.some(([start, count]) => line >= start && line < start + count))
    .map(({ time }) => time);
}

function folderOf(path) {
  const parts = path.split("/").slice(0, -1);

  return parts.length ? parts.slice(0, 3).join("/") : ".";
}

function percentOf(part, whole) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

// results: one { weekStart, path, authorTime, times } per blamed file.
function summarizeRework(results, { weeks, ageDays = REWORK_AGE_DAYS }) {
  const limit = ageDays * 86400;
  const byWeek = new Map(weeks.map((week) => [week, { changed: 0, rework: 0 }]));
  const byFolder = new Map();

  for (const result of results) {
    const week = byWeek.get(result.weekStart);

    if (!week) continue;

    const young = result.times.filter((time) => result.authorTime - time < limit).length;

    week.changed += result.times.length;
    week.rework += young;

    if (young) {
      const folder = folderOf(result.path);

      byFolder.set(folder, (byFolder.get(folder) ?? 0) + young);
    }
  }

  let changed = 0;
  let rework = 0;

  for (const week of byWeek.values()) {
    changed += week.changed;
    rework += week.rework;
  }

  let topFolder = null;
  let topLines = 0;

  for (const [folder, count] of byFolder) {
    if (count > topLines || (count === topLines && folder < topFolder)) {
      topFolder = folder;
      topLines = count;
    }
  }

  return {
    percent: percentOf(rework, changed),
    topFolder,
    weeks: weeks.map((weekStart) => ({
      weekStart,
      percent: percentOf(byWeek.get(weekStart).rework, byWeek.get(weekStart).changed),
    })),
  };
}

// The --since for the log: a day before the window, as git log filters by
// commit date and the window is by author date.
function logSince(weeks) {
  return new Date(localMidnight(addDays(weeks[0], -1))).toISOString();
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function describeSkipped(skipped) {
  const parts = Object.entries(skipped)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([reason, { files, lines: lineCount }]) => `${reason} ${plural(files, "file")}${lineCount ? ` (${plural(lineCount, "line")})` : ""}`);

  return parts.length ? `skipped ${parts.join(", ")}` : "skipped nothing";
}

module.exports = {
  LOG_ARGS,
  MAX_FILES_PER_COMMIT,
  MAX_LINES_PER_FILE,
  MAX_RANGES_PER_BLAME,
  REWORK_AGE_DAYS,
  REWORK_WEEKS,
  blameArgs,
  changedLineTimes,
  describeSkipped,
  folderOf,
  logSince,
  parseBlamePorcelain,
  parsePatchLog,
  planRework,
  plural,
  skipReason,
  summarizeRework,
};
