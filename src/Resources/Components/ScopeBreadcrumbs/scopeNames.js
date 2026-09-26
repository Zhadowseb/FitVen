import { countryNameKey, countryWhereKey } from "@utils/gymCategories";

// What a level is called, and what it is called after a preposition - "Denmark"
// and "in Denmark", "Zealand" and "on Zealand" - for titles, breadcrumbs,
// "Centres on Zealand" and "not on Zealand". The preposition cannot be guessed
// from the name ("i Jylland" but "på Sjælland"), so every level brings its own.

// The regions the client knows the phrases for (gyms.regionsWhere), so a
// region from anywhere else does not look up a key that cannot be there.
const KNOWN_REGION_PHRASES = new Set(["sjaelland", "jylland", "fyn", "bornholm"]);

/** A country's name, or its code when the app has no name for it. */
export function countryName(t, code) {
  const upper = String(code ?? "").trim().toUpperCase();
  const key = countryNameKey(upper);
  const name = t(key);

  return name === key ? upper : name;
}

/** "in Denmark" - the country's own phrase, or "in {name}". */
export function countryWhere(t, code) {
  const key = countryWhereKey(code);
  const where = t(key);

  return where === key ? t("gyms.inPlace", { place: countryName(t, code) }) : where;
}

/**
 * "on Zealand": the phrase the server sends with the region, else the
 * client's for Denmark's four, else "in {name}".
 */
export function regionWhere(t, region) {
  if (!region) {
    return null;
  }

  if (typeof region.where === "string" && region.where.trim()) {
    return region.where.trim();
  }

  if (KNOWN_REGION_PHRASES.has(region.key)) {
    return t(`gyms.regionsWhere.${region.key}`);
  }

  return t("gyms.inPlace", { place: region.name ?? region.key });
}

/** "at PureGym Kildeskovshallen". */
export function gymWhere(t, gymName) {
  return t("gyms.atGym", { gym: gymName ?? t("gyms.centre") });
}
