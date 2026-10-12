import { execSync } from "node:child_process";
import { config } from "dotenv";

/** Applies migrations to the dedicated test database before the suite runs. */
export default function setup() {
  config({ path: ".env" });
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is required to run the test suite (see .env.example).");
  if (!/test/i.test(new URL(url).pathname)) throw new Error("Refusing to run tests against a database whose name does not contain 'test'.");
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: url } });
}
