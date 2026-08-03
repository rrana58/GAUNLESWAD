const mongoose = require('mongoose'); 
mongoose.connect('mongodb://localhost:27017/gharko-swad').then(async () => { 
  const User = require('./models/User'); 
  const user = await User.findOne({ phone: "9800000001" }).select("+password");
  if (user) {
    user.isPhoneVerified = true;
    user.role = "delivery";
    user.isActive = true;
    user.password = "password123";
    await user.save();
    console.log("Updated rider: 9800000001 with password: password123");
  }
  process.exit(0); 
}).catch(console.error);
