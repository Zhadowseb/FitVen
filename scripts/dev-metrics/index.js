#!/usr/bin/env node
// Measures what only git and GitHub know, and writes it to public.dev_metrics
// for the dev overview. .github/workflows/dev-metrics.yml runs it every night.
//
//   node scripts/dev-metrics/index.js --dry-run        prints the rows, writes nothing
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/dev-metrics/index.js [--ref <ref>]
//
// --ref is what counts as master: origin/master when it exists, else HEAD.
//
// Rows, as key/platform: release_lag/android and release_lag/ios (KPI-6),
// rework/all (S1), bug_debt/all (S8) and feature_commits/all (KPI-4). The
// modules next to this file compute them from git's and gh's output; this one
// only runs git and gh and writes the result.
//
// A metric that fails is reported and costs only that row. The exit code is
// non-zero only when nothing could be written (with --dry-run: measured).
// Without SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY it does nothing and says
// so. Neither value is ever printed.

const { execFile } = require("child_process");
const os = require("os");
const path = require("path");

const { BUG_LABELS, ISSUE_FIELDS, summarizeBugDebt } = require("./bugDebt");
const { addDays, lastCompleteWeeks } = require("./dates");
const { parseNameOnlyLog, summarizeFeatureCommits } = require("./featureCommits");
const { lines } = require("./gitOutput");
const { missingTagNote, parseCommitTimes, releaseLag, versionsFromPackagePatch } = require("./releaseLag");
const {
  LOG_ARGS,
  REWORK_WEEKS,
  blameArgs,
  changedLineTimes,
  describeSkipped,
  logSince,
  parseBlamePorcelain,
  parsePatchLog,
  planRework,
  plural,
  summarizeRework,
} = require("./rework");
const { FOR_EACH_REF_FORMAT, latestByPlatform, parseStoreTags } = require("./storeTags");
const { TABLE, describeFailure, readCredentials, upsertRequest } = require("./supabase");
const { packageVersion } = require("./versions");

const ROOT = path.resolve(__dirname, "..", "..");
const USAGE = "Usage: node scripts/dev-metrics/index.js [--dry-run] [--ref <ref>]";

function runCommand(file, args) {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      { cwd: ROOT, encoding: "utf8", maxBuffer: 512 * 1024 * 1024, timeout: 10 * 60 * 1000, windowsHide: true },
      (error, stdout, stderr) => {
        if (!error) {
          resolve(stdout);
          return;
        }

        const reason = String(stderr || error.message).trim().split(/\r?\n/)[0];

        reject(new Error(`${[file, ...args].join(" ").slice(0, 160)} failed: ${reason}`));
      }
    );
  });
}

async function mapLimit(items, limit, work) {
  const results = new Array(items.length);
  let next = 0;

  const worker = async () => {
    while (next < items.length) {
      const index = next;

      next += 1;
      results[index] = await work(items[index]);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));

  return results;
}

function createContext({ run, now, env, ref }) {
  const cache = new Map();
  const once = (key, compute) => {
    if (!cache.has(key)) cache.set(key, compute());

    return cache.get(key);
  };
  // quotePath=false: a path with ø in it comes out as ø, not as "\303\270".
  const git = (args) => run("git", ["-c", "core.quotePath=false", ...args]);
  const notes = [];

  return {
    run,
    now,
    env,
    ref,
    git,
    notes,
    notices: [],
    concurrency: Math.max(1, Math.min(8, os.availableParallelism?.() ?? os.cpus().length)),
    storeTags: () =>
      once("tags", async () => {
        const parsed = parseStoreTags(
          await git(["for-each-ref", `--format=${FOR_EACH_REF_FORMAT}`, "refs/tags/android", "refs/tags/ios"])
        );

        if (parsed.ignored.length) {
          notes.push(`store tags left out, as their names are not <platform>/<version>: ${parsed.ignored.join(", ")}.`);
        }

        return parsed;
      }),
    headVersion: () => once("head", async () => packageVersion(await git(["show", `${ref}:package.json`]))),
  };
}

