const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const zxcvbn = require("zxcvbn");
const User = require("../models/User");
const Order = require("../models/Order");
const Review = require("../models/Review");
const Notification = require("../models/Notification");
const Subscription = require("../models/Subscription");
const { sendOTP } = require("../services/sms.service");
const {
  sendTokens,
  signAccessToken,
  signRefreshToken,
  hashRefreshToken,
  buildTokenPayload,
  signTotpChallengeToken,
} = require("../utils/tokenUtils");
const { sendSuccess } = require("../utils/response");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { logger, securityLogger } = require("../utils/logger");

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function generateAndSendOTP(user, context) {
  // Throttle: block re-send if OTP sent less than 60 seconds ago
  if (user.otpExpiry) {
    const otpAge = Date.now() - (user.otpExpiry.getTime() - 10 * 60 * 1000);
    if (otpAge < 60 * 1000) {
      throw new AppError("Please wait 60 seconds before requesting a new OTP.", 429);
    }
  }

  const otp = user.generateOTP();
  await user.save({ validateBeforeSave: false });

  if (process.env.NODE_ENV === "development") {
    logger.info(`[DEV OTP] ${user.phone} (${context}): ${otp}`);
  } else {
    const result = await sendOTP(user.phone, otp);
    if (!result.success) throw new AppError("Failed to send OTP. Please try again.", 503);
  }

  return otp;
}

// ─── STEP 1 — Send registration OTP ──────────────────────────────────────────
// POST /api/v1/auth/register/send-otp
// Body: { phone }
exports.sendRegistrationOtp = catchAsync(async (req, res) => {
  const { phone } = req.body;

  // Block if already registered
  const existing = await User.findOne({ phone });
  if (existing) {
    throw new AppError(
      "This phone number is already registered. Please log in instead.",
      409
    );
  }

  // Store OTP on a temporary unverified user doc (or in memory via temp record)
  // We use a "pendingVerification" flag so the account isn't active until OTP verified
  let pending = await User.findOne({ phone, isPhoneVerified: false }).select(
    "+otp +otpExpiry +otpAttempts +otpLockedUntil"
  );

  if (pending?.otpLockedUntil && Date.now() < pending.otpLockedUntil.getTime()) {
    const waitMins = Math.ceil((pending.otpLockedUntil - Date.now()) / 60000);
    throw new AppError(`Too many attempts. Please wait ${waitMins} minutes.`, 429);
  }

  if (!pending) {
    // Create a temporary unverified placeholder
    pending = await User.create({
      phone,
      name: "pending",
      isPhoneVerified: false,
      isActive: false, // NOT active until OTP verified
    });
  }

  await generateAndSendOTP(pending, "registration");
  sendSuccess(res, {}, "OTP sent. Enter the code to continue registration.");
});

// ─── STEP 2 — Verify OTP + complete registration ─────────────────────────────
// POST /api/v1/auth/register/verify
// Body: { phone, otp, name, password, referralCode }
exports.verifyAndRegister = catchAsync(async (req, res) => {
  const { phone, otp, name, password, referralCode } = req.body;

  const user = await User.findOne({ phone, isPhoneVerified: false }).select(
    "+otp +otpExpiry +otpAttempts +otpLockedUntil +tokenVersion +refreshTokens"
  );

  if (!user) {
    throw new AppError(
      "No pending registration found for this number. Please request an OTP first.",
      400
    );
  }

  if (user.otpLockedUntil && Date.now() < user.otpLockedUntil.getTime()) {
    throw new AppError("Account temporarily locked. Try again in 15 minutes.", 429);
  }

  const result = user.verifyOTP(otp);
  await user.save({ validateBeforeSave: false });

  if (result.locked) throw new AppError("Too many wrong attempts. Wait 15 minutes.", 429);
  if (result.expired) throw new AppError("OTP has expired. Please request a new one.", 400);
  if (!result.valid) {
    const left = result.attemptsLeft;
    throw new AppError(
      `Wrong OTP. ${left !== undefined ? `${left} attempt${left !== 1 ? "s" : ""} remaining.` : ""}`,
      400
    );
  }

  // OTP valid — complete registration
  // ── Password strength check (zxcvbn score 0–4, require ≥ 2) ────────────
  const strength = zxcvbn(password, [name, phone]);
  if (strength.score < 2) {
    const warning = strength.feedback.warning || "Password is too weak";
    const suggestions = strength.feedback.suggestions.join(" ") || "";
    throw new AppError(`${warning}. ${suggestions}`.trim(), 400);
  }

  // Handle Referrer
  let referredBy = null;
  if (referralCode) {
    const referrer = await User.findOne({ referralCode: referralCode.trim().toUpperCase(), isActive: true });
    if (referrer) {
      referredBy = referrer._id;
    }
  }

  // Generate unique referral code for the new user
  const generateCode = () => {
    const prefix = name.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
    const suffix = Math.floor(10000 + Math.random() * 90000);
    return `${prefix}${suffix}`;
  };
  
  let myReferralCode = generateCode();
  while (await User.findOne({ referralCode: myReferralCode })) {
    myReferralCode = generateCode();
  }

  user.name = name.trim();
  user.password = password; // hashed by pre-save hook
  user.isPhoneVerified = true;
  user.isActive = true;
  user.referralCode = myReferralCode;
  user.referredBy = referredBy;
  user.otp = undefined;
  user.otpExpiry = undefined;
  user.otpAttempts = 0;
  user.otpLockedUntil = undefined;
  user.lastLogin = new Date();
  user.lastLoginIp = req.ip;
  user.pushLoginHistory(req.ip, req.headers["user-agent"]);

  await user.save();

  securityLogger.info(`New registration: ${user._id} from IP ${req.ip}`);
  await sendTokens(user, 201, res, req.headers["user-agent"]);
});

