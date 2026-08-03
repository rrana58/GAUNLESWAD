/**
 * Phase 1 authentication smoke test — run against a live backend.
 * Usage: node scripts/auth-smoke-test.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const axios = require("axios");
const jwt = require("jsonwebtoken");
const { generateSecret, verify, generateURI } = require("otplib");
const mongoose = require("mongoose");
const User = require("../models/User");

const BASE = process.env.API_BASE || "http://localhost:5000/api/v1";
const api = axios.create({ baseURL: BASE, validateStatus: () => true });

const results = [];
const bugs = [];

function pass(name, detail = "") {
  results.push({ name, status: "PASS", detail });
  console.log(`✓ PASS  ${name}${detail ? " — " + detail : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, status: "FAIL", detail });
  bugs.push({ name, detail });
  console.log(`✗ FAIL  ${name}${detail ? " — " + detail : ""}`);
}

function skip(name, detail = "") {
  results.push({ name, status: "SKIP", detail });
  console.log(`○ SKIP  ${name}${detail ? " — " + detail : ""}`);
}

async function ensureTestUsers() {
  await mongoose.connect(process.env.MONGO_URI);

  const specs = [
    { phone: "9811111111", name: "Test Customer", password: "Customer1", role: "customer", isPhoneVerified: true },
    { phone: "9822222222", name: "Test Kitchen", password: "Kitchen1", role: "kitchen", isPhoneVerified: true },
    { phone: "9833333333", name: "Test Rider", password: "Rider123", role: "delivery", isPhoneVerified: true },
    { phone: "9800000002", name: "Admin No TOTP", password: "Admin1234", role: "admin", isPhoneVerified: true, totpEnabled: false },
    { phone: "9800000003", name: "Admin TOTP", password: "Admin1234", role: "admin", isPhoneVerified: true },
  ];

  for (const spec of specs) {
    let user = await User.findOne({ phone: spec.phone }).select("+password +totpSecret +totpEnabled");
    if (!user) {
      user = await User.create({ ...spec, email: `${spec.role}@test.local` });
      console.log(`  Created test user: ${spec.phone} (${spec.role})`);
    } else {
      user.name = spec.name;
      user.role = spec.role;
      user.isPhoneVerified = true;
      user.isActive = true;
      user.password = spec.password;
      if (spec.totpEnabled === false) {
        user.totpEnabled = false;
        user.totpSecret = undefined;
      }
      await user.save();
    }
  }

  // Enable TOTP on admin 9800000003 with known secret
  const totpAdmin = await User.findOne({ phone: "9800000003" }).select("+totpSecret +totpEnabled");
  const totpSecret = generateSecret();
  totpAdmin.totpSecret = totpSecret;
  totpAdmin.totpEnabled = true;
  await totpAdmin.save({ validateBeforeSave: false });

  return { totpSecret };
}

async function login(phone, password) {
  return api.post("/auth/login", { phone, password });
}

async function main() {
  console.log("\n=== Phase 1 Auth Smoke Test ===");
  console.log(`API: ${BASE}\n`);

  // Health check
  const health = await axios.get(`${BASE.replace("/api/v1", "")}/health`, { validateStatus: () => true }).catch(() => null);
  if (!health || health.status >= 500) {
    // try login probe
    const probe = await api.post("/auth/login", { phone: "9800000001", password: "wrong" });
    if (probe.status === 401 || probe.status === 400) {
      pass("Backend reachable", `status ${probe.status} on bad login`);
    } else {
      fail("Backend reachable", `unexpected probe status ${probe.status}`);
      process.exit(1);
    }
  } else {
    pass("Backend reachable", `health ${health.status}`);
  }

  let totpSecret;
  try {
    ({ totpSecret } = await ensureTestUsers());
    pass("Test users ensured in MongoDB");
  } catch (err) {
    fail("Test users ensured in MongoDB", err.message);
    process.exit(1);
  }

  // ─── CUSTOMER ───────────────────────────────────────────────────────────────
  console.log("\n--- Customer ---");

  const custLogin = await login("9811111111", "Customer1");
  if (custLogin.status === 200 && custLogin.data.accessToken && custLogin.data.user?.role === "customer") {
    pass("Customer login", `tokens issued, role=${custLogin.data.user.role}`);
  } else {
    fail("Customer login", JSON.stringify(custLogin.data));
  }

  const custAccess = custLogin.data.accessToken;
  const custRefresh = custLogin.data.refreshToken;

  const custMe = await api.get("/auth/me", { headers: { Authorization: `Bearer ${custAccess}` } });
  if (custMe.status === 200 && custMe.data.user?.phone === "9811111111") {
    pass("Customer /auth/me", custMe.data.user.name);
  } else {
    fail("Customer /auth/me", JSON.stringify(custMe.data));
  }

  const custLogout = await api.post("/auth/logout", {}, { headers: { Authorization: `Bearer ${custAccess}` } });
  if (custLogout.status === 200) {
    pass("Customer logout");
  } else {
    fail("Customer logout", JSON.stringify(custLogout.data));
  }

  // Session restore simulation: login again, call /me with stored token
  const custLogin2 = await login("9811111111", "Customer1");
  const restoreMe = await api.get("/auth/me", { headers: { Authorization: `Bearer ${custLogin2.data.accessToken}` } });
  if (restoreMe.status === 200) {
    pass("Customer session restore (/auth/me with stored token)");
  } else {
    fail("Customer session restore", JSON.stringify(restoreMe.data));
  }

  const oldRefresh = custLogin2.data.refreshToken;
  const refreshRes = await api.post("/auth/refresh", { refreshToken: oldRefresh });
  if (refreshRes.status === 200 && refreshRes.data.accessToken && refreshRes.data.refreshToken) {
    pass("Customer refresh token flow", "new tokens returned");
    if (refreshRes.data.refreshToken !== oldRefresh) {
      pass("Customer refresh token rotation", "refresh token changed");
    } else {
      fail("Customer refresh token rotation", "refresh token unchanged");
    }
  } else {
    fail("Customer refresh token flow", JSON.stringify(refreshRes.data));
  }

  // Reuse old refresh — should fail (reuse detection)
  const reuseRefresh = await api.post("/auth/refresh", { refreshToken: oldRefresh });
  if (reuseRefresh.status === 401) {
    pass("Customer refresh reuse rejected", "401 on rotated token");
  } else {
    fail("Customer refresh reuse rejected", `status ${reuseRefresh.status}`);
  }

  // Forgot password — OTP logged in dev
  const forgotOtp = await api.post("/auth/forgot-password/send-otp", { phone: "9811111111" });
  if (forgotOtp.status === 200) {
    pass("Customer forgot password send OTP");
  } else {
    fail("Customer forgot password send OTP", JSON.stringify(forgotOtp.data));
  }

  const custWithOtp = await User.findOne({ phone: "9811111111" }).select("+otp");
  if (custWithOtp?.otp) {
    const resetRes = await api.post("/auth/forgot-password/reset", {
      phone: "9811111111",
      otp: custWithOtp.otp,
      newPassword: "Customer2",
    });
    if (resetRes.status === 200) {
      pass("Customer reset password");
      // Restore password for other tests
      const u = await User.findOne({ phone: "9811111111" }).select("+password");
      u.password = "Customer1";
      await u.save();
      pass("Customer password restored for retest");
    } else {
      fail("Customer reset password", JSON.stringify(resetRes.data));
    }
  } else {
    skip("Customer reset password", "OTP not found in DB after send-otp");
  }

  // ─── ADMIN (no TOTP) ────────────────────────────────────────────────────────
  console.log("\n--- Admin (TOTP disabled) ---");

  const adminLogin = await login("9800000002", "Admin1234");
  if (adminLogin.status === 200 && adminLogin.data.accessToken && !adminLogin.data.totpRequired) {
    pass("Admin login (TOTP disabled)", "direct tokens");
  } else {
    fail("Admin login (TOTP disabled)", JSON.stringify(adminLogin.data));
  }

  // ─── ADMIN (TOTP enabled) ───────────────────────────────────────────────────
  console.log("\n--- Admin (TOTP enabled) ---");

  const totpStep1 = await login("9800000003", "Admin1234");
  if (totpStep1.status === 200 && totpStep1.data.totpRequired && !totpStep1.data.accessToken) {
    pass("Admin login TOTP step 1", "challenge issued, no session tokens");
  } else {
    fail("Admin login TOTP step 1", JSON.stringify(totpStep1.data));
  }

  if (totpStep1.data.accessToken || totpStep1.data.refreshToken) {
    fail("Tokens before TOTP verification", "tokens present in step 1 response");
  } else {
    pass("No tokens before TOTP verification");
  }

  const { generate } = require("otplib");
  const validToken = await generate({ secret: totpSecret });
  const totpConfirm = await api.post("/auth/totp/confirm", {
    userId: totpStep1.data.userId,
    token: validToken,
    totpChallengeToken: totpStep1.data.totpChallengeToken,
  });
  if (totpConfirm.status === 200 && totpConfirm.data.accessToken && totpConfirm.data.user?.role === "admin") {
    pass("Admin TOTP confirm (valid code)", "tokens issued");
  } else {
    fail("Admin TOTP confirm (valid code)", JSON.stringify(totpConfirm.data));
  }

  const invalidTotp = await api.post("/auth/totp/confirm", {
    userId: totpStep1.data.userId,
    token: "000000",
    totpChallengeToken: totpStep1.data.totpChallengeToken,
  });
  if (invalidTotp.status === 401) {
    pass("Admin invalid TOTP", "401 rejected");
  } else {
    fail("Admin invalid TOTP", `status ${invalidTotp.status}`);
  }

  // Expired challenge — forge expired JWT
  const expiredChallenge = jwt.sign(
    { id: totpStep1.data.userId, purpose: "totp_pending" },
    process.env.JWT_SECRET,
    { algorithm: "HS256", issuer: "gharko-swad", audience: "gharko-swad-client", expiresIn: "-1s" }
  );
  const expiredTotp = await api.post("/auth/totp/confirm", {
    userId: totpStep1.data.userId,
    token: validToken,
    totpChallengeToken: expiredChallenge,
  });
  if (expiredTotp.status === 401) {
    pass("Admin expired TOTP challenge token", "401 rejected");
  } else {
    fail("Admin expired TOTP challenge token", `status ${expiredTotp.status}`);
  }

  // Refresh after TOTP login
  const totpRefresh = await api.post("/auth/refresh", { refreshToken: totpConfirm.data.refreshToken });
  if (totpRefresh.status === 200 && totpRefresh.data.accessToken) {
    pass("Admin refresh after TOTP login");
  } else {
    fail("Admin refresh after TOTP login", JSON.stringify(totpRefresh.data));
  }

  const adminLogout = await api.post("/auth/logout", {}, {
    headers: { Authorization: `Bearer ${totpConfirm.data.accessToken}` },
  });
  if (adminLogout.status === 200) {
    pass("Admin logout");
  } else {
    fail("Admin logout", JSON.stringify(adminLogout.data));
  }

  // ─── KITCHEN ────────────────────────────────────────────────────────────────
  console.log("\n--- Kitchen ---");

  const kitchenLogin = await login("9822222222", "Kitchen1");
  if (kitchenLogin.status === 200 && kitchenLogin.data.user?.role === "kitchen") {
    pass("Kitchen login");
  } else {
    fail("Kitchen login", JSON.stringify(kitchenLogin.data));
  }

  const kitchenMe = await api.get("/auth/me", {
    headers: { Authorization: `Bearer ${kitchenLogin.data.accessToken}` },
  });
  if (kitchenMe.status === 200) {
    pass("Kitchen session restore (/auth/me)");
  } else {
    fail("Kitchen session restore", JSON.stringify(kitchenMe.data));
  }

  const kitchenLogout = await api.post("/auth/logout", {}, {
    headers: { Authorization: `Bearer ${kitchenLogin.data.accessToken}` },
  });
  if (kitchenLogout.status === 200) {
    pass("Kitchen logout");
  } else {
    fail("Kitchen logout", JSON.stringify(kitchenLogout.data));
  }

  // Wrong role: customer creds on kitchen portal (client-side check — API still returns tokens)
  const custAsKitchen = await login("9811111111", "Customer1");
  if (custAsKitchen.status === 200 && custAsKitchen.data.user?.role === "customer") {
    pass("Wrong-role: customer login API succeeds (client must reject)", "role=customer");
  } else {
    fail("Wrong-role customer login", JSON.stringify(custAsKitchen.data));
  }

  // ─── RIDER ──────────────────────────────────────────────────────────────────
  console.log("\n--- Rider ---");

  const riderLogin = await login("9833333333", "Rider123");
  if (riderLogin.status === 200 && riderLogin.data.user?.role === "delivery") {
    pass("Rider login");
  } else {
    fail("Rider login", JSON.stringify(riderLogin.data));
  }

  const riderMe = await api.get("/auth/me", {
    headers: { Authorization: `Bearer ${riderLogin.data.accessToken}` },
  });
  if (riderMe.status === 200) {
    pass("Rider session restore (/auth/me)");
  } else {
    fail("Rider session restore", JSON.stringify(riderMe.data));
  }

  const riderLogout = await api.post("/auth/logout", {}, {
    headers: { Authorization: `Bearer ${riderLogin.data.accessToken}` },
  });
  if (riderLogout.status === 200) {
    pass("Rider logout");
  } else {
    fail("Rider logout", JSON.stringify(riderLogout.data));
  }

  // ─── CROSS-ROLE API ─────────────────────────────────────────────────────────
  console.log("\n--- Cross-role ---");

  const crossTests = [
    { label: "Customer creds → admin portal (client rejects non-admin)", phone: "9811111111", password: "Customer1", expectedRole: "customer" },
    { label: "Kitchen creds → rider portal (client rejects non-delivery)", phone: "9822222222", password: "Kitchen1", expectedRole: "kitchen" },
    { label: "Rider creds → kitchen portal (client rejects non-kitchen)", phone: "9833333333", password: "Rider123", expectedRole: "delivery" },
    { label: "Admin creds → customer app (API returns admin tokens)", phone: "9800000002", password: "Admin1234", expectedRole: "admin" },
  ];

  for (const t of crossTests) {
    const res = await login(t.phone, t.password);
    if (res.status === 200 && res.data.user?.role === t.expectedRole) {
      pass(t.label, `API role=${t.expectedRole} (portal isolation is client-side)`);
    } else {
      fail(t.label, JSON.stringify(res.data));
    }
  }

  // TOTP admin cannot complete login without second factor
  const totpOnly = await login("9800000003", "Admin1234");
  if (totpOnly.data.totpRequired && !totpOnly.data.accessToken) {
    pass("TOTP admin blocked from tokens without 2FA step");
  } else {
    fail("TOTP admin blocked from tokens without 2FA step", JSON.stringify(totpOnly.data));
  }

  // ─── Summary ────────────────────────────────────────────────────────────────
  await mongoose.disconnect();

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const skipped = results.filter((r) => r.status === "SKIP").length;

  console.log("\n=== SUMMARY ===");
  console.log(`PASS: ${passed}  FAIL: ${failed}  SKIP: ${skipped}`);

  if (bugs.length) {
    console.log("\nBUGS:");
    bugs.forEach((b) => console.log(`  - ${b.name}: ${b.detail}`));
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
