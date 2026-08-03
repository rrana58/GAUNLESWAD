const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const JWT_OPTIONS = {
  algorithm: "HS256",
  issuer: "gharko-swad",
  audience: "gharko-swad-client",
};

// ─── Sign access token (short-lived) ─────────────────────────────────────────
// Includes tokenVersion (tv) — allows server-side invalidation
const signAccessToken = (id, role, tokenVersion = 0) => {
  return jwt.sign(
    { id, role, tv: tokenVersion },
    process.env.JWT_SECRET,
    { ...JWT_OPTIONS, expiresIn: process.env.JWT_EXPIRES_IN || "15m" } // SHORT — 15 min
  );
};

// ─── Sign refresh token (long-lived, stored as hash) ─────────────────────────
const signRefreshToken = (id) => {
  return jwt.sign(
    { id, jti: crypto.randomUUID() }, // jti = unique token ID
    process.env.JWT_REFRESH_SECRET,
    { ...JWT_OPTIONS, expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d" }
  );
};

const hashRefreshToken = (rawToken) =>
  crypto.createHash("sha256").update(rawToken).digest("hex");

/** Build the standard auth token JSON payload (no DB write). */
const buildTokenPayload = (user, accessToken, refreshToken) => ({
  success: true,
  accessToken,
  refreshToken,
  user: user.toJSON(),
});

// ─── Send tokens in response ──────────────────────────────────────────────────
const sendTokens = async (user, statusCode, res) => {
  const accessToken = signAccessToken(user._id, user.role, user.tokenVersion);
  const refreshToken = signRefreshToken(user._id);

  // Store refresh token hash on user document (not the raw token)
  user.setRefreshToken(refreshToken);
  await user.save({ validateBeforeSave: false });

  res.status(statusCode).json(buildTokenPayload(user, accessToken, refreshToken));
};

// ─── Short-lived TOTP login challenge (password verified, 2FA pending) ─────────
const signTotpChallengeToken = (userId) => {
  return jwt.sign(
    { id: userId, purpose: "totp_pending" },
    process.env.JWT_SECRET,
    { ...JWT_OPTIONS, expiresIn: "5m" }
  );
};

const verifyTotpChallengeToken = (token, expectedUserId) => {
  if (!token || typeof token !== "string" || token.length > 2048) {
    return { valid: false };
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "gharko-swad",
      audience: "gharko-swad-client",
    });
    if (decoded.purpose !== "totp_pending") return { valid: false };
    if (!decoded.id || decoded.id.toString() !== expectedUserId.toString()) {
      return { valid: false };
    }
    return { valid: true };
  } catch {
    return { valid: false };
  }
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  hashRefreshToken,
  buildTokenPayload,
  sendTokens,
  signTotpChallengeToken,
  verifyTotpChallengeToken,
};
