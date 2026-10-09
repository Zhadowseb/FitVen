// The admin flag's guard has to run as its caller.
//
// private.reject_self_appointed_admin refuses a change to
// profile_private.is_admin when `current_user` is `authenticated` or `anon`.
// As a security definer function `current_user` is the function's owner, the
// condition is never true, and any signed-in account can make itself admin -
// which is how it stood from 20260921230000 until
// 20261001080000_the-admin-guard-runs-as-its-caller.sql. Nothing about that
// fails loudly: the trigger runs, returns, and lets the change through.
//
// So this reads every migration in order and checks that the last one to
// define the guard defines it `security invoker`, and still asks
// `current_user`.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const dir = path.resolve(__dirname, "..", "supabase", "migrations");
const files = fs.readdirSync(dir).filter((file) => file.endsWith(".sql")).sort();
const DEFINITION =
  /create\s+or\s+replace\s+function\s+private\.reject_self_appointed_admin\s*\(\s*\)([\s\S]*?)\$\$([\s\S]*?)\$\$/gi;

let latest = null;

for (const file of files) {
  const sql = fs.readFileSync(path.join(dir, file), "utf8");

  for (const match of sql.matchAll(DEFINITION)) {
    latest = { file, header: match[1], body: match[2] };
  }
}

assert.ok(latest, "no migration defines private.reject_self_appointed_admin");
assert.ok(
  /security\s+invoker/i.test(latest.header) && !/security\s+definer/i.test(latest.header),
  `${latest.file} defines the admin guard as security definer again - inside one, current_user is the owner and the guard never fires`
);
assert.ok(
  /current_user\s+in\s*\(\s*'authenticated'\s*,\s*'anon'\s*\)/i.test(latest.body),
  `${latest.file}'s admin guard no longer asks current_user who is changing the flag`
);

console.log(`Admin guard: the latest definition (${latest.file}) runs as its caller and asks current_user passed.`);
