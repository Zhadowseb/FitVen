// The reporting client and the reporting table have to agree, and nothing at
// runtime makes them. `reason` is written by the app and constrained by the
// database: add a reason to one side only and every report carrying it fails
// the insert, in production, on the path a user reaches when something has
// already gone wrong for them.
//
// The term filter is not tested here. It is SQL running inside Postgres, and a
// test that re-implements the matching in JavaScript would only prove the
// re-implementation agrees with itself. What is checked is that the guards are
// wired to the columns that actually hold free text.

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const migrationPath = path.join(
  rootDir,
  "supabase",
  "migrations",
  "20260912220000_ugc-safety.sql"
);
const servicePath = path.join(rootDir, "src", "Services", "socialService.js");
const hidePath = path.join(
  rootDir,
  "supabase",
  "migrations",
  "20260921120000_hide-a-reported-post.sql"
);
const homePath = path.join(rootDir, "src", "Pages", "HomePage", "HomePage.js");
const supportPath = path.join(rootDir, "web", "support", "index.html");
const sheetPath = path.join(
  rootDir,
  "src",
  "Resources",
  "ThemedComponents",
  "ThemedBottomSheet.js"
);

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

function reasonsFromMigration(sql) {
  const match = sql.match(
    /constraint user_reports_reason_known check \(\s*reason in \(([^)]*)\)/
  );

  assert.ok(match, "the migration no longer declares a reason constraint");

  return match[1]
    .split(",")
    .map((value) => value.trim().replace(/^'|'$/g, ""))
    .filter(Boolean)
    .sort();
}

function reasonsFromService(source) {
  const match = source.match(/export const REPORT_REASONS = \[([\s\S]*?)\];/);

  assert.ok(match, "socialService no longer exports REPORT_REASONS");

  return [...match[1].matchAll(/value:\s*"([^"]+)"/g)]
    .map((entry) => entry[1])
    .sort();
}

