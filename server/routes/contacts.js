const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

// @route GET /api/contacts
router.get('/', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const { search, field, isActive, page = 1, limit = 50 } = req.query;
  const query = {};

  if (isActive !== undefined) query.isActive = isActive === 'true';
  if (field) query.field = field;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { location: { $regex: search, $options: 'i' } },
      { field: { $regex: search, $options: 'i' } },
    ];
  }

  const total = await Contact.countDocuments(query);
  const contacts = await Contact.find(query)
    .populate('addedBy', 'name')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.json({ success: true, contacts, total, page: Number(page), pages: Math.ceil(total / limit) });
}));

// @route POST /api/contacts
router.post('/', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const contact = await Contact.create({ ...req.body, addedBy: req.user._id });
  res.status(201).json({ success: true, contact });
}));

// @route PUT /api/contacts/:id
router.put('/:id', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const contact = await Contact.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });
  res.json({ success: true, contact });
}));

// @route DELETE /api/contacts/:id
router.delete('/:id', protect, authorize('admin'), asyncHandler(async (req, res) => {
  await Contact.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Contact deleted' });
}));

module.exports = router;
