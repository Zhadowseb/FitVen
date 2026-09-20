// A username is `base#1234`, and the four digits are the whole point of them:
// two people can both be `sebastian`, and the code is what tells them apart.
//
// The search box stripped the `#`, so "sebastian#4471" went over as
// "sebastian 4471" and search_profiles closed that up to "sebastian4471",
// which matches nobody. Searching for exactly the person whose username you
// were handed failed, while searching vaguely for "sebastian" worked - the
// opposite of what a username code is for.
//
// The two halves have to agree about `#`, and they are in different languages
// in different repositories of truth, so both are checked here.

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

function loadSearchFilter() {
  const source = read("src/Services/socialService.js");
  const match = source.match(/export function buildSearchFilter[\s\S]*?\n}/);

  assert.ok(match, "socialService no longer exports buildSearchFilter");

  return new Function(`return ${match[0].replace("export function", "function")}`)();
}

async function run() {
  const buildSearchFilter = loadSearchFilter();

  /* ------------------------------------------------ the bug this fixes ---- */

  assert.strictEqual(
    buildSearchFilter("sebastian#4471"),
    "sebastian#4471",
    "the username code no longer survives the search box"
  );

  assert.strictEqual(buildSearchFilter("test#1234"), "test#1234");

  // The partial still works - typing the base before you reach the digits.
  assert.strictEqual(buildSearchFilter("test#"), "test#");
  assert.strictEqual(buildSearchFilter("test"), "test");

  /* ------------------------------------------------ what still gets cleaned */

  assert.strictEqual(buildSearchFilter("@anna"), "anna", "a leading @ should go");
  assert.strictEqual(buildSearchFilter("  spaced  out  "), "spaced out");
  assert.strictEqual(buildSearchFilter("anna.b"), "anna b");
  assert.strictEqual(buildSearchFilter(null), "");
  assert.strictEqual(buildSearchFilter(undefined), "");

  /* ------------------------------------------------ the server agrees ----- */

  // The client can pass `#` all it likes if search_profiles then deletes it.
  const migration = read("supabase/migrations/20260905143000_user-blocks.sql");
  // Not [^,]+ for the first argument: it is coalesce(search_query, ''), and
  // the comma inside it ends the match early. That is how this assertion first
  // failed against SQL it was meant to pass on.
  const sanitiser = migration.match(
    /cleaned_query := regexp_replace\([\s\S]*?'\[\^([^\]]+)\]'/
  );

  assert.ok(sanitiser, "search_profiles no longer sanitises the query the same way");
  assert.ok(
    sanitiser[1].includes("#"),
    "search_profiles strips # from the query, so a full username can never match"
  );

  // And it has to actually compare against the full username, not only the base.
  assert.ok(
    /profile\.username ilike '%' \|\| cleaned_query \|\| '%'/.test(migration),
    "search_profiles no longer matches on the full username"
  );

  console.log("Username search: the code survives the box and the server keeps it.");
}
