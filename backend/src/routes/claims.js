const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const { auth } = require('../middleware/auth');

// Get user's claims
router.get('/my-claims', auth, async (req, res) => {
  try {
    const items = await Item.find({
      'claims.user': req.user._id
    }).populate('postedBy', 'name email');

    const claims = items.map(item => ({
      item,
      claim: item.claims.find(claim => claim.user.toString() === req.user._id.toString())
    }));

    res.json(claims);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get claims for user's items
router.get('/my-items-claims', auth, async (req, res) => {
  try {
    const items = await Item.find({
      postedBy: req.user._id,
      'claims.0': { $exists: true }
    }).populate('claims.user', 'name email');

    res.json(items);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update claim status
router.patch('/:itemId/claims/:claimId', auth, async (req, res) => {
  try {
    const item = await Item.findById(req.params.itemId);
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (item.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const claim = item.claims.id(req.params.claimId);
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    claim.status = req.body.status;
    if (req.body.status === 'approved') {
      item.status = 'claimed';
      item.claimedBy = claim.user;
    }

    await item.save();
    res.json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router; 