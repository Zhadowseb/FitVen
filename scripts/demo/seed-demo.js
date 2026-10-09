#!/usr/bin/env node
// Creates, refreshes and removes the demo accounts: a made-up social circle for
// the content captured from the app (docs/DEMO-ACCOUNTS.md).
//
//   npm run demo:plan                  what would be done; touches nothing, needs no key
//   npm run demo:probe                 checks the cloud tables against what a seed writes
//   npm run demo:apply -- --yes        accounts, profiles, photos, follows, workouts and posts
//   npm run demo:apply -- --yes --accounts-only
//   npm run demo:reset -- --yes        removes every demo account and what it owns
//
// It is run by hand, on your machine, and by no workflow. It uses the service
// role key from .env (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY): nothing here
// prints, logs, writes or sends the key.
//
// What keeps it from touching anything real:
//   - It only writes to FitVen's own project, the one in supaBaseClient.js.
//   - A user is the cast's only with BOTH the demo marker in its metadata and
//     an address ending .demo@fitven.dk. Reset and refresh act on those alone.
//   - Follows are between the cast, so no real person follows a demo account
//     or is followed by one, and no real person gets a notification.
//   - Posts are 'following' visibility, which only the cast's followers - the
//     cast - can read.
// Without --yes, apply and reset only print what they would do.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const cast = require("./cast");

const ROOT = path.join(__dirname, "..", "..");
const AVATAR_DIR = path.join(__dirname, "avatars");
const AVATAR_BUCKET = "avatars";

// A column that older or newer clouds may not have; dropped from a row when
// the cloud does not know it, the way the app itself copes.
const OPTIONAL_COLUMNS = {
  workout_type_instance: ["started_from", "gym_id"],
  exercise_instance: ["weight_mode"],
  set: ["rest_counted"],
};

// Children first. Everything a seed writes for the cast, and nothing else.
const ACTIVITY_TABLES = [
  ["social_post_like", "user_id"],
  ["social_post", "author_id"],
  ["set", "user_id"],
  ["exercise_instance", "user_id"],
  ["workout_type_instance", "user_id"],
];

// What else a demo account can end up owning by being used. Reset clears these
// too, ignoring a table or column that is not there.
const OWNED_TABLES = [
  ["notification_inbox", "user_id"],
  ["notification_events", "actor_id"],
  ["notification_events", "user_id"],
  ["notification_preferences", "user_id"],
  ["push_tokens", "user_id"],
  ["workout_start_notification_sources", "user_id"],
  ["exercise_column_preferences", "user_id"],
  ["exercise_favourites", "user_id"],
  ["user_blocks", "blocker_id"],
  ["user_blocks", "blocked_id"],
  ["user_follows", "follower_id"],
  ["user_follows", "following_id"],
  ["profile_private", "user_id"],
];

function parseArgs(argv) {
  const [command = "plan", ...rest] = argv;
  const flags = new Set(rest.filter((arg) => arg.startsWith("--")));

  return {
    command,
    yes: flags.has("--yes"),
    accountsOnly: flags.has("--accounts-only"),
  };
}

function readText(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

/** The one project this script may write to, read from the app itself. */
function appProjectUrl() {
  const match = readText("src/Database/supaBaseClient.js").match(
    /const supabaseUrl = ['"]([^'"]+)['"]/
  );

  if (!match) {
    throw new Error("Could not read the project URL from src/Database/supaBaseClient.js.");
  }

  return match[1].replace(/\/+$/, "");
}

function assertProjectUrl(url, expected) {
  if (String(url ?? "").replace(/\/+$/, "") !== expected) {
    throw new Error(
      "SUPABASE_URL is not FitVen's project. This script only writes to the project the app itself uses."
    );
  }
}

function legalVersion(file, name) {
  const match = readText(file).match(new RegExp(`export const ${name} = "([^"]+)"`));

  if (!match) {
    throw new Error(`Could not read ${name} from ${file}.`);
  }

  return match[1];
}

/** KEY=VALUE lines of .env, under what the shell already has. Values are never printed. */
function loadEnv() {
  const env = { ...process.env };
  const file = path.join(ROOT, ".env");

  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);

      if (match && env[match[1]] === undefined) {
        env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
      }
    }
  }

  return env;
}