// ─── LOGIN — phone + password (no OTP) ───────────────────────────────────────
// POST /api/v1/auth/login
// Body: { phone, password }
exports.login = catchAsync(async (req, res) => {
  const { phone, email, password } = req.body;

  if (!phone && !email) {
    throw new AppError("Phone or email is required", 400);
  }

  const query = {};
  if (email) query.email = email;
  else if (phone) query.phone = phone;

  const user = await User.findOne(query).select(
    "+password +tokenVersion +refreshTokens +totpEnabled"
  );

  // Always run bcrypt even if user not found — prevents timing-based enumeration
  const dummyHash = "$2a$12$dummyhashtopreventtimingattacksXXXXXXXXXXXXXXXXXX";
  const passwordValid = user
    ? await user.comparePassword(password)
    : await bcrypt.compare(password, dummyHash);

  if (!user || !passwordValid) {
    if (user) securityLogger.warn(`Failed login for ${phone || email} from IP ${req.ip}`);
    throw new AppError("Incorrect credentials.", 401);
  }

  if (!user.isActive) {
    throw new AppError("Your account has been deactivated. Please contact support.", 401);
  }

  // Only customers need phone verification to login
  if (user.role === 'customer' && !user.isPhoneVerified) {
    throw new AppError("Please verify your phone number first.", 401);
  }

  // TOTP enabled — password OK but do not issue session tokens yet
  if (user.totpEnabled) {
    securityLogger.info(`TOTP challenge issued for user ${user._id} from IP ${req.ip}`);
    return res.status(200).json({
      success: true,
      totpRequired: true,
      userId: user._id.toString(),
      totpChallengeToken: signTotpChallengeToken(user._id),
    });
  }

  user.lastLogin = new Date();
  user.lastLoginIp = req.ip;
  user.pushLoginHistory(req.ip, req.headers["user-agent"]);
  await user.save({ validateBeforeSave: false });

  securityLogger.info(`Login: ${user._id} from IP ${req.ip}`);
  await sendTokens(user, 200, res, req.headers["user-agent"]);
});

// ─── FORGOT PASSWORD — Step 1: send OTP ──────────────────────────────────────
// POST /api/v1/auth/forgot-password/send-otp
// Body: { phone }
exports.sendForgotPasswordOtp = catchAsync(async (req, res) => {
  const { phone } = req.body;

  const user = await User.findOne({ phone, isPhoneVerified: true }).select(
    "+otp +otpExpiry +otpAttempts +otpLockedUntil"
  );

  // Always return success — never reveal whether phone is registered (security)
  if (!user) {
    return sendSuccess(res, {}, "If this number is registered, an OTP has been sent.");
  }

  if (user.otpLockedUntil && Date.now() < user.otpLockedUntil.getTime()) {
    const waitMins = Math.ceil((user.otpLockedUntil - Date.now()) / 60000);
    throw new AppError(`Too many attempts. Please wait ${waitMins} minutes.`, 429);
  }

  await generateAndSendOTP(user, "forgot-password");
  sendSuccess(res, {}, "If this number is registered, an OTP has been sent.");
});

