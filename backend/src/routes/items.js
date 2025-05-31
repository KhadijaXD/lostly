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
  console.log('POST /api/items called');
  try {
    if (req.fileValidationError) {
      console.error('File validation error:', req.fileValidationError);
      return res.status(400).json({ error: req.fileValidationError });
    }

    if (!req.file) {
      console.error('No image file uploaded');
      return res.status(400).json({ error: 'Image is required' });
    }

    const normalizedImagePath = req.file.path.replace(/\\/g, '/');
    const item = new Item({
      ...req.body,
      image: normalizedImagePath,
      postedBy: req.user._id
    });

    await item.save();
    res.status(201).json(item);
  } catch (error) {
    console.error('Error in POST /api/items:', error);
    // Delete uploaded file if item creation fails
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(400).json({ error: error.message || 'Unknown error' });
  }
});

// Debug endpoint to check database content
router.get('/debug/database', async (req, res) => {
  try {
    const items = await Item.find({});
    const debugInfo = items.map(item => ({
      id: item._id,
      name: item.name,
      image: item.image,
      imageType: typeof item.image,
      createdAt: item.createdAt
    }));
    
    console.log('Debug database content:', debugInfo);
    res.json(debugInfo);
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all items with filters
router.get('/', async (req, res) => {
  console.log('🔍 GET /api/items called with query:', req.query);
  try {
    const { type, category, status, postedBy } = req.query;
    const query = {};

    if (type) query.type = type;
    if (category) query.category = category;
    if (status) query.status = status;
    if (postedBy) query.postedBy = postedBy;

    // Exclude resolved items from public listings (unless specifically requested)
    if (!status) {
      query.status = { $ne: 'resolved' };
    }

    console.log('📋 Database query:', query);

    const items = await Item.find(query)
      .populate('postedBy', 'name email')
      .sort({ createdAt: -1 });

    console.log('📊 Query results:', {
      totalFound: items.length,
      statusBreakdown: items.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {}),
      requestedStatus: status || 'all'
    });

    // Debug: log the first item's image path
    if (items.length > 0) {
      console.log('🖼️ First item image path:', items[0].image);
      console.log('🔍 First item details:', {
        name: items[0].name,
        status: items[0].status,
        type: items[0].type
      });
    }

    res.json(items);
  } catch (error) {
    console.error('❌ Error in GET /api/items:', error);
    res.status(400).json({ error: error.message || 'Unknown error' });
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
      const normalizedImagePath = req.file.path.replace(/\\/g, '/');
      req.body.image = normalizedImagePath;
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
  console.log('🎯 Claim request for item:', req.params.id, 'by user:', req.user._id);
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
      return res.status(400).json({ error: 'You have already claimed this item' });
    }

    // Add the claim with comprehensive information
    const newClaim = {
      user: req.user._id,
      message: req.body.message,
      status: 'pending',
      claimantInfo: {
        contactNumber: req.body.contactNumber,
        email: req.body.email,
        proofDescription: req.body.proofDescription,
        uniqueFeatures: req.body.uniqueFeatures,
        additionalProof: req.body.additionalProof
      }
    };

    item.claims.push(newClaim);

    // If this is a found item, automatically change status to claimed
    if (item.status === 'found') {
      item.status = 'claimed';
      item.claimedBy = req.user._id;
      console.log('✅ Item status changed to claimed for found item');
    }

    await item.save();
    
    await item.populate('postedBy', 'name email');
    await item.populate('claims.user', 'name email');
    
    console.log('✅ Claim successfully added');
    res.json(item);
  } catch (error) {
    console.error('❌ Error in claim endpoint:', error);
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

// Report item as found
router.patch('/:id/report-found', auth, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (item.status !== 'active') {
      return res.status(400).json({ error: 'Item is not available to be reported as found' });
    }

    // Update item status to found
    item.status = 'found';
    
    // Add finder information as a claim
    item.claims.push({
      user: req.user._id,
      status: 'pending',
      message: req.body.message || 'Item reported as found',
      finderInfo: {
        contactNumber: req.body.contactNumber,
        email: req.body.email,
        locationFound: req.body.locationFound,
        dateFound: req.body.dateFound,
        additionalDetails: req.body.additionalDetails
      }
    });

    await item.save();
    
    await item.populate('postedBy', 'name email');
    await item.populate('claims.user', 'name email');
    
    res.json(item);
  } catch (error) {
    console.error('Error reporting item as found:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router; 