require("dotenv").config();
const express = require("express");
const compression = require("compression");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const crypto = require("crypto");
const mongoose = require("mongoose");

const { globalLimiter, authLimiter, otpLimiter, otpPhoneLimiter, adminLimiter, paymentLimiter } = require("./middleware/rateLimiter");
const { sanitizeInput } = require("./middleware/sanitize");
const authRoutes = require("./routes/auth.routes");
const menuRoutes = require("./routes/menu.routes");
const orderRoutes = require("./routes/order.routes");
const paymentRoutes = require("./routes/payment.routes");
const userRoutes = require("./routes/user.routes");
const adminRoutes = require("./routes/admin.routes");
const uploadRoutes = require("./routes/upload.routes");
const reviewRoutes = require("./routes/review.routes");
const notificationRoutes = require("./routes/notification.routes");
const specialSessionRoutes = require("./routes/specialSession.routes");
const mealPlanRoutes = require("./routes/mealPlan.routes");
const celebrationPackageRoutes = require("./routes/celebrationPackage.routes");
const subscriptionRoutes = require("./routes/subscription.routes");
const addressRoutes = require("./routes/address.routes");
const announcementRoutes = require("./routes/announcement.routes");
const jobRoutes = require("./routes/job.routes");
const couponRoutes = require("./routes/coupon.routes");
const errorHandler = require("./middleware/errorHandler");
const { requestLogger, securityLogger } = require("./utils/logger");
const { getRedis } = require("./config/redis");

const app = express();

// 1. Trust proxy (Railway / Render / Nginx / Cloudflare, etc.)
// FIX: this was hardcoded to 1, which is only correct if there is EXACTLY one
// reverse proxy hop in front of the app. If you ever add Cloudflare, a load
// balancer, or anything else in front of your current host, this silently
// starts reporting the wrong req.ip for every request — which breaks every
// rate limiter above it (IP-keyed limits start bucketing everyone together,
// or nobody together). Set TRUST_PROXY_HOPS in your env to match your actual
// proxy chain (e.g. 1 for Render alone, 2 if you put Cloudflare in front of it).
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS ?? 1));

// 2. Compression — reduce JSON payload sizes by ~70%
app.use(compression({ threshold: 1024 }));

// 2. HTTPS redirect in production
if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    if (req.headers["x-forwarded-proto"] !== "https") {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// 3. Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://www.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com"],
        connectSrc: ["'self'", "https://firebaseinstallations.googleapis.com", "https://fcmregistrations.googleapis.com", "wss:", "ws:"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        workerSrc: ["'self'", "blob:"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    noSniff: true,
    hidePoweredBy: true,
    crossOriginEmbedderPolicy: false,
    permissionsPolicy: {
      camera: [],
      microphone: [],
      geolocation: ["self"],
      payment: [],
      usb: [],
      fullscreen: ["self"],
    },
  })
);

// 4. CORS — strict origin whitelist
const allowedOrigins = [
  process.env.WEB_URL,
  process.env.ADMIN_URL,
  process.env.MOBILE_WEB_URL,
  process.env.SERVER_URL,
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  ...(process.env.NODE_ENV === "development"
  ? [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5173",
      "http://localhost:5174", // Admin
      "http://localhost:5175", // Kitchen
      "http://localhost:5176", // Rider
      "http://localhost:5177",
      "http://localhost:8081",
    ]
  : []),
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin / direct asset requests (no Origin header sent by browser for standard GETs)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      securityLogger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error("Origin not allowed."), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
    exposedHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-Request-ID"],
    maxAge: 86400,
  })
);

// 5. Body limits — 50kb max to prevent large payload attacks
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));

// 6. MongoDB injection prevention
app.use(mongoSanitize({ replaceWith: "_", allowDots: false }));

// 7. XSS sanitization
app.use(sanitizeInput);

// 8. HTTP parameter pollution
app.use(hpp({ whitelist: ["sort", "fields", "page", "limit", "status"] }));

// 9. Request ID for log correlation
app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader("X-Request-ID", req.requestId);
  next();
});

// 10. HTTP logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(
    morgan("combined", {
      skip: (req) => req.url === "/health",
      stream: { write: (msg) => requestLogger.info(msg.trim()) },
    })
  );
}

