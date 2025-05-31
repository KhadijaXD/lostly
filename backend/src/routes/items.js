const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Item = require('../models/Item');
const { auth, adminAuth } = require('../middleware/auth');

// Configure multer for image upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept images only
  if (!file.originalname.match(/\.(jpg|JPG|jpeg|JPEG|png|PNG|gif|GIF)$/)) {
    req.fileValidationError = 'Only image files are allowed!';
    return cb(new Error('Only image files are allowed!'), false);
  }
  cb(null, true);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  }
});

// Helper function to delete old image
const deleteOldImage = async (itemId) => {
  try {
    const item = await Item.findById(itemId);
    if (item && item.image) {
      const imagePath = path.join(__dirname, '../../', item.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
  } catch (error) {
    console.error('Error deleting old image:', error);
  }
};

// Create new item
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    if (req.fileValidationError) {
      return res.status(400).json({ error: req.fileValidationError });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Image is required' });
    }

    const item = new Item({
      ...req.body,
      image: req.file.path,
      postedBy: req.user._id
    });

    await item.save();
    res.status(201).json(item);
  } catch (error) {
    // Delete uploaded file if item creation fails
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(400).json({ error: error.message });
  }
});

// Get all items with filters
router.get('/', async (req, res) => {
  try {
    const { type, category, status, postedBy } = req.query;
    const query = {};

    if (type) query.type = type;
    if (category) query.category = category;
    if (status) query.status = status;
    if (postedBy) query.postedBy = postedBy;

    const items = await Item.find(query)
      .populate('postedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(items);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get single item
router.get('/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
      .populate('postedBy', 'name email')
      .populate('claimedBy', 'name email')
      .populate('claims.user', 'name email');

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update item
router.patch('/:id', auth, upload.single('image'), async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (item.postedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (req.file) {
      // Delete old image
      await deleteOldImage(item._id);
      req.body.image = req.file.path;
    }

    Object.assign(item, req.body);
    await item.save();
    res.json(item);
  } catch (error) {
    // Delete uploaded file if update fails
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(400).json({ error: error.message });
  }
});

// Delete item
router.delete('/:id', auth, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (item.postedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Delete associated image
    await deleteOldImage(item._id);
    await item.remove();
    res.json({ message: 'Item deleted' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Claim item
router.post('/:id/claim', auth, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (item.postedBy.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot claim your own item' });
    }

    const existingClaim = item.claims.find(
      claim => claim.user.toString() === req.user._id.toString()
    );

    if (existingClaim) {
      return res.status(400).json({ error: 'Already claimed this item' });
    }

    item.claims.push({
      user: req.user._id,
      message: req.body.message
    });

    await item.save();
    res.json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update claim status
router.patch('/:id/claims/:claimId', auth, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (item.postedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
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