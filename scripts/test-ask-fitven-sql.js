// Ask FitVen's database side: what the AI may read, the monthly questions, the yes.
//
// Two parts.
//
// 1. Always: the migration is read as text and every function in schema `ai` has
//    to keep the rules in docs/ASK-FITVEN.md - runs as the caller, empty
//    search_path, no user id argument, filters on (select auth.uid()) on every
//    owned table it reads, only reads, callable by `authenticated` and no one
//    else, nothing about sickness.
// 2. When PGlite (Postgres compiled to WebAssembly) can be loaded: the migration
//    and scripts/ask-fitven-isolation.sql are RUN against a small copy of the
//    synced tables with the row level security the real ones have - including
//    the follower policy that lets a follower read a followed person's workouts -
//    with A following B and B having trained today. It is not a PostgreSQL
//    check of the real project (the tables are copies, built from the columns
//    the app's sync writes); scripts/ask-fitven-isolation.sql is that check, run
//    in the SQL editor once the migration has run. Add the package somewhere
//    resolvable (`npm i --no-save @electric-sql/pglite`, or NODE_PATH) to run
//    this part; without it, it says it was skipped.

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/20261026090000_ask-fitven.sql");
const isolation = read("scripts/ask-fitven-isolation.sql");

/* ------------------------------------------------------- the rules, as text -- */

const code = (sql) => sql.replace(/--[^\n]*/g, "");
const body = code(migration);
const functions = [...body.matchAll(/create or replace function (ai|public)\.(\w+)\(([\s\S]*?)\)\s*returns ([\s\S]*?)\$\$([\s\S]*?)\$\$;/g)].map(
  (match) => ({ schema: match[1], name: match[2], args: match[3], returns: match[4], header: match[0].slice(0, match[0].indexOf("$$")), source: match[5] })
);
const aiFunctions = functions.filter((entry) => entry.schema === "ai");

assert.deepStrictEqual(
  aiFunctions.map((entry) => entry.name).sort(),
  ["daily_steps", "exercise_history", "list_workouts", "personal_records", "profile_summary", "program_overview", "weekly_volume", "workout_detail"],
  "the eight tools, and no other function in schema ai"
);

const OWNED = [
  ["public.workout_type_instance", /workout\b/],
  ["public.exercise_instance", /instance\b/],
  ['public."set"', /logged_set\b/],
  ['public."Program"', /program\b/],
  ['public."Mesocycle"', /mesocycle\b/],
  ['public."Microcycle"', /microcycle\b/],
  ['public."Day"', /\bday\b/],
  ["public.daily_steps", /daily\b/],
  ["public.profile_private", /private_profile\b/],
];

for (const fn of aiFunctions) {
  assert.ok(/security invoker/.test(fn.header), `${fn.name} runs as the caller`);
  assert.ok(/set search_path = ''/.test(fn.header), `${fn.name} has an empty search_path`);
  assert.ok(/\bstable\b/.test(fn.header), `${fn.name} is stable: it reads only`);
  assert.ok(!/\buuid\b/i.test(fn.args), `${fn.name} takes no user id`);
  assert.ok(/v_user uuid := \(select auth\.uid\(\)\)/.test(fn.source), `${fn.name} reads the caller from auth.uid()`);
  assert.ok(!/\b(insert|update|delete|truncate|drop|alter)\b/i.test(fn.source), `${fn.name} writes nothing`);
  assert.ok(!/sick/i.test(fn.source + fn.name), `${fn.name} leaves sickness out`);

  // Every owned table it touches is filtered on the caller.
  for (const [table, alias] of OWNED) {
    const touches = fn.source.includes(table);

    if (!touches) continue;

    const refs = [...fn.source.matchAll(new RegExp(`(?:from|join)\\s+${table.replace(/[.\\"]/g, "\\$&")}\\s+(\\w+)`, "g"))].map((match) => match[1]);

    assert.ok(refs.length > 0, `${fn.name}: ${table} is read through an alias`);

    for (const ref of refs) {
      assert.ok(
        new RegExp(`\\b${ref}\\.user_id = v_user\\b`).test(fn.source),
        `${fn.name}: ${table} (as ${ref}) is not filtered on the caller`
      );
    }
  }

  // Granted to signed-in people only.
  const signature = `ai.${fn.name}\\(`;

  assert.ok(new RegExp(`revoke all on function ${signature}[^;]*from public, anon;`).test(body), `${fn.name} is revoked from public and anon`);
  assert.ok(new RegExp(`grant execute on function ${signature}[^;]*to authenticated;`).test(body), `${fn.name} is granted to authenticated`);
  assert.ok(!new RegExp(`grant execute on function ${signature}[^;]*to (public|anon)`).test(body));
}

