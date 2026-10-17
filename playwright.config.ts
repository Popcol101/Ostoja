import { defineConfig, devices } from "@playwright/test";

// E2E na zbudowanej aplikacji (npm run build). Baza: ./scripts/db-reset.sh przed uruchomieniem (globalSetup).
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    locale: "pl-PL",
    timezoneId: "Europe/Warsaw",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "telefon", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, browserName: "chromium" } },
    { name: "komputer", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: [
    {
      command: "node tests/e2e/mock-supabase.mjs",
      url: "http://127.0.0.1:54399/health",
      reuseExistingServer: false,
      timeout: 10_000,
    },
    {
      command: "npx next start -p 3100",
      url: "http://localhost:3100",
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        DEMO_MODE: "true",
        SUPABASE_URL: "http://127.0.0.1:54399",
        SUPABASE_ANON_KEY: "test-anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
        APP_URL: "http://localhost:3100",
        CRON_SECRET: "test-cron-secret-1234567890",
        BREVO_API_KEY: "test-brevo-key",
        BREVO_API_URL: "http://127.0.0.1:54399",
        MAIL_FROM: "logowanie@ostoja.test",
        PWNED_CHECK: "off",
      },
    },
  ],
});
