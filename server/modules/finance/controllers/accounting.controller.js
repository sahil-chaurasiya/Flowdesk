const MonthlyAccounting = require('../models/MonthlyAccounting');
const Payment = require('../models/Payment');
const SalaryPayment = require('../models/SalaryPayment');
const Expense = require('../models/Expense');
const EMIPayment = require('../models/EMIPayment');
const FreelancerPayment = require('../models/FreelancerPayment');

const calcMonthSummary = async (month, year) => {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const [payments, salaries, expenses, emiPayments, freelancerPayments] = await Promise.all([
    Payment.find({ paymentDate: { $gte: start, $lte: end } }),
    SalaryPayment.find({ month, year, status: 'Paid' }),
    Expense.find({ expenseDate: { $gte: start, $lte: end } }),
    EMIPayment.find({ paymentDate: { $gte: start, $lte: end } }),
    FreelancerPayment.find({ paymentDate: { $gte: start, $lte: end } }),
  ]);

  return {
    monthlyIncome: payments.reduce((sum, p) => sum + p.amount, 0),
    salaryExpenses: salaries.reduce((sum, s) => sum + s.amountPaid, 0),
    officeExpenses: expenses.reduce((sum, e) => sum + e.amount, 0),
    emiExpenses: emiPayments.reduce((sum, e) => sum + e.amount, 0),
    freelancerExpenses: freelancerPayments.reduce((sum, f) => sum + f.amount, 0),
  };
};

exports.getAccounting = async (req, res) => {
  try {
    const records = await MonthlyAccounting.find().sort({ year: -1, month: -1 });
    const enriched = await Promise.all(
      records.map(async (rec) => {
        const { monthlyIncome, salaryExpenses, officeExpenses, emiExpenses, freelancerExpenses } = await calcMonthSummary(rec.month, rec.year);
        const totalExpenses = salaryExpenses + officeExpenses + emiExpenses + freelancerExpenses;
        const closingBalance = rec.openingBalance + monthlyIncome - totalExpenses - rec.reservedAmount;
        return { ...rec.toObject(), monthlyIncome, salaryExpenses, officeExpenses, emiExpenses, freelancerExpenses, totalExpenses, closingBalance };
      })
    );
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMonthSummary = async (req, res) => {
  try {
    const { month, year } = req.params;
    const m = parseInt(month), y = parseInt(year);
    let record = await MonthlyAccounting.findOne({ month: m, year: y });
    if (!record) record = { month: m, year: y, openingBalance: 0, reservedAmount: 0 };
    const { monthlyIncome, salaryExpenses, officeExpenses, emiExpenses, freelancerExpenses } = await calcMonthSummary(m, y);
    const openingBalance = record.openingBalance || 0;
    const reservedAmount = record.reservedAmount || 0;
    const totalExpenses = salaryExpenses + officeExpenses + emiExpenses + freelancerExpenses;
    const closingBalance = openingBalance + monthlyIncome - totalExpenses - reservedAmount;
    res.json({ ...record, monthlyIncome, salaryExpenses, officeExpenses, emiExpenses, freelancerExpenses, totalExpenses, closingBalance });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.upsertAccounting = async (req, res) => {
  try {
    const { month, year, openingBalance, reservedAmount, notes } = req.body;
    const record = await MonthlyAccounting.findOneAndUpdate(
      { month, year },
      { openingBalance, reservedAmount, notes },
      { new: true, upsert: true }
    );
    res.json(record);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};