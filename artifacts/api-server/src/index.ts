import app from "./app";
import { logger } from "./lib/logger";
import { ensureCoreCatalog, ensureProductionAdmin, seedDatabase } from "./lib/seed";
import { runMigrations } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Run database migrations before accepting any requests.
// This ensures schema is always up-to-date on every deployment,
// including production (Railway), without manual push steps.
runMigrations()
  .then(async () => {
    logger.info("Database migrations applied successfully");
    await ensureCoreCatalog();
    app.listen(port, () => {
      logger.info({ port }, "Server listening");
      // Auto-seed only in development — never run in production to avoid
      // inserting predictable credentials into a live environment.
      if (process.env.NODE_ENV === "development") {
        seedDatabase().catch((err) => {
          logger.error({ err }, "Seed failed");
        });
      } else if (process.env.NODE_ENV === "production") {
        ensureProductionAdmin().catch((err) => {
          logger.error({ err }, "Production admin bootstrap failed");
        });
      }
    });
  })
  .catch((err: unknown) => {
    const errorDetails =
      err instanceof Error
        ? { name: err.name, message: err.message, stack: err.stack }
        : { value: String(err) };
    logger.error(
      { migrationError: errorDetails },
      "Database migration failed — server will not start",
    );
    // Keep the full cause visible in platforms that only display plain log
    // messages and strip structured logger fields.
    console.error("Database migration failure details:", errorDetails);
    process.exit(1);
  });
