import { defineConfig, devices } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";
import { testEnv } from "./tests/env";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

const testDir = defineBddConfig({
  features: "tests/e2e/features/*.feature",
  steps: "tests/e2e/steps/*.ts",
});

export default defineConfig({
  testDir,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],
  use: { baseURL, trace: "retain-on-failure", locale: "fr-FR" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `rm -rf .e2e-data && bun --bun vite dev --port ${PORT} --strictPort`,
        url: `${baseURL}/healthz`,
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          DATA_DIR: ".e2e-data",
          ADMIN_EMAIL: testEnv.admin.email,
          ADMIN_PASSWORD: testEnv.admin.password,
          PUBLIC_URL: baseURL,
        },
      },
});
