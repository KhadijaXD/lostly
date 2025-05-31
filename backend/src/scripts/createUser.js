const mongoose = require('mongoose');
const User = require('../models/User');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const createUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lostly');
    console.log('Connected to MongoDB');

    // Check if user already exists
    const existingUser = await User.findOne({ email: 'uswaejaz1@gmail.com' });
    if (existingUser) {
      console.log('User already exists:', existingUser.email);
      process.exit(0);
    }

    // Create user account
    const user = new User({
      email: 'uswaejaz1@gmail.com',
      password: 'test',  // This will be hashed automatically
      name: 'Uswae Jaz',
      role: 'student',
      department: 'Computer Science',
      contactNumber: '+1234567890'
    });

    await user.save();
    console.log('User account created successfully!');
    console.log('Email: uswaejaz1@gmail.com');
    console.log('Password: test');

  } catch (error) {
    console.error('Error creating user:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

createUser(); 