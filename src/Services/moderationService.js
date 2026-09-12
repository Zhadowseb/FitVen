import { supabase } from "../Database/supaBaseClient";

const CONTENT_REPORTS_TABLE = "content_reports";
const SETUP_MESSAGE =
  "Reporting is not set up in Supabase yet. Run supabase/migrations/20260912120000_content-moderation.sql in the Supabase SQL editor first.";

/**
 * The reasons a report can carry. The ids match the check constraint on
 * content_reports.reason, so adding one here means adding it there too.
 */
export const REPORT_REASONS = [
  {
    id: "harassment",
    label: "Harassment or bullying",
  },
  {
    id: "hate",
    label: "Hate speech",
  },
  {
    id: "sexual",
    label: "Sexual content",
  },
  {
    id: "violence",
    label: "Violence or threats",
  },
  {
    id: "self_harm",
    label: "Self-harm",
  },
  {
    id: "impersonation",
    label: "Impersonation",
  },
  {
    id: "spam",
    label: "Spam",
  },
  {
    id: "other",
    label: "Something else",
  },
];

const REPORT_REASON_IDS = new Set(REPORT_REASONS.map((reason) => reason.id));
export const REPORT_NOTE_MAX_LENGTH = 1000;

function normalizeReportError(error) {
  const message = String(error?.message ?? error ?? "").toLowerCase();

  if (
    message.includes(CONTENT_REPORTS_TABLE) &&
    message.includes("does not exist")
  ) {
    return new Error(SETUP_MESSAGE);
  }

  // The unique index, not a failure: the person has already reported this.
  if (error?.code === "23505") {
    return new Error("You have already reported this.");
  }

  return error;
}

function normalizeNote(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().slice(0, REPORT_NOTE_MAX_LENGTH);
  return trimmed || null;
}

async function fileReport(row) {
  const { error } = await supabase.from(CONTENT_REPORTS_TABLE).insert(row);

  if (error) {
    throw normalizeReportError(error);
  }

  return { reported: true };
}

export async function reportPost({ user, post, reason, note = null } = {}) {
  if (!user?.id) {
    throw new Error("You need to be signed in to report a post.");
  }

  if (!post?.id) {
    throw new Error("That post could not be reported.");
  }

  if (!REPORT_REASON_IDS.has(reason)) {
    throw new Error("Choose a reason for the report.");
  }

  return fileReport({
    reporter_id: user.id,
    target_type: "post",
    target_post_id: post.id,
    // The author too, so a run of reports about one person is visible without
    // joining back through posts they may since have deleted.
    target_user_id: post.author?.id ?? null,
    reason,
    note: normalizeNote(note),
  });
}

export async function reportUser({ user, targetUserId, reason, note = null } = {}) {
  if (!user?.id) {
    throw new Error("You need to be signed in to report an account.");
  }

  if (!targetUserId) {
    throw new Error("That account could not be reported.");
  }

  if (targetUserId === user.id) {
    throw new Error("You cannot report your own account.");
  }

  if (!REPORT_REASON_IDS.has(reason)) {
    throw new Error("Choose a reason for the report.");
  }

  return fileReport({
    reporter_id: user.id,
    target_type: "user",
    target_user_id: targetUserId,
    reason,
    note: normalizeNote(note),
  });
}

/**
 * Whether text may be published.
 *
 * The database refuses a blocked post outright, so this is only here to turn
 * that refusal into a sentence under the field before the user presses Post.
 * It answers yes or no and never says which word it objected to - naming the
 * word is how a list gets learned and routed around.
 *
 * A failure to reach the check is not a refusal: the trigger is still there,
 * so the worst case is the error arriving a second later from the write.
 */
export async function isTextAllowed(text) {
  if (typeof text !== "string" || !text.trim()) {
    return true;
  }

  try {
    const { data, error } = await supabase.rpc("is_text_allowed", {
      candidate: text,
    });

    if (error) {
      console.warn("Content check unavailable:", error);
      return true;
    }

    return data !== false;
  } catch (error) {
    console.warn("Content check failed:", error);
    return true;
  }
}

export const BLOCKED_TEXT_MESSAGE =
  "That wording is not allowed here. Please rephrase and try again.";
