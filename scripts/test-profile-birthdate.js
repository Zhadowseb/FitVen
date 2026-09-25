// The birth year and the sex on your own profile.
//
// The date maths is loaded as a module. The sex is checked in the service that
// normalises, loads and saves it - read out of src/Services/socialService.js
// and run against a fake Supabase, the way test-cloud-watcher-claims.js does it,
// because the real module drags in the database, the repositories and the
// network. What matters there is three things: the value is only ever male,
// female or not given; it goes in the same write as the birth year; and a
// project that has not run the sex migration still saves the profile.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

async function run() {
  // Through the project's Babel setup rather than a data: URL: dateUtils now
  // imports the translations for its relative-time words, and a data: URL
  // cannot resolve an import.
  const dateUtils = loadAppModule("src/Utils/dateUtils.js");
  const {
    calculateAgeFromBirthDate,
    dateToIsoDate,
    isoDateToLocalDate,
  } = dateUtils;

  assert.strictEqual(
    calculateAgeFromBirthDate("2000-06-28", new Date(2026, 5, 28)),
    26
  );
  assert.strictEqual(
    calculateAgeFromBirthDate("2000-06-29", new Date(2026, 5, 28)),
    25
  );
  assert.strictEqual(
    calculateAgeFromBirthDate("2000-02-29", new Date(2025, 1, 28)),
    24
  );
  assert.strictEqual(
    calculateAgeFromBirthDate("2000-02-29", new Date(2025, 2, 1)),
    25
  );
  assert.strictEqual(
    calculateAgeFromBirthDate("2030-01-01", new Date(2026, 5, 28)),
    null
  );
  assert.strictEqual(calculateAgeFromBirthDate("not-a-date"), null);
  assert.strictEqual(dateToIsoDate(new Date(1995, 10, 7)), "1995-11-07");

  const localDate = isoDateToLocalDate("1995-11-07");
  assert.strictEqual(localDate.getFullYear(), 1995);
  assert.strictEqual(localDate.getMonth(), 10);
  assert.strictEqual(localDate.getDate(), 7);

  await checkSex(dateUtils);
  checkSexMigration();

  console.log(
    "Profile birth date and sex checks passed: normalising, one write with the birth year, and the fallback before the migration."
  );
}

/* --------------------------------------------------- the service's half -- */

const socialSource = read("src/Services/socialService.js");

/** Reads a top-level declaration out of socialService by name. */
function declarationFrom(name) {
  const start = socialSource.search(
    new RegExp(
      `^(?:export )?(?:async function|function|const|let) ${name}\\b`,
      "m"
    )
  );
  assert.ok(start !== -1, `${name} is gone from socialService`);

  const isValue = /^(?:export )?(?:const|let) /.test(
    socialSource.slice(start, start + 20)
  );
  // A function ends at the first closing brace in the first column after its
  // body opens - not after its parameters, since a destructured parameter
  // list closes with one too.
  const end = isValue
    ? socialSource.indexOf(";", start) + 1
    : socialSource.indexOf("\n}", socialSource.indexOf(") {", start)) + 2;

  return socialSource.slice(start, end).replace(/^export /, "");
}

const USER_ID = "user-1";

/**
 * Enough of the client for the own-profile save: `profiles` takes an update,
 * `profile_private` a select and an upsert. A column the table does not have
 * fails the way PostgREST fails - 42703 on a read, PGRST204 on a write.
 */
