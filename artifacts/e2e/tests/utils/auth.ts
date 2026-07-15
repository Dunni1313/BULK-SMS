// Shared sign-up-then-login helper reused by all 3 smoke specs. Each test
// creates its own fresh, unique user (no shared fixtures/seed data), the
// same collision-avoidance discipline the backend's own live-HTTP test
// suite has followed since Sprint 56.
import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export interface TestUser {
  email: string;
  password: string;
  name: string;
}

export function freshTestUser(label: string): TestUser {
  const id = randomUUID();
  return {
    email: `e2e-${label}-${id}@example.test`,
    password: `E2e-Test-Pw-${id}`,
    name: `E2E ${label}`,
  };
}

export async function signUpAndLogin(page: Page, user: TestUser): Promise<void> {
  await page.goto("/login");
  await page.getByRole("button", { name: /need an account\? sign up/i }).click();
  await page.getByLabel("Name").fill(user.name);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign up" }).click();

  // A successful sign-up navigates back to "/" (Login.tsx's own handleSubmit).
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
}
