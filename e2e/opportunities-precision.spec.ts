import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_EMAIL ?? "";
const password = process.env.E2E_PASSWORD ?? "";
const hasAuth = Boolean(email && password);

test.describe("Opportunity precision screening", () => {
  test.skip(!hasAuth, "Set E2E_EMAIL and E2E_PASSWORD against local or staging, never production ingest.");

  test("login, opportunities, new search, and provider-unavailable copy", async ({ page }) => {
    test.setTimeout(60_000);
    await signIn(page);
    if (page.url().includes("/onboarding")) {
      test.skip(true, "Empty tenant onboarding is environment-specific.");
    }

    await page.goto("/opportunities");
    await expect(page.getByRole("heading", { name: /opportunit/i }).first()).toBeVisible();
    const emptyBody = (await page.locator("body").innerText()).toLowerCase();
    if (emptyBody.includes("no opportunities yet") || emptyBody.includes("first development opportunity")) {
      expect(emptyBody.includes("first development opportunity") || emptyBody.includes("new search")).toBeTruthy();
    }

    await page.goto("/opportunities/new");
    await expect(page.getByRole("heading", { name: /new opportunity search/i })).toBeVisible();
    await expect(page.getByText(/discovery screening/i).first()).toBeVisible();
    await expect(page.getByText(/nmd 2023/i).first()).toBeVisible();

    await page.goto("/settings");
    await expect(page.getByText(/data sources/i).first()).toBeVisible();
    await expect(page.getByText(/source resolution is 10 m/i).first()).toBeVisible();
    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body.includes("available mw") || body.includes("grid connection likely")).toBeFalsy();
    expect(body.includes("noxheim capacity estimate")).toBeFalsy();
  });

  test("missing physical providers must not crash settings or invent capacity", async ({ page }) => {
    await signIn(page);
    if (page.url().includes("/onboarding")) {
      test.skip(true, "Empty tenant onboarding is environment-specific.");
    }

    await page.goto("/settings");
    await expect(page.getByText(/data sources/i).first()).toBeVisible();
    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(
      body.includes("never ingested") ||
        body.includes("failed") ||
        body.includes("healthy") ||
        body.includes("source"),
    ).toBeTruthy();
    expect(body.includes("noxheim capacity estimate")).toBeFalsy();
    expect(body.includes("lantmäteriet") || body.includes("lantmateriet") || body.includes("copernicus")).toBeTruthy();
  });

  test("authenticated Hallsberg BESS search, refine, save, shortlist, promote", async ({ page }) => {
    test.setTimeout(240_000);
    await signIn(page);
    if (page.url().includes("/onboarding")) {
      test.skip(true, "Empty tenant onboarding is environment-specific.");
    }

    await page.goto("/opportunities/new");
    await expect(page.getByRole("heading", { name: /new opportunity search/i })).toBeVisible();
    await page.getByLabel(/search name/i).fill("Hallsberg BESS E2E");
    await page.getByLabel(/^west$/i).fill("14.9");
    await page.getByLabel(/^south$/i).fill("59.1");
    await page.getByLabel(/^east$/i).fill("15.4");
    await page.getByLabel(/^north$/i).fill("59.4");
    await page.getByRole("button", { name: /find candidate sites/i }).click({ noWaitAfter: true });
    await Promise.race([
      page.getByRole("heading", { name: /analysing search area/i }).waitFor({ state: "visible", timeout: 8_000 }),
      page.waitForURL(/\/opportunities\/searches\/.+\/runs\/.+/, { timeout: 8_000 }),
    ]).catch(() => undefined);

    await page.waitForURL(/\/opportunities\/searches\/.+\/runs\/.+/, { timeout: 180_000 });
    await expect(page.getByText(/candidate sites identified/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/opportunity zones/i).first()).toBeVisible();
    await expect(page.getByText(/evidence coverage/i).first()).toBeVisible();
    await expect(page.getByText(/not an indication of available connection capacity/i).first()).toBeVisible();
    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body.includes("failed geometry") || body.includes("bad site")).toBeFalsy();
    expect(body.includes("search failed")).toBeFalsy();
    const firstAreaLine = page.getByRole("button", { name: /#\d+/ }).first();
    await expect(firstAreaLine).toBeVisible();
    const firstText = (await firstAreaLine.innerText()).replaceAll(",", "");
    expect(firstText).not.toMatch(/\b([5-9]\d{3}|\d{5,})\s*ha\b/i);
    await expect(page.locator("canvas, [class*='map']").first()).toBeVisible();

    const firstCandidate = page.getByRole("button", { name: /#\d+/ }).first();
    if (await firstCandidate.count()) {
      await firstCandidate.click();
    }

    const refine = page.getByRole("button", { name: /refine candidate/i });
    if (await refine.count()) {
      await refine.click();
      await expect(page.getByText(/detailed site screening|refine/i).first()).toBeVisible({ timeout: 120_000 });
    }

    const compare = page.getByRole("button", { name: /^compare$/i }).first();
    if (await compare.count()) {
      await compare.click();
    }

    const save = page.getByRole("button", { name: /save as opportunity/i });
    await expect(save).toBeVisible();
    await save.click();
    await page.waitForURL(/\/opportunities\/(?!new|searches).+/, { timeout: 60_000 });

    await page.getByRole("button", { name: /^shortlist$/i }).click();
    await page.getByRole("button", { name: /promote to project/i }).click();
    await page.waitForURL(/\/projects\//, { timeout: 60_000 });
    await expect(page.getByText(/originating opportunity/i)).toBeVisible();
    await page.getByRole("link", { name: /hallsberg bess e2e/i }).first().click();
    await expect(page.getByRole("heading", { name: /hallsberg bess e2e/i }).first()).toBeVisible();
  });
});

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/work email/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(portfolio|overview|onboarding)/);
}
