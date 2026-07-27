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
  admin_panel: { label: 'Admin Panel',      icon: LayoutDashboard, tint: '79, 110, 240' },
  hosting:     { label: 'Hosting',          icon: Server,          tint: '234, 88, 12'  },
  domain:      { label: 'Domain Registrar', icon: Globe,           tint: '34, 197, 94'  },
  ftp:         { label: 'FTP / SFTP',       icon: Terminal,        tint: '100, 116, 139'},
  database:    { label: 'Database',         icon: Database,        tint: '14, 165, 183' },
  email:       { label: 'Email',            icon: Mail,            tint: '217, 74, 134' },
  other:       { label: 'Other',            icon: KeyRound,        tint: '148, 148, 148'},
};

const MONO = "'JetBrains Mono', 'Fira Code', 'Ubuntu Mono', 'DejaVu Sans Mono', ui-monospace, Consolas, monospace";

function CopyBtn({ text, field, copied, onCopy }) {
  if (!text) return null;
  const isCopied = copied === field;
  return (
    <button
      onClick={() => onCopy(text, field)}
      className="flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-medium transition-colors shrink-0"
      style={{
        color: isCopied ? '#22c55e' : 'var(--fd-ink-4)',
        background: isCopied ? 'rgba(34,197,94,0.12)' : 'var(--fd-surface-sunken)',
        border: `1px solid ${isCopied ? 'rgba(34,197,94,0.3)' : 'var(--fd-border)'}`,
      }}
      title="Copy"
    >
      {isCopied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
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
    <div
      className="rounded-xl p-4 transition-colors"
      style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `rgba(${meta.tint},0.14)` }}
        >
          <meta.icon size={15} style={{ color: `rgb(${meta.tint})` }} />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-[13.5px] truncate" style={{ color: 'var(--fd-ink-1)' }}>{credential.label}</div>
          <div className="text-[10.5px] font-medium" style={{ color: `rgb(${meta.tint})` }}>{meta.label}</div>
        </div>
      </div>

      {credential.url && (
        <a
          href={credential.url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[11.5px] mb-3 px-2.5 py-1.5 rounded-lg hover:underline w-fit max-w-full"
          style={{ color: 'var(--fd-accent)', background: 'var(--fd-surface)' }}
        >
          <ExternalLink size={11} className="shrink-0" /> <span className="truncate">{credential.url}</span>
        </a>
      )}

      <div className="space-y-2">
        {credential.username && (
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border-subtle)' }}
          >
            <span className="text-[10px] font-medium uppercase tracking-wide shrink-0 w-14" style={{ color: 'var(--fd-ink-5)' }}>User</span>
            <span className="flex-1 truncate text-[12px]" style={{ fontFamily: MONO, color: 'var(--fd-ink-1)' }}>{credential.username}</span>
            <CopyBtn text={credential.username} field="user" copied={copied} onCopy={copy} />
          </div>
        )}
        {credential.password && (
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border-subtle)' }}
          >
            <span className="text-[10px] font-medium uppercase tracking-wide shrink-0 w-14" style={{ color: 'var(--fd-ink-5)' }}>Pass</span>
            <span className="flex-1 truncate text-[12px]" style={{ fontFamily: MONO, color: 'var(--fd-ink-1)' }}>
              {visible ? credential.password : '•'.repeat(Math.min(credential.password.length, 12))}
            </span>
            <button
              onClick={() => setVisible(v => !v)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-medium transition-colors shrink-0"
              style={{ color: 'var(--fd-ink-4)', background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}
              title={visible ? 'Hide' : 'Show'}
            >
              {visible ? <EyeOff size={11} /> : <Eye size={11} />}
              {visible ? 'Hide' : 'Show'}
            </button>
            <CopyBtn text={credential.password} field="pass" copied={copied} onCopy={copy} />
          </div>
        )}
      </div>

      {credential.notes && (
        <p className="text-[11.5px] mt-3 pt-3 whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--fd-ink-4)', borderTop: '1px solid var(--fd-border-subtle)' }}>
          {credential.notes}
        </p>
      )}

      <div className="text-[10.5px] mt-3 pt-3 flex items-center gap-1.5" style={{ color: 'var(--fd-ink-5)', borderTop: '1px solid var(--fd-border-subtle)' }}>
        {credential.myPerms?.isOwner ? (
          <span className="flex items-center gap-1"><Shield size={9} /> Added by you</span>
        ) : (
          <span>Shared by {credential.addedBy?.name || '—'}</span>
        )}
      </div>
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
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
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