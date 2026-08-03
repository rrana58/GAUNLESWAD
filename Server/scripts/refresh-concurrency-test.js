/**
 * Concurrent refresh race test — run against a live backend.
 * Usage: node scripts/refresh-concurrency-test.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const axios = require("axios");
const mongoose = require("mongoose");
const User = require("../models/User");
const { signRefreshToken, hashRefreshToken } = require("../utils/tokenUtils");

const BASE = process.env.API_BASE || "http://localhost:5000/api/v1";

async function clearAuthRateLimits() {
  try {
    const { getRedis } = require("../config/redis");
    const redis = getRedis();
    const keys = await redis.keys("rl:auth:*");
    if (keys.length) await redis.del(...keys);
  } catch {
    // Redis optional for local test
  }
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  await clearAuthRateLimits();

  const phone = "9899999999";
  let user = await User.findOne({ phone }).select("+refreshTokenHash");
  if (!user) {
    user = await User.create({
      phone,
      name: "Refresh Concurrency Test",
      password: "Customer1",
      role: "customer",
      isPhoneVerified: true,
      email: "refresh-concurrency@test.local",
    });
  }

  const refreshToken = signRefreshToken(user._id);
  await User.updateOne(
    { _id: user._id },
    { $set: { refreshTokenHash: hashRefreshToken(refreshToken), isActive: true } }
  );

  console.log("Firing 10 concurrent refresh requests with the same token...\n");

  const results = await Promise.all(
    Array.from({ length: 10 }, () =>
      axios.post(`${BASE}/auth/refresh`, { refreshToken }, { validateStatus: () => true })
    )
  );

  const counts = { 200: 0, 401: 0, 500: 0, other: 0 };
  for (const r of results) {
    if (r.status === 200) counts[200]++;
    else if (r.status === 401) counts[401]++;
    else if (r.status === 500) counts[500]++;
    else {
      counts.other++;
      if (counts.other === 1) console.error("Sample other response:", r.status, r.data || r.message);
    }
  }

  console.log("Status counts:", counts);

  if (counts[500] > 0) {
    console.error("FAIL — VersionError or server error on refresh");
    process.exit(1);
  }

  if (counts[200] !== 1) {
    console.error(`FAIL — expected exactly 1 success, got ${counts[200]}`);
    process.exit(1);
  }

  if (counts[401] !== 9) {
    console.error(`FAIL — expected 9 stale-token rejections, got ${counts[401]}`);
    process.exit(1);
  }

  const winner = results.find((r) => r.status === 200);
  const retry = await axios.post(
    `${BASE}/auth/refresh`,
    { refreshToken: winner.data.refreshToken },
    { validateStatus: () => true }
  );

  if (retry.status !== 200) {
    console.error("FAIL — rotated token should refresh successfully");
    process.exit(1);
  }

  console.log("\nPASS — no 500s, exactly one winner, stale tokens rejected cleanly");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
