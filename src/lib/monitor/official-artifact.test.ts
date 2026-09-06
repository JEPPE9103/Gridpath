import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHash } from "node:crypto";
import {
  assertOfficialBinaryDownload,
  cacheOfficialSourceArtifact,
  discoverNupXlsxUrl,
  officialCacheObjectPath,
  publicArtifactMetadata,
  refreshOfficialSourceCache,
} from "@/lib/monitor/official-artifact";
import { handleOfficialSourceCacheRequest } from "@/lib/monitor/official-cache-route";
import { OFFICIAL_EI_NUP_LANDING_URLS } from "@/lib/monitor/official-sources";

const XLSX_HREF =
  "/download/18.test/fixture/Data-karttjansten-elnatsforetagens-natutvecklingsplaner.xlsx";
const LANDING_HTML = `<!doctype html><html><body>
<a href="${XLSX_HREF}">Ladda ner filen — Data karttjänsten elnätsföretagens nätutvecklingsplaner xlsx, 119.6 kB.</a>
</body></html>`;
const ZIP_HTML = `<!doctype html><html><body>
<a href="/download/lokalnat.zip">Lokalnät shapefile zip</a>
</body></html>`;
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);

function mockResponse({ url, status = 200, body, contentType }) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body ?? "");
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    headers: {
      get(name: string) {
        return name.toLowerCase() === "content-type" ? contentType : null;
      },
    },
    arrayBuffer: async () => buf,
    text: async () => buf.toString("utf8"),
    body: { cancel: async () => undefined },
  } as Response;
}

function memoryStore() {
  const rows = new Map<string, { record: ReturnType<typeof publicArtifactMetadata>; bytes: Uint8Array }>();
  return {
    rows,
    store: {
      async findByHash(slug: string, sha: string) {
        const hit = rows.get(`${slug}:${sha}`);
        return hit
          ? {
              sourceSlug: slug as "ei-network-development-plans",
              sourceKind: "xlsx" as const,
              officialSourceUrl: String(hit.record.officialSourceUrl),
              discoveryPageUrl: String(hit.record.discoveryPageUrl),
              fetchedAt: String(hit.record.retrievedByNoxheimAt),
              contentSha256: sha,
              byteSize: hit.bytes.length,
              contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              originalFilename: String(hit.record.originalFilename),
              storagePath: officialCacheObjectPath(
                slug as "ei-network-development-plans",
                sha,
                "xlsx",
              ),
              processingStatus: "cached" as const,
            }
          : null;
      },
      async insert(record: { sourceSlug: string; contentSha256: string }, bytes: Uint8Array) {
        rows.set(`${record.sourceSlug}:${record.contentSha256}`, {
          record: publicArtifactMetadata(record as never),
          bytes,
        });
      },
    },
  };
}

