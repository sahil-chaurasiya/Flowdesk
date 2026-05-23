/**
 * backfill-contracts.js
 * 
 * One-time migration: calculates and stores contractEndDate + contractStatus
 * for every existing client that is missing them.
 * 
 * Usage (from your server/ directory):
 *   node backfill-contracts.js
 * 
 * Safe to run multiple times — only updates clients where contractEndDate is missing.
 */

require('dotenv').config();
const mongoose = require('mongoose');

// ── Inline schema (avoids any import issues) ─────────────────────────────────
const clientSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const Client = mongoose.models.Client || mongoose.model('Client', clientSchema);

// ── Helpers ───────────────────────────────────────────────────────────────────
const PLAN_TO_DURATION = {
  '3_month':  '3_months',
  '6_month':  '6_months',
  '1_year':   '1_year',
  '3_months': '3_months',
  '6_months': '6_months',
};

function calcEndDate(startDate, planDuration) {
  const d = new Date(startDate);
  if (planDuration === '3_months') d.setMonth(d.getMonth() + 3);
  else if (planDuration === '6_months') d.setMonth(d.getMonth() + 6);
  else if (planDuration === '1_year') d.setFullYear(d.getFullYear() + 1);
  else return null;
  return d;
}

function deriveStatus(endDate) {
  if (!endDate) return 'active';
  const days = Math.ceil((new Date(endDate) - Date.now()) / 86400000);
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring_soon';
  return 'active';
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/toflymedia';
  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB\n');

  // Fetch ALL clients (use the raw collection to avoid schema strictness)
  const col = mongoose.connection.collection('clients');
  const clients = await col.find({}).toArray();

  let updated = 0, skipped = 0, noData = 0;

  for (const c of clients) {
    // Skip if already has a contractEndDate
    if (c.contractEndDate) {
      skipped++;
      continue;
    }

    // Resolve planDuration from planDuration or legacy plan field
    const duration = c.planDuration || PLAN_TO_DURATION[c.plan];
    const startDate = c.startDate;

    if (!duration || !startDate) {
      console.log(`  ⚠  Skipping "${c.company || c.name}" — no startDate or planDuration`);
      noData++;
      continue;
    }

    const contractEndDate = calcEndDate(new Date(startDate), duration);
    if (!contractEndDate) {
      console.log(`  ⚠  Skipping "${c.company || c.name}" — unrecognised duration "${duration}"`);
      noData++;
      continue;
    }

    const contractStatus  = deriveStatus(contractEndDate);
    const planDuration    = duration; // ensure planDuration is also stored

    await col.updateOne(
      { _id: c._id },
      { $set: { contractEndDate, contractStatus, planDuration } }
    );

    const days = Math.ceil((contractEndDate - Date.now()) / 86400000);
    console.log(
      `  ✓  ${(c.company || c.name).padEnd(35)} ` +
      `${duration.padEnd(10)} ` +
      `→ ends ${contractEndDate.toLocaleDateString('en-IN')} ` +
      `(${days < 0 ? `${Math.abs(days)}d ago` : `${days}d left`}) ` +
      `[${contractStatus}]`
    );
    updated++;
  }

  console.log(`\n── Summary ────────────────────────────────`);
  console.log(`  Updated : ${updated}`);
  console.log(`  Already had end date: ${skipped}`);
  console.log(`  Skipped (no data)   : ${noData}`);
  console.log(`───────────────────────────────────────────`);

  await mongoose.disconnect();
  console.log('\n✅ Done. Restart your server.\n');
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});