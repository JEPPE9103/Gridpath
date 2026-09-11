import { expect, test } from "@playwright/test";

test.describe("public marketing", () => {
  test("landing page presents development intelligence", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Development Intelligence/i);
    await expect(
      page.getByRole("heading", { level: 1, name: /find stronger development opportunities/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /book a demo/i }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /search a geography/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /does not hide missing evidence/i })).toBeVisible();
  });

  test("about page matches development intelligence category", async ({ page }) => {
    await page.goto("/about");
    await expect(
      page.getByRole("heading", { name: /development intelligence for bess/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /book a demo/i }).first()).toBeVisible();
  });
});

test.describe("public authentication routes", () => {
  test("unauthenticated protected routes redirect to login", async ({ page }) => {
    await page.goto("/overview");
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/portfolio");
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/opportunities");
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/opportunities/new");
    await expect(page).toHaveURL(/\/login/);
  });

  test("reset-password without a recovery session stays on the dedicated page", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page.getByRole("heading", { name: /invalid reset link|choose new password/i })).toBeVisible();
    await expect(page).not.toHaveURL(/\/(portfolio|overview|onboarding)/);
  });

  test("forgot-password is reachable from login", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /forgot password/i }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.getByRole("button", { name: /send reset link/i })).toBeVisible();
  });
});
