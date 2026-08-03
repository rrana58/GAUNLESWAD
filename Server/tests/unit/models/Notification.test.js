const { connect, closeDatabase, clearDatabase } = require("../../setup/memoryDb");
const mongoose = require("mongoose");
const Notification = require("../../../models/Notification");

beforeAll(async () => await connect());
afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

describe("Notification model", () => {
  it("creates with required fields and defaults", async () => {
    const n = await Notification.create({
      user: new mongoose.Types.ObjectId(),
      title: "Order update",
      body: "Your order is on the way",
    });
    expect(n.type).toBe("order_update");
    expect(n.isRead).toBe(false);
  });

  it("fails without title or body", async () => {
    await expect(Notification.create({ user: new mongoose.Types.ObjectId() })).rejects.toThrow();
  });

  it("rejects invalid type enum", async () => {
    await expect(
      Notification.create({ title: "t", body: "b", type: "invalid" })
    ).rejects.toThrow();
  });

  it("rejects invalid sentVia enum values", async () => {
    await expect(
      Notification.create({ title: "t", body: "b", sentVia: ["carrier_pigeon"] })
    ).rejects.toThrow();
  });

  it("accepts arbitrary data payload via Mixed type", async () => {
    const n = await Notification.create({
      title: "t", body: "b", data: { orderId: "abc123", nested: { x: 1 } },
    });
    expect(n.data.orderId).toBe("abc123");
  });
});
