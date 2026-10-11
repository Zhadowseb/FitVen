// Fills public.store_stats with Android installs from Google Play.
//
// Google Play has no "sales report" API for installs. What it has is the bulk
// reports of the Play Console: CSV files in a Cloud Storage bucket that belongs
// to the developer account (Play Console -> Download reports -> Statistics ->
// "Copy Cloud Storage URI", which reads gs://pubsite_prod_rev_<number>/). One file
// for each month and app, `stats/installs/installs_<package>_<YYYYMM>_overview.csv`,
// with a row for each day. A Google service account that has been given the
// permission "View app information and download bulk reports" in the Play
// Console can read it - nothing else. No key is in the repository or the app:
// the service account's JSON is the function's secret PLAY_SERVICE_ACCOUNT_JSON.
//
// What counts as an Android "download" here is "Daily User Installs": the
// users who installed the app on any of their devices that day. That is the
// nearest thing to the iOS first downloads (report.ts), which leave out updates
// and re-downloads. It is not the same number and the dashboard should not
// pretend it is; the first real one has to be compared by hand with the Play
// Console's Statistics page before it is trusted.
//
// Same shape as the iOS run: the days that are stored are not asked for again,
// every answer of Google's becomes part of a summary and nothing is thrown at
// the caller but the database refusing a read or a write.
import { shiftDay } from "./report.ts";
import type { FetchLike, StoreStatsRow } from "./report.ts";

export const ANDROID = "android";
export const PLAY_PACKAGE_NAME = "com.anonymous.programapp";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const STORAGE_SCOPE = "https://www.googleapis.com/auth/devstorage.read_only";
export const ANDROID_BACKFILL_DAYS = 30;

const STORAGE_OBJECT_URL = "https://storage.googleapis.com/storage/v1/b";
const TOKEN_LIFETIME_SECONDS = 3600;
const DAY_MS = 86_400_000;
const DAY_COLUMN = "Date";
const PACKAGE_COLUMN = "Package Name";
const USER_INSTALLS_COLUMN = "Daily User Installs";

export type PlayOutcome =
  | { kind: "report"; days: Map<string, number> }
  | { kind: "no_report"; detail: string }
  | { kind: "auth_failed"; status: number; detail: string }
  | { kind: "rate_limited"; status: number; detail: string }
  | { kind: "rejected"; status: number; detail: string }
  | { kind: "unreadable"; detail: string };

export type AndroidRunSummary = {
  ok: boolean;
  window: { oldest: string; newest: string };
  alreadyStored: number;
  written: Array<{ day: string; downloads: number }>;
  notInReport: string[];
  noReport: Array<{ month: string; detail: string }>;
  stoppedBy: "auth_failed" | "rate_limited" | null;
  problems: string[];
};

export type ServiceAccount = { client_email: string; private_key: string };

/* --------------------------------------------------------------- the key -- */

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

/**
 * The service account out of the secret. It is the JSON file Google gives when
 * a key is made, pasted whole. Nothing of the key is repeated in a message.
 */
export function parseServiceAccount(secret: string): ServiceAccount {
  let parsed: Partial<ServiceAccount>;

  try {
    parsed = JSON.parse(secret);
  } catch {
    throw new Error("PLAY_SERVICE_ACCOUNT_JSON is not the JSON file of a service account key");
  }

  if (!parsed?.client_email || !parsed?.private_key) {
    throw new Error("PLAY_SERVICE_ACCOUNT_JSON has no client_email and private_key");
  }

  return { client_email: parsed.client_email, private_key: parsed.private_key };
}

function pemToDer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/\\n/g, "\n")
    .replace(/-----(BEGIN|END)[A-Z ]*-----/g, "")
    .replace(/\s+/g, "");

  if (!body) {
    throw new Error("The service account's private_key is empty between its BEGIN and END lines");
  }

  let binary: string;

  try {
    binary = atob(body);
  } catch {
    throw new Error("The service account's private_key is not base64 between its BEGIN and END lines");
  }

  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

/** The signed request for an access token: RS256, one hour, read-only storage. */
export async function createServiceAccountAssertion(
  account: ServiceAccount,
  now = Date.now()
): Promise<string> {
  const issuedAt = Math.floor(now / 1000);
  const signingInput =
    `${base64UrlJson({ alg: "RS256", typ: "JWT" })}.` +
    base64UrlJson({
      iss: account.client_email,
      scope: STORAGE_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: issuedAt,
      exp: issuedAt + TOKEN_LIFETIME_SECONDS,
    });
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput))
  );

  return `${signingInput}.${base64Url(signature)}`;
}

