const express = require('express');
const router = express.Router();
const Document = require('../models/Document');
const Client = require('../models/Client');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const MANAGER_ROLES = ['admin', 'manager'];

// GET /api/documents?client=:id  — list documents for a client
router.get('/', protect, asyncHandler(async (req, res) => {
  const { client: clientId } = req.query;
  if (!clientId) return res.status(400).json({ success: false, message: 'client query param required' });

  const query = { client: clientId };

  if (req.user.role === 'client') {
    // Clients only see documents marked visible to them
    if (String(req.user.clientId) !== String(clientId)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    query.clientVisible = true;
  } else if (!MANAGER_ROLES.includes(req.user.role)) {
    // Team members: check they are assigned to this client
    const clientDoc = await Client.findById(clientId).select('accountManager teamMembers');
    if (!clientDoc) return res.status(404).json({ success: false, message: 'Client not found' });
    const assigned = [
      String(clientDoc.accountManager || ''),
      ...(clientDoc.teamMembers || []).map(String),
    ];
    if (!assigned.includes(String(req.user._id))) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
  }

  const docs = await Document.find(query)
    .populate('createdBy', 'name avatar')
    .sort({ updatedAt: -1 });

  res.json({ success: true, documents: docs });
}));

// GET /api/documents/:id — single document
router.get('/:id', protect, asyncHandler(async (req, res) => {
  const doc = await Document.findById(req.params.id).populate('createdBy', 'name avatar');
  if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

  if (req.user.role === 'client') {
    if (String(req.user.clientId) !== String(doc.client)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    if (!doc.clientVisible) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
  }

  res.json({ success: true, document: doc });
}));

// POST /api/documents — create a document (admin/manager only)
router.post('/', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const { client, title, html, clientVisible, clientCanEdit } = req.body;
  if (!client) return res.status(400).json({ success: false, message: 'client is required' });

  const doc = await Document.create({
    client,
    title: title || 'Untitled Document',
    html: html || '',
    clientVisible: !!clientVisible,
    clientCanEdit: !!clientCanEdit,
    createdBy: req.user._id,
  });

  const populated = await Document.findById(doc._id).populate('createdBy', 'name avatar');
  res.status(201).json({ success: true, document: populated });
}));

// PUT /api/documents/:id — update a document
router.put('/:id', protect, asyncHandler(async (req, res) => {
  const doc = await Document.findById(req.params.id);
  if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

  if (req.user.role === 'client') {
    // Client can only edit if permitted
    if (String(req.user.clientId) !== String(doc.client)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    if (!doc.clientVisible || !doc.clientCanEdit) {
      return res.status(403).json({ success: false, message: 'You do not have edit permission for this document' });
    }
    // Clients can only update content fields
    const { title, html } = req.body;
    if (title !== undefined) doc.title = title;
    if (html !== undefined) doc.html = html;
  } else if (MANAGER_ROLES.includes(req.user.role)) {
    // Managers can update everything
    const { title, html, clientVisible, clientCanEdit } = req.body;
    if (title !== undefined) doc.title = title;
    if (html !== undefined) doc.html = html;
    if (clientVisible !== undefined) doc.clientVisible = !!clientVisible;
    if (clientCanEdit !== undefined) doc.clientCanEdit = !!clientCanEdit;
  } else {
    // Other team members: check assigned
    const clientDoc = await Client.findById(doc.client).select('accountManager teamMembers');
    const assigned = [
      String(clientDoc?.accountManager || ''),
      ...(clientDoc?.teamMembers || []).map(String),
    ];
    if (!assigned.includes(String(req.user._id))) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const { title, html } = req.body;
    if (title !== undefined) doc.title = title;
    if (html !== undefined) doc.html = html;
  }

  await doc.save();
  const populated = await Document.findById(doc._id).populate('createdBy', 'name avatar');
  res.json({ success: true, document: populated });
}));

// DELETE /api/documents/:id — admin/manager only
router.delete('/:id', protect, authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const doc = await Document.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
  res.json({ success: true, message: 'Document deleted' });
}));

module.exports = router;