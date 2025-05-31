const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['lost', 'found'],
    required: true
  },
  name: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['electronics', 'documents', 'accessories', 'clothing', 'other']
  },
  description: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  image: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'claimed', 'resolved'],
    default: 'active'
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  claimedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  claims: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    message: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Item', itemSchema); 