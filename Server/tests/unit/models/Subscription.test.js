const { connect, closeDatabase, clearDatabase } = require("../../setup/memoryDb");
const mongoose = require("mongoose");
const Subscription = require("../../../models/Subscription");

beforeAll(async () => await connect());
afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

const base = (overrides = {}) => ({
  customer: new mongoose.Types.ObjectId(),
  plan: new mongoose.Types.ObjectId(),
  pricePaid: 5000,
  maxMeals: 30,
  ...overrides,
});

describe("Subscription model", () => {
  it("creates with default status pending", async () => {
    const sub = await Subscription.create(base());
    expect(sub.status).toBe("pending");
    expect(sub.mealsUsed).toBe(0);
  });

  it("requires customer, plan, pricePaid, maxMeals", async () => {
    await expect(Subscription.create({})).rejects.toThrow();
  });

  describe("isEligibleForMeal", () => {
    it("returns false when not active", () => {
      const sub = new Subscription(base({ status: "pending" }));
      expect(sub.isEligibleForMeal()).toBe(false);
    });

    it("returns false when mealsUsed >= maxMeals", () => {
      const sub = new Subscription(base({ status: "active", mealsUsed: 30, maxMeals: 30 }));
      expect(sub.isEligibleForMeal()).toBe(false);
    });

    it("returns false when endDate has passed", () => {
      const sub = new Subscription(
        base({ status: "active", endDate: new Date(Date.now() - 1000) })
      );
      expect(sub.isEligibleForMeal()).toBe(false);
    });

    it("returns true when active, under limit, and not expired", () => {
      const sub = new Subscription(
        base({ status: "active", mealsUsed: 5, endDate: new Date(Date.now() + 100000) })
      );
      expect(sub.isEligibleForMeal()).toBe(true);
    });
  });

  describe("hasUsedMealToday", () => {
    it("detects existing usage date", () => {
      const sub = new Subscription(
        base({ mealUsages: [{ usageDate: "2026-06-26", menuItem: new mongoose.Types.ObjectId() }] })
      );
      expect(sub.hasUsedMealToday("2026-06-26")).toBe(true);
      expect(sub.hasUsedMealToday("2026-06-25")).toBe(false);
    });
  });

  describe("isItemInPlan", () => {
    it("matches ObjectId membership by string comparison", () => {
      const sub = new Subscription(base());
      const itemId = new mongoose.Types.ObjectId();
      const planItems = [itemId, new mongoose.Types.ObjectId()];
      expect(sub.isItemInPlan(itemId, planItems)).toBe(true);
      expect(sub.isItemInPlan(new mongoose.Types.ObjectId(), planItems)).toBe(false);
    });
  });
});