function plan(options) {
  const members = cast.CAST;
  const withAvatar = members.filter((member) =>
    fs.existsSync(path.join(AVATAR_DIR, member.avatar ?? ""))
  );

  console.log(`Demo cast: ${members.length} accounts, all made up.`);
  for (const member of members) {
    console.log(
      `  ${member.key.padEnd(6)} ${member.displayName.padEnd(12)} ${cast.demoEmail(member)}` +
        `${member.login ? "  <- the account the emulator signs in as" : ""}`
    );
  }
  console.log(`Profile photos: ${withAvatar.length} of ${members.length} (scripts/demo/avatars/<key>.jpg; the rest show initials).`);
  console.log(`Follows: ${cast.FOLLOWS.length}, all between the cast.`);

  if (options.accountsOnly) {
    console.log("Activity: skipped (--accounts-only).");
  } else {
    const likes = cast.ACTIVITIES.reduce((sum, activity) => sum + activity.likes.length, 0);
    const sets = cast.ACTIVITIES.reduce(
      (sum, activity) => sum + activity.exercises.reduce((n, e) => n + e.sets.length, 0),
      0
    );

    console.log(
      `Activity: ${cast.ACTIVITIES.length} finished workouts with ${sets} sets, a post for each ('following' visibility), ${likes} likes.`
    );
    console.log(`Dates are relative to the day it runs, so run it again before a capture to keep "3 days ago" true.`);
  }

  console.log(
    `Consent recorded for them as accepted: privacy ${legalVersion("src/Resources/Legal/privacyPolicy.js", "PRIVACY_POLICY_VERSION")}, ` +
      `terms ${legalVersion("src/Resources/Legal/termsOfUse.js", "TERMS_VERSION")}.`
  );
}

function connect(env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY have to be in .env (or the environment).");
  }

  assertProjectUrl(url, appProjectUrl());

  // Required here, not at the top, so `plan` and the test never need the package.
  const { createClient } = require("@supabase/supabase-js");

  return {
    url: url.replace(/\/+$/, ""),
    key,
    client: createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

async function listDemoUsers(client) {
  const found = [];

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });

    if (error) {
      throw error;
    }

    found.push(...data.users.filter(cast.isDemoUser));

    if (data.users.length < 1000) {
      break;
    }
  }

  return found;
}

/** The cloud's own description of its tables, which is how a seed checks itself. */
async function fetchDefinitions({ url, key }) {
  const response = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/openapi+json" },
  });

  if (!response.ok) {
    throw new Error(`The cloud would not describe its tables (HTTP ${response.status}).`);
  }

  const spec = await response.json();

  if (!spec.definitions) {
    throw new Error("The cloud's description of its tables had no definitions.");
  }

  return spec.definitions;
}

/** What a row would break: columns the table lacks, and required ones it does not fill. */
function checkRow(definitions, table, row) {
  const definition = definitions[table];

  if (!definition) {
    return { table, missingTable: true, unknown: [], missingRequired: [] };
  }

  const known = new Set(Object.keys(definition.properties ?? {}));
  const optional = new Set(OPTIONAL_COLUMNS[table] ?? []);
  const unknown = Object.keys(row).filter((column) => !known.has(column) && !optional.has(column));
  const properties = definition.properties ?? {};
  // PostgREST lists every NOT NULL column as required, also the ones the
  // database fills in itself: the id it counts up (an identity column shows no
  // default) and any column with a default, like created_at.
  // Filled means a value: a null in a NOT NULL column is refused just the same
  // (local_workout_type_instance_id was sent as null and the first apply stopped on it).
  const missingRequired = (definition.required ?? []).filter(
    (column) =>
      column !== "id" &&
      (!(column in row) || row[column] === null || row[column] === undefined) &&
      !("default" in (properties[column] ?? {}))
  );

  return { table, missingTable: false, unknown, missingRequired };
}

