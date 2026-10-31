/**
 * backfill-completed-at.js
 *
 * One-time migration: fills in `completedAt` for every Task that's already
 * status: 'completed' but never got the timestamp stamped.
 *
 * Why this happened: the task-update routes used findByIdAndUpdate(), which
 * writes straight to MongoDB and skips the Task model's pre('save') hook —
 * the hook that's supposed to set `completedAt` the moment status becomes
 * 'completed'. That's fixed now (routes/tasks.js + routes/websiteWork.js
 * both save the document normally instead), but tasks completed BEFORE that
 * fix are stuck with a 'completed' status and no completedAt. This script
 * fills those in, using the task's `updatedAt` as the best available proxy
 * for when it was actually completed.
 *
 * Usage (from your server/ directory):
 *   node backfill-completed-at.js
 *
 * Safe to run multiple times — only touches tasks where completedAt is
 * missing. Once run, completed tasks will start showing up correctly in the
 * Developer Dashboard's activity heatmap / "shipped" counts.
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
    status: 'completed',
    $or: [{ completedAt: { $exists: false } }, { completedAt: null }],
  }).toArray();

  if (candidates.length === 0) {
    console.log('Nothing to backfill — every completed task already has completedAt.\n');
    await mongoose.disconnect();
    return;
  }

  let updated = 0;

  for (const t of candidates) {
    // updatedAt is the closest thing we have to "when it was marked
    // completed" for historical rows — it's set on every save, and for most
    // of these the last save WAS the completion.
    const completedAt = t.updatedAt || t.createdAt || new Date();

    await col.updateOne({ _id: t._id }, { $set: { completedAt } });

    console.log(`  ✓  ${(t.title || '(untitled)').slice(0, 60).padEnd(60)} → ${completedAt.toLocaleString('en-IN')}`);
    updated++;
  }

  console.log(`\n── Summary ────────────────────────────────`);
  console.log(`  Backfilled: ${updated}`);
  console.log(`───────────────────────────────────────────`);

  await mongoose.disconnect();
  console.log('\n✅ Done. Refresh the Developer Dashboard — past completions should now show up in the heatmap.\n');
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});