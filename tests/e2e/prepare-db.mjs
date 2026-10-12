// Prepares the dedicated e2e database (migrate → truncate → seed), then exits.
// Run before `next start` by playwright.config.ts. Refuses to touch any DB not named *e2e*/*test*.
import { execSync } from "node:child_process";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
config({ path: ".env" });
const url = process.env.E2E_DATABASE_URL;
if (!url || !/e2e|test/i.test(new URL(url).pathname)) throw new Error("E2E_DATABASE_URL must point to a dedicated e2e/test database.");
const env = { ...process.env, DATABASE_URL: url, SEED_ADMIN_EMAIL: "admin@e2e.test", SEED_ADMIN_PASSWORD: "E2eAdmin#123" };
execSync("npx prisma migrate deploy", { stdio: "pipe", env });
const db = new PrismaClient({ datasources: { db: { url } } });
const tables = (await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`).map((t) => `"${t.tablename}"`);
await db.$executeRawUnsafe(`TRUNCATE ${tables.join(", ")} RESTART IDENTITY CASCADE`);
await db.$disconnect();
execSync("npx tsx prisma/seed.ts", { stdio: "pipe", env });
