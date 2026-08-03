const Redis = require("ioredis");
const logger = require("../utils/logger");

let redis;

const getRedis = () => {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    redis.on("connect", () => logger.info("✅ Redis connected"));
    redis.on("error", (err) => logger.error(`Redis error: ${err.message}`));
    redis.on("reconnecting", () => logger.warn("Redis reconnecting..."));
  }
  return redis;
};

module.exports = { getRedis };
