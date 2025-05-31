const mongoose = require('mongoose');
const User = require('../models/User');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const resetPassword = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lostly');
    console.log('Connected to MongoDB');

    // Find the user
    const user = await User.findOne({ email: 'uswaejaz1@gmail.com' });
    if (!user) {
      console.log('User not found. Creating new user...');
      
      const newUser = new User({
        email: 'uswaejaz1@gmail.com',
        password: 'test',
        name: 'Uswae Jaz',
        role: 'student',
        department: 'Computer Science',
        contactNumber: '+1234567890'
      });
      
      await newUser.save();
      console.log('New user created successfully!');
    } else {
      console.log('User found. Resetting password...');
      user.password = 'test';
      await user.save();
      console.log('Password reset successfully!');
    }

    console.log('Email: uswaejaz1@gmail.com');
    console.log('Password: test');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

resetPassword(); 