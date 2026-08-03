const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");
const { RedisStore } = require("rate-limit-redis");
const { getRedis } = require("../config/redis");
const { securityLogger } = require("../utils/logger");

// ─── Redis store factory ──────────────────────────────────────────────────────
// Persists rate limit counters in Redis so they survive restarts
// and work correctly across multiple server instances.
//
// FIX: the old version wrapped `new RedisStore(...)` in try/catch expecting it
// to fall back to memory when Redis was down. It never did — ioredis connects
// asynchronously, so the constructor never throws. When Redis actually hiccups,
// sendCommand() rejects mid-request, express-rate-limit calls next(err), and the
// request 500s instead of degrading gracefully. Two changes fix this:
//   1. Only hand out a RedisStore if the client is currently "ready".
//   2. Every limiter is wrapped in failOpen() below, so if the store errors out
//      later (Redis drops mid-flight), we let the request through instead of
//      breaking the app for every user. Rate limiting is a defense layer —
//      it should never be the reason real customers can't order food.
const makeRedisStore = (prefix) => {
  const redis = getRedis();
  if (!redis || redis.status !== "ready") {
    securityLogger.warn(`Rate limiter using memory store for ${prefix} — Redis not ready (status: ${redis?.status})`);
    return undefined; // undefined = express-rate-limit uses in-memory store
  }
  return new RedisStore({
    sendCommand: (...args) => getRedis().call(...args),
    prefix: `rl:${prefix}:`,
  });
};

const onLimitReached = (req) => {
  securityLogger.warn(`Rate limit hit: ${req.ip} → ${req.method} ${req.originalUrl}`);
};

// Wrap a limiter so a store-level error (e.g. Redis connection drop mid-request)
// fails OPEN — the request proceeds — instead of 500ing every request until
// Redis recovers. Losing rate-limit precision for a few seconds is a much
// smaller problem than an outage.
const failOpen = (limiter) => (req, res, next) => {
  limiter(req, res, (err) => {
    if (err) {
      securityLogger.error(`Rate limiter store error, failing open: ${err.message}`);
      return next();
    }
    next();
  });
};

// Key by authenticated user when we have one, otherwise IP. This matters a lot
// for CGNAT-heavy networks (very common on NTC/Ncell in Nepal) where many real,
// unrelated users share one public IP — without this they rate-limit each other.
// Falls back to IP whenever the request is unauthenticated (most limiters below
// run before route-level auth middleware, so this mostly helps admin/global
// traffic where req.user may already be attached upstream).
const smartKey = (req) => (req.user?.id ? `u:${req.user.id}` : req.ip);

// ─── 1. Global — API routes only ──────────────────────────────────────────────
// FIX: previously mounted with app.use(globalLimiter) ahead of the static SPA
// file serving, so every JS/CSS/font chunk (40+ files just for the admin build)
// counted against the same budget as API calls. Mount this on "/api/v1" only
// (see app.js) so static assets never touch it.
// 600 requests / 5 min per key — generous enough for real usage (menu browsing,
// cart, order polling, notifications) without being a meaningful ceiling for
// legitimate traffic, while still catching sustained abuse.
const globalLimiter = failOpen(
  rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: smartKey,
    store: makeRedisStore("global"),
    handler: (req, res) => {
      onLimitReached(req);
      res.status(429).json({ success: false, message: "Too many requests. Please slow down." });
    },
  })
);

// ─── 2. Auth routes — login / verify ─────────────────────────────────────────
// 20 attempts per 15 minutes per IP
const authLimiter = failOpen(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // only failed attempts count
    store: makeRedisStore("auth"),
    handler: (req, res) => {
      onLimitReached(req);
      res.status(429).json({ success: false, message: "Too many login attempts. Try again in 15 minutes." });
    },
  })
);

// ─── 3. OTP send — strictest ──────────────────────────────────────────────────
// Only 5 OTP sends per 15 minutes per IP — prevents SMS bombing from one source.
const otpLimiter = failOpen(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    store: makeRedisStore("otp"),
    handler: (req, res) => {
      onLimitReached(req);
      securityLogger.warn(`OTP abuse attempt from ${req.ip} for ${req.body?.phone}`);
      res.status(429).json({ success: false, message: "Too many OTP requests. Wait 15 minutes before trying again." });
    },
  })
);

// NEW: the IP-based limiter above doesn't stop an attacker who rotates IPs (or
// sits behind mobile data, which reassigns IPs often) from OTP-bombing a single
// victim's phone number. This closes that gap by also capping sends per number,
// independent of who's asking.
const otpPhoneLimiter = failOpen(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: false,
    legacyHeaders: false,
    keyGenerator: (req) => `phone:${req.body?.phone || "unknown"}`,
    store: makeRedisStore("otp-phone"),
    handler: (req, res) => {
      securityLogger.warn(`OTP abuse attempt targeting phone ${req.body?.phone} from ${req.ip}`);
      res.status(429).json({ success: false, message: "Too many OTP requests for this number. Wait 15 minutes before trying again." });
    },
  })
);

// ─── 4. Admin routes ──────────────────────────────────────────────────────────
// Keyed by user, not IP — admin staff are often behind one office/router IP,
// and an IP-only limit means one busy admin can lock out the rest of the team.
const adminLimiter = failOpen(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: smartKey,
    store: makeRedisStore("admin"),
    handler: (req, res) => {
      onLimitReached(req);
      res.status(429).json({ success: false, message: "Too many admin requests." });
    },
  })
);

// ─── 5. Payment routes ────────────────────────────────────────────────────────
// 10 payment initiations per 10 minutes per IP
const paymentLimiter = failOpen(
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    store: makeRedisStore("payment"),
    handler: (req, res) => {
      onLimitReached(req);
      res.status(429).json({ success: false, message: "Too many payment attempts. Please wait before trying again." });
    },
  })
);

// ─── 6. Slow down brute-force on auth ────────────────────────────────────────
// After 5 failures: add 500ms delay per request up to 20s max
const authSlowDown = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 5,
  delayMs: () => 500,
  maxDelayMs: 20000,
});

// ─── 7. Job applications — public form, no auth required ─────────────────────
// 5 applications per hour per IP — enough for a genuine job-seeker, not for spam
const jobApplyLimiter = failOpen(
  rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    store: makeRedisStore("job-apply"),
    handler: (req, res) => {
      onLimitReached(req);
      res.status(429).json({ success: false, message: "Too many applications submitted. Please try again later." });
    },
  })
);

module.exports = {
  globalLimiter,
  authLimiter,
  otpLimiter,
  otpPhoneLimiter,
  adminLimiter,
  paymentLimiter,
  authSlowDown,
  jobApplyLimiter,
};