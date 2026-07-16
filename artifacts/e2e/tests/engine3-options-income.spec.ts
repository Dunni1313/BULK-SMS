// Phase 6, Sprint 69 — first E2E smoke slice, Engine 3 (Options Income).
// login -> open the Portfolio AI cockpit -> see real, backend-computed
// portfolio health scores (the account is auto-seeded with 3 trades on
// first access, per lib/dailyReport.ts's own ensureSeedTrades()).
import { test, expect } from "@playwright/test";
import { freshTestUser, signUpAndLogin } from "./utils/auth";

test("Engine 3 — Options Income: sign up, log in, and view real Portfolio Health scores", async ({ page }) => {
  const user = freshTestUser("engine3");
  await signUpAndLogin(page, user);

  await page.goto("/portfolio-ai");
  await expect(page.getByRole("heading", { name: "Portfolio AI" })).toBeVisible();

  // Skeletons render first while /portfolio/health resolves; the real
  // gauge cards replace them once the backend responds. `exact: true`
  // disambiguates from the page's own "Portfolio Health Trend" heading,
  // which also contains this substring.
  await expect(page.getByText("Portfolio Health", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Market Exposure", { exact: true })).toBeVisible();
});