function sampleRows() {
  const activity = cast.ACTIVITIES[0];
  const { workout, exercises, post } = cast.buildActivityRows(activity, "00000000-0000-0000-0000-000000000000");

  return {
    workout_type_instance: workout,
    exercise_instance: {
      ...exercises[0].row,
      cloud_workout_type_instance_id: 1,
    },
    set: { ...exercises[0].sets[0], cloud_exercise_instance_id: 1 },
    social_post: { ...post, source_workout_type_instance_id: 1 },
    social_post_like: {
      post_id: 1,
      user_id: "00000000-0000-0000-0000-000000000000",
      created_at: post.created_at,
    },
  };
}

async function probe(connection) {
  const definitions = await fetchDefinitions(connection);
  const problems = [];

  for (const [table, row] of Object.entries(sampleRows())) {
    const result = checkRow(definitions, table, row);
    const status = result.missingTable
      ? "missing table"
      : result.unknown.length || result.missingRequired.length
        ? "needs a change"
        : "ok";

    console.log(`  ${table.padEnd(24)} ${status}`);

    if (result.missingTable) {
      problems.push(`${table}: the table is not in the cloud`);
    }
    if (result.unknown.length) {
      problems.push(`${table}: the seed writes columns the table does not have: ${result.unknown.join(", ")}`);
    }
    if (result.missingRequired.length) {
      problems.push(`${table}: the table requires columns the seed leaves empty: ${result.missingRequired.join(", ")}`);
    }
  }

  return { definitions, problems };
}

function pruneOptional(definitions, table, row) {
  const known = new Set(Object.keys(definitions[table]?.properties ?? {}));
  const pruned = { ...row };

  for (const column of OPTIONAL_COLUMNS[table] ?? []) {
    if (!known.has(column)) {
      delete pruned[column];
    }
  }

  return pruned;
}

function check(label, { error }) {
  if (error) {
    throw new Error(`${label}: ${error.message ?? error}`);
  }
}

/** Random, and with a lower case letter, an upper case letter and a digit: the cloud insists on all three. */
function strongPassword(bytes = 18) {
  return `${crypto.randomBytes(bytes).toString("base64url")}aA1`;
}

async function ensureUsers(client, env) {
  const existing = new Map((await listDemoUsers(client)).map((user) => [user.email.toLowerCase(), user]));
  const ids = new Map();
  let passwordMadeUp = false;

  // Shown the moment it exists, not at the end: a later failure must not lose it.
  const announce = (email, password) => {
    passwordMadeUp = true;
    console.log(
      `\n  Password for ${email}: ${password}\n` +
        "  (made up just now and shown only here - put it in .env as DEMO_PASSWORD so a rerun keeps it)\n"
    );
  };

  for (const member of cast.CAST) {
    const email = cast.demoEmail(member);
    const metadata = {
      [cast.DEMO_MARKER]: true,
      username_base: member.usernameBase,
      display_name: member.displayName,
    };
    let password = member.login ? env.DEMO_PASSWORD : strongPassword(24);
    let user = existing.get(email.toLowerCase());

    if (!user) {
      if (member.login && !password) {
        password = strongPassword();
        announce(email, password);
      }

      const { data, error } = await client.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: metadata,
      });

      check(`Creating ${email}`, { error });
      user = data.user;
      console.log(`  created ${member.key}`);
    } else if (member.login) {
      // The login account always ends up with a password that is known: the one
      // in .env, or a new one made up and shown here.
      if (!password) {
        password = strongPassword();
        announce(email, password);
      }

      check(`Updating ${email}`, await client.auth.admin.updateUserById(user.id, { password, user_metadata: metadata }));
      console.log(`  kept ${member.key} (password set)`);
    } else {
      console.log(`  kept ${member.key}`);
    }

    ids.set(member.key, user.id);
  }

  return { ids, passwordMadeUp };
}

