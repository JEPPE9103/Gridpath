/**
 * One-time NMD → Cloud Optimized GeoTIFF conversion helper (Docker + GDAL).
 *
 * Production never downloads the full striped national TIF per search.
 * Convert once, host the COG on HTTPS object storage, set NOXHEIM_NMD2023_URL.
 *
 * Full national COG (slow, large):
 *   node scripts/convert-nmd-to-cog.mjs
 *
 * Malmö smoke window (fast):
 *   node scripts/convert-nmd-to-cog.mjs --bbox=12.95,55.55,13.1,55.65 --out=NMD2023_malmo_cog.tif
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

function resolveInput() {
  const explicit = process.env.NOXHEIM_NMD2023_TIF?.trim();
  if (explicit && existsSync(explicit)) return explicit;
  const root = process.env.NOXHEIM_GEODATA_CACHE || path.join(os.homedir(), "noxheim-geodata");
  for (const name of ["NMD2023bas_v0_3.tif", "NMD2023_basskikt_v0_3.tif", "NMD2023bas_v03.tif"]) {
    const candidate = path.join(root, name);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("Set NOXHEIM_NMD2023_TIF to the national NMD2023 basskikt GeoTIFF.");
}

function argValue(name) {
  const raw = process.argv.find((item) => item.startsWith(`${name}=`));
  return raw ? raw.slice(name.length + 1) : "";
}

const input = resolveInput();
const outName = argValue("--out") || "NMD2023bas_v0_3_cog.tif";
const outDir = process.env.NOXHEIM_GEODATA_CACHE || path.join(os.homedir(), "noxheim-geodata");
const output = path.join(outDir, outName);
const bbox = argValue("--bbox");

const dockerArgs = [
  "run",
  "--rm",
  "-v",
  `${path.dirname(input)}:/in:ro`,
  "-v",
  `${outDir}:/out`,
  "ghcr.io/osgeo/gdal:ubuntu-small-latest",
  "gdal_translate",
  "-of",
  "COG",
  "-co",
  "COMPRESS=DEFLATE",
  "-co",
  "NUM_THREADS=ALL_CPUS",
  "-co",
  "BIGTIFF=IF_SAFER",
];

if (bbox) {
  const [west, south, east, north] = bbox.split(",").map(Number);
  if (![west, south, east, north].every(Number.isFinite)) {
    throw new Error("--bbox=west,south,east,north required");
  }
  // Input is EPSG:3006; convert lon/lat window via gdalwarp first would be cleaner.
  // For national full convert, omit --bbox. For smoke extracts, operator should pass SWEREF meters
  // via --projwin if known; lon/lat bbox is documented as unsupported in this helper.
  console.log(
    JSON.stringify({
      event: "nmd.cog.bbox_note",
      message:
        "Full national COG recommended for production. Optional --bbox is lon/lat and requires a prior SWEREF extract; omitting bbox for national convert.",
    }),
  );
}

dockerArgs.push(`/in/${path.basename(input)}`, `/out/${outName}`);

console.log(
  JSON.stringify({
    event: "nmd.cog.start",
    inputPresent: true,
    output: outName,
    note: "One-time conversion. Host the COG on HTTPS object storage and set NOXHEIM_NMD2023_URL. Never download the full raster per search.",
  }),
);

const result = spawnSync("docker", dockerArgs, { stdio: "inherit" });
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(
  JSON.stringify({
    event: "nmd.cog.complete",
    outputExists: existsSync(output),
    next: "Upload the COG to object storage (S3/R2/Supabase Storage) and set NOXHEIM_NMD2023_URL on Vercel Production + Preview.",
  }),
);
