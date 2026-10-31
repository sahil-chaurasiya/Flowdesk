const Task = require('../models/Task');
const Client = require('../models/Client');
const ActivityLog = require('../models/ActivityLog');

/**
 * One-off, idempotent repair for tasks whose client was deleted BEFORE the
 * `clientDeleted` flag existed. Those tasks still point at a Client that no
 * longer exists and were never flagged, so they dropped out of manager
 * scoping and the monthly filters. This finds them, flags them, and
 * restores the client's name from the audit log when possible.
 *
 * Safe to run on every startup: once flagged, tasks are no longer matched.
 */
async function backfillDeletedClientTasks() {
  try {
    const candidates = await Task.distinct('client', {
      client: { $ne: null },
      clientDeleted: { $ne: true },
    });
    if (!candidates.length) return;

    const existing = await Client.find({ _id: { $in: candidates } }).select('_id').lean();
    const existingIds = new Set(existing.map(c => String(c._id)));
    const orphaned = candidates.filter(id => !existingIds.has(String(id)));
    if (!orphaned.length) return;

    let fixed = 0;
    for (const clientId of orphaned) {
      let name = 'Unknown';
      try {
        const log = await ActivityLog.findOne({ action: 'client.deleted', 'entity.id': clientId })
          .sort({ createdAt: -1 }).lean();
        if (log?.entity?.name) name = log.entity.name;
      } catch { /* name stays 'Unknown' */ }

      const result = await Task.updateMany(
        { client: clientId, clientDeleted: { $ne: true } },
        { clientDeleted: true, deletedClientName: name }
      );
      fixed += result.modifiedCount || 0;
    }
    if (fixed) console.log(`🔧 Flagged ${fixed} task(s) belonging to deleted clients`);
  } catch (err) {
    console.error('[backfillDeletedClientTasks] error:', err.message);
  }
}

module.exports = backfillDeletedClientTasks;