// ─── FORGOT PASSWORD — Step 2: verify OTP + set new password ─────────────────
// POST /api/v1/auth/forgot-password/reset
// Body: { phone, otp, newPassword }
exports.resetPasswordWithOtp = catchAsync(async (req, res) => {
  const { phone, otp, newPassword } = req.body;

  const user = await User.findOne({ phone, isPhoneVerified: true }).select(
    "+otp +otpExpiry +otpAttempts +otpLockedUntil +password +tokenVersion +refreshTokens"
  );

  if (!user) throw new AppError("Invalid request.", 400);

  if (user.otpLockedUntil && Date.now() < user.otpLockedUntil.getTime()) {
    throw new AppError("Account temporarily locked. Try again in 15 minutes.", 429);
  }

  const result = user.verifyOTP(otp);
  await user.save({ validateBeforeSave: false });

  if (result.locked) throw new AppError("Too many wrong attempts. Wait 15 minutes.", 429);
  if (result.expired) throw new AppError("OTP expired. Request a new one.", 400);
  if (!result.valid) {
    const left = result.attemptsLeft;
    throw new AppError(
      `Wrong OTP. ${left !== undefined ? `${left} attempt${left !== 1 ? "s" : ""} remaining.` : ""}`,
      400
    );
  }

  // Prevent reusing the same password
  const isSamePassword = await user.comparePassword(newPassword);
  if (isSamePassword) {
    throw new AppError("New password must be different from your current password.", 400);
  }

  // Set new password — pre-save hook hashes it and increments tokenVersion
  user.password = newPassword;
  user.otp = undefined;
  user.otpExpiry = undefined;
  user.otpAttempts = 0;
  user.otpLockedUntil = undefined;
  // Invalidate all existing sessions (force re-login everywhere)
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  user.refreshTokens = [];

  await user.save();

  securityLogger.info(`Password reset via OTP: ${user._id} from IP ${req.ip}`);
  sendSuccess(res, {}, "Password reset successfully. Please log in with your new password.");
});

// ─── CHANGE PASSWORD — Step 1: send OTP to logged-in user's phone ────────────
// POST /api/v1/auth/change-password/send-otp
// Requires: Authorization header (no body needed)
exports.sendChangePasswordOtp = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select(
    "+otp +otpExpiry +otpAttempts +otpLockedUntil"
  );

  if (!user) throw new AppError("Account not found.", 404);

  if (user.otpLockedUntil && Date.now() < user.otpLockedUntil.getTime()) {
    const waitMins = Math.ceil((user.otpLockedUntil - Date.now()) / 60000);
    throw new AppError(`Too many attempts. Please wait ${waitMins} minutes.`, 429);
  }

  await generateAndSendOTP(user, "change-password");
  sendSuccess(res, {}, "OTP sent to your registered phone number.");
});

// ─── CHANGE PASSWORD — Step 2: verify OTP + current password + set new ───────
// POST /api/v1/auth/change-password
// Body: { currentPassword, otp, newPassword }
// Requires: Authorization header
exports.changePassword = catchAsync(async (req, res) => {
  const { currentPassword, otp, newPassword } = req.body;

  const user = await User.findById(req.user._id).select(
    "+password +tokenVersion +refreshTokens +otp +otpExpiry +otpAttempts +otpLockedUntil"
  );

  if (!user) throw new AppError("Account not found.", 404);

  // ── 1. Check OTP lock ────────────────────────────────────────────────────
  if (user.otpLockedUntil && Date.now() < user.otpLockedUntil.getTime()) {
    throw new AppError("Account temporarily locked. Try again in 15 minutes.", 429);
  }

  // ── 2. Verify current password first (prevents OTP oracle attack) ────────
  const isCorrect = await user.comparePassword(currentPassword);
  if (!isCorrect) {
    securityLogger.warn(`Wrong current password on change-password: ${user._id} from IP ${req.ip}`);
    throw new AppError("Current password is incorrect.", 401);
  }

  // ── 3. Verify OTP ────────────────────────────────────────────────────────
  const result = user.verifyOTP(otp);
  await user.save({ validateBeforeSave: false });

  if (result.locked) throw new AppError("Too many wrong OTP attempts. Wait 15 minutes.", 429);
  if (result.expired) throw new AppError("OTP has expired. Please request a new one.", 400);
  if (!result.valid) {
    const left = result.attemptsLeft;
    throw new AppError(
      `Wrong OTP. ${left !== undefined ? `${left} attempt${left !== 1 ? "s" : ""} remaining.` : ""}`,
      400
    );
  }

  // ── 4. Prevent reusing the same password ────────────────────────────────
  if (currentPassword === newPassword) {
    throw new AppError("New password must be different from your current password.", 400);
  }

  // ── 5. Set new password — pre-save hook hashes it + bumps tokenVersion ──
  user.password = newPassword;
  user.otp = undefined;
  user.otpExpiry = undefined;
  user.otpAttempts = 0;
  user.otpLockedUntil = undefined;
  // Invalidate ALL sessions — force re-login on every device
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  user.refreshTokens = [];
  await user.save();

  securityLogger.info(`Password changed with OTP: ${user._id} from IP ${req.ip}`);
  sendSuccess(res, {}, "Password changed successfully. Please log in again.");
});

