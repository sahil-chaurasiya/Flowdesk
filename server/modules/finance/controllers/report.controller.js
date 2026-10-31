const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const SalaryPayment = require('../models/SalaryPayment');
const EMIPayment = require('../models/EMIPayment');
const FreelancerPayment = require('../models/FreelancerPayment');
const Client = require('../models/Client');
const { monthExpectedValue } = require('./client.controller');

exports.getReport = async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59);

    let data = {};
    if (type === 'revenue') {
      const payments = await Payment.find({ paymentDate: { $gte: start, $lte: end } }).populate('clientId', 'name contractValue');
      data = { payments, total: payments.reduce((s, p) => s + p.amount, 0) };
    } else if (type === 'expense') {
      const expenses = await Expense.find({ expenseDate: { $gte: start, $lte: end } });
      data = { expenses, total: expenses.reduce((s, e) => s + e.amount, 0) };
    } else if (type === 'profit') {
      const [payments, expenses, salaries, emis, freelancerPays] = await Promise.all([
        Payment.find({ paymentDate: { $gte: start, $lte: end } }),
        Expense.find({ expenseDate: { $gte: start, $lte: end } }),
        SalaryPayment.find({ paidDate: { $gte: start, $lte: end }, status: 'Paid' }),
        EMIPayment.find({ paymentDate: { $gte: start, $lte: end } }),
        FreelancerPayment.find({ paymentDate: { $gte: start, $lte: end } }),
      ]);
      const income = payments.reduce((s, p) => s + p.amount, 0);
      const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
      const salaryTotal = salaries.reduce((s, s2) => s + s2.amountPaid, 0);
      const emiTotal = emis.reduce((s, e) => s + e.amount, 0);
      const freelancerTotal = freelancerPays.reduce((s, f) => s + f.amount, 0);
      data = { income, expenseTotal, salaryTotal, emiTotal, freelancerTotal, totalExpenses: expenseTotal + salaryTotal + emiTotal + freelancerTotal, profit: income - expenseTotal - salaryTotal - emiTotal - freelancerTotal };
    } else if (type === 'freelancer') {
      const payments = await FreelancerPayment.find({ paymentDate: { $gte: start, $lte: end } })
        .populate('freelancerId', 'name role')
        .populate('jobId', 'title')
        .sort({ paymentDate: -1 });
      data = { freelancerPayments: payments, total: payments.reduce((s, p) => s + p.amount, 0) };
    } else if (type === 'collection') {
      const clients = await Client.find();
      // If the report range is exactly one calendar month, use that month's
      // effective contract value (respecting any one-off override); for
      // multi-month ranges the default value is kept, same as before.
      const isSingleMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
      const collection = await Promise.all(clients.map(async (c) => {
        const payments = await Payment.find({ clientId: c._id, paymentDate: { $gte: start, $lte: end } });
        const collected = payments.reduce((s, p) => s + p.amount, 0);
        // Fixed-fee clients need their full payment history to know the balance owed that month.
        const contractValue = isSingleMonth
          ? monthExpectedValue(c, c.billingType === 'fixed' ? await Payment.find({ clientId: c._id }) : [], start.getFullYear(), start.getMonth() + 1)
          : c.contractValue;
        return { clientName: c.name, contractValue, collected, payments };
      }));
      data = { collection };
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};