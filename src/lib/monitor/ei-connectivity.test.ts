import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EI_CONNECTIVITY_TARGETS, probeOfficialEiConnectivity } from "@/lib/monitor/ei-connectivity";
import { handleEiConnectivityRequest } from "@/lib/monitor/ei-connectivity-route";
import { isAllowedOfficialFetchUrl } from "@/lib/monitor/official-sources";

function mockResponse({
  url,
  status = 200,
  contentType = "text/html;charset=UTF-8",
}: {
  url: string;
  status?: number;
  contentType?: string;
}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    headers: {
      get(name: string) {
        return name.toLowerCase() === "content-type" ? contentType : null;
      },
    },
    body: { cancel: async () => undefined },
  } as Response;
}

describe("Ei connectivity diagnostic", () => {
  it("only targets hardcoded official Ei HTTPS hosts", () => {
    assert.equal(EI_CONNECTIVITY_TARGETS.length, 2);
    for (const target of EI_CONNECTIVITY_TARGETS) {
      assert.equal(isAllowedOfficialFetchUrl(target.url), true);
      assert.equal(new URL(target.url).hostname, "ei.se");
    }
  });

  it("returns sanitized success metadata without a response body", async () => {
    const fetched: string[] = [];
    const result = await probeOfficialEiConnectivity(async (url) => {
      fetched.push(String(url));
      return mockResponse({ url: String(url) });
    });
    assert.deepEqual(
      fetched,
      EI_CONNECTIVITY_TARGETS.map((target) => target.url),
    );
    assert.equal(result.ok, true);
    assert.equal(result.probes[0]?.success, true);
    assert.equal(result.probes[0]?.requestedHost, "ei.se");
    assert.equal(result.probes[0]?.finalHost, "ei.se");
    assert.equal(result.probes[0]?.status, 200);
    assert.equal(result.probes[0]?.contentType, "text/html;charset=UTF-8");
    assert.equal("body" in result.probes[0]!, false);
    assert.equal(JSON.stringify(result).includes("<html"), false);
  });

  it("records a sanitized transport cause and does not follow caller URLs", async () => {
    const error = new TypeError("fetch failed");
    error.cause = Object.assign(new Error("Connect Timeout Error"), {
      code: "UND_ERR_CONNECT_TIMEOUT",
    });
    const fetched: string[] = [];
    const result = await probeOfficialEiConnectivity(async (url) => {
      fetched.push(String(url));
      throw error;
    });
    assert.equal(result.ok, false);
    assert.equal(result.probes[0]?.success, false);
    assert.equal(result.probes[0]?.error?.name, "TypeError");
    assert.equal(result.probes[0]?.error?.causeCode, "UND_ERR_CONNECT_TIMEOUT");
    assert.equal(fetched.includes("https://evil.example/steal"), false);
  });

  it("rejects unauthorized requests and ignores query-string targets", async () => {
    const fetched: string[] = [];
    const unauthorized = await handleEiConnectivityRequest(
      new Request(
        "https://www.noxheim.com/api/internal/monitor/ei-connectivity?url=https://evil.example",
      ),
      {
        secret: "secret",
        fetchImpl: async (url) => {
          fetched.push(String(url));
          return mockResponse({ url: String(url) });
        },
      },
    );
    assert.equal(unauthorized.status, 401);
    assert.deepEqual(fetched, []);

    const authorized = await handleEiConnectivityRequest(
      new Request(
        "https://www.noxheim.com/api/internal/monitor/ei-connectivity?url=https://evil.example",
        { headers: { authorization: "Bearer secret" } },
      ),
      {
        secret: "secret",
        fetchImpl: async (url) => {
          fetched.push(String(url));
          return mockResponse({ url: String(url) });
        },
      },
    );
    assert.equal(authorized.status, 200);
    assert.deepEqual(fetched, EI_CONNECTIVITY_TARGETS.map((target) => target.url));
    assert.equal(fetched.includes("https://evil.example"), false);
  });

  it("rejects non-GET methods so it cannot be used as an arbitrary proxy", async () => {
    const fetched: string[] = [];
    const response = await handleEiConnectivityRequest(
      new Request("https://www.noxheim.com/api/internal/monitor/ei-connectivity", {
        method: "POST",
        headers: { authorization: "Bearer secret", "content-type": "application/json" },
        body: JSON.stringify({ url: "https://evil.example" }),
      }),
      {
        secret: "secret",
        fetchImpl: async (url) => {
          fetched.push(String(url));
          return mockResponse({ url: String(url) });
        },
      },
    );
    assert.equal(response.status, 405);
    assert.deepEqual(fetched, []);
  });
});
