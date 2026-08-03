require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const Category = require("./models/Category");
const MenuItem = require("./models/MenuItem");

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  // Clear existing data
  await Promise.all([User.deleteMany({}), Category.deleteMany({}), MenuItem.deleteMany({})]);
  console.log("Cleared existing data");

  // Create admin
  const admin = await User.create({
    name: "Admin",
    phone: "9800000001",
    password: "admin@123",
    role: "admin",
    isPhoneVerified: true,
  });
  console.log(`✅ Admin created: ${admin.phone} / admin@123`);

  // Create categories
  const categories = await Category.insertMany([
    { name: "Momo", description: "Nepal's beloved dumpling", sortOrder: 1 },
    { name: "Rice & Dal", description: "Traditional Nepali thali", sortOrder: 2 },
    { name: "Noodles", description: "Thukpa, chow mein & more", sortOrder: 3 },
    { name: "Snacks", description: "Chatpate, samosa & street food", sortOrder: 4 },
    { name: "Drinks", description: "Lassi, juice & hot drinks", sortOrder: 5 },
  ]);
  console.log(`✅ ${categories.length} categories created`);

  const [momo, rice, noodles, snacks, drinks] = categories;

  // Create menu items
  await MenuItem.insertMany([
    {
      name: "Buff Momo",
      description: "Juicy buffalo meat dumplings, steamed to perfection",
      category: momo._id,
      basePrice: 120,
      variants: [
        { name: "Half (8 pcs)", price: 120 },
        { name: "Full (16 pcs)", price: 220 },
      ],
      isSpicy: false,
      tags: ["bestseller"],
      isFeatured: true,
      preparationTime: 15,
    },
    {
      name: "Chicken Momo",
      description: "Tender chicken filling with house spices",
      category: momo._id,
      basePrice: 140,
      variants: [
        { name: "Half (8 pcs)", price: 140 },
        { name: "Full (16 pcs)", price: 260 },
      ],
      isFeatured: true,
      tags: ["popular"],
    },
    {
      name: "Veg Momo",
      description: "Fresh vegetable stuffed dumplings",
      category: momo._id,
      basePrice: 100,
      isVeg: true,
      isVegan: true,
    },
    {
      name: "C-Momo",
      description: "Crispy fried momo tossed in spicy sauce",
      category: momo._id,
      basePrice: 150,
      isSpicy: true,
      tags: ["spicy"],
    },
    {
      name: "Dal Bhat Set",
      description: "Traditional Nepali thali with dal, rice, tarkari, and pickle",
      category: rice._id,
      basePrice: 180,
      isVeg: true,
      tags: ["bestseller"],
      isFeatured: true,
      preparationTime: 20,
    },
    {
      name: "Chicken Thukpa",
      description: "Warm noodle soup with chicken and vegetables",
      category: noodles._id,
      basePrice: 160,
      preparationTime: 20,
    },
    {
      name: "Veg Chow Mein",
      description: "Stir-fried noodles with fresh vegetables",
      category: noodles._id,
      basePrice: 120,
      isVeg: true,
    },
    {
      name: "Chatpate",
      description: "Spicy puffed rice with vegetables and tangy sauce",
      category: snacks._id,
      basePrice: 60,
      isVeg: true,
      isSpicy: true,
      preparationTime: 5,
    },
    {
      name: "Masala Lassi",
      description: "Refreshing yogurt drink with a hint of spice",
      category: drinks._id,
      basePrice: 80,
      isVeg: true,
    },
  ]);

  console.log("✅ Menu items seeded");
  console.log("\n🎉 Database seeded successfully!");
  console.log("Admin login: phone=9800000001, password=admin@123");
  process.exit(0);
};

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
