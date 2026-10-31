const Loan = require('../models/Loan');
const EMIPayment = require('../models/EMIPayment');

exports.getLoans = async (req, res) => {
  try {
    const loans = await Loan.find().sort({ createdAt: -1 });
    res.json(loans);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getLoan = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    const payments = await EMIPayment.find({ loanId: loan._id }).sort({ paymentDate: -1 });
    res.json({ ...loan.toObject(), payments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createLoan = async (req, res) => {
  try {
    const loan = await Loan.create({ ...req.body, remainingAmount: req.body.originalAmount });
    res.status(201).json(loan);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.updateLoan = async (req, res) => {
  try {
    const loan = await Loan.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    res.json(loan);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.deleteLoan = async (req, res) => {
  try {
    const loan = await Loan.findByIdAndDelete(req.params.id);
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    await EMIPayment.deleteMany({ loanId: loan._id });
    res.json({ message: 'Loan deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.recordEMIPayment = async (req, res) => {
  try {
    const loan = await Loan.findById(req.body.loanId);
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    const payment = await EMIPayment.create(req.body);
    loan.remainingAmount = Math.max(0, loan.remainingAmount - req.body.amount);
    if (loan.remainingAmount <= 0) loan.status = 'Closed';
    await loan.save();
    res.status(201).json({ payment, loan });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.deleteEMIPayment = async (req, res) => {
  try {
    const payment = await EMIPayment.findByIdAndDelete(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    const loan = await Loan.findById(payment.loanId);
    if (loan) {
      loan.remainingAmount = Math.min(loan.originalAmount, loan.remainingAmount + payment.amount);
      if (loan.remainingAmount > 0) loan.status = 'Active';
      await loan.save();
    }
    res.json({ message: 'EMI payment deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};