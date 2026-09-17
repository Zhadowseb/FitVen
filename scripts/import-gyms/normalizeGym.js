// Turns one centre's info.json (as the Python scrapers in data/gyms/<chain>/
// write it) into a row for public.gym. Pure, so scripts/test-gym-leaderboard.js
// can run the naming rules over the real data without touching Supabase.

const CHAIN_FOLDERS = {
  Puregym: "PureGym",
  Sats: "SATS",
  LOOP: "LOOP Fitness",
  FitnessX: "FitnessX",
  FitSund: "Fit&Sund",
};

function clean(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.replace(/\s+/g, " ").trim();

  return trimmed.length ? trimmed : null;
}

/**
 * The name the app shows on a tile: "Bruuns Galleri", not "Aarhus Bruuns
 * Galleri". The chains name centres differently, so this is a stack of rules,
 * first match wins:
 *   1. an explicit short_name in the file (SATS and Fit&Sund write one),
 *      unless it is just the full name again - the SATS scraper does that
 *      for "Køge - Strædet", and then the rules below still apply
 *   2. the chain's first word as a prefix goes: "LOOP Dragør" -> "Dragør"
 *   3. "City, Place" keeps the place: "Gentofte, Kildeskovshallen"
 *   4. "REGION - Place" keeps the place: "KBH - Adelgade"
 *   5. the name as it is: "Ballerup"
 */
function deriveShortName(info) {
  const explicit = clean(info?.short_name);
  const name = clean(info?.name) ?? "";

  if (explicit && explicit !== name) {
    return explicit;
  }
  const chain = clean(info?.chain) ?? "";
  const chainFirstWord = chain.split(/\s+/)[0] ?? "";
  const lowerName = name.toLowerCase();

  for (const prefix of [chain, chainFirstWord].filter(Boolean)) {
    if (lowerName.startsWith(`${prefix.toLowerCase()} `) && name.length > prefix.length + 1) {
      return name.slice(prefix.length).trim();
    }
  }

  const commaIndex = name.lastIndexOf(",");

  if (commaIndex > 0 && commaIndex < name.length - 1) {
    return name.slice(commaIndex + 1).trim();
  }

  const dashIndex = name.indexOf(" - ");

  if (dashIndex > 0 && dashIndex < name.length - 3) {
    return name.slice(dashIndex + 3).trim();
  }

  return name;
}

function toCoordinate(value) {
  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

function pickFacilities(info) {
  const candidates = [info?.facility_names, info?.facilities, info?.features];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) {
      const names = candidate
        .map((entry) => (typeof entry === "string" ? entry : entry?.name))
        .map(clean)
        .filter(Boolean);

      if (names.length) {
        return [...new Set(names)];
      }
    }
  }

  return [];
}

function pickExternalId(info) {
  const id = info?.puregym_id ?? info?.sats_id ?? info?.loop_id ?? info?.fitnessx_id ?? info?.fitsund_id ?? null;

  return id === null || id === undefined ? null : String(id);
}

/** Folder -> chain label, for a folder whose info.json is missing the chain. */
function chainForFolder(folderName) {
  return CHAIN_FOLDERS[folderName] ?? folderName;
}

/** A stable object key for the hero image: "puregym/adolphsvej-25-2820-gentofte.jpg". */
function imageObjectPath(chain, folderName, extension) {
  const slug = (value) =>
    String(value ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/ø/g, "o")
      .replace(/æ/g, "ae")
      .replace(/å/g, "a")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  return `${slug(chain)}/${slug(folderName)}.${extension.replace(/^\./, "").toLowerCase()}`;
}

/**
 * The gym row, minus image_url (the importer fills that in after the upload).
 * Returns null when the file cannot be placed on a map.
 */
function normalizeGym(info, { folderName = null, chainFolder = null } = {}) {
  const latitude = toCoordinate(info?.location?.latitude ?? info?.latitude);
  const longitude = toCoordinate(info?.location?.longitude ?? info?.longitude);
  const name = clean(info?.name);
  const chain = clean(info?.chain) ?? chainForFolder(chainFolder);

  if (!name || !chain || latitude === null || longitude === null) {
    return null;
  }

  const address = info?.address ?? {};

  return {
    chain,
    name,
    short_name: deriveShortName({ ...info, chain, name }),
    address: clean(address.full) ?? clean(address.street) ?? clean(folderName),
    postal_code: clean(address.postal_code),
    city: clean(address.city),
    latitude,
    longitude,
    source_url: clean(info?.url),
    membership_url: clean(info?.membership_url),
    external_id: pickExternalId(info),
    facilities: pickFacilities(info),
    opening_hours: info?.opening_hours_schema ?? info?.opening_hours ?? null,
    description: clean(info?.meta_description) ?? clean(info?.description)?.slice(0, 600) ?? null,
    is_public: true,
  };
}

module.exports = {
  CHAIN_FOLDERS,
  chainForFolder,
  deriveShortName,
  imageObjectPath,
  normalizeGym,
};
