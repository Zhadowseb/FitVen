const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const packageJsonPath = path.join(rootDir, "package.json");
const appJsonPath = path.join(rootDir, "app.json");
const changelogPath = path.join(rootDir, "CHANGELOG.md");

const args = process.argv.slice(2);
const command = args[0];
const options = parseOptions(args.slice(1));

if (!command || !["auto", "branch", "release", "status", "sync"].includes(command)) {
  console.error(
    "Usage: node scripts/version.js <auto|branch|release|status|sync> [options]\n" +
      "Examples:\n" +
      "  node scripts/version.js auto\n" +
      "  node scripts/version.js auto --dry-run\n" +
      "  node scripts/version.js branch\n" +
      "  node scripts/version.js branch --branch major/new-ui\n" +
      "  node scripts/version.js branch minor/new-ui dry-run\n" +
      "  node scripts/version.js branch --bump minor\n" +
      "  node scripts/version.js status\n" +
      "  node scripts/version.js release 0.4.0\n" +
      "  node scripts/version.js sync 0.4.0 --skip-changelog"
  );
  process.exit(1);
}

run();

function run() {
  if (command === "auto") {
    const summary = prepareAutoVersioning(options);
    applyVersioning(summary, options.dryRun);
    printSummary(summary, options.dryRun);
    return;
  }

  if (command === "branch") {
    const summary = prepareBranchVersioning(options);
    applyVersioning(summary, options.dryRun);
    printSummary(summary, options.dryRun);
    return;
  }

  if (command === "status") {
    printStatus(options);
    return;
  }

  if (command === "release") {
    const version = options.positionals[0];

    if (!version) {
      console.error("Release mode requires an explicit version, for example 0.4.0");
      process.exit(1);
    }

    const summary = prepareExplicitVersioning({
      mode: "release",
      targetVersion: version,
      skipChangelog: options.skipChangelog,
    });
    applyVersioning(summary, options.dryRun);
    printSummary(summary, options.dryRun);
    return;
  }

  if (command === "sync") {
    const version = options.positionals[0];

    if (!version) {
      console.error("Sync mode requires an explicit version, for example 0.4.0");
      process.exit(1);
    }

    const summary = prepareExplicitVersioning({
      mode: "sync",
      targetVersion: version,
      skipChangelog: options.skipChangelog,
    });
    applyVersioning(summary, options.dryRun);
    printSummary(summary, options.dryRun);
  }
}

function prepareAutoVersioning(currentOptions) {
  let branchName = currentOptions.branchName;

  if (!branchName) {
    for (const token of currentOptions.positionals) {
      if (!branchName) {
        branchName = token;
      }
    }
  }

  branchName = branchName || getCurrentBranchName();

  if (!branchName) {
    console.error("Could not determine the current branch name.");
    process.exit(1);
  }

  const releaseMatch = branchName.match(/^release[/-](\d+\.\d+\.\d+)$/i);

  if (releaseMatch) {
    return prepareExplicitVersioning({
      mode: "release",
      targetVersion: releaseMatch[1],
      branchName,
      skipChangelog: currentOptions.skipChangelog,
    });
  }

  return prepareBranchVersioning({
    ...currentOptions,
    branchName,
  });
}

function parseOptions(tokens) {
  const parsed = {
    branchName: null,
    bump: null,
    baseRef: "HEAD",
    baseRefProvided: false,
    dryRun: false,
    skipChangelog: false,
    positionals: [],
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token === "dry-run") {
      parsed.dryRun = true;
      continue;
    }

    if (token === "skip-changelog") {
      parsed.skipChangelog = true;
      continue;
    }

    if (token.startsWith("branch=")) {
      parsed.branchName = token.slice("branch=".length);
      continue;
    }

    if (token.startsWith("bump=")) {
      parsed.bump = token.slice("bump=".length);
      continue;
    }

    if (token.startsWith("base-ref=")) {
      parsed.baseRef = token.slice("base-ref=".length);
      parsed.baseRefProvided = true;
      continue;
    }

    if (token === "--branch") {
      parsed.branchName = tokens[index + 1];
      index += 1;
      continue;
    }

    if (token === "--bump") {
      parsed.bump = tokens[index + 1];
      index += 1;
      continue;
    }

    if (token === "--base-ref") {
      parsed.baseRef = tokens[index + 1];
      parsed.baseRefProvided = true;
      index += 1;
      continue;
    }

    if (token === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }

    if (token === "--skip-changelog") {
      parsed.skipChangelog = true;
      continue;
    }

    parsed.positionals.push(token);
  }

  return parsed;
}

