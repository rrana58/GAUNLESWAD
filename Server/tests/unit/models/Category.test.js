const { connect, closeDatabase, clearDatabase } = require("../../setup/memoryDb");
const Category = require("../../../models/Category");

beforeAll(async () => await connect());
afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

describe("Category model", () => {
  it("creates a category with defaults", async () => {
    const cat = await Category.create({ name: "Main Course" });
    expect(cat.isActive).toBe(true);
    expect(cat.sortOrder).toBe(0);
  });

  it("auto-generates slug from name on save", async () => {
    const cat = await Category.create({ name: "Spicy Noodles & Rice!" });
    expect(cat.slug).toBe("spicy-noodles-rice");
  });

  it("regenerates slug only when name is modified", async () => {
    const cat = await Category.create({ name: "Drinks" });
    expect(cat.slug).toBe("drinks");
    cat.description = "Cold and hot drinks";
    await cat.save();
    expect(cat.slug).toBe("drinks");
    cat.name = "Beverages";
    await cat.save();
    expect(cat.slug).toBe("beverages");
  });

  it("fails validation without a name", async () => {
    await expect(Category.create({})).rejects.toThrow(/Category name is required/);
  });

  it("trims whitespace from name", async () => {
    const cat = await Category.create({ name: "  Snacks  " });
    expect(cat.name).toBe("Snacks");
  });
});
