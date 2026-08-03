/**
 * test-totp.js
 *
 * End-to-end test of the admin TOTP 2FA flow we rewrote for otplib v13.
 * This is the riskiest untested code from our earlier rewrite, since it was
 * a full API rewrite (not a one-line fix) and has never been exercised.
 *
 * Flow tested:
 *   1. Login as admin
 *   2. POST /auth/totp/setup    -> get a secret + QR code
 *   3. Compute a valid TOTP code locally using otplib (simulates scanning
 *      the QR into an authenticator app and reading the current code)
 *   4. POST /auth/totp/verify   -> activate TOTP using that code
 *   5. POST /auth/totp/disable  -> deactivate TOTP again (so we don't leave
 *      the admin account requiring 2FA, which would break future test runs)
 *
 * Usage:
 *   1. Make sure `npm run dev` is running in another terminal.
 *   2. Run: node test-totp.js
 */

const { generate } = require("otplib"); // same package the app itself uses

const BASE_URL = "http://localhost:5000/api/v1";

async function main() {
  console.log("── Step 1: Logging in as admin ──");
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "9800000001", password: "admin@123" }),
  });
  const loginData = await loginRes.json();
  if (!loginData.success) {
    console.error("❌ Login failed:", loginData.message);
    process.exit(1);
  }
  const token = loginData.accessToken;
  const authHeader = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  console.log("✅ Logged in.\n");

  console.log("── Step 2: Calling /totp/setup ──");
  const setupRes = await fetch(`${BASE_URL}/auth/totp/setup`, {
    method: "POST",
    headers: authHeader,
  });
  const setupData = await setupRes.json();
  if (!setupRes.ok) {
    console.error(`❌ Setup failed (${setupRes.status}):`, setupData.message);
    process.exit(1);
  }
  console.log(`✅ Got secret: ${setupData.secret}`);
  console.log(`✅ Got QR data URL (length: ${setupData.qrDataUrl?.length || 0} chars)\n`);

  console.log("── Step 3: Computing a valid TOTP code locally (simulating an authenticator app) ──");
  const code = await generate({ secret: setupData.secret });
  console.log(`✅ Computed code: ${code}\n`);

  console.log("── Step 4: Calling /totp/verify with that code ──");
  const verifyRes = await fetch(`${BASE_URL}/auth/totp/verify`, {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({ token: code }),
  });
  const verifyData = await verifyRes.json();
  if (verifyRes.ok) {
    console.log(`✅ TOTP verified and enabled (${verifyRes.status}): ${verifyData.message}\n`);
  } else {
    console.log(`❌ Verify FAILED (${verifyRes.status}): ${verifyData.message}`);
    console.log("   This means either the rewritten otplib v13 logic has a bug,");
    console.log("   or there's a clock-sync issue between your machine and itself (unlikely).\n");
  }

  console.log("── Step 5: Disabling TOTP again (cleanup, requires password) ──");
  const disableRes = await fetch(`${BASE_URL}/auth/totp/disable`, {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({ password: "admin@123" }),
  });
  const disableData = await disableRes.json();
  if (disableRes.ok) {
    console.log(`✅ TOTP disabled (${disableRes.status}): ${disableData.message}\n`);
  } else {
    console.log(`❌ Disable FAILED (${disableRes.status}): ${disableData.message}`);
    console.log("   ⚠️  IMPORTANT: if this failed, your admin account may now require");
    console.log("   a TOTP code to log in, and you no longer have a way to generate one");
    console.log("   manually unless you saved the secret above. Save it now if so.\n");
  }

  console.log("── Summary ──");
  if (verifyRes.ok && disableRes.ok) {
    console.log("✅ PASS — full TOTP setup → verify → disable cycle completed successfully.");
    console.log("   The otplib v13 rewrite is working correctly end-to-end.");
  } else {
    console.log("⚠️  Review the failures above — the otplib v13 rewrite may need further fixes.");
  }
}

main().catch((err) => {
  console.error("Script error:", err);
  process.exit(1);
});