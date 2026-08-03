const { connect, closeDatabase, clearDatabase } = require("../../setup/memoryDb");
const mongoose = require("mongoose");
const MenuItem = require("../../../models/MenuItem");

beforeAll(async () => await connect());
afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

const baseItem = () => ({
  name: "Chicken Momo",
  category: new mongoose.Types.ObjectId(),
  basePrice: 200,
});

describe("MenuItem model", () => {
  it("creates with required fields and defaults", async () => {
    const item = await MenuItem.create(baseItem());
    expect(item.isVeg).toBe(false);
    expect(item.isAvailable).toBe(true);
    expect(item.preparationTime).toBe(15);
  });

  it("auto-generates and truncates slug", async () => {
    const item = await MenuItem.create({ ...baseItem(), name: "Spicy Buff Momo Deluxe!!" });
    expect(item.slug).toBe("spicy-buff-momo-deluxe");
  });

  it("fails without name, category, or basePrice", async () => {
    await expect(MenuItem.create({})).rejects.toThrow();
    await expect(MenuItem.create({ name: "X" })).rejects.toThrow();
  });

  it("rejects negative basePrice", async () => {
    await expect(MenuItem.create({ ...baseItem(), basePrice: -10 })).rejects.toThrow();
  });

  describe("effectivePrice virtual", () => {
    it("returns basePrice when no variants", async () => {
      const item = await MenuItem.create(baseItem());
      expect(item.effectivePrice).toBe(200);
    });

    it("returns lowest available variant price", async () => {
      const item = await MenuItem.create({
        ...baseItem(),
        variants: [
          { name: "Half", price: 120, isAvailable: true },
          { name: "Full", price: 200, isAvailable: true },
        ],
      });
      expect(item.effectivePrice).toBe(120);
    });

    it("ignores unavailable variants", async () => {
      const item = await MenuItem.create({
        ...baseItem(),
        variants: [
          { name: "Half", price: 120, isAvailable: false },
          { name: "Full", price: 200, isAvailable: true },
        ],
      });
      expect(item.effectivePrice).toBe(200);
    });

    it("falls back to basePrice when all variants unavailable", async () => {
      const item = await MenuItem.create({
        ...baseItem(),
        variants: [{ name: "Half", price: 120, isAvailable: false }],
      });
      expect(item.effectivePrice).toBe(200);
    });
  });

  it("enforces unique slug index", async () => {
    await MenuItem.init();
    await MenuItem.create({ ...baseItem(), name: "Same Name" });
    await expect(MenuItem.create({ ...baseItem(), name: "Same Name" })).rejects.toThrow();
  });
});