async function ensureProfiles(client, ids) {
  const privacyVersion = legalVersion("src/Resources/Legal/privacyPolicy.js", "PRIVACY_POLICY_VERSION");
  const termsVersion = legalVersion("src/Resources/Legal/termsOfUse.js", "TERMS_VERSION");
  const now = new Date().toISOString();

  for (const member of cast.CAST) {
    const id = ids.get(member.key);
    const update = { display_name: member.displayName, bio: member.bio, updated_at: now };
    const photo = path.join(AVATAR_DIR, member.avatar ?? "");

    if (member.avatar && fs.existsSync(photo)) {
      const avatarPath = `${id}/demo-avatar.jpg`;

      check(
        `Photo for ${member.key}`,
        await client.storage
          .from(AVATAR_BUCKET)
          .upload(avatarPath, fs.readFileSync(photo), { contentType: "image/jpeg", upsert: true })
      );
      update.avatar_path = avatarPath;
    }

    check(`Profile for ${member.key}`, await client.from("profiles").update(update).eq("id", id));
    check(
      `Consent for ${member.key}`,
      await client.from("profile_private").upsert(
        {
          user_id: id,
          ...(member.birthDate ? { birth_date: member.birthDate } : {}),
          privacy_policy_version: privacyVersion,
          privacy_policy_accepted_at: now,
          terms_version: termsVersion,
          terms_accepted_at: now,
          updated_at: now,
        },
        { onConflict: "user_id" }
      )
    );
  }
}

async function ensureFollows(client, ids) {
  const rows = cast.FOLLOWS.map(([follower, following]) => ({
    follower_id: ids.get(follower),
    following_id: ids.get(following),
  }));

  check(
    "Follows",
    await client.from("user_follows").upsert(rows, {
      onConflict: "follower_id,following_id",
      ignoreDuplicates: true,
    })
  );
}

async function deleteActivity(client, demoIds) {
  if (demoIds.length === 0) {
    return;
  }

  for (const [table, column] of ACTIVITY_TABLES) {
    check(`Clearing ${table}`, await client.from(table).delete().in(column, demoIds));
  }
}

async function seedActivity(client, definitions, ids) {
  const demoIds = [...ids.values()];
  const now = new Date();

  await deleteActivity(client, demoIds);

  const { data: catalog, error } = await client.from("Exercise").select("name").limit(10000);

  if (!error) {
    const names = new Set(catalog.map((row) => row.name.toLowerCase()));
    const missing = cast.activityExerciseNames().filter((name) => !names.has(name.toLowerCase()));

    if (missing.length) {
      console.log(`  note: not in the catalog, shown without muscles: ${missing.join(", ")}`);
    }
  }

  // The ids a phone would have given the rows, counted up for each person.
  const localIds = new Map();

  for (const activity of cast.ACTIVITIES) {
    const userId = ids.get(activity.user);
    const rows = cast.buildActivityRows(activity, userId, now, localIds.get(activity.user));

    localIds.set(activity.user, rows.used);
    const workout = pruneOptional(definitions, "workout_type_instance", rows.workout);
    const inserted = await client.from("workout_type_instance").insert(workout).select("id").single();

    check(`Workout ${activity.id}`, inserted);

    const workoutId = inserted.data.id;
    const exerciseRows = rows.exercises.map(({ row }) =>
      pruneOptional(definitions, "exercise_instance", { ...row, cloud_workout_type_instance_id: workoutId })
    );
    const insertedExercises = await client.from("exercise_instance").insert(exerciseRows).select("id, sync_id");

    check(`Exercises ${activity.id}`, insertedExercises);

    const exerciseIdBySync = new Map(insertedExercises.data.map((row) => [row.sync_id, row.id]));
    const setRows = rows.exercises.flatMap(({ row, sets }) =>
      sets.map((set) =>
        pruneOptional(definitions, "set", {
          ...set,
          cloud_exercise_instance_id: exerciseIdBySync.get(row.sync_id),
        })
      )
    );

    check(`Sets ${activity.id}`, await client.from("set").insert(setRows));

    const insertedPost = await client
      .from("social_post")
      .insert({ ...rows.post, source_workout_type_instance_id: workoutId })
      .select("id")
      .single();

    check(`Post ${activity.id}`, insertedPost);

    if (activity.likes.length) {
      const posted = new Date(rows.post.created_at).getTime();

      check(
        `Likes ${activity.id}`,
        await client.from("social_post_like").insert(
          activity.likes.map((liker, index) => ({
            post_id: insertedPost.data.id,
            user_id: ids.get(liker),
            // Some time after the post, one like after another, never later than now.
            created_at: new Date(Math.min(now.getTime(), posted + (index + 1) * 40 * 60000)).toISOString(),
          }))
        )
      );
    }

    console.log(`  ${activity.user} · ${activity.title} · ${rows.workout.date}`);
  }
}

