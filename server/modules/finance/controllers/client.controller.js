const Client = require('../models/Client');
const Payment = require('../models/Payment');

// ─── Billing-cycle helpers ─────────────────────────────────────────────────
// Every client is billed monthly on the same day-of-month as their start date
// (clamped to the last day of shorter months — e.g. a client who starts on the
// 31st is billed on the 30th in a 30-day month). A month's due date is the
// FIRST day that month's charge becomes "owed" — nothing should be flagged as
// pending before that date arrives, even if the calendar month has already begun.
const billingDateFor = (startDate, year, month /* 1-12 */) => {
  const day = new Date(startDate).getDate();
  const daysInMonth = new Date(year, month, 0).getDate();
  return new Date(year, month - 1, Math.min(day, daysInMonth));
};

// Was `date` inside a paused interval? An open interval (no resumedAt yet) is
// still ongoing.
const isPausedOn = (date, pauseHistory) => {
  return (pauseHistory || []).some(p => {
    const from = new Date(p.pausedAt);
    const to = p.resumedAt ? new Date(p.resumedAt) : null;
    return date >= from && (!to || date < to);
  });
};

// Is the given year/month strictly AFTER the month the client's contract
// ended in? The end month itself still bills normally (they may have been
// active for part of it) — only months after it are cut off entirely.
const hasEndedByMonth = (endDate, year, month) => {
  if (!endDate) return false;
  const end = new Date(endDate);
  const endYear = end.getFullYear();
  const endMonth = end.getMonth() + 1;
  return year > endYear || (year === endYear && month > endMonth);
};

// The contract value actually owed for a specific (year, month): the
// one-off override for that month if one was set, otherwise the client's
// normal/default monthly value. Overrides never affect any other month.
const contractValueFor = (defaultValue, overrides, year, month) => {
  const override = (overrides || []).find(o => o.year === year && o.month === month);
  return override ? override.value : defaultValue;
};

// ─── Fixed-fee (freelance / project) clients ───────────────────────────────
// A 'fixed' client pays ONE total (`contractValue`) for `durationMonths` months of
// service instead of a recurring monthly amount. The fee is billed once, on the
// start date, and may be paid in instalments across any months. For every month we
// therefore work out the BALANCE still owed going into it (fee minus everything paid
// in earlier months) — that balance is what the month "owes", so the usual
// Paid / Partial / Unpaid logic and every total built on it keeps working.
const isFixed = (client) => client && client.billingType === 'fixed';
const monthIndex = (year, month /* 1-12 */) => year * 12 + (month - 1);
const sumAmounts = (list) => list.reduce((s, p) => s + p.amount, 0);

// Index of the last calendar month the service window covers.
const fixedWindowEndIdx = (client) => {
  const s = new Date(client.startDate);
  return monthIndex(s.getFullYear(), s.getMonth() + 1) + Math.max(1, client.durationMonths || 1) - 1;
};

// Add n months, clamping the day to the last day of shorter months.
const addMonthsClamped = (d, n) => {
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const dim = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  return new Date(t.getFullYear(), t.getMonth(), Math.min(d.getDate(), dim));
};

// Last day of service: start date + durationMonths, minus one day.
const fixedServiceEndDate = (client) => {
  const e = addMonthsClamped(new Date(client.startDate), Math.max(1, client.durationMonths || 1));
  e.setDate(e.getDate() - 1);
  return e;
};

// What a fixed client still owes going INTO (year, month): the total fee minus
// everything paid in earlier months. Months before the start owe nothing.
const fixedMonthValue = (client, payments, year, month) => {
  const s = new Date(client.startDate);
  const idx = monthIndex(year, month);
  if (idx < monthIndex(s.getFullYear(), s.getMonth() + 1)) return 0;
  const paidBefore = sumAmounts((payments || []).filter(p => monthIndex(p.year, p.month) < idx));
  return Math.max(0, client.contractValue - paidBefore);
};

// Where (year, month) sits in a fixed client's service window.
const fixedCycleInfo = (client, year, month) => {
  const s = new Date(client.startDate);
  const startIdx = monthIndex(s.getFullYear(), s.getMonth() + 1);
  const idx = monthIndex(year, month);
  const total = Math.max(1, client.durationMonths || 1);
  return {
    position: idx - startIdx + 1,           // 1 = first month of service
    total,
    isBillingMonth: idx === startIdx,
    inWindow: idx >= startIdx && idx <= fixedWindowEndIdx(client),
  };
};

