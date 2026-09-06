/**
 * GitHub scheduled ingest loads official public artifacts from the Noxheim
 * transport cache. Ei remains the official source. This module never contacts ei.se.
 */
import { createHash } from "node:crypto";
import { DESIGN_PARTNER_CLOUD_PROJECT_REF } from "./ingest-target.mjs";
import { assertOfficialBinaryDownload } from "./official-fetch.mjs";

export const OFFICIAL_SOURCE_CACHE_BUCKET = "official-source-cache";

export function scheduledIngestUsesCache(env = process.env) {
  return env.GITHUB_ACTIONS === "true" || env.NOXHEIM_USE_OFFICIAL_CACHE === "true";
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function latestArtifactSql(slug) {
  return `
select
  source_slug,
  source_kind,
  official_source_url,
  discovery_page_url,
  fetched_at,
  content_sha256,
  byte_size,
  content_type,
  original_filename,
  storage_path,
  processing_status
from public.official_source_artifacts
where source_slug = ${quote(slug)}
order by fetched_at desc
limit 1;
`;
}

export function markArtifactProcessedSql(slug, sha256) {
  return `
update public.official_source_artifacts
set
  processing_status = 'processed',
  processed_at = now(),
  last_error_code = null,
  last_error_message = null
where source_slug = ${quote(slug)}
  and content_sha256 = ${quote(sha256)};
`;
}

export function markArtifactFailedSql(slug, sha256, errorCode, errorMessage) {
  return `
update public.official_source_artifacts
set
  processing_status = 'failed',
  last_error_code = ${quote(errorCode)},
  last_error_message = ${quote(String(errorMessage ?? "").slice(0, 280))}
where source_slug = ${quote(slug)}
  and content_sha256 = ${quote(sha256)};
`;
}

export function verifyCachedArtifact(bytes, metadata) {
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== metadata.content_sha256) {
    throw new Error("Cached official artifact SHA-256 does not match metadata. Refusing to ingest.");
  }
  if (metadata.official_source_url && !/^https:\/\/([a-z0-9-]+\.)*ei\.se\//i.test(metadata.official_source_url)) {
    throw new Error("Cached artifact official_source_url is not an allowlisted Ei URL.");
  }
  assertOfficialBinaryDownload(bytes, {
    url: metadata.official_source_url,
    contentType: metadata.content_type,
    kind: metadata.source_kind,
  });
  if (Number(metadata.byte_size) !== bytes.length) {
    throw new Error("Cached official artifact size does not match metadata.");
  }
  return digest;
}

async function resolveServiceRoleKey() {
  const direct = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (direct) {
    return direct;
  }
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "Official source cache download requires SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ACCESS_TOKEN.",
    );
  }
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${DESIGN_PARTNER_CLOUD_PROJECT_REF}/api-keys`,
    { headers: { authorization: `Bearer ${token}`, accept: "application/json" } },
  );
  if (!response.ok) {
    throw new Error(`Could not resolve service role for cache download (HTTP ${response.status}).`);
  }
  const payload = await response.json();
  const keys = Array.isArray(payload) ? payload : payload?.api_keys ?? [];
  const service =
    keys.find((item) => item?.name === "service_role" || item?.type === "secret") ??
    keys.find((item) => /service_role/i.test(String(item?.name ?? "")));
  const key = service?.api_key || service?.value || service?.id;
  if (!key || String(key).includes("[SENSITIVE]")) {
    throw new Error("Could not resolve service role for cache download.");
  }
  return String(key);
}

export async function downloadCachedOfficialObject({
  supabaseUrl,
  storagePath,
  fetchImpl = fetch,
  serviceRoleKey,
}) {
  if (!/^ei\/[a-z0-9-]+\/[a-f0-9]{64}\.(xlsx|zip)$/.test(storagePath)) {
    throw new Error("Refusing cache path that is not an official artifact object.");
  }
  const key = serviceRoleKey ?? (await resolveServiceRoleKey());
  const url = `${String(supabaseUrl).replace(/\/$/, "")}/storage/v1/object/${OFFICIAL_SOURCE_CACHE_BUCKET}/${storagePath}`;
  const response = await fetchImpl(url, {
    headers: {
      authorization: `Bearer ${key}`,
      apikey: key,
    },
  });
  if (!response.ok) {
    throw new Error(`Official cache object download failed (HTTP ${response.status}).`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function loadCachedOfficialArtifact({
  query,
  slug,
  kind,
  supabaseUrl,
  fetchImpl = fetch,
  serviceRoleKey,
}) {
  const rows = query(latestArtifactSql(slug));
  const metadata = rows[0];
  if (!metadata) {
    throw new Error(
      `No cached official artifact for ${slug}. Vercel fetch/cache has not stored this source yet.`,
    );
  }
  if (kind && metadata.source_kind !== kind) {
    throw new Error(`Cached official artifact kind mismatch for ${slug}.`);
  }
  const bytes = await downloadCachedOfficialObject({
    supabaseUrl,
    storagePath: metadata.storage_path,
    fetchImpl,
    serviceRoleKey,
  });
  verifyCachedArtifact(bytes, metadata);
  return {
    bytes,
    filename: metadata.original_filename || `official.${metadata.source_kind}`,
    officialSourceUrl: metadata.official_source_url,
    discoveryPageUrl: metadata.discovery_page_url,
    sha256: metadata.content_sha256,
    fetchedAt: metadata.fetched_at,
    storagePath: metadata.storage_path,
    contentType: metadata.content_type,
    kind: metadata.source_kind,
  };
}