/* ------------------------------------------------------------ metrics ---- */

async function measureReleaseLag(context, platform) {
  const { tags } = await context.storeTags();
  const tag = latestByPlatform(tags)[platform];
  const headVersion = await context.headVersion();

  if (!tag) {
    context.notices.push(missingTagNote(platform));

    return releaseLag({ tag: null, headVersion });
  }

  const range = `${tag.sha}..${context.ref}`;
  const [count, landed, tagPackage, packagePatch] = await Promise.all([
    context.git(["rev-list", "--count", "--no-merges", range]),
    context.git(["log", "--first-parent", "--format=%ct", range]),
    context.git(["show", `${tag.sha}:package.json`]).catch(() => null),
    context.git([
      "log",
      "--first-parent",
      "--diff-merges=first-parent",
      "-p",
      "-U0",
      "--no-color",
      "--no-ext-diff",
      "--format=",
      range,
      "--",
      "package.json",
    ]),
  ]);

  return releaseLag({
    tag,
    now: context.now,
    commits: Number(count.trim()),
    landedTimes: parseCommitTimes(landed),
    tagVersion: tagPackage === null ? null : packageVersion(tagPackage),
    headVersion,
    versionsSeen: versionsFromPackagePatch(packagePatch),
  });
}

async function measureRework(context) {
  const weeks = lastCompleteWeeks(context.now, REWORK_WEEKS);
  const log = await context.git([...LOG_ARGS, `--since=${logSince(weeks)}`, context.ref]);
  const plan = planRework(parsePatchLog(log), { weeks });
  let failed = 0;

  const results = await mapLimit(plan.tasks, context.concurrency, async (task) => {
    try {
      const entries = parseBlamePorcelain(await context.git(blameArgs(task)));

      return { weekStart: task.weekStart, path: task.path, authorTime: task.authorTime, times: changedLineTimes(entries, task.ranges) };
    } catch {
      failed += 1;

      return null;
    }
  });

  if (plan.tasks.length && failed === plan.tasks.length) {
    throw new Error(`all ${failed} blames failed`);
  }

  context.notes.push(
    `rework: ${weeks[0]} to ${addDays(weeks[weeks.length - 1], 6)}, ${plural(plan.commits, "commit")}, ` +
      `${plural(plan.tasks.length - failed, "file")} blamed${failed ? `, ${plural(failed, "blame")} failed` : ""}; ` +
      `${describeSkipped(plan.skipped)}.`
  );

  return summarizeRework(results.filter(Boolean), { weeks });
}

async function measureBugDebt(context) {
  const repo = context.env.GITHUB_REPOSITORY ? ["--repo", context.env.GITHUB_REPOSITORY] : [];
  const lists = [];

  // One label per call: gh reads repeated --label as AND.
  for (const label of BUG_LABELS) {
    const output = await context.run("gh", [
      "issue",
      "list",
      ...repo,
      "--state",
      "open",
      "--label",
      label,
      "--json",
      ISSUE_FIELDS,
      "--limit",
      "1000",
    ]);

    lists.push(JSON.parse(output));
  }

  return summarizeBugDebt(lists, context.now);
}

async function measureFeatureCommits(context) {
  const { tags } = await context.storeTags();
  const log = await context.git(["log", "--no-merges", "--no-renames", "--name-only", "--format=%x1e%H%x09%ct", context.ref]);
  const contents = await mapLimit(tags, context.concurrency, (tag) => context.git(["rev-list", tag.sha]));
  const tagCommits = new Map(
    tags.map((tag, index) => [tag.name, new Set(lines(contents[index]).map((line) => line.trim()).filter(Boolean))])
  );

  return summarizeFeatureCommits(parseNameOnlyLog(log), { tags, latest: latestByPlatform(tags), tagCommits });
}

const METRICS = [
  { key: "release_lag", platform: "android", measure: (context) => measureReleaseLag(context, "android") },
  { key: "release_lag", platform: "ios", measure: (context) => measureReleaseLag(context, "ios") },
  { key: "rework", platform: "all", measure: measureRework },
  { key: "bug_debt", platform: "all", measure: measureBugDebt },
  { key: "feature_commits", platform: "all", measure: measureFeatureCommits },
];