// Has a fixed client's service window ended AND been fully settled by this month?
// (If money is still owed they stay visible — a finished project with an unpaid
// balance must not silently vanish.)
const fixedFullyDoneByMonth = (client, payments, year, month) =>
  monthIndex(year, month) > fixedWindowEndIdx(client) && fixedMonthValue(client, payments, year, month) === 0;

// The amount a client is expected to owe for (year, month), for monthly OR fixed clients.
const monthExpectedValue = (client, clientPayments, year, month) =>
  isFixed(client)
    ? fixedMonthValue(client, clientPayments, year, month)
    : contractValueFor(client.contractValue, client.contractValueOverrides, year, month);

// Month-by-month ledger for a fixed client. Every row's `contractValue` is the
// balance carried into that month (the full fee in the billing month).
const buildFixedLedger = (client, payments) => {
  const start = new Date(client.startDate);
  const now = new Date();
  const end = client.endDate ? new Date(client.endDate) : null;
  const limit = (end && end < now) ? end : now;
  const startIdx = monthIndex(start.getFullYear(), start.getMonth() + 1);
  const limitIdx = monthIndex(limit.getFullYear(), limit.getMonth() + 1);
  const windowEndIdx = fixedWindowEndIdx(client);
  const notDueYet = now < start;

  const rows = [];
  for (let idx = startIdx; idx <= limitIdx; idx++) {
    const y = Math.floor(idx / 12);
    const m = (idx % 12) + 1;
    const monthPayments = (payments || []).filter(p => p.year === y && p.month === m);
    const totalPaid = sumAmounts(monthPayments);
    const monthValue = fixedMonthValue(client, payments, y, m);
    // Past the service window, only keep months that still matter.
    if (idx > windowEndIdx && monthValue === 0 && monthPayments.length === 0) continue;

    let status;
    if (monthValue === 0) status = totalPaid > 0 ? 'Paid' : 'Covered';
    else if (totalPaid >= monthValue) status = 'Paid';
    else if (totalPaid > 0) status = 'Partial';
    else if (notDueYet) status = 'Upcoming';
    else status = 'Unpaid';

    const billable = status !== 'Upcoming';
    const remaining = (status === 'Unpaid' || status === 'Partial') ? Math.max(0, monthValue - totalPaid) : 0;
    rows.push({
      month: m, year: y, contractValue: monthValue, totalPaid, remaining, status,
      dueDate: start, billable, payments: monthPayments,
      ...fixedCycleInfo(client, y, m),
    });
  }
  return rows.reverse();
};

