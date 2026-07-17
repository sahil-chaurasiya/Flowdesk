/**
 * DevTerminal — FlowDesk "flowdesk-cli"
 *
 * A hacker-style command-line panel available only to the Software
 * Developer role. It talks to the exact same REST endpoints the normal
 * admin pages use (server/routes/tasks.js, websiteWork.js, calendar.js,
 * updates.js, files.js, credentials.js, users.js, clients.js, search.js) —
 * nothing new on the backend, this is purely a terminal-shaped client for
 * data that already exists.
 *
 * Everything the Software Developer role can see in the app is fetchable,
 * viewable, creatable and editable here through a small set of resource
 * commands (`tasks`, `projects`, `ptasks`, `calendar`, `updates`, `files`,
 * `creds`, `team`, `clients`) plus a couple of general ones (`help`,
 * `clear`, `whoami`, `theme`, `search`, `stats`, `exit`). Run `help` inside
 * the terminal for the full reference.
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Terminal as TerminalIcon, X, Circle } from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { useTheme } from '../../context/ThemeContext';
import { formatDate, timeAgo } from '../../lib/utils';

const MONO = 'var(--fd-mono, ui-monospace, monospace)';

// ── tiny arg parser ──────────────────────────────────────────────────────────
// Splits on whitespace but keeps "quoted strings" and 'single quoted' intact,
// then separates --flag=value / --flag "value" pairs from plain positionals.
function tokenize(input) {
  const tokens = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(input)) !== null) {
    tokens.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]);
  }
  return tokens;
}

function parseArgs(tokens) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.startsWith('--')) {
      const eq = t.indexOf('=');
      if (eq !== -1) {
        flags[t.slice(2, eq)] = t.slice(eq + 1);
      } else {
        const next = tokens[i + 1];
        if (next !== undefined && !next.startsWith('--')) {
          flags[t.slice(2)] = next;
          i++;
        } else {
          flags[t.slice(2)] = true;
        }
      }
    } else {
      positional.push(t);
    }
  }
  return { positional, flags };
}

function shortId(id = '') {
  return String(id).slice(-7);
}

// Resolve a user-typed id (full Mongo ObjectId OR a short trailing-hash like
// the app's own `shortHash()` on the Developer Dashboard) against the last
// list fetched for that resource. Tolerant of the "#" prefix shown in list
// output and any stray <angle brackets> or whitespace someone pastes in.
function resolveId(cache, idArg) {
  if (!idArg) return null;
  const clean = String(idArg).trim().replace(/^[<#]+|[>#]+$/g, '');
  if (/^[a-f0-9]{24}$/i.test(clean)) return clean;
  const hit = (cache || []).find(
    it => String(it._id).toLowerCase().endsWith(clean.toLowerCase())
  );
  return hit ? hit._id : clean;
}

function findInCache(cache, idArg) {
  const id = resolveId(cache, idArg);
  return (cache || []).find(it => String(it._id) === String(id)) || null;
}

function errMsg(err) {
  return err?.response?.data?.message || err?.message || 'Unknown error';
}

function qs(params = {}) {
  const parts = [];
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  });
  return parts.length ? `?${parts.join('&')}` : '';
}

// ── static help text ─────────────────────────────────────────────────────────
const HELP_GENERAL = [
  ['help [command]', 'list all commands, or details on one'],
  ['clear', 'clear the screen'],
  ['whoami', 'show your identity, role & session info'],
  ['date', 'show the current date & time'],
  ['history', 'show your command history'],
  ['theme [id]', 'list / switch your developer colour theme'],
  ['search <query>', 'global search across the whole workspace'],
  ['stats', 'quick pull of your dashboard numbers'],
  ['exit / quit', 'close the terminal'],
];

const RESOURCE_HELP = {
  tasks: {
    desc: 'your tasks (My Tasks — assigned to you)',
    cmds: [
      ['tasks ls [status]', 'list your tasks, optionally filtered by status'],
      ['tasks view <id>', 'show full detail for one task'],
      ['tasks create "<title>" [--priority=] [--deadline=YYYY-MM-DD] [--client=<id>] [--desc="..."]', 'create a task, assigned to you'],
      ['tasks edit <id> field=value [field=value...]', 'edit title/description/priority/deadline'],
      ['tasks status <id> <status>', 'pending | in_progress | review | completed'],
      ['tasks rm <id>', 'delete a task'],
    ],
  },
  projects: {
    desc: 'Website Work projects',
    cmds: [
      ['projects ls', 'list all website work projects'],
      ['projects view <id>', 'show full detail for one project'],
      ['projects create "<name>" [--status=] [--priority=] [--repo=url] [--admin=url] [--live=url] [--desc="..."]', 'create a project'],
      ['projects edit <id> field=value [field=value...]', 'edit name/status/priority/repoUrl/adminUrl/liveUrl/notes'],
      ['projects rm <id>', 'delete a project'],
    ],
  },
  ptasks: {
    desc: 'tasks that live under a Website Work project',
    cmds: [
      ['ptasks ls [projectId]', 'list website-work tasks, optionally scoped to a project'],
      ['ptasks view <id>', 'show full detail for one task'],
      ['ptasks create "<title>" --project=<id> [--assignee=<userId>] [--priority=] [--deadline=]', 'create a task under a project'],
      ['ptasks edit <id> field=value [field=value...]', 'edit title/description/priority/deadline/assignedTo'],
      ['ptasks status <id> <status>', 'pending | in_progress | review | completed'],
      ['ptasks rm <id>', 'delete a website-work task'],
    ],
  },
  calendar: {
    desc: 'calendar events',
    cmds: [
      ['calendar ls', 'list upcoming events'],
      ['calendar view <id>', 'show full detail for one event'],
      ['calendar create "<title>" --date=YYYY-MM-DD [--end=YYYY-MM-DD] [--type=] [--client=<id>]', 'create an event'],
      ['calendar edit <id> field=value [field=value...]', 'edit title/type/status/startDate/endDate'],
      ['calendar rm <id>', 'delete an event'],
    ],
  },
  updates: {
    desc: 'client update posts',
    cmds: [
      ['updates ls [--client=<id>]', 'list update posts'],
      ['updates view <id>', 'show full detail for one update'],
      ['updates create "<title>" --client=<id> [--content="..."] [--type=general]', 'post an update'],
      ['updates edit <id> field=value [field=value...]', 'edit title/content/type'],
      ['updates rm <id>', 'delete an update'],
    ],
  },
  files: {
    desc: 'uploaded files',
    cmds: [
      ['files ls [--client=<id>]', 'list files'],
      ['files view <id>', 'show full detail for one file'],
      ['files rm <id>', 'delete a file'],
    ],
  },
  creds: {
    desc: 'credential vault entries',
    cmds: [
      ['creds ls [--client=<id>]', 'list credentials (passwords masked)'],
      ['creds view <id> [--reveal]', 'show one credential, --reveal to show the password'],
      ['creds create "<platform>" --client=<id> [--username=] [--password=] [--label=] [--notes=]', 'add a credential'],
      ['creds edit <id> field=value [field=value...]', 'edit username/password/label/notes'],
      ['creds rm <id>', 'delete a credential'],
    ],
  },
  team: {
    desc: 'team member directory (read-only here)',
    cmds: [
      ['team ls', 'list team members'],
      ['team view <id>', 'show full detail for one team member'],
    ],
  },
  clients: {
    desc: 'client directory (read-only here)',
    cmds: [
      ['clients ls', 'list clients'],
      ['clients view <id>', 'show full detail for one client'],
    ],
  },
};

const RESOURCE_ORDER = ['tasks', 'projects', 'ptasks', 'calendar', 'updates', 'files', 'creds', 'team', 'clients'];

const MOTD = [
  'flowdesk-cli — everything the dashboard shows, minus the mouse.',
  'root access not required. developer access is enough.',
  'tab completion: still todo. patience is a feature.',
  'type "help" to see what this thing can actually do.',
];

export default function DevTerminal({ open, onClose, onToggle }) {
  const { user } = useAuthStore();
  const { devTheme, setDevTheme, devThemes } = useTheme();

  const [lines, setLines] = useState([]);
  const [input, setInput] = useState('');
  const [booted, setBooted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cmdHistory, setCmdHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(null);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const cacheRef = useRef({}); // resource name -> last fetched array (for id resolution)
  const lineIdRef = useRef(0);

  const push = useCallback((entries) => {
    const arr = Array.isArray(entries) ? entries : [entries];
    setLines(prev => [
      ...prev,
      ...arr.map(e => ({ id: ++lineIdRef.current, ...(typeof e === 'string' ? { text: e, tone: 'out' } : e) })),
    ]);
  }, []);

  const clearScreen = useCallback(() => setLines([]), []);

  // Autoscroll to bottom on new output
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines, busy]);

  // Focus input whenever the terminal opens (and after each command)
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  // Boot sequence, once
  useEffect(() => {
    if (!open || booted) return;
    setBooted(true);
    const bootLines = [
      { text: `flowdesk-cli v1.0.0 — booting session for ${user?.name || 'developer'}...`, tone: 'muted' },
      { text: 'mounting /api ... ok', tone: 'muted' },
      { text: `authenticated as ${user?.email || 'unknown'} (${user?.role || 'developer'})`, tone: 'muted' },
      { text: MOTD[Math.floor(Math.random() * MOTD.length)], tone: 'accent' },
      { text: 'type "help" for commands, "clear" to wipe the screen.', tone: 'dim' },
      { text: '', tone: 'out' },
    ];
    let i = 0;
    const timer = setInterval(() => {
      push(bootLines[i]);
      i++;
      if (i >= bootLines.length) clearInterval(timer);
    }, 55);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Global keyboard shortcut: Ctrl + / (or Cmd + / on Mac) toggles the terminal
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        onToggle?.();
      } else if (open && e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onToggle, onClose]);

  // ── list formatting helpers ────────────────────────────────────────────────
  const row = (cols) => cols.filter(Boolean).join('  ·  ');

  const printTable = (items, mapper, emptyMsg) => {
    if (!items.length) {
      push({ text: emptyMsg || '(nothing found)', tone: 'dim' });
      return;
    }
    push(items.map(it => ({ text: `  ${row(mapper(it))}`, tone: 'out' })));
    push({ text: `${items.length} item${items.length === 1 ? '' : 's'}`, tone: 'dim' });
  };

  const printDetail = (title, fields) => {
    push({ text: `── ${title} ──`, tone: 'accent' });
    fields.forEach(([label, value]) => {
      if (value === undefined || value === null || value === '') return;
      push({ text: `  ${String(label).padEnd(14)} ${value}`, tone: 'out' });
    });
  };

  // ── resource engine ────────────────────────────────────────────────────────
  const engine = useMemo(() => ({
    // ── tasks (personal / assigned-to-me) ──────────────────────────────────
    tasks: {
      async ls(pos) {
        const status = pos[0];
        const { data } = await api.get(`/tasks/mine${qs({ status })}`);
        cacheRef.current.tasks = data.tasks || [];
        printTable(cacheRef.current.tasks, t => [
          `#${shortId(t._id)}`,
          t.status?.padEnd(11),
          t.priority?.padEnd(6),
          t.title,
          t.deadline ? `due ${formatDate(t.deadline, 'MMM d')}` : null,
        ], 'no tasks assigned to you.');
      },
      async view(pos) {
        const item = await this.ensure(pos[0]);
        if (!item) return;
        printDetail(item.title, [
          ['id', `#${shortId(item._id)}`],
          ['status', item.status],
          ['priority', item.priority],
          ['client', item.client?.company || item.client?.name],
          ['project', item.websiteProject?.name],
          ['assignedTo', item.assignedTo?.name],
          ['deadline', item.deadline && formatDate(item.deadline, 'MMM d, yyyy')],
          ['completed', item.completedAt && formatDate(item.completedAt, 'MMM d, yyyy')],
          ['updated', item.updatedAt && timeAgo(item.updatedAt)],
          ['description', item.description],
        ]);
      },
      async ensure(idArg) {
        if (!cacheRef.current.tasks) await this.ls([]);
        const item = findInCache(cacheRef.current.tasks, idArg);
        if (!item) push({ text: `tasks: no match for "${idArg}" — run "tasks ls" first`, tone: 'err' });
        return item;
      },
      async create(pos, flags) {
        const title = pos.join(' ').trim();
        if (!title) return push({ text: 'usage: tasks create "<title>" [--priority=] [--deadline=] [--client=] [--desc="..."]', tone: 'err' });
        const { data } = await api.post('/tasks', {
          title,
          description: flags.desc,
          priority: flags.priority || 'medium',
          deadline: flags.deadline || undefined,
          client: flags.client || undefined,
          assignedTo: user?._id,
        });
        push({ text: `created task #${shortId(data.task._id)} "${data.task.title}"`, tone: 'ok' });
      },
      async edit(pos, flags, rest) {
        const item = await this.ensure(pos[0]);
        if (!item) return;
        const updates = fieldsFromRest(rest);
        const { data } = await api.put(`/tasks/${item._id}`, updates);
        push({ text: `updated task #${shortId(data.task._id)}`, tone: 'ok' });
      },
      async status(pos) {
        const item = await this.ensure(pos[0]);
        if (!item) return;
        const status = pos[1];
        if (!status) return push({ text: 'usage: tasks status <id> <pending|in_progress|review|completed>', tone: 'err' });
        const { data } = await api.put(`/tasks/${item._id}`, { status });
        push({ text: `#${shortId(data.task._id)} → ${data.task.status}`, tone: 'ok' });
      },
      async rm(pos) {
        const item = await this.ensure(pos[0]);
        if (!item) return;
        await api.delete(`/tasks/${item._id}`);
        push({ text: `deleted task #${shortId(item._id)}`, tone: 'ok' });
      },
    },

    // ── projects (Website Work) ─────────────────────────────────────────────
    projects: {
      async ls() {
        const { data } = await api.get('/website-work/projects');
        cacheRef.current.projects = data.projects || [];
        printTable(cacheRef.current.projects, p => [
          `#${shortId(p._id)}`,
          p.status?.padEnd(11),
          p.name,
          p.taskStats ? `${p.taskStats.progress}% (${p.taskStats.completed}/${p.taskStats.total})` : null,
          p.liveUrl ? p.liveUrl : null,
        ], 'no website work projects yet.');
      },
      async ensure(idArg) {
        if (!cacheRef.current.projects) await this.ls([]);
        const item = findInCache(cacheRef.current.projects, idArg);
        if (!item) push({ text: `projects: no match for "${idArg}" — run "projects ls" first`, tone: 'err' });
        return item;
      },
      async view(pos) {
        const item = await this.ensure(pos[0]);
        if (!item) return;
        printDetail(item.name, [
          ['id', `#${shortId(item._id)}`],
          ['status', item.status],
          ['priority', item.priority],
          ['client', item.client?.company || item.client?.name],
          ['repoUrl', item.repoUrl],
          ['adminUrl', item.adminUrl],
          ['liveUrl', item.liveUrl],
          ['uptime', item.uptime?.status],
          ['deadline', item.deadline && formatDate(item.deadline, 'MMM d, yyyy')],
          ['progress', item.taskStats && `${item.taskStats.progress}% (${item.taskStats.completed}/${item.taskStats.total} tasks)`],
          ['description', item.description],
          ['notes', item.notes],
        ]);
      },
      async create(pos, flags) {
        const name = pos.join(' ').trim();
        if (!name) return push({ text: 'usage: projects create "<name>" [--status=] [--priority=] [--repo=] [--admin=] [--live=] [--desc="..."]', tone: 'err' });
        const { data } = await api.post('/website-work/projects', {
          name,
          description: flags.desc,
          status: flags.status || 'planning',
          priority: flags.priority || 'medium',
          repoUrl: flags.repo,
          adminUrl: flags.admin,
          liveUrl: flags.live,
        });
        push({ text: `created project #${shortId(data.project._id)} "${data.project.name}"`, tone: 'ok' });
      },
      async edit(pos, flags, rest) {
        const item = await this.ensure(pos[0]);
        if (!item) return;
        const updates = fieldsFromRest(rest);
        const { data } = await api.put(`/website-work/projects/${item._id}`, updates);
        push({ text: `updated project #${shortId(data.project._id)}`, tone: 'ok' });
      },
      async rm(pos) {
        const item = await this.ensure(pos[0]);
        if (!item) return;
        await api.delete(`/website-work/projects/${item._id}`);
        push({ text: `deleted project #${shortId(item._id)}`, tone: 'ok' });
      },
    },

    // ── ptasks (Website Work tasks) ─────────────────────────────────────────
    ptasks: {
      async ls(pos) {
        const project = pos[0] ? resolveId(cacheRef.current.projects, pos[0]) : undefined;
        const { data } = await api.get(`/website-work/tasks${qs({ project })}`);
        cacheRef.current.ptasks = data.tasks || [];
        printTable(cacheRef.current.ptasks, t => [
          `#${shortId(t._id)}`,
          t.status?.padEnd(11),
          t.priority?.padEnd(6),
          t.title,
          t.websiteProject?.name ? `[${t.websiteProject.name}]` : null,
          t.assignedTo?.name ? `→ ${t.assignedTo.name}` : null,
        ], 'no website-work tasks yet.');
      },
      async ensure(idArg) {
        if (!cacheRef.current.ptasks) await this.ls([]);
        const item = findInCache(cacheRef.current.ptasks, idArg);
        if (!item) push({ text: `ptasks: no match for "${idArg}" — run "ptasks ls" first`, tone: 'err' });
        return item;
      },
      async view(pos) {
        const item = await this.ensure(pos[0]);
        if (!item) return;
        printDetail(item.title, [
          ['id', `#${shortId(item._id)}`],
          ['status', item.status],
          ['priority', item.priority],
          ['project', item.websiteProject?.name],
          ['assignedTo', item.assignedTo?.name],
          ['createdBy', item.createdBy?.name],
          ['deadline', item.deadline && formatDate(item.deadline, 'MMM d, yyyy')],
          ['description', item.description],
        ]);
      },
      async create(pos, flags) {
        const title = pos.join(' ').trim();
        const projectId = flags.project && resolveId(cacheRef.current.projects, flags.project);
        if (!title || !projectId) return push({ text: 'usage: ptasks create "<title>" --project=<id> [--assignee=] [--priority=] [--deadline=]', tone: 'err' });
        const { data } = await api.post('/website-work/tasks', {
          title,
          websiteProject: projectId,
          assignedTo: flags.assignee ? resolveId(cacheRef.current.team, flags.assignee) : undefined,
          priority: flags.priority || 'medium',
          deadline: flags.deadline || undefined,
        });
        push({ text: `created website-work task #${shortId(data.task._id)} "${data.task.title}"`, tone: 'ok' });
      },
      async edit(pos, flags, rest) {
        const item = await this.ensure(pos[0]);
        if (!item) return;
        const updates = fieldsFromRest(rest);
        const { data } = await api.put(`/website-work/tasks/${item._id}`, updates);
        push({ text: `updated website-work task #${shortId(data.task._id)}`, tone: 'ok' });
      },
      async status(pos) {
        const item = await this.ensure(pos[0]);
        if (!item) return;
        const status = pos[1];
        if (!status) return push({ text: 'usage: ptasks status <id> <pending|in_progress|review|completed>', tone: 'err' });
        const { data } = await api.put(`/website-work/tasks/${item._id}`, { status });
        push({ text: `#${shortId(data.task._id)} → ${data.task.status}`, tone: 'ok' });
      },
      async rm(pos) {
        const item = await this.ensure(pos[0]);
        if (!item) return;
        await api.delete(`/website-work/tasks/${item._id}`);
        push({ text: `deleted website-work task #${shortId(item._id)}`, tone: 'ok' });
      },
    },

    // ── calendar events ──────────────────────────────────────────────────────
    calendar: {
      async ls() {
        const { data } = await api.get('/calendar');
        cacheRef.current.calendar = data.events || [];
        printTable(cacheRef.current.calendar, e => [
          `#${shortId(e._id)}`,
          e.type?.padEnd(13),
          e.status?.padEnd(11),
          e.title,
          e.startDate ? formatDate(e.startDate, 'MMM d, yyyy') : null,
        ], 'no calendar events found.');
      },
      async ensure(idArg) {
        if (!cacheRef.current.calendar) await this.ls([]);
        const item = findInCache(cacheRef.current.calendar, idArg);
        if (!item) push({ text: `calendar: no match for "${idArg}" — run "calendar ls" first`, tone: 'err' });
        return item;
      },
      async view(pos) {
        const item = await this.ensure(pos[0]);
        if (!item) return;
        printDetail(item.title, [
          ['id', `#${shortId(item._id)}`],
          ['type', item.type],
          ['status', item.status],
          ['start', item.startDate && formatDate(item.startDate, 'MMM d, yyyy p')],
          ['end', item.endDate && formatDate(item.endDate, 'MMM d, yyyy p')],
          ['client', item.client?.company || item.client?.name],
          ['description', item.description],
        ]);
      },
      async create(pos, flags) {
        const title = pos.join(' ').trim();
        if (!title || !flags.date) return push({ text: 'usage: calendar create "<title>" --date=YYYY-MM-DD [--end=] [--type=] [--client=]', tone: 'err' });
        const start = `${flags.date}T09:00:00`;
        const end = `${flags.end || flags.date}T10:00:00`;
        const { data } = await api.post('/calendar', {
          title,
          startDate: start,
          endDate: end,
          type: flags.type || 'other',
          client: flags.client || undefined,
        });
        push({ text: `created event #${shortId(data.event._id)} "${data.event.title}"`, tone: 'ok' });
      },
      async edit(pos, flags, rest) {
        const item = await this.ensure(pos[0]);
        if (!item) return;
        const updates = fieldsFromRest(rest);
        const { data } = await api.put(`/calendar/${item._id}`, updates);
        push({ text: `updated event #${shortId(data.event._id)}`, tone: 'ok' });
      },
      async rm(pos) {
        const item = await this.ensure(pos[0]);
        if (!item) return;
        await api.delete(`/calendar/${item._id}`);
        push({ text: `deleted event #${shortId(item._id)}`, tone: 'ok' });
      },
    },

    // ── updates (client update posts) ───────────────────────────────────────
    updates: {
      async ls(pos, flags) {
        const clientId = flags.client && resolveId(cacheRef.current.clients, flags.client);
        const { data } = await api.get(`/updates${qs({ clientId })}`);
        cacheRef.current.updates = data.updates || [];
        printTable(cacheRef.current.updates, u => [
          `#${shortId(u._id)}`,
          u.type?.padEnd(15),
          u.title,
          u.client?.company || u.client?.name,
          u.createdAt && timeAgo(u.createdAt),
        ], 'no updates found.');
      },
      async ensure(idArg) {
        if (!cacheRef.current.updates) await this.ls([], {});
        const item = findInCache(cacheRef.current.updates, idArg);
        if (!item) push({ text: `updates: no match for "${idArg}" — run "updates ls" first`, tone: 'err' });
        return item;
      },
      async view(pos) {
        const item = await this.ensure(pos[0]);
        if (!item) return;
        printDetail(item.title, [
          ['id', `#${shortId(item._id)}`],
          ['type', item.type],
          ['client', item.client?.company || item.client?.name],
          ['author', item.author?.name],
          ['posted', item.createdAt && timeAgo(item.createdAt)],
          ['content', item.content],
        ]);
      },
      async create(pos, flags) {
        const title = pos.join(' ').trim();
        if (!title || !flags.client) return push({ text: 'usage: updates create "<title>" --client=<id> [--content="..."] [--type=general]', tone: 'err' });
        const { data } = await api.post('/updates', {
          title,
          content: flags.content || title,
          type: flags.type || 'general',
          client: resolveId(cacheRef.current.clients, flags.client),
        });
        push({ text: `posted update #${shortId(data.update._id)} "${data.update.title}"`, tone: 'ok' });
      },
      async edit(pos, flags, rest) {
        const item = await this.ensure(pos[0]);
        if (!item) return;
        const updates = fieldsFromRest(rest);
        const { data } = await api.put(`/updates/${item._id}`, updates);
        push({ text: `updated post #${shortId(data.update._id)}`, tone: 'ok' });
      },
      async rm(pos) {
        const item = await this.ensure(pos[0]);
        if (!item) return;
        await api.delete(`/updates/${item._id}`);
        push({ text: `deleted update #${shortId(item._id)}`, tone: 'ok' });
      },
    },

    // ── files ────────────────────────────────────────────────────────────────
    files: {
      async ls(pos, flags) {
        const clientId = flags.client && resolveId(cacheRef.current.clients, flags.client);
        const { data } = await api.get(`/files${qs({ clientId })}`);
        cacheRef.current.files = data.files || [];
        printTable(cacheRef.current.files, f => [
          `#${shortId(f._id)}`,
          f.name,
          f.client?.company || f.client?.name,
          f.available === false ? '(unavailable)' : null,
        ], 'no files found.');
      },
      async ensure(idArg) {
        if (!cacheRef.current.files) await this.ls([], {});
        const item = findInCache(cacheRef.current.files, idArg);
        if (!item) push({ text: `files: no match for "${idArg}" — run "files ls" first`, tone: 'err' });
        return item;
      },
      async view(pos) {
        const item = await this.ensure(pos[0]);
        if (!item) return;
        printDetail(item.name, [
          ['id', `#${shortId(item._id)}`],
          ['client', item.client?.company || item.client?.name],
          ['category', item.category],
          ['uploadedBy', item.uploadedBy?.name],
          ['uploaded', item.createdAt && timeAgo(item.createdAt)],
          ['url', item.url],
        ]);
        push({ text: 'note: uploading new files isn\'t supported in the terminal — use the Files page for that.', tone: 'dim' });
      },
      async rm(pos) {
        const item = await this.ensure(pos[0]);
        if (!item) return;
        await api.delete(`/files/${item._id}`);
        push({ text: `deleted file #${shortId(item._id)}`, tone: 'ok' });
      },
    },

    // ── creds (credential vault) ────────────────────────────────────────────
    creds: {
      async ls(pos, flags) {
        const clientId = flags.client && resolveId(cacheRef.current.clients, flags.client);
        const { data } = await api.get(`/credentials${qs({ clientId })}`);
        cacheRef.current.creds = data.credentials || [];
        printTable(cacheRef.current.creds, c => [
          `#${shortId(c._id)}`,
          c.platform?.padEnd(12),
          c.label || c.username,
          c.client?.company || c.client?.name,
        ], 'no credentials found (or you don\'t have access to this list).');
      },
      async ensure(idArg) {
        if (!cacheRef.current.creds) await this.ls([], {});
        const item = findInCache(cacheRef.current.creds, idArg);
        if (!item) push({ text: `creds: no match for "${idArg}" — run "creds ls" first`, tone: 'err' });
        return item;
      },
      async view(pos, flags) {
        const item = await this.ensure(pos[0]);
        if (!item) return;
        printDetail(item.label || item.platform, [
          ['id', `#${shortId(item._id)}`],
          ['platform', item.platform],
          ['client', item.client?.company || item.client?.name],
          ['username', item.username],
          ['password', flags.reveal ? item.password : item.password ? '••••••••  (add --reveal to show)' : null],
          ['notes', item.notes],
          ['addedBy', item.addedBy?.name],
        ]);
      },
      async create(pos, flags) {
        const platform = pos.join(' ').trim();
        if (!platform || !flags.client) return push({ text: 'usage: creds create "<platform>" --client=<id> [--username=] [--password=] [--label=] [--notes=]', tone: 'err' });
        const { data } = await api.post('/credentials', {
          clientId: resolveId(cacheRef.current.clients, flags.client),
          platform,
          label: flags.label,
          username: flags.username,
          password: flags.password,
          notes: flags.notes,
        });
        push({ text: `created credential #${shortId(data.credential._id)} (${data.credential.platform})`, tone: 'ok' });
      },
      async edit(pos, flags, rest) {
        const item = await this.ensure(pos[0]);
        if (!item) return;
        const updates = fieldsFromRest(rest);
        const { data } = await api.put(`/credentials/${item._id}`, updates);
        push({ text: `updated credential #${shortId(data.credential._id)}`, tone: 'ok' });
      },
      async rm(pos) {
        const item = await this.ensure(pos[0]);
        if (!item) return;
        await api.delete(`/credentials/${item._id}`);
        push({ text: `deleted credential #${shortId(item._id)}`, tone: 'ok' });
      },
    },

    // ── team (read-only) ─────────────────────────────────────────────────────
    team: {
      async ls() {
        const { data } = await api.get('/users?limit=200');
        cacheRef.current.team = data.users || [];
        printTable(cacheRef.current.team, u => [
          `#${shortId(u._id)}`,
          (u.role || '').padEnd(20),
          u.name,
          u.jobTitle,
        ], 'no team members found.');
      },
      async ensure(idArg) {
        if (!cacheRef.current.team) await this.ls([]);
        const item = findInCache(cacheRef.current.team, idArg);
        if (!item) push({ text: `team: no match for "${idArg}" — run "team ls" first`, tone: 'err' });
        return item;
      },
      async view(pos) {
        const item = await this.ensure(pos[0]);
        if (!item) return;
        printDetail(item.name, [
          ['id', `#${shortId(item._id)}`],
          ['role', item.role],
          ['jobTitle', item.jobTitle],
          ['email', item.email],
          ['phone', item.phone],
          ['department', item.department],
        ]);
      },
    },

    // ── clients (read-only) ──────────────────────────────────────────────────
    clients: {
      async ls() {
        const { data } = await api.get('/clients?limit=200');
        cacheRef.current.clients = data.clients || [];
        printTable(cacheRef.current.clients, c => [
          `#${shortId(c._id)}`,
          c.company || c.name,
          c.status,
        ], 'no clients found.');
      },
      async ensure(idArg) {
        if (!cacheRef.current.clients) await this.ls([]);
        const item = findInCache(cacheRef.current.clients, idArg);
        if (!item) push({ text: `clients: no match for "${idArg}" — run "clients ls" first`, tone: 'err' });
        return item;
      },
      async view(pos) {
        const item = await this.ensure(pos[0]);
        if (!item) return;
        printDetail(item.company || item.name, [
          ['id', `#${shortId(item._id)}`],
          ['status', item.status],
          ['contact', item.name],
          ['email', item.email],
          ['phone', item.phone],
        ]);
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [user]);

  function fieldsFromRest(rest) {
    const updates = {};
    rest.forEach(pair => {
      const eq = pair.indexOf('=');
      if (eq === -1) return;
      updates[pair.slice(0, eq)] = pair.slice(eq + 1);
    });
    return updates;
  }

  // ── general commands ───────────────────────────────────────────────────────
  const runGeneral = useCallback(async (cmd, pos, flags) => {
    switch (cmd) {
      case 'help': {
        if (pos[0] && RESOURCE_HELP[pos[0]]) {
          const r = RESOURCE_HELP[pos[0]];
          push({ text: `${pos[0]} — ${r.desc}`, tone: 'accent' });
          r.cmds.forEach(([c, d]) => {
            push({ text: `  ${c}`, tone: 'out' });
            push({ text: `    ${d}`, tone: 'dim' });
          });
          return;
        }
        push({ text: 'general', tone: 'accent' });
        HELP_GENERAL.forEach(([c, d]) => push({ text: `  ${c.padEnd(20)} ${d}`, tone: 'out' }));
        push({ text: '', tone: 'out' });
        push({ text: 'resources — run "help <name>" for full usage', tone: 'accent' });
        RESOURCE_ORDER.forEach(r => push({ text: `  ${r.padEnd(20)} ${RESOURCE_HELP[r].desc}`, tone: 'out' }));
        return;
      }
      case 'clear': clearScreen(); return;
      case 'whoami':
        printDetail('session', [
          ['name', user?.name],
          ['email', user?.email],
          ['role', user?.role],
          ['jobTitle', user?.jobTitle],
          ['id', `#${shortId(user?._id)}`],
        ]);
        return;
      case 'date':
        push({ text: new Date().toString(), tone: 'out' });
        return;
      case 'history':
        if (!cmdHistory.length) return push({ text: '(no history yet)', tone: 'dim' });
        push(cmdHistory.map((c, i) => ({ text: `  ${i + 1}  ${c}`, tone: 'out' })));
        return;
      case 'theme':
        if (!pos[0]) {
          push({ text: 'available themes:', tone: 'accent' });
          push(devThemes.map(t => ({ text: `  ${t.id.padEnd(16)} ${t.label}${t.id === devTheme ? '  (active)' : ''}`, tone: 'out' })));
          push({ text: 'usage: theme <id>', tone: 'dim' });
          return;
        }
        if (!devThemes.some(t => t.id === pos[0])) {
          return push({ text: `unknown theme "${pos[0]}"`, tone: 'err' });
        }
        setDevTheme(pos[0]);
        push({ text: `theme → ${pos[0]}`, tone: 'ok' });
        return;
      case 'search': {
        const query = pos.join(' ').trim();
        if (!query) return push({ text: 'usage: search <query>', tone: 'err' });
        const { data } = await api.get(`/search${qs({ q: query })}`);
        const r = data.results || {};
        const sections = [
          ['tasks', r.tasks], ['websiteProjects', r.websiteProjects], ['clients', r.clients],
          ['users', r.users], ['events', r.events], ['files', r.files],
        ];
        let any = false;
        sections.forEach(([label, items]) => {
          if (!items || !items.length) return;
          any = true;
          push({ text: `${label}:`, tone: 'accent' });
          push(items.slice(0, 8).map(it => ({ text: `  #${shortId(it._id)}  ${it.title || it.name || it.company || it.email}`, tone: 'out' })));
        });
        if (!any) push({ text: `no results for "${query}"`, tone: 'dim' });
        return;
      }
      case 'stats': {
        const [mine, projects] = await Promise.all([
          api.get('/tasks/mine'),
          api.get('/website-work/projects'),
        ]);
        const tasks = mine.data.tasks || [];
        const active = tasks.filter(t => !['completed', 'cancelled'].includes(t.status)).length;
        const done = tasks.filter(t => t.status === 'completed').length;
        printDetail('quick stats', [
          ['your tasks', tasks.length],
          ['active', active],
          ['completed', done],
          ['projects', (projects.data.projects || []).length],
        ]);
        return;
      }
      case 'exit':
      case 'quit':
        onClose();
        return;
      default:
        return null; // not a general command
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmdHistory, devTheme, devThemes, setDevTheme, user, clearScreen, push, onClose]);

  const GENERAL_CMDS = useMemo(() => new Set(['help', 'clear', 'whoami', 'date', 'history', 'theme', 'search', 'stats', 'exit', 'quit']), []);

  const runCommand = useCallback(async (raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    push({ text: trimmed, tone: 'input' });
    setCmdHistory(h => [...h, trimmed]);
    setHistIdx(null);

    const tokens = tokenize(trimmed);
    const [cmd, ...restTokens] = tokens;

    setBusy(true);
    try {
      if (GENERAL_CMDS.has(cmd)) {
        const { positional, flags } = parseArgs(restTokens);
        await runGeneral(cmd, positional, flags);
        return;
      }

      const resource = engine[cmd];
      if (!resource) {
        push({ text: `command not found: "${cmd}" — type "help" for the list of commands.`, tone: 'err' });
        return;
      }

      const [sub, ...argTokens] = restTokens;
      if (!sub) {
        push({ text: `usage: ${cmd} <ls|view|create|edit|rm${resource.status ? '|status' : ''}> ...  —  try "help ${cmd}"`, tone: 'err' });
        return;
      }
      const handler = resource[sub];
      if (!handler) {
        push({ text: `"${cmd}" has no "${sub}" command — try "help ${cmd}"`, tone: 'err' });
        return;
      }
      const { positional, flags } = parseArgs(argTokens);
      await handler.call(resource, positional, flags, argTokens.filter(t => !t.startsWith('--')));
    } catch (err) {
      push({ text: `error: ${errMsg(err)}`, tone: 'err' });
    } finally {
      setBusy(false);
    }
  }, [engine, runGeneral, push, GENERAL_CMDS]);

  const onSubmit = (e) => {
    e.preventDefault();
    if (busy) return;
    const val = input;
    setInput('');
    runCommand(val);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!cmdHistory.length) return;
      const nextIdx = histIdx === null ? cmdHistory.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(nextIdx);
      setInput(cmdHistory[nextIdx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx === null) return;
      const nextIdx = histIdx + 1;
      if (nextIdx >= cmdHistory.length) { setHistIdx(null); setInput(''); }
      else { setHistIdx(nextIdx); setInput(cmdHistory[nextIdx]); }
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 2000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex flex-col w-full"
        style={{
          maxWidth: 860,
          height: 'min(640px, calc(100vh - 48px))',
          background: 'var(--fd-canvas)',
          border: '1px solid var(--fd-accent)',
          borderRadius: 10,
          boxShadow: '0 0 0 1px rgba(0,0,0,0.4), 0 30px 90px rgba(0,0,0,0.55), 0 0 40px -10px var(--fd-accent)',
          overflow: 'hidden',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Kill the app-wide focus-visible ring for just this input — a
            terminal caret shouldn't look like a boxed form field. */}
        <style>{`
          .flowdesk-cli-input,
          .flowdesk-cli-input:focus,
          .flowdesk-cli-input:focus-visible {
            outline: none !important;
            box-shadow: none !important;
            border: none !important;
          }
        `}</style>
        {/* Title bar */}
        <div
          className="flex items-center gap-2 px-3 flex-shrink-0"
          style={{ height: 38, background: 'var(--fd-card-bg)', borderBottom: '1px solid var(--fd-border)' }}
        >
          <div className="flex items-center gap-1.5">
            <Circle size={9} fill="#f85149" stroke="none" />
            <Circle size={9} fill="#d29922" stroke="none" />
            <Circle size={9} fill="#3fb950" stroke="none" />
          </div>
          <div
            className="flex-1 text-center text-[12px] font-medium truncate flex items-center justify-center gap-1.5"
            style={{ fontFamily: MONO, color: 'var(--fd-ink-3)' }}
          >
            <TerminalIcon size={12} />
            {user?.email || 'developer'}@flowdesk-cli — {devTheme}
          </div>
          <button onClick={onClose} className="p-1 rounded hover:opacity-70" style={{ color: 'var(--fd-ink-4)' }} title="Close (Esc)">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-3"
          style={{ fontFamily: MONO, fontSize: 12.5, lineHeight: 1.65, background: 'var(--fd-canvas)' }}
          onClick={() => inputRef.current?.focus()}
        >
          {lines.map(l => <TermLine key={l.id} tone={l.tone} text={l.text} />)}

          {busy && <div style={{ color: 'var(--fd-ink-4)' }}>…</div>}

          {/* Input row */}
          <form onSubmit={onSubmit} className="flex items-center gap-2 mt-0.5">
            <span style={{ color: 'var(--fd-accent)', fontWeight: 700, flexShrink: 0 }}>
              {(user?.name || 'dev').split(' ')[0].toLowerCase()}@flowdesk:~$
            </span>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={busy}
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="flowdesk-cli-input flex-1 bg-transparent outline-none border-none"
              style={{ fontFamily: MONO, fontSize: 12.5, color: 'var(--fd-ink-1)', caretColor: 'var(--fd-accent)' }}
              placeholder={booted ? 'type a command…' : ''}
            />
          </form>
        </div>

        {/* Status bar */}
        <div
          className="flex items-center justify-between px-3 flex-shrink-0"
          style={{ height: 26, background: 'var(--fd-card-bg)', borderTop: '1px solid var(--fd-border)', fontFamily: MONO, fontSize: 10.5, color: 'var(--fd-ink-5)' }}
        >
          <span>flowdesk-cli</span>
          <span>{RESOURCE_ORDER.length} resources · help · Ctrl+/ toggle · Esc close</span>
        </div>
      </div>
    </div>
  );
}

function TermLine({ tone, text }) {
  const TONE_COLOR = {
    input: 'var(--fd-accent)',
    out: 'var(--fd-ink-2)',
    ok: 'var(--fd-status-success-text, #56d364)',
    err: 'var(--fd-status-danger-text, #f85149)',
    accent: 'var(--fd-accent)',
    dim: 'var(--fd-ink-5)',
    muted: 'var(--fd-ink-4)',
  };
  if (tone === 'input') {
    return (
      <div style={{ color: TONE_COLOR.input, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        <span style={{ opacity: 0.6 }}>{'> '}</span>{text}
      </div>
    );
  }
  return (
    <div style={{ color: TONE_COLOR[tone] || TONE_COLOR.out, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {text}
    </div>
  );
}

// ── floating trigger button (bottom-left, developer role only) ───────────────
export function DevTerminalTrigger({ onClick }) {
  return (
    <button
      onClick={onClick}
      title="Open Developer Terminal (Ctrl + /)"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        zIndex: 1000,
        width: '48px',
        height: '48px',
        borderRadius: '10px',
        background: 'var(--fd-card-bg)',
        border: '1px solid var(--fd-accent)',
        color: 'var(--fd-accent)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35), 0 0 20px -6px var(--fd-accent)',
        transition: 'transform 0.15s ease',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.06)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      <TerminalIcon size={20} />
    </button>
  );
}