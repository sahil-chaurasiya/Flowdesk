import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, Globe, ExternalLink, Eye, EyeOff, Copy, Check,
  KeyRound, LayoutDashboard, Server, Terminal, Database, Mail, Shield, Code2,
} from 'lucide-react';
import api from '../../lib/api';
import { PageHeader, EmptyState, Card, Spinner } from '../../components/shared/LoadingScreen';

// ── Website Credentials ─────────────────────────────────────────────────────
// Read-only, cross-project view of every website credential that has been
// shared with the current user — pulled from server/routes/websiteWork.js
// GET /my-credentials, which mirrors the same per-credential permission
// rules the Website Work page's Credentials panel enforces. Anyone on the
// team can land here, not just admins/developers; management of who can
// see what still happens on the Website Work page itself.
//
// Deliberately only ever shows a project's admin panel & live links — never
// its GitHub repo URL, which stays admin/developer-only.
const PLATFORM_META = {
  admin_panel: { label: 'Admin Panel',      icon: LayoutDashboard },
  hosting:     { label: 'Hosting',          icon: Server },
  domain:      { label: 'Domain Registrar', icon: Globe },
  ftp:         { label: 'FTP / SFTP',       icon: Terminal },
  database:    { label: 'Database',         icon: Database },
  email:       { label: 'Email',            icon: Mail },
  other:       { label: 'Other',            icon: KeyRound },
};

const MONO = "'JetBrains Mono', 'Fira Code', 'Ubuntu Mono', 'DejaVu Sans Mono', ui-monospace, Consolas, monospace";

function CopyBtn({ text, field, copied, onCopy }) {
  if (!text) return null;
  return (
    <button
      onClick={() => onCopy(text, field)}
      className="p-1 rounded hover:bg-[var(--fd-surface-sunken)] flex-shrink-0"
      style={{ color: 'var(--fd-ink-5)' }}
      title="Copy"
    >
      {copied === field ? <Check size={11} style={{ color: '#22c55e' }} /> : <Copy size={11} />}
    </button>
  );
}

function WebsiteCredentialCard({ credential }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState('');
  const meta = PLATFORM_META[credential.platform] || PLATFORM_META.other;

  const copy = (text, field) => {
    if (!text || !navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(field);
      setTimeout(() => setCopied(''), 1200);
    });
  };

  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}>
      <div className="flex items-center gap-2 mb-2">
        <meta.icon size={14} style={{ color: 'var(--fd-ink-4)', flexShrink: 0 }} />
        <span className="font-semibold text-[13px] truncate" style={{ color: 'var(--fd-ink-1)' }}>{credential.label}</span>
      </div>

      {credential.url && (
        <a
          href={credential.url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[11.5px] mb-2 hover:underline"
          style={{ color: 'var(--fd-accent)' }}
        >
          <ExternalLink size={10} /> <span className="truncate">{credential.url}</span>
        </a>
      )}

      <div className="space-y-1.5">
        {credential.username && (
          <div className="flex items-center gap-2 text-[12px]">
            <span style={{ color: 'var(--fd-ink-5)', width: 60, flexShrink: 0 }}>Username</span>
            <span className="flex-1 truncate" style={{ fontFamily: MONO, color: 'var(--fd-ink-2)' }}>{credential.username}</span>
            <CopyBtn text={credential.username} field="user" copied={copied} onCopy={copy} />
          </div>
        )}
        {credential.password && (
          <div className="flex items-center gap-2 text-[12px]">
            <span style={{ color: 'var(--fd-ink-5)', width: 60, flexShrink: 0 }}>Password</span>
            <span className="flex-1 truncate" style={{ fontFamily: MONO, color: 'var(--fd-ink-2)' }}>
              {visible ? credential.password : '•'.repeat(Math.min(credential.password.length, 12))}
            </span>
            <button onClick={() => setVisible(v => !v)} className="p-1 rounded hover:bg-[var(--fd-surface)] flex-shrink-0" style={{ color: 'var(--fd-ink-5)' }} title={visible ? 'Hide' : 'Show'}>
              {visible ? <EyeOff size={11} /> : <Eye size={11} />}
            </button>
            <CopyBtn text={credential.password} field="pass" copied={copied} onCopy={copy} />
          </div>
        )}
      </div>

      {credential.notes && (
        <p className="text-[11.5px] mt-2 pt-2 whitespace-pre-wrap" style={{ color: 'var(--fd-ink-4)', borderTop: '1px solid var(--fd-border)' }}>
          {credential.notes}
        </p>
      )}

      <p className="text-[10.5px] mt-2 flex items-center gap-1.5" style={{ color: 'var(--fd-ink-5)' }}>
        {credential.myPerms?.isOwner ? (
          <span className="flex items-center gap-1"><Shield size={9} /> Added by you</span>
        ) : (
          <span>Shared by {credential.addedBy?.name || '—'}</span>
        )}
      </p>
    </div>
  );
}

function ProjectGroup({ group, search }) {
  const project = group.project;
  const q = search.toLowerCase();
  const creds = group.credentials.filter(c => {
    if (!q) return true;
    return (
      c.label?.toLowerCase().includes(q) ||
      c.username?.toLowerCase().includes(q) ||
      project?.name?.toLowerCase().includes(q)
    );
  });
  if (!creds.length) return null;

  return (
    <Card>
      <div className="px-5 py-3.5 border-b flex flex-wrap items-center justify-between gap-2" style={{ borderColor: 'var(--fd-border-subtle)' }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(var(--fd-accent-rgb),0.12)' }}>
            <Code2 size={14} style={{ color: 'var(--fd-accent)' }} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-[13px] truncate" style={{ color: 'var(--fd-ink-1)' }}>{project?.name || 'Unknown Project'}</div>
            <div className="text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>{creds.length} credential{creds.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {project?.adminUrl && (
            <a href={project.adminUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11.5px] hover:underline" style={{ color: 'var(--fd-accent)' }}>
              <LayoutDashboard size={11} /> Admin <ExternalLink size={9} />
            </a>
          )}
          {project?.liveUrl && (
            <a href={project.liveUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11.5px] hover:underline" style={{ color: 'var(--fd-accent)' }}>
              <Globe size={11} /> Live Site <ExternalLink size={9} />
            </a>
          )}
        </div>
      </div>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {creds.map(c => <WebsiteCredentialCard key={c._id} credential={c} />)}
      </div>
    </Card>
  );
}

export default function WebsiteCredentialsPage() {
  const navigate = useNavigate();
  const [groups, setGroups]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/website-work/my-credentials');
      setGroups(data.groups || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalCount = groups.reduce((sum, g) => sum + g.credentials.length, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Website Credentials"
        subtitle="Website logins that have been shared with you"
        actions={
          <button
            onClick={() => navigate('/admin/credentials')}
            className="flex items-center gap-1.5 text-[12.5px] font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--fd-ink-3)', border: '1px solid var(--fd-border)' }}
          >
            <ArrowLeft size={13} /> Back
          </button>
        }
      />

      {!loading && totalCount > 0 && (
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fd-ink-4)' }} />
          <input
            className="fd-input pl-9 w-full"
            placeholder="Search by website or label..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
      ) : totalCount === 0 ? (
        <EmptyState
          icon={Globe}
          title="No website credentials shared with you"
          description="When someone on Website Work shares a website credential with you, it'll show up here — along with the site's name and admin/live links."
        />
      ) : (
        <div className="space-y-4">
          {groups.map(g => (
            <ProjectGroup key={g.project?._id || 'unknown'} group={g} search={search} />
          ))}
        </div>
      )}
    </div>
  );
}