// Build month-by-month ledger from contract start to today.
// Each month's status is decided by, in priority order:
//   1. Was it actually paid (fully/partially)? Money collected always counts,
//      regardless of due date or pause state.
//   2. Was the client paused on that month's due date? -> 'Paused', not billed.
//   3. Has that month's due date not arrived yet? -> 'Upcoming', not billed.
//   4. Otherwise it's genuinely owed and unpaid -> 'Unpaid'.
// "billable" months (Paid/Partial/Unpaid) are the ones that count toward
// total revenue/dues; 'Paused' and 'Upcoming' months are excluded until they
// resolve into one of the billable states.
const buildMonthLedger = (startDate, contractValue, payments, pauseHistory, endDate, overrides) => {
  const start = new Date(startDate);
  const now = new Date();
  // A completed contract stops generating months after the one `endDate`
  // falls in — never further than "now" either way.
  const end = endDate ? new Date(endDate) : null;
  const limit = (end && end < now) ? end : now;
  const payMap = {};
  payments.forEach(p => {
    const key = `${p.year}-${p.month}`;
    if (!payMap[key]) payMap[key] = [];
    payMap[key].push(p);
  });

  const months = [];
  let y = start.getFullYear();
  let m = start.getMonth() + 1;

  while (y < limit.getFullYear() || (y === limit.getFullYear() && m <= limit.getMonth() + 1)) {
    const key = `${y}-${m}`;
    const monthPayments = payMap[key] || [];
    const totalPaid = monthPayments.reduce((s, p) => s + p.amount, 0);
    const dueDate = billingDateFor(start, y, m);
    const notDueYet = now < dueDate;
    const paused = isPausedOn(dueDate, pauseHistory);
    // This month's own contract value — a one-off override if set, else the
    // client's default.
    const monthValue = contractValueFor(contractValue, overrides, y, m);

    let status;
    if (totalPaid >= monthValue) status = 'Paid';
    else if (totalPaid > 0) status = 'Partial';
    else if (paused) status = 'Paused';
    else if (notDueYet) status = 'Upcoming';
    else status = 'Unpaid';

    const billable = status !== 'Paused' && status !== 'Upcoming';
    const remaining = (status === 'Unpaid' || status === 'Partial') ? Math.max(0, monthValue - totalPaid) : 0;

    months.push({ month: m, year: y, contractValue: monthValue, totalPaid, remaining, status, dueDate, billable, payments: monthPayments });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months.reverse();
};

// Totals used by the dashboard/detail views — pause- and due-date-aware.
const computeClientTotals = (client, payments) => {
  if (isFixed(client)) {
    const ledger = buildFixedLedger(client, payments);
    const totalReceived = sumAmounts(payments);
    // The one-time fee is owed from the start date (or sooner, if money already came in).
    const billed = (new Date() >= new Date(client.startDate) || totalReceived > 0) ? client.contractValue : 0;
    return { ledger, totalReceived, totalDue: billed, pendingAmount: Math.max(0, billed - totalReceived) };
  }
  const ledger = buildMonthLedger(client.startDate, client.contractValue, payments, client.pauseHistory, client.endDate, client.contractValueOverrides);
  const totalReceived = payments.reduce((s, p) => s + p.amount, 0);
  const totalDue = ledger.filter(m => m.billable).reduce((s, m) => s + m.contractValue, 0);
  return { ledger, totalReceived, totalDue, pendingAmount: Math.max(0, totalDue - totalReceived) };
};

// month/year: which month to report status for (defaults to current)
const getClientWithStats = async (client, targetMonth, targetYear) => {
  const payments = await Payment.find({ clientId: client._id }).sort({ year: -1, month: -1, paymentDate: -1 });

  const now = new Date();
  const curMonth = targetMonth || (now.getMonth() + 1);
  const curYear  = targetYear  || now.getFullYear();

  // Has the contract started by the selected month? (compare year-month, not exact date)
  const start = new Date(client.startDate);
  const startMonth = start.getMonth() + 1;
  const startYear  = start.getFullYear();
  const hasStarted = curYear > startYear || (curYear === startYear && curMonth >= startMonth);

  const fixed     = isFixed(client);
  // Fixed-fee clients are billed once, on their start date — never monthly, and
  // pausing doesn't apply to them.
  const dueDate   = hasStarted ? (fixed ? start : billingDateFor(start, curYear, curMonth)) : null;
  const notDueYet = hasStarted && now < dueDate;
  const paused    = !fixed && hasStarted && isPausedOn(dueDate, client.pauseHistory);
  // Has the contract's end date already passed by the selected month? (the
  // end month itself still bills normally — only months strictly after it
  // are cut off.)
  const ended     = hasStarted && (
    hasEndedByMonth(client.endDate, curYear, curMonth) ||
    (fixed && fixedFullyDoneByMonth(client, payments, curYear, curMonth))
  );
  // What's actually owed for the selected month — a one-off override if one
  // was set for it, otherwise the client's normal monthly value.
  // (Fixed-fee clients: the balance still owed going into the selected month.)
  const monthContractValue = fixed
    ? fixedMonthValue(client, payments, curYear, curMonth)
    : contractValueFor(client.contractValue, client.contractValueOverrides, curYear, curMonth);

  // Selected month stats — clients that hadn't started yet, or whose contract
  // had already ended, in the selected month have no obligation for that
  // month, so they should not show as Pending/owing anything.
  const selPayments = (hasStarted && !ended) ? payments.filter(p => p.month === curMonth && p.year === curYear) : [];
  const selPaid      = selPayments.reduce((s, p) => s + p.amount, 0);

  let status = 'Unpaid';
  if (!hasStarted) status = 'NotStarted';
  else if (ended) status = 'Completed';
  // Fixed client with nothing owed going into this month: the service is simply
  // running, already covered by what was paid earlier.
  else if (fixed && monthContractValue === 0) status = selPaid > 0 ? 'Paid' : 'Covered';
  else if (selPaid >= monthContractValue) status = 'Paid';
  else if (selPaid > 0) status = 'Partial';
  else if (paused) status = 'Paused';
  else if (notDueYet) status = 'Upcoming';
  else status = 'Unpaid';

  const selRemaining = (status === 'Unpaid' || status === 'Partial') ? Math.max(0, monthContractValue - selPaid) : 0;

  // All-time totals (for detail page) — pause/due-date aware via buildMonthLedger,
  // which only builds months from client.startDate onward.
  const { ledger, totalReceived, totalDue, pendingAmount } = computeClientTotals(client, payments);

  return {
    ...client.toObject(),
    // Selected-month fields (used in list/table)
    hasStarted,
    ended,
    dueDate,
    // The actual amount owed for the selected month (accounts for any
    // one-off override) — use this instead of `contractValue` whenever
    // displaying/computing anything tied to the selected month.
    monthContractValue,
    // Fixed-fee clients only: where the selected month sits in the service window
    // (position / total, isBillingMonth, inWindow) and the last day of service.
    cycle: fixed ? fixedCycleInfo(client, curYear, curMonth) : null,
    serviceEndDate: fixed ? fixedServiceEndDate(client) : null,
    selPaid,
    selRemaining,
    selPayment: selPayments[0] || null,
    status,
    // All-time fields (used in detail page)
    receivedAmount: totalReceived,
    totalDue,
    pendingAmount,
    monthLedger: ledger,
  };
};

exports.getClients = async (req, res) => {
  try {
    const { search, status, month, year } = req.query;
    const tMonth = month ? parseInt(month) : null;
    const tYear  = year  ? parseInt(year)  : null;

    let clients = await Client.find(
      search ? { name: { $regex: search, $options: 'i' } } : {}
    ).sort({ sortOrder: 1, createdAt: -1 });

    const withStats = await Promise.all(clients.map(c => getClientWithStats(c, tMonth, tYear)));
    // A client shouldn't appear at all for months before their contract started,
    // or for any month after their contract ended (see completeClient).
    const started   = (tMonth && tYear) ? withStats.filter(c => c.hasStarted && !c.ended) : withStats;
    const filtered  = status ? started.filter(c => c.status === status) : started;
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });
    const payments    = await Payment.find({ clientId: client._id }).sort({ year: -1, month: -1, paymentDate: -1 });
    const stats       = await getClientWithStats(client);
    res.json({ ...stats, payments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Keep billingType and durationMonths consistent: a fixed client needs a whole
// number of months (min 1); a monthly client has no duration.
const normaliseBilling = (body) => {
  if (body.billingType === 'fixed') {
    body.durationMonths = Math.max(1, Math.floor(Number(body.durationMonths) || 1));
  } else if (body.billingType === 'monthly') {
    body.durationMonths = 0;
  }
};

exports.createClient = async (req, res) => {
  try {
    const body = { ...req.body };
    normaliseBilling(body);
    // isActive/pauseHistory are managed exclusively through the pause/resume
    // endpoints so history entries can't get out of sync.
    delete body.isActive;
    delete body.pauseHistory;
    delete body.endDate;
    delete body.contractValueOverrides;
    // New clients go to the end of the manually-dragged order, not the top.
    const last = await Client.findOne().sort({ sortOrder: -1 });
    body.sortOrder = (last?.sortOrder ?? -1) + 1;
    const client = await Client.create(body);
    res.status(201).json(client);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.updateClient = async (req, res) => {
  try {
    const body = { ...req.body };
    normaliseBilling(body);
    delete body.isActive;
    delete body.pauseHistory;
    delete body.endDate;
    delete body.contractValueOverrides;
    const client = await Client.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json(client);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Pause a client: stops the client from accruing any new monthly dues from
// this point forward. Everything billed while they were active is untouched.
exports.pauseClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });
    if (isFixed(client)) return res.status(400).json({ message: 'Fixed-fee clients are billed once and cannot be paused — mark them complete instead' });
    if (client.isActive === false) return res.status(400).json({ message: 'Client is already paused' });

    const pausedAt = req.body.pausedAt ? new Date(req.body.pausedAt) : new Date();
    client.isActive = false;
    client.pauseHistory.push({ pausedAt, resumedAt: null });
    await client.save();
    res.json(client);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Resume a paused client: dues start accruing again from the next billing
// date after resumption.
exports.resumeClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });
    if (client.isActive !== false) return res.status(400).json({ message: 'Client is not currently paused' });

    const resumedAt = req.body.resumedAt ? new Date(req.body.resumedAt) : new Date();
    const openPause = [...client.pauseHistory].reverse().find(p => !p.resumedAt);
    if (openPause) openPause.resumedAt = resumedAt;
    client.isActive = true;
    await client.save();
    res.json(client);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Mark a client's contract as complete/ended: from the month AFTER
// endDate's month onward they stop being fetched and billed entirely. The
// end month itself is left untouched — payments already recorded stay intact.
// This is meant to be permanent; if the client comes back later, they should
// be added as a brand-new client rather than reactivated. (reactivateClient
// below exists only as an "undo" for a mistaken completion.)
exports.completeClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });
    if (client.endDate) return res.status(400).json({ message: 'Client is already marked complete' });

    const endDate = req.body.endDate ? new Date(req.body.endDate) : new Date();
    client.endDate = endDate;
    // Close out any still-open pause so history doesn't read as "paused
    // forever" once the contract itself has ended.
    const openPause = [...client.pauseHistory].reverse().find(p => !p.resumedAt);
    if (openPause) openPause.resumedAt = endDate;
    await client.save();
    res.json(client);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Undo a mistaken "mark complete" — clears endDate so the client goes back
// to being tracked normally.
exports.reactivateClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });
    if (!client.endDate) return res.status(400).json({ message: 'Client is not marked complete' });

    client.endDate = null;
    await client.save();
    res.json(client);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Set (or clear) a one-off contract value for a single month. Only that
