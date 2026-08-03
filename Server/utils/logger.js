const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const path = require("path");
const fs = require("fs");

const LOG_DIR = path.join(process.cwd(), "logs");

// FIX: create log directory if it doesn't exist — original crashed on first run if /logs missing
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ─── Redact sensitive fields from log output ──────────────────────────────────
const SENSITIVE_FIELDS = ["password", "otp", "token", "secret", "authorization", "fcmToken", "refreshToken"];

const redact = winston.format((info) => {
  const sanitize = (obj) => {
    if (!obj || typeof obj !== "object") return obj;
    const clean = Array.isArray(obj) ? [...obj] : { ...obj };
    for (const key of Object.keys(clean)) {
      if (SENSITIVE_FIELDS.some((f) => key.toLowerCase().includes(f))) {
        clean[key] = "[REDACTED]";
      } else if (typeof clean[key] === "object") {
        clean[key] = sanitize(clean[key]);
      }
    }
    return clean;
  };
  if (info.body) info.body = sanitize(info.body);
  if (info.meta) info.meta = sanitize(info.meta);
  return info;
});

const baseFormat = winston.format.combine(
  redact(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return stack
      ? `[${timestamp}] ${level.toUpperCase()}: ${message}\n${stack}${metaStr}`
      : `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  })
);

const makeLogger = (label, level = "info") =>
  winston.createLogger({
    level: process.env.NODE_ENV === "production" ? level : "debug",
    defaultMeta: { service: label },
    format: baseFormat,
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), baseFormat),
        silent: process.env.NODE_ENV === "test",
      }),
      ...(process.env.NODE_ENV === "production"
        ? [
            new DailyRotateFile({
              filename: path.join(LOG_DIR, `${label}-%DATE%.log`),
              datePattern: "YYYY-MM-DD",
              maxFiles: "14d",
              maxSize: "20m",
              level: "info",
            }),
            new DailyRotateFile({
              filename: path.join(LOG_DIR, `${label}-error-%DATE%.log`),
              datePattern: "YYYY-MM-DD",
              maxFiles: "30d",
              maxSize: "20m",
              level: "error",
            }),
          ]
        : []),
    ],
  });

const logger = makeLogger("app");
const requestLogger = makeLogger("request");
const securityLogger = makeLogger("security", "warn");
const paymentLogger = makeLogger("payment");

module.exports = { logger, requestLogger, securityLogger, paymentLogger };

module.exports.default = logger;
module.exports.info = (...a) => logger.info(...a);
module.exports.warn = (...a) => logger.warn(...a);
module.exports.error = (...a) => logger.error(...a);
module.exports.debug = (...a) => logger.debug(...a);