// ─── REFRESH TOKEN (with rotation) ───────────────────────────────────────────
// POST /api/v1/auth/refresh
// Body: { refreshToken }
// Issues a NEW access token + NEW refresh token on every call (rotation).
// The old refresh token is immediately invalidated.
exports.refreshToken = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new AppError("Refresh token required.", 400);
  if (refreshToken.length > 1024) throw new AppError("Invalid token.", 400);

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, {
      algorithms: ["HS256"],
      issuer: "gharko-swad",
      audience: "gharko-swad-client",
    });
  } catch {
    throw new AppError("Invalid or expired session. Please log in again.", 401);
  }

  const presentedHash = hashRefreshToken(refreshToken);
  const newRefreshToken = signRefreshToken(decoded.id);
  const newHash = hashRefreshToken(newRefreshToken);
  const userAgent = (req.headers["user-agent"] || "").slice(0, 200);

  const loginEntry = {
    ip: req.ip,
    userAgent,
    at: new Date(),
  };

  // Atomic rotation — matches if presentedHash exists ANYWHERE in the
  // sessions array (not just as the single most-recent one), so refreshing
  // from device B doesn't invalidate device A's still-valid session. Pulls
  // out just the matched entry and pushes the newly rotated one in its
  // place, leaving every other concurrent session untouched.
  const user = await User.findOneAndUpdate(
    { _id: decoded.id, "refreshTokens.hash": presentedHash, isActive: true },
    {
      $pull: { refreshTokens: { hash: presentedHash } },
      $push: {
        loginHistory: { $each: [loginEntry], $slice: -10 },
      },
    },
    { new: true }
  );

  if (!user) {
    const existing = await User.findById(decoded.id).select("+refreshTokens +tokenVersion");
    if (!existing || !existing.isActive) throw new AppError("Account not found.", 401);

    // Concurrent loser or replay of a rotated token — reject only; do not bump
    // tokenVersion or clear other sessions (that caused cascade logouts).
    securityLogger.warn(`Refresh token rejected (stale): ${existing._id} from IP ${req.ip}`);
    throw new AppError("Invalid or expired session. Please log in again.", 401);
  }

  // Push the freshly rotated session back in as a second update — kept
  // separate from the $pull above since Mongo doesn't allow $pull and
  // $push on the same array path in one update call.
  user.refreshTokens.push({ hash: newHash, userAgent });
  if (user.refreshTokens.length > 5) user.refreshTokens = user.refreshTokens.slice(-5);
  await user.save({ validateBeforeSave: false });

  const accessToken = signAccessToken(user._id, user.role, user.tokenVersion);
  res.status(200).json(buildTokenPayload(user, accessToken, newRefreshToken));
});

// ─── GET ME ───────────────────────────────────────────────────────────────────
exports.getMe = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user && !user.referralCode) {
    const generateCode = () => {
      const prefix = user.name ? user.name.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X') : 'USR';
      const suffix = Math.floor(10000 + Math.random() * 90000);
      return `${prefix}${suffix}`;
    };

    let myReferralCode = generateCode();
    while (await User.findOne({ referralCode: myReferralCode })) {
      myReferralCode = generateCode();
    }

    user.referralCode = myReferralCode;
    await user.save({ validateBeforeSave: false });
  }

  sendSuccess(res, { user });
});

// ─── LOGIN HISTORY ────────────────────────────────────────────────────────────
exports.getLoginHistory = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select("+loginHistory");
  const history = [...(user.loginHistory || [])].reverse(); // most recent first
  sendSuccess(res, { loginHistory: history });
});

// ─── UPDATE PROFILE ───────────────────────────────────────────────────────────
exports.updateProfile = catchAsync(async (req, res) => {
  const { name, email } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { name, email },
    { new: true, runValidators: true }
  );
  sendSuccess(res, { user }, "Profile updated");
});

