import type { SupabaseClient } from "@supabase/supabase-js";
import {
  OFFICIAL_SOURCE_CACHE_BUCKET,
  type CachedOfficialSourceSlug,
  type OfficialArtifactKind,
  type OfficialArtifactProcessingStatus,
  type OfficialArtifactRecord,
  type OfficialCacheStore,
} from "@/lib/monitor/official-artifact";

type ArtifactRow = {
  source_slug: string;
  source_kind: OfficialArtifactKind;
  official_source_url: string;
  discovery_page_url: string;
  fetched_at: string;
  content_sha256: string;
  byte_size: number;
  content_type: string | null;
  original_filename: string | null;
  storage_path: string;
  processing_status: OfficialArtifactProcessingStatus;
};

function rowToRecord(row: ArtifactRow): OfficialArtifactRecord {
  return {
    sourceSlug: row.source_slug as CachedOfficialSourceSlug,
    sourceKind: row.source_kind,
    officialSourceUrl: row.official_source_url,
    discoveryPageUrl: row.discovery_page_url,
    fetchedAt: row.fetched_at,
    contentSha256: row.content_sha256,
    byteSize: row.byte_size,
    contentType: row.content_type,
    originalFilename: row.original_filename || `official.${row.source_kind}`,
    storagePath: row.storage_path,
    processingStatus: row.processing_status,
  };
}

export function createSupabaseOfficialCacheStore(client: SupabaseClient): OfficialCacheStore {
  return {
    async findByHash(slug, sha256) {
      const { data, error } = await client
        .from("official_source_artifacts")
        .select(
          "source_slug, source_kind, official_source_url, discovery_page_url, fetched_at, content_sha256, byte_size, content_type, original_filename, storage_path, processing_status",
        )
        .eq("source_slug", slug)
        .eq("content_sha256", sha256)
        .maybeSingle();
      if (error) {
        throw new Error(`Official cache lookup failed: ${error.message}`);
      }
      return data ? rowToRecord(data as ArtifactRow) : null;
    },
    async insert(record, bytes) {
      const upload = await client.storage
        .from(OFFICIAL_SOURCE_CACHE_BUCKET)
        .upload(record.storagePath, bytes, {
          contentType: record.contentType || "application/octet-stream",
          upsert: false,
        });
      if (
        upload.error &&
        !/already exists|duplicate|resource already/i.test(upload.error.message)
      ) {
        throw new Error(`Official cache upload failed: ${upload.error.message}`);
      }
      const { error } = await client.from("official_source_artifacts").insert({
        source_slug: record.sourceSlug,
        source_kind: record.sourceKind,
        official_source_url: record.officialSourceUrl,
        discovery_page_url: record.discoveryPageUrl,
        fetched_at: record.fetchedAt,
        content_sha256: record.contentSha256,
        byte_size: record.byteSize,
        content_type: record.contentType,
        original_filename: record.originalFilename,
        storage_path: record.storagePath,
        processing_status: "cached",
      });
      if (error && error.code !== "23505") {
        throw new Error(`Official cache metadata insert failed: ${error.message}`);
      }
    },
  };
}
