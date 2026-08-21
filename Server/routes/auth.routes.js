const router = require("express").Router();
const { body } = require("express-validator");
const authController = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth");
const { authSlowDown } = require("../middleware/rateLimiter");
const { allowFields, validateObjectId } = require("../middleware/sanitize");
const validate = require("../middleware/validate");

// ─── Reusable validators ──────────────────────────────────────────────────────
const phoneValidator = body("phone")
  .trim()
  .matches(/^9[678]\d{8}$/)
  .withMessage("Enter a valid Nepal mobile number (98/97/96XXXXXXXX)");

const passwordValidator = body("password")
  .isLength({ min: 8, max: 16 })
  .withMessage("Password must be 8–16 characters")
  .matches(/[A-Za-z]/).withMessage("Password must contain at least one letter")
  .matches(/\d/).withMessage("Password must contain at least one number");

const newPasswordValidator = body("newPassword")
  .isLength({ min: 8, max: 16 })
  .withMessage("New password must be 8–16 characters")
  .matches(/[A-Za-z]/).withMessage("Must contain at least one letter")
  .matches(/\d/).withMessage("Must contain at least one number");

const otpValidator = body("otp")
  .trim()
  .isLength({ min: 6, max: 6 })
  .isNumeric()
  .withMessage("OTP must be exactly 6 digits");

// ─── REGISTRATION (2 steps) ───────────────────────────────────────────────────

// Step 1: send OTP to phone
// POST /api/v1/auth/register/send-otp
// Body: { phone }
router.post(
  "/register/send-otp",
  allowFields("phone"),
  [phoneValidator],
  validate,
  authController.sendRegistrationOtp
);

// Step 2: verify OTP + complete registration
// POST /api/v1/auth/register/verify
// Body: { phone, otp, name, password, referralCode? }
router.post(
  "/register/verify",
  authSlowDown,
  allowFields("phone", "otp", "name", "password", "referralCode"),
  [
    phoneValidator,
    otpValidator,
    body("name")
      .trim()
      .isLength({ min: 2, max: 60 })
      .withMessage("Name must be 2–60 characters"),
    passwordValidator,
  ],
  validate,
  authController.verifyAndRegister
);

// ─── LOGIN ────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/login
// Body: { phone?, email?, password }
router.post(
  "/login",
  authSlowDown,
  allowFields("phone", "email", "password"),
  [
    body("phone").optional().trim().matches(/^9[678]\d{8}$/).withMessage("Enter a valid Nepal mobile number"),
    body("email").optional().trim().isEmail().withMessage("Enter a valid email address"),
    body("password")
      .notEmpty()
      .withMessage("Password is required")
      .isLength({ max: 16 })
      .withMessage("Invalid password"),
  ],
  validate,
  authController.login
);

// ─── FORGOT PASSWORD (2 steps) ────────────────────────────────────────────────

// Step 1: send OTP to registered phone
// POST /api/v1/auth/forgot-password/send-otp
// Body: { phone }
router.post(
  "/forgot-password/send-otp",
  allowFields("phone"),
  [phoneValidator],
  validate,
  authController.sendForgotPasswordOtp
);

// Step 2: verify OTP + set new password
// POST /api/v1/auth/forgot-password/reset
// Body: { phone, otp, newPassword }
router.post(
  "/forgot-password/reset",
  authSlowDown,
  allowFields("phone", "otp", "newPassword"),
  [phoneValidator, otpValidator, newPasswordValidator],
  validate,
  authController.resetPasswordWithOtp
);

// ─── REFRESH TOKEN ────────────────────────────────────────────────────────────
// POST /api/v1/auth/refresh
// Body: { refreshToken }
router.post(
  "/refresh",
  allowFields("refreshToken"),
  [body("refreshToken").notEmpty().isString().withMessage("Refresh token required")],
  validate,
  authController.refreshToken
);

const totpController = require("../controllers/totp.controller");

// POST /api/v1/auth/totp/confirm  (public — called during login 2FA challenge)
router.post(
  "/totp/confirm",
  authSlowDown,
  allowFields("userId", "token", "totpChallengeToken"),
  [
    body("userId").notEmpty().withMessage("userId is required"),
    body("token").trim().isLength({ min: 6, max: 6 }).isNumeric().withMessage("A 6-digit TOTP token is required"),
    body("totpChallengeToken").notEmpty().isString().withMessage("Login challenge token is required"),
  ],
  validate,
  totpController.confirmTotpLogin
);

// ─── PROTECTED ROUTES (require login) ────────────────────────────────────────
router.use(protect);

// TOTP 2FA (admin only)
router.post("/totp/setup",   totpController.setupTotp);
router.post("/totp/verify",  totpController.verifyAndEnableTotp);
router.post("/totp/disable", totpController.disableTotp);

// GET /api/v1/auth/me
router.get("/me", authController.getMe);

// GET /api/v1/auth/login-history
// Returns the last 10 login events for the authenticated user
router.get("/login-history", authController.getLoginHistory);

// PATCH /api/v1/auth/profile
// Body: { name?, email? }
router.patch(
  "/profile",
  allowFields("name", "email"),
  [
    body("name").optional().trim().isLength({ min: 2, max: 60 }),
    body("email").optional().isEmail().normalizeEmail().withMessage("Invalid email"),
  ],
  validate,
  authController.updateProfile
);

// POST /api/v1/auth/change-password/send-otp
// No body needed — OTP sent to the logged-in user's registered phone
router.post("/change-password/send-otp", authController.sendChangePasswordOtp);

// POST /api/v1/auth/change-password
// Body: { currentPassword, otp, newPassword }
router.post(
  "/change-password",
  allowFields("currentPassword", "otp", "newPassword"),
  [
    body("currentPassword").notEmpty().withMessage("Current password is required"),
    otpValidator,
    newPasswordValidator,
  ],
  validate,
  authController.changePassword
);

// POST /api/v1/auth/fcm-token
router.post(
  "/fcm-token",
  allowFields("fcmToken"),
  [body("fcmToken").isString().isLength({ max: 500 })],
  validate,
  authController.updateFcmToken
);

// POST /api/v1/auth/logout
router.post("/logout", authController.logout);

// POST /api/v1/auth/logout-all
router.post("/logout-all", authController.logoutAll);

// DELETE /api/v1/auth/account
// Body: { password } — confirms identity before deleting
router.delete(
  "/account",
  allowFields("password"),
  [body("password").notEmpty().withMessage("Password required to delete account")],
  validate,
  authController.deleteAccount
);

// POST /api/v1/auth/cart-activity
router.post("/cart-activity", authController.syncCartActivity);

module.exports = router;