// ─── FCM TOKEN ────────────────────────────────────────────────────────────────
exports.updateFcmToken = catchAsync(async (req, res) => {
  const { fcmToken } = req.body;
  if (!fcmToken || typeof fcmToken !== "string" || fcmToken.length > 500) {
    throw new AppError("Invalid FCM token.", 400);
  }

  // Remove this token from ANY other user who may have registered it previously
  // (handles User A → User B device hand-off — prevents User A receiving User B's alerts).
  await User.updateMany(
    { _id: { $ne: req.user._id }, fcmTokens: fcmToken },
    { $pull: { fcmTokens: fcmToken } }
  );

  // Add to current user (no-op if already present), then cap at 5 most-recent tokens.
  await User.findByIdAndUpdate(req.user._id, { $addToSet: { fcmTokens: fcmToken } });
  await User.findByIdAndUpdate(req.user._id, {
    $push: { fcmTokens: { $each: [], $slice: -5 } },
  });
  sendSuccess(res, {}, "Device registered for notifications");
});

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
// Removes only THIS device's session, so other concurrent sessions (e.g. a
// rider's other phone/tablet) stay logged in. Falls back to clearing every
// session if the client doesn't send its refreshToken (older app builds).
exports.logout = catchAsync(async (req, res) => {
  const { refreshToken } = req.body || {};
  const user = await User.findById(req.user._id).select("+refreshTokens");
  if (refreshToken) {
    const presentedHash = hashRefreshToken(refreshToken);
    user.refreshTokens = (user.refreshTokens || []).filter((rt) => rt.hash !== presentedHash);
  } else {
    user.refreshTokens = [];
  }
  await user.save({ validateBeforeSave: false });
  sendSuccess(res, {}, "Logged out successfully");
});

// ─── LOGOUT ALL DEVICES ───────────────────────────────────────────────────────
exports.logoutAll = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select("+tokenVersion");
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  user.refreshTokens = [];
  await user.save({ validateBeforeSave: false });
  securityLogger.info(`Logout all devices: ${user._id} from IP ${req.ip}`);
  sendSuccess(res, {}, "Logged out from all devices");
});

// ─── DELETE ACCOUNT ───────────────────────────────────────────────────────────
exports.deleteAccount = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select("+password");
  if (!user) throw new AppError("Account not found.", 404);

  const { password } = req.body;
  const isCorrect = await user.comparePassword(password);
  if (!isCorrect) throw new AppError("Incorrect password.", 401);

  const userId = user._id;

  // 1. Cancel any active subscriptions (field is `customer`, not `user`)
  await Subscription.updateMany(
    { customer: userId, status: { $in: ["active", "paused"] } },
    { $set: { status: "cancelled", cancelledAt: new Date(), cancelReason: "Account deleted by user" } }
  );

  // 2. Anonymise order history — keep orders for business records, but
  //    unlink them from the deleted account. (Previous code filtered by
  //    `user` and tried to scrub `deliveryAddress.name/phone/instructions`
  //    and `customerNote` — none of those fields exist on the Order model;
  //    the real fields are `customer`, and there's no separate name/phone
  //    snapshot on the address at all, only what's read via the populated
  //    `customer` ref or `guestInfo`. That mismatch meant this whole step
  //    silently matched zero documents — deleted accounts stayed linked to
  //    all their past orders forever despite the "permanently deleted"
  //    claim.)
  await Order.updateMany(
    { customer: userId },
    { $unset: { customer: 1 } }
  );

  // 3. Delete reviews (field is `customer`, not `user`)
  await Review.deleteMany({ customer: userId });

  // 4. Delete notifications
  await Notification.deleteMany({ user: userId });

  // 5. Hard delete the user document
  await User.deleteOne({ _id: userId });

  securityLogger.info(`Account permanently deleted: ${userId}`);
  sendSuccess(res, {}, "Account permanently deleted.");
});

// ─── SYNC CART ACTIVITY ───────────────────────────────────────────────────────
exports.syncCartActivity = catchAsync(async (req, res) => {
  const { hasItems } = req.body;
  const user = await User.findById(req.user._id);
  if (!user) throw new AppError("Account not found.", 404);

  user.lastCartUpdate = new Date();
  user.hasItemsInCart = !!hasItems;
  // If cart is emptied, reset the notified flag so we don't think it's abandoned
  if (!hasItems) {
    user.abandonedCartNotified = false;
  }

  await user.save({ validateBeforeSave: false });
  sendSuccess(res, {}, "Cart activity synced");
});