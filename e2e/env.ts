/**
 * Loads `.env` for the Playwright processes.
 *
 * The app gets its environment from Next.js, but `globalSetup` and the test
 * workers are plain Node processes and Prisma refuses to construct without
 * `DATABASE_URL`. Loaded as its own module rather than inside the fixtures so
 * both entry points can pull it in before anything touches the client.
 *
 * Variables already in `process.env` win, matching `--env-file`, so a
 * CI-injected `DATABASE_URL` is never clobbered by a developer's local file.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envFile = resolve(process.cwd(), ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. The E2E suite drives a real server against a real " +
      "database, so it needs the same environment the app uses.",
  );
}