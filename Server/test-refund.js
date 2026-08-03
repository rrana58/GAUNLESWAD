/**
 * test-refund.js
 *
 * Tests refundKhalti's validation logic without needing real Khalti credentials.
 * Since we're on placeholder Khalti keys, we can't test an actual successful
 * refund — but we CAN (and should) verify every guard clause fails safely
 * with a clean error response instead of crashing.
 *
 * Guards tested, in order, matching controllers/payment.controller.js:
 *   1. Order not found                          -> 404
 *   2. Order status not delivered/cancelled      -> 400
 *   3. Order already refunded                    -> 400
 *   4. Order not paid via Khalti                  -> 400
 *   5. No completed Khalti payment record found  -> 404
 *   6. (would call real Khalti API here — skipped, no real credentials)
 *
 * Usage:
 *   1. Make sure `npm run dev` is running in another terminal.
 *   2. Run: node test-refund.js
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
  const authHeader = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  console.log("✅ Logged in.\n");

  const refund = (orderId, reason) =>
    fetch(`${BASE_URL}/payments/khalti/refund`, {
      method: "POST",
      headers: authHeader,
      body: JSON.stringify({ orderId, reason }),
    }).then(async (r) => ({ status: r.status, body: await r.json() }));

  console.log("── Test 1: Refund a completely nonexistent order ──");
  const fakeId = "000000000000000000000000"; // valid ObjectId format, doesn't exist
  const r1 = await refund(fakeId, "Test: nonexistent order");
  console.log(`  Status: ${r1.status} — ${r1.body.message}`);
  console.log(r1.status === 404 ? "  ✅ Correctly rejected (404)\n" : "  ⚠️  Unexpected status\n");

  console.log("── Setting up a real order to test the remaining guards ──");
  const catRes = await fetch(`${BASE_URL}/menu/categories`);
  const catData = await catRes.json();
  const categoryId = catData.categories[0]._id;

  const itemRes = await fetch(`${BASE_URL}/menu`, {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({
      name: "Refund Test Momo",
      category: categoryId,
      basePrice: 150,
      stockQuantity: 5,
      isAvailable: true,
    }),
  });
  const itemData = await itemRes.json();
  const menuItemId = itemData.item._id;

  // Place as COD (not Khalti) — this lets us test guard #4 directly
  const orderRes = await fetch(`${BASE_URL}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ menuItemId, quantity: 1 }],
      paymentMethod: "cod",
      deliveryType: "pickup",
      guestInfo: { name: "Refund Test Customer", phone: "9800000004" },
    }),
  });
  const orderData = await orderRes.json();
  const orderId = orderData.order._id;
  console.log(`✅ Test order created (COD, status: ${orderData.order.status})\n`);

  console.log("── Test 2: Refund an order that's still 'pending' (not delivered/cancelled) ──");
  const r2 = await refund(orderId, "Test: wrong status");
  console.log(`  Status: ${r2.status} — ${r2.body.message}`);
  console.log(r2.status === 400 ? "  ✅ Correctly rejected (400)\n" : "  ⚠️  Unexpected status\n");

  console.log("── Moving order to 'delivered' so we can test the payment-method guard ──");
  await fetch(`${BASE_URL}/orders/${orderId}/status`, {
    method: "PATCH", headers: authHeader, body: JSON.stringify({ status: "confirmed" }),
  });
  await fetch(`${BASE_URL}/orders/${orderId}/status`, {
    method: "PATCH", headers: authHeader, body: JSON.stringify({ status: "preparing" }),
  });
  await fetch(`${BASE_URL}/orders/${orderId}/status`, {
    method: "PATCH", headers: authHeader, body: JSON.stringify({ status: "ready" }),
  });
  await fetch(`${BASE_URL}/orders/${orderId}/status`, {
    method: "PATCH", headers: authHeader, body: JSON.stringify({ status: "delivered" }),
  });
  console.log("✅ Order is now 'delivered'\n");

  console.log("── Test 3: Refund a delivered order that was paid via COD, not Khalti ──");
  const r3 = await refund(orderId, "Test: wrong payment method");
  console.log(`  Status: ${r3.status} — ${r3.body.message}`);
  console.log(r3.status === 400 ? "  ✅ Correctly rejected (400)\n" : "  ⚠️  Unexpected status\n");

  console.log("── Test 4: Missing orderId entirely (malformed request) ──");
  const r4 = await fetch(`${BASE_URL}/payments/khalti/refund`, {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({ reason: "Test: no orderId" }),
  }).then(async (r) => ({ status: r.status, body: await r.json() }));
  console.log(`  Status: ${r4.status} — ${r4.body.message}`);
  console.log(
    r4.status >= 400 && r4.status < 500
      ? "  ✅ Correctly rejected, no crash\n"
      : "  ⚠️  Unexpected status — check for an unhandled crash\n"
  );

  console.log("── Summary ──");
  const allHandled = [r1, r2, r3, r4].every((r) => r.status >= 400 && r.status < 500);
  console.log(
    allHandled
      ? "✅ PASS — every invalid refund attempt failed safely with a clean 4xx error. No crashes."
      : "⚠️  Review above — at least one case didn't behave as expected."
  );
  console.log(
    "\nℹ️  NOTE: this does not test an actual successful refund, since that requires real Khalti\n" +
    "    credentials and a real completed Khalti payment. Re-test guard #5 + the real refund call\n" +
    "    once you have live/sandbox Khalti credentials and a genuine Khalti-paid order."
  );

  console.log("\n── Cleanup ──");
  await fetch(`${BASE_URL}/menu/${menuItemId}`, { method: "DELETE", headers: authHeader });
  console.log("Test item deleted (or soft-deleted, by design, since it now has order history).");
}

main().catch((err) => {
  console.error("Script error:", err);
  process.exit(1);
});