// (year, month) is affected — every other month keeps using the client's
// normal `contractValue`. Send `value: null` to remove an override and fall
// back to the default again.
exports.setMonthContractValue = async (req, res) => {
  try {
    const { month, year, value } = req.body;
    const m = parseInt(month);
    const y = parseInt(year);
    if (!m || !y) return res.status(400).json({ message: 'month and year are required' });

    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });

    const idx = client.contractValueOverrides.findIndex(o => o.year === y && o.month === m);

    if (value === null || value === undefined || value === '') {
      if (idx !== -1) client.contractValueOverrides.splice(idx, 1);
    } else {
      const v = Number(value);
      if (isNaN(v) || v < 0) return res.status(400).json({ message: 'value must be a non-negative number' });
      if (idx !== -1) client.contractValueOverrides[idx].value = v;
      else client.contractValueOverrides.push({ year: y, month: m, value: v });
    }

    await client.save();
    res.json(client);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.deleteClient = async (req, res) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });
    await Payment.deleteMany({ clientId: req.params.id });
    res.json({ message: 'Client deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Persist a manually dragged order. Body: { order: [clientId, clientId, ...] }
// in the exact order the user dropped them in. Every id in the list gets its
// sortOrder set to its position — this is what makes drag-and-drop survive a
// page refresh.
exports.reorderClients = async (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ message: 'order must be a non-empty array of client ids' });
    }
    await Promise.all(
      order.map((id, index) => Client.findByIdAndUpdate(id, { sortOrder: index }))
    );
    res.json({ message: 'Order saved' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Exposed for other controllers (dashboard) that need pause/due-aware totals
// without duplicating the billing-cycle logic.
exports.computeClientTotals = computeClientTotals;
exports.buildMonthLedger = buildMonthLedger;
exports.hasEndedByMonth = hasEndedByMonth;
exports.contractValueFor = contractValueFor;
exports.isFixed = isFixed;
exports.monthExpectedValue = monthExpectedValue;
exports.fixedMonthValue = fixedMonthValue;