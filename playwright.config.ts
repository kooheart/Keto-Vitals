import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";
config({ path: ".env" });

const PORT = 3100;
const dbUrl = process.env.E2E_DATABASE_URL!;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 45_000,
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] } },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Production build must exist (`npm run build`). Uses the isolated e2e database.
  webServer: {
    command: `node tests/e2e/prepare-db.mjs && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/cart`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { DATABASE_URL: dbUrl, APP_URL: `http://localhost:${PORT}`, APP_SECRET: "e2e-secret", NODE_ENV: "production", RAZORPAY_KEY_ID: "", RAZORPAY_KEY_SECRET: "" },
  },
});