/** The access token, or the reason Google gave for refusing it. */
export async function fetchAccessToken({
  fetch,
  account,
  now = Date.now(),
  timeoutMs = 20_000,
}: {
  fetch: FetchLike;
  account: ServiceAccount;
  now?: number;
  timeoutMs?: number;
}): Promise<{ ok: true; token: string } | { ok: false; status: number; detail: string }> {
  const assertion = await createServiceAccountAssertion(account, now);
  let response: Response;

  try {
    response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }).toString(),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    return { ok: false, status: 0, detail: `no answer from Google: ${(error as Error).message}` };
  }

  let body: { access_token?: string; error?: string; error_description?: string } = {};

  try {
    body = await response.json();
  } catch {
    // Not JSON: the status says enough.
  }

  if (response.ok && body.access_token) {
    return { ok: true, token: body.access_token };
  }

  return {
    ok: false,
    status: response.status,
    detail: [body.error, body.error_description].filter(Boolean).join(": ") || `HTTP ${response.status}`,
  };
}

/* ------------------------------------------------------------ the report -- */

/** The month a day is in, as Google names the file: 202609. */
export function monthOf(day: string): string {
  return day.slice(0, 7).replace("-", "");
}

/** The months that cover a window, newest first. */
export function monthsOf(oldest: string, newest: string): string[] {
  const months: string[] = [];

  for (let day = newest; day >= oldest; day = shiftDay(day, -1)) {
    const month = monthOf(day);

    if (months[months.length - 1] !== month) {
      months.push(month);
    }
  }

  return months;
}

/** The object in the bucket: stats/installs/installs_<package>_<YYYYMM>_overview.csv */
export function installsObjectName(packageName: string, month: string): string {
  return `stats/installs/installs_${packageName}_${month}_overview.csv`;
}

export function buildObjectUrl(bucket: string, objectName: string): string {
  return `${STORAGE_OBJECT_URL}/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}?alt=media`;
}

/**
 * The text of a report. Play writes UTF-16 little endian with a byte order
 * mark; a file that is not (a test, or a day Google changes its mind) is read as
 * UTF-8.
 */
export function readReportText(body: ArrayBuffer): string {
  const bytes = new Uint8Array(body);

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  }

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    // Big endian: swap, then read as little endian.
    const swapped = new Uint8Array(bytes.length - 2);

    for (let index = 2; index + 1 < bytes.length; index += 2) {
      swapped[index - 2] = bytes[index + 1];
      swapped[index - 1] = bytes[index];
    }

    return new TextDecoder("utf-16le").decode(swapped);
  }

  return new TextDecoder("utf-8").decode(bytes).replace(/^﻿/, "");
}

// A CSV line with quoted fields, which Play uses when a value has a comma.
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  fields.push(current);

  return fields;
}

export class PlayReportFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlayReportFormatError";
  }
}

/**
 * The users who installed the app on each day, as { "2026-09-25": 7 }, from the
 * text of an installs overview. Rows of another package are left out (the file
 * is one app's, but the column is there to be believed). A file without the
 * columns this needs is an error, not an empty month: an empty month would
 * write zeros over days nobody has looked at.
 */
export function parseInstallsReport(text: string, packageName: string): Map<string, number> {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    throw new PlayReportFormatError("the report is empty");
  }

  const header = splitCsvLine(lines[0]).map((name) => name.trim());
  const dayIndex = header.indexOf(DAY_COLUMN);
  const installsIndex = header.indexOf(USER_INSTALLS_COLUMN);
  const packageIndex = header.indexOf(PACKAGE_COLUMN);

  if (dayIndex === -1 || installsIndex === -1) {
    throw new PlayReportFormatError(
      `the report has no "${DAY_COLUMN}" and "${USER_INSTALLS_COLUMN}" columns (it has ${header.join(", ")})`
    );
  }

  const days = new Map<string, number>();

  for (const line of lines.slice(1)) {
    const fields = splitCsvLine(line);

    if (packageIndex !== -1 && fields[packageIndex]?.trim() !== packageName) {
      continue;
    }

    const day = fields[dayIndex]?.trim();
    const installs = Number(fields[installsIndex]?.trim());

    if (!/^\d{4}-\d{2}-\d{2}$/.test(day ?? "") || !Number.isFinite(installs) || installs < 0) {
      continue;
    }

    days.set(day, Math.round(installs));
  }

  return days;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json();

    return (
      body?.error?.message ??
      (typeof body?.error === "string" ? body.error : null) ??
      `HTTP ${response.status}`
    );
  } catch {
    return `HTTP ${response.status}`;
  }
}