describe("official source cache", () => {
  it("discovers official Excel and caches a new artifact", async () => {
    const { store, rows } = memoryStore();
    const result = await cacheOfficialSourceArtifact("ei-network-development-plans", {
      store,
      fetchImpl: async (url) => {
        const href = String(url);
        if (href.includes(".xlsx")) {
          return mockResponse({
            url: href,
            body: ZIP_MAGIC,
            contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });
        }
        return mockResponse({ url: href, body: LANDING_HTML, contentType: "text/html" });
      },
    });
    assert.equal(result.outcome, "cached");
    if (result.outcome === "failed") throw new Error("expected cache");
    assert.equal(result.artifact.officialSourceUrl.includes("ei.se"), true);
    assert.equal(result.artifact.discoveryPageUrl, OFFICIAL_EI_NUP_LANDING_URLS[0]);
    assert.equal(rows.size, 1);
    const meta = publicArtifactMetadata(result.artifact);
    assert.equal(meta.officialPublisher, "Energimarknadsinspektionen");
    assert.equal(meta.cacheIsTransportOnly, true);
    assert.equal(meta.officialSourceUrl.includes("supabase"), false);
  });

  it("returns unchanged when the SHA-256 already exists", async () => {
    const { store } = memoryStore();
    const deps = {
      store,
      fetchImpl: async (url: string | URL) => {
        const href = String(url);
        if (href.includes(".xlsx")) {
          return mockResponse({ url: href, body: ZIP_MAGIC, contentType: "application/octet-stream" });
        }
        return mockResponse({ url: href, body: LANDING_HTML, contentType: "text/html" });
      },
    };
    const first = await cacheOfficialSourceArtifact("ei-network-development-plans", deps);
    const second = await cacheOfficialSourceArtifact("ei-network-development-plans", deps);
    assert.equal(first.outcome, "cached");
    assert.equal(second.outcome, "unchanged");
  });

  it("rejects an invalid host and HTML pretending to be Excel", () => {
    assert.throws(
      () =>
        assertOfficialBinaryDownload(Buffer.from("<html>nope</html>"), {
          url: "https://ei.se/download/nup.xlsx",
          contentType: "text/html",
        }),
      /HTML/,
    );
    assert.equal(discoverNupXlsxUrl(LANDING_HTML, OFFICIAL_EI_NUP_LANDING_URLS[0]).startsWith("https://ei.se/"), true);
  });

  it("rejects a corrupt non-zip download", async () => {
    const { store } = memoryStore();
    const result = await cacheOfficialSourceArtifact("ei-network-development-plans", {
      store,
      fetchImpl: async (url) => {
        const href = String(url);
        if (href.includes(".xlsx")) {
          return mockResponse({ url: href, body: "not-a-zip", contentType: "application/octet-stream" });
        }
        return mockResponse({ url: href, body: LANDING_HTML, contentType: "text/html" });
      },
    });
    assert.equal(result.outcome, "failed");
  });

  it("does not treat the endpoint as an arbitrary proxy", async () => {
    const fetched: string[] = [];
    const unauthorized = await handleOfficialSourceCacheRequest(
      new Request(
        "https://www.noxheim.com/api/internal/monitor/official-source-cache?url=https://evil.example",
      ),
      { secret: "secret", hasServiceRole: () => true, refresh: async () => ({ ok: true, sources: [] }) },
    );
    assert.equal(unauthorized.status, 401);

    const authorized = await handleOfficialSourceCacheRequest(
      new Request(
        "https://www.noxheim.com/api/internal/monitor/official-source-cache?url=https://evil.example",
        { headers: { authorization: "Bearer secret" } },
      ),
      {
        secret: "secret",
        hasServiceRole: () => true,
        refresh: async () => ({ ok: true, sources: [] }),
      },
    );
    assert.equal(authorized.status, 200);

    const put = await handleOfficialSourceCacheRequest(
      new Request("https://www.noxheim.com/api/internal/monitor/official-source-cache", {
        method: "PUT",
        headers: { authorization: "Bearer secret" },
        body: JSON.stringify({ url: "https://evil.example" }),
      }),
      {
        secret: "secret",
        fetchImpl: async (url) => {
          fetched.push(String(url));
          return mockResponse({ url: String(url), body: "" });
        },
      },
    );
    assert.equal(put.status, 405);
    assert.deepEqual(fetched, []);
  });

  it("caches both official sources in one refresh", async () => {
    const { store } = memoryStore();
    const result = await refreshOfficialSourceCache({
      store,
      fetchImpl: async (url) => {
        const href = String(url);
        if (href.endsWith(".xlsx") || href.endsWith(".zip")) {
          return mockResponse({ url: href, body: ZIP_MAGIC, contentType: "application/zip" });
        }
        if (href.includes("koncession")) {
          return mockResponse({ url: href, body: ZIP_HTML, contentType: "text/html" });
        }
        return mockResponse({ url: href, body: LANDING_HTML, contentType: "text/html" });
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.sources.length, 2);
    assert.equal(result.sources.every((item) => item.outcome === "cached"), true);
  });

  it("builds traversal-safe cache object paths", () => {
    const sha = createHash("sha256").update("x").digest("hex");
    assert.equal(
      officialCacheObjectPath("ei-network-development-plans", sha, "xlsx"),
      `ei/ei-network-development-plans/${sha}.xlsx`,
    );
    assert.throws(() => officialCacheObjectPath("ei-network-development-plans", "../etc/passwd", "xlsx"));
  });
});
