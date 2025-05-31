const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  read: {
    type: Boolean,
    default: false
  }
});

const chatSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  claimId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  messages: [messageSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Ensure only two participants per chat
chatSchema.pre('save', function(next) {
  if (this.participants.length !== 2) {
    return next(new Error('Chat must have exactly 2 participants'));
  }
  next();
});

// Index for efficient querying
chatSchema.index({ itemId: 1, claimId: 1 });
chatSchema.index({ participants: 1 });

// Method to check if user is authorized to access this chat
chatSchema.methods.isAuthorized = function(userId) {
  return this.participants.some(participantId => participantId.toString() === userId.toString());
};

// Method to add a message
chatSchema.methods.addMessage = function(senderId, content) {
  if (!this.isAuthorized(senderId)) {
    throw new Error('Unauthorized to send message');
  }
  
  this.messages.push({
    sender: senderId,
    content: content
  });
  
  this.lastActivity = new Date();
  return this.save();
};

// Method to mark messages as read
chatSchema.methods.markMessagesAsRead = function(userId) {
  this.messages.forEach(message => {
    if (message.sender.toString() !== userId.toString()) {
      message.read = true;
    }
  });
  return this.save();
};

module.exports = mongoose.model('Chat', chatSchema); 