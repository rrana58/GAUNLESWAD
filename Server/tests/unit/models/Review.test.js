const { connect, closeDatabase, clearDatabase } = require("../../setup/memoryDb");
const mongoose = require("mongoose");
const Review = require("../../../models/Review");

beforeAll(async () => await connect());
afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

describe("Review model", () => {
  it("creates a valid review", async () => {
    const r = await Review.create({
      order: new mongoose.Types.ObjectId(),
      foodRating: 5,
    });
    expect(r.isPublished).toBe(true);
  });

  it("requires order and foodRating", async () => {
    await expect(Review.create({})).rejects.toThrow();
    await expect(Review.create({ order: new mongoose.Types.ObjectId() })).rejects.toThrow();
  });

  it("rejects foodRating out of 1-5 range", async () => {
    await expect(
      Review.create({ order: new mongoose.Types.ObjectId(), foodRating: 6 })
    ).rejects.toThrow();
    await expect(
      Review.create({ order: new mongoose.Types.ObjectId(), foodRating: 0 })
    ).rejects.toThrow();
  });

  it("rejects deliveryRating out of range but allows it unset", async () => {
    await expect(
      Review.create({ order: new mongoose.Types.ObjectId(), foodRating: 4, deliveryRating: 10 })
    ).rejects.toThrow();
  });

  it("enforces comment maxlength of 500", async () => {
    const longComment = "a".repeat(501);
    await expect(
      Review.create({ order: new mongoose.Types.ObjectId(), foodRating: 3, comment: longComment })
    ).rejects.toThrow();
  });
});
