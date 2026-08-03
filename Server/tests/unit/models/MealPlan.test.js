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
      monthlyPrice: 5000,
      items: twoItems(),
    });
    expect(plan.slug).toBe("weekly-saver-plan");
    expect(plan.isActive).toBe(true);
    expect(plan.maxMealsPerPeriod).toBe(30);
  });

  it("requires name and monthlyPrice", async () => {
    await expect(MealPlan.create({ items: twoItems() })).rejects.toThrow();
  });

  it("rejects monthlyPrice below 100", async () => {
    await expect(
      MealPlan.create({ name: "Cheap", monthlyPrice: 50, items: twoItems() })
    ).rejects.toThrow(/Minimum plan price/);
  });

  it("rejects fewer than 2 items", async () => {
    await expect(
      MealPlan.create({
        name: "Too Few", monthlyPrice: 1000, items: [new mongoose.Types.ObjectId()],
      })
    ).rejects.toThrow(/between 2 and 15 items/);
  });

  it("rejects more than 15 items", async () => {
    const items = Array.from({ length: 16 }, () => new mongoose.Types.ObjectId());
    await expect(
      MealPlan.create({ name: "Too Many", monthlyPrice: 1000, items })
    ).rejects.toThrow(/between 2 and 15 items/);
  });

  it("enforces unique slug", async () => {
    await MealPlan.init();
    await MealPlan.create({ name: "Plan A", monthlyPrice: 1000, items: twoItems() });
    await expect(
      MealPlan.create({ name: "Plan A", monthlyPrice: 2000, items: twoItems() })
    ).rejects.toThrow();
  });
});
