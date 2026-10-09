// Everything that decides the number in the dev dashboard's App Store box.
//
// What counts as a download, how Apple's daily report is asked for and read,
// what each of Apple's answers means, and the run that turns a month of them
// into rows. Neither Deno nor the database is touched from here - both are
// handed in by index.ts - so scripts/test-store-stats.js runs this very file
// in Node, against a fake fetch and a made-up report. Keep it that way: only
// syntax Node can strip (no enums, no namespaces, no imports).
//
// The one thing no test can check is the sum against real sales. Until the app
// is released, every report Apple has for it is "no sales".

export const SALES_REPORTS_URL = "https://api.appstoreconnect.apple.com/v1/salesReports";

// The vendor number is the developer account, not the app, so its report holds
// every app on the account. FitVen's rows are the ones carrying its Apple ID -
// the id eas.json submits builds to; npm test fails if the two drift apart.
export const FITVEN_APPLE_ID = "6769493426";

// First downloads and nothing else. Source, Apple's own list:
// https://developer.apple.com/help/app-store-connect/reference/reporting/product-type-identifiers/
//
//   1    Free or paid app - iOS, iPadOS, visionOS, watchOS
//   1F   Free or paid app - universal app, excluding tvOS
//   1T   Free or paid app - iPad apps
//
// The same report carries updates (7, 7F, 7T) and re-downloads (3, 3F) of the
// same app, row beside row with the first downloads. Summing the whole Units
// column counts all of them, and a total inflated by every update anybody
// installed has no way of looking wrong. Apple's own "App Units" leaves them
// out for the same reason:
// https://developer.apple.com/help/app-store-connect/reference/reporting/sales-and-trends-metrics-and-dimensions/
// Also out: in-app purchases (IA*), app bundles (1-B, F1-B), Mac apps (F1, F7)
// and custom apps for Apple Business Manager (1E, 1EP, 1EU) - FitVen is none
// of them.
export const FIRST_DOWNLOAD_PRODUCT_TYPES: ReadonlySet<string> = new Set([
  "1",
  "1F",
  "1T",
]);

export const BACKFILL_DAYS = 30;
export const STORE_STATS_TABLE = "store_stats";
export const IOS = "ios";
export const SECRET_HEADER = "x-store-stats-secret";

// Apple's reporting day is Pacific Time, midnight to midnight, and a day's
// report is ready by about 8 a.m. PT the morning after. So "yesterday" is
// California's yesterday - not UTC's, and not Denmark's.
const APPLE_TIME_ZONE = "America/Los_Angeles";
// Apple refuses a token that lives longer than twenty minutes, and a run is
// over in a couple.
const TOKEN_LIFETIME_SECONDS = 600;
const DAY_MS = 86_400_000;
const REQUIRED_COLUMNS = [
  "Product Type Identifier",
  "Units",
  "Apple Identifier",
  "Begin Date",
];

type AppleError = {
  status: number | null;
  code: string | null;
  detail: string | null;
};

export type Counts = {
  downloads: number;
  counted: Record<string, number>;
  excluded: Record<string, number>;
  otherAppRows: number;
};

export type ReportOutcome =
  | ({ kind: "report" } & Counts)
  | ({ kind: "no_report"; noSales: boolean } & AppleError)
  | ({ kind: "auth_failed" } & AppleError)
  | ({ kind: "rate_limited" } & AppleError)
  | ({ kind: "transient" } & AppleError)
  | ({ kind: "rejected" } & AppleError)
  | { kind: "unreadable"; status: 200; code: null; detail: string };

export type StoreStatsRow = {
  day: string;
  platform: string;
  downloads: number;
  updated_at: string;
};

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export type RunSummary = {
  ok: boolean;
  window: { oldest: string; newest: string };
  alreadyStored: number;
  written: Array<{
    day: string;
    downloads: number;
    counted: Record<string, number>;
    excluded: Record<string, number>;
  }>;
  noSales: string[];
  noReport: Array<{ day: string; detail: string | null }>;
  skipped: Array<{
    day: string;
    kind: string;
    status: number | null;
    code: string | null;
    detail: string | null;
  }>;
  stoppedBy: "auth_failed" | "rate_limited" | "time" | null;
  problems: string[];
};

/* ------------------------------------------------------------- the days -- */

/** Today's date where Apple keeps its books, as YYYY-MM-DD. */
export function appleToday(now: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APPLE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(now));
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

// Plain calendar arithmetic, done at UTC midnight so no daylight saving change
// can make a day 23 or 25 hours long.
export function shiftDay(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/**
 * Yesterday and the days before it, newest first. Never today: Apple has no
 * report for a day that has not ended.
 */
export function reportDays(now: number, count = BACKFILL_DAYS): string[] {
  const yesterday = shiftDay(appleToday(now), -1);

  return Array.from({ length: count }, (_, index) => shiftDay(yesterday, -index));
}

/* -------------------------------------------------------------- the ask -- */

// URLSearchParams writes the brackets as %5B and %5D. In August 2025 Apple
// began answering literal brackets with a bare HTML 400
// (https://developer.apple.com/forums/thread/796368); the encoded form is
// accepted either way.
export function buildReportUrl(vendorNumber: string, reportDate: string): string {
  const query = new URLSearchParams({
    "filter[frequency]": "DAILY",
    "filter[reportType]": "SALES",
    "filter[reportSubType]": "SUMMARY",
    "filter[vendorNumber]": vendorNumber,
    "filter[reportDate]": reportDate,
  });

  return `${SALES_REPORTS_URL}?${query.toString()}`;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlJson(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

// A .p8 set as a secret arrives in more than one shape: with its line breaks,
// with them written out as \n by a tool, or with them lost by a one-line
// field in a dashboard. All three are the same key once the armour lines and
// the whitespace are gone. No message here repeats any of the key.
function pemToDer(pem: string) {
  const body = pem
    .replace(/\\n/g, "\n")
    .replace(/-----(BEGIN|END)[A-Z ]*-----/g, "")
    .replace(/\s+/g, "");

  if (!body) {
    throw new Error("ASC_PRIVATE_KEY is empty between its BEGIN and END lines");
  }

  let binary: string;

  try {
    binary = atob(body);
  } catch {
    throw new Error("ASC_PRIVATE_KEY is not base64 between its BEGIN and END lines");
  }

  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

/**
 * The bearer token App Store Connect wants: ES256 over the header and payload,
 * signed with the team key's .p8.
 */
export async function createAppStoreConnectToken({
  privateKeyPem,
  keyId,
  issuerId,
  now = Date.now(),
}: {
  privateKeyPem: string;
  keyId: string;
  issuerId: string;
  now?: number;
}): Promise<string> {
  let key: CryptoKey;

  try {
    key = await crypto.subtle.importKey(
      "pkcs8",
      pemToDer(privateKeyPem),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("ASC_PRIVATE_KEY")) {
      throw error;
    }

    throw new Error(
      "ASC_PRIVATE_KEY is not a P-256 private key in PKCS#8 - it should be the whole .p8 file from App Store Connect"
    );
  }

  const issuedAt = Math.floor(now / 1000);
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  // No `sub`: that claim is for an individual key, and this is a team key.
  const payload = {
    iss: issuerId,
    iat: issuedAt,
    exp: issuedAt + TOKEN_LIFETIME_SECONDS,
    aud: "appstoreconnect-v1",
  };
  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      new TextEncoder().encode(signingInput)
    )
  );

  // Apple wants the raw r||s pair, 64 bytes. Web Crypto gives exactly that; a
  // DER signature (70-odd bytes) is answered with a 401 that says nothing
  // about why, so one must never leave here.
  if (signature.length !== 64) {
    throw new Error(`The token signature is ${signature.length} bytes, not the 64 of r||s`);
  }

  return `${signingInput}.${base64Url(signature)}`;
}

/* ------------------------------------------------------------- the read -- */

export class ReportFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportFormatError";
  }
}

async function gunzip(body: ArrayBuffer): Promise<ArrayBuffer> {
  const stream = new Blob([body]).stream().pipeThrough(new DecompressionStream("gzip"));

  return await new Response(stream).arrayBuffer();
}

/**
 * The report's text. A 200 is `application/a-gzip` - a content type, not a
 * content encoding - so fetch hands the bytes over still compressed. The gzip
 * magic number is checked rather than assumed, so a proxy that did unpack it
 * cannot turn a good report into a decode error.
 */
export async function readReportText(body: ArrayBuffer): Promise<string> {
  const head = new Uint8Array(body.slice(0, 2));
  const isGzip = head[0] === 0x1f && head[1] === 0x8b;

  return new TextDecoder("utf-8").decode(isGzip ? await gunzip(body) : body);
}

/**
 * Tab-separated, one header row, read by column name. Apple has added columns
 * to this report over the years; a position that moved would count the wrong
 * column without any error, and a name that moved is still the same name.
 */
export function parseSalesReport(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");

  if (lines.length === 0) {
    throw new ReportFormatError("the report is empty");
  }

  // trim() also takes a byte-order mark off the first name.
  const header = lines[0].split("\t").map((name) => name.trim());
  const missing = REQUIRED_COLUMNS.filter((name) => !header.includes(name));

  if (missing.length > 0) {
    throw new ReportFormatError(`the report has no ${missing.join(", ")} column`);
  }

  return lines.slice(1).map((line) => {
    const cells = line.split("\t");

    return Object.fromEntries(
      header.map((name, index) => [name, (cells[index] ?? "").trim()])
    );
  });
}

// The report writes its dates MM/DD/YYYY.
function isoFromReportDate(value: string): string | null {
  const american = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (american) {
    return `${american[3]}-${american[1]}-${american[2]}`;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/**
 * First downloads of one app on one day, and what was left out beside them.
 *
 * Anything this cannot read throws rather than being skipped. A skipped row is
 * a number that comes out too low and looks fine; a thrown one leaves the day
 * without a row and says why.
 */
export function countFirstDownloads(
  rows: Array<Record<string, string>>,
  { appleId, reportDate }: { appleId: string; reportDate: string }
): Counts {
  const counted: Record<string, number> = {};
  const excluded: Record<string, number> = {};
  let downloads = 0;
  let otherAppRows = 0;

  for (const row of rows) {
    // A report for some other day, filed under this day's name, would be
    // written into the wrong row and look entirely normal.
    if (isoFromReportDate(row["Begin Date"]) !== reportDate) {
      throw new ReportFormatError(
        `a row is dated "${row["Begin Date"]}", and the report asked for was ${reportDate}`
      );
    }

    if (Number(row["Apple Identifier"]) !== Number(appleId)) {
      otherAppRows += 1;
      continue;
    }

    const type = row["Product Type Identifier"];
    const units = Number(row["Units"]);

    if (row["Units"] === "" || !Number.isFinite(units)) {
      throw new ReportFormatError(`a row of type "${type}" has Units "${row["Units"]}"`);
    }

    if (FIRST_DOWNLOAD_PRODUCT_TYPES.has(type)) {
      counted[type] = (counted[type] ?? 0) + units;
      downloads += units;
    } else {
      excluded[type] = (excluded[type] ?? 0) + units;
    }
  }

  // Units is DECIMAL(18,2) in Apple's spec; a download is a whole one.
  return { downloads: Math.round(downloads), counted, excluded, otherAppRows };
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function readAppleError(response: Response): Promise<AppleError> {
  let text = "";

  try {
    text = await response.text();
  } catch {
    // The status alone is enough to decide what happens next.
  }

  let first: { code?: unknown; title?: unknown; detail?: unknown } | undefined;

  try {
    first = JSON.parse(text)?.errors?.[0];
  } catch {
    first = undefined;
  }

  const detail =
    typeof first?.detail === "string"
      ? first.detail
      : typeof first?.title === "string"
        ? first.title
        : text.trim().slice(0, 200) || null;

  return {
    status: response.status,
    code: typeof first?.code === "string" ? first.code : null,
    detail,
  };
}

/**
 * One day's report, and what Apple's answer means for it.
 *
 * - 200: the report. Counted, and written.
 * - 404: Apple has no report for the day. For FitVen that is every day until
 *   it is released - "There were no sales for the date specified." - and a
 *   report that is not ready yet may come back the same way. Neither is a
 *   count of zero, so nothing is written, and since the day has no row the
 *   next run asks again.
 * - 401, 403: the key was refused. Every other day would be refused the same
 *   way, so the run stops there.
 * - 429: too many requests. The run stops; tomorrow's picks up where it left.
 * - 5xx, a timeout, a dropped connection: Apple's side, for now. The day is
 *   skipped and the next run asks for it again.
 * - Anything else: Apple refused this request. Skipped, and said loudly,
 *   because asking again tomorrow is unlikely to change it.
 */
export async function fetchDailyReport({
  fetch,
  token,
  vendorNumber,
  reportDate,
  appleId = FITVEN_APPLE_ID,
  timeoutMs = 20_000,
}: {
  fetch: FetchLike;
  token: string;
  vendorNumber: string;
  reportDate: string;
  appleId?: string;
  timeoutMs?: number;
}): Promise<ReportOutcome> {
  let response: Response;

  try {
    response = await fetch(buildReportUrl(vendorNumber, reportDate), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/a-gzip",
      },
      // One hung request must not use up the whole run.
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    return { kind: "transient", status: null, code: null, detail: describeError(error) };
  }

  if (response.status === 200) {
    let body: ArrayBuffer;

    try {
      body = await response.arrayBuffer();
    } catch (error) {
      return {
        kind: "transient",
        status: 200,
        code: null,
        detail: `the report did not arrive whole: ${describeError(error)}`,
      };
    }

    try {
      const rows = parseSalesReport(await readReportText(body));

      return { kind: "report", ...countFirstDownloads(rows, { appleId, reportDate }) };
    } catch (error) {
      return { kind: "unreadable", status: 200, code: null, detail: describeError(error) };
    }
  }

  const appleError = await readAppleError(response);

  if (response.status === 401 || response.status === 403) {
    return { kind: "auth_failed", ...appleError };
  }

  if (response.status === 404) {
    return {
      kind: "no_report",
      noSales: /no sales/i.test(appleError.detail ?? ""),
      ...appleError,
    };
  }

  if (response.status === 429) {
    return { kind: "rate_limited", ...appleError };
  }

  if (response.status >= 500) {
    return { kind: "transient", ...appleError };
  }

  return { kind: "rejected", ...appleError };
}

/* -------------------------------------------------------------- the run -- */

function describeAppleError({ status, code, detail }: AppleError): string {
  return [status, code, detail].filter((part) => part !== null && part !== "").join(" ");
}

/**
 * Yesterday and the 29 days before it, minus the days already stored, asked
 * for one at a time, newest first.
 *
 * Skipping stored days is what makes a failed run heal itself: a day with no
 * row is asked for again by every run until it has one or falls out of the
 * window. One request at a time is what keeps that gentle on Apple's rate
 * limit. Each row is written as soon as its day is read, so a run cut off
 * half-way keeps what it had.
 */
export async function runIosStoreStats({
  fetch,
  token,
  vendorNumber,
  readStoredDays,
  writeRow,
  appleId = FITVEN_APPLE_ID,
  now = Date.now(),
  days = BACKFILL_DAYS,
  clock = Date.now,
  budgetMs = 100_000,
  timeoutMs = 20_000,
}: {
  fetch: FetchLike;
  token: string;
  vendorNumber: string;
  readStoredDays: (oldest: string, newest: string) => Promise<Set<string>>;
  writeRow: (row: StoreStatsRow) => Promise<void>;
  appleId?: string;
  now?: number;
  days?: number;
  clock?: () => number;
  // Under the Edge Function's wall clock (150 s on the free plan), so a slow
  // day ends in a summary rather than in the runtime killing the function.
  budgetMs?: number;
  timeoutMs?: number;
}): Promise<RunSummary> {
  const wanted = reportDays(now, days);
  const oldest = wanted[wanted.length - 1];
  const newest = wanted[0];
  const stored = await readStoredDays(oldest, newest);
  const pending = wanted.filter((day) => !stored.has(day));
  const startedAt = clock();
  const summary: RunSummary = {
    ok: true,
    window: { oldest, newest },
    alreadyStored: wanted.length - pending.length,
    written: [],
    noSales: [],
    noReport: [],
    skipped: [],
    stoppedBy: null,
    problems: [],
  };

  for (const day of pending) {
    if (clock() - startedAt > budgetMs) {
      summary.stoppedBy = "time";
      break;
    }

    const outcome = await fetchDailyReport({
      fetch,
      token,
      vendorNumber,
      reportDate: day,
      appleId,
      timeoutMs,
    });

    if (outcome.kind === "report") {
      await writeRow({
        day,
        platform: IOS,
        downloads: outcome.downloads,
        updated_at: new Date(clock()).toISOString(),
      });
      summary.written.push({
        day,
        downloads: outcome.downloads,
        counted: outcome.counted,
        excluded: outcome.excluded,
      });
      continue;
    }

    if (outcome.kind === "no_report") {
      if (outcome.noSales) {
        summary.noSales.push(day);
      } else {
        summary.noReport.push({ day, detail: outcome.detail });
      }

      continue;
    }

    summary.skipped.push({
      day,
      kind: outcome.kind,
      status: outcome.status,
      code: outcome.code,
      detail: outcome.detail,
    });

    if (outcome.kind === "auth_failed") {
      summary.ok = false;
      summary.stoppedBy = "auth_failed";
      summary.problems.push(
        `App Store Connect refused the key for ${day} (${describeAppleError(outcome)}). ` +
          (outcome.status === 403
            ? "A 403 usually means the key is valid but lacks the Sales and Reports role. "
            : "ASC_KEY_ID, ASC_ISSUER_ID or ASC_PRIVATE_KEY is wrong, or the key has been revoked. ") +
          "The run stopped there and asked for nothing more."
      );
      break;
    }

    if (outcome.kind === "rate_limited") {
      summary.stoppedBy = "rate_limited";
      break;
    }

    if (outcome.kind === "rejected") {
      summary.ok = false;
      summary.problems.push(
        `Apple refused the request for ${day} (${describeAppleError(outcome)}). Nothing was written for it.`
      );
    }

    if (outcome.kind === "unreadable") {
      summary.ok = false;
      summary.problems.push(
        `The report for ${day} could not be read: ${outcome.detail}. Nothing was written for it.`
      );
    }
  }

  return summary;
}

/* ------------------------------------------------------------ the table -- */

// Typed loosely on purpose: only this corner of supabase-js is used, and the
// test hands in a stand-in with just these calls.
// deno-lint-ignore no-explicit-any
type SupabaseLike = { from(table: string): any };

export function storeStatsTable(client: SupabaseLike) {
  return {
    async readStoredDays(oldest: string, newest: string): Promise<Set<string>> {
      const { data, error } = await client
        .from(STORE_STATS_TABLE)
        .select("day")
        .eq("platform", IOS)
        .gte("day", oldest)
        .lte("day", newest);

      if (error) {
        throw error;
      }

      return new Set((data ?? []).map((row: { day: string }) => row.day));
    },

    // `rating` and `rating_count` are left out rather than sent as null. On an
    // insert they are null anyway, and on a conflict an upsert only touches
    // the columns it names - so this can never wipe a rating that something
    // else wrote to the same row.
    async writeRow(row: StoreStatsRow): Promise<void> {
      const { error } = await client
        .from(STORE_STATS_TABLE)
        .upsert(row, { onConflict: "day,platform" });

      if (error) {
        throw error;
      }
    },
  };
}

/* ----------------------------------------------------------- the caller -- */

/** The cron sends the secret in its own header; a person with curl may use a bearer. */
export function presentedSecret(headers: Headers): string | null {
  const header = headers.get(SECRET_HEADER)?.trim();

  if (header) {
    return header;
  }

  const bearer = headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

  return bearer || null;
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  );
}

/**
 * Compared in constant time. Both sides are hashed first, so the loop always
 * runs over 32 bytes and neither the secret's content nor its length can be
 * read off how long a wrong guess takes to refuse.
 */
export async function secretsMatch(
  expected: string,
  presented: string | null
): Promise<boolean> {
  if (!expected || !presented) {
    return false;
  }

  const [left, right] = await Promise.all([sha256(expected), sha256(presented)]);
  let difference = 0;

  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }

  return difference === 0;
}