async function apply(options, env) {
  const connection = connect(env);
  let definitions = null;

  if (!options.accountsOnly) {
    console.log("Checking the cloud tables first:");
    const result = await probe(connection);

    if (result.problems.length) {
      console.log("\nNothing was written. Fix these, or run with --accounts-only:");
      result.problems.forEach((problem) => console.log(`  - ${problem}`));
      process.exitCode = 1;
      return;
    }

    definitions = result.definitions;
  }

  console.log("\nAccounts:");
  const { ids, passwordMadeUp } = await ensureUsers(connection.client, env);

  console.log("Profiles, photos and consent...");
  await ensureProfiles(connection.client, ids);

  console.log("Follows...");
  await ensureFollows(connection.client, ids);

  if (!options.accountsOnly) {
    console.log("Activity:");
    await seedActivity(connection.client, definitions, ids);
  }

  console.log("\nDone.");

  if (passwordMadeUp) {
    console.log(
      `\nSign in as ${cast.demoEmail(cast.CAST.find((member) => member.login))} with the password shown above.\n` +
        "Put it in .env as DEMO_PASSWORD, and in the GitHub secrets as DEMO_PASSWORD (and DEMO_EMAIL)."
    );
  }
}

async function removeAvatars(client, id) {
  const { data } = await client.storage.from(AVATAR_BUCKET).list(id);
  const files = (data ?? []).map((file) => `${id}/${file.name}`);

  if (files.length) {
    await client.storage.from(AVATAR_BUCKET).remove(files);
  }
}

async function reset(env) {
  const { client } = connect(env);
  const users = await listDemoUsers(client);

  if (users.length === 0) {
    console.log("There are no demo accounts.");
    return;
  }

  const ids = users.map((user) => user.id);

  console.log(`Removing ${users.length} demo accounts and what they own...`);
  await deleteActivity(client, ids);

  for (const [table, column] of OWNED_TABLES) {
    // A table or column this cloud does not have is not a reason to stop.
    await client.from(table).delete().in(column, ids);
  }

  for (const user of users) {
    await removeAvatars(client, user.id);
    check(`Deleting ${user.email}`, await client.auth.admin.deleteUser(user.id));
    console.log(`  removed ${user.email}`);
  }
}

async function status(env) {
  const { client } = connect(env);
  const users = await listDemoUsers(client);

  console.log(`${users.length} demo accounts in the cloud.`);
  users.forEach((user) => console.log(`  ${user.email}`));
  console.log(`DEMO_PASSWORD is ${env.DEMO_PASSWORD ? "set" : "not set"} in .env.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.command === "plan") {
    plan(options);
    return;
  }

  const env = loadEnv();

  if (options.command === "probe") {
    console.log("Checking the cloud tables:");
    const { problems } = await probe(connect(env));

    if (problems.length) {
      problems.forEach((problem) => console.log(`  - ${problem}`));
      process.exitCode = 1;
    }
    return;
  }

  if (options.command === "status") {
    await status(env);
    return;
  }

  if (options.command === "apply" || options.command === "reset") {
    if (!options.yes) {
      if (options.command === "apply") {
        plan(options);
      } else {
        console.log("reset removes every demo account (the ones with the demo marker and a .demo@fitven.dk address) and everything they own.");
      }
      console.log("\nNothing was done. Add --yes to run it.");
      return;
    }

    if (options.command === "apply") {
      await apply(options, env);
    } else {
      await reset(env);
    }
    return;
  }

  console.log("Usage: seed-demo.js plan | probe | status | apply [--yes] [--accounts-only] | reset [--yes]");
  process.exitCode = 1;
}

module.exports = { assertProjectUrl, checkRow, parseArgs, pruneOptional, strongPassword };

if (require.main === module) {
  main().catch((error) => {
    // The message only: an error object from the client can carry request details.
    console.error(String(error?.message ?? error));
    process.exitCode = 1;
  });
}
