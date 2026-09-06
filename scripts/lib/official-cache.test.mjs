import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHash } from "node:crypto";
import {
  downloadCachedOfficialObject,
  latestArtifactSql,
  loadCachedOfficialArtifact,
  scheduledIngestUsesCache,
  verifyCachedArtifact,
} from "./official-cache.mjs";

const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
const SHA = createHash("sha256").update(ZIP_MAGIC).digest("hex");

describe("scheduled official cache client", () => {
  it("uses the cache in GitHub Actions scheduled mode", () => {
    assert.equal(scheduledIngestUsesCache({ GITHUB_ACTIONS: "true" }), true);
    assert.equal(scheduledIngestUsesCache({}), false);
  });

  it("rejects a hash mismatch and a path traversal", async () => {
    assert.throws(
      () =>
        verifyCachedArtifact(ZIP_MAGIC, {
          content_sha256: "0".repeat(64),
          official_source_url: "https://ei.se/download/nup.xlsx",
          content_type: "application/zip",
          source_kind: "xlsx",
          byte_size: ZIP_MAGIC.length,
        }),
      /SHA-256/,
    );
    await assert.rejects(
      () =>
        downloadCachedOfficialObject({
          supabaseUrl: "https://krgzpgqmnzljwlwptmcn.supabase.co",
          storagePath: "ei/../secret.xlsx",
          serviceRoleKey: "test-key",
          fetchImpl: async () => new Response("nope"),
        }),
      /not an official artifact object/,
    );
  });

  it("loads a cached artifact without contacting ei.se", async () => {
    const fetched = [];
    const loaded = await loadCachedOfficialArtifact({
      slug: "ei-network-development-plans",
      kind: "xlsx",
      supabaseUrl: "https://krgzpgqmnzljwlwptmcn.supabase.co",
      serviceRoleKey: "test-key",
      query: (sql) => {
        assert.match(sql, /official_source_artifacts/);
        assert.equal(latestArtifactSql("ei-network-development-plans").includes("ei.se"), false);
        return [
          {
            source_slug: "ei-network-development-plans",
            source_kind: "xlsx",
            official_source_url: "https://ei.se/download/nup.xlsx",
            discovery_page_url: "https://ei.se/bransch/natutvecklingsplaner/karttjanst-natutvecklingsplaner",
            fetched_at: "2026-09-06T21:00:00.000Z",
            content_sha256: SHA,
            byte_size: ZIP_MAGIC.length,
            content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            original_filename: "nup.xlsx",
            storage_path: `ei/ei-network-development-plans/${SHA}.xlsx`,
            processing_status: "cached",
          },
        ];
      },
      fetchImpl: async (url) => {
        fetched.push(String(url));
        assert.equal(String(url).includes("ei.se"), false);
        assert.match(String(url), /official-source-cache/);
        return new Response(ZIP_MAGIC, { status: 200 });
      },
    });
    assert.equal(loaded.sha256, SHA);
    assert.equal(loaded.officialSourceUrl, "https://ei.se/download/nup.xlsx");
    assert.equal(fetched[0].includes("supabase.co"), true);
  });
});
