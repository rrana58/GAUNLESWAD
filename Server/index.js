require("dotenv").config();

// ─── Validate env FIRST — fail fast with clear messages ──────────────────────
const { validateEnv } = require("./utils/validateEnv");
validateEnv();

const http = require("http");
const app = require("./app");
const connectDB = require("./config/db");
const { initSocket } = require("./config/socket");
const { logger } = require("./utils/logger");

const PORT = parseInt(process.env.PORT) || 5000;

process.on("uncaughtException", (err) => {
  logger.error("UNCAUGHT EXCEPTION — shutting down", { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("UNHANDLED REJECTION", { reason: String(reason) });
});

async function startServer() {
  await connectDB();

  const server = http.createServer(app);

  // initSocket is now async (waits for Redis adapter to connect)
  await initSocket(server);

  // Start background jobs AFTER DB + Redis are ready
  require("./jobs/queues");

  server.listen(PORT, () => {
    logger.info(`🚀 Gharko Swad API on port ${PORT} [${process.env.NODE_ENV}]`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      const mongoose = require("mongoose");
      await mongoose.connection.close();
      logger.info("Server and DB connections closed. Goodbye.");
      process.exit(0);
    });
    setTimeout(() => { logger.error("Forced shutdown after 10s"); process.exit(1); }, 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));
}

startServer().catch((err) => {
  logger.error("Server failed to start", { error: err.message });
  process.exit(1);
});
