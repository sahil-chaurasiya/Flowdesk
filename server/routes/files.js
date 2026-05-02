const express = require('express');
const router = express.Router();
const path = require('path');
const File = require('../models/File');
const Client = require('../models/Client');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { getUploader } = require('../config/cloudinary');
const { createNotification } = require('../utils/notifications');

// @route GET /api/files
router.get('/', protect, asyncHandler(async (req, res) => {
  const { clientId, category, page = 1, limit = 20 } = req.query;
  const query = {};

  if (req.user.role === 'client') {
    query.client = req.user.clientId;
    query.isPublic = true;
  } else if (clientId) {
    query.client = clientId;
  }

  if (category) query.category = category;

  const total = await File.countDocuments(query);
  const files = await File.find(query)
    .populate('uploadedBy', 'name avatar')
    .populate('client', 'name company')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.json({ success: true, files, total });
}));

// @route POST /api/files/upload
router.post('/upload', protect, authorize('admin', 'manager', 'team'), asyncHandler(async (req, res) => {
  const upload = getUploader();

  upload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided' });
    }

    const isCloudinary = process.env.FILE_STORAGE === 'cloudinary';
    const fileUrl = isCloudinary
      ? req.file.path
      : `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    const file = await File.create({
      client: req.body.clientId,
      uploadedBy: req.user._id,
      name: req.body.name || req.file.originalname,
      originalName: req.file.originalname,
      url: fileUrl,
      mimeType: req.file.mimetype,
      size: req.file.size,
      category: req.body.category || 'other',
      description: req.body.description,
      tags: req.body.tags ? JSON.parse(req.body.tags) : [],
      isPublic: req.body.isPublic !== 'false',
      cloudinaryId: isCloudinary ? req.file.filename : null,
      storageType: isCloudinary ? 'cloudinary' : 'local'
    });

    const populated = await File.findById(file._id)
      .populate('uploadedBy', 'name avatar')
      .populate('client', 'name company');

    // Notify client
    const client = await Client.findById(req.body.clientId);
    if (client?.linkedUserId) {
      await createNotification(client.linkedUserId, {
        type: 'file',
        title: 'New File Uploaded',
        body: `${req.user.name} uploaded: ${file.name}`,
        link: `/files`
      });
    }

    res.status(201).json({ success: true, file: populated });
  });
}));

// @route GET /api/files/:id
router.get('/:id', protect, asyncHandler(async (req, res) => {
  const file = await File.findById(req.params.id)
    .populate('uploadedBy', 'name avatar')
    .populate('client', 'name company');

  if (!file) return res.status(404).json({ success: false, message: 'File not found' });

  if (req.user.role === 'client') {
    if (String(file.client._id) !== String(req.user.clientId) || !file.isPublic) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
  }

  // Increment download count
  await File.findByIdAndUpdate(req.params.id, { $inc: { downloads: 1 } });

  res.json({ success: true, file });
}));

// @route PUT /api/files/:id
router.put('/:id', protect, authorize('admin', 'manager', 'team'), asyncHandler(async (req, res) => {
  const allowed = ['name', 'description', 'category', 'tags', 'isPublic'];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  const file = await File.findByIdAndUpdate(req.params.id, updates, { new: true })
    .populate('uploadedBy', 'name avatar');

  if (!file) return res.status(404).json({ success: false, message: 'File not found' });
  res.json({ success: true, file });
}));

// @route DELETE /api/files/:id
router.delete('/:id', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const file = await File.findById(req.params.id);
  if (!file) return res.status(404).json({ success: false, message: 'File not found' });

  // Delete from Cloudinary if needed
  if (file.storageType === 'cloudinary' && file.cloudinaryId) {
    try {
      const { cloudinary } = require('../config/cloudinary');
      await cloudinary.uploader.destroy(file.cloudinaryId);
    } catch (e) { console.error('Cloudinary delete error:', e); }
  }

  await File.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'File deleted' });
}));

module.exports = router;
