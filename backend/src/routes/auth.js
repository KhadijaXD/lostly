const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

// Optimized JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '7d';

// Helper function to generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Helper function to format user response
const formatUserResponse = (user) => ({
  id: user._id,
  _id: user._id,
  email: user.email,
  name: user.name,
  role: user.role,
  department: user.department,
  contactNumber: user.contactNumber
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, department, contactNumber } = req.body;

    // Quick validation
    if (!email || !password || !name || !department || !contactNumber) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists with optimized query
    const existingUser = await User.findOne({ email }).select('_id').lean();
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create new user
    const user = new User({
      email: email.toLowerCase().trim(),
      password,
      name: name.trim(),
      department: department.trim(),
      contactNumber: contactNumber.trim()
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      token,
      user: formatUserResponse(user)
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message || 'Registration failed' });
  }
});

// Optimized Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Quick validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user with optimized query (only get necessary fields)
    const user = await User.findOne({ 
      email: email.toLowerCase().trim() 
    }).select('+password'); // Explicitly include password field

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password with timeout handling
    let isMatch;
    try {
      isMatch = await user.comparePassword(password);
    } catch (error) {
      console.error('Password comparison error:', error);
      return res.status(500).json({ error: 'Authentication failed' });
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user._id);

    // Send response immediately
    res.json({
      token,
      user: formatUserResponse(user)
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// Optimized Get current user
router.get('/me', auth, async (req, res) => {
  try {
    // User is already attached to req by auth middleware, no need for additional query
    const user = req.user;
    res.json(formatUserResponse(user));
  } catch (error) {
    console.error('Get user error:', error);
    res.status(400).json({ error: 'Failed to get user data' });
  }
});

module.exports = router; 