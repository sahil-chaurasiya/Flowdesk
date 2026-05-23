const express = require('express');
const router  = express.Router();
const Client              = require('../models/Client');
const User                = require('../models/User');
const PaymentVerification = require('../models/PaymentVerification');
const PaymentSettings     = require('../models/PaymentSettings');
const RenewalHistory      = require('../models/RenewalHistory');
const ActivityLog         = require('../models/ActivityLog');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler }       = require('../middleware/error');
const { getUploader, getFileUrl } = require('../config/cloudinary');

// ─── helpers ────────────────────────────────────────────────────────────────

function calcEndDate(base, duration) {
  const d = new Date(base);
  if (duration === '3_months') d.setMonth(d.getMonth() + 3);
  else if (duration === '6_months') d.setMonth(d.getMonth() + 6);
  else if (duration === '1_year')   d.setFullYear(d.getFullYear() + 1);
  return d;
}

function deriveContractStatus(endDate) {
  if (!endDate) return 'active';
  const days = Math.ceil((new Date(endDate) - Date.now()) / 86400000);
  if (days < 0)   return 'expired';
  if (days <= 30) return 'expiring_soon';
  return 'active';
}

async function pushNotif(userId, payload) {
  if (!userId) return;
  await User.findByIdAndUpdate(userId, {
    $push: {
      notifications: {
        $each: [{ ...payload, read: false, createdAt: new Date() }],
        $position: 0,
        $slice: 100,
      },
    },
  });
}

async function logAct(actor, action, entity, meta = {}) {
  try {
    await ActivityLog.create({
      actor: actor._id,
      actorName: actor.name,
      actorRole: actor.role,
      action, entity, meta,
    });
  } catch (e) { /* non-fatal */ }
}

// Maps the legacy `plan` enum values to a VALID_DURATIONS planDuration
const PLAN_TO_DURATION = {
  '3_month': '3_months', '6_month': '6_months', '1_year': '1_year',
  'starter': '3_months', 'growth': '6_months',
  'professional': '6_months', 'enterprise': '1_year', 'custom': '1_year',
};

const VALID_DURATIONS = ['3_months', '6_months', '1_year'];

// Maps planDuration values ('3_months') to the legacy plan enum ('3_month')
const DURATION_TO_PLAN = { '3_months': '3_month', '6_months': '6_month', '1_year': '1_year' };

// ─── Payment Settings ────────────────────────────────────────────────────────

router.get('/settings', protect, asyncHandler(async (req, res) => {
  const settings = await PaymentSettings.findOne({ key: 'global' }).lean();
  res.json({ success: true, settings: settings || {} });
}));

router.put(
  '/settings',
  protect, authorize('admin'),
  getUploader().single('qrImage'),
  asyncHandler(async (req, res) => {
    const { upiId, bankAccountName, accountNumber, ifscCode } = req.body;
    const update = { upiId, bankAccountName, accountNumber, ifscCode, updatedBy: req.user._id };
    if (req.file) {
      update.qrImageUrl = process.env.FILE_STORAGE === 'cloudinary'
        ? req.file.path
        : getFileUrl(req, req.file.filename);
    }
    const settings = await PaymentSettings.findOneAndUpdate(
      { key: 'global' },
      { $set: update },
      { upsert: true, new: true }
    );
    await logAct(req.user, 'settings.updated', { type: 'PaymentSettings', name: 'Payment Settings' });
    res.json({ success: true, settings });
  })
);

// ─── Contract management (admin/manager) ────────────────────────────────────

// Set / recalculate a client's contract
router.put(
  '/clients/:id/contract',
  protect, authorize('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const { planDuration, startDate } = req.body;
    if (!VALID_DURATIONS.includes(planDuration))
      return res.status(400).json({ success: false, message: 'Invalid plan duration' });

    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

    const base           = startDate ? new Date(startDate) : (client.startDate || new Date());
    const contractEndDate = calcEndDate(base, planDuration);
    const contractStatus  = deriveContractStatus(contractEndDate);

    Object.assign(client, { planDuration, plan: DURATION_TO_PLAN[planDuration] || client.plan, startDate: base, contractEndDate, contractStatus });
    await client.save();

    await logAct(req.user, 'client.updated', { type: 'Client', id: client._id, name: client.company },
      { field: 'contract', planDuration, contractEndDate });

    res.json({ success: true, client });
  })
);

