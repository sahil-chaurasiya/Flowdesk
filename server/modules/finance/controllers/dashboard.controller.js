const Client = require('../models/Client');
const Payment = require('../models/Payment');
const SalaryPayment = require('../models/SalaryPayment');
const Expense = require('../models/Expense');
const EMIPayment = require('../models/EMIPayment');
const Loan = require('../models/Loan');
const Employee = require('../models/Employee');
const FreelancerPayment = require('../models/FreelancerPayment');
const { computeClientTotals, hasEndedByMonth, monthExpectedValue } = require('./client.controller');

exports.getDashboard = async (req, res) => {
  try {
    const now = new Date();
    const month = req.query.month ? parseInt(req.query.month) : now.getMonth() + 1;
    const year = req.query.year ? parseInt(req.query.year) : now.getFullYear();
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);

    const [clients, allPayments, currentMonthPayments, employees, currentSalaries, currentExpenses, currentEMI, activeLoans, currentFreelancerPays] = await Promise.all([
      Client.find(),
      Payment.find(),
      Payment.find({ paymentDate: { $gte: monthStart, $lte: monthEnd } }),
      Employee.find({ isActive: true }),
      SalaryPayment.find({ month, year, status: 'Paid' }),
      Expense.find({ expenseDate: { $gte: monthStart, $lte: monthEnd } }),
      EMIPayment.find({ paymentDate: { $gte: monthStart, $lte: monthEnd } }),
      Loan.find({ status: 'Active' }),
      FreelancerPayment.find({ paymentDate: { $gte: monthStart, $lte: monthEnd } }),
    ]);

    // Paused clients aren't currently accruing dues, and clients whose
    // contract ended before this month are gone entirely — neither should
    // count toward the "expected this month" contract value. Any one-off
    // override set for this specific month is used in place of the default.
    const totalContractValue = clients
      .filter(c => c.isActive !== false && !hasEndedByMonth(c.endDate, year, month))
      .reduce((sum, c) => sum + monthExpectedValue(c, allPayments.filter(p => String(p.clientId) === String(c._id)), year, month), 0);
    const totalCollected = allPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalPending = totalContractValue - totalCollected;
    const currentMonthRevenue = currentMonthPayments.reduce((sum, p) => sum + p.amount, 0);
    const salaryExpense = currentSalaries.reduce((sum, s) => sum + s.amountPaid, 0);
    const officeExpense = currentExpenses.reduce((sum, e) => sum + e.amount, 0);
    const emiExpense = currentEMI.reduce((sum, e) => sum + e.amount, 0);
    const freelancerExpense = currentFreelancerPays.reduce((sum, f) => sum + f.amount, 0);
    const currentMonthExpenses = salaryExpense + officeExpense + emiExpense + freelancerExpense;
    const netProfit = currentMonthRevenue - currentMonthExpenses;

    // Top pending clients — pause/due-date aware, so paused clients don't
    // keep showing up as owing more the longer they stay paused.
    const clientStats = await Promise.all(clients.map(async (c) => {
      const payments = await Payment.find({ clientId: c._id });
      const { pendingAmount } = computeClientTotals(c, payments);
      return { name: c.name, pendingAmount, _id: c._id };
    }));
    const topPendingClients = clientStats.filter(c => c.pendingAmount > 0).sort((a, b) => b.pendingAmount - a.pendingAmount).slice(0, 5);

    // Revenue trend (last 6 months)
    const revenueTrend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1);
      const m2 = d.getMonth() + 1, y2 = d.getFullYear();
      const start = new Date(y2, m2 - 1, 1);
      const end = new Date(y2, m2, 0, 23, 59, 59);
      const pays = await Payment.find({ paymentDate: { $gte: start, $lte: end } });
      const exps = await Expense.find({ expenseDate: { $gte: start, $lte: end } });
      const emis = await EMIPayment.find({ paymentDate: { $gte: start, $lte: end } });
      const sals = await SalaryPayment.find({ month: m2, year: y2, status: 'Paid' });
      const frees = await FreelancerPayment.find({ paymentDate: { $gte: start, $lte: end } });
      const income = pays.reduce((s, p) => s + p.amount, 0);
      const expense = exps.reduce((s, e) => s + e.amount, 0) + emis.reduce((s, e) => s + e.amount, 0) + sals.reduce((s, s2) => s + s2.amountPaid, 0) + frees.reduce((s, f) => s + f.amount, 0);
      revenueTrend.push({ month: `${d.toLocaleString('default', { month: 'short' })} ${y2}`, income, expense, profit: income - expense });
    }

    res.json({
      month,
      year,
      cards: { totalContractValue, totalCollected, totalPending, currentMonthRevenue, currentMonthExpenses, salaryExpense, emiExpense, freelancerExpense, netProfit },
      topPendingClients,
      revenueTrend,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};