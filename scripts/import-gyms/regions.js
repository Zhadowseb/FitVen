// Where a centre is: its country, and inside Denmark its landsdel, from the
// postal code. Pure, so scripts/test-gym-categories.js can hold it against
// the backfill in supabase/migrations/20260929090000_gym-scope-and-categories.sql,
// which uses the same ranges in the same order. Change one, change both - the
// test reads the migration's lines and fails when the two disagree.

// Every chain in data/gyms is Danish, and so is the column's default.
const DEFAULT_COUNTRY_CODE = "DK";

// First match wins: Bornholm is carved out of the Zealand range before it
// (which includes Lolland-Falster and Møn). Codes below 1000 are post boxes
// and belong to no landsdel.
const DK_POSTAL_REGIONS = [
  { from: 3700, to: 3799, region: "bornholm" },
  { from: 1000, to: 4999, region: "sjaelland" },
  { from: 5000, to: 5999, region: "fyn" },
  { from: 6000, to: 9999, region: "jylland" },
];

/** "dk " -> "DK"; anything that is not two letters -> null. */
function normalizeCountryCode(value) {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";

  return /^[A-Z]{2}$/.test(code) ? code : null;
}

/** "2200" -> "sjaelland"; not four digits, or below 1000 -> null. */
function dkRegionForPostalCode(postalCode) {
  const text = String(postalCode ?? "").trim();

  if (!/^\d{4}$/.test(text)) {
    return null;
  }

  const code = Number(text);

  return DK_POSTAL_REGIONS.find((range) => code >= range.from && code <= range.to)?.region ?? null;
}

/**
 * The centre's { country_code, region_key }, or null when its country is
 * written but is not an ISO code - a centre filed under the wrong country
 * would sit in the wrong list, so the importer skips it and says why.
 *
 *   country    address.country; missing is Denmark
 *   postalCode address.postal_code, for the Danish landsdel
 *   regionKey  an explicit region_key in info.json, which wins - the way a
 *              scraper for another country says where a centre is
 */
function placeOf({ country, postalCode, regionKey } = {}) {
  const written = typeof country === "string" && country.trim() !== "";
  const countryCode = written ? normalizeCountryCode(country) : DEFAULT_COUNTRY_CODE;

  if (!countryCode) {
    return null;
  }

  const explicit = typeof regionKey === "string" && regionKey.trim() !== "" ? regionKey.trim().toLowerCase() : null;

  return {
    country_code: countryCode,
    region_key: explicit ?? (countryCode === "DK" ? dkRegionForPostalCode(postalCode) : null),
  };
}

module.exports = {
  DEFAULT_COUNTRY_CODE,
  DK_POSTAL_REGIONS,
  dkRegionForPostalCode,
  normalizeCountryCode,
  placeOf,
};
