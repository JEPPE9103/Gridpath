import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertOfficialBinaryDownload,
  describeFetchFailure,
  discoverNupXlsxUrl,
  discoverOfficialNupXlsxUrl,
  downloadOfficialBuffer,
  formatFetchError,
  ingestErrorText,
  isPermanentHttpStatus,
  isTransientFetchFailure,
  NUP_DISCOVERY_URLS,
  officialFetch,
} from "./official-fetch.mjs";

const PRIMARY = NUP_DISCOVERY_URLS[0];
const FALLBACK = NUP_DISCOVERY_URLS[1];
const XLSX_HREF =
  "/download/18.test/fixture/Data-karttjansten-elnatsforetagens-natutvecklingsplaner.xlsx";

const LANDING_HTML = `<!doctype html><html><body>
<a href="/other.pdf">Något annat</a>
<a href="${XLSX_HREF}">Ladda ner filen — Data karttjänsten elnätsföretagens nätutvecklingsplaner xlsx, 119.6 kB.</a>
</body></html>`;

const EMPTY_HTML = `<!doctype html><html><body><p>No workbook here</p></body></html>`;

function mockResponse({ status = 200, body = "", contentType = "text/html", location = null, url }) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  return {
    status,
    url,
    headers: {
      get(name) {
        const key = name.toLowerCase();
        if (key === "content-type") return contentType;
        if (key === "location") return location;
        return null;
      },
    },
    arrayBuffer: async () => buf,
    text: async () => buf.toString("utf8"),
  };
}

function timedOutFetch() {
  const error = new TypeError("fetch failed");
  error.cause = Object.assign(new Error("connect timeout"), { code: "ETIMEDOUT" });
  throw error;
}

describe("fetch error cause extraction", () => {
  it("records name, message, cause code, hostname, and phase", () => {
    const error = new TypeError("fetch failed");
    error.cause = Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
    const detail = describeFetchFailure(error, {
      hostname: "ei.se",
      phase: "nup-discovery",
      transport: "node-fetch",
    });
    assert.equal(detail.name, "TypeError");
    assert.equal(detail.message, "fetch failed");
    assert.equal(detail.causeCode, "ECONNRESET");
    assert.match(detail.causeMessage, /ECONNRESET/);
    assert.equal(detail.hostname, "ei.se");
    assert.equal(detail.phase, "nup-discovery");
    const formatted = formatFetchError(error, detail);
    assert.match(formatted, /phase=nup-discovery/);
    assert.match(formatted, /host=ei.se/);
    assert.match(formatted, /causeCode=ECONNRESET/);
    assert.equal(ingestErrorText(error).includes("ECONNRESET"), true);
    assert.equal(isTransientFetchFailure(error), true);
  });

  it("does not treat a permanent 404 as transient", () => {
    assert.equal(isPermanentHttpStatus(404), true);
    assert.equal(isPermanentHttpStatus(429), false);
    const error = new Error("Official fetch HTTP 404 for ei.se");
    error.status = 404;
    error.permanent = true;
    assert.equal(isTransientFetchFailure(error), false);
  });
});

describe("official fetch retry and transports", () => {
  it("retries a transient node-fetch failure then succeeds", async () => {
    let attempts = 0;
    const result = await officialFetch(PRIMARY, {
      phase: "nup-discovery",
      httpsOnceImpl: false,
      curlImpl: false,
      sleep: async () => {},
      fetchImpl: async (url) => {
        attempts += 1;
        if (attempts < 3) timedOutFetch();
        return mockResponse({ status: 200, body: LANDING_HTML, url });
      },
    });
    assert.equal(attempts, 3);
    assert.equal(result.status, 200);
    assert.equal(result.transport, "node-fetch");
    assert.match(result.body.toString("utf8"), /Data karttjänsten/);
  });

  it("does not retry a 404", async () => {
    let attempts = 0;
    await assert.rejects(
      () =>
        officialFetch(PRIMARY, {
          phase: "nup-discovery",
          httpsOnceImpl: false,
          curlImpl: false,
          fetchImpl: async (url) => {
            attempts += 1;
            return mockResponse({ status: 404, body: "missing", contentType: "text/plain", url });
          },
        }),
      /status=404/,
    );
    assert.equal(attempts, 1);
  });

  it("falls back to curl when node fetch and https fail", async () => {
    const result = await officialFetch(PRIMARY, {
      phase: "nup-discovery",
      maxAttempts: 1,
      sleep: async () => {},
      fetchImpl: async () => timedOutFetch(),
      httpsOnceImpl: async () => {
        const error = new Error("socket hang up");
        error.code = "ECONNRESET";
        throw error;
      },
      curlImpl: async (url) => ({
        status: 200,
        url,
        contentType: "text/html;charset=UTF-8",
        body: LANDING_HTML,
      }),
    });
    assert.equal(result.transport, "curl");
    assert.equal(result.status, 200);
  });

  it("follows an https redirect on ei.se", async () => {
    const finalUrl = "https://ei.se/bransch/natutvecklingsplaner/karttjanst-natutvecklingsplaner";
    const hops = [];
    const result = await officialFetch("https://ei.se/old-nup", {
      phase: "nup-discovery",
      httpsOnceImpl: false,
      curlImpl: false,
      fetchImpl: async (url) => {
        hops.push(url);
        if (url === "https://ei.se/old-nup") {
          return mockResponse({ status: 302, location: finalUrl, url, body: "" });
        }
        return mockResponse({ status: 200, body: LANDING_HTML, url });
      },
    });
    assert.deepEqual(hops, ["https://ei.se/old-nup", finalUrl]);
    assert.equal(result.status, 200);
  });

  it("rejects a redirect off the official Ei allowlist", async () => {
    await assert.rejects(
      () =>
        officialFetch(PRIMARY, {
          phase: "nup-discovery",
          httpsOnceImpl: false,
          curlImpl: false,
          fetchImpl: async (url) =>
            mockResponse({
              status: 302,
              location: "https://evil.example/steal.xlsx",
              url,
              body: "",
            }),
        }),
      /non-allowlisted host/,
    );
  });
});

describe("official NUP discovery", () => {
  it("discovers the official Excel from fixture HTML", () => {
    const url = discoverNupXlsxUrl(LANDING_HTML, PRIMARY);
    assert.equal(url.startsWith("https://ei.se/download/"), true);
    assert.match(url, /\.xlsx$/);
    assert.match(url, /Data-karttjansten/);
  });

  it("uses the second official Ei page when the first fails", async () => {
    const tried = [];
    const discovered = await discoverOfficialNupXlsxUrl(async (pageUrl) => {
      tried.push(pageUrl);
      if (pageUrl === PRIMARY) {
        throw new TypeError("fetch failed");
      }
      return { text: LANDING_HTML, finalUrl: pageUrl, transport: "node-fetch" };
    });
    assert.deepEqual(tried, [PRIMARY, FALLBACK]);
    assert.equal(discovered.landingUrl, FALLBACK);
    assert.match(discovered.xlsxUrl, /\.xlsx$/);
  });

  it("uses the second official Ei page when the first has no Excel link", async () => {
    const discovered = await discoverOfficialNupXlsxUrl(async (pageUrl) => ({
      text: pageUrl === PRIMARY ? EMPTY_HTML : LANDING_HTML,
      finalUrl: pageUrl,
    }));
    assert.equal(discovered.landingUrl, FALLBACK);
  });
});

describe("official XLSX validation", () => {
  it("rejects an HTML error page as Excel", () => {
    const html = Buffer.from("<!DOCTYPE html><html><body>Forbidden</body></html>");
    assert.throws(
      () =>
        assertOfficialBinaryDownload(html, {
          url: "https://ei.se/download/nup.xlsx",
          contentType: "text/html",
          kind: "xlsx",
        }),
      /HTML/,
    );
  });

  it("accepts a ZIP/XLSX magic header from an allowlisted host", () => {
    const bytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
    assertOfficialBinaryDownload(bytes, {
      url: "https://ei.se/download/nup.xlsx",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      kind: "xlsx",
    });
  });

  it("refuses to ingest HTML returned with an Excel URL", async () => {
    await assert.rejects(
      () =>
        downloadOfficialBuffer("https://ei.se/download/nup.xlsx", {
          kind: "xlsx",
          httpsOnceImpl: false,
          curlImpl: false,
          fetchImpl: async (url) =>
            mockResponse({
              status: 200,
              url,
              contentType: "text/html;charset=UTF-8",
              body: "<html><body>error</body></html>",
            }),
        }),
      /HTML/,
    );
  });
});
