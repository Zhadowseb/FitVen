// Video verification of lifts is gone: from the app, and from the cloud by
// 20261007090000_remove-lift-verification.sql.
//
// The migration is read as text, the way the other migration checks read
// theirs, so this is a floor, not a proof. It was also run twice on a
// throwaway Postgres 17 after the real gym migrations, with a rejected, a
// verified and an unjudged lift: every list then ranked all three.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");
const MIGRATION = "supabase/migrations/20261007090000_remove-lift-verification.sql";
const sql = read(MIGRATION);
// What the migration runs, without its comments.
const code = sql.replace(/--.*$/gm, "");

/* ------------------------------------------------------- what it drops -- */

assert.ok(/^begin;$/m.test(sql) && /^commit;$/m.test(sql), "one transaction");

for (const policy of [
  "Authenticated users can read lift videos",
  "Centre members can read lift videos",
  "Users can upload their own lift videos",
  "Users can replace their own lift videos",
  "Users can delete their own lift videos",
]) {
  assert.ok(code.includes(`drop policy if exists "${policy}" on storage.objects;`), `drops "${policy}"`);
}
assert.ok(
  code.indexOf('drop policy if exists "Centre members can read lift videos"') <
    code.indexOf("drop function if exists private.can_watch_lift_video(text);"),
  "the read policy goes before the function it calls"
);

for (const statement of [
  "drop function if exists public.gym_lift_verification_queue(bigint);",
  "drop function if exists public.request_lift_verification(bigint);",
  "drop function if exists private.can_watch_lift_video(text);",
  "drop table if exists public.gym_lift_vote;",
  "drop function if exists private.gym_lift_vote_before_insert();",
  "drop function if exists private.gym_lift_vote_recount();",
  "drop function if exists private.trains_at_gym(uuid, bigint);",
  "drop trigger if exists gym_lift_reject_foreign_video on public.gym_lift;",
  "drop function if exists private.gym_lift_reject_foreign_video();",
  "drop index if exists public.gym_lift_national_idx;",
  "drop index if exists public.gym_lift_video_path_idx;",
  "alter table public.gym_lift drop column if exists video_path;",
  "alter table public.gym_lift drop column if exists video_status;",
  "alter table public.gym_lift drop column if exists approvals;",
  "alter table public.gym_lift drop column if exists rejections;",
]) {
  assert.ok(code.includes(statement), `runs: ${statement}`);
}
assert.ok(
  /delete from public\.notification_events\s+where event_type = 'lift_verification_requested';/.test(code),
  "the old verification notifications go (their inbox rows with them)"
);

// Kept: the block check other features use, and the files, which the owner
// deletes in the dashboard - Supabase refuses SQL deletes in storage.
assert.ok(!/drop function[^;]*blocked_between/.test(code), "blocked_between is shared and stays");
assert.ok(!/\b(delete from|drop table|truncate)\s+storage\./i.test(code), "no SQL delete in storage");
assert.ok(/Empty the bucket and delete it in the dashboard/.test(sql), "the header says what is done by hand");

/* ------------------------------------------------ what is left reads none -- */

// Every function the migration writes: none reads a video column any more.
const bodies = [...code.matchAll(/create (?:or replace )?function[\s\S]*?\n\$\$;/g)].map((match) => match[0]);
assert.ok(bodies.length >= 6, `the migration writes the functions it changes, found ${bodies.length}`);
for (const body of bodies) {
  const name = body.match(/function ([\w.]+)\(/)[1];
  assert.ok(
    !/video_status|approvals|rejections|gym_lift_vote|only_video|video_path/.test(body),
    `${name} no longer reads verification`
  );
}
for (const name of [
  "private.gym_lift_before_insert",
  "private.gym_lift_before_update",
  "private.ranked_lifts",
  "public.public_profile",
  "public.gym_scope_summary",
  "private.category_rows",
]) {
  assert.ok(bodies.some((body) => body.includes(`function ${name}(`)), `restates ${name}`);
}

// The update trigger keeps what was not about the video.
const beforeUpdate = bodies.find((body) => body.includes("function private.gym_lift_before_update("));
for (const kept of [
  "new.previous_weight_kg := old.weight_kg;",
  "new.previous_weight_kg := old.previous_weight_kg;",
  "new.user_id := old.user_id;",
  "new.gym_id := old.gym_id;",
  "new.exercise_id := old.exercise_id;",
  "new.created_at := old.created_at;",
]) {
  assert.ok(beforeUpdate.includes(kept), `the update trigger still runs ${kept}`);
}

// ranked_lifts changes its columns, so it is dropped first, and the country
// holds each person once, at their best.
const ranked = bodies.find((body) => body.includes("function private.ranked_lifts("));
assert.ok(
  code.indexOf("drop function if exists private.ranked_lifts(uuid, bigint, bigint, text, text);") <
    code.indexOf("create function private.ranked_lifts("),
  "ranked_lifts is dropped before it is created again"
);
assert.ok(/distinct on \(keyed\.user_id, keyed\.exercise_id\)/.test(ranked), "the country: one row per person");
assert.ok(!/rejected/.test(ranked), "a rejected lift ranks like any other");
assert.ok(
  code.includes("create index if not exists gym_lift_exercise_weight_idx\n  on public.gym_lift (exercise_id, weight_kg desc);"),
  "the country's list keeps an index, without the verified condition"
);

const profile = bodies.find((body) => body.includes("function public.public_profile("));
assert.ok(profile.includes("'rank', best.rank,"), "every record has its rank");

const categories = bodies.find((body) => body.includes("function private.category_rows("));
assert.ok(categories.includes("and logged_set.reps = 1"), "Powerlifting still counts singles");
assert.ok(!categories.includes("judged"), "and leaves no rejected single out");

// The signature of category_rows is the one the rest of 20260929090000 calls.
assert.ok(
  code.includes(
    "revoke all on function private.category_rows(uuid, text, text, text, text, bigint, text, jsonb, boolean)"
  ),
  "category_rows keeps its signature"
);

/* ------------------------------------------------------------ the ledger -- */

assert.ok(
  read("supabase/migrations/README.md").includes("| `20261007090000_remove-lift-verification.sql` |"),
  "the ledger names the migration"
);

/* --------------------------------------------------------------- the app -- */

const gymService = read("src/Services/gymService.js");
for (const gone of ["gym_lift_verification_queue", "request_lift_verification", "gym_lift_vote", "lift-videos", "video_status"]) {
  assert.ok(!gymService.includes(gone), `gymService no longer names ${gone}`);
}
assert.ok(!fs.existsSync(path.join(root, "src/Resources/Components/LiftVerificationSheet")), "the review sheet is gone");

// The privacy policy no longer describes verification videos.
const policy = read("src/Resources/Legal/privacyPolicy.js");
assert.ok(!/verification video/i.test(policy), "the privacy policy has no verification videos");
assert.ok(!/A lift that has been verified/.test(policy), "nor verified lifts");

console.log("Lift verification: the migration drops the votes, the video columns, the queue, the request, the policies and the old notifications; every function it writes reads none of it; the app and the privacy policy name none of it.");
