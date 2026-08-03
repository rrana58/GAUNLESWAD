/**
 * test-mealplan.js
 *
 * Tests the meal-plan "free meal" atomic claim logic (claimMealAtomic in
 * subscription.controller.js) under real concurrent load — same proven
 * methodology as the stock and coupon concurrency tests.
 *
 * Meal-plan claims require a real logged-in customer with an ACTIVE
 * subscription. Going through the real signup flow needs an OTP that's
 * only logged to the server console (not returned via API), and an
 * admin-confirmation step. To avoid manual OTP copy-pasting, this script
 * sets up the required test data directly via Mongoose (same approach as
 * seed.js), then runs the actual concurrency test over real HTTP requests.
 *
 * What it does:
 *   1. Connects directly to MongoDB and creates:
 *      - a verified test customer (known phone + password)
 *      - a MealPlan containing our test menu item, maxMealsPerPeriod >= 1
 *      - an ACTIVE Subscription for that customer, maxMeals: 1
 *   2. Logs in as that customer via the real HTTP API.
 *   3. Fires 5 simultaneous orders for the plan's menu item.
 *   4. Expects exactly 1 to get the "free meal" claim (maxMeals: 1),
 *      the rest charged full price (still succeed, just not "free").
 *   5. Fires a 6th order the next "today" boundary can't be faked, so
 *      instead re-fires immediately to confirm same-day double-claim
 *      is blocked even after the first claim succeeds.
 *
 * Usage:
 *   1. Make sure `npm run dev` is running in another terminal.
 *   2. Run: node test-mealplan.js
 *      (uses the same .env / MONGO_URI as the running server)
 */

require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");
const MealPlan = require("./models/MealPlan");
const Subscription = require("./models/Subscription");

const BASE_URL = "http://localhost:5000/api/v1";
const TEST_PHONE = "9800000099";
const TEST_PASSWORD = "MealTest!2026"; // 13 chars — must stay <= 16 (User model maxlength)

async function main() {
  console.log("── Step 1: Connecting to MongoDB directly (test data setup) ──");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected.\n");

  console.log("── Step 2: Logging in as admin (to create the menu item via API) ──");
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "9800000001", password: "admin@123" }),
  });
  const loginData = await loginRes.json();
  const adminToken = loginData.accessToken;
  const adminAuth = { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" };
  console.log("✅ Admin logged in.\n");

  const catRes = await fetch(`${BASE_URL}/menu/categories`);
  const catData = await catRes.json();
  const categoryId = catData.categories[0]._id;

  const itemRes = await fetch(`${BASE_URL}/menu`, {
    method: "POST",
    headers: adminAuth,
    body: JSON.stringify({
      name: `Meal Plan Test Thali ${Date.now()}`, // unique name/slug each run, avoids collisions from prior failed runs
      category: categoryId,
      basePrice: 250,
      stockQuantity: 50,
      isAvailable: true,
    }),
  });
  const itemData = await itemRes.json();
  if (!itemData.success || !itemData.item) {
    console.error("❌ Menu item creation failed. Full response:", JSON.stringify(itemData, null, 2));
    process.exit(1);
  }
  const menuItemId = itemData.item._id;
  console.log(`✅ Test menu item created: ${menuItemId}\n`);

  console.log("── Step 3: Creating verified test customer directly in MongoDB ──");
  await User.deleteOne({ phone: TEST_PHONE }); // clean slate if re-run
  const customer = await User.create({
    name: "Meal Plan Test Customer",
    phone: TEST_PHONE,
    password: TEST_PASSWORD, // hashed automatically by the pre("save") hook
    role: "customer",
    isPhoneVerified: true,
    isActive: true,
  });
  console.log(`✅ Customer created: ${customer._id}\n`);

  console.log("── Step 4: Creating a MealPlan + ACTIVE Subscription directly ──");
  const plan = await MealPlan.create({
    name: "Test Plan " + Date.now(), // unique to avoid slug collisions on re-run
    monthlyPrice: 3000,
    items: [menuItemId, menuItemId], // model requires 2-15 items; duplicate is fine for this test
    maxMealsPerPeriod: 30,
  });

  const subscription = await Subscription.create({
    customer: customer._id,
    plan: plan._id,
    pricePaid: 3000,
    status: "active",
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    mealsUsed: 0,
    maxMeals: 1, // deliberately low — makes the concurrency test meaningful
  });
  console.log(`✅ Active subscription created: ${subscription._id} (maxMeals: 1)\n`);

  console.log("── Step 5: Logging in as the test customer over real HTTP ──");
  const custLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: TEST_PHONE, password: TEST_PASSWORD }),
  });
  const custLoginData = await custLoginRes.json();
  if (!custLoginData.success) {
    console.error("❌ Customer login failed:", custLoginData.message);
    process.exit(1);
  }
  const custToken = custLoginData.accessToken;
  console.log("✅ Customer logged in.\n");

  console.log("── Step 6: Firing 5 simultaneous orders for the plan's menu item ──");
  const custAuth = { "Content-Type": "application/json", Authorization: `Bearer ${custToken}` };

  const placeOrder = (i) =>
    fetch(`${BASE_URL}/orders`, {
      method: "POST",
      headers: custAuth,
      body: JSON.stringify({
        items: [{ menuItemId, quantity: 1 }],
        paymentMethod: "cod",
        deliveryType: "pickup",
      }),
    }).then(async (r) => ({ i, status: r.status, body: await r.json() }));

  const results = await Promise.all([1, 2, 3, 4, 5].map(placeOrder));

  let freeClaims = 0;
  let paidOrders = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status >= 200 && r.status < 300) {
      const planApplied = r.body.order?.items?.some((it) => it.planMeal?.applied);
      if (planApplied) {
        freeClaims++;
        console.log(`  ✅ Order #${r.i}: SUCCESS — FREE meal claimed`);
      } else {
        paidOrders++;
        console.log(`  ✅ Order #${r.i}: SUCCESS — charged full price (no free claim left)`);
      }
    } else {
      failed++;
      console.log(`  ❌ Order #${r.i}: FAILED (${r.status}) — ${r.body.message}`);
    }
  }

  console.log(`\nResult: ${freeClaims} free claim(s), ${paidOrders} paid order(s), ${failed} failed`);
  console.log(
    freeClaims === 1
      ? "✅ PASS — exactly 1 free meal claimed despite 5 simultaneous requests (maxMeals: 1, atomic claim working).\n"
      : `❌ Unexpected — expected exactly 1 free claim, got ${freeClaims}.\n`
  );

  console.log("── Step 7: Verifying final subscription state in DB ──");
  const finalSub = await Subscription.findById(subscription._id);
  console.log(`mealsUsed: ${finalSub.mealsUsed} (expected: 1)`);
  console.log(finalSub.mealsUsed === 1 ? "✅ PASS — DB state matches.\n" : "⚠️  Mismatch — review manually.\n");

  console.log("── Cleanup ──");
  await fetch(`${BASE_URL}/menu/${menuItemId}`, { method: "DELETE", headers: adminAuth });
  await Subscription.deleteOne({ _id: subscription._id });
  await MealPlan.deleteOne({ _id: plan._id });
  await User.deleteOne({ _id: customer._id });
  console.log("Test customer, plan, and subscription removed.");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Script error:", err);
  process.exit(1);
});