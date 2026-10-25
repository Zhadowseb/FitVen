// A request that cannot hang for ever.
//
// React Native's fetch has no timeout: a connection that stalls - a phone going
// from wifi to mobile data in a pocket, a tunnel, a half-open socket - leaves
// the request waiting for as long as the app lives. Every cloud call in FitVen
// is one of those, and they run one after another in a single queue
// (Services/syncScheduler.js), so one stalled request held up every upload and
// every post behind it, and "Posting your workout..." never ended, in either
// direction. Pure, so scripts/test-social-post-reliability.js runs it in Node.

export const REQUEST_TIMEOUT_MS = 30000;
// A file going up is allowed the time a file needs.
export const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;

/** How long a request to this address may take. */
export function requestTimeoutMs(input) {
  const url = typeof input === "string" ? input : String(input?.url ?? input ?? "");

  return url.includes("/storage/v1/object") ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
}

/**
 * `fetchImpl(input, init)`, aborted after `timeoutMs`. A timeout is an error
 * that says "Network request failed" - the words the app already treats as a
 * bad connection worth another try - and is named TimeoutError, so a caller
 * that wants to retry it less can tell.
 */
export function fetchWithTimeout(fetchImpl, input, init, timeoutMs = requestTimeoutMs(input)) {
  const controller = new AbortController();
  const outer = init?.signal;
  let timedOut = false;

  if (outer) {
    if (outer.aborted) {
      controller.abort();
    } else {
      outer.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  return Promise.resolve(fetchImpl(input, { ...(init ?? {}), signal: controller.signal }))
    .catch((error) => {
      if (timedOut) {
        const timeout = new Error("Network request failed (timed out)");

        timeout.name = "TimeoutError";
        throw timeout;
      }

      throw error;
    })
    .finally(() => clearTimeout(timer));
}
