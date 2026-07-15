const WebsiteProject = require('../models/WebsiteProject');

// ─────────────────────────────────────────────────────────────────────────────
// UPTIME MONITOR — pings each Website Work project's `liveUrl` and records
// whether it's up or down. Used by:
//   - the scheduled sweep in index.js (checks every project periodically)
//   - the on-demand "check now" route in routes/websiteWork.js
// Powers the (previously fake) uptime readout on the Developer Dashboard.
// ─────────────────────────────────────────────────────────────────────────────

// How many past checks we keep per project, for a small sparkline/history view.
const HISTORY_LIMIT = 40;

// How long we wait for a liveUrl to respond before treating it as down.
const CHECK_TIMEOUT_MS = 10000;

// How many projects we ping in parallel during a sweep, so a long list of
// projects doesn't fire off dozens of simultaneous requests at once.
const BATCH_SIZE = 5;

// Ping a single URL. Never throws — always resolves to a result object.
async function pingUrl(url) {
  const startedAt = Date.now();

  const attempt = (method) => fetch(url, {
    method,
    redirect: 'follow',
    signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
  });

  try {
    // HEAD is cheaper; fall back to GET if the host rejects/doesn't support it.
    let res;
    try {
      res = await attempt('HEAD');
      if (res.status === 405 || res.status === 501) {
        res = await attempt('GET');
      }
    } catch {
      res = await attempt('GET');
    }

    const responseTimeMs = Date.now() - startedAt;
    // Anything under 500 means the server answered (a 404 is still "up").
    const up = res.status < 500;
    return { up, statusCode: res.status, responseTimeMs, error: null };
  } catch (err) {
    const responseTimeMs = Date.now() - startedAt;
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    return {
      up: false,
      statusCode: null,
      responseTimeMs,
      error: isTimeout ? 'Timed out' : (err.message || 'Request failed'),
    };
  }
}

// Check one project's liveUrl and persist the result on the document.
// `project` should be a Mongoose document (not .lean()) since we call .save().
// Returns the new `uptime` subdocument, or null if the project has no liveUrl.
async function checkProject(project) {
  if (!project?.liveUrl?.trim()) return null;

  const result = await pingUrl(project.liveUrl.trim());
  const checkedAt = new Date();

  const history = [
    ...(project.uptime?.history || []),
    {
      checkedAt,
      up: result.up,
      statusCode: result.statusCode,
      responseTimeMs: result.responseTimeMs,
    },
  ].slice(-HISTORY_LIMIT);

  project.uptime = {
    status: result.up ? 'up' : 'down',
    lastCheckedAt: checkedAt,
    statusCode: result.statusCode,
    responseTimeMs: result.responseTimeMs,
    error: result.error,
    history,
  };

  await project.save();
  return project.uptime;
}

// Sweep every project that has a liveUrl set. Called on a timer from index.js.
// Individual failures are caught per-project so one bad host can't stop the
// rest of the sweep.
async function checkAllProjects() {
  const projects = await WebsiteProject.find({ liveUrl: { $exists: true, $ne: '' } });
  if (projects.length === 0) return { checked: 0, total: 0 };

  let checked = 0;
  for (let i = 0; i < projects.length; i += BATCH_SIZE) {
    const batch = projects.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (p) => {
      try {
        await checkProject(p);
        checked += 1;
      } catch (err) {
        console.error(`[uptimeMonitor] Failed to check "${p.name}":`, err.message);
      }
    }));
  }
  return { checked, total: projects.length };
}

module.exports = { pingUrl, checkProject, checkAllProjects };