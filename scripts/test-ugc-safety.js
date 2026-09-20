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

  console.log("UGC safety: report reasons, privacy and filter wiring passed.");
}
