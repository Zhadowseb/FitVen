#!/usr/bin/env node
// Says out loud that the privacy policy is not finished.
//
// The text in src/Resources/Legal/privacyPolicy.js is a skeleton with legal
// statements left blank. It is shown to every user on their next launch and
// they are asked to agree to it, so shipping it half-written is worse than the
// gap it was meant to close.
//
// This does not fail while the policy is obviously a draft - that would leave
// npm test red for every unrelated change. It fails once PRIVACY_POLICY_URL is
// filled in, which is the moment somebody has declared the policy real.

const path = require("path");
const fs = require("fs");

const root = path.resolve(__dirname, "..");
const policyFile = path.join(root, "src", "Resources", "Legal", "privacyPolicy.js");
const source = fs.readFileSync(policyFile, "utf8");

const PLACEHOLDER = "[SKAL UDFYLDES]";
const placeholderCount = source.split(PLACEHOLDER).length - 1;
const urlMatch = source.match(/PRIVACY_POLICY_URL = "([^"]*)"/);
const publicUrl = urlMatch?.[1] ?? "";

if (placeholderCount === 0 && publicUrl) {
  console.log("Privacy policy checks passed (finished, public URL set).");
  process.exit(0);
}

if (placeholderCount > 0 && publicUrl) {
  console.error(
    `The privacy policy is published at ${publicUrl} but still has ` +
      `${placeholderCount} unfilled placeholder(s) in ${path.relative(root, policyFile)}.`
  );
  process.exit(1);
}

const lines = [
  "",
  "  ┌────────────────────────────────────────────────────────────────┐",
  "  │  THE PRIVACY POLICY IS NOT FINISHED. DO NOT SHIP THIS BUILD.   │",
  "  └────────────────────────────────────────────────────────────────┘",
  "",
];

if (placeholderCount > 0) {
  lines.push(
    `  ${placeholderCount} statement(s) marked ${PLACEHOLDER} still have to be written`,
    "  by a person, in src/Resources/Legal/privacyPolicy.js."
  );
}

if (!publicUrl) {
  lines.push(
    "",
    "  PRIVACY_POLICY_URL is empty. Google Play requires the policy at a",
    "  public address, and the same address in the Play Console listing."
  );
}

lines.push(
  "",
  "  This check turns into a hard failure the moment PRIVACY_POLICY_URL is",
  "  set, so a published policy cannot keep its placeholders.",
  ""
);

console.warn(lines.join("\n"));
console.log("Privacy policy checks passed (draft, warned).");
