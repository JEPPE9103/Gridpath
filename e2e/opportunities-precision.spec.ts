import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_EMAIL ?? "";
const password = process.env.E2E_PASSWORD ?? "";
const hasAuth = Boolean(email && password);

test.describe("Opportunity precision screening", () => {
  test.skip(!hasAuth, "Set E2E_EMAIL and E2E_PASSWORD against local or staging, never production ingest.");

  test("login, opportunities, new search, and provider-unavailable copy", async ({ page }) => {
    await signIn(page);
    if (page.url().includes("/onboarding")) {
      test.skip(true, "Empty tenant onboarding is environment-specific.");
    }

    await page.goto("/opportunities");
    await expect(page.getByRole("heading", { name: /opportunit/i }).first()).toBeVisible();

    await page.goto("/opportunities/new");
    await expect(page.getByRole("heading", { name: /new opportunity search/i })).toBeVisible();
    await expect(page.getByText(/discovery screening/i).first()).toBeVisible();
    await expect(page.getByText(/nmd 2023/i).first()).toBeVisible();

    await page.goto("/settings");
    await expect(page.getByText(/data sources/i).first()).toBeVisible();
    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body.includes("available mw") || body.includes("grid connection likely")).toBeFalsy();
    expect(body.includes("noxheim capacity estimate")).toBeFalsy();
  });

  test("missing physical providers must not crash settings or invent capacity", async ({ page }) => {
    await signIn(page);
    await page.goto("/settings");
    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body.includes("never ingested") || body.includes("failed") || body.includes("healthy") || body.includes("source")).toBeTruthy();
    expect(body.includes("noxheim capacity estimate")).toBeFalsy();
  });
});

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/work email/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(portfolio|overview|onboarding)/);
}
