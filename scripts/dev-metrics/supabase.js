// The write: one upsert per row into public.dev_metrics over Supabase REST,
// with the service key. One request per row, so a row the database refuses
// costs that row and not the rest.

const TABLE = "dev_metrics";

function readCredentials(env) {
  const url = String(env.SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

  return url && key ? { url, key } : null;
}

// The legacy service_role key is a JWT and goes in both headers. The newer
// secret keys (sb_secret_...) are not JWTs: Supabase takes them in `apikey`
// only, and one in Authorization is refused as an invalid JWT.
function isJwt(key) {
  return /^eyJ[\w-]*\.[\w-]*\.[\w-]*$/.test(key);
}

function upsertRequest({ url, key }, row) {
  return {
    endpoint: `${url}/rest/v1/${TABLE}?on_conflict=key,platform`,
    init: {
      method: "POST",
      headers: {
        apikey: key,
        ...(isJwt(key) ? { Authorization: `Bearer ${key}` } : {}),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify([row]),
    },
  };
}

// What went wrong, without the address or the key: PostgREST's own message
// when there is one, the status when there is not.
async function describeFailure(response) {
  let detail = "";

  try {
    const body = await response.text();

    try {
      const parsed = JSON.parse(body);

      detail = [parsed.code, parsed.message, parsed.hint].filter(Boolean).join(" - ");
    } catch {
      detail = body.slice(0, 200);
    }
  } catch {
    // The status alone will have to do.
  }

  return `HTTP ${response.status}${detail ? `: ${detail}` : ""}`;
}

module.exports = { TABLE, describeFailure, readCredentials, upsertRequest };