// 11. Global rate limit
// FIX: previously app.use(globalLimiter) with no path, mounted BEFORE the
// static SPA serving further down. That meant every JS/CSS/font/image chunk
// for all four frontends counted against the same 200-per-15min budget as
// real API calls — a single admin dashboard load (40+ chunked JS files) could
// eat a large chunk of a user's entire limit before they made one API request.
// Scoping this to "/api/v1" means static assets are never touched by it.
app.use("/api/v1", globalLimiter);

// 12. Health check — actually pings MongoDB and Redis instead of returning static "healthy"
app.get("/health", async (req, res) => {
  const checks = { mongo: false, redis: false };

  try {
    await mongoose.connection.db.admin().ping();
    checks.mongo = true;
  } catch {}

  try {
    await getRedis().ping();
    checks.redis = true;
  } catch {}

  const healthy = checks.mongo && checks.redis;
  res.status(healthy ? 200 : 503).json({
    success: healthy,
    status: healthy ? "healthy" : "degraded",
    checks,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// 13. Per-route rate limiters
// otpPhoneLimiter added alongside the existing IP-based otpLimiter so an
// attacker rotating IPs (trivial on mobile data) can't OTP-bomb one victim's
// phone number indefinitely.
app.use("/api/v1/auth/register/send-otp", otpLimiter, otpPhoneLimiter);
app.use("/api/v1/auth/forgot-password/send-otp", otpLimiter, otpPhoneLimiter);
app.use("/api/v1/auth/change-password/send-otp", otpLimiter, otpPhoneLimiter);
app.use("/api/v1/auth", authLimiter);
app.use("/api/v1/admin", adminLimiter);
app.use("/api/v1/payments", paymentLimiter);

// 14. All routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/menu", menuRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/uploads", uploadRoutes);
app.use("/api/v1/reviews", reviewRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/special-sessions", specialSessionRoutes);
app.use("/api/v1/meal-plans", mealPlanRoutes);
app.use("/api/v1/celebration-packages", celebrationPackageRoutes);
app.use("/api/v1/subscriptions", subscriptionRoutes);
app.use("/api/v1/addresses", addressRoutes);
app.use("/api/v1/settings", require("./routes/settings.routes")); // <--- NEW route added here
app.use("/api/v1/announcements", announcementRoutes);
app.use("/api/v1/jobs", jobRoutes);
app.use("/api/v1/coupons", couponRoutes);
// ── 15. Serve frontend builds (production single-server deployment) ──────────
const path = require("path");

const frontendRoot = path.join(__dirname, "..", "Frontend");

// Admin — /admin, /admin/, /admin/*
app.use("/admin", express.static(path.join(frontendRoot, "admin", "dist")));
app.get(/^\/admin(\/.*)?$/, (req, res) => {
  res.sendFile(path.join(frontendRoot, "admin", "dist", "index.html"));
});

// Kitchen — /kitchen, /kitchen/, /kitchen/*
app.use("/kitchen", express.static(path.join(frontendRoot, "kitchen", "dist")));
app.get(/^\/kitchen(\/.*)?$/, (req, res) => {
  res.sendFile(path.join(frontendRoot, "kitchen", "dist", "index.html"));
});

// Rider — /rider, /rider/, /rider/*
app.use("/rider", express.static(path.join(frontendRoot, "rider", "dist")));
app.get(/^\/rider(\/.*)?$/, (req, res) => {
  res.sendFile(path.join(frontendRoot, "rider", "dist", "index.html"));
});

// Customer — / (root, must be LAST so it doesn't swallow /admin, /kitchen, /rider)
app.use(express.static(path.join(frontendRoot, "customer", "dist")));

// SPA fallback: any non-API route that didn't match a static file → customer index.html
app.get("*", (req, res, next) => {
  // Don't intercept API routes or app sub-routes
  if (req.originalUrl.startsWith("/api/")) return next();
  if (req.originalUrl.startsWith("/admin")) return res.sendFile(path.join(frontendRoot, "admin", "dist", "index.html"));
  if (req.originalUrl.startsWith("/kitchen")) return res.sendFile(path.join(frontendRoot, "kitchen", "dist", "index.html"));
  if (req.originalUrl.startsWith("/rider")) return res.sendFile(path.join(frontendRoot, "rider", "dist", "index.html"));

  res.sendFile(path.join(frontendRoot, "customer", "dist", "index.html"));
});

// 16. API 404
app.use("/api/*", (req, res) => {
  securityLogger.debug(`404: ${req.method} ${req.originalUrl} from ${req.ip}`);
  res.status(404).json({ success: false, message: "Not found." });
});

// 17. Global error handler
app.use(errorHandler);

module.exports = app;