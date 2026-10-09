// The iOS store numbers: the token, Apple's answers, the report, the sum and
// the rows - run for real against a fake fetch and a made-up report.
//
// This loads supabase/functions/store-stats/report.ts itself, through Node's
// own TypeScript stripping, so what is tested is what is deployed. Node warns
// that the file has no module type (package.json has no "type", and adding
// one would change every other script here); `npm run test:store-stats`
// turns off exactly that warning.
//
// Nothing here can check the sum against real sales. Until the app is
// released Apple has no report with FitVen in it, so every report below is
// invented, and the first real number still has to be compared by hand with
// Sales and Trends before it is trusted.
//
// No real key is used, or read, anywhere in this file: the one below is made
// on the spot and thrown away.

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const functionDir = path.join(root, "supabase", "functions", "store-stats");
const migrationName = "20260930090000_store-stats-ios-daily.sql";

// Git checks files out with CRLF on Windows; every search below runs on LF.
function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8").split("\r\n").join("\n");
}

/* ------------------------------------------------------- the fixtures ---- */

const FITVEN = "6769493426";
const OTHER_APP = "1234567890";
const DAY = "2026-09-25";

// Apple's Summary Sales Report header, in Apple's order.
const HEADER = [
  "Provider",
  "Provider Country",
  "SKU",
  "Developer",
  "Title",
  "Version",
  "Product Type Identifier",
  "Units",
  "Developer Proceeds",
  "Begin Date",
  "End Date",
  "Customer Currency",
  "Country Code",
  "Currency of Proceeds",
  "Apple Identifier",
  "Customer Price",
  "Promo Code",
  "Parent Identifier",
  "Subscription",
  "Period",
  "Category",
  "CMB",
  "Device",
  "Supported Platforms",
  "Proceeds Reason",
  "Preserved Pricing",
  "Client",
  "Order Type",
];

function reportRow({ type, units, appleId = FITVEN, date = "09/25/2026", country = "DK", device = "iPhone" }) {
  const values = {
    Provider: "APPLE",
    "Provider Country": "US",
    SKU: appleId === FITVEN ? "fitven" : "other-app",
    Developer: "Test Developer",
    Title: appleId === FITVEN ? "FitVen" : "Another App",
    Version: "2.12.2",
    "Product Type Identifier": type,
    Units: String(units),
    "Developer Proceeds": "0",
    "Begin Date": date,
    "End Date": date,
    "Customer Currency": "DKK",
    "Country Code": country,
    "Currency of Proceeds": "DKK",
    "Apple Identifier": appleId,
    "Customer Price": "0",
    Category: "Health & Fitness",
    Device: device,
    "Supported Platforms": "iOS",
  };

  return HEADER.map((name) => values[name] ?? "").join("\t");
}

// One day of FitVen: 9 first downloads, and 57 units of updates,
// re-downloads and an in-app purchase beside them - plus 100 first downloads
// of another app on the same developer account.
const DAY_ROWS = [
  reportRow({ type: "1", units: 5 }),
  reportRow({ type: "1", units: "2.00", country: "SE" }),
  reportRow({ type: "1F", units: 1 }),
  reportRow({ type: "1T", units: 1, country: "NO", device: "iPad" }),
  reportRow({ type: "7", units: 40 }),
  reportRow({ type: "7F", units: 3 }),
  reportRow({ type: "3", units: 9 }),
  reportRow({ type: "3F", units: 2 }),
  reportRow({ type: "IA1", units: 3 }),
  reportRow({ type: "1", units: 100, appleId: OTHER_APP }),
];
const DAY_TSV = [HEADER.join("\t"), ...DAY_ROWS].join("\n") + "\n";

function tsv(rows, header = HEADER) {
  return [header.join("\t"), ...rows].join("\n") + "\n";
}