function prepareBranchVersioning(currentOptions) {
  let branchName = currentOptions.branchName;
  let inferredBump = currentOptions.bump;

  if (!branchName) {
    for (const token of currentOptions.positionals) {
      if (["major", "minor", "patch"].includes(token)) {
        inferredBump = inferredBump || token;
        continue;
      }

      if (!branchName) {
        branchName = token;
      }
    }
  }

  branchName = branchName || getCurrentBranchName();

  if (!branchName) {
    console.error("Could not determine the current branch name.");
    process.exit(1);
  }

  const releaseMatch = branchName.match(/^release[/-](\d+\.\d+\.\d+)$/i);

  if (releaseMatch) {
    return prepareExplicitVersioning({
      mode: "release",
      targetVersion: releaseMatch[1],
      branchName,
      skipChangelog: currentOptions.skipChangelog,
    });
  }

  if (/^(master|main)$/i.test(branchName)) {
    console.error(
      "Branch mode does not auto-version master/main. Use a work branch or run an explicit release command."
    );
    process.exit(1);
  }

  inferredBump = inferredBump || inferBumpFromBranch(branchName);

  if (!inferredBump) {
    console.error(
      `Could not infer a version bump from "${branchName}". Use --bump major|minor|patch or rename the branch to major/*, minor/*, fix/*, breaking/*, or release/x.y.z`
    );
    process.exit(1);
  }

  const prereleaseSuffix = `${sanitizeBranchName(branchName)}.1`;
  const currentPackageVersion = readJson(packageJsonPath).version;
  const computedTargetVersion = `${bumpStableVersion(
    readStableVersionFromRef(currentOptions.baseRef),
    inferredBump
  )}-${prereleaseSuffix}`;
  const targetVersion =
    String(currentPackageVersion).endsWith(`-${prereleaseSuffix}`) && !currentOptions.baseRefProvided
      ? String(currentPackageVersion)
      : computedTargetVersion;

  return buildVersioningSummary({
    mode: "branch",
    branchName,
    targetVersion,
    changelogMode: currentOptions.skipChangelog ? "skip" : "unreleased",
  });
}

function prepareExplicitVersioning({ mode, targetVersion, branchName = null, skipChangelog = false }) {
  const normalizedVersion = normalizeStableVersion(targetVersion);

  return buildVersioningSummary({
    mode,
    branchName,
    targetVersion: normalizedVersion,
    changelogMode: skipChangelog ? "skip" : mode === "release" ? "release" : "unreleased",
  });
}

function buildVersioningSummary({ mode, branchName, targetVersion, changelogMode }) {
  const packageJson = readJson(packageJsonPath);
  const appJson = readJson(appJsonPath);
  const nextPackageJson = structuredClone(packageJson);
  const nextAppJson = structuredClone(appJson);
  const targetAppVersion = getAppStoreVersion(targetVersion);

  nextPackageJson.version = targetVersion;
  nextAppJson.expo = nextAppJson.expo || {};
  nextAppJson.expo.version = targetAppVersion;

  let nextBuildNumber = null;

  if (mode === "release") {
    nextBuildNumber = getNextBuildNumber(nextAppJson.expo);
    nextAppJson.expo.android = nextAppJson.expo.android || {};
    nextAppJson.expo.ios = nextAppJson.expo.ios || {};
    nextAppJson.expo.android.versionCode = nextBuildNumber;
    nextAppJson.expo.ios.buildNumber = String(nextBuildNumber);
  }

  const changelogContent = fs.existsSync(changelogPath)
    ? fs.readFileSync(changelogPath, "utf8")
    : "# Changelog\n";
  const nextChangelogContent = updateChangelog({
    content: changelogContent,
    changelogMode,
    targetVersion,
  });

  return {
    mode,
    branchName,
    targetVersion,
    targetAppVersion,
    changelogMode,
    nextBuildNumber,
    packageJson,
    nextPackageJson,
    appJson,
    nextAppJson,
    changelogContent,
    nextChangelogContent,
  };
}

function applyVersioning(summary, dryRun) {
  if (dryRun) {
    return;
  }

  writeJson(packageJsonPath, summary.nextPackageJson);
  writeJson(appJsonPath, summary.nextAppJson);

  if (summary.changelogMode !== "skip") {
    fs.writeFileSync(
      changelogPath,
      ensureTrailingEol(summary.nextChangelogContent, detectEol(summary.changelogContent))
    );
  }
}

