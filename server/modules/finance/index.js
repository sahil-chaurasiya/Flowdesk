/**
 * Revenue & Finance module (the To Fly Accountant application).
 * Mounted at /api/finance  — see server/index.js.
 *
 * Every route below is protected ONCE here, on the backend:
 *   1. Flowdesk authentication (same JWT/refresh flow as the rest of Flowdesk)
 *   2. Role permission:  read  (GET/HEAD)  → FINANCE_VIEW_ROLES
 *                        write (POST/PUT/PATCH/DELETE) → FINANCE_WRITE_ROLES
 *      (default: admin only – financial access is independent of every other module)
 *   3. The accountant database must be configured and connected (else 503;
 *      there is no fallback to any other database)
 *
 * The accountant app's own login (Admin collection + JWT_SECRET) is not used.
 * Its controllers and response formats are unchanged.
 */
const express = require('express');
const { protect } = require('../../middleware/auth');
const { can } = require('../../config/permissions');
const { requireModuleDb } = require('../../config/connections');

const router = express.Router();

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const financePermission = (req, res, next) => {
  const allowed = READ_METHODS.has(req.method) ? can.financeView(req.user.role) : can.financeWrite(req.user.role);
  if (!allowed) {
    return res.status(403).json({
      success: false,
      code: 'FINANCE_FORBIDDEN',
      message: READ_METHODS.has(req.method)
        ? 'Your role cannot view financial data.'
        : 'Your role cannot modify financial data.',
    });
  }
  next();
};

router.use(protect, financePermission, requireModuleDb('finance'));

router.use('/clients', require('./routes/client.routes'));
router.use('/payments', require('./routes/payment.routes'));
router.use('/employees', require('./routes/employee.routes'));
router.use('/salaries', require('./routes/salary.routes'));
router.use('/expenses', require('./routes/expense.routes'));
router.use('/emis', require('./routes/emi.routes'));
router.use('/accounting', require('./routes/accounting.routes'));
router.use('/dashboard', require('./routes/dashboard.routes'));
router.use('/reports', require('./routes/report.routes'));
router.use('/services', require('./routes/service.routes'));
router.use('/company-settings', require('./routes/companySettings.routes'));
router.use('/invoices', require('./routes/invoice.routes'));
router.use('/freelancers', require('./routes/freelancer.routes'));

// Same error contract the accountant app used: { message }
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  console.error('[finance]', err.stack || err.message);
  res.status(err.statusCode || 500).json({ message: err.message || 'Internal Server Error' });
});

module.exports = router;
