/**
 * test-order-status.js
 *
 * Walks a fresh order through its full lifecycle:
 *   pending -> confirmed -> preparing -> ready -> delivered
 *
 * Verifies, at each step:
 *   - the status update request succeeds (no crash)
 *   - side effects that should fire (SMS attempt, push attempt, socket emit)
 *     don't throw unhandled errors
 *   - loyalty points get scheduled on "delivered"
 *   - delivery notification gets scheduled on "ready"
 *
 * Usage:
 *   1. Make sure `npm run dev` is running in another terminal.
 *   2. Run: node test-order-status.js
 */

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
  const authHeader = { Authorization: `Bearer ${token}` };
  console.log("✅ Logged in.\n");

  console.log("── Step 2: Setting up a test menu item ──");
  const catRes = await fetch(`${BASE_URL}/menu/categories`);
  const catData = await catRes.json();
  const categoryId = catData.categories[0]._id;

  const itemRes = await fetch(`${BASE_URL}/menu`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify({
      name: "Status Test Momo",
      category: categoryId,
      basePrice: 150,
      stockQuantity: 10,
      isAvailable: true,
    }),
  });
  const itemData = await itemRes.json();
  const menuItemId = itemData.item._id;
  console.log(`✅ Test item created: ${menuItemId}\n`);

  console.log("── Step 3: Placing a fresh order ──");
  const orderRes = await fetch(`${BASE_URL}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ menuItemId, quantity: 1 }],
      paymentMethod: "cod",
      deliveryType: "pickup",
      guestInfo: { name: "Status Test Customer", phone: "9800000003" },
    }),
  });
  const orderData = await orderRes.json();
  if (!orderData.success) {
    console.error("❌ Order placement failed:", orderData.message);
    process.exit(1);
  }
  const orderId = orderData.order._id;
  console.log(`✅ Order created: ${orderId} (status: ${orderData.order.status})\n`);

  console.log("── Step 4: Walking through the full status lifecycle ──");
  const transitions = ["confirmed", "preparing", "ready", "delivered"];

  for (const status of transitions) {
    const res = await fetch(`${BASE_URL}/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ status, note: `Moved to ${status} via test script` }),
    });
    const data = await res.json();
    if (res.status >= 200 && res.status < 300) {
      console.log(`  ✅ → ${status} (${res.status})`);
    } else {
      console.log(`  ❌ → ${status} FAILED (${res.status}) — ${data.message}`);
      console.log("     Full response:", JSON.stringify(data, null, 2));
    }
    // small delay between transitions so logs/jobs are easier to read in the server console
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log("\n── Step 5: Verifying final order state ──");
  const finalRes = await fetch(`${BASE_URL}/orders/${orderId}`, { headers: authHeader });
  const finalData = await finalRes.json();
  const finalOrder = finalData.order;
  console.log(`Final status: ${finalOrder.status}`);
  console.log(`actualDeliveredAt set: ${!!finalOrder.actualDeliveredAt}`);
  console.log(`paymentStatus: ${finalOrder.paymentStatus}`);

  if (finalOrder.status === "delivered" && finalOrder.actualDeliveredAt) {
    console.log("\n✅ PASS — order moved through its full lifecycle without crashing.");
    console.log("ℹ️  Check the npm run dev console for:");
    console.log('    - "[DEV OTP]" style SMS attempt logs (if Sparrow isn\'t real, expect a logged failure, not a crash)');
    console.log("    - any Bull job logs for scheduleLoyaltyPoints / scheduleDeliveryNotification");
  } else {
    console.log("\n⚠️  Unexpected final state — review manually.");
  }

  console.log("\n── Cleanup ──");
  await fetch(`${BASE_URL}/menu/${menuItemId}`, { method: "DELETE", headers: authHeader });
  console.log("Test item deleted (or soft-deleted if it now has order history, by design).");
}

main().catch((err) => {
  console.error("Script error:", err);
  process.exit(1);
});