function printSummary(summary, dryRun) {
  const prefix = dryRun ? "[dry-run] " : "";

  console.log(`${prefix}Mode: ${summary.mode}`);
  if (summary.branchName) {
    console.log(`${prefix}Branch: ${summary.branchName}`);
  }
  console.log(`${prefix}Version: ${summary.targetVersion}`);
  if (summary.targetAppVersion !== summary.targetVersion) {
    console.log(`${prefix}Expo app version: ${summary.targetAppVersion}`);
  }

  if (summary.mode === "release" && summary.nextBuildNumber !== null) {
    console.log(`${prefix}Android versionCode / iOS buildNumber: ${summary.nextBuildNumber}`);
  }

  if (summary.changelogMode === "unreleased") {
    console.log(
      `${prefix}CHANGELOG.md: ensured version section ${getChangelogSectionVersion(
        summary.targetVersion
      )} - Unreleased`
    );
  } else if (summary.changelogMode === "release") {
    console.log(`${prefix}CHANGELOG.md: prepared release entry ${summary.targetVersion}`);
  } else {
    console.log(`${prefix}CHANGELOG.md: skipped`);
  }
}

function printStatus(currentOptions) {
  const branchName = currentOptions.branchName || safeGetCurrentBranchName();
  const packageJson = readJson(packageJsonPath);
  const appJson = readJson(appJsonPath);
  const packageVersion = packageJson.version;
  const appVersion = appJson?.expo?.version || "(missing)";
  const expectedAppVersionFromPackage = getAppStoreVersion(packageVersion);
  const versionsAligned = appVersion === expectedAppVersionFromPackage;
  const changelogContent = fs.existsSync(changelogPath)
    ? fs.readFileSync(changelogPath, "utf8")
    : "";
  const changelogVersion = branchName
    ? getChangelogSectionVersion(
        /^release[/-](\d+\.\d+\.\d+)$/i.test(branchName)
          ? branchName.match(/^release[/-](\d+\.\d+\.\d+)$/i)[1]
          : packageVersion
      )
    : null;
  const hasCurrentVersionSection = changelogVersion
    ? hasVersionSection(changelogContent, changelogVersion)
    : false;

  console.log(`Branch: ${branchName || "(unknown)"}`);
  console.log(`package.json version: ${packageVersion}`);
  console.log(`app.json version: ${appVersion}`);
  console.log(`Expected app.json version: ${expectedAppVersionFromPackage}`);
  console.log(`App Store version aligned: ${versionsAligned ? "yes" : "no"}`);
  console.log(
    `CHANGELOG.md has current version section: ${hasCurrentVersionSection ? "yes" : "no"}`
  );

  if (!branchName) {
    console.log("Recommended action: create or switch to a work branch, then run npm run version:auto");
    return;
  }

  if (/^(master|main)$/i.test(branchName)) {
    console.log("Recommended action: do not edit on master/main. Create a work branch first, then run npm run version:auto");
    return;
  }

  const releaseMatch = branchName.match(/^release[/-](\d+\.\d+\.\d+)$/i);

  if (releaseMatch) {
    const targetVersion = normalizeStableVersion(releaseMatch[1]);
    const releaseIsAligned = versionsAligned && packageVersion === targetVersion;
    console.log(`Expected version from branch: ${targetVersion}`);
    console.log(
      `Recommended action: ${
        releaseIsAligned
          ? `run npm run release:prepare -- ${targetVersion} when you are ready to ship`
          : `run npm run release:prepare -- ${targetVersion}`
      }`
    );
    return;
  }

  const inferredBump = currentOptions.bump || inferBumpFromBranch(branchName);

  if (!inferredBump) {
    console.log(
      "Recommended action: rename the branch to major/*, minor/*, fix/*, breaking/*, or release/x.y.z, or run npm run version:branch -- <branch-name> <major|minor|patch>"
    );
    return;
  }

  const prereleaseSuffix = `${sanitizeBranchName(branchName)}.1`;
  const computedExpectedVersion = `${bumpStableVersion(
    readStableVersionFromRef(currentOptions.baseRef),
    inferredBump
  )}-${prereleaseSuffix}`;
  const expectedVersion =
    String(packageVersion).endsWith(`-${prereleaseSuffix}`) && !currentOptions.baseRefProvided
      ? packageVersion
      : computedExpectedVersion;
  console.log(`Expected version from branch: ${expectedVersion}`);
  console.log(
    `Recommended action: ${
      versionsAligned && packageVersion === expectedVersion
        ? "versioning is already aligned for this branch"
        : "run npm run version:auto"
    }`
  );
}

function safeGetCurrentBranchName() {
  try {
    return getCurrentBranchName();
  } catch (_error) {
    return "";
  }
}

function resolveGitDir() {
  const dotGitPath = path.join(rootDir, ".git");
  const stats = fs.statSync(dotGitPath);

  if (stats.isDirectory()) {
    return dotGitPath;
  }

  const pointerContent = fs.readFileSync(dotGitPath, "utf8");
  const match = pointerContent.match(/^gitdir:\s*(.+)\s*$/i);

  if (!match) {
    throw new Error("Could not resolve .git directory.");
  }

  return path.resolve(rootDir, match[1]);
}

function inferBumpFromBranch(branchName) {
  if (/^(fix|bugfix|hotfix|quickfix|minor|minor-feature|minorfeature)([/-]|$)/i.test(branchName)) {
    return "patch";
  }

  if (/^(feat|feature|major|major-feature|majorfeature)([/-]|$)/i.test(branchName)) {
    return "minor";
  }

  if (/^(breaking)([/-]|$)/i.test(branchName)) {
    return "major";
  }

  return null;
}

function readStableVersionFromRef(ref) {
  const fallbackPackageJson = readJson(packageJsonPath);

  try {
    const rawPackageJson = execFileSync("git", ["show", `${ref}:package.json`], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const parsed = JSON.parse(rawPackageJson);
    return normalizeStableVersion(parsed.version);
  } catch (_error) {
    return normalizeStableVersion(fallbackPackageJson.version);
  }
}

function getCurrentBranchName() {
  const gitDir = resolveGitDir();
  const headPath = path.join(gitDir, "HEAD");
  const headContent = fs.readFileSync(headPath, "utf8").trim();

  if (headContent.startsWith("ref: refs/heads/")) {
    return headContent.replace("ref: refs/heads/", "").trim();
  }

  return "";
}

function getNextBuildNumber(expoConfig) {
  const currentAndroidVersionCode = Number(expoConfig?.android?.versionCode || 0);
  const currentIosBuildNumber = Number(expoConfig?.ios?.buildNumber || 0);
  return Math.max(currentAndroidVersionCode, currentIosBuildNumber) + 1;
}

function normalizeStableVersion(version) {
  const match = String(version).trim().match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].+)?$/);

  if (!match) {
    console.error(`Invalid version "${version}". Use a semantic version like 0.4.0`);
    process.exit(1);
  }

  return `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`;
}

function getAppStoreVersion(version) {
  return normalizeStableVersion(version);
}

function bumpStableVersion(version, bumpType) {
  const [major, minor, patch] = normalizeStableVersion(version)
    .split(".")
    .map((value) => Number(value));

  if (bumpType === "major") {
    return `${major + 1}.0.0`;
  }

  if (bumpType === "minor") {
    return `${major}.${minor + 1}.0`;
  }

  if (bumpType === "patch") {
    return `${major}.${minor}.${patch + 1}`;
  }

  console.error(`Unsupported bump type "${bumpType}". Use major, minor, or patch.`);
  process.exit(1);
}

function sanitizeBranchName(branchName) {
  const sanitized = branchName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");

  return sanitized || "work";
}

function updateChangelog({ content, changelogMode, targetVersion }) {
  if (changelogMode === "skip") {
    return content;
  }

  const eol = detectEol(content);
  let nextContent = content.trim().length
    ? content
    : "# Changelog\n";

  nextContent = normalizeChangelogTitle(nextContent, eol);
  nextContent = removeLegacyIntroParagraph(nextContent, eol);
  nextContent = removeGlobalUnreleasedSection(nextContent, eol);

  if (changelogMode === "release") {
    nextContent = markOlderUnreleasedSectionsAsReleasedWith(nextContent, targetVersion);
    nextContent = upsertReleaseSection(nextContent, targetVersion, eol);
  } else if (changelogMode === "unreleased") {
    nextContent = upsertUnreleasedVersionSection(nextContent, targetVersion, eol);
  }

  return ensureTrailingEol(nextContent, eol);
}

