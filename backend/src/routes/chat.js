const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const Item = require('../models/Item');
const { auth } = require('../middleware/auth');

// Get or create chat for a specific claim
router.get('/item/:itemId/claim/:claimId', auth, async (req, res) => {
  try {
    const { itemId, claimId } = req.params;
    const userId = req.user.id;

    // Verify the item exists and user is involved
    const item = await Item.findById(itemId).populate('claims.user');
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Find the specific claim
    const claim = item.claims.id(claimId);
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    // Check if user is either the item owner or the claimer
    const isItemOwner = item.postedBy.toString() === userId;
    const isClaimer = claim.user._id.toString() === userId;

    if (!isItemOwner && !isClaimer) {
      return res.status(403).json({ error: 'Unauthorized access to this chat' });
    }

    // Check if claim is approved
    if (claim.status !== 'approved') {
      return res.status(403).json({ error: 'Chat only available for approved claims' });
    }

    // Find existing chat or create new one
    let chat = await Chat.findOne({
      itemId: itemId,
      claimId: claimId
    }).populate('participants', 'name email').populate('messages.sender', 'name');

    if (!chat) {
      // Create new chat
      chat = new Chat({
        itemId: itemId,
        claimId: claimId,
        participants: [item.postedBy, claim.user._id]
      });
      await chat.save();
      await chat.populate('participants', 'name email');
      await chat.populate('messages.sender', 'name');
    }

    // Verify user is authorized for this chat
    if (!chat.isAuthorized(userId)) {
      return res.status(403).json({ error: 'Unauthorized access to this chat' });
    }

    res.json({
      chat: {
        _id: chat._id,
        itemId: chat.itemId,
        claimId: chat.claimId,
        participants: chat.participants,
        messages: chat.messages,
        lastActivity: chat.lastActivity
      }
    });

  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send a message
router.post('/:chatId/messages', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    if (content.trim().length > 1000) {
      return res.status(400).json({ error: 'Message too long (max 1000 characters)' });
    }

    const chat = await Chat.findById(chatId).populate('messages.sender', 'name');
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    if (!chat.isAuthorized(userId)) {
      return res.status(403).json({ error: 'Unauthorized access to this chat' });
    }

    if (!chat.isActive) {
      return res.status(403).json({ error: 'Chat is no longer active' });
    }

    await chat.addMessage(userId, content.trim());
    await chat.populate('messages.sender', 'name');

    const newMessage = chat.messages[chat.messages.length - 1];

    res.json({
      message: newMessage
    });

  } catch (error) {
    console.error('Send message error:', error);
    if (error.message === 'Unauthorized to send message') {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark messages as read
router.patch('/:chatId/read', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    if (!chat.isAuthorized(userId)) {
      return res.status(403).json({ error: 'Unauthorized access to this chat' });
    }

    await chat.markMessagesAsRead(userId);

    res.json({ success: true });

  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's chats
router.get('/user', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const chats = await Chat.find({
      participants: userId,
      isActive: true
    })
    .populate('itemId', 'name type status')
    .populate('participants', 'name email')
    .sort({ lastActivity: -1 });

    res.json({ chats });

  } catch (error) {
    console.error('Get user chats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 