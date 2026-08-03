/**
 * test-concurrency.js
 *
 * Integration test: confirms that B's atomic stock-decrement + transaction
 * logic actually prevents overselling when multiple customers order the
 * same low-stock item simultaneously.
 *
 * Usage:
 *   1. Make sure `npm run dev` is running in another terminal.
 *   2. Run: node test-concurrency.js
 *
 * What it does:
 *   1. Logs in as admin.
 *   2. Fetches an existing category (from your seed data).
 *   3. Creates a test menu item with stockQuantity = 2.
 *   4. Fires 5 simultaneous "place order" requests for 1 unit each.
 *   5. Reports how many succeeded vs failed, and the final stock level.
 *
 * Expected (correct) result: exactly 2 orders succeed, 3 fail with a
 * "ran out of stock" 409 error, and final stockQuantity = 0.
 * If all 5 succeed, the concurrency fix is NOT working — overselling occurred.
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
  console.log("✅ Logged in.\n");

  console.log("── Step 2: Fetching a category ──");
  const catRes = await fetch(`${BASE_URL}/menu/categories`);
  const catData = await catRes.json();
  const categories = catData.categories || [];
  if (!categories.length) {
    console.error("❌ No categories found — did you run `node seed.js`?");
    process.exit(1);
  }
  const categoryId = categories[0]._id;
  console.log(`✅ Using category: ${categories[0].name} (${categoryId})\n`);

  console.log("── Step 3: Creating a test menu item with stockQuantity = 2 ──");
  const itemRes = await fetch(`${BASE_URL}/menu`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: "Concurrency Test Momo",
      category: categoryId,
      basePrice: 150,
      stockQuantity: 2,
      isAvailable: true,
    }),
  });
  const itemData = await itemRes.json();
  if (!itemData.success) {
    console.error("❌ Failed to create test item:", itemData.message);
    process.exit(1);
  }
  const menuItemId = itemData.item._id;
  console.log(`✅ Created test item: ${menuItemId} (stock = 2)\n`);

  console.log("── Step 4: Firing 5 simultaneous orders for 1 unit each ──");
  const placeOrder = (i) =>
    fetch(`${BASE_URL}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ menuItemId, quantity: 1 }],
        paymentMethod: "cod",
        deliveryType: "pickup",
        guestInfo: { name: `Test Customer ${i}`, phone: "9800000002" },
      }),
    }).then(async (r) => ({ i, status: r.status, body: await r.json() }));

  const results = await Promise.all([1, 2, 3, 4, 5].map(placeOrder));

  let succeeded = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status >= 200 && r.status < 300) {
      succeeded++;
      console.log(`  ✅ Order #${r.i}: SUCCESS (${r.status})`);
    } else {
      failed++;
      console.log(`  ❌ Order #${r.i}: REJECTED (${r.status}) — ${r.body.message}`);
    }
  }

  console.log(`\n── Result: ${succeeded} succeeded, ${failed} rejected ──\n`);

  console.log("── Step 5: Checking final stock level ──");
  const finalRes = await fetch(`${BASE_URL}/menu/${menuItemId}`);
  const finalData = await finalRes.json();
  const finalStock = finalData.item?.stockQuantity;
  console.log(`Final stockQuantity: ${finalStock}\n`);

  if (succeeded === 2 && finalStock === 0) {
    console.log("✅ PASS — exactly 2 orders succeeded, stock correctly hit 0. No overselling.");
  } else if (succeeded > 2) {
    console.log(`❌ FAIL — ${succeeded} orders succeeded for only 2 units of stock. Overselling occurred!`);
  } else {
    console.log(`⚠️  Unexpected result — review manually. Succeeded: ${succeeded}, final stock: ${finalStock}`);
  }

  console.log("\n── Cleanup ──");
  await fetch(`${BASE_URL}/menu/${menuItemId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log("Test item deleted (or soft-deleted if it has order history, by design).");
}

main().catch((err) => {
  console.error("Script error:", err);
  process.exit(1);
});
