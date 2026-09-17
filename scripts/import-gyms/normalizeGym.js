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
 * Galleri". An explicit short_name in the file wins (SATS and Fit&Sund write
 * one) unless it is just the full name again - the SATS scraper does that for
 * "Køge - Strædet". Otherwise the chains' naming habits are peeled off in
 * turn, each rule working on what the one before left:
 *   1. the chain (or its first word) as a prefix: "LOOP Dragør" -> "Dragør"
 *   2. "City, Place" keeps the place: "Gentofte, Kildeskovshallen"
 *   3. "REGION - Place" keeps the place: "KBH - Adelgade", "Lyngby – Kanalvej"
 * so "LOOP Amager, Strandlodsvej" ends as "Strandlodsvej", and "Ballerup" is
 * left alone. Two centres in one chain that end with the same short name are
 * told apart afterwards by disambiguateShortNames.
 */
function deriveShortName(info) {
  const explicit = clean(info?.short_name);
  const name = clean(info?.name) ?? "";

  if (explicit && explicit !== name) {
    return explicit;
  }

  const chain = clean(info?.chain) ?? "";
  const chainFirstWord = chain.split(/\s+/)[0] ?? "";
  let result = name;

  for (const prefix of [chain, chainFirstWord].filter(Boolean)) {
    if (
      result.toLowerCase().startsWith(`${prefix.toLowerCase()} `) &&
      result.length > prefix.length + 1
    ) {
      result = result.slice(prefix.length).trim();
      break;
    }
  }

  const commaIndex = result.lastIndexOf(",");

  if (commaIndex > 0 && commaIndex < result.length - 1) {
    result = result.slice(commaIndex + 1).trim();
  }

  const dash = result.match(/\s[-–]\s/);

  if (dash && dash.index > 0 && dash.index + dash[0].length < result.length) {
    result = result.slice(dash.index + dash[0].length).trim();
  }

  return result || name;
}

/** "Odense C., Dannebrogsgade" -> "Odense C."; otherwise the address city. */
function cityLabel(row) {
  const name = clean(row?.name) ?? "";
  const commaIndex = name.indexOf(",");

  if (commaIndex > 0) {
    return name.slice(0, commaIndex).trim();
  }

  return clean(row?.city);
}

/**
 * Two centres of one chain must not share a short name - a tile saying
 * "Dannebrogsgade" would mean Odense to one person and Aalborg to another.
 * Colliding rows get their city appended: "Dannebrogsgade, Odense C.".
 * Mutates and returns the rows.
 */
function disambiguateShortNames(rows) {
  const groups = new Map();

  for (const row of rows) {
    const key = `${row.chain}|${row.short_name.toLowerCase()}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(row);
  }

  for (const group of groups.values()) {
    if (group.length < 2) {
      continue;
    }

    for (const row of group) {
      const city = cityLabel(row);

      if (city && city.toLowerCase() !== row.short_name.toLowerCase()) {
        row.short_name = `${row.short_name}, ${city}`;
      }
    }
  }

  return rows;
}

/** "649" -> 649, "519,20" -> 519.2, "1.299" -> 1299. Danish decimal comma. */
function parseDanishAmount(value) {
  const match = String(value ?? "").match(/(\d[\d.]*(?:,\d+)?)/);

  if (!match) {
    return null;
  }

  const numeric = Number(match[1].replace(/\./g, "").replace(",", "."));

  return Number.isFinite(numeric) ? Math.round(numeric * 100) / 100 : null;
}

/**
 * The monthly price of a membership that covers this one centre and no other
 * - what the chains call a home or favourite centre. Returns null when the
 * scrape has nothing that honestly means that, which is most of them:
 *
 *   PureGym  the normal price, which is per centre and varies between them.
 *            Deliberately not `price_from`, which is whatever campaign was
 *            running the day of the scrape.
 *   SATS     "Basic" for an adult, described on their own site as access to
 *            your favourite centre. Priced per centre.
 *   LOOP     nothing. A LOOP membership covers every LOOP centre, so there is
 *            no single-centre price to show.
 *   FitnessX nothing but a bring-a-friend teaser.
 *   Fit&Sund no prices on the site at all.
 */
function deriveSingleCentrePrice(info) {
  const chain = clean(info?.chain)?.toLowerCase() ?? "";

  if (chain === "puregym") {
    const note = clean(info?.price_note);
    const amount = parseDanishAmount(note);

    if (amount === null) {
      return null;
    }

    return {
      price_kr: amount,
      price_is_from: /\bfra\b/i.test(note),
      price_note: note.replace(/^\*+/, "").trim(),
    };
  }

  if (chain === "sats") {
    const adultBasic = (info?.memberships ?? []).find(
      (membership) =>
        membership?.name === "Basic" &&
        membership?.member_type === "Voksen" &&
        membership?.age_group === "over-30"
    );
    const amount = parseDanishAmount(adultBasic?.price);

    if (amount === null) {
      return null;
    }

    return {
      price_kr: amount,
      price_is_from: false,
      price_note: clean(adultBasic?.description),
    };
  }

  return null;
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
    // A price is only as current as the scrape it came from, so the date it
    // was read travels with it and the app says so.
    ...(deriveSingleCentrePrice(info) ?? {
      price_kr: null,
      price_is_from: false,
      price_note: null,
    }),
    price_checked_on: clean(info?.scraped_at),
  };
}

module.exports = {
  CHAIN_FOLDERS,
  chainForFolder,
  deriveShortName,
  deriveSingleCentrePrice,
  disambiguateShortNames,
  imageObjectPath,
  normalizeGym,
};
