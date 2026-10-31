const Freelancer = require('../models/Freelancer');
const FreelancerJob = require('../models/FreelancerJob');
const FreelancerPayment = require('../models/FreelancerPayment');
const Client = require('../models/Client');

// ---------------------------------------------------------------------------
// Money helpers
// ---------------------------------------------------------------------------
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const sum = (arr, fn) => round2(arr.reduce((s, x) => s + (Number(fn(x)) || 0), 0));

const monthRange = (month, year) => ({
  start: new Date(year, month - 1, 1),
  end: new Date(year, month, 0, 23, 59, 59),
});

// What a single job looks like financially, given the payments made against it.
//   payable  — the total we owe for this job (agreed fee + extras)
//   paid     — what we've actually paid so far
//   pending  — what's still left to pay
// A cancelled job owes nothing further: whatever was already paid stays in the
// books, but it never shows up as pending.
function jobFinancials(job, payments) {
  const paid = sum(payments, (p) => p.amount);
  const gross = round2((job.agreedAmount || 0) + (job.extraCharges || 0));
  const cancelled = job.status === 'Cancelled';
  const payable = cancelled ? paid : gross;
  const pending = cancelled ? 0 : round2(Math.max(0, gross - paid));

  let paymentStatus;
  if (cancelled) paymentStatus = 'Closed';
  else if (gross > 0 && paid > gross) paymentStatus = 'Overpaid';
  else if (gross > 0 && paid >= gross) paymentStatus = 'Paid';
  else if (paid > 0) paymentStatus = 'Partial';
  else paymentStatus = 'Unpaid';

  const sorted = [...payments].sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
  return {
    payable,
    paid,
    pending,
    paymentStatus,
    lastPaymentDate: sorted.length ? sorted[0].paymentDate : null,
  };
}

// Group an array by a key (ids are ObjectIds, so stringify).
function groupBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    const k = String(keyFn(item));
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

// Attach financials + that job's payments to each job.
function enrichJobs(jobs, paymentsByJob) {
  return jobs.map((job) => {
    const jobPayments = paymentsByJob.get(String(job._id)) || [];
    const obj = job.toObject ? job.toObject() : job;
    return {
      ...obj,
      ...jobFinancials(job, jobPayments),
      payments: [...jobPayments]
        .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate))
        .map((p) => (p.toObject ? p.toObject() : p)),
    };
  });
}

// Roll a freelancer's jobs + payments up into the numbers that answer
// "how much did we pay them, what's left, and how do they work?".
function buildStats(jobs, payments) {
  const paymentsByJob = groupBy(payments, (p) => p.jobId);
  const fin = jobs.map((j) => ({ job: j, ...jobFinancials(j, paymentsByJob.get(String(j._id)) || []) }));

  const rated = jobs.filter((j) => j.rating > 0);
  const judged = jobs.filter((j) => j.status === 'Completed' && (j.workStatus === 'On Time' || j.workStatus === 'Delayed'));
  const onTime = judged.filter((j) => j.workStatus === 'On Time').length;
  const lastPaid = [...payments].sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate))[0];

  return {
    jobCount: jobs.length,
    activeJobs: jobs.filter((j) => j.status === 'Planned' || j.status === 'In Progress').length,
    completedJobs: jobs.filter((j) => j.status === 'Completed').length,
    // Total we've agreed to pay across non-cancelled jobs (+ whatever was paid on cancelled ones).
    totalPayable: sum(fin, (f) => f.payable),
    totalPaid: sum(payments, (p) => p.amount),
    totalPending: sum(fin, (f) => f.pending),
    // Pending on work that's already finished = money we owe right now.
    payableNow: sum(fin.filter((f) => f.job.status === 'Completed'), (f) => f.pending),
    avgRating: rated.length ? round2(rated.reduce((s, j) => s + j.rating, 0) / rated.length) : null,
    ratedJobs: rated.length,
    onTimeRate: judged.length ? Math.round((onTime / judged.length) * 100) : null,
    lastPaidOn: lastPaid ? lastPaid.paymentDate : null,
  };
}

// ---------------------------------------------------------------------------
// Freelancers
// ---------------------------------------------------------------------------
exports.getFreelancers = async (req, res) => {
  try {
    const [freelancers, jobs, payments] = await Promise.all([
      Freelancer.find().sort({ name: 1 }),
      FreelancerJob.find(),
      FreelancerPayment.find(),
    ]);
    const jobsBy = groupBy(jobs, (j) => j.freelancerId);
    const paysBy = groupBy(payments, (p) => p.freelancerId);
    res.json(freelancers.map((f) => ({
      ...f.toObject(),
      stats: buildStats(jobsBy.get(String(f._id)) || [], paysBy.get(String(f._id)) || []),
    })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getFreelancer = async (req, res) => {
  try {
    const freelancer = await Freelancer.findById(req.params.id);
    if (!freelancer) return res.status(404).json({ message: 'Freelancer not found' });
    const [jobs, payments] = await Promise.all([
      FreelancerJob.find({ freelancerId: freelancer._id }).sort({ createdAt: -1 }),
      FreelancerPayment.find({ freelancerId: freelancer._id }).sort({ paymentDate: -1 }),
    ]);
    const paysByJob = groupBy(payments, (p) => p.jobId);
    const jobTitles = new Map(jobs.map((j) => [String(j._id), j.title]));
    res.json({
      ...freelancer.toObject(),
      stats: buildStats(jobs, payments),
      jobs: enrichJobs(jobs, paysByJob),
      payments: payments.map((p) => ({ ...p.toObject(), jobTitle: jobTitles.get(String(p.jobId)) || '' })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const FREELANCER_FIELDS = ['name', 'role', 'phone', 'email', 'city', 'upiId', 'bankDetails', 'notes', 'isActive'];
const pick = (obj, keys) => keys.reduce((acc, k) => (obj[k] !== undefined ? { ...acc, [k]: obj[k] } : acc), {});

exports.createFreelancer = async (req, res) => {
  try {
    const freelancer = await Freelancer.create(pick(req.body, FREELANCER_FIELDS));
    res.status(201).json(freelancer);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.updateFreelancer = async (req, res) => {
  try {
    const freelancer = await Freelancer.findByIdAndUpdate(
      req.params.id, pick(req.body, FREELANCER_FIELDS), { new: true, runValidators: true }
    );
    if (!freelancer) return res.status(404).json({ message: 'Freelancer not found' });
    res.json(freelancer);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Payments are real expenses in the books, so a freelancer who has been paid is
// never hard-deleted — they're marked inactive instead and their history stays.
// One who was never paid anything can be removed (along with their unpaid jobs).
exports.deleteFreelancer = async (req, res) => {
  try {
    const freelancer = await Freelancer.findById(req.params.id);
    if (!freelancer) return res.status(404).json({ message: 'Freelancer not found' });
    const paymentCount = await FreelancerPayment.countDocuments({ freelancerId: freelancer._id });
    if (paymentCount > 0) {
      return res.status(400).json({
        message: `${freelancer.name} has ${paymentCount} payment${paymentCount === 1 ? '' : 's'} on record, so can't be deleted (it would change your past expenses). Mark them inactive instead.`,
      });
    }
    await FreelancerJob.deleteMany({ freelancerId: freelancer._id });
    await freelancer.deleteOne();
    res.json({ message: 'Freelancer deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------
const JOB_FIELDS = [
  'freelancerId', 'title', 'description', 'clientId', 'clientName',
  'startDate', 'dueDate', 'completedDate',
  'rateType', 'rate', 'quantity', 'unitLabel', 'extraCharges', 'extraChargesNote',
  'status', 'workStatus', 'rating', 'feedback',
];
const DATE_FIELDS = ['startDate', 'dueDate', 'completedDate'];

// Blank date inputs arrive as '' and would fail Mongoose's Date cast.
function cleanJobBody(body) {
  const data = pick(body, JOB_FIELDS);
  DATE_FIELDS.forEach((k) => { if (data[k] === '') data[k] = null; });
  if (data.clientId === '') data.clientId = null;
  if (data.rating === '' || data.rating === null) data.rating = 0;
  ['rate', 'quantity', 'extraCharges', 'rating'].forEach((k) => { if (data[k] !== undefined) data[k] = Number(data[k]) || 0; });
  return data;
}

// If the job is linked to a client record, keep a snapshot of its name.
async function resolveClientName(data) {
  if (data.clientId) {
    const client = await Client.findById(data.clientId).select('name');
    if (!client) return { error: 'Client not found' };
    data.clientName = client.name;
  }
  return {};
}

exports.getJobs = async (req, res) => {
  try {
    const { freelancerId, clientId, status } = req.query;
    const filter = {};
    if (freelancerId) filter.freelancerId = freelancerId;
    if (clientId) filter.clientId = clientId;
    if (status) filter.status = status;
    const jobs = await FreelancerJob.find(filter).populate('freelancerId', 'name role').sort({ createdAt: -1 });
    const payments = await FreelancerPayment.find({ jobId: { $in: jobs.map((j) => j._id) } });
    const paysByJob = groupBy(payments, (p) => p.jobId);
    let result = enrichJobs(jobs, paysByJob);
    if (req.query.paymentStatus) result = result.filter((j) => j.paymentStatus === req.query.paymentStatus);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createJob = async (req, res) => {
  try {
    const data = cleanJobBody(req.body);
    const freelancer = await Freelancer.findById(data.freelancerId);
    if (!freelancer) return res.status(404).json({ message: 'Freelancer not found' });
    const { error } = await resolveClientName(data);
    if (error) return res.status(404).json({ message: error });
    if (data.status === 'Completed' && !data.completedDate) data.completedDate = new Date();
    const job = await FreelancerJob.create(data);
    res.status(201).json(job);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.updateJob = async (req, res) => {
  try {
    const job = await FreelancerJob.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    const data = cleanJobBody(req.body);
    delete data.freelancerId; // a job never moves between freelancers — payments are tied to the original one
    const { error } = await resolveClientName(data);
    if (error) return res.status(404).json({ message: error });
    if (data.clientId === null && data.clientName === undefined) data.clientName = '';
    if (data.status !== undefined) {
      if (data.status === 'Completed' && !data.completedDate) data.completedDate = job.completedDate || new Date();
      if (data.status !== 'Completed') data.completedDate = null;
    }
    Object.assign(job, data);
    await job.save(); // save() (not findByIdAndUpdate) so agreedAmount is recomputed
    res.json(job);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.deleteJob = async (req, res) => {
  try {
    const job = await FreelancerJob.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    const paymentCount = await FreelancerPayment.countDocuments({ jobId: job._id });
    if (paymentCount > 0) {
      return res.status(400).json({
        message: `This job has ${paymentCount} payment${paymentCount === 1 ? '' : 's'} recorded. Delete those payments first (or mark the job Cancelled to keep the history).`,
      });
    }
    await job.deleteOne();
    res.json({ message: 'Job deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
const PAYMENT_FIELDS = ['amount', 'paymentDate', 'paymentMethod', 'paymentType', 'reference', 'remarks'];

exports.getPayments = async (req, res) => {
  try {
    const { freelancerId, jobId, month, year } = req.query;
    const filter = {};
    if (freelancerId) filter.freelancerId = freelancerId;
    if (jobId) filter.jobId = jobId;
    if (month && year) {
      const { start, end } = monthRange(parseInt(month), parseInt(year));
      filter.paymentDate = { $gte: start, $lte: end };
    }
    const payments = await FreelancerPayment.find(filter)
      .populate('freelancerId', 'name role')
      .populate('jobId', 'title')
      .sort({ paymentDate: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createPayment = async (req, res) => {
  try {
    const body = pick(req.body, PAYMENT_FIELDS);
    const job = await FreelancerJob.findById(req.body.jobId);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (!(Number(body.amount) > 0)) return res.status(400).json({ message: 'Amount must be greater than 0' });
    if (!body.paymentDate) body.paymentDate = new Date();
    // The freelancer always comes from the job, so the two can never disagree.
    const payment = await FreelancerPayment.create({ ...body, amount: Number(body.amount), jobId: job._id, freelancerId: job.freelancerId });
    res.status(201).json(payment);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.updatePayment = async (req, res) => {
  try {
    const body = pick(req.body, PAYMENT_FIELDS);
    if (body.amount !== undefined) {
      body.amount = Number(body.amount);
      if (!(body.amount > 0)) return res.status(400).json({ message: 'Amount must be greater than 0' });
    }
    const payment = await FreelancerPayment.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    res.json(payment);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.deletePayment = async (req, res) => {
  try {
    const payment = await FreelancerPayment.findByIdAndDelete(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    res.json({ message: 'Payment deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------------------------------------------------------------------
// Monthly overview — what we paid freelancers in a month, plus what's still owed.
// ---------------------------------------------------------------------------
exports.getMonthlySummary = async (req, res) => {
  try {
    const month = parseInt(req.params.month);
    const year = parseInt(req.params.year);
    const { start, end } = monthRange(month, year);

    const [payments, jobs, allPayments] = await Promise.all([
      FreelancerPayment.find({ paymentDate: { $gte: start, $lte: end } })
        .populate('freelancerId', 'name role')
        .populate('jobId', 'title')
        .sort({ paymentDate: -1 }),
      FreelancerJob.find().populate('freelancerId', 'name role'),
      FreelancerPayment.find(),
    ]);

    // Payments whose freelancer/job was removed can't be labelled, but still count as money out.
    const byFreelancerMap = new Map();
    payments.forEach((p) => {
      const f = p.freelancerId;
      const key = f ? String(f._id) : 'unknown';
      if (!byFreelancerMap.has(key)) byFreelancerMap.set(key, { freelancerId: f ? f._id : null, name: f ? f.name : 'Unknown', role: f ? f.role : '', paid: 0, count: 0 });
      const row = byFreelancerMap.get(key);
      row.paid = round2(row.paid + p.amount);
      row.count += 1;
    });
    const byFreelancer = [...byFreelancerMap.values()].sort((a, b) => b.paid - a.paid);

    const paysByJob = groupBy(allPayments, (p) => p.jobId);
    const open = enrichJobs(jobs, paysByJob).filter((j) => j.status !== 'Cancelled' && j.pending > 0);
    const owedNow = open.filter((j) => j.status === 'Completed');
    const committed = open.filter((j) => j.status !== 'Completed');

    res.json({
      month,
      year,
      totalPaid: sum(payments, (p) => p.amount),
      paymentCount: payments.length,
      freelancersPaid: byFreelancer.length,
      byFreelancer,
      payments,
      // Work finished but not (fully) paid for — we owe this right now.
      payableNow: sum(owedNow, (j) => j.pending),
      // Work still running / planned — agreed, but not due yet.
      committed: sum(committed, (j) => j.pending),
      activeJobs: jobs.filter((j) => j.status === 'Planned' || j.status === 'In Progress').length,
      dueJobs: owedNow
        .map((j) => ({
          _id: j._id, title: j.title, pending: j.pending, paymentStatus: j.paymentStatus,
          freelancerId: j.freelancerId ? j.freelancerId._id : null,
          freelancerName: j.freelancerId ? j.freelancerId.name : 'Unknown',
        }))
        .sort((a, b) => b.pending - a.pending),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};