// The Android store numbers: the service account's signed request, Google's
// answers, the installs report (UTF-16, like the real ones) and the rows - run
// for real against a fake fetch and a made-up report.
//
// This loads supabase/functions/store-stats/android.ts itself, through Node's
// own TypeScript stripping, so what is tested is what is deployed.
//
// Nothing here can check the numbers against the Play Console. Every report
// below is invented, and the first real one has to be compared by hand with
// the Statistics page before it is trusted.
//
// No real key is used, or read, anywhere in this file: the one below is made on
// the spot and thrown away.

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const functionDir = path.join(root, "supabase", "functions", "store-stats");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8").split("\r\n").join("\n");
}

const PACKAGE = "com.anonymous.programapp";
const BUCKET = "pubsite_prod_rev_01234567890123456789";
// 2026-09-30 12:00 UTC: yesterday is the 29th, and thirty days reach back to 31 August.
const NOW = Date.parse("2026-09-30T12:00:00Z");

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const SERVICE_ACCOUNT = JSON.stringify({
  type: "service_account",
  client_email: "fitven-stats@example-project.iam.gserviceaccount.com",
  private_key: privateKey,
});

const HEADER = [
  "Date",
  "Package Name",
  "Daily Device Installs",
  "Daily Device Uninstalls",
  "Daily Device Upgrades",
  "Total User Installs",
  "Daily User Installs",
  "Daily User Uninstalls",
  "Active Device Installs",
  "Install events",
  "Update events",
  "Uninstall events",
];

function csvRow({ day, userInstalls, packageName = PACKAGE, deviceInstalls = 99 }) {
  return [day, packageName, deviceInstalls, 1, 2, 500, userInstalls, 1, 300, 12, 8, 1].join(",");
}

// What Play writes: UTF-16 little endian with a byte order mark.
function utf16(lines) {
  return Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(lines.join("\r\n") + "\r\n", "utf16le")]);
}

