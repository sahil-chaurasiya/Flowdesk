const Invoice = require('../models/Invoice');
const Client = require('../models/Client');

// Month tokens used in invoice numbers. Note: September is "sept" (not "sep").
const MONTH_TOKENS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sept', 'oct', 'nov', 'dec'];

const buildInvoiceNumber = (year, month, sequence) =>
  `tofly_${MONTH_TOKENS[month - 1]}_${year}_${String(sequence).padStart(3, '0')}`;

// POST /api/invoices/monthly   { clientId, month, year, amount? }
// Get-or-create the invoice number for a client's invoice for a given month.
// Idempotent: calling it again for the same client + month returns the same number.
exports.getOrCreateMonthlyInvoice = async (req, res) => {
  try {
    const { clientId, amount } = req.body;
    const month = Number(req.body.month);
    const year = Number(req.body.year);

    if (!clientId) return res.status(400).json({ message: 'clientId is required' });
    if (!Number.isInteger(month) || month < 1 || month > 12) return res.status(400).json({ message: 'month must be 1-12' });
    if (!Number.isInteger(year) || year < 2000 || year > 2100) return res.status(400).json({ message: 'Invalid year' });

    const client = await Client.findById(clientId).select('name');
    if (!client) return res.status(404).json({ message: 'Client not found' });

    const snapshot = { clientName: client.name, amount: Number(amount) || 0 };

    // Already issued for this client + month? Reuse the number (refresh the snapshot).
    const existing = await Invoice.findOneAndUpdate({ clientId, year, month }, { $set: snapshot }, { new: true });
    if (existing) return res.json({ invoiceNumber: existing.invoiceNumber, sequence: existing.sequence, isNew: false });

    // First time: take the next free serial for this month. The unique indexes make
    // this safe under concurrency — if someone grabbed the same serial a millisecond
    // ahead of us, the insert fails with a duplicate-key error and we simply retry.
    // Each round exactly one contender wins a serial, so N simultaneous requests may need up
    // to N tries; a little random backoff spreads them out. 25 tries is far beyond any real load.
    for (let attempt = 0; attempt < 25; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, Math.random() * 15 * attempt));
      const last = await Invoice.findOne({ year, month }).sort({ sequence: -1 }).select('sequence');
      const sequence = (last ? last.sequence : 0) + 1;
      try {
        const created = await Invoice.create({
          clientId, year, month, sequence,
          invoiceNumber: buildInvoiceNumber(year, month, sequence),
          ...snapshot,
        });
        return res.status(201).json({ invoiceNumber: created.invoiceNumber, sequence: created.sequence, isNew: true });
      } catch (err) {
        if (err.code !== 11000) throw err;
        // Same client raced with itself (double click)? Return the winner's number.
        const winner = await Invoice.findOne({ clientId, year, month });
        if (winner) return res.json({ invoiceNumber: winner.invoiceNumber, sequence: winner.sequence, isNew: false });
        // Otherwise another client took this serial — loop and pick the next one.
      }
    }
    return res.status(409).json({ message: 'Could not allocate an invoice number, please try again' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};