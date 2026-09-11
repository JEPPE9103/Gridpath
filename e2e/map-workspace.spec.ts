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
    await expect(page.getByText("Project filters")).toBeVisible();
    await expect(page.getByText(/covering geography, not connection capacity/i).first()).toBeVisible();
    await expect(page.getByText(/not available connection capacity/i).first()).toBeVisible();

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
    }

    const discoverySelect = page.getByLabel("Selected screening run");
    if (await discoverySelect.count()) {
      const labels = await discoverySelect.locator("option:enabled").allTextContents();
      const completed = labels.find((label) => /Completed/i.test(label));
      if (completed) {
        await discoverySelect.selectOption({ label: completed });
        await expect(page.getByText(/loading selected screening run|candidate site/i).first()).toBeVisible({
          timeout: 20_000,
        });
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