function arrayBufferOf(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function report(rows) {
  return utf16([HEADER.join(","), ...rows]);
}

function daysOf(month, from, to, installs = (day) => day) {
  const rows = [];

  for (let day = from; day <= to; day += 1) {
    rows.push(csvRow({ day: `${month.slice(0, 4)}-${month.slice(4)}-${String(day).padStart(2, "0")}`, userInstalls: installs(day) }));
  }

  return rows;
}

function fakeGoogle({ files = {}, token = "token-1", tokenStatus = 200, status = null } = {}) {
  const requests = [];

  async function fetch(url, init) {
    requests.push({ url, init });

    if (url === "https://oauth2.googleapis.com/token") {
      if (tokenStatus !== 200) {
        return new Response(JSON.stringify({ error: "invalid_grant", error_description: "Invalid JWT Signature." }), { status: tokenStatus });
      }

      return new Response(JSON.stringify({ access_token: token, expires_in: 3600, token_type: "Bearer" }), { status: 200 });
    }

    assert.strictEqual(init.headers.Authorization, `Bearer ${token}`, "the report is asked for with the token");

    const object = decodeURIComponent(url.split("/o/")[1].split("?")[0]);

    if (status && status(object)) {
      const answer = status(object);

      return new Response(JSON.stringify({ error: { code: answer, message: `answer ${answer}` } }), { status: answer });
    }

    if (!(object in files)) {
      return new Response(JSON.stringify({ error: { code: 404, message: "No such object" } }), { status: 404 });
    }

    return new Response(files[object], { status: 200 });
  }

  return { fetch, requests };
}

const objectOf = (month) => `stats/installs/installs_${PACKAGE}_${month}_overview.csv`;

function fakeTable(stored = []) {
  const rows = new Map(stored.map((day) => [day, { day, platform: "android", downloads: 1 }]));
  const written = [];

  return {
    written,
    rows,
    readStoredDays: async (oldest, newest) => new Set([...rows.keys()].filter((day) => day >= oldest && day <= newest)),
    writeRow: async (row) => {
      written.push(row);
      rows.set(row.day, row);
    },
  };
}

(async () => {
  const android = await import(pathToFileURL(path.join(functionDir, "android.ts")).href);

  /* ----------------------------------------------------------- the key -- */

  const account = android.parseServiceAccount(SERVICE_ACCOUNT);

  assert.strictEqual(account.client_email, "fitven-stats@example-project.iam.gserviceaccount.com");
  assert.throws(() => android.parseServiceAccount("not json"), /not the JSON file of a service account key/);
  assert.throws(() => android.parseServiceAccount(JSON.stringify({ client_email: "a@b" })), /no client_email and private_key/);

  try {
    android.parseServiceAccount("{ nope " + privateKey);
  } catch (error) {
    assert.ok(!error.message.includes("BEGIN"), "a message never repeats the key");
  }

  // The request for a token is signed with the key, for read-only storage, for an hour.
  const assertion = await android.createServiceAccountAssertion(account, NOW);
  const [headerPart, claimsPart, signaturePart] = assertion.split(".");
  const decode = (part) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));

  assert.deepStrictEqual(decode(headerPart), { alg: "RS256", typ: "JWT" });
  assert.deepStrictEqual(decode(claimsPart), {
    iss: "fitven-stats@example-project.iam.gserviceaccount.com",
    scope: "https://www.googleapis.com/auth/devstorage.read_only",
    aud: "https://oauth2.googleapis.com/token",
    iat: Math.floor(NOW / 1000),
    exp: Math.floor(NOW / 1000) + 3600,
  });
  assert.ok(
    crypto.verify("RSA-SHA256", Buffer.from(`${headerPart}.${claimsPart}`), publicKey, Buffer.from(signaturePart, "base64url")),
    "signed with the account's key"
  );

  // A key written as one line with the line breaks as \n, which a dashboard field does.
  const oneLine = { ...account, private_key: account.private_key.replace(/\n/g, "\\n") };

  assert.ok((await android.createServiceAccountAssertion(oneLine, NOW)).split(".").length === 3);
  await assert.rejects(android.createServiceAccountAssertion({ ...account, private_key: "-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----" }, NOW), /private_key is empty/);

  {
    const google = fakeGoogle();
    const token = await android.fetchAccessToken({ fetch: google.fetch, account, now: NOW });

    assert.deepStrictEqual(token, { ok: true, token: "token-1" });
    assert.ok(google.requests[0].init.body.includes("grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer"));
  }
  {
    const refused = await android.fetchAccessToken({ fetch: fakeGoogle({ tokenStatus: 400 }).fetch, account, now: NOW });

    assert.deepStrictEqual(refused, { ok: false, status: 400, detail: "invalid_grant: Invalid JWT Signature." });
    assert.deepStrictEqual(
      await android.fetchAccessToken({ fetch: async () => { throw new Error("offline"); }, account, now: NOW }),
      { ok: false, status: 0, detail: "no answer from Google: offline" }
    );
  }

  /* --------------------------------------------------------- the report -- */

  assert.strictEqual(android.monthOf("2026-09-05"), "202609");
  assert.deepStrictEqual(android.monthsOf("2026-08-31", "2026-09-29"), ["202609", "202608"], "newest month first");
  assert.deepStrictEqual(android.monthsOf("2026-09-02", "2026-09-29"), ["202609"]);
  assert.deepStrictEqual(android.monthsOf("2026-12-20", "2027-01-10"), ["202701", "202612"], "over a new year");
  assert.strictEqual(android.installsObjectName(PACKAGE, "202609"), `stats/installs/installs_${PACKAGE}_202609_overview.csv`);
  assert.strictEqual(
    android.buildObjectUrl(BUCKET, android.installsObjectName(PACKAGE, "202609")),
    `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/stats%2Finstalls%2Finstalls_${PACKAGE}_202609_overview.csv?alt=media`
  );

  // The three ways a file can be encoded.
  assert.ok(android.readReportText(arrayBufferOf(utf16(["Date,Package Name", "2026-09-01,x"]))).startsWith("Date,Package Name"));
  assert.strictEqual(android.readReportText(arrayBufferOf(Buffer.from("﻿Date,Package Name", "utf8"))), "Date,Package Name");
  assert.strictEqual(
    android.readReportText(arrayBufferOf(Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from("Date", "utf16le").swap16()]))),
    "Date",
    "big endian"
  );

  {
    const days = android.parseInstallsReport(
      android.readReportText(
        arrayBufferOf(
          report([
            csvRow({ day: "2026-09-01", userInstalls: 7 }),
            csvRow({ day: "2026-09-02", userInstalls: 0, deviceInstalls: 40 }),
            csvRow({ day: "2026-09-03", userInstalls: 5, packageName: "com.someone.else" }),
            "not-a-day," + PACKAGE + ",1,1,1,1,1,1,1,1,1,1",
            csvRow({ day: "2026-09-04", userInstalls: "x" }),
          ])
        )
      ),
      PACKAGE
    );

    assert.deepStrictEqual([...days], [["2026-09-01", 7], ["2026-09-02", 0]], "the users, not the devices; a zero is a zero; another package and damaged rows are left out");
  }

  assert.throws(() => android.parseInstallsReport("", PACKAGE), /the report is empty/);
  assert.throws(() => android.parseInstallsReport("Date,Something\n2026-09-01,1\n", PACKAGE), /no "Date" and "Daily User Installs" columns/);
  assert.strictEqual(android.parseInstallsReport(["Date,Package Name,Daily User Installs", `2026-09-01,"${PACKAGE}",3`].join("\n"), PACKAGE).get("2026-09-01"), 3, "quoted fields");

  /* ------------------------------------------------------------- the run -- */

  // Thirty days from the 31st of August to the 29th of September: two months, asked for once each.
  {
    const google = fakeGoogle({
      files: {
        [objectOf("202609")]: report(daysOf("202609", 1, 28)),
        [objectOf("202608")]: report(daysOf("202608", 1, 31)),
      },
    });
    const table = fakeTable();
    const summary = await android.runAndroidStoreStats({ fetch: google.fetch, token: "token-1", bucket: BUCKET, readStoredDays: table.readStoredDays, writeRow: table.writeRow, now: NOW });

    assert.strictEqual(summary.ok, true);
    assert.deepStrictEqual(summary.window, { oldest: "2026-08-31", newest: "2026-09-29" }, "yesterday is the newest day, never today");
    assert.strictEqual(google.requests.length, 2, "one request for each month");
    assert.strictEqual(summary.written.length, 29, "28 days of September and the 31st of August");
    assert.deepStrictEqual(summary.notInReport, ["2026-09-29"], "a day Google has not written yet is not a zero");
    assert.ok(table.written.every((row) => row.platform === "android" && typeof row.updated_at === "string"));
    assert.deepStrictEqual(table.rows.get("2026-09-12").downloads, 12);
    assert.deepStrictEqual(table.rows.get("2026-08-31").downloads, 31);
    assert.ok(!table.rows.has("2026-09-30"), "today is not asked for");
    assert.ok(!table.rows.has("2026-09-29"));

    // The next run: what is stored is not asked for again, and the missing day is.
    const next = await android.runAndroidStoreStats({
      fetch: fakeGoogle({ files: { [objectOf("202609")]: report(daysOf("202609", 1, 29)) } }).fetch,
      token: "token-1",
      bucket: BUCKET,
      readStoredDays: table.readStoredDays,
      writeRow: table.writeRow,
      now: NOW,
    });

    assert.deepStrictEqual(next.written, [{ day: "2026-09-29", downloads: 29 }]);
    assert.strictEqual(next.alreadyStored, 29);

    // And when everything is stored, nothing is asked at all.
    const idle = fakeGoogle();
    const nothing = await android.runAndroidStoreStats({ fetch: idle.fetch, token: "token-1", bucket: BUCKET, readStoredDays: table.readStoredDays, writeRow: table.writeRow, now: NOW });

    assert.strictEqual(idle.requests.length, 0);
    assert.strictEqual(nothing.alreadyStored, 30);
    assert.deepStrictEqual(nothing.written, []);
  }

  // A month with no file (no installs yet, or Google has not written it): not a failure.
  {
    const google = fakeGoogle({ files: { [objectOf("202609")]: report(daysOf("202609", 1, 29)) } });
    const table = fakeTable();
    const summary = await android.runAndroidStoreStats({ fetch: google.fetch, token: "token-1", bucket: BUCKET, readStoredDays: table.readStoredDays, writeRow: table.writeRow, now: NOW });

    assert.strictEqual(summary.ok, true);
    assert.deepStrictEqual(summary.noReport.map((entry) => entry.month), ["202608"]);
    assert.strictEqual(summary.written.length, 29);
  }

  // The account is refused: the run stops at once and says what to check.
  {
    const google = fakeGoogle({ status: () => 403 });
    const table = fakeTable();
    const summary = await android.runAndroidStoreStats({ fetch: google.fetch, token: "token-1", bucket: BUCKET, readStoredDays: table.readStoredDays, writeRow: table.writeRow, now: NOW });

    assert.strictEqual(summary.ok, false);
    assert.strictEqual(summary.stoppedBy, "auth_failed");
    assert.strictEqual(google.requests.length, 1, "nothing more is asked after a refusal");
    assert.strictEqual(table.written.length, 0);
    assert.match(summary.problems[0], /View app information and download bulk reports/);
    assert.match(summary.problems[0], /PLAY_REPORTS_BUCKET/);
    assert.ok(!summary.problems[0].includes("BEGIN"), "no key in a message");
  }

  // The reason Google gives is in the summary: a 403 with a message, and one that is not JSON.
  {
    const withReason = fakeGoogle({ status: () => 403 });
    const detailed = await android.fetchMonthReport({ fetch: async (url, init) => (url.includes("/o/") ? new Response(JSON.stringify({ error: { code: 403, message: "fitven-play-stats@x does not have storage.objects.get access to the Google Cloud Storage object." } }), { status: 403 }) : withReason.fetch(url, init)), token: "t", bucket: BUCKET, packageName: PACKAGE, month: "202610" });

    assert.deepStrictEqual(detailed, { kind: "auth_failed", status: 403, detail: "fitven-play-stats@x does not have storage.objects.get access to the Google Cloud Storage object." });

    const plain = await android.fetchMonthReport({ fetch: async () => new Response("<html><body><h1>Forbidden</h1><p>Access denied.</p></body></html>", { status: 403 }), token: "t", bucket: BUCKET, packageName: PACKAGE, month: "202610" });

    assert.match(plain.detail, /^HTTP 403: Forbidden Access denied.$/);
    assert.strictEqual((await android.fetchMonthReport({ fetch: async () => new Response("", { status: 403 }), token: "t", bucket: BUCKET, packageName: PACKAGE, month: "202610" })).detail, "HTTP 403");
  }

  // Google asks to slow down: not a failure, and the next run goes on.
  {
    const google = fakeGoogle({ status: () => 429 });
    const summary = await android.runAndroidStoreStats({ fetch: google.fetch, token: "token-1", bucket: BUCKET, readStoredDays: fakeTable().readStoredDays, writeRow: async () => {}, now: NOW });

    assert.strictEqual(summary.ok, true);
    assert.strictEqual(summary.stoppedBy, "rate_limited");
  }

  // A refusal of one month (a 500) does not keep the other from being read.
  {
    const google = fakeGoogle({
      files: { [objectOf("202608")]: report(daysOf("202608", 1, 31)) },
      status: (object) => (object.includes("202609") ? 500 : null),
    });
    const table = fakeTable();
    const summary = await android.runAndroidStoreStats({ fetch: google.fetch, token: "token-1", bucket: BUCKET, readStoredDays: table.readStoredDays, writeRow: table.writeRow, now: NOW });

    assert.strictEqual(summary.ok, false);
    assert.strictEqual(google.requests.length, 2);
    assert.deepStrictEqual(table.written.map((row) => row.day), ["2026-08-31"]);
    assert.match(summary.problems[0], /refused the request for 202609/);
  }

  // A file that is not an installs report is an error - not a month of zeros.
  {
    const google = fakeGoogle({ files: { [objectOf("202609")]: utf16(["Date,Something", "2026-09-01,1"]), [objectOf("202608")]: report(daysOf("202608", 31, 31)) } });
    const table = fakeTable();
    const summary = await android.runAndroidStoreStats({ fetch: google.fetch, token: "token-1", bucket: BUCKET, readStoredDays: table.readStoredDays, writeRow: table.writeRow, now: NOW });

    assert.strictEqual(summary.ok, false);
    assert.deepStrictEqual(table.written.map((row) => row.day), ["2026-08-31"], "nothing written for the month that could not be read");
    assert.match(summary.problems[0], /could not be read/);
  }

  // The database refusing a read is thrown to the caller, like the iOS run.
  await assert.rejects(
    android.runAndroidStoreStats({ fetch: fakeGoogle().fetch, token: "t", bucket: BUCKET, readStoredDays: async () => { throw new Error("db down"); }, writeRow: async () => {}, now: NOW }),
    /db down/
  );

  // Another package name is read from its own file.
  {
    const google = fakeGoogle({ files: { "stats/installs/installs_com.other.app_202609_overview.csv": report(daysOf("202609", 1, 29).map((row) => row.replace(PACKAGE, "com.other.app"))) } });
    const summary = await android.runAndroidStoreStats({ fetch: google.fetch, token: "token-1", bucket: BUCKET, packageName: "com.other.app", readStoredDays: fakeTable().readStoredDays, writeRow: async () => {}, now: NOW });

    assert.strictEqual(summary.written.length, 29);
  }

  /* ---------------------------------------------------- the stored days -- */

  {
    const asked = [];
    const client = {
      from: (table) => {
        const query = { select: () => query, eq: (column, value) => (asked.push([column, value]), query), gte: () => query, lte: () => query, then: (resolve) => resolve({ data: [{ day: "2026-09-01" }], error: null }) };

        assert.strictEqual(table, "store_stats");

        return query;
      },
    };

    assert.deepStrictEqual([...(await android.androidStoredDays(client)("2026-09-01", "2026-09-29"))], ["2026-09-01"]);
    assert.deepStrictEqual(asked, [["platform", "android"]], "only the Android days");
  }

  /* ----------------------------------------------------- the caller (index) -- */

  const index = read("supabase/functions/store-stats/index.ts");

  for (const name of ["PLAY_SERVICE_ACCOUNT_JSON", "PLAY_REPORTS_BUCKET", "PLAY_PACKAGE_NAME"]) {
    assert.ok(index.includes(`"${name}"`), `${name} is read by the function`);
  }

  assert.ok(index.includes("runAndroidStoreStats") && index.includes("androidStoredDays"), "the function runs Android");
  assert.ok(/skipped:\s*\n?\s*"PLAY_SERVICE_ACCOUNT_JSON and PLAY_REPORTS_BUCKET are not both set/.test(index), "a project without Play set up says so and goes on");
  assert.ok(/summary\.ok && androidOk \? 200 : 502/.test(index), "the answer is a failure when either store failed");
  assert.ok(!/console\.(log|error|warn)\([^)]*playServiceAccount/.test(index), "the key is never logged");

  console.log(
    "Android store stats: the service account's signed request, Google's answers, the UTF-16 installs report, the days written and not asked again, a missing month, a refused account, a damaged report, and what the function does without Play set up."
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
