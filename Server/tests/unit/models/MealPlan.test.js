const { connect, closeDatabase, clearDatabase } = require("../../setup/memoryDb");
const mongoose = require("mongoose");
const MealPlan = require("../../../models/MealPlan");

beforeAll(async () => await connect());
afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

const twoItems = () => [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];

describe("MealPlan model", () => {
  it("creates a valid plan and generates slug", async () => {
    const plan = await MealPlan.create({
      name: "Weekly Saver Plan",
      pricingOptions: [{ meals: 30, price: 5000 }],
      items: twoItems(),
    });
    expect(plan.slug).toBe("weekly-saver-plan");
    expect(plan.isActive).toBe(true);
  });

  it("requires name and pricingOptions", async () => {
    await expect(MealPlan.create({ items: twoItems() })).rejects.toThrow();
  });

  it("rejects price below 100 in pricingOptions", async () => {
    await expect(
      MealPlan.create({ name: "Cheap", pricingOptions: [{ meals: 30, price: 50 }], items: twoItems() })
    ).rejects.toThrow();
  });

  it("rejects fewer than 2 items", async () => {
    await expect(
      MealPlan.create({
        name: "Too Few", pricingOptions: [{ meals: 30, price: 1000 }], items: [new mongoose.Types.ObjectId()],
      })
    ).rejects.toThrow(/between 2 and 15 items/);
  });

  it("rejects more than 15 items", async () => {
    const items = Array.from({ length: 16 }, () => new mongoose.Types.ObjectId());
    await expect(
      MealPlan.create({ name: "Too Many", pricingOptions: [{ meals: 30, price: 1000 }], items })
    ).rejects.toThrow(/between 2 and 15 items/);
  });

  it("enforces unique slug", async () => {
    await MealPlan.init();
    await MealPlan.create({ name: "Plan A", pricingOptions: [{ meals: 30, price: 1000 }], items: twoItems() });
    await expect(
      MealPlan.create({ name: "Plan A", pricingOptions: [{ meals: 30, price: 2000 }], items: twoItems() })
    ).rejects.toThrow();
  });
});
