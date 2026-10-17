import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/commerceos/tests/e2e-dev",
  fullyParallel: false,
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3001",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "pnpm --filter @commerceos/app dev --hostname 127.0.0.1 --port 3001",
    env: {
      NODE_ENV: "development",
      INFERENCE_PROVIDER: "disabled",
    },
    url: "http://127.0.0.1:3001/api/v1/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
