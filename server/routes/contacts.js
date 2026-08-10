const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

// @route GET /api/contacts
// Visible to every team member. Admins see every contact by default;
// everyone else only sees contacts they added themselves or that they were
// explicitly given access to via `visibleTo`.
router.get('/', protect, authorize('team'), asyncHandler(async (req, res) => {
  const { search, field, isActive, page = 1, limit = 50 } = req.query;
  const query = {};

  if (isActive !== undefined) query.isActive = isActive === 'true';
  if (field) query.field = field;

  const conditions = [];
  if (search) {
    conditions.push({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { field: { $regex: search, $options: 'i' } },
      ],
    });
  }

  if (req.user.role !== 'admin') {
    conditions.push({
      $or: [
        { addedBy: req.user._id },
        { visibleTo: req.user._id },
      ],
    });
  }

  if (conditions.length) query.$and = conditions;

  const total = await Contact.countDocuments(query);
  const contacts = await Contact.find(query)
    .populate('addedBy', 'name role')
    .populate('visibleTo', 'name role')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.json({ success: true, contacts, total, page: Number(page), pages: Math.ceil(total / limit) });
}));

// @route POST /api/contacts
// Any team member can add a contact. The adder chooses (via `visibleTo`)
// which other active team members can see it — admins can always see it
// regardless, and so can whoever added it.
router.post('/', protect, authorize('team'), asyncHandler(async (req, res) => {
  const contact = await Contact.create({ ...req.body, addedBy: req.user._id });
  const populated = await contact.populate([
    { path: 'addedBy', select: 'name role' },
    { path: 'visibleTo', select: 'name role' },
  ]);
  res.status(201).json({ success: true, contact: populated });
}));

// @route PUT /api/contacts/:id
// Admins can edit any contact. Everyone else can only edit contacts they
// added themselves.
router.put('/:id', protect, authorize('team'), asyncHandler(async (req, res) => {
  const existing = await Contact.findById(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Contact not found' });

  const canEdit = req.user.role === 'admin' || existing.addedBy?.toString() === req.user._id.toString();
  if (!canEdit) {
    return res.status(403).json({ success: false, message: 'You can only edit contacts you added' });
  }

  const contact = await Contact.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    .populate('addedBy', 'name role')
    .populate('visibleTo', 'name role');
  res.json({ success: true, contact });
}));

// @route DELETE /api/contacts/:id
// Kept admin-only for now — deleting is destructive and wasn't part of the
// requested change.
router.delete('/:id', protect, authorize('admin'), asyncHandler(async (req, res) => {
  await Contact.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Contact deleted' });
}));

module.exports = router;