function normalizeChangelogTitle(content, eol) {
  if (/^# Changelog$/m.test(content)) {
    return content.replace(/^# Changelog[\s\r\n]*/m, `# Changelog${eol}${eol}`);
  }

  return `# Changelog${eol}${eol}${content.trim()}${eol}`;
}

function removeLegacyIntroParagraph(content, eol) {
  const normalized = content.replace(
    /(?:^|\r?\n)All changes to the project are logged here\.(?=\r?\n|$)/g,
    ""
  );

  return normalized.replace(
    /^# Changelog(?:\r?\n){2,}/,
    `# Changelog${eol}${eol}`
  );
}

function removeGlobalUnreleasedSection(content, eol) {
  const lines = content.split(/\r?\n/);
  const nextLines = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line === "## [Unreleased]") {
      index += 1;

      while (index < lines.length) {
        const currentLine = lines[index];

        if (/^## \[/.test(currentLine) || currentLine === "---") {
          break;
        }

        index += 1;
      }

      while (index < lines.length && lines[index] === "---") {
        index += 1;
      }

      while (index < lines.length && lines[index].trim() === "") {
        index += 1;
      }

      continue;
    }

    nextLines.push(line);
    index += 1;
  }

  return nextLines.join(eol).trimEnd();
}

function getChangelogSectionVersion(targetVersion) {
  const [stablePart] = String(targetVersion).split("-");
  return normalizeStableVersion(stablePart);
}

function compareStableVersions(leftVersion, rightVersion) {
  const left = normalizeStableVersion(leftVersion)
    .split(".")
    .map((value) => Number(value));
  const right = normalizeStableVersion(rightVersion)
    .split(".")
    .map((value) => Number(value));

  for (let index = 0; index < 3; index += 1) {
    if (left[index] < right[index]) {
      return -1;
    }

    if (left[index] > right[index]) {
      return 1;
    }
  }

  return 0;
}

function markOlderUnreleasedSectionsAsReleasedWith(content, targetVersion) {
  const releaseVersion = getChangelogSectionVersion(targetVersion);

  return content.replace(
    /^## \[(\d+\.\d+\.\d+)\] - Unreleased$/gm,
    (match, version) => {
      if (compareStableVersions(version, releaseVersion) < 0) {
        return buildVersionSectionHeader(version, `Released with ${releaseVersion}`);
      }

      return match;
    }
  );
}

function buildVersionSectionHeader(version, suffix) {
  return `## [${version}] - ${suffix}`;
}

function buildVersionSectionRegex(version) {
  return new RegExp(
    `^## \\[${escapeRegExp(version)}\\] - .*$`,
    "m"
  );
}

function hasVersionSection(content, version) {
  return buildVersionSectionRegex(version).test(content);
}

function upsertUnreleasedVersionSection(content, targetVersion, eol) {
  const changelogVersion = getChangelogSectionVersion(targetVersion);
  const sectionHeader = buildVersionSectionHeader(changelogVersion, "Unreleased");
  const sectionContent = [
    sectionHeader,
    "### Changed",
    "- Describe pending changes here.",
    "",
    "---",
    "",
  ].join(eol);
  const existingHeaderPattern = buildVersionSectionRegex(changelogVersion);

  if (existingHeaderPattern.test(content)) {
    return content.replace(existingHeaderPattern, sectionHeader);
  }

  const firstVersionIndex = content.search(/^## \[.+\] - .+$/m);

  if (firstVersionIndex >= 0) {
    return (
      content.slice(0, firstVersionIndex).trimEnd() +
      eol +
      eol +
      sectionContent +
      content.slice(firstVersionIndex).trimStart()
    );
  }

  return `${content.trimEnd()}${eol}${eol}${sectionContent}`;
}

function upsertReleaseSection(content, targetVersion, eol) {
  const changelogVersion = getChangelogSectionVersion(targetVersion);
  const releaseHeader = buildVersionSectionHeader(
    changelogVersion,
    formatLocalDate(new Date())
  );
  const releaseSection = [
    releaseHeader,
    "### Changed",
    "- Describe release changes here.",
    "",
    "---",
    "",
  ].join(eol);
  const existingHeaderPattern = buildVersionSectionRegex(changelogVersion);

  if (existingHeaderPattern.test(content)) {
    return content.replace(existingHeaderPattern, releaseHeader);
  }

  const firstReleaseIndex = content.search(/^## \[.+\] - .+$/m);

  if (firstReleaseIndex >= 0) {
    return (
      content.slice(0, firstReleaseIndex).trimEnd() +
      eol +
      eol +
      releaseSection +
      content.slice(firstReleaseIndex).trimStart()
    );
  }

  return `${content.trimEnd()}${eol}${eol}${releaseSection}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  const currentContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const eol = detectEol(currentContent);
  const nextContent = `${JSON.stringify(value, null, 2)}\n`.replace(/\n/g, eol);
  fs.writeFileSync(filePath, nextContent);
}

function detectEol(content) {
  return content.includes("\r\n") ? "\r\n" : "\n";
}

function ensureTrailingEol(content, eol) {
  return `${content.replace(/\r?\n?$/, "")}${eol}`;
}
