import { defineConfig } from "vitest/config";
import path from "node:path";
import { config } from "dotenv";

config({ path: ".env" });
// Integration tests use their own database so they never touch dev data.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "tests/stub-server-only.ts") } },
  test: { globalSetup: ["tests/global-setup.ts"], setupFiles: ["tests/setup-env.ts"], include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"], fileParallelism: false, testTimeout: 30000 },
});