async function run() {
  const sql = fs.readFileSync(migrationPath, "utf8");
  const service = fs.readFileSync(servicePath, "utf8");

  /* ------------------------------------------------- reasons agree ------ */

  const migrationReasons = reasonsFromMigration(sql);
  const serviceReasons = reasonsFromService(service);

  assert.ok(migrationReasons.length >= 2, "expected several reasons");
  assert.deepStrictEqual(
    serviceReasons,
    migrationReasons,
    "REPORT_REASONS and the user_reports reason constraint have drifted"
  );

  /* ------------------------------------------------- note length -------- */

  const noteLimitMatch = sql.match(
    /user_reports_note_length check \(char_length\(note\) <= (\d+)\)/
  );
  assert.ok(noteLimitMatch, "the migration no longer caps the note length");

  const clientLimitMatch = service.match(
    /export const REPORT_NOTE_MAX_LENGTH = (\d+);/
  );
  assert.ok(clientLimitMatch, "socialService no longer caps the note length");

  assert.strictEqual(
    Number(clientLimitMatch[1]),
    Number(noteLimitMatch[1]),
    "the client trims the note to a different length than the column accepts"
  );

  /* ------------------------------------------------- reports are private */

  // A select policy that is not scoped to the reporter would let the reported
  // person read the report about them, which is the one thing this table must
  // never do.
  assert.ok(
    /create policy "Reporters can view their own reports"[\s\S]*?using \(\(select auth\.uid\(\)\) = reporter_id\)/.test(
      sql
    ),
    "the report select policy is no longer scoped to the reporter"
  );

  assert.ok(
    !/create policy[^;]*on public\.user_reports\s*for (update|delete)/i.test(sql),
    "user_reports gained an update or delete policy - a report is a record"
  );

  /* ------------------------------------------------- filter is wired ---- */

  // The columns named here are the free-text ones. If a new one appears and is
  // not filtered, guideline 1.2 is only half met.
  for (const [table, columns] of [
    ["public.social_post", ["title", "body"]],
    ["public.profiles", ["display_name", "bio"]],
  ]) {
    const triggerMatch = sql.match(
      new RegExp(
        `before insert or update of ([^\\n]+) on ${table.replace(".", "\\.")}`
      )
    );

    assert.ok(triggerMatch, `no term-filter trigger on ${table}`);

    const watched = triggerMatch[1].split(",").map((name) => name.trim());

    for (const column of columns) {
      assert.ok(
        watched.includes(column),
        `${table}.${column} holds free text but the term filter does not watch it`
      );
    }
  }

  // The list must not be readable from the app: knowing the terms is knowing
  // how to route around them.
  assert.ok(
    /revoke all on table public\.blocked_terms from authenticated/.test(sql),
    "blocked_terms is readable by authenticated users"
  );

  assert.ok(
    /create or replace function private\.contains_blocked_term[\s\S]*?security definer/.test(
      sql
    ),
    "the term check is not security definer, so it cannot read the list"
  );

  /* ----------------------------------------- a reported post is hidden ---- */

  // The support page promises that a post reported by two different people
  // leaves the feed straight away. These are the things that promise rests on.
  // A published promise that quietly stops being true is worse than one never
  // made.
  const hideSql = fs.readFileSync(hidePath, "utf8");

  assert.ok(
    /add column if not exists hidden_at timestamptz/.test(hideSql),
    "social_post no longer gains hidden_at"
  );

  assert.ok(
    /count\(distinct report\.reporter_id\)/.test(hideSql),
    "the hide counts reports rather than reporters, so one person can hide any post"
  );

  assert.ok(
    /reporter_count >= 2/.test(hideSql),
    "the threshold for hiding a post is no longer two reporters"
  );

  assert.ok(
    /create or replace function private\.hide_post_when_reported[\s\S]*?security definer/.test(
      hideSql
    ),
    "the hide is not security definer, so the reporter cannot write the column"
  );

  // Without the lock the whole thing is decoration: social-posts.sql grants
  // update on the whole table to authenticated, and the update policy only
  // asks whether the row is yours - so the author of a reported post could
  // send hidden_at: null and put it back in the feed themselves.
  assert.ok(
    /before update of hidden_at on public\.social_post/.test(hideSql),
    "nothing guards hidden_at against a plain update from the client"
  );

  assert.ok(
    /create or replace function private\.reject_manual_post_hide[\s\S]*?raise exception/.test(
      hideSql
    ),
    "the guard on hidden_at no longer refuses anything"
  );

  // The guard has to refuse everyone and let the trigger announce itself, the
  // way the gym_lift recount does. A guard that trusted the definer would be
  // no guard at all.
  assert.ok(
    /set_config\('fitven\.social_post_hide', 'on', true\)/.test(hideSql) &&
      /current_setting\('fitven\.social_post_hide', true\)/.test(hideSql),
    "the hide and its guard no longer agree on how the trigger announces itself"
  );

  // The author keeps seeing their own post. One that vanishes for the person
  // who wrote it reads as a bug, and they are the one person the hiding is not
  // protecting.
  const policyMatch = hideSql.match(
    /create policy "Social posts are viewable by owners and allowed audience"[\s\S]*?\n\);/
  );

  assert.ok(policyMatch, "the read policy is no longer restated with the column");

  assert.ok(
    /author_id = \(select auth\.uid\(\)\)/.test(policyMatch[0]),
    "the read policy stopped letting an author see their own post"
  );

  assert.ok(
    /hidden_at is null/.test(policyMatch[0]),
    "the read policy does not hide a hidden post from anybody"
  );

  // Two accounts could otherwise hide any post by anyone: reported_post_id is
  // deliberately not a foreign key, so without this nothing ever checked that
  // the post named belongs to the account named.
  assert.ok(
    /post\.author_id = report\.reported_user_id/.test(hideSql),
    "the hide counts reports that name somebody else's post"
  );

  assert.ok(
    /create or replace function private\.reject_mismatched_post_report[\s\S]*?raise exception/.test(
      hideSql
    ),
    "a report naming a post its author did not write is accepted again"
  );

  // The wait for the sheet to go cannot hang on Modal.onDismiss: React Native
  // fires that on iOS only, and the report would be a dead button on Android.
  const sheet = fs.readFileSync(sheetPath, "utf8");

  assert.ok(
    !/<Modal[\s\S]*?onDismiss=/.test(sheet),
    "the sheet is back to signalling dismissal through an iOS-only prop"
  );

  assert.ok(
    /wasVisibleRef/.test(sheet) && /onDismissRef\.current\?\.\(\)/.test(sheet),
    "the sheet no longer tells anybody when it has gone"
  );

  /* ------------------------------------------ the report can be reached ---- */

  // A report nobody can file is not a reporting feature. Guideline 1.2 asks
  // for the way in, not for the table behind it.
  const home = fs.readFileSync(homePath, "utf8");

  assert.ok(
    /Report post/.test(home) && /socialService\.reportUser/.test(home),
    "the feed no longer offers to report a post"
  );

  assert.ok(
    /postId: post\.id/.test(home),
    "the feed reports the account rather than the post"
  );

  // The menu used to open only on the author's own post. Opening it for
  // everybody is what made the report reachable, and the author's two actions
  // have to survive it.
  assert.ok(
    /onOpenOptions=\{handleOpenWorkoutSummaryOptions\}/.test(home),
    "the post menu is conditional again, so somebody else's post has no menu"
  );

  for (const label of ["Edit post", "Delete post"]) {
    assert.ok(
      home.includes(label),
      `the author lost "${label}" when the report was added`
    );
  }

  assert.ok(
    /Reporting a post or an account/.test(fs.readFileSync(supportPath, "utf8")),
    "the support page no longer explains how to report"
  );

  console.log(
    "UGC safety: report reasons, privacy, filter wiring, hiding and the way in passed."
  );
}
