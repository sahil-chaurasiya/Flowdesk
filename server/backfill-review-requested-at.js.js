/**
 * backfill-review-requested-at.js
 *
 * One-time migration: fills in `reviewRequestedAt` for every Task that's
 * already status: 'review' but never got the timestamp stamped, because it
 * was moved into review BEFORE the Task model's pre('save') hook knew how
 * to set that field.
 *
 * This is the same situation backfill-completed-at.js fixed for
 * `completedAt` — the field didn't exist yet when the task was saved, so
 * there's nothing for the hook to have set. This script uses the task's
 * `updatedAt` as the best available proxy for when it was actually sent
 * for review (for most of these rows, the last save WAS the move into
 * review).
 *
 * Usage (from your server/ directory):
 *   node backfill-review-requested-at.js
 *
 * Safe to run multiple times — only touches tasks where status is 'review'
 * and reviewRequestedAt is missing. Once run, the Kanban board, task
 * drawers, and My Tasks page will all show a real "sent for review" time
 * for tasks that were already sitting in review.
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/toflymedia';
  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB\n');

  // Raw collection access — avoids pulling in the full Task schema/hooks
  // for what's just a bulk data fix.
  const col = mongoose.connection.collection('tasks');

  const candidates = await col.find({
    status: 'review',
    $or: [{ reviewRequestedAt: { $exists: false } }, { reviewRequestedAt: null }],
  }).toArray();

  if (candidates.length === 0) {
    console.log('Nothing to backfill — every in-review task already has reviewRequestedAt.\n');
    await mongoose.disconnect();
    return;
  }

  let updated = 0;

  for (const t of candidates) {
    const reviewRequestedAt = t.updatedAt || t.createdAt || new Date();

    await col.updateOne({ _id: t._id }, { $set: { reviewRequestedAt } });

    console.log(`  ✓  ${(t.title || '(untitled)').slice(0, 60).padEnd(60)} → ${reviewRequestedAt.toLocaleString('en-IN')}`);
    updated++;
  }

  console.log(`\n── Summary ────────────────────────────────`);
  console.log(`  Backfilled: ${updated}`);
  console.log(`───────────────────────────────────────────`);

  await mongoose.disconnect();
  console.log('\n✅ Done. Refresh Kanban / My Tasks — in-review tasks should now show when they were sent for review.\n');
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});