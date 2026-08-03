require("dotenv").config();
const mongoose = require("mongoose");
const MealPlan = require("./models/MealPlan");

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/gaunleswad", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB.");

    const db = mongoose.connection.db;
    const plansCollection = db.collection("mealplans");

    const plans = await plansCollection.find({ pricingOptions: { $exists: false } }).toArray();
    console.log(`Found ${plans.length} plans to migrate.`);

    for (const plan of plans) {
      if (plan.monthlyPrice) {
        const option = {
          meals: plan.maxMealsPerPeriod || 30,
          price: plan.monthlyPrice,
        };
        await plansCollection.updateOne(
          { _id: plan._id },
          { 
            $set: { pricingOptions: [option] },
            $unset: { monthlyPrice: "", maxMealsPerPeriod: "" }
          }
        );
        console.log(`Migrated plan: ${plan.name} -> ${option.meals} meals for Rs. ${option.price}`);
      }
    }

    console.log("Migration complete.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