assert.ok(/revoke all on schema ai from public, anon;/.test(body) && /grant usage on schema ai to authenticated;/.test(body), "the schema itself is closed to anon");
assert.ok(/grant execute on function public\.ai_refund_question\(uuid, text\) to service_role;/.test(body) && /revoke all on function public\.ai_refund_question\(uuid, text\) from public, anon, authenticated;/.test(body), "only the service role may give a question back");
assert.ok(!/to anon/.test(body.replace(/revoke[^;]*;/g, "")), "nothing is granted to anon");
assert.ok(/ai_usage[\s\S]*?enable row level security/.test(body) && /revoke all on public\.ai_usage from public, anon, authenticated;[\s\S]*grant select on public\.ai_usage to authenticated;/.test(body), "usage is read-only for the person");
assert.ok(/ai_consent[\s\S]*?enable row level security/.test(body) && /grant select on public\.ai_consent to authenticated;/.test(body));
assert.ok(/public\.ai_tier_limit\(p_tier text\)[\s\S]*when 'haiku' then 10 when 'sonnet' then 5 when 'opus' then 2/.test(body), "10 / 5 / 2 a month");
assert.ok(/Europe\/Copenhagen/.test(body), "the month is Copenhagen's");
assert.ok(/ledger|20261026090000_ask-fitven\.sql/.test(read("supabase/migrations/README.md")), "the migration is in the ledger");
assert.ok(/set_config\('ask\.me'/.test(isolation) && /rollback;\s*$/.test(isolation.trim() + "\n"), "the isolation script names its account and rolls back");

/* ------------------------------------------------ the migration, run for real -- */

let PGlite = null;

try {
  ({ PGlite } = require("@electric-sql/pglite"));
} catch {
  try {
    ({ PGlite } = require(require.resolve("@electric-sql/pglite", { paths: [process.cwd(), ...(process.env.NODE_PATH ?? "").split(path.delimiter).filter(Boolean)] })));
  } catch {
    PGlite = null;
  }
}

const A = "aaaaaaaa-0000-0000-0000-00000000000a";
const B = "bbbbbbbb-0000-0000-0000-00000000000b";
const C = "cccccccc-0000-0000-0000-00000000000c";

const MIMIC = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create table public.profiles (id uuid primary key);
create table public.user_follows (follower_id uuid not null, following_id uuid not null);
create table public."Program" (id bigserial primary key, user_id uuid not null, program_name text, status text, start_date date, deleted_at timestamptz, is_deleting boolean not null default false);
create table public."Mesocycle" (id bigserial primary key, user_id uuid not null, cloud_program_id bigint, mesocycle_number int, weeks int, focus text, deleted_at timestamptz, is_deleting boolean not null default false);
create table public."Microcycle" (id bigserial primary key, user_id uuid not null, cloud_mesocycle_id bigint, microcycle_number int, focus text, deleted_at timestamptz, is_deleting boolean not null default false);
create table public."Day" (id bigserial primary key, user_id uuid not null, cloud_microcycle_id bigint, weekday text, date date, deleted_at timestamptz, is_deleting boolean not null default false);
create table public.workout_type_instance (id bigserial primary key, user_id uuid not null, cloud_day_id bigint, workout_type text, date date, label text, done boolean, elapsed_time int, deleted_at timestamptz, is_deleting boolean not null default false);
create table public.exercise_instance (id bigserial primary key, user_id uuid not null, cloud_workout_type_instance_id bigint, exercise_name text, exercise_order int, note text, deleted_at timestamptz, is_deleting boolean not null default false);
create table public."set" (id bigserial primary key, user_id uuid not null, cloud_exercise_instance_id bigint, set_number int, personal_record boolean, weight numeric, reps int, done boolean, failed boolean, set_type text, rpe numeric, deleted_at timestamptz, is_deleting boolean not null default false);
create table public.daily_steps (user_id uuid not null, day date not null, steps int not null, source text not null, primary key (user_id, day));
create table public.profile_private (user_id uuid primary key, split_names jsonb);

do $$
declare t text;
begin
  foreach t in array array['"Program"', '"Mesocycle"', '"Microcycle"', '"Day"', 'workout_type_instance', 'exercise_instance', '"set"', 'daily_steps', 'profile_private'] loop
    execute format('alter table public.%s enable row level security', t);
    execute format('create policy owner on public.%s for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('grant select on public.%s to authenticated', t);
  end loop;
end $$;

-- The policy that opens rows to other people on purpose: a follower reads a
-- followed person's workouts from yesterday to tomorrow.
create policy "Followed workout activity is viewable" on public.workout_type_instance
  for select to authenticated
  using (exists (select 1 from public.user_follows f
                 where f.follower_id = (select auth.uid()) and f.following_id = workout_type_instance.user_id)
         and date between current_date - 1 and current_date + 1);
grant select on public.profiles, public.user_follows to authenticated;
`;

async function live() {
  const db = new PGlite();

  await db.exec(MIMIC);
  await db.exec(migration);

  // A trains Monday (two weeks ago) and last week; B trains today; C has a program.
  const today = "current_date";
  const seed = `
    insert into public.profiles values ('${A}'), ('${B}'), ('${C}');
    insert into public.user_follows values ('${A}', '${B}');

    insert into public."Program" (user_id, program_name, status, start_date) values ('${A}', 'A program', 'ACTIVE', current_date - 30), ('${C}', 'C program', 'ACTIVE', current_date - 30);
    insert into public."Mesocycle" (user_id, cloud_program_id, mesocycle_number, weeks, focus) values ('${A}', 1, 1, 4, 'Strength'), ('${C}', 2, 1, 4, 'Secret');
    insert into public."Microcycle" (user_id, cloud_mesocycle_id, microcycle_number, focus) values ('${A}', 1, 1, 'Week one'), ('${C}', 2, 1, 'Secret week');
    insert into public."Day" (user_id, cloud_microcycle_id, weekday, date) values ('${A}', 1, 'Monday', current_date), ('${C}', 2, 'Monday', current_date);

    -- A: three finished workouts of Bench Press (ids 1-3), B: one today (id 4), C: one (id 5)
    insert into public.workout_type_instance (user_id, cloud_day_id, workout_type, date, label, done, elapsed_time) values
      ('${A}', 1, 'Resistance', current_date - 14, 'Push A', true, 3600),
      ('${A}', 1, 'Resistance', current_date - 7, 'Push A', true, 3300),
      ('${A}', 1, 'Resistance', current_date - 1, 'Push A', true, 3000),
      ('${B}', null, 'Resistance', ${today}, 'B secret push', true, 3600),
      ('${C}', 2, 'Resistance', current_date - 2, 'C secret', true, 3600);
    insert into public.exercise_instance (user_id, cloud_workout_type_instance_id, exercise_name, exercise_order, note) values
      ('${A}', 1, 'Bench Press', 1, 'felt heavy'), ('${A}', 2, 'Bench Press', 1, null), ('${A}', 3, 'Bench Press', 1, null),
      ('${B}', 4, 'Bench Press', 1, 'B note'), ('${C}', 5, 'Squat', 1, null);
    insert into public."set" (user_id, cloud_exercise_instance_id, set_number, personal_record, weight, reps, done, failed, set_type) values
      ('${A}', 1, 1, false, 60, 5, true, false, 'warmup'), ('${A}', 1, 2, false, 100, 5, true, false, 'working'),
      ('${A}', 2, 1, false, 100, 5, true, false, 'working'), ('${A}', 2, 2, true, 105, 5, true, false, 'working'),
      ('${A}', 3, 1, false, 105, 5, true, false, 'working'),
      ('${B}', 4, 1, true, 200, 3, true, false, 'working'),
      ('${C}', 5, 1, true, 300, 3, true, false, 'working');
    insert into public.daily_steps values ('${A}', current_date - 1, 8000, 'health'), ('${B}', current_date - 1, 99999, 'health'), ('${C}', current_date - 1, 77777, 'health');
    insert into public.profile_private values ('${A}', '["Push A","Pull"]'::jsonb);
  `;

  await db.exec(seed);

  async function as(user, sql, role = "authenticated") {
    await db.exec(`begin; set local role ${role}; select set_config('request.jwt.claims', '{"sub":"${user}","role":"${role}"}', true);`);

    try {
      const result = await db.query(sql);

      return result.rows;
    } finally {
      await db.exec("rollback");
    }
  }

  const one = async (user, sql) => (await as(user, sql))[0]?.r ?? null;

  // The follower policy really does open B's workout to A - the reason for all this.
  const visible = await as(A, "select count(*)::int as n from public.workout_type_instance where user_id = '" + B + "'");

  assert.strictEqual(visible[0].n, 1, "the test needs row level security alone to leak B's workout to its follower");

  // Every function, as A: only A's rows.
  const listed = await one(A, "select ai.list_workouts(current_date - 730, current_date + 1, 60) as r");

  assert.deepStrictEqual(listed.workouts.map((entry) => entry.id).sort(), [1, 2, 3], "A's workouts, and not B's one from today");
  assert.strictEqual(listed.workouts[0].label, "Push A");
  assert.strictEqual(listed.workouts[0].sets_done, 1, "a warm-up is not a set done");
  assert.deepStrictEqual(listed.workouts[0].exercises, ["Bench Press"]);

  assert.strictEqual(await one(A, `select ai.workout_detail(4) as r`), null, "B's workout id, asked for by A");
  assert.strictEqual(await one(A, `select ai.workout_detail(5) as r`), null, "C's workout id, asked for by A");
  assert.strictEqual((await one(A, `select ai.workout_detail(2) as r`)).exercises[0].sets.length, 2);
  assert.strictEqual(await one(B, `select ai.workout_detail(1) as r`), null, "and the other way round");
  assert.strictEqual((await one(B, `select ai.workout_detail(4) as r`)).exercises[0].note, "B note");

  const history = await one(A, `select ai.exercise_history('bench press', null, null) as r`);

  assert.strictEqual(history.sessions.length, 3, "A's three Bench Press sessions, whatever the case of the name");
  assert.strictEqual(JSON.stringify(history).includes("200"), false, "B's 200 kg is nowhere");
  assert.strictEqual(history.sessions[0].est_1rm, 118.1, "Brzycki: 105 x 5 -> 105 * 36 / 32");
  assert.strictEqual(history.sessions[2].top_set.weight, 100);
  assert.strictEqual(await one(C, `select ai.exercise_history('Bench Press', null, null) as r`).then((r) => r.sessions.length), 0, "C has done no Bench Press");

  const records = await one(A, `select ai.personal_records(null) as r`);

  assert.deepStrictEqual(records.records.map((entry) => [entry.exercise, entry.reps, entry.weight]), [["Bench Press", 5, 105]], "only A's own records");

  const volume = await one(A, `select ai.weekly_volume(null, null) as r`);

  assert.ok(volume.weeks.length >= 1 && !JSON.stringify(volume).includes("Squat"), "only A's exercises");

  const program = await one(A, `select ai.program_overview() as r`);

  assert.strictEqual(program.program.name, "A program");
  assert.ok(!JSON.stringify(program).includes("Secret") && !JSON.stringify(program).includes("C program"), "C's program is nowhere");
  assert.strictEqual(program.blocks[0].microcycles[0].days[0].workouts[0].label, "Push A");

  const steps = await one(A, `select ai.daily_steps(null, null) as r`);

  assert.deepStrictEqual(steps.days.map((day) => day.steps), [8000], "only A's steps");

  const summary = await one(A, `select ai.profile_summary(current_date) as r`);

  assert.strictEqual(summary.workouts_4w, 3);
  assert.strictEqual(summary.active_program, "A program");
  assert.deepStrictEqual(summary.split_names, ["Push A", "Pull"]);
  assert.strictEqual(summary.unit, "kg");

  // Ranges are capped.
  const capped = await one(A, `select ai.list_workouts('1990-01-01', '2100-01-01', 100000) as r`);

  assert.ok(capped.workouts.length <= 60);

  // anon is refused by every function; no function accepts a user id.
  for (const call of ["ai.profile_summary(null)", "ai.list_workouts(null, null, 5)", "ai.workout_detail(1)", "ai.exercise_history('x', null, null)", "ai.personal_records(null)", "ai.weekly_volume(null, null)", "ai.program_overview()", "ai.daily_steps(null, null)"]) {
    await assert.rejects(as(A, `select ${call}`, "anon"), /permission denied/, `anon can call ${call}`);
  }

  // Without a login the functions answer nothing.
  await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claims', '', true);`);
  assert.strictEqual((await db.query("select ai.list_workouts(null, null, 5) as r")).rows[0].r, null);
  await db.exec("rollback");

  // The questions: 10 / 5 / 2 a month, per tier; counted for the caller only.
  const claim = (user, tier) => one(user, `select public.ai_claim_question('${tier}') as r`);

  // (each claim is its own transaction here, so it is kept by committing)
  async function claimKept(user, tier) {
    await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"${user}"}', true);`);
    const result = (await db.query(`select public.ai_claim_question('${tier}') as r`)).rows[0].r;

    await db.exec("commit");

    return result;
  }

  assert.deepStrictEqual(await claimKept(A, "opus"), { allowed: true, used: 1, limit: 2 });
  assert.deepStrictEqual(await claimKept(A, "opus"), { allowed: true, used: 2, limit: 2 });
  assert.deepStrictEqual(await claimKept(A, "opus"), { allowed: false, used: 2, limit: 2 }, "the third Opus question of the month");

  for (let n = 1; n <= 5; n += 1) assert.strictEqual((await claimKept(A, "sonnet")).allowed, true);

  assert.strictEqual((await claimKept(A, "sonnet")).allowed, false, "the sixth Sonnet question");

  for (let n = 1; n <= 10; n += 1) assert.strictEqual((await claimKept(A, "haiku")).allowed, true);

  assert.strictEqual((await claimKept(A, "haiku")).allowed, false, "the eleventh Haiku question");
  assert.deepStrictEqual(await claimKept(B, "opus"), { allowed: true, used: 1, limit: 2 }, "B's questions are B's own");

  const usage = await one(A, "select public.ai_usage_summary() as r");

  assert.deepStrictEqual(usage.tiers, { haiku: { used: 10, limit: 10 }, sonnet: { used: 5, limit: 5 }, opus: { used: 2, limit: 2 } });
  assert.match(usage.month, /^\d{4}-\d{2}$/);
  assert.strictEqual((await as(A, "select count(*)::int as n from public.ai_usage"))[0].n, 3, "A reads only A's usage rows");

  await assert.rejects(as(A, "select public.ai_claim_question('gpt')"), /unknown tier/);
  await assert.rejects(as(A, "select public.ai_claim_question('opus')", "anon"), /permission denied/, "anon cannot count a question");
  await assert.rejects(as(A, `select public.ai_refund_question('${A}', 'opus')`), /permission denied/, "a person cannot refund themselves");
  await assert.rejects(as(A, `update public.ai_usage set questions = 0`), /permission denied/, "no direct writes");
  await assert.rejects(as(A, `insert into public.ai_consent (user_id) values ('${A}')`), /permission denied/);

  // Only the service role gives one back.
  await db.exec(`begin; set local role service_role; select public.ai_refund_question('${A}', 'opus'); commit;`);
  assert.strictEqual((await one(A, "select public.ai_usage_summary() as r")).tiers.opus.used, 1, "refunded by the service role");
  await db.exec(`begin; set local role service_role; select public.ai_refund_question('${A}', 'opus'); select public.ai_refund_question('${A}', 'opus'); commit;`);
  assert.strictEqual((await one(A, "select public.ai_usage_summary() as r")).tiers.opus.used, 0, "never below nothing");

  // The yes.
  assert.strictEqual(await one(A, "select public.ai_get_consent() as r"), null);

  await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"${A}"}', true); select public.ai_set_consent(true); commit;`);
  assert.ok(await one(A, "select public.ai_get_consent() as r"), "A said yes");
  assert.strictEqual(await one(B, "select public.ai_get_consent() as r"), null, "B did not");
  assert.strictEqual((await as(A, "select count(*)::int as n from public.ai_consent"))[0].n, 1);

  await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"${A}"}', true); select public.ai_set_consent(false); commit;`);
  assert.strictEqual(await one(A, "select public.ai_get_consent() as r"), null, "and took it back");

  // The real thing: the isolation script, as A, against the same data.
  await db.exec(isolation.replace("00000000-0000-0000-0000-000000000000", A));
  await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"${A}"}', true); commit;`).catch(() => {});

  // ... and as a user with nothing, it refuses to run on the placeholder.
  await assert.rejects(db.exec(isolation), /put an account id/);

  await db.close();
}

(async () => {
  if (PGlite) {
    await live();
    console.log("Ask FitVen SQL: the rules of the eight functions (read as text), and the migration and isolation script run against copies of the synced tables with a follower - only the caller's rows, anon refused, 10/5/2 questions a month, the refund for the service role alone, the yes.");
  } else {
    console.log("Ask FitVen SQL: the rules of the eight functions (read as text) passed. The live part (PGlite) was skipped: `npm i --no-save @electric-sql/pglite` to run it.");
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