// What response.arrayBuffer() hands over. A Node Buffer is a view into a
// shared pool, so it is copied out rather than passed on.
function arrayBufferOf(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function gzipResponse(text) {
  return new Response(zlib.gzipSync(Buffer.from(text, "utf8")), {
    status: 200,
    headers: { "Content-Type": "application/a-gzip" },
  });
}

function appleError(status, code, detail) {
  return new Response(
    JSON.stringify({
      errors: [{ id: "00000000", status: String(status), code, title: code, detail }],
    }),
    { status, headers: { "Content-Type": "application/json" } }
  );
}

const NO_SALES = "There were no sales for the date specified.";
const noSales = () => appleError(404, "NOT_FOUND", NO_SALES);
const notAuthorized = () =>
  appleError(
    401,
    "NOT_AUTHORIZED",
    "Provide a properly configured and signed bearer token, and make sure that it has not expired."
  );

/**
 * A stand-in for Apple: answers by report date, remembers every request and
 * how many were in flight at once.
 */
function fakeApple(answerFor) {
  const requests = [];
  let inFlight = 0;
  let maxInFlight = 0;

  async function fetch(url, init) {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    requests.push({ url, init, day: new URL(url).searchParams.get("filter[reportDate]") });

    // Yield, so two requests started together would overlap here.
    await new Promise((resolve) => setImmediate(resolve));
    inFlight -= 1;

    const answer = answerFor(requests[requests.length - 1].day);

    if (answer instanceof Error) {
      throw answer;
    }

    return answer;
  }

  return {
    fetch,
    requests,
    get maxInFlight() {
      return maxInFlight;
    },
  };
}

/** A stand-in for the table: the stored days in, the upserted rows out. */
function fakeTable(storedDays = []) {
  const reads = [];
  const writes = [];

  return {
    reads,
    writes,
    async readStoredDays(oldest, newest) {
      reads.push({ oldest, newest });
      return new Set(storedDays);
    },
    async writeRow(row) {
      writes.push(row);
    },
  };
}

// 06:15 UTC on 27 September - the cron's hour. In California it is still
// 23:15 on the 26th, so Apple's yesterday is the 25th.
const CRON_MORNING = Date.UTC(2026, 8, 27, 6, 15);

(async () => {
  const report = await import(pathToFileURL(path.join(functionDir, "report.ts")).href);

  /* ----------------------------------------------------- the allowlist --- */

  assert.deepStrictEqual(
    [...report.FIRST_DOWNLOAD_PRODUCT_TYPES].sort(),
    ["1", "1F", "1T"],
    "the first-download identifiers changed - check them against Apple's list first"
  );

  for (const [type, what] of [
    ["7", "an update"],
    ["7F", "an update of a universal app"],
    ["7T", "an iPad update"],
    ["3", "a re-download"],
    ["3F", "a re-download of a universal app"],
    ["IA1", "an in-app purchase"],
    ["IA3", "a restored in-app purchase"],
    ["IAY", "a subscription"],
    ["1-B", "an app bundle"],
    ["F1", "a Mac app"],
    ["F7", "a Mac update"],
    ["1E", "a custom app"],
  ]) {
    assert.ok(
      !report.FIRST_DOWNLOAD_PRODUCT_TYPES.has(type),
      `${type} is ${what}, and it is being counted as a download`
    );
  }

  const source = read("supabase/functions/store-stats/report.ts");

  assert.ok(
    source.includes(
      "https://developer.apple.com/help/app-store-connect/reference/reporting/product-type-identifiers/"
    ),
    "the allowlist no longer says where it comes from"
  );

  // The Apple ID the report is filtered on has to be the app the builds go to.
  const eas = JSON.parse(read("eas.json"));

  assert.strictEqual(
    report.FITVEN_APPLE_ID,
    eas.submit.production.ios.ascAppId,
    "store-stats counts a different app than the one eas.json submits to"
  );

  /* ------------------------------------------------------- the report ---- */

  const text = await report.readReportText(
    arrayBufferOf(zlib.gzipSync(Buffer.from(DAY_TSV, "utf8")))
  );

  assert.strictEqual(text, DAY_TSV, "the gzipped report did not come back as the same text");

  const rows = report.parseSalesReport(text);

  assert.strictEqual(rows.length, DAY_ROWS.length, "a row went missing in the parse");
  assert.strictEqual(rows[0]["Product Type Identifier"], "1");
  assert.strictEqual(rows[0]["Apple Identifier"], FITVEN);
  assert.strictEqual(rows[3].Device, "iPad", "the columns are not where the header says");

  const counts = report.countFirstDownloads(rows, { appleId: FITVEN, reportDate: DAY });

  assert.strictEqual(counts.downloads, 9, "first downloads: 5 + 2 + 1 + 1");
  assert.deepStrictEqual(counts.counted, { 1: 7, "1F": 1, "1T": 1 });
  assert.deepStrictEqual(
    counts.excluded,
    { 7: 40, "7F": 3, 3: 9, "3F": 2, IA1: 3 },
    "updates, re-downloads and the purchase have to be left out, and said to be"
  );
  assert.strictEqual(counts.otherAppRows, 1, "the other app's row was not set aside");

  // What summing the whole column would have said: the failure this exists
  // to prevent, a number with nothing wrong about it to look at.
  const wholeColumn = rows.reduce((sum, row) => sum + Number(row.Units), 0);

  assert.strictEqual(wholeColumn, 166);
  assert.notStrictEqual(counts.downloads, wholeColumn);

  // By name, not by position: the same report with its columns in another
  // order, CRLF line endings and a byte-order mark says the same thing.
  const shuffled = [...HEADER].reverse();
  const reordered = report.parseSalesReport(
    "﻿" +
      tsv(
        DAY_ROWS.map((line) => {
          const cells = line.split("\t");
          return shuffled.map((name) => cells[HEADER.indexOf(name)]).join("\t");
        }),
        shuffled
      ).split("\n").join("\r\n")
  );

  assert.strictEqual(
    report.countFirstDownloads(reordered, { appleId: FITVEN, reportDate: DAY }).downloads,
    9,
    "moving the columns changed the count"
  );

  // A report somebody unpacked on the way is still read.
  assert.strictEqual(
    await report.readReportText(arrayBufferOf(Buffer.from(DAY_TSV, "utf8"))),
    DAY_TSV,
    "an uncompressed report was not read"
  );

  // What the parse cannot trust, it refuses rather than skips.
  assert.throws(
    () => report.parseSalesReport(tsv([], HEADER.filter((name) => name !== "Units"))),
    report.ReportFormatError,
    "a report without a Units column was read"
  );
  assert.throws(() => report.parseSalesReport(""), report.ReportFormatError);
  assert.throws(
    () =>
      report.countFirstDownloads(report.parseSalesReport(tsv([reportRow({ type: "1", units: "n/a" })])), {
        appleId: FITVEN,
        reportDate: DAY,
      }),
    report.ReportFormatError,
    "a download with unreadable units was counted as nothing"
  );
  assert.throws(
    () =>
      report.countFirstDownloads(
        report.parseSalesReport(tsv([reportRow({ type: "1", units: 4, date: "09/24/2026" })])),
        { appleId: FITVEN, reportDate: DAY }
      ),
    report.ReportFormatError,
    "a report for another day was accepted under this day's name"
  );

  // A day with only updates is a real zero: Apple answered, and nobody new came.
  assert.strictEqual(
    report.countFirstDownloads(report.parseSalesReport(tsv([reportRow({ type: "7", units: 12 })])), {
      appleId: FITVEN,
      reportDate: DAY,
    }).downloads,
    0
  );

  /* ---------------------------------------------------------- the days --- */

  assert.strictEqual(report.appleToday(CRON_MORNING), "2026-09-26");

  // The day turns at Pacific midnight: 07:00 UTC in summer, 08:00 in winter.
  assert.strictEqual(report.appleToday(Date.UTC(2026, 6, 15, 6, 59)), "2026-07-14");
  assert.strictEqual(report.appleToday(Date.UTC(2026, 6, 15, 7, 0)), "2026-07-15");
  assert.strictEqual(report.appleToday(Date.UTC(2026, 0, 15, 7, 59)), "2026-01-14");
  assert.strictEqual(report.appleToday(Date.UTC(2026, 0, 15, 8, 0)), "2026-01-15");

  const window = report.reportDays(CRON_MORNING);

  assert.strictEqual(window.length, 30);
  assert.strictEqual(window[0], "2026-09-25", "yesterday comes first");
  assert.strictEqual(window[29], "2026-08-27");
  assert.ok(!window.includes("2026-09-26"), "today was asked for; Apple never has it");
  assert.strictEqual(report.shiftDay("2026-03-01", -1), "2026-02-28");
  assert.strictEqual(report.shiftDay("2026-11-02", -1), "2026-11-01", "a DST change moved a day");

  /* ------------------------------------------------------ the request ---- */

  const url = report.buildReportUrl("87654321", DAY);

  assert.ok(url.startsWith("https://api.appstoreconnect.apple.com/v1/salesReports?"));
  assert.ok(!/[[\]]/.test(url), "literal brackets in the query - Apple has answered those with a 400");

  const query = new URL(url).searchParams;

  assert.deepStrictEqual(
    {
      frequency: query.get("filter[frequency]"),
      reportType: query.get("filter[reportType]"),
      reportSubType: query.get("filter[reportSubType]"),
      vendorNumber: query.get("filter[vendorNumber]"),
      reportDate: query.get("filter[reportDate]"),
    },
    {
      frequency: "DAILY",
      reportType: "SALES",
      reportSubType: "SUMMARY",
      vendorNumber: "87654321",
      reportDate: DAY,
    }
  );

  /* ----------------------------------------------- one day, each answer -- */

  async function answer(response) {
    const apple = fakeApple(() => response);
    const outcome = await report.fetchDailyReport({
      fetch: apple.fetch,
      token: "test-token",
      vendorNumber: "87654321",
      reportDate: DAY,
    });

    return { outcome, request: apple.requests[0] };
  }

  {
    const { outcome, request } = await answer(gzipResponse(DAY_TSV));

    assert.strictEqual(outcome.kind, "report");
    assert.strictEqual(outcome.downloads, 9);
    assert.strictEqual(request.init.method, "GET");
    assert.strictEqual(request.init.headers.Authorization, "Bearer test-token");
    assert.strictEqual(request.init.headers.Accept, "application/a-gzip");
  }

  {
    const { outcome } = await answer(noSales());

    assert.strictEqual(outcome.kind, "no_report", "a 404 is not a failure");
    assert.strictEqual(outcome.noSales, true);
    assert.strictEqual(outcome.code, "NOT_FOUND");
  }

  for (const [status, response] of [
    [401, notAuthorized()],
    [403, appleError(403, "FORBIDDEN_ERROR", "The API key in use does not allow this request")],
  ]) {
    const { outcome } = await answer(response);

    assert.strictEqual(outcome.kind, "auth_failed", `${status} was not read as a refused key`);
    assert.strictEqual(outcome.status, status);
  }

  for (const status of [500, 502, 503]) {
    const { outcome } = await answer(appleError(status, "UNEXPECTED_ERROR", "An unexpected error occurred."));

    assert.strictEqual(outcome.kind, "transient", `${status} was not read as Apple's side for now`);
  }

  {
    const { outcome } = await answer(new TypeError("fetch failed"));

    assert.strictEqual(outcome.kind, "transient", "a dropped connection is not a result");
    assert.strictEqual(outcome.status, null);
  }

  {
    const { outcome } = await answer(appleError(429, "RATE_LIMIT_EXCEEDED", "Too many requests"));

    assert.strictEqual(outcome.kind, "rate_limited");
  }

  {
    const { outcome } = await answer(
      new Response("<!doctype html><html><h1>HTTP Status 400 – Bad Request</h1></html>", {
        status: 400,
        headers: { "Content-Type": "text/html" },
      })
    );

    assert.strictEqual(outcome.kind, "rejected");
    assert.match(outcome.detail, /400/, "the HTML body did not reach the message");
  }

  {
    const { outcome } = await answer(
      new Response(Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0x01, 0x02, 0x03]), { status: 200 })
    );

    assert.strictEqual(outcome.kind, "unreadable", "a broken report became a number");
  }

  /* ---------------------------------------------------------- the run ---- */

  function run(apple, table, options = {}) {
    return report.runIosStoreStats({
      fetch: apple.fetch,
      token: "test-token",
      vendorNumber: "87654321",
      readStoredDays: table.readStoredDays,
      writeRow: table.writeRow,
      now: CRON_MORNING,
      ...options,
    });
  }

  // A month on the cron's morning: two days already stored, one report, two
  // failures on Apple's side, one report not there yet, and "no sales" for
  // the rest - which is what every day looks like until the app is released.
  {
    const apple = fakeApple((day) => {
      if (day === "2026-09-25") {
        return gzipResponse(tsv([reportRow({ type: "1", units: 3 }), reportRow({ type: "7", units: 10 })]));
      }

      if (day === "2026-09-23") {
        return appleError(503, "UNEXPECTED_ERROR", "Try again later.");
      }

      if (day === "2026-09-22") {
        return new TypeError("fetch failed");
      }

      if (day === "2026-09-21") {
        return appleError(404, "NOT_FOUND", "Report is not available yet.");
      }

      return noSales();
    });
    const table = fakeTable(["2026-09-24", "2026-09-10"]);
    const summary = await run(apple, table);

    assert.deepStrictEqual(table.reads, [{ oldest: "2026-08-27", newest: "2026-09-25" }]);

    const asked = apple.requests.map((request) => request.day);

    assert.strictEqual(asked.length, 28, "a stored day was asked for again, or a missing one was not");
    assert.ok(!asked.includes("2026-09-24") && !asked.includes("2026-09-10"));
    assert.ok(!asked.includes("2026-09-26") && !asked.includes("2026-09-27"), "today was asked for");
    assert.deepStrictEqual(asked.slice(0, 3), ["2026-09-25", "2026-09-23", "2026-09-22"], "newest first");
    assert.strictEqual(apple.maxInFlight, 1, "two requests went to Apple at once");

    // The one report is the one row. Its rating is not in it, and no day that
    // Apple had nothing for turned into a zero.
    assert.strictEqual(table.writes.length, 1, "a day without a report was written");
    assert.deepStrictEqual(Object.keys(table.writes[0]).sort(), ["day", "downloads", "platform", "updated_at"]);
    assert.strictEqual(table.writes[0].day, "2026-09-25");
    assert.strictEqual(table.writes[0].platform, "ios");
    assert.strictEqual(table.writes[0].downloads, 3, "the update beside the download was counted");
    assert.ok(!table.writes.some((row) => row.downloads === 0), "a zero was written for a day Apple had no report for");

    assert.strictEqual(summary.ok, true);
    assert.strictEqual(summary.stoppedBy, null);
    assert.strictEqual(summary.alreadyStored, 2);
    assert.strictEqual(summary.noSales.length, 24);
    assert.deepStrictEqual(summary.noReport, [{ day: "2026-09-21", detail: "Report is not available yet." }]);
    assert.deepStrictEqual(
      summary.skipped.map((entry) => [entry.day, entry.kind]),
      [
        ["2026-09-23", "transient"],
        ["2026-09-22", "transient"],
      ],
      "a failure on Apple's side stopped the run, or was not kept for the next one"
    );
  }

  // Before release: thirty "no sales", no rows at all. The dashboard's em
  // dash depends on exactly this.
  {
    const apple = fakeApple(() => noSales());
    const table = fakeTable();
    const summary = await run(apple, table);

    assert.strictEqual(apple.requests.length, 30);
    assert.deepStrictEqual(table.writes, [], "a day without data produced a row");
    assert.strictEqual(summary.ok, true, "no sales is the right answer, not a failure");
  }

  // A refused key stops at the first day and is loud about it.
  for (const [status, response] of [
    [401, notAuthorized],
    [403, () => appleError(403, "FORBIDDEN_ERROR", "The API key in use does not allow this request")],
  ]) {
    const apple = fakeApple(response);
    const table = fakeTable();
    const summary = await run(apple, table);

    assert.strictEqual(apple.requests.length, 1, `a ${status} did not stop the run`);
    assert.deepStrictEqual(table.writes, []);
    assert.strictEqual(summary.ok, false);
    assert.strictEqual(summary.stoppedBy, "auth_failed");
    assert.match(summary.problems[0], new RegExp(`refused the key.*${status}`));
  }

  // Too many requests: stop, quietly - tomorrow's run carries on.
  {
    const apple = fakeApple(() => appleError(429, "RATE_LIMIT_EXCEEDED", "Too many requests"));
    const summary = await run(apple, fakeTable());

    assert.strictEqual(apple.requests.length, 1);
    assert.strictEqual(summary.stoppedBy, "rate_limited");
    assert.strictEqual(summary.ok, true);
  }

  // A request Apple refuses, or a report that cannot be read, costs that day
  // only - but the run says so.
  {
    const apple = fakeApple((day) => {
      if (day === "2026-09-25") {
        return appleError(400, "PARAMETER_ERROR.INVALID", "Invalid vendor number.");
      }

      if (day === "2026-09-24") {
        return gzipResponse(tsv([reportRow({ type: "1", units: 4, date: "09/20/2026" })]));
      }

      return noSales();
    });
    const table = fakeTable();
    const summary = await run(apple, table);

    assert.strictEqual(apple.requests.length, 30, "one bad day stopped the others");
    assert.deepStrictEqual(table.writes, []);
    assert.strictEqual(summary.ok, false);
    assert.strictEqual(summary.problems.length, 2);
    assert.match(summary.problems[0], /2026-09-25.*400 PARAMETER_ERROR\.INVALID/);
    assert.match(summary.problems[1], /2026-09-24.*could not be read/);
  }

  // A slow Apple ends in a summary, not in the runtime killing the function.
  {
    let now = 0;
    const apple = fakeApple(() => {
      now += 40_000;
      return noSales();
    });
    const summary = await run(apple, fakeTable(), { clock: () => now, budgetMs: 100_000 });

    assert.strictEqual(summary.stoppedBy, "time");
    assert.strictEqual(apple.requests.length, 3);
  }

  // Everything already stored: Apple is not asked at all.
  {
    const apple = fakeApple(() => {
      throw new Error("asked for a stored day");
    });
    const summary = await run(apple, fakeTable(report.reportDays(CRON_MORNING)));

    assert.strictEqual(apple.requests.length, 0);
    assert.strictEqual(summary.alreadyStored, 30);
  }

  /* ------------------------------------------------------- the upsert ---- */

  function fakeSupabase({ storedDays = [], error = null } = {}) {
    const calls = [];

    return {
      calls,
      from(table) {
        return {
          select(columns) {
            const call = { op: "select", table, columns, filters: [] };
            calls.push(call);

            const builder = {
              eq: (column, value) => (call.filters.push(["eq", column, value]), builder),
              gte: (column, value) => (call.filters.push(["gte", column, value]), builder),
              lte: (column, value) => (call.filters.push(["lte", column, value]), builder),
              then: (resolve, reject) =>
                Promise.resolve({
                  data: error ? null : storedDays.map((day) => ({ day })),
                  error,
                }).then(resolve, reject),
            };

            return builder;
          },
          upsert(row, options) {
            calls.push({ op: "upsert", table, row, options });
            return Promise.resolve({ data: null, error });
          },
        };
      },
    };
  }

  {
    const client = fakeSupabase({ storedDays: ["2026-09-24"] });
    const table = report.storeStatsTable(client);
    const stored = await table.readStoredDays("2026-08-27", "2026-09-25");

    assert.deepStrictEqual([...stored], ["2026-09-24"]);
    assert.deepStrictEqual(client.calls[0], {
      op: "select",
      table: "store_stats",
      columns: "day",
      filters: [
        ["eq", "platform", "ios"],
        ["gte", "day", "2026-08-27"],
        ["lte", "day", "2026-09-25"],
      ],
    });

    const row = { day: DAY, platform: "ios", downloads: 9, updated_at: "2026-09-27T06:15:00.000Z" };

    await table.writeRow(row);

    assert.deepStrictEqual(client.calls[1], {
      op: "upsert",
      table: "store_stats",
      row,
      options: { onConflict: "day,platform" },
    });
    assert.ok(
      !("rating" in client.calls[1].row) && !("rating_count" in client.calls[1].row),
      "the upsert names the rating, so it would wipe one written by anything else"
    );

    // What PostgREST hands back is a plain object, not an Error.
    const refused = { message: "permission denied for table store_stats", code: "42501" };
    const failing = report.storeStatsTable(fakeSupabase({ error: refused }));
    const isRefusal = (error) => error === refused;

    await assert.rejects(() => failing.readStoredDays("2026-08-27", "2026-09-25"), isRefusal);
    await assert.rejects(() => failing.writeRow(row), isRefusal, "a failed write was taken as written");
  }

  /* -------------------------------------------------------- the token ---- */

  // A throwaway P-256 key, made here and never stored.
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" });
  const issuedAt = Date.UTC(2026, 8, 27, 6, 15, 0);
  const token = await report.createAppStoreConnectToken({
    privateKeyPem: pem,
    keyId: "TESTKEY123",
    issuerId: "00000000-0000-0000-0000-000000000000",
    now: issuedAt,
  });
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  const decode = (part) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));

  assert.deepStrictEqual(decode(encodedHeader), { alg: "ES256", kid: "TESTKEY123", typ: "JWT" });
  assert.deepStrictEqual(decode(encodedPayload), {
    iss: "00000000-0000-0000-0000-000000000000",
    iat: issuedAt / 1000,
    exp: issuedAt / 1000 + 600,
    aud: "appstoreconnect-v1",
  });
  assert.ok(!("sub" in decode(encodedPayload)), "a team key's token carries no sub");

  // r||s, not DER: 64 bytes, verifiable as IEEE P1363 and not as DER. With
  // DER Apple answers 401 and says nothing about why.
  const signature = Buffer.from(encodedSignature, "base64url");
  const signed = Buffer.from(`${encodedHeader}.${encodedPayload}`);

  assert.strictEqual(signature.length, 64, "the signature is not the raw r||s pair");
  assert.ok(
    crypto.verify("sha256", signed, { key: publicKey, dsaEncoding: "ieee-p1363" }, signature),
    "the token does not verify with the key's public half"
  );

  let verifiesAsDer;

  try {
    verifiesAsDer = crypto.verify("sha256", signed, { key: publicKey, dsaEncoding: "der" }, signature);
  } catch {
    verifiesAsDer = false;
  }

  assert.strictEqual(verifiesAsDer, false, "the signature reads as DER");

  // The shapes a .p8 arrives in once it is a secret: \n written out, or the
  // line breaks lost in a one-line field. Both are the same key.
  for (const shape of [pem.replace(/\n/g, "\\n"), pem.replace(/\n/g, "")]) {
    const other = await report.createAppStoreConnectToken({
      privateKeyPem: shape,
      keyId: "TESTKEY123",
      issuerId: "00000000-0000-0000-0000-000000000000",
      now: issuedAt,
    });
    const [h, p, s] = other.split(".");

    assert.ok(
      crypto.verify("sha256", Buffer.from(`${h}.${p}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url")),
      "a key without its line breaks did not sign"
    );
  }

  // A wrong key says so, and says nothing of what it was given. Plain base64
  // of "Not a key at all", with no armour lines, so no secret scanner takes
  // this file for one that holds a key.
  const notAKey = "Tm90IGEga2V5IGF0IGFsbA==";

  await assert.rejects(
    () =>
      report.createAppStoreConnectToken({
        privateKeyPem: notAKey,
        keyId: "TESTKEY123",
        issuerId: "00000000-0000-0000-0000-000000000000",
      }),
    (error) => /ASC_PRIVATE_KEY/.test(error.message) && !error.message.includes("Tm90IGEga2V5"),
    "a key that cannot be imported did not name the secret, or repeated it"
  );

  /* ------------------------------------------------------- the caller ---- */

  assert.strictEqual(report.presentedSecret(new Headers({ "x-store-stats-secret": "from-header" })), "from-header");
  assert.strictEqual(report.presentedSecret(new Headers({ Authorization: "Bearer from-bearer" })), "from-bearer");
  assert.strictEqual(report.presentedSecret(new Headers({ Authorization: "Basic abc" })), null);
  assert.strictEqual(report.presentedSecret(new Headers()), null);

  assert.strictEqual(await report.secretsMatch("s3cret-value", "s3cret-value"), true);
  assert.strictEqual(await report.secretsMatch("s3cret-value", "s3cret-valuf"), false);
  assert.strictEqual(await report.secretsMatch("s3cret-value", "s3cret"), false);
  assert.strictEqual(await report.secretsMatch("s3cret-value", null), false);
  assert.strictEqual(await report.secretsMatch("", ""), false, "an unset secret let a caller in");

  const entry = read("supabase/functions/store-stats/index.ts");
  const secretCheck = entry.indexOf("secretsMatch(expectedSecret");

  assert.ok(secretCheck > 0, "the function no longer checks the cron secret");

  for (const later of ["req.method", 'requireEnv("ASC_PRIVATE_KEY")', "createClient(", "runIosStoreStats("]) {
    assert.ok(entry.indexOf(later) > secretCheck, `${later} runs before the secret is checked`);
  }

  const config = read("supabase/config.toml");

  assert.match(
    config,
    /\[functions\.store-stats\]\s*\nverify_jwt = false/,
    "store-stats needs verify_jwt off - the cron has no JWT to send, and the gateway would refuse it"
  );

  /* ------------------------------------------------- the cron and docs ---- */

  const migration = read(`supabase/migrations/${migrationName}`);
  const unschedule = migration.indexOf("cron.unschedule(");
  const schedule = migration.indexOf("cron.schedule(");

  assert.ok(unschedule > 0 && schedule > unschedule, "the job is scheduled without unscheduling the old one first");
  assert.match(migration, /jobname = 'store-stats-ios-daily'/);
  assert.match(migration, /'store-stats-ios-daily',\s*\n\s*'15 6 \* \* \*'/, "the job no longer runs at 06:15 UTC");
  assert.match(migration, /\/functions\/v1\/store-stats/);
  assert.ok(migration.includes(`'${report.SECRET_HEADER}'`), "the cron sends the secret in a header the function does not read");

  for (const vaultName of ["project_url", "store_stats_cron_secret"]) {
    assert.match(
      migration,
      new RegExp(`vault\\.decrypted_secrets where name = '${vaultName}'`),
      `the job does not read ${vaultName} from Vault`
    );
  }

  assert.match(
    migration,
    /where secret\.project_url is not null\s*\n\s*and secret\.cron_secret is not null/,
    "without its Vault secrets the job would send a request anyway"
  );
  assert.ok(
    !/eyJ[\w-]{10,}|sb_(secret|publishable)_|BEGIN [A-Z ]*PRIVATE KEY|https:\/\/[a-z0-9]{20}\.supabase\.co/.test(
      migration
    ),
    "the migration holds a key, a token or the project's address - those belong in Vault"
  );

  // Every secret the function reads is one the migration tells you to create.
  const header = migration.slice(0, migration.indexOf("\nbegin;"));
  const readSecrets = [...entry.matchAll(/(?:requireEnv|Deno\.env\.get)\("([A-Z_]+)"\)/g)]
    .map((match) => match[1])
    .filter((name) => !name.startsWith("SUPABASE_"));

  assert.deepStrictEqual(
    [...new Set(readSecrets)].sort(),
    ["ASC_ISSUER_ID", "ASC_KEY_ID", "ASC_PRIVATE_KEY", "ASC_VENDOR_NUMBER", "STORE_STATS_CRON_SECRET"]
  );

  for (const name of readSecrets) {
    assert.ok(header.includes(name), `the migration's header does not say to create ${name}`);
  }

  const ledger = read("supabase/migrations/README.md");

  // It was run on 2026-09-26, once pg_cron and pg_net were switched on.
  assert.ok(
    ledger.includes(`| \`${migrationName}\` | yes |`),
    "the ledger has to record the cron migration as run"
  );

  console.log(
    "Store stats: the allowlist, the gzipped report by column name, the Pacific day, each of Apple's answers, the run and its gaps, the upsert, the token and the cron passed."
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
