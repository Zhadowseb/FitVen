const { execFileSync } = require("child_process");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const args = process.argv.slice(2);

const options = parseOptions(args);
const version = options.positionals[0];

if (!version) {
  console.error(
    "Usage: node scripts/release-android.js <x.y.z> [--prebuild] [--dry-run] [--skip-build]"
  );
  process.exit(1);
}

run();

function run() {
  warnIfBranchDoesNotMatchRelease(version);

  runNodeScript("scripts/version.js", ["release", version, ...toVersionArgs()]);

  if (options.dryRun || options.skipBuild) {
    return;
  }

  ensureEasAuthentication();

  if (options.prebuild) {
    runNpxCommand(["expo", "prebuild"]);
  }

  runNpxCommand(["eas", "build", "-p", "android", "--profile", "production"]);
}

function parseOptions(tokens) {
  const parsed = {
    dryRun: false,
    prebuild: false,
    skipBuild: false,
    positionals: [],
  };

  for (const token of tokens) {
    if (token === "--dry-run" || token === "dry-run") {
      parsed.dryRun = true;
      continue;
    }

    if (token === "--prebuild" || token === "prebuild") {
      parsed.prebuild = true;
      continue;
    }

    if (token === "--skip-build" || token === "skip-build") {
      parsed.skipBuild = true;
      continue;
    }

    parsed.positionals.push(token);
  }

  return parsed;
}

function toVersionArgs() {
  return options.dryRun ? ["--dry-run"] : [];
}

function getNpxExecutable() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function getGitExecutable() {
  return process.platform === "win32" ? "git.exe" : "git";
}

function runNodeScript(relativeScriptPath, scriptArgs) {
  execFileSync(process.execPath, [path.join(rootDir, relativeScriptPath), ...scriptArgs], {
    cwd: rootDir,
    stdio: "inherit",
  });
}

function runNpxCommand(commandArgs) {
  execFileSync(getNpxExecutable(), commandArgs, {
    cwd: rootDir,
    stdio: "inherit",
  });
}

function ensureEasAuthentication() {
  try {
    runNpxCommand(["eas", "whoami"]);
  } catch (_error) {
    console.error(
      [
        "EAS authentication is required before starting a release build.",
        "Sign in with `npx eas login` or set `EXPO_TOKEN`, then rerun the release command.",
      ].join(" ")
    );
    process.exit(1);
  }
}

function warnIfBranchDoesNotMatchRelease(targetVersion) {
  try {
    const branchName = execFileSync(getGitExecutable(), ["branch", "--show-current"], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    if (!branchName) {
      return;
    }

    const expectedBranchName = `release/${targetVersion}`;

    if (branchName !== expectedBranchName) {
      console.log(
        `Warning: current branch is "${branchName}". Recommended release branch is "${expectedBranchName}".`
      );
    }
  } catch {
    // Ignore branch lookup failures and continue with the release flow.
  }
}
