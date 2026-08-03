const { connect, closeDatabase, clearDatabase } = require("../../setup/memoryDb");
const Coupon = require("../../../models/Coupon");

beforeAll(async () => await connect());
afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

describe("Coupon model", () => {
  it("creates a valid flat coupon", async () => {
    const c = await Coupon.create({ code: "save50", discountType: "flat", discountValue: 50 });
    expect(c.code).toBe("SAVE50"); // uppercase transform
    expect(c.isActive).toBe(true);
    expect(c.usedCount).toBe(0);
  });

  it("requires discountType and discountValue", async () => {
    await expect(Coupon.create({ code: "X" })).rejects.toThrow();
  });

  it("rejects negative discountValue", async () => {
    await expect(
      Coupon.create({ code: "NEG", discountType: "flat", discountValue: -5 })
    ).rejects.toThrow();
  });

  it("enforces unique code index", async () => {
    await Coupon.init();
    await Coupon.create({ code: "DUP", discountType: "flat", discountValue: 10 });
    await expect(
      Coupon.create({ code: "dup", discountType: "flat", discountValue: 20 })
    ).rejects.toThrow();
  });

  describe("calculateDiscount", () => {
    it("flat: caps discount at order amount", async () => {
      const c = new Coupon({ code: "F", discountType: "flat", discountValue: 100 });
      expect(c.calculateDiscount(50)).toBe(50);
      expect(c.calculateDiscount(200)).toBe(100);
    });

    it("percentage: computes percent of amount", async () => {
      const c = new Coupon({ code: "P", discountType: "percentage", discountValue: 10 });
      expect(c.calculateDiscount(1000)).toBe(100);
    });

    it("percentage: caps at maxDiscount when set", async () => {
      const c = new Coupon({
        code: "P2", discountType: "percentage", discountValue: 50, maxDiscount: 100,
      });
      expect(c.calculateDiscount(1000)).toBe(100);
    });

    it("percentage: no cap applied when maxDiscount unset", async () => {
      const c = new Coupon({ code: "P3", discountType: "percentage", discountValue: 50 });
      expect(c.calculateDiscount(1000)).toBe(500);
    });
  });
});