// Contract alerts widget for admin dashboard
router.get(
  '/contract-alerts',
  protect, authorize('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const clients = await Client.find({
      status: 'active',
      contractEndDate: { $exists: true, $ne: null },
    }).select('company name contractEndDate contractStatus planDuration').lean();

    const alerts = clients
      .map(c => {
        const days = Math.ceil((new Date(c.contractEndDate) - Date.now()) / 86400000);
        let level = null;
        if (days < 0)   level = 'expired';
        else if (days <= 3)  level = 'critical';
        else if (days <= 7)  level = 'high';
        else if (days <= 14) level = 'medium';
        else if (days <= 30) level = 'low';
        return { ...c, daysRemaining: days, level };
      })
      .filter(c => c.level !== null)
      .sort((a, b) => a.daysRemaining - b.daysRemaining);

    res.json({ success: true, alerts });
  })
);

// ─── Client: submit payment proof ────────────────────────────────────────────

router.post(
  '/submit',
  protect, authorize('client'),
  getUploader().single('screenshot'),
  asyncHandler(async (req, res) => {
    const { amount, paymentDate, transactionReference, notes } = req.body;
    if (!amount || !paymentDate)
      return res.status(400).json({ success: false, message: 'Amount and payment date are required' });

    const client = await Client.findById(req.user.clientId);
    if (!client) return res.status(404).json({ success: false, message: 'Client record not found' });

    const screenshotUrl = req.file
      ? (process.env.FILE_STORAGE === 'cloudinary' ? req.file.path : getFileUrl(req, req.file.filename))
      : undefined;

    const pv = await PaymentVerification.create({
      client: client._id,
      submittedBy: req.user._id,
      amount: Number(amount),
      paymentDate: new Date(paymentDate),
      transactionReference,
      screenshotUrl,
      notes,
      status: 'pending',
    });

    // Notify all admins
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
    await Promise.all(admins.map(a =>
      pushNotif(a._id, {
        type: 'payment',
        title: 'New Payment Submitted',
        body: `${client.company} submitted ₹${Number(amount).toLocaleString('en-IN')} for verification.`,
        link: '/admin/payment-verifications',
      })
    ));

    await logAct(req.user, 'payment.submitted',
      { type: 'PaymentVerification', id: pv._id, name: client.company },
      { amount, clientId: client._id });

    const populated = await PaymentVerification.findById(pv._id)
      .populate('client', 'company name')
      .populate('submittedBy', 'name email');

    res.status(201).json({ success: true, payment: populated });
  })
);

// ─── Admin: list verifications ───────────────────────────────────────────────

router.get(
  '/verifications',
  protect, authorize('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;

    const total    = await PaymentVerification.countDocuments(query);
    const payments = await PaymentVerification.find(query)
      .populate('client', 'company name email planDuration contractEndDate')
      .populate('submittedBy', 'name email')
      .populate('verifiedBy',  'name email')
      .sort({ createdAt: -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit);

    res.json({ success: true, payments, total, page: +page, pages: Math.ceil(total / +limit) });
  })
);

router.get(
  '/verifications/:id',
  protect, authorize('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const payment = await PaymentVerification.findById(req.params.id)
      .populate('client', 'company name email planDuration contractEndDate contractStatus startDate')
      .populate('submittedBy', 'name email')
      .populate('verifiedBy',  'name email');
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    res.json({ success: true, payment });
  })
);

// ─── Admin: reject ───────────────────────────────────────────────────────────

router.put(
  '/verifications/:id/reject',
  protect, authorize('admin'),
  asyncHandler(async (req, res) => {
    const { rejectionReason } = req.body;
    if (!rejectionReason)
      return res.status(400).json({ success: false, message: 'Rejection reason is required' });

    const payment = await PaymentVerification.findById(req.params.id)
      .populate('client', 'company name');
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    if (payment.status !== 'pending')
      return res.status(400).json({ success: false, message: 'Payment is no longer pending' });

    Object.assign(payment, {
      status: 'rejected',
      rejectionReason,
      verifiedBy: req.user._id,
      verifiedAt: new Date(),
    });
    await payment.save();

    await pushNotif(payment.submittedBy, {
      type: 'payment',
      title: 'Payment Rejected',
      body: `Your payment for ${payment.client.company} was rejected. Reason: ${rejectionReason}`,
      link: '/portal/payment',
    });

    await logAct(req.user, 'payment.rejected',
      { type: 'PaymentVerification', id: payment._id, name: payment.client.company },
      { rejectionReason, amount: payment.amount });

    res.json({ success: true, payment });
  })
);

// ─── Admin: approve + extend contract ────────────────────────────────────────

router.put(
  '/verifications/:id/approve',
  protect, authorize('admin'),
  asyncHandler(async (req, res) => {
    const { extensionDuration } = req.body;
    if (!VALID_DURATIONS.includes(extensionDuration))
      return res.status(400).json({ success: false, message: 'Valid extension duration is required' });

    const payment = await PaymentVerification.findById(req.params.id).populate('client');
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    if (payment.status !== 'pending')
      return res.status(400).json({ success: false, message: 'Payment is no longer pending' });

    const client  = payment.client;
    const now     = new Date();
    const baseDate = (client.contractEndDate && new Date(client.contractEndDate) > now)
      ? new Date(client.contractEndDate)
      : now;

    const previousEndDate = client.contractEndDate ? new Date(client.contractEndDate) : now;
    const newEndDate      = calcEndDate(baseDate, extensionDuration);

    // Update payment
    Object.assign(payment, {
      status: 'verified',
      verifiedBy: req.user._id,
      verifiedAt: now,
      extensionDuration,
      previousContractEndDate: previousEndDate,
      newContractEndDate: newEndDate,
    });
    await payment.save();

    // Update client
    Object.assign(client, {
      contractEndDate: newEndDate,
      contractStatus:  deriveContractStatus(newEndDate),
      planDuration:    extensionDuration,
      plan:            DURATION_TO_PLAN[extensionDuration] || client.plan,
    });
    await client.save();

    // Save renewal history
    await RenewalHistory.create({
      client:              client._id,
      previousEndDate,
      newEndDate,
      duration:            extensionDuration,
      approvedBy:          req.user._id,
      approvedAt:          now,
      paymentVerification: payment._id,
    });

    await pushNotif(payment.submittedBy, {
      type: 'contract',
      title: 'Payment Verified & Contract Extended',
      body: `Your payment has been approved. Contract extended until ${newEndDate.toLocaleDateString('en-IN')}.`,
      link: '/portal/payment',
    });

    await logAct(req.user, 'payment.approved',
      { type: 'PaymentVerification', id: payment._id, name: client.company },
      { extensionDuration, newEndDate, amount: payment.amount });

    await logAct(req.user, 'contract.renewed',
      { type: 'Client', id: client._id, name: client.company },
      { previousEndDate, newEndDate, duration: extensionDuration });

    const populated = await PaymentVerification.findById(payment._id)
      .populate('client', 'company name contractEndDate planDuration contractStatus')
      .populate('verifiedBy', 'name email');

    res.json({ success: true, payment: populated, client: populated.client });
  })
);

// ─── Client: own payment data ────────────────────────────────────────────────

router.get(
  '/my-payments',
  protect, authorize('client'),
  asyncHandler(async (req, res) => {
    const client = await Client.findById(req.user.clientId)
      .select('company name plan planDuration contractEndDate contractStatus startDate');
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

    // ── Backfill missing contractEndDate on the fly (old clients) ────────────
    if (!client.contractEndDate && client.startDate) {
      const planDuration = client.planDuration && VALID_DURATIONS.includes(client.planDuration)
        ? client.planDuration
        : (PLAN_TO_DURATION[client.plan] || '3_months');
      const contractEndDate = calcEndDate(client.startDate, planDuration);
      const contractStatus  = deriveContractStatus(contractEndDate);
      const plan            = DURATION_TO_PLAN[planDuration] || client.plan;
      // Persist so it's fixed permanently
      await Client.findByIdAndUpdate(client._id, {
        $set: { planDuration, plan, contractEndDate, contractStatus },
      });
      client.planDuration    = planDuration;
      client.contractEndDate = contractEndDate;
      client.contractStatus  = contractStatus;
    }

    const [payments, settings, renewalHistory] = await Promise.all([
      PaymentVerification.find({ client: client._id })
        .populate('verifiedBy', 'name')
        .sort({ createdAt: -1 }),
      PaymentSettings.findOne({ key: 'global' }).lean(),
      RenewalHistory.find({ client: client._id })
        .populate('approvedBy', 'name')
        .sort({ approvedAt: -1 }),
    ]);

    res.json({ success: true, client, payments, settings: settings || {}, renewalHistory });
  })
);

// ─── Admin: renewal history for a client ────────────────────────────────────

router.get(
  '/clients/:id/renewal-history',
  protect, authorize('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const history = await RenewalHistory.find({ client: req.params.id })
      .populate('approvedBy', 'name avatar')
      .populate('paymentVerification', 'amount transactionReference')
      .sort({ approvedAt: -1 });
    res.json({ success: true, history });
  })
);

// ─── Admin: repair clients whose contractEndDate was never updated ────────────
// Replays all verified PaymentVerifications in chronological order so each
// client ends up with the correct contractEndDate from its latest approval.

router.post(
  '/repair-client-contracts',
  protect, authorize('admin'),
  asyncHandler(async (req, res) => {
    let repaired = 0;

    // ── PASS 1: replay verified payments (newest approval wins per client) ──
    const verified = await PaymentVerification.find({ status: 'verified' })
      .populate('client')
      .sort({ verifiedAt: 1 }); // oldest first so latest overwrites

    const fromPayments = new Map();
    for (const pv of verified) {
      if (!pv.client || !pv.newContractEndDate || !pv.extensionDuration) continue;
      fromPayments.set(String(pv.client._id), {
        contractEndDate: pv.newContractEndDate,
        planDuration:    pv.extensionDuration,
        plan:            DURATION_TO_PLAN[pv.extensionDuration] || pv.client.plan,
      });
    }

    for (const [clientId, update] of fromPayments.entries()) {
      const contractStatus = deriveContractStatus(update.contractEndDate);
      await Client.findByIdAndUpdate(clientId, { $set: { ...update, contractStatus } });
      repaired++;
    }

    // ── PASS 2: old clients with no contractEndDate — compute from startDate + plan ──
    const oldClients = await Client.find({
      $or: [{ contractEndDate: { $exists: false } }, { contractEndDate: null }],
      startDate: { $exists: true, $ne: null },
    });

    for (const c of oldClients) {
      // Skip if we already fixed this client in pass 1
      if (fromPayments.has(String(c._id))) continue;

      // Resolve the best duration we can from existing fields
      const planDuration = c.planDuration && VALID_DURATIONS.includes(c.planDuration)
        ? c.planDuration
        : (PLAN_TO_DURATION[c.plan] || '3_months');

      const contractEndDate = calcEndDate(c.startDate, planDuration);
      const contractStatus  = deriveContractStatus(contractEndDate);
      const plan            = DURATION_TO_PLAN[planDuration] || c.plan;

      await Client.findByIdAndUpdate(c._id, {
        $set: { planDuration, plan, contractEndDate, contractStatus },
      });
      repaired++;
    }

    res.json({ success: true, message: `Repaired ${repaired} client contract(s)` });
  })
);

// ─── Cron: sync all contract statuses ───────────────────────────────────────

router.post(
  '/sync-contract-statuses',
  protect, authorize('admin'),
  asyncHandler(async (req, res) => {
    const clients = await Client.find({ contractEndDate: { $exists: true, $ne: null } });
    let updated = 0;
    for (const c of clients) {
      const newStatus = deriveContractStatus(c.contractEndDate);
      if (c.contractStatus !== newStatus) {
        c.contractStatus = newStatus;
        await c.save();
        updated++;
        if (newStatus === 'expired') {
          await logAct(
            { _id: c._id, name: 'System', role: 'system' },
            'contract.expired',
            { type: 'Client', id: c._id, name: c.company }
          );
        }
      }
    }
    res.json({ success: true, message: `Updated ${updated} client contract statuses` });
  })
);

module.exports = router;