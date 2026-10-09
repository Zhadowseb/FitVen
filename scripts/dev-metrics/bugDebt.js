// S8: old bug debt - the open issues carrying any of the bug labels.
//
// `gh issue list --label a --label b` means a AND b, so index.js asks once per
// label and this merges the answers. An issue with two of the labels is one
// issue.

const { wholeDaysBetween } = require("./dates");

const BUG_LABELS = ["bug", "Fix", "codex-fix"];

// What index.js asks gh for, per label.
const ISSUE_FIELDS = "number,createdAt,state";

// lists: one parsed `gh issue list --json <ISSUE_FIELDS>` answer per label.
function summarizeBugDebt(lists, now, labels = BUG_LABELS) {
  const open = new Map();

  for (const list of lists) {
    for (const issue of Array.isArray(list) ? list : []) {
      if (!issue || !Number.isInteger(issue.number)) continue;
      if (issue.state && String(issue.state).toUpperCase() !== "OPEN") continue;

      open.set(issue.number, issue);
    }
  }

  const created = [...open.values()]
    .map((issue) => Date.parse(issue.createdAt))
    .filter(Number.isFinite);
  const oldest = created.length ? Math.min(...created) : null;

  return {
    open: open.size,
    oldestDays: oldest === null ? null : wholeDaysBetween(oldest, now),
    labels: [...labels],
  };
}

module.exports = { BUG_LABELS, ISSUE_FIELDS, summarizeBugDebt };
