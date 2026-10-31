import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookUser, Globe, ArrowRight, Unlock } from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { PageHeader } from '../../components/shared/LoadingScreen';

// ── Credentials hub ─────────────────────────────────────────────────────────
// Landing page for the sidebar's "Credentials" link. It used to open the
// client-credentials table directly; now it opens here first so any team
// member can get to the credentials that are actually relevant to them —
// client platform logins (managed by admin/manager/developer) or website
// logins that have been shared with them specifically on Website Work
// projects, regardless of role.
//
// Clicking a card plays a short "unlock" animation (icon swaps to an open
// padlock inside an expanding ring, card lifts + glows) before routing to
// the destination page, so the navigation feels like it's actually
// unlocking something rather than an instant jump-cut.

const UNLOCK_DELAY = 480; // ms — matches the animation below

function HubCard({ icon: Icon, tint, title, description, count, countLabel, loadingCount, status, onClick }) {
  const isUnlocking = status === 'unlocking';
  const isDimmed = status === 'dimmed';

  return (
    <button
      onClick={onClick}
      disabled={status !== 'idle'}
      className="group relative flex flex-col text-left rounded-2xl p-6 w-full transition-all duration-300"
      style={{
        background: 'var(--fd-surface)',
        border: `1px solid ${isUnlocking ? `rgba(${tint},0.55)` : 'var(--fd-border)'}`,
        boxShadow: isUnlocking
          ? `0 12px 32px -8px rgba(${tint},0.35)`
          : '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.03)',
        opacity: isDimmed ? 0.4 : 1,
        transform: isUnlocking ? 'translateY(-2px) scale(1.015)' : 'none',
        cursor: status === 'idle' ? 'pointer' : 'default',
      }}
      onMouseEnter={e => {
        if (status !== 'idle') return;
        e.currentTarget.style.borderColor = `rgba(${tint},0.4)`;
        e.currentTarget.style.boxShadow = `0 8px 24px -8px rgba(${tint},0.25)`;
      }}
      onMouseLeave={e => {
        if (status !== 'idle') return;
        e.currentTarget.style.borderColor = 'var(--fd-border)';
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.03)';
      }}
    >
      <div className="flex items-center justify-between">
        <div className="relative flex items-center justify-center shrink-0" style={{ width: 48, height: 48 }}>
          {/* Expanding unlock rings */}
          {isUnlocking && (
            <>
              <span
                className="absolute inset-0 rounded-xl animate-ping"
                style={{ background: `rgba(${tint},0.35)` }}
              />
              <span
                className="absolute inset-0 rounded-xl animate-ping"
                style={{ background: `rgba(${tint},0.25)`, animationDelay: '150ms' }}
              />
            </>
          )}
          <div
            className="relative rounded-xl flex items-center justify-center w-full h-full transition-colors duration-300"
            style={{ background: `rgba(${tint},${isUnlocking ? 0.22 : 0.12})` }}
          >
            <Icon
              size={21}
              strokeWidth={1.8}
              style={{
                color: `rgb(${tint})`,
                position: isUnlocking ? 'absolute' : 'static',
                opacity: isUnlocking ? 0 : 1,
                transform: isUnlocking ? 'scale(0.6) rotate(-8deg)' : 'scale(1) rotate(0deg)',
                transition: 'all 260ms ease',
              }}
            />
            <Unlock
              size={21}
              strokeWidth={1.8}
              style={{
                color: `rgb(${tint})`,
                position: isUnlocking ? 'static' : 'absolute',
                opacity: isUnlocking ? 1 : 0,
                transform: isUnlocking ? 'scale(1) rotate(0deg)' : 'scale(0.6) rotate(8deg)',
                transition: 'all 260ms ease 80ms',
              }}
            />
          </div>
        </div>
        <ArrowRight
          size={16}
          className="transition-transform duration-200 group-hover:translate-x-1"
          style={{ color: 'var(--fd-ink-4)', opacity: isUnlocking ? 0 : 1 }}
        />
      </div>

      <h3 className="text-[16px] font-bold mt-4" style={{ color: 'var(--fd-ink-1)' }}>
        {title}
      </h3>
      <p className="text-[13px] mt-1 leading-relaxed" style={{ color: 'var(--fd-ink-4)' }}>
        {description}
      </p>

      <div
        className="flex items-center gap-1.5 mt-5 pt-3.5 text-[12px] font-medium"
        style={{ borderTop: '1px solid var(--fd-border-subtle)', color: 'var(--fd-ink-3)' }}
      >
        {loadingCount ? (
          <span className="inline-block w-24 h-3 rounded animate-pulse" style={{ background: 'var(--fd-surface-sunken)' }} />
        ) : isUnlocking ? (
          <span style={{ color: `rgb(${tint})` }}>Unlocking…</span>
        ) : (
          <span>
            <span style={{ color: `rgb(${tint})`, fontWeight: 700 }}>{count === null ? '–' : count}</span> {countLabel}
          </span>
        )}
      </div>
    </button>
  );
}

export default function CredentialsHubPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  // Client credentials (social/ad platform logins) are managed by admin and
  // manager — same access this section has always had. Every team member
  // can have Website Work credentials shared with them though, so that
  // card is always shown, to everyone.
  const canSeeClientCreds = ['admin', 'manager', 'developer'].includes(user?.role);
  const canCountClientCreds = ['admin', 'manager'].includes(user?.role);

  const [clientCount, setClientCount]   = useState(null);
  const [websiteCount, setWebsiteCount] = useState(null);
  const [loadingClient, setLoadingClient]   = useState(canCountClientCreds);
  const [loadingWebsite, setLoadingWebsite] = useState(true);
  const [unlockingKey, setUnlockingKey] = useState(null); // 'client' | 'website' | null

  useEffect(() => {
    if (canCountClientCreds) {
      api.get('/credentials')
        .then(({ data }) => setClientCount((data.credentials || []).length))
        .catch(() => setClientCount(null))
        .finally(() => setLoadingClient(false));
    }
    api.get('/website-work/my-credentials')
      .then(({ data }) => {
        const total = (data.groups || []).reduce((sum, g) => sum + g.credentials.length, 0);
        setWebsiteCount(total);
      })
      .catch(() => setWebsiteCount(null))
      .finally(() => setLoadingWebsite(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCard = (key, path) => {
    if (unlockingKey) return;
    setUnlockingKey(key);
    setTimeout(() => navigate(path), UNLOCK_DELAY);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credentials"
        subtitle="Choose what you're looking for"
      />

      {/* Centered content block */}
      <div className="flex flex-col items-center justify-center pt-6 pb-4">
        <div className="w-full max-w-xl">
          <div className={`grid grid-cols-1 ${canSeeClientCreds ? 'sm:grid-cols-2' : ''} gap-4`}>
            {canSeeClientCreds && (
              <HubCard
                icon={BookUser}
                tint="79, 110, 240"
                title="Client Credentials"
                description="Social media, ads & platform logins saved for your clients."
                count={clientCount}
                countLabel={clientCount === 1 ? 'credential saved' : 'credentials saved'}
                loadingCount={loadingClient}
                status={unlockingKey === null ? 'idle' : unlockingKey === 'client' ? 'unlocking' : 'dimmed'}
                onClick={() => openCard('client', '/admin/credentials/clients')}
              />
            )}
            <HubCard
              icon={Globe}
              tint="34, 197, 94"
              title="Website Credentials"
              description="Admin panel, hosting & domain logins shared with you on Website Work."
              count={websiteCount}
              countLabel={websiteCount === 1 ? 'credential shared with you' : 'credentials shared with you'}
              loadingCount={loadingWebsite}
              status={unlockingKey === null ? 'idle' : unlockingKey === 'website' ? 'unlocking' : 'dimmed'}
              onClick={() => openCard('website', '/admin/credentials/websites')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}