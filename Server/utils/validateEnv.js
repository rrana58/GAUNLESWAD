/**
 * utils/validateEnv.js
 * Validates all required environment variables at startup using Zod.
 * If any are missing/invalid the process exits with a clear error — the server
 * should never start in a broken state.
 */
const { z } = require("zod");

const envSchema = z.object({
  // ─── Core ──────────────────────────────────────────────────────────────────
  NODE_ENV: z.enum(["development", "production", "test"]),
  PORT: z.string().regex(/^\d+$/).optional(),

  // ─── Database ──────────────────────────────────────────────────────────────
  MONGO_URI: z.string().min(10, "MONGO_URI is required"),

  // ─── Auth ──────────────────────────────────────────────────────────────────
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),

  // ─── Redis ─────────────────────────────────────────────────────────────────
  REDIS_URL: z.string().min(5, "REDIS_URL is required"),

  // ─── Payments ──────────────────────────────────────────────────────────────
  KHALTI_SECRET_KEY: z.string().min(1, "KHALTI_SECRET_KEY is required"),
  ESEWA_SECRET_KEY: z.string().min(1, "ESEWA_SECRET_KEY is required"),
  ESEWA_MERCHANT_CODE: z.string().min(1, "ESEWA_MERCHANT_CODE is required"),

  // ─── Cloudinary ────────────────────────────────────────────────────────────
  CLOUDINARY_CLOUD_NAME: z.string().min(1, "CLOUDINARY_CLOUD_NAME is required"),
  CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY is required"),
  CLOUDINARY_API_SECRET: z.string().min(1, "CLOUDINARY_API_SECRET is required"),

  // ─── SMS ───────────────────────────────────────────────────────────────────
  SPARROW_TOKEN: z.string().min(1, "SPARROW_TOKEN is required"),
  SPARROW_SENDER: z.string().min(1, "SPARROW_SENDER is required"),

  // ─── Firebase ──────────────────────────────────────────────────────────────
  FIREBASE_PROJECT_ID: z.string().min(1, "FIREBASE_PROJECT_ID is required"),
  FIREBASE_CLIENT_EMAIL: z.string().email("FIREBASE_CLIENT_EMAIL must be valid"),
  FIREBASE_PRIVATE_KEY: z.string().min(1, "FIREBASE_PRIVATE_KEY is required"),

  // ─── App URLs ──────────────────────────────────────────────────────────────
  WEB_URL: z.string().url("WEB_URL must be a valid URL"),
  ADMIN_URL: z.string().url("ADMIN_URL must be a valid URL").optional(),

  // ─── Operating hours (optional — defaults applied elsewhere) ───────────────
  KITCHEN_OPEN_HOUR: z.string().regex(/^\d{1,2}$/).optional(),   // "7"
  KITCHEN_CLOSE_HOUR: z.string().regex(/^\d{1,2}$/).optional(),  // "22"
});

/**
 * Call once at the very top of index.js.
 * Logs every failing field then exits so the developer sees all problems at once.
 */
function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.issues.map((e) => `  • ${e.path.join(".")}: ${e.message}`);
    console.error("❌ Environment validation failed:\n" + errors.join("\n"));
    process.exit(1);
  }

  // Extra production-only guard — never ship with a default secret
  if (
    process.env.NODE_ENV === "production" &&
    (process.env.JWT_SECRET === "change_me" ||
      process.env.JWT_REFRESH_SECRET === "change_me")
  ) {
    console.error("❌ Default secrets detected in production — aborting.");
    process.exit(1);
  }

  return result.data;
}

module.exports = { validateEnv };
