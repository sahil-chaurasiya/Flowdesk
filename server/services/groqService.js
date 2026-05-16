/**
 * Groq AI Service — FlowDesk
 *
 * Uses llama-3.1-8b-instant — fully free, very fast, low token usage.
 * Context is serialized as compact prose (not raw JSON) to stay well
 * under Groq's free tier TPM limits (20,000 TPM for 8b-instant).
 *
 * SECURITY: Context is always pre-filtered by aiContextBuilder.js.
 * This service never queries the DB directly.
 */

const { buildContext } = require('./aiContextBuilder');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// llama-3.1-8b-instant: free, 20k TPM, 30 req/min — ideal for this
// llama-3.3-70b-versatile: only 12k TPM — too small for large context
const MODEL = 'llama-3.1-8b-instant';

// ─────────────────────────────────────────────────────────────────────────────
// COMPACT CONTEXT SERIALIZERS
// Write human-readable summaries instead of raw JSON blobs.
// Cuts token usage ~70% while keeping all meaningful information.
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return 'no deadline';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function serializeTasks(tasks) {
  if (!tasks?.length) return 'None.';
  return tasks.map(t =>
    `- "${t.title}" | client: ${t.client || '?'} | assigned: ${t.assignedTo || 'unassigned'} | status: ${t.status} | priority: ${t.priority} | deadline: ${fmtDate(t.deadline)}`
  ).join('\n');
}

function serializeClients(clients) {
  if (!clients?.length) return 'None.';
  return clients.map(c =>
    `- ${c.company} (${c.name}) | status: ${c.status} | plan: ${c.plan} | services: ${(c.services || []).join(', ') || 'none'}`
  ).join('\n');
}

function serializeWorkload(workload) {
  if (!workload?.length) return 'None.';
  return workload.map(m =>
    `- ${m.name} (${m.role}): ${m.pendingTasks} pending, ${m.inProgressTasks} in-progress, ${m.reviewTasks} in-review => ${m.totalActiveTasks} active`
  ).join('\n');
}

function serializeReports(reports) {
  if (!reports?.length) return 'None.';
  return reports.map(r => {
    const m = r.metrics || {};
    return `- "${r.title}" | client: ${r.client || '?'} | period: ${r.period} | spend: $${m.adSpend ?? 0}, ROAS: ${m.roas ?? 0}, leads: ${m.leads ?? 0}, conversions: ${m.conversions ?? 0}`;
  }).join('\n');
}

function serializeUpdates(updates) {
  if (!updates?.length) return 'None.';
  return updates.map(u =>
    `- "${u.title}" (${u.type}) | ${u.date || '?'} | client: ${u.client || '?'}`
  ).join('\n');
}

function serializeLeads(leads) {
  if (!leads?.length) return 'None.';
  return leads.map(l =>
    `- ${l.name || 'Unknown'} | status: ${l.status} | campaign: ${l.campaign || '?'} | source: ${l.source || '?'}`
  ).join('\n');
}

function serializeMessages(msgs) {
  if (!msgs?.length) return 'None.';
  return msgs.slice(0, 10).map(m => `- [${m.date}] ${m.from}: ${(m.content || '').slice(0, 80)}`).join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT BUILDER — compact, structured, token-efficient
// ─────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(context) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const base = `You are FlowDesk AI, a premium workplace assistant. Today: ${today}.
User: ${context.userName} | Role: ${context.role}
Be concise, insightful, and precise. Use markdown (bold, bullets, tables) when it helps clarity.
Only reference data provided below. Never invent names, tasks, or metrics. Never expose other users' data.`;

  let ctx = '';

  // ── Admin / Manager ──────────────────────────────────────────────────────
  if (context.scope === 'organization') {
    const snap = context.snapshot || {};
    const ts   = snap.taskSummary || {};

    ctx = `
SCOPE: Organization-wide
Clients: ${snap.totalClients ?? 0} total, ${snap.activeClients ?? 0} active | Team: ${snap.teamSize ?? 0} members
Tasks: ${ts.pending ?? 0} pending, ${ts.in_progress ?? 0} in-progress, ${ts.review ?? 0} in review, ${ts.completed ?? 0} completed

CLIENTS:
${serializeClients(context.clients)}

ALL TASKS:
${serializeTasks(context.tasks)}

TEAM WORKLOAD:
${serializeWorkload(context.teamWorkload)}

UPCOMING DEADLINES (next 7 days):
${serializeTasks(context.upcomingDeadlines)}

OVERDUE ITEMS:
${serializeTasks(context.overdueItems)}

RECENT REPORTS:
${serializeReports(context.recentReports)}
${context.teamMembers?.length ? '\nTEAM MEMBERS:\n' + context.teamMembers.map(m => `- ${m.name} | ${m.role} | ${m.jobTitle || 'N/A'}`).join('\n') : ''}`;

  // ── Team Member ──────────────────────────────────────────────────────────
  } else if (context.scope === 'personal') {
    const snap = context.snapshot || {};
    ctx = `
SCOPE: Personal workspace (only your assigned tasks)
Job Title: ${context.jobTitle || 'N/A'}
My tasks: ${snap.total ?? 0} total | ${snap.byStatus?.pending ?? 0} pending, ${snap.byStatus?.in_progress ?? 0} in-progress, ${snap.byStatus?.review ?? 0} in review | ${snap.urgent ?? 0} urgent | ${snap.overdue ?? 0} overdue

MY TASKS:
${serializeTasks(context.myTasks)}

UPCOMING DEADLINES (next 7 days):
${serializeTasks(context.upcomingDeadlines)}

MY CLIENTS:
${serializeClients(context.myClients)}

RECENT CLIENT UPDATES:
${serializeUpdates(context.recentUpdates)}

MY UPLOADED FILES:
${(context.recentFiles || []).map(f => `- ${f.name} (${f.category}) | client: ${f.client || '?'} | ${f.uploadedAt || '?'}`).join('\n') || 'None.'}`;

  // ── Client ───────────────────────────────────────────────────────────────
  } else if (context.scope === 'client') {
    const cp   = context.clientProfile || {};
    const snap = context.snapshot || {};
    ctx = `
SCOPE: Client portal — only ${cp.company || context.userName}'s data. Never reference other clients.
Company: ${cp.company} | Plan: ${cp.plan} | Status: ${cp.status} | Services: ${(cp.services || []).join(', ') || 'none'}
Tasks: ${snap.total ?? 0} total, ${snap.upcoming ?? 0} due this week

MY PROJECT TASKS (client-visible only):
${serializeTasks(context.tasks)}

TEAM UPDATES:
${serializeUpdates(context.updates)}

PERFORMANCE REPORTS:
${serializeReports(context.reports)}

SHARED FILES:
${(context.files || []).map(f => `- ${f.name} (${f.category}) | ${f.uploadedAt || '?'}`).join('\n') || 'None.'}

MY LEADS:
${serializeLeads(context.leads)}

RECENT CHAT MESSAGES:
${serializeMessages(context.recentMessages)}`;
  }

  return `${base}\n\n---\n${ctx.trim()}\n---\n\nAnswer using only the data above. Be helpful and premium.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// NON-STREAMING
// ─────────────────────────────────────────────────────────────────────────────

async function getAIResponse(user, messages) {
  const context      = await buildContext(user);
  const systemPrompt = buildSystemPrompt(context);

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 800,
      temperature: 0.35,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Groq API error: ${res.status}`);
  }

  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    usage:   data.usage,
    model:   data.model,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STREAMING (SSE)
// ─────────────────────────────────────────────────────────────────────────────

async function streamAIResponse(user, messages, res) {
  const context      = await buildContext(user);
  const systemPrompt = buildSystemPrompt(context);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const groqRes = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 800,
      temperature: 0.35,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
  });

  if (!groqRes.ok) {
    const err = await groqRes.json().catch(() => ({}));
    res.write(`data: ${JSON.stringify({ error: err?.error?.message || 'Groq API error' })}\n\n`);
    res.end();
    return;
  }

  const reader  = groqRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer    = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const chunk = JSON.parse(trimmed.slice(6));
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) res.write(`data: ${JSON.stringify({ delta })}\n\n`);
          if (chunk.choices?.[0]?.finish_reason === 'stop') {
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          }
        } catch { /* skip malformed chunk */ }
      }
    }
  } catch {
    res.write(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`);
  } finally {
    res.end();
  }
}

module.exports = { getAIResponse, streamAIResponse };