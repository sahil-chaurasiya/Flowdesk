const router = require('express').Router();
const { getAccounting, getMonthSummary, upsertAccounting } = require('../controllers/accounting.controller');
router.get('/', getAccounting);
router.get('/:month/:year', getMonthSummary);
router.post('/', upsertAccounting);
module.exports = router;
