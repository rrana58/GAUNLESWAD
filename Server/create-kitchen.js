const mongoose = require('mongoose'); 
mongoose.connect('mongodb://localhost:27017/gharko-swad').then(async () => { 
  const User = require('./models/User'); 
  const user = await User.create({
    name: "Test Kitchen",
    phone: "9800000002",
    email: "kitchen@example.com",
    password: "password123",
    role: "kitchen",
    isActive: true,
    isPhoneVerified: true
  }).catch(async (e) => {
    if (e.code === 11000) {
      const u = await User.findOne({ phone: "9800000002" });
      u.password = "password123";
      u.role = "kitchen";
      u.isPhoneVerified = true;
      await u.save();
      return u;
    }
    throw e;
  });
  console.log("Created/Updated kitchen: 9800000002 with password: password123");
  process.exit(0); 
}).catch(console.error);
