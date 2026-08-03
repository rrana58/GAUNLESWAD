const mongoose = require('mongoose'); 
mongoose.connect('mongodb://localhost:27017/gharko-swad').then(async () => { 
  const User = require('./models/User'); 
  const user = await User.create({
    name: "Test Rider",
    phone: "9800000001",
    email: "rider@example.com",
    password: "password123",
    role: "delivery",
    isActive: true,
    isPhoneVerified: true
  });
  console.log("Created rider:", user.phone);
  process.exit(0); 
}).catch(console.error);