/* --------------------------------------------------------------- main ---- */

function parseArgs(argv) {
  const options = { dryRun: false, ref: null, help: false, unknown: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--dry-run") options.dryRun = true;
    else if (token === "--help" || token === "-h") options.help = true;
    else if (token === "--ref") options.ref = argv[++index] ?? null;
    else if (token.startsWith("--ref=")) options.ref = token.slice(6);
    else options.unknown.push(token);
  }

  return options;
}

// GitHub's workflow commands end at a newline and treat % specially.
function escapeAnnotation(text) {
  return String(text).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

async function resolveRef(run) {
  try {
    await run("git", ["rev-parse", "--verify", "--quiet", "origin/master^{commit}"]);

    return "origin/master";
  } catch {
    return "HEAD";
  }
}

async function main({
  argv = process.argv.slice(2),
  env = process.env,
  run = runCommand,
  fetchImpl = globalThis.fetch,
  now = Date.now(),
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  const options = parseArgs(argv);
  const say = (text) => stderr.write(`${text}\n`);
  const annotate = (level, text) => {
    if (env.GITHUB_ACTIONS === "true") say(`::${level} title=dev-metrics::${escapeAnnotation(text)}`);
  };
  const fail = (text) => {
    say(`FAILED ${text}`);
    annotate("warning", text);
  };

  if (options.help || options.unknown.length) {
    say(options.unknown.length ? `Unknown option: ${options.unknown.join(" ")}\n${USAGE}` : USAGE);

    return options.help && !options.unknown.length ? 0 : 2;
  }

  const credentials = readCredentials(env);

  if (!options.dryRun && !credentials) {
    const text =
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not both set, so nothing was measured or written. " +
      "Add them as repository secrets, or use --dry-run to see the numbers.";

    say(`dev-metrics: ${text}`);
    annotate("warning", text);

    return 0;
  }

  const ref = options.ref ?? (await resolveRef(run));
  const context = createContext({ run, now, env, ref });
  const rows = [];
  const failures = [];

  say(`dev-metrics: measuring ${ref} at ${new Date(now).toISOString()}${options.dryRun ? " (dry run)" : ""}.`);

  for (const metric of METRICS) {
    const label = `${metric.key}/${metric.platform}`;

    try {
      const value = await metric.measure(context);

      rows.push({ key: metric.key, platform: metric.platform, value });
      say(`${label}: ${JSON.stringify(value)}`);
    } catch (error) {
      failures.push(`${label} was not measured: ${error.message}`);
    }
  }

  for (const note of context.notes) say(note);

  for (const notice of context.notices) {
    say(notice);
    annotate("notice", notice);
  }

  failures.forEach(fail);

  if (options.dryRun) {
    stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
    say(`dev-metrics: dry run, ${rows.length} of ${METRICS.length} rows measured, nothing written.`);

    return rows.length ? 0 : 1;
  }

  const measuredAt = new Date(now).toISOString();
  let written = 0;

  for (const row of rows) {
    const { endpoint, init } = upsertRequest(credentials, { ...row, measured_at: measuredAt });

    try {
      const response = await fetchImpl(endpoint, init);

      if (!response.ok) throw new Error(await describeFailure(response));

      written += 1;
    } catch (error) {
      // A network error's cause can name the host; its code cannot.
      const reason = error.cause?.code ? `${error.message} (${error.cause.code})` : error.message;

      fail(`${row.key}/${row.platform} was not written: ${reason}`);
    }
  }

  say(`dev-metrics: wrote ${written} of ${METRICS.length} rows to ${TABLE}.`);

  return written > 0 ? 0 : 1;
}

if (require.main === module) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(`dev-metrics: ${error.stack || error.message}`);
      process.exitCode = 1;
    }
  );
}

module.exports = { METRICS, main, parseArgs };
