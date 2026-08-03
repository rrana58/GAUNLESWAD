const mongoose = require('mongoose'); 
mongoose.connect('mongodb://localhost:27017/gharko-swad').then(async () => { 
  const User = require('./models/User'); 
  const users = await User.find({}).select('+password'); 
  console.log(users.map(u => ({ phone: u.phone, email: u.email, role: u.role, isPhoneVerified: u.isPhoneVerified, hasPassword: !!u.password }))); 
  process.exit(0); 
});
