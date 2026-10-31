/**
 * GET /api/overview/summary
 *
 * Cross-module dashboard summary. The data lives in separate MongoDB databases,
 * so each widget is computed independently, from its own connection, with its
 * own permission check and its own failure mode:
 *
 *   { attendance: { status, data? }, finance: { status, data? } }
 *   status ∈ ok | forbidden | not_configured | unavailable | not_linked | error
 *
 * A broken/unavailable database yields a status for THAT widget only – never a
 * fabricated zero, and never a failure of the other widgets or of Flowdesk.
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { can } = require('../config/permissions');
const connections = require('../config/connections');
const { resolveAttendanceUser } = require('../utils/identity');
const { captureController } = require('../utils/captureController');

const dbStatus = (name) => {
  const st = connections.status()[name];
  if (!st.configured) return 'not_configured';
  if (st.state !== 'connected') return 'unavailable';
  return null;
};

async function attendanceWidget(user) {
  if (!can.attendanceUse(user.role)) return { status: 'forbidden' };
  const blocked = dbStatus('attendance');
  if (blocked) return { status: blocked };

  const { getDashboard } = require('../modules/attendance/controllers/adminController');
  const { getTodayAttendance } = require('../modules/attendance/controllers/attendanceController');

  if (can.attendanceAdmin(user.role)) {
    const r = await captureController(getDashboard);
    if (r.status !== 200 || !r.body?.dashboard) return { status: 'error', message: 'Could not load attendance summary' };
    return { status: 'ok', data: { scope: 'team', ...r.body.dashboard } };
  }

  const ident = await resolveAttendanceUser(user);
  if (ident.status !== 'linked' || !ident.attUser?.isActive) return { status: 'not_linked', message: ident.reason || null };
  const r = await captureController(getTodayAttendance, { attUser: ident.attUser });
  if (r.status !== 200) return { status: 'error', message: 'Could not load your attendance' };
  return { status: 'ok', data: { scope: 'self', attendance: r.body.attendance } };
}

async function financeWidget(user) {
  if (!can.financeView(user.role)) return { status: 'forbidden' };
  const blocked = dbStatus('finance');
  if (blocked) return { status: blocked };

  const { getDashboard } = require('../modules/finance/controllers/dashboard.controller');
  const Payment = require('../modules/finance/models/Payment');
  const Expense = require('../modules/finance/models/Expense');

  const [dash, payments, expenses] = await Promise.all([
    captureController(getDashboard),
    Payment.find().sort({ paymentDate: -1 }).limit(5).populate('clientId', 'name').lean(),
    Expense.find().sort({ expenseDate: -1 }).limit(5).lean(),
  ]);
  if (dash.status !== 200 || !dash.body?.cards) return { status: 'error', message: 'Could not load finance summary' };

  const c = dash.body.cards;
  const recent = [
    ...payments.map((p) => ({ type: 'income', date: p.paymentDate, amount: p.amount, label: p.clientId?.name || p.description || 'Payment' })),
    ...expenses.map((e) => ({ type: 'expense', date: e.expenseDate, amount: e.amount, label: e.title || e.description || e.category || 'Expense' })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);

  return {
    status: 'ok',
    data: {
      month: dash.body.month,
      year: dash.body.year,
      revenue: c.currentMonthRevenue,
      expenses: c.currentMonthExpenses,
      netProfit: c.netProfit,
      totalPending: c.totalPending,
      recentTransactions: recent,
    },
  };
}

const safe = (fn) => async (...args) => {
  try { return await fn(...args); } catch (err) { console.error('[overview]', err.message); return { status: 'error', message: 'Unexpected error' }; }
};

router.get('/summary', protect, asyncHandler(async (req, res) => {
  if (req.user.role === 'client') return res.status(403).json({ success: false, message: 'Not authorized' });
  const [attendance, finance] = await Promise.all([safe(attendanceWidget)(req.user), safe(financeWidget)(req.user)]);
  res.json({ success: true, generatedAt: new Date().toISOString(), attendance, finance });
}));

module.exports = router;
