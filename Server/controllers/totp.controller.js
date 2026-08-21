/**
 * controllers/totp.controller.js
 *
 * Admin Two-Factor Authentication via TOTP (Google Authenticator / Authy).
 * Why TOTP and not SMS?
 *   SMS is susceptible to SIM-swap attacks. Admins have total system control,
 *   so they need a stronger 2FA mechanism.
 *
 * Flow:
 *   POST /api/v1/auth/totp/setup    → generate secret + QR code URL
 *   POST /api/v1/auth/totp/verify   → confirm TOTP works, mark totpEnabled=true
 *   POST /api/v1/auth/totp/disable  → remove TOTP (requires current password)
 *   POST /api/v1/auth/totp/confirm  → used during login to complete 2FA challenge
 *
 * NOTE: otplib v13 is a complete rewrite. The old `authenticator` object
 * (authenticator.generateSecret(), authenticator.verify(), .options, .keyuri)
 * was removed. v13 uses flat, async-first functions instead:
 *   generateSecret(), generate({ secret }), verify({ secret, token }),
 *   generateURI({ issuer, label, secret })
 * All otplib calls below are awaited and verify() now returns
 * { valid: boolean } instead of a plain boolean.
 */

const { generateSecret, verify, generateURI } = require("otplib");
const qrcode = require("qrcode");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess } = require("../utils/response");
const { sendTokens, verifyTotpChallengeToken } = require("../utils/tokenUtils");
const { securityLogger } = require("../utils/logger");

// 30-second drift tolerance — passed per-call in v13 (no global .options anymore)
const VERIFY_WINDOW = 1;

// ─── Setup: generate TOTP secret + QR code ───────────────────────────────────
// POST /api/v1/auth/totp/setup
exports.setupTotp = catchAsync(async (req, res) => {
  if (req.user.role !== "admin")
    throw new AppError("TOTP is required only for admin accounts.", 403);

  const user = await User.findById(req.user._id).select("+totpSecret +totpEnabled");
  if (user.totpEnabled)
    throw new AppError("TOTP is already enabled. Disable it first to re-setup.", 400);

  const secret = generateSecret();
  user.totpSecret = secret;
  user.totpEnabled = false; // not active until verified
  await user.save({ validateBeforeSave: false });

  const otpauth = generateURI({
    issuer: "GharkoSwad Admin",
    label: user.phone,
    secret,
  });
  const qrDataUrl = await qrcode.toDataURL(otpauth);

  sendSuccess(res, {
    secret,          // display to admin for manual entry in authenticator app
    qrDataUrl,       // base64 PNG — render as <img src="..." />
  }, "Scan the QR code with Google Authenticator or Authy, then call /totp/verify.");
});

// ─── Verify: confirm TOTP code to activate ───────────────────────────────────
// POST /api/v1/auth/totp/verify
// Body: { token }
exports.verifyAndEnableTotp = catchAsync(async (req, res) => {
  const { token } = req.body;
  if (!token || !/^\d{6}$/.test(token))
    throw new AppError("A 6-digit TOTP token is required.", 400);

  const user = await User.findById(req.user._id).select("+totpSecret +totpEnabled");
  if (!user.totpSecret) throw new AppError("Run /totp/setup first.", 400);
  if (user.totpEnabled) throw new AppError("TOTP is already active.", 400);

  const result = await verify({ token, secret: user.totpSecret, window: VERIFY_WINDOW });
  if (!result.valid) throw new AppError("Invalid TOTP code. Check your authenticator app.", 400);

  user.totpEnabled = true;
  await user.save({ validateBeforeSave: false });

  securityLogger.info(`TOTP enabled for admin ${user._id}`);
  sendSuccess(res, {}, "TOTP 2FA is now active on your admin account.");
});

// ─── Disable: remove TOTP (requires current password) ────────────────────────
// POST /api/v1/auth/totp/disable
// Body: { password }
exports.disableTotp = catchAsync(async (req, res) => {
  const { password } = req.body;
  if (!password) throw new AppError("Password is required to disable 2FA.", 400);

  const user = await User.findById(req.user._id).select("+password +totpSecret +totpEnabled");
  const valid = await user.comparePassword(password);
  if (!valid) throw new AppError("Incorrect password.", 401);

  user.totpSecret  = undefined;
  user.totpEnabled = false;
  await user.save({ validateBeforeSave: false });

  securityLogger.warn(`TOTP disabled for admin ${user._id} from IP ${req.ip}`);
  sendSuccess(res, {}, "TOTP 2FA has been disabled.");
});

// ─── Login challenge: verify TOTP during 2FA login flow ──────────────────────
// POST /api/v1/auth/totp/confirm
// Body: { userId, token }
// Called after phase-1 login (phone+password) succeeds but before tokens are issued.
// In production, phase-1 would return a short-lived "pending2FA" JWT instead of full tokens.
exports.confirmTotpLogin = catchAsync(async (req, res) => {
  const { userId, token, totpChallengeToken } = req.body;
  if (!userId || !token) throw new AppError("userId and token are required.", 400);

  const challenge = verifyTotpChallengeToken(totpChallengeToken, userId);
  if (!challenge.valid) {
    securityLogger.warn(`Invalid TOTP challenge for user ${userId} from IP ${req.ip}`);
    throw new AppError("Login session expired. Please sign in again.", 401);
  }

  const user = await User.findById(userId).select("+totpSecret +totpEnabled +tokenVersion +refreshTokens");
  if (!user || !user.isActive) throw new AppError("Account not found.", 401);
  if (!user.totpEnabled) throw new AppError("This account does not have TOTP enabled.", 400);

  const result = await verify({ token, secret: user.totpSecret, window: VERIFY_WINDOW });
  if (!result.valid) {
    securityLogger.warn(`Failed TOTP login for admin ${userId} from IP ${req.ip}`);
    throw new AppError("Invalid TOTP code.", 401);
  }

  user.lastLogin = new Date();
  user.lastLoginIp = req.ip;
  user.pushLoginHistory(req.ip, req.headers["user-agent"]);
  await user.save({ validateBeforeSave: false });

  securityLogger.info(`Successful TOTP login for admin ${user._id} from IP ${req.ip}`);
  await sendTokens(user, 200, res, req.headers["user-agent"]);
});