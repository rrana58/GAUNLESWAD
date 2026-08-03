const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { securityLogger } = require("../utils/logger");

// ─── Extract Bearer token ─────────────────────────────────────────────────────
const extractToken = (req) => {
  if (req.headers.authorization?.startsWith("Bearer ")) {
    return req.headers.authorization.split(" ")[1];
  }
  return null;
};

// ─── Protect — verify JWT, attach user ───────────────────────────────────────
const protect = catchAsync(async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    throw new AppError("Authentication required.", 401);
  }

  // Token length sanity check — prevents huge payload attacks
  if (token.length > 2048) {
    securityLogger.warn(`Oversized token from IP ${req.ip}`);
    throw new AppError("Invalid token.", 401);
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],          // Explicitly lock algorithm — prevents alg:none attack
      issuer: "gharko-swad",
      audience: "gharko-swad-client",
    });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw new AppError("Session expired. Please log in again.", 401);
    }
    securityLogger.warn(`Invalid JWT from IP ${req.ip}: ${err.message}`);
    throw new AppError("Invalid token.", 401);
  }

  // Verify required claims exist
  if (!decoded.id || !decoded.role) {
    securityLogger.warn(`Malformed JWT claims from IP ${req.ip}`);
    throw new AppError("Invalid token.", 401);
  }

  const user = await User.findById(decoded.id).select("+tokenVersion");
  if (!user) throw new AppError("Account not found.", 401);
  if (!user.isActive) throw new AppError("Account deactivated. Contact support.", 401);

  // Token version check — invalidates all tokens on password change / logout-all
  if (user.tokenVersion !== undefined && decoded.tv !== user.tokenVersion) {
    securityLogger.warn(`Stale token used by user ${user._id} from IP ${req.ip}`);
    throw new AppError("Session invalidated. Please log in again.", 401);
  }

  // Attach to request
  req.user = user;
  req.token = token;
  next();
});

// ─── Role-based access control ────────────────────────────────────────────────
const restrictTo = (...roles) => (req, res, next) => {
  if (!req.user) return next(new AppError("Authentication required.", 401));
  if (!roles.includes(req.user.role)) {
    securityLogger.warn(
      `Unauthorized role access: user ${req.user._id} (${req.user.role}) tried ${req.originalUrl}`
    );
    return next(new AppError("You do not have permission to perform this action.", 403));
  }
  next();
};

// ─── Optional auth — attaches user if token valid, silent otherwise ───────────
const optionalAuth = catchAsync(async (req, res, next) => {
  const token = extractToken(req);
  if (!token || token.length > 2048) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "gharko-swad",
      audience: "gharko-swad-client",
    });
    const user = await User.findById(decoded.id).select("+tokenVersion");
    if (user && user.isActive && decoded.tv === user.tokenVersion) {
      req.user = user;
    }
  } catch {
    // Silent — optional auth never blocks the request
  }
  next();
});

// ─── Ownership check — user can only access their own resources ───────────────
const requireOwnership = (getResourceUserId) => catchAsync(async (req, res, next) => {
  const resourceUserId = await getResourceUserId(req);
  if (!resourceUserId) return next(new AppError("Resource not found.", 404));

  // Admins bypass ownership check
  if (req.user.role === "admin") return next();

  if (resourceUserId.toString() !== req.user._id.toString()) {
    securityLogger.warn(
      `Ownership violation: user ${req.user._id} tried to access resource owned by ${resourceUserId}`
    );
    throw new AppError("Access denied.", 403);
  }
  next();
});

module.exports = { protect, restrictTo, optionalAuth, requireOwnership };
