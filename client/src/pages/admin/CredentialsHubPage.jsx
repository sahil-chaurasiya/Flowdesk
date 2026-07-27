import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookUser, Globe, ChevronRight, Key } from 'lucide-react';
import useAuthStore from '../../context/authStore';
import { PageHeader } from '../../components/shared/LoadingScreen';

// ── Credentials hub ─────────────────────────────────────────────────────────
// Landing page for the sidebar's "Credentials" link. It used to open the
// client-credentials table directly; now it opens here first so any team
// member can get to the credentials that are actually relevant to them —
// client platform logins (managed by admin/manager/developer) or website
// logins that have been shared with them specifically on Website Work
// projects, regardless of role.
function HubCard({ icon: Icon, title, description, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-4 text-left rounded-2xl p-5 w-full transition-all hover:-translate-y-0.5"
      style={{
        background: 'var(--fd-surface)',
        border: '1px solid var(--fd-border)',
        boxShadow: 'var(--fd-shadow-xs, none)',
      }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'rgba(var(--fd-accent-rgb),0.12)' }}
      >
        <Icon size={20} style={{ color: 'var(--fd-accent)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[14.5px]" style={{ color: 'var(--fd-ink-1)' }}>{title}</div>
        <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>{description}</div>
      </div>
      <ChevronRight
        size={18}
        className="shrink-0 transition-transform group-hover:translate-x-0.5"
        style={{ color: 'var(--fd-ink-5)' }}
      />
    </button>
  );
}

export default function CredentialsHubPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  // Client credentials (social/ad platform logins) are managed by admin,
  // manager and developer — same access this section has always had. Every
  // team member can have Website Work credentials shared with them though,
  // so that card is always shown.
  const canSeeClientCreds = ['admin', 'manager', 'developer'].includes(user?.role);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Credentials"
        subtitle="Choose what you're looking for"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        {canSeeClientCreds && (
          <HubCard
            icon={BookUser}
            title="Client Credentials"
            description="Social media, ads & platform logins for clients"
            onClick={() => navigate('/admin/credentials/clients')}
          />
        )}
        <HubCard
          icon={Globe}
          title="Website Credentials"
          description="Logins for websites that have been shared with you"
          onClick={() => navigate('/admin/credentials/websites')}
        />
      </div>

      {!canSeeClientCreds && (
        <p className="text-[12px] flex items-center gap-1.5 max-w-2xl" style={{ color: 'var(--fd-ink-5)' }}>
          <Key size={12} /> Client credentials are managed by admins, managers and developers.
        </p>
      )}
    </div>
  );
}