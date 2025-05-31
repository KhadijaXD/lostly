const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['student', 'staff', 'admin'],
    default: 'student'
  },
  department: {
    type: String,
    required: true
  },
  contactNumber: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    // Reduced salt rounds from 10 to 8 for faster hashing while maintaining security
    const salt = await bcrypt.genSalt(8);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Optimized method to compare password with timeout
userSchema.methods.comparePassword = async function(candidatePassword) {
  // Add a timeout to prevent hanging password comparisons
  return Promise.race([
    bcrypt.compare(candidatePassword, this.password),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Password comparison timeout')), 5000)
    )
  ]);
};

module.exports = mongoose.model('User', userSchema); 