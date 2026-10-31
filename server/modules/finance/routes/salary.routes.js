const router = require('express').Router();
const { getSalaries, getMonthlySummary, createSalaryPayment, updateSalaryPayment, revertSalaryPayment } = require('../controllers/salary.controller');
router.get('/', getSalaries);
router.get('/summary/:month/:year', getMonthlySummary);
router.post('/', createSalaryPayment);
router.put('/:id', updateSalaryPayment);
router.put('/:id/revert', revertSalaryPayment);
module.exports = router;