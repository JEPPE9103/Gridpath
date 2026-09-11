import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_EMAIL ?? "";
const password = process.env.E2E_PASSWORD ?? "";
const hasAuth = Boolean(email && password);

test.describe("Map workspace", () => {
  test("unauthenticated /map redirects to login", async ({ page }) => {
    await page.goto("/map");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("authenticated Map workspace", () => {
  test.skip(!hasAuth, "Set E2E_EMAIL and E2E_PASSWORD against local or staging, never production ingest.");

  test("loads as a spatial workspace and keeps Opportunity clicks on /map", async ({ page }) => {
    await signIn(page);
    if (page.url().includes("/onboarding")) {
      test.skip(true, "Empty tenant onboarding is environment-specific.");
    }

    await page.goto("/map");
    await expect(page.getByRole("heading", { name: /^Map$/i })).toBeVisible();
    await expect(page.getByTestId("map-canvas")).toBeVisible();
    await expect(page.getByTestId("map-new-search")).toBeVisible();
    await expect(page.getByTestId("map-discovery")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Filters$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Layers$/ })).toBeVisible();

    await page.getByRole("button", { name: /^Layers$/ }).click();
    await expect(page.getByTestId("map-layers")).toBeVisible();
    await expect(page.getByText(/covering geography, not available connection capacity/i).first()).toBeVisible();
    await expect(page.getByTestId("map-layer-nup")).not.toBeChecked();
    await expect(page.getByTestId("map-layer-opportunity-zones")).not.toBeChecked();
    await expect(page.getByTestId("map-layer-local-network")).toBeChecked();

    await page.getByTestId("map-layer-local-network").uncheck();
    await expect(page.getByTestId("map-layer-local-network")).not.toBeChecked();
    await page.getByTestId("map-layer-local-network").check();
    await expect(page.getByTestId("map-canvas")).toBeVisible();

    const projectMarker = page.getByRole("button", { name: /, project$/i }).first();
    if (await projectMarker.count()) {
      await projectMarker.click();
      await expect(page).toHaveURL(/\/map/);
      await expect(page.getByTestId("map-project-panel")).toBeVisible();
      await expect(page.getByText(/official geographic covering/i).first()).toBeVisible();
      await expect(page.getByRole("link", { name: /open project/i })).toBeVisible();
    }

    const opportunityMarker = page.getByRole("button", { name: /, opportunity$/i }).first();
    if (await opportunityMarker.count()) {
      await opportunityMarker.click();
      await expect(page).toHaveURL(/\/map/);
      await expect(page.getByTestId("map-opportunity-panel")).toBeVisible();
      const openOpportunity = page.getByTestId("map-open-opportunity");
      await expect(openOpportunity).toBeVisible();
      await openOpportunity.click();
      await expect(page).toHaveURL(/\/opportunities\//);
      await page.goto("/map");
      await expect(page.getByTestId("map-canvas")).toBeVisible();
    }

    const discoverySelect = page.getByLabel("Selected screening run");
    if (await discoverySelect.count()) {
      const runValue = await discoverySelect.locator("option:enabled").nth(1).getAttribute("value");
      if (runValue) {
        await discoverySelect.selectOption(runValue);
        await expect(page.getByTestId("map-canvas")).toBeVisible();
        await page.getByText(/loading selected screening run/i).waitFor({ timeout: 8_000 }).catch(() => {});
        await expect(page.getByTestId("map-discovery")).toBeVisible();
        await page.getByText(/loading selected screening run/i).waitFor({ state: "hidden", timeout: 20_000 }).catch(() => {});
        const candidateClick = await clickVisibleCandidateSite(page);
        if (candidateClick.attempted) {
          await expect(page.getByTestId("map-candidate-panel")).toBeVisible({ timeout: 8_000 });
          await expect(page.getByTestId("map-candidate-panel")).toContainText(/Candidate Site/i);
          await expect(page.getByTestId("map-candidate-panel")).toContainText(/Noxheim Derived/i);
          await expect(page.getByTestId("map-official-panel")).toHaveCount(0);
          await expect(page).toHaveURL(/\/map/);
        }
      }
    } else {
      await expect(page.getByTestId("map-discovery").getByText(/no searches yet/i)).toBeVisible();
    }

    if (await page.getByTestId("map-official-degraded").count()) {
      await expect(page.getByTestId("map-official-degraded")).toContainText(/unavailable/i);
      await expect(page.getByTestId("map-official-degraded")).not.toContainText(/no geographic match/i);
    }

    await page.getByTestId("map-hide-panels").click();
    await expect(page.getByRole("button", { name: /show panels/i })).toBeVisible();
    await page.getByRole("button", { name: /show panels/i }).click();
    await expect(page.getByTestId("map-new-search")).toBeVisible();
    await page.getByRole("button", { name: /^Layers$/ }).click();
    await expect(page.getByTestId("map-layers")).toBeVisible();
  });
});

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/work email/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(portfolio|overview|onboarding)/);
}

async function clickVisibleCandidateSite(page: Page): Promise<{ attempted: boolean }> {
  const ready = await page
    .waitForFunction(() => {
      const canvas = document.querySelector("[data-testid=map-canvas]") as
        | (HTMLDivElement & { __noxheimMap?: CandidateHitMap })
        | null;
      const map = canvas?.__noxheimMap;
      if (!map) return false;
      return map
        .querySourceFeatures("map-candidates")
        .some((feature) => feature.properties?.candidateKind === "site");
    }, undefined, { timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
  if (!ready) return { attempted: false };

  const target = await page.evaluate(() => {
    const canvas = document.querySelector("[data-testid=map-canvas]") as
      | (HTMLDivElement & { __noxheimMap?: CandidateHitMap })
      | null;
    const map = canvas?.__noxheimMap;
    if (!map || !canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const projectMarkers = [...document.querySelectorAll('button[aria-label$=", project"]')].map((el) => {
      const box = el.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    });
    const features = map
      .querySourceFeatures("map-candidates")
      .filter((feature) => feature.properties?.candidateKind === "site");
    const points: Array<{ x: number; y: number; rank: number }> = [];
    for (const feature of features) {
      const id = feature.properties?.id;
      if (typeof id !== "string") continue;
      for (const sample of sampleLngLats(feature.geometry)) {
        const projected = map.project(sample);
        if (
          projected.x < 8 ||
          projected.y < 8 ||
          projected.x > rect.width - 8 ||
          projected.y > rect.height - 8
        ) {
          continue;
        }
        const hits = map.queryRenderedFeatures(projected, { layers: ["map-candidates-fill"] });
        if (!hits.some((hit) => hit.properties?.id === id)) continue;
        const x = rect.left + projected.x;
        const y = rect.top + projected.y;
        if (projectMarkers.some((marker) => Math.hypot(marker.x - x, marker.y - y) < 18)) continue;
        const rank = feature.properties?.rank;
        points.push({
          x,
          y,
          rank: typeof rank === "number" ? rank : 999,
        });
        break;
      }
    }
    points.sort((left, right) => left.rank - right.rank);
    return points[0] ?? null;

    function sampleLngLats(geometry: { type?: string; coordinates?: unknown } | undefined): Array<[number, number]> {
      if (!geometry) return [];
      if (geometry.type === "Point" && Array.isArray(geometry.coordinates)) {
        const pair = geometry.coordinates as number[];
        return [[pair[0], pair[1]]];
      }
      const ring =
        geometry.type === "Polygon"
          ? (geometry.coordinates as number[][][] | undefined)?.[0]
          : geometry.type === "MultiPolygon"
            ? (geometry.coordinates as number[][][][] | undefined)?.[0]?.[0]
            : null;
      if (!ring?.length) return [];
      let x = 0;
      let y = 0;
      for (const pair of ring) {
        x += pair[0];
        y += pair[1];
      }
      const centroid: [number, number] = [x / ring.length, y / ring.length];
      const mid = ring[Math.floor(ring.length / 2)] as [number, number];
      return [centroid, ring[0] as [number, number], mid];
    }
  });

  if (!target) return { attempted: false };
  await page.mouse.click(target.x, target.y);
  return { attempted: true };
}

type CandidateHitMap = {
  project: (lngLat: [number, number]) => { x: number; y: number };
  queryRenderedFeatures: (
    point: { x: number; y: number },
    options: { layers: string[] },
  ) => Array<{ properties?: Record<string, unknown> }>;
  querySourceFeatures: (source: string) => Array<{
    geometry?: { type?: string; coordinates?: unknown };
    properties?: Record<string, unknown>;
  }>;
};
