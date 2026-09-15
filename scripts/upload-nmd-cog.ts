/**
 * Upload NMD COG to Design Partner Cloud Storage and print only the public URL shape (no secrets).
 * Usage: node --import tsx scripts/upload-nmd-cog.ts [localCogPath]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { DESIGN_PARTNER_CLOUD_PROJECT_REF, runSupabase } from "./lib/ingest-target.mjs";

const BUCKET = "official-geodata";
const OBJECT = "nmd/NMD2023bas_v0_3_cog.tif";

function parseEnv(text: string) {
  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2] ?? "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1] ?? ""] = value;
  }
  return values;
}

async function main() {
  const localPath =
    process.argv[2] ||
    path.join(process.env.NOXHEIM_GEODATA_CACHE || path.join(os.homedir(), "noxheim-geodata"), "NMD2023bas_v0_3_cog.tif");
  if (!existsSync(localPath)) {
    throw new Error(`COG missing: ${path.basename(localPath)}`);
  }
  const keys = parseEnv(
    runSupabase(["projects", "api-keys", "--project-ref", DESIGN_PARTNER_CLOUD_PROJECT_REF, "-o", "env"]),
  );
  const service = createClient(`https://${DESIGN_PARTNER_CLOUD_PROJECT_REF}.supabase.co`, keys.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: buckets } = await service.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BUCKET)) {
    const { error } = await service.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: "2GB",
      allowedMimeTypes: ["image/tiff", "application/octet-stream"],
    });
    if (error) throw new Error(error.message);
  }

  const bytes = readFileSync(localPath);
  const { error: uploadError } = await service.storage.from(BUCKET).upload(OBJECT, bytes, {
    contentType: "image/tiff",
    upsert: true,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data } = service.storage.from(BUCKET).getPublicUrl(OBJECT);
  console.log(
    JSON.stringify({
      event: "nmd.cog.uploaded",
      bucket: BUCKET,
      object: OBJECT,
      bytes: bytes.byteLength,
      publicUrlHost: new URL(data.publicUrl).hostname,
      publicUrlPath: new URL(data.publicUrl).pathname,
      setOnVercel: "NOXHEIM_NMD2023_URL=<full https public URL>",
    }),
  );
  // Print URL alone for piping into vercel env add — still not a secret (public object).
  console.log(data.publicUrl);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
