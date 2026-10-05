import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * One end-to-end happy path, against a real production build.
 *
 * `npm run dev` would be quicker, but a dev server compiles routes on first
 * request and tolerates state the build rejects - which is the drift worth
 * catching. `reuseExistingServer` still lets a server already listening on the
 * port be used, so iterating locally does not pay for a rebuild each time.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",

  // The assertions read shared stock levels and movement rows, so two workers
  // fulfilling at once would race each other's counts. One path does not need
  // more parallelism than that.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },

  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      // Auth.js only trusts the incoming Host outside of dev when one of
      // AUTH_URL / AUTH_TRUST_HOST / VERCEL / CF_PAGES is set. Vercel sets its
      // own, which is why `vercel-build` works and a local production server
      // does not - without this every sign-in redirects to /api/auth/error. Note
      // that NEXTAUTH_URL, which .env.example documents, is not on that list.
      AUTH_URL: baseURL,
    },
  },
});