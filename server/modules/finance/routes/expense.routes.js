const router = require('express').Router();
const { getExpenses, createExpense, updateExpense, deleteExpense, getMonthlySummary } = require('../controllers/expense.controller');
router.get('/', getExpenses);
router.get('/summary/:month/:year', getMonthlySummary);
router.post('/', createExpense);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);
module.exports = router;
