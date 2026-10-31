const Payment = require('../models/Payment');
const Client = require('../models/Client');

exports.getPayments = async (req, res) => {
  try {
    const { clientId, month, year, isOneTime } = req.query;
    const filter = {};
    if (clientId) filter.clientId = clientId;
    if (month) filter.month = parseInt(month);
    if (year)  filter.year  = parseInt(year);
    if (isOneTime !== undefined) filter.isOneTime = isOneTime === 'true';
    const payments = await Payment.find(filter)
      .populate('clientId', 'name contractValue')
      .sort({ year: -1, month: -1, paymentDate: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createPayment = async (req, res) => {
  try {
    const body = { ...req.body };

    if (body.isOneTime) {
      // One-time / walk-in collection — no contract client involved.
      if (!body.customClientName || !body.customClientName.trim()) {
        return res.status(400).json({ message: 'Client name is required for a one-time collection' });
      }
      delete body.clientId;
    } else {
      if (!body.clientId) return res.status(400).json({ message: 'Client is required' });
      const client = await Client.findById(body.clientId);
      if (!client) return res.status(404).json({ message: 'Client not found' });
      delete body.customClientName;
      delete body.customClientPhone;
      delete body.totalAmount;
    }

    // auto-derive month/year from paymentDate if not supplied
    const date = new Date(body.paymentDate);
    const month = body.month || (date.getMonth() + 1);
    const year  = body.year  || date.getFullYear();
    const payment = await Payment.create({ ...body, month, year });
    const populated = await payment.populate('clientId', 'name contractValue');
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.updatePayment = async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.paymentDate && !body.month) {
      const d = new Date(body.paymentDate);
      body.month = d.getMonth() + 1;
      body.year  = d.getFullYear();
    }
    if (body.isOneTime) {
      body.clientId = undefined;
      body.$unset = { ...(body.$unset || {}), clientId: '' };
    }
    const payment = await Payment.findByIdAndUpdate(
      req.params.id, body, { new: true, runValidators: true }
    ).populate('clientId', 'name contractValue');
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    res.json(payment);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findByIdAndDelete(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    res.json({ message: 'Payment deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};