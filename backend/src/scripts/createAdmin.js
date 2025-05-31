const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const createAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lostly');
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.email);
      process.exit(0);
    }

    // Create admin user
    const adminUser = new User({
      email: 'admin@lostly.com',
      password: 'admin123',  // This will be hashed automatically
      name: 'System Administrator',
      role: 'admin',
      department: 'Administration',
      contactNumber: '+1234567890'
    });

    await adminUser.save();
    console.log('Admin user created successfully!');
    console.log('Email: admin@lostly.com');
    console.log('Password: admin123');
    console.log('Please change the password after first login');

  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

createAdmin(); 