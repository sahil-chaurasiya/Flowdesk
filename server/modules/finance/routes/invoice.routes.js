const router = require('express').Router();
const { getOrCreateMonthlyInvoice } = require('../controllers/invoice.controller');

router.post('/monthly', getOrCreateMonthlyInvoice);

module.exports = router;