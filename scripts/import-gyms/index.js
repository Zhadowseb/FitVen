#!/usr/bin/env node
// Imports the centres in data/gyms/ into Supabase: hero images to the public
// gym-images bucket, one row per centre to public.gym, upserted on
// (chain, name). Runs with the service role - app users cannot write gyms.
//
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/import-gyms/index.js [--dir data/gyms] [--chain PureGym]
//     [--dry-run] [--skip-images]
//
// or, with the two variables in .env (which is gitignored):
//
//   node --env-file=.env scripts/import-gyms/index.js --dry-run
//
// --dry-run prints every derived short name and writes nothing. Do that first:
// short_name is what users see on the tiles, and the rule in normalizeGym.js
// is a guess about five chains' naming habits, not a fact about them.
//
// Re-running is safe. Rows are upserted, images are uploaded with upsert, and
// a centre whose folder has no image keeps whatever image_url it already had.

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const {
  CHAIN_FOLDERS,
  disambiguateShortNames,
  imageObjectPath,
  normalizeGym,
} = require("./normalizeGym");

const IMAGE_BUCKET = "gym-images";
const BATCH_SIZE = 50;
const CONTENT_TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

function parseArgs(argv) {
  const options = { dir: path.join(__dirname, "..", "..", "data", "gyms"), chain: null, dryRun: false, skipImages: false };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--dry-run") options.dryRun = true;
    else if (token === "--skip-images") options.skipImages = true;
    else if (token === "--dir") options.dir = path.resolve(argv[++index]);
    else if (token === "--chain") options.chain = argv[++index];
    else if (token.startsWith("--dir=")) options.dir = path.resolve(token.slice(6));
    else if (token.startsWith("--chain=")) options.chain = token.slice(8);
  }

  return options;
}

function readCentres(rootDir, onlyChain) {
  const centres = [];

  for (const chainFolder of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (!chainFolder.isDirectory()) continue;

    const chainLabel = CHAIN_FOLDERS[chainFolder.name] ?? chainFolder.name;

    if (onlyChain && chainLabel.toLowerCase() !== onlyChain.toLowerCase() && chainFolder.name.toLowerCase() !== onlyChain.toLowerCase()) {
      continue;
    }

    const chainDir = path.join(rootDir, chainFolder.name);

    for (const entry of fs.readdirSync(chainDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;

      const folder = path.join(chainDir, entry.name);
      const infoPath = path.join(folder, "info.json");

      if (!fs.existsSync(infoPath)) continue;

      let info;

      try {
        info = JSON.parse(fs.readFileSync(infoPath, "utf8"));
      } catch (error) {
        console.warn(`Skipping ${infoPath}: ${error.message}`);
        continue;
      }

      const row = normalizeGym(info, { folderName: entry.name, chainFolder: chainFolder.name });

      if (!row) {
        console.warn(`Skipping ${infoPath}: no name, chain or coordinates`);
        continue;
      }

      const imageFile = info.hero_is_placeholder ? null : info.hero_image_file ?? null;
      const imagePath = imageFile && fs.existsSync(path.join(folder, imageFile)) ? path.join(folder, imageFile) : null;

      centres.push({ row, imagePath, folderName: entry.name, chainFolder: chainFolder.name });
    }
  }

  disambiguateShortNames(centres.map((centre) => centre.row));

  return centres;
}

function printDryRun(centres) {
  const width = Math.max(...centres.map((centre) => centre.row.name.length), 4);

  console.log(`\n${"chain".padEnd(14)} ${"name".padEnd(width)}  short_name`);
  console.log(`${"".padEnd(14, "-")} ${"".padEnd(width, "-")}  ${"".padEnd(24, "-")}`);

  for (const centre of centres) {
    console.log(`${centre.row.chain.padEnd(14)} ${centre.row.name.padEnd(width)}  ${centre.row.short_name}${centre.imagePath ? "" : "   (no image)"}`);
  }

  const withImages = centres.filter((centre) => centre.imagePath).length;

  console.log(`\n${centres.length} centres, ${withImages} with a hero image. Nothing was written.`);
}

async function uploadImage(supabase, centre) {
  const extension = path.extname(centre.imagePath);
  const objectPath = imageObjectPath(centre.row.chain, centre.folderName, extension);
  const contentType = CONTENT_TYPES[extension.toLowerCase()] ?? "application/octet-stream";
  const body = fs.readFileSync(centre.imagePath);
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(objectPath, body, { contentType, upsert: true, cacheControl: "31536000" });

  if (error) {
    throw new Error(`${centre.row.name}: image upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(objectPath);

  return data?.publicUrl ?? null;
}

async function run() {
  const options = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(options.dir)) {
    console.error(`No such folder: ${options.dir}`);
    process.exit(1);
  }

  const centres = readCentres(options.dir, options.chain);

  if (!centres.length) {
    console.error("No centres found. Each centre is a folder with an info.json, under a folder per chain.");
    process.exit(1);
  }

  if (options.dryRun) {
    printDryRun(centres);
    return;
  }

  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (the service role, not the anon key). Use --dry-run to check the data without them.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let uploaded = 0;

  if (!options.skipImages) {
    for (const centre of centres) {
      if (!centre.imagePath) continue;

      try {
        centre.row.image_url = await uploadImage(supabase, centre);
        uploaded += 1;
      } catch (error) {
        console.warn(error.message);
      }
    }
  }

  let written = 0;

  for (let start = 0; start < centres.length; start += BATCH_SIZE) {
    const batch = centres.slice(start, start + BATCH_SIZE).map((centre) => centre.row);
    // A centre without a new image must not have its image_url overwritten
    // with null, so those rows are upserted without the column.
    const withImage = batch.filter((row) => row.image_url);
    const withoutImage = batch.filter((row) => !row.image_url).map(({ image_url, ...rest }) => rest);

    for (const rows of [withImage, withoutImage]) {
      if (!rows.length) continue;

      const { error } = await supabase.from("gym").upsert(rows, { onConflict: "chain,name" });

      if (error) {
        throw new Error(`Upsert failed: ${error.message}`);
      }

      written += rows.length;
    }
  }

  console.log(`Imported ${written} centres, ${uploaded} images uploaded.`);
}

run().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
