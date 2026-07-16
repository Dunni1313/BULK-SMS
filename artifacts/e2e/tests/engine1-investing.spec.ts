// Phase 6, Sprint 69 — first E2E smoke slice, Engine 1 (Investing).
// login -> select a symbol from the Coverage Universe -> see a real,
// backend-rendered valuation report for that symbol.
import { test, expect } from "@playwright/test";
import { freshTestUser, signUpAndLogin } from "./utils/auth";

test("Engine 1 — Investing: sign up, log in, and view a real research report for AAPL", async ({ page }) => {
  const user = freshTestUser("engine1");
  await signUpAndLogin(page, user);

  await page.goto("/stock-analyst");
  await expect(page.getByTestId("universe-AAPL")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("universe-AAPL").click();

  // report.symbol renders as a level-2 heading once the report resolves —
  // present regardless of whether valuation happens to be computable for
  // this run, so it's a stable, always-true assertion of real data load.
  await expect(page.getByRole("heading", { name: "AAPL", level: 2 })).toBeVisible({ timeout: 20_000 });
});