function createFakeSupabase({ hasSexColumn = true, hasMaxHeartRateSource = true } = {}) {
  const privateRow = {
    user_id: USER_ID,
    birth_date: null,
    manual_max_heart_rate: null,
    measured_max_heart_rate: null,
    updated_at: null,
  };

  if (hasMaxHeartRateSource) {
    privateRow.max_heart_rate_source = "auto";
  }

  if (hasSexColumn) {
    privateRow.sex = null;
  }

  const profileRow = {
    id: USER_ID,
    username: "seb#4821",
    username_base: "seb",
    username_code: "4821",
    display_name: "Seb",
    bio: "",
    avatar_path: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
  const privateSelects = [];
  const privateUpserts = [];
  const missingColumnError = (column, isWrite) =>
    isWrite
      ? {
          code: "PGRST204",
          message: `Could not find the '${column}' column of 'profile_private' in the schema cache`,
        }
      : {
          code: "42703",
          message: `column profile_private.${column} does not exist`,
        };

  function from(table) {
    if (table === "profile_private") {
      return {
        select(columns) {
          privateSelects.push(columns);
          const requested = columns.split(",").map((column) => column.trim());
          const query = {
            eq(column, value) {
              assert.strictEqual(column, "user_id");
              assert.strictEqual(value, USER_ID);
              return query;
            },
            async maybeSingle() {
              const missing = requested.find((column) => !(column in privateRow));

              if (missing) {
                return { data: null, error: missingColumnError(missing, false) };
              }

              return {
                data: Object.fromEntries(
                  requested.map((column) => [column, privateRow[column]])
                ),
                error: null,
              };
            },
          };

          return query;
        },
        async upsert(row, options) {
          assert.strictEqual(options?.onConflict, "user_id");
          privateUpserts.push({ ...row });
          const missing = Object.keys(row).find((column) => !(column in privateRow));

          if (missing) {
            return { error: missingColumnError(missing, true) };
          }

          Object.assign(privateRow, row);
          return { error: null };
        },
      };
    }

    if (table === "profiles") {
      return {
        update(values) {
          const query = {
            eq() {
              return query;
            },
            select() {
              return query;
            },
            async single() {
              Object.assign(profileRow, values);
              return { data: { ...profileRow }, error: null };
            },
          };

          return query;
        },
      };
    }

    throw new Error(`the own-profile save reached for ${table}`);
  }

  return {
    client: {
      from,
      auth: { updateUser: async () => ({ error: null }) },
    },
    privateRow,
    privateSelects,
    privateUpserts,
  };
}

/** The own-profile half of socialService, against `fake`. */
function buildOwnProfile(fake, heartRate, dateUtils) {
  const build = new Function(
    "supabase",
    "t",
    "normalizeSocialError",
    "ensureOwnProfile",
    "mapProfileRow",
    "attachAvatarUrls",
    "normalizeIsoDateString",
    "normalizeMaxHeartRate",
    "normalizeMaxHeartRateSource",
    "MAX_HEART_RATE_SOURCE_AUTO",
    [
      "PROFILES_TABLE",
      "PROFILE_PRIVATE_TABLE",
      "PROFILE_SELECT_FIELDS",
      "PROFILE_DISPLAY_NAME_MAX_LENGTH",
      "PROFILE_BIO_MAX_LENGTH",
      "PROFILE_SEXES",
      "PROFILE_SEX_VALUES",
      "isMissingPrivateMaxHeartRateColumnsError",
      "isMissingPrivateMaxHeartRateSourceError",
      "isMissingPrivateSexColumnError",
      "privateSexUnavailable",
      "normalizeProfileValues",
      "normalizeSexValue",
      "validateSex",
      "normalizeBirthDateValue",
      "validateBirthDate",
      "saveOwnPrivateProfile",
      "PRIVATE_SETTINGS_SELECT_FIELDS",
      "mapPrivateSettingsRow",
      "getOwnPrivateSettings",
      "getOwnPrivateSettingsWithoutSex",
      "mapOwnProfileRow",
      "updateOwnProfile",
    ]
      .map(declarationFrom)
      .concat(
        "return { PROFILE_SEXES, normalizeProfileValues, validateSex, saveOwnPrivateProfile, getOwnPrivateSettings, updateOwnProfile };"
      )
      .join("\n")
  );

  return build(
    fake.client,
    (key) => key,
    (error) => error,
    async () => null,
    // The public half is not what this is about: just enough of a profile.
    (row, followingIdSet, privateSettings = {}) => ({
      id: row.id,
      displayName: row.display_name,
      bio: row.bio ?? "",
      birthDate: privateSettings.birthDate ?? null,
    }),
    async (profiles) => profiles,
    dateUtils.normalizeIsoDateString,
    heartRate.normalizeMaxHeartRate,
    heartRate.normalizeMaxHeartRateSource,
    heartRate.MAX_HEART_RATE_SOURCE_AUTO
  );
}

async function checkSex(dateUtils) {
  const heartRate = loadAppModule("src/Utils/heartRateUtils.js");
  const user = { id: USER_ID, user_metadata: { display_name: "Seb" } };

  /* -------------------------------------------------------- normalising -- */

  const service = buildOwnProfile(createFakeSupabase(), heartRate, dateUtils);

  assert.deepStrictEqual(
    Object.values(service.PROFILE_SEXES).sort(),
    ["female", "male"],
    "the sex can be male or female, and nothing else"
  );
  assert.deepStrictEqual(
    service.normalizeProfileValues({
      displayName: "  Seb ",
      bio: " Lifts things. ",
      birthDate: "1990-06-15",
      sex: " Female ",
    }),
    {
      displayName: "Seb",
      bio: "Lifts things.",
      birthDate: "1990-01-01",
      sex: "female",
    }
  );

  const sexOf = (sex) => service.normalizeProfileValues({ sex }).sex;

  assert.strictEqual(sexOf("male"), "male");
  assert.strictEqual(sexOf(null), null, "null is 'not given'");
  assert.strictEqual(sexOf(""), null, "an empty value clears it");
  assert.strictEqual(
    sexOf(undefined),
    undefined,
    "left out means 'not part of this save', not 'clear it'"
  );
  assert.strictEqual(sexOf("other"), null);
  assert.strictEqual(
    service.normalizeProfileValues({}).birthDate,
    undefined,
    "a birth date left out is not turned into a cleared one"
  );
  assert.throws(
    () => service.validateSex("other", sexOf("other")),
    /profile\.sex\.invalid/,
    "a value that is neither is refused rather than saved as nothing"
  );
  assert.doesNotThrow(() => service.validateSex(null, null));
  assert.doesNotThrow(() => service.validateSex("", null));
  assert.doesNotThrow(() => service.validateSex(undefined, undefined));

  /* ----------------------------------- saved together with the birth year -- */

  {
    const fake = createFakeSupabase();
    const own = buildOwnProfile(fake, heartRate, dateUtils);
    const saved = await own.updateOwnProfile({
      user,
      displayName: "Seb",
      bio: "",
      birthDate: "1990-06-15",
      sex: "female",
    });

    assert.strictEqual(
      fake.privateUpserts.length,
      1,
      "the birth year and the sex are one write"
    );
    assert.strictEqual(fake.privateUpserts[0].birth_date, "1990-01-01");
    assert.strictEqual(fake.privateUpserts[0].sex, "female");
    assert.strictEqual(fake.privateRow.sex, "female");
    assert.strictEqual(saved.privateSettingsError, null);
    assert.strictEqual(saved.sex, "female", "the saved sex comes back on the profile");
    assert.strictEqual(saved.sexAvailable, true);

    // Read again, the way Profile and Edit profile load it.
    const reloaded = await own.getOwnPrivateSettings(USER_ID);
    assert.strictEqual(reloaded.sex, "female");
    assert.strictEqual(reloaded.birthDate, "1990-01-01");

    // The heart rate settings save the birth year on its own. The sex stays.
    await own.saveOwnPrivateProfile(USER_ID, { birthDate: "1985-01-01" });
    assert.ok(
      !("sex" in fake.privateUpserts[1]),
      "a birth-year-only save must not send the sex at all"
    );
    assert.strictEqual(fake.privateRow.sex, "female");
    assert.strictEqual(fake.privateRow.birth_date, "1985-01-01");

    // Cleared on purpose.
    await own.updateOwnProfile({
      user,
      displayName: "Seb",
      bio: "",
      birthDate: "1985-01-01",
      sex: null,
    });
    assert.strictEqual(fake.privateRow.sex, null, "not given clears it");

    // The private half left out - it could not be read - is not written.
    const upsertsBefore = fake.privateUpserts.length;
    await own.updateOwnProfile({ user, displayName: "Seb B", bio: "" });
    assert.strictEqual(
      fake.privateUpserts.length,
      upsertsBefore,
      "a form that could not read the birth year and sex must not write them"
    );
    assert.strictEqual(fake.privateRow.birth_date, "1985-01-01");
  }

  /* ------------------------------------------ before the migration has run -- */

  {
    const fake = createFakeSupabase({ hasSexColumn: false });
    const own = buildOwnProfile(fake, heartRate, dateUtils);

    const loaded = await own.getOwnPrivateSettings(USER_ID);
    assert.strictEqual(loaded.sexAvailable, false, "no column, no field");
    assert.strictEqual(loaded.sex, null);

    const saved = await own.updateOwnProfile({
      user,
      displayName: "Seb",
      bio: "",
      birthDate: "1992-03-04",
      sex: "male",
    });

    assert.strictEqual(
      saved.privateSettingsError,
      null,
      "the profile still saves without the column"
    );
    assert.strictEqual(
      fake.privateRow.birth_date,
      "1992-01-01",
      "and the birth year still goes in"
    );
    assert.ok(!("sex" in fake.privateRow));
    assert.strictEqual(saved.sexAvailable, false);
    assert.strictEqual(saved.sex, null);

    const selectsBefore = fake.privateSelects.length;
    await own.getOwnPrivateSettings(USER_ID);
    assert.ok(
      fake.privateSelects
        .slice(selectsBefore)
        .every((columns) => !/\bsex\b/.test(columns)),
      "once the column is known to be missing it is not asked for again"
    );
  }

  {
    // The first save is what finds out: the column went missing after load.
    const fake = createFakeSupabase({ hasSexColumn: false });
    const own = buildOwnProfile(fake, heartRate, dateUtils);
    const result = await own.saveOwnPrivateProfile(USER_ID, {
      birthDate: "1992-01-01",
      sex: "female",
    });

    assert.deepStrictEqual(result, { sexSaved: false });
    assert.strictEqual(fake.privateUpserts.length, 2, "one try with the sex, one without");
    assert.ok(!("sex" in fake.privateUpserts[1]));
    assert.strictEqual(fake.privateRow.birth_date, "1992-01-01");
  }

  {
    // Older still: no max heart rate source either. The profile loads as it
    // did before the sex was added.
    const fake = createFakeSupabase({
      hasSexColumn: false,
      hasMaxHeartRateSource: false,
    });
    fake.privateRow.birth_date = "1980-01-01";
    const own = buildOwnProfile(fake, heartRate, dateUtils);
    const loaded = await own.getOwnPrivateSettings(USER_ID);

    assert.strictEqual(loaded.birthDate, "1980-01-01");
    assert.strictEqual(loaded.preferredMaxHeartRateSource, "auto");
    assert.strictEqual(loaded.sexAvailable, false);
  }

  /* --------------------------------------- never on the public profile ---- */

  assert.ok(
    !/\bsex\b/.test(declarationFrom("PROFILE_SELECT_FIELDS")),
    "the public profile select must not carry the sex"
  );
  assert.ok(
    !/\bsex\b/.test(declarationFrom("mapProfileRow")),
    "mapProfileRow also maps other people's rows, so it must not carry the sex"
  );
}

/* ------------------------------------------------------- the migration -- */

function checkSexMigration() {
  const migration = read(
    "supabase/migrations/20260927090000_a-lifter-can-give-their-sex.sql"
  );
  const statements = migration
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  assert.match(
    statements,
    /alter table public\.profile_private\s+add column if not exists sex text/,
    "the sex goes on profile_private, beside the birth year"
  );
  assert.match(
    statements,
    /check \(sex is null or sex in \('male', 'female'\)\)/,
    "only male, female or nothing"
  );
  assert.match(statements, /^begin;/m);
  assert.match(statements, /^commit;/m);
  assert.ok(
    !/\b(grant|create policy|security definer)\b/i.test(statements),
    "the column stays under the owner-only policies profile_private already has"
  );
  assert.ok(
    !/public\.profiles\b/.test(statements),
    "nothing about the sex belongs on the public profiles table"
  );
}

// Last, so every constant above exists before the checks reach for it.
run().catch((error) => {
  console.error(error);
  process.exit(1);
});