/** One month's installs overview: what Google answered, as an outcome. */
export async function fetchMonthReport({
  fetch,
  token,
  bucket,
  packageName,
  month,
  timeoutMs = 20_000,
}: {
  fetch: FetchLike;
  token: string;
  bucket: string;
  packageName: string;
  month: string;
  timeoutMs?: number;
}): Promise<PlayOutcome> {
  let response: Response;

  try {
    response = await fetch(buildObjectUrl(bucket, installsObjectName(packageName, month)), {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    return { kind: "unreadable", detail: `no answer from Google: ${(error as Error).message}` };
  }

  if (response.ok) {
    try {
      return {
        kind: "report",
        days: parseInstallsReport(readReportText(await response.arrayBuffer()), packageName),
      };
    } catch (error) {
      return { kind: "unreadable", detail: (error as Error).message };
    }
  }

  const detail = await readError(response);

  // No file for the month: the app had no install that month, or Google has not
  // written it yet. Not a failure.
  if (response.status === 404) {
    return { kind: "no_report", detail };
  }

  if (response.status === 401 || response.status === 403) {
    return { kind: "auth_failed", status: response.status, detail };
  }

  if (response.status === 429) {
    return { kind: "rate_limited", status: response.status, detail };
  }

  return { kind: "rejected", status: response.status, detail };
}

/* --------------------------------------------------------------- the run -- */

/**
 * Reads the months the last thirty days are in and writes the days that are not
 * stored yet. Yesterday is the newest day asked for: Google writes a day's row
 * after it has ended, and a day it has not written is simply asked for again by
 * the next run.
 */
export async function runAndroidStoreStats({
  fetch,
  token,
  bucket,
  packageName = PLAY_PACKAGE_NAME,
  readStoredDays,
  writeRow,
  now = Date.now(),
  days = ANDROID_BACKFILL_DAYS,
  clock = Date.now,
  timeoutMs = 20_000,
}: {
  fetch: FetchLike;
  token: string;
  bucket: string;
  packageName?: string;
  readStoredDays: (oldest: string, newest: string) => Promise<Set<string>>;
  writeRow: (row: StoreStatsRow) => Promise<void>;
  now?: number;
  days?: number;
  clock?: () => number;
  timeoutMs?: number;
}): Promise<AndroidRunSummary> {
  const today = new Date(now).toISOString().slice(0, 10);
  const newest = shiftDay(today, -1);
  const oldest = shiftDay(newest, -(days - 1));
  const stored = await readStoredDays(oldest, newest);
  const wanted: string[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    wanted.push(shiftDay(newest, -offset));
  }

  const pending = wanted.filter((day) => !stored.has(day));
  const summary: AndroidRunSummary = {
    ok: true,
    window: { oldest, newest },
    alreadyStored: wanted.length - pending.length,
    written: [],
    notInReport: [],
    noReport: [],
    stoppedBy: null,
    problems: [],
  };

  if (pending.length === 0) {
    return summary;
  }

  for (const month of monthsOf(pending[pending.length - 1], pending[0])) {
    const outcome = await fetchMonthReport({ fetch, token, bucket, packageName, month, timeoutMs });

    if (outcome.kind === "no_report") {
      summary.noReport.push({ month, detail: outcome.detail });
      continue;
    }

    if (outcome.kind === "auth_failed") {
      summary.ok = false;
      summary.stoppedBy = "auth_failed";
      summary.problems.push(
        `Google refused the service account for ${month} (HTTP ${outcome.status}: ${outcome.detail}). ` +
          "A 403 usually means the account has not been given \"View app information and download bulk reports\" " +
          "in the Play Console's Users and permissions, or PLAY_REPORTS_BUCKET is not this developer account's. " +
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
        `Google refused the request for ${month} (HTTP ${outcome.status}: ${outcome.detail}). Nothing was written for it.`
      );
      continue;
    }

    if (outcome.kind === "unreadable") {
      summary.ok = false;
      summary.problems.push(`The report for ${month} could not be read: ${outcome.detail}. Nothing was written for it.`);
      continue;
    }

    for (const day of pending.filter((entry) => monthOf(entry) === month)) {
      const installs = outcome.days.get(day);

      if (installs === undefined) {
        // Not in the file (yet): a dash on the dashboard, never a zero.
        summary.notInReport.push(day);
        continue;
      }

      await writeRow({
        day,
        platform: ANDROID,
        downloads: installs,
        updated_at: new Date(clock()).toISOString(),
      });
      summary.written.push({ day, downloads: installs });
    }
  }

  return summary;
}

// Typed loosely on purpose, like storeStatsTable: only this corner of supabase-js is used.
// deno-lint-ignore no-explicit-any
type SupabaseLike = { from(table: string): any };

/** The stored Android days, for the run's `readStoredDays`. */
export function androidStoredDays(client: SupabaseLike) {
  return async (oldest: string, newest: string): Promise<Set<string>> => {
    const { data, error } = await client
      .from("store_stats")
      .select("day")
      .eq("platform", ANDROID)
      .gte("day", oldest)
      .lte("day", newest);

    if (error) {
      throw error;
    }

    return new Set((data ?? []).map((row: { day: string }) => row.day));
  };
}
