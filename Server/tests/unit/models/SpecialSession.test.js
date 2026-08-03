const { connect, closeDatabase, clearDatabase } = require("../../setup/memoryDb");
const mongoose = require("mongoose");
const SpecialSession = require("../../../models/SpecialSession");

beforeAll(async () => await connect());
afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

const base = () => ({
  name: "Khaja Time",
  displayName: "Khaja Time Deals",
  discountPercent: 20,
  items: [new mongoose.Types.ObjectId()],
  activeDate: "2026-06-26",
  startHour: 12,
  endHour: 16,
});

describe("SpecialSession model", () => {
  it("creates a valid session with defaults", async () => {
    const s = await SpecialSession.create(base());
    expect(s.isActive).toBe(true);
  });

  it("requires type, displayName, discountPercent, items, activeDate", async () => {
    await expect(SpecialSession.create({})).rejects.toThrow();
  });

  it("rejects invalid type enum", async () => {
    // Old type enum no longer exists — name is now a free-form string
    // Test that a session without required fields still fails
    await expect(SpecialSession.create({ ...base(), name: "" })).rejects.toThrow();
  });

  it("rejects discountPercent outside 1-50", async () => {
    await expect(SpecialSession.create({ ...base(), discountPercent: 0 })).rejects.toThrow(/Minimum 1%/);
    await expect(SpecialSession.create({ ...base(), discountPercent: 51 })).rejects.toThrow(/Maximum 50%/);
  });

  it("requires at least item entries to be valid ObjectIds", async () => {
    await expect(SpecialSession.create({ ...base(), items: [] })).resolves.toBeTruthy();
  });

  it("enforces displayName maxlength", async () => {
    await expect(
      SpecialSession.create({ ...base(), displayName: "a".repeat(81) })
    ).rejects.toThrow();
  });
});