const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const addressSchema = new mongoose.Schema({
  label: { type: String, enum: ["Home", "Work", "Other"], default: "Other" },
  street: { type: String, required: true, maxlength: 200, trim: true },
  area: { type: String, maxlength: 100, trim: true },
  city: { type: String, default: "Kathmandu", maxlength: 100 },
  landmark: { type: String, maxlength: 200, trim: true },
  coordinates: { lat: Number, lng: Number },
  isDefault: { type: Boolean, default: false },
  source: { type: String, enum: ["gps", "manual"], default: "manual" },
});

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String, required: [true, "Name is required"], trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [60, "Name cannot exceed 60 characters"],
    },
    phone: {
      type: String, 
      required: [true, "Phone number is required"], 
      match: [/^9[678]\d{8}$/, "Enter a valid Nepal mobile number"],
    },
    email: {
      type: String, 
      lowercase: true, 
      trim: true,
      maxlength: 254,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email format"],
    },
    password: { type: String, minlength: 8, maxlength: 16, select: false },
    role: { type: String, enum: ["customer", "admin", "delivery", "kitchen"], default: "customer" },
    isPhoneVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    fcmTokens: { type: [String], validate: [(v) => v.length <= 5, "Max 5 devices"] },
    addresses: {
      type: [addressSchema],
      validate: [(v) => v.length <= 5, "Max 5 addresses"],
    },
    defaultAddressId: mongoose.Schema.Types.ObjectId,
    referralCode: { type: String, unique: true, sparse: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    loyaltyPoints: { type: Number, default: 0, min: 0 },
    totalOrders: { type: Number, default: 0, min: 0 },
    totalSpent: { type: Number, default: 0, min: 0 },
    otp: { type: String, select: false },
    otpExpiry: { type: Date, select: false },
    otpAttempts: { type: Number, default: 0, select: false },
    otpLockedUntil: { type: Date, select: false },
    tokenVersion: { type: Number, default: 0, select: false },
    // Multiple concurrent sessions (phone + tablet + reinstall, etc.) — was
    // a single `refreshTokenHash` string, which meant logging in on a
    // second device silently invalidated the first device's session. It
    // kept working until its short-lived access token expired, then
    // failed to refresh with no obvious trigger from that device's point
    // of view — surfacing as "randomly logs out after a while". Capped at
    // MAX_CONCURRENT_SESSIONS; oldest is dropped once the cap is hit.
    refreshTokens: {
      type: [
        {
          hash: { type: String, required: true },
          createdAt: { type: Date, default: Date.now },
          userAgent: String,
          _id: false,
        },
      ],
      select: false,
      default: [],
    },
    passwordChangedAt: { type: Date, select: false },
    lastLogin: Date,
    lastLoginIp: { type: String, select: false },
    // Login history — last 10 sessions (IP + device + timestamp)
    loginHistory: {
      select: false,
      type: [
        {
          ip:        { type: String },
          userAgent: { type: String },
          at:        { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    profileImage: { type: String, maxlength: 500 },
    deletedAt: { type: Date, default: null, select: false },
    // ── Cart Tracking (for notifications) ────────────────────────────────────
    lastCartUpdate: { type: Date, default: null },
    hasItemsInCart: { type: Boolean, default: false },
    abandonedCartNotified: { type: Boolean, default: false },
    // ── Admin TOTP 2FA ───────────────────────────────────────────────────────
    totpSecret:  { type: String, select: false },
    totpEnabled: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.password; delete ret.otp; delete ret.otpExpiry;
        delete ret.otpAttempts; delete ret.otpLockedUntil; delete ret.tokenVersion;
        delete ret.refreshTokens; delete ret.passwordChangedAt;
        delete ret.lastLoginIp; delete ret.deletedAt; delete ret.__v;
        return ret;
      },
    },
  }
);

userSchema.index({ phone: 1 });
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1, isActive: 1 });
// For FCM token cleanup queries
userSchema.index({ fcmTokens: 1 }, { sparse: true });
// For loyalty/rewards leaderboard queries
userSchema.index({ loyaltyPoints: -1 });

userSchema.pre("save", async function (next) {
  if (this.isModified("password") && this.password) {
    this.password = await bcrypt.hash(this.password, 12);
    this.tokenVersion = (this.tokenVersion || 0) + 1;
    this.passwordChangedAt = new Date();
  }
  next();
});

userSchema.pre(/^find/, function (next) {
  this.where({ deletedAt: null });
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.generateOTP = function () {
  const otp = crypto.randomInt(100000, 999999).toString();
  this.otp = otp;
  this.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
  this.otpAttempts = 0;
  this.otpLockedUntil = null;
  return otp;
};

userSchema.methods.verifyOTP = function (candidate) {
  if (this.otpLockedUntil && Date.now() < this.otpLockedUntil.getTime())
    return { valid: false, locked: true };
  if (!this.otp || !this.otpExpiry) return { valid: false };
  if (Date.now() > this.otpExpiry.getTime()) return { valid: false, expired: true };

  const expected = Buffer.from(this.otp.padEnd(32));
  const given = Buffer.from((candidate || "").padEnd(32));
  const match = crypto.timingSafeEqual(expected, given) && this.otp === candidate;

  if (!match) {
    this.otpAttempts = (this.otpAttempts || 0) + 1;
    if (this.otpAttempts >= 5) {
      this.otpLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      this.otp = undefined; this.otpExpiry = undefined;
    }
    return { valid: false, attemptsLeft: Math.max(0, 5 - this.otpAttempts) };
  }
  return { valid: true };
};

const MAX_CONCURRENT_SESSIONS = 5;

userSchema.methods.setRefreshToken = function (rawToken, userAgent) {
  const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
  this.refreshTokens = this.refreshTokens || [];
  this.refreshTokens.push({ hash, userAgent: (userAgent || "").slice(0, 200) });
  if (this.refreshTokens.length > MAX_CONCURRENT_SESSIONS) {
    this.refreshTokens = this.refreshTokens.slice(-MAX_CONCURRENT_SESSIONS);
  }
};

userSchema.methods.verifyRefreshToken = function (rawToken) {
  const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
  return (this.refreshTokens || []).some((rt) => {
    if (!rt.hash || rt.hash.length !== hash.length) return false;
    return crypto.timingSafeEqual(Buffer.from(rt.hash), Buffer.from(hash));
  });
};

userSchema.methods.softDelete = async function () {
  this.deletedAt = new Date(); this.isActive = false;
  this.phone = `DELETED_${Date.now()}_${this.phone}`;
  this.email = this.email ? `DELETED_${Date.now()}_${this.email}` : undefined;
  await this.save();
};

/**
 * Append a login event; keep only the last 10 entries.
 * Call after a successful login or token refresh.
 */
userSchema.methods.pushLoginHistory = function (ip, userAgent) {
  if (!this.loginHistory) this.loginHistory = [];
  this.loginHistory.push({ ip, userAgent: (userAgent || "").slice(0, 200), at: new Date() });
  if (this.loginHistory.length > 10) {
    this.loginHistory = this.loginHistory.slice(-10);
  }
};

module.exports = mongoose.model("User", userSchema);