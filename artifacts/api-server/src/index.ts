import app from "./app";
import { logger } from "./lib/logger";
import { scheduleStartupGuideGeneration } from "./routes/downloads.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Regenerate the user guide if files are absent or REGEN_GUIDE_ON_START=true.
  scheduleStartupGuideGeneration();
});
