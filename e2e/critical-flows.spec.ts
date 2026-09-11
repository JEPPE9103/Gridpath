import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_EMAIL ?? "";
const password = process.env.E2E_PASSWORD ?? "";
const hasAuth = Boolean(email && password);

test.describe("Noxheim V1 critical flows", () => {
  test.skip(!hasAuth, "Set E2E_EMAIL and E2E_PASSWORD against local or staging, never production ingest.");

  test("login, portfolio, project GI, alerts bell, compare, settings, changes", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel(/work email/i).fill(email);
    await page.getByLabel(/^password$/i).fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/(portfolio|overview|onboarding)/);

    if (page.url().includes("/onboarding")) {
      await expect(page.getByText(/workspace|organization/i).first()).toBeVisible();
      return;
    }

    await page.goto("/portfolio");
    await expect(page.getByRole("heading", { name: /portfolio/i })).toBeVisible();

    await page.goto("/portfolio/import");
    await expect(page.getByText(/import/i).first()).toBeVisible();

    await page.goto("/alerts");
    await expect(page.getByRole("heading", { name: /alert/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /open alerts/i })).toBeVisible();

    await page.goto("/compare");
    await expect(page.getByText(/compare/i).first()).toBeVisible();

    await page.goto("/changes");
    await expect(page.getByText(/change/i).first()).toBeVisible();

    await page.goto("/settings");
    await expect(page.getByText(/data sources|email notifications/i).first()).toBeVisible();
    await expect(page.getByText(/weekly digest/i)).toBeVisible();

    await page.goto("/internal/operations");
    await expectOperatorToolingHiddenFromCustomer(page);
  });

  test("create project from portfolio when the form is available", async ({ page }) => {
    await signIn(page);
    if (page.url().includes("/onboarding")) {
      test.skip(true, "Empty tenant onboarding is environment-specific.");
    }
    await page.goto("/portfolio");
    await expect(page.getByRole("heading", { name: /^Portfolio$/i })).toBeVisible();
    const create = page.getByRole("link", { name: "Add project", exact: true });
    try {
      await expect(create).toBeVisible({ timeout: 10_000 });
    } catch {
      test.skip(true, "Create-project control not visible for this fixture user.");
    }
    await create.click();
    await page.waitForURL(/\/projects\/new/);
    await expect(page.getByRole("heading", { name: /^Add project$/i })).toBeVisible();
    await expect(page.getByText("Project name", { exact: true })).toBeVisible();
  });

  test("viewer cannot reach operator internals as a customer page", async ({ page }) => {
    await signIn(page);
    await page.goto("/internal/operations");
    await expectOperatorToolingHiddenFromCustomer(page);
  });
});

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/work email/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(portfolio|overview|onboarding)/);
}

async function expectOperatorToolingHiddenFromCustomer(page: Page) {
  const operatorAllowlisted = Boolean(
    email && process.env.OPERATOR_EMAILS?.toLowerCase().includes(email.toLowerCase()),
  );
  const response = await page.goto("/internal/operations");
  if (operatorAllowlisted) {
    await expect(page.getByRole("heading", { name: /^operations$/i })).toBeVisible();
    return;
  }
  expect(response?.status()).toBe(404);
  const html = (await page.content()).toLowerCase();
  expect(
    html.includes('name="next-error" content="not-found"') ||
      html.includes('name="boundary-next-error" content="not-found"'),
  ).toBeTruthy();
  expect(html.includes("recent ingestion runs")).toBeFalsy();
  expect(html.includes("noxheim operators only")).toBeFalsy();
  expect(html.includes("failed notification deliveries")).toBeFalsy();
}
