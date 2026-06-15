#!/usr/bin/env node

const { execFileSync } = require("child_process");

const dryRun =
  process.argv.includes("--dry-run") || process.env.FITAPP_AUTO_PUSH_DRY_RUN === "1";
const skip =
  process.env.FITAPP_SKIP_AUTO_PUSH === "1" || process.env.FITAPP_AUTO_PUSH === "0";

try {
  main();
} catch (error) {
  const detail = getErrorDetail(error);
  console.error(`auto-push: failed${detail ? `: ${detail}` : ""}`);
  process.exit(1);
}

function main() {
  if (skip) {
    console.log("auto-push: skipped by environment");
    return;
  }

  const branchName = safeGit(["branch", "--show-current"]);

  if (!branchName) {
    console.log("auto-push: skipped detached HEAD");
    return;
  }

  if (/^(main|master)$/i.test(branchName)) {
    console.log(`auto-push: skipped protected branch ${branchName}`);
    return;
  }

  const upstream = safeGit([
    "rev-parse",
    "--abbrev-ref",
    "--symbolic-full-name",
    "@{u}",
  ]);

  if (upstream) {
    runGit(["push"]);
  } else {
    ensureRemoteExists("origin");
    runGit(["push", "-u", "origin", branchName]);
  }

  console.log(dryRun ? "auto-push: dry run complete" : "auto-push: done");
}

function safeGit(args) {
  try {
    return git(args);
  } catch (_error) {
    return "";
  }
}

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function runGit(args) {
  console.log(`auto-push: git ${args.map(formatArg).join(" ")}`);

  if (dryRun) {
    return;
  }

  execFileSync("git", args, { stdio: "inherit" });
}

function ensureRemoteExists(remoteName) {
  if (safeGit(["remote", "get-url", remoteName])) {
    return;
  }

  throw new Error(`remote "${remoteName}" is not configured`);
}

function formatArg(arg) {
  return /\s/.test(arg) ? JSON.stringify(arg) : arg;
}

function getErrorDetail(error) {
  if (error?.stderr) {
    const stderr = error.stderr.toString().trim();

    if (stderr) {
      return stderr;
    }
  }

  return error?.message || "";
}
