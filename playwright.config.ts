import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/commerceos/tests/e2e",
  fullyParallel: false,
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm --filter @commerceos/app start --hostname 127.0.0.1",
    env: {
      INFERENCE_PROVIDER: "disabled",
    },
    url: "http://127.0.0.1:3000/api/v1/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
