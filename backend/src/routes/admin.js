const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const User = require('../models/User');
const { adminAuth } = require('../middleware/auth');

// Get all items for admin (including resolved ones)
router.get('/items', adminAuth, async (req, res) => {
  try {
    const items = await Item.find({})
      .populate('postedBy', 'name email role department')
      .populate('claimedBy', 'name email')
      .populate('claims.user', 'name email')
      .sort({ createdAt: -1 });

    res.json(items);
  } catch (error) {
    console.error('Error fetching admin items:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get all users for admin
router.get('/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get dashboard statistics
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const totalItems = await Item.countDocuments();
    const lostItems = await Item.countDocuments({ type: 'lost' });
    const foundItems = await Item.countDocuments({ type: 'found' });
    const claimedItems = await Item.countDocuments({ status: 'claimed' });
    const resolvedItems = await Item.countDocuments({ status: 'resolved' });
    const totalUsers = await User.countDocuments();
    
    // Get pending claims count
    const itemsWithClaims = await Item.find({ 'claims.status': 'pending' });
    const pendingClaims = itemsWithClaims.reduce((total, item) => {
      return total + item.claims.filter(claim => claim.status === 'pending').length;
    }, 0);

    res.json({
      totalItems,
      lostItems,
      foundItems,
      claimedItems,
      resolvedItems,
      totalUsers,
      pendingClaims
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(400).json({ error: error.message });
  }
});

// Admin approve/reject claim
router.patch('/claims/:itemId/:claimId', adminAuth, async (req, res) => {
  try {
    const { itemId, claimId } = req.params;
    const { status } = req.body;

    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const claim = item.claims.id(claimId);
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    claim.status = status;
    
    // If approved, set item status to claimed/resolved and remove from public listings
    if (status === 'approved') {
      item.status = 'resolved';  // Mark as resolved to remove from public view
      item.claimedBy = claim.user;
    }

    await item.save();
    
    await item.populate('postedBy', 'name email');
    await item.populate('claims.user', 'name email');
    
    res.json(item);
  } catch (error) {
    console.error('Error updating claim status:', error);
    res.status(400).json({ error: error.message });
  }
});

// Admin delete item
router.delete('/items/:id', adminAuth, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Delete associated image if it exists
    const fs = require('fs');
    const path = require('path');
    if (item.image) {
      const imagePath = path.join(__dirname, '../../', item.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await Item.findByIdAndDelete(req.params.id);
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(400).json({ error: error.message });
  }
});

// Admin update user role
router.patch('/users/:id/role', adminAuth, async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!['student', 'staff', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router; 