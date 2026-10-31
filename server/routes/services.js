const express = require('express');
const router = express.Router();
const Service = require('../models/Service');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

// ── GET /api/services ─────────────────────────────────────────────────────────
// Public to all authenticated users (so forms can list services)
router.get(
  '/',
  protect,
  asyncHandler(async (req, res) => {
    const filter = req.user.role === 'client' ? { isActive: true } : {};
    const services = await Service.find(filter).sort({ label: 1 });
    res.json({ success: true, services });
  })
);

// ── POST /api/services ────────────────────────────────────────────────────────
// Admin + Manager only
router.post(
  '/',
  protect,
  authorize('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const { key, label, description, isActive } = req.body;

    const service = await Service.create({
      key,
      label,
      description,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, service });
  })
);

// ── PUT /api/services/:id ─────────────────────────────────────────────────────
router.put(
  '/:id',
  protect,
  authorize('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const { label, description, isActive } = req.body;

    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { label, description, isActive },
      { new: true, runValidators: true }
    );

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    res.json({ success: true, service });
  })
);

// ── DELETE /api/services/:id ──────────────────────────────────────────────────
router.delete(
  '/:id',
  protect,
  authorize('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const service = await Service.findByIdAndDelete(req.params.id);

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    res.json({ success: true, message: 'Service deleted' });
  })
);

module.exports = router;
