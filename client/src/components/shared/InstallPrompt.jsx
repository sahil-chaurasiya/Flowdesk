import React, { useEffect, useState } from 'react';
import { Download, X, Share, PlusSquare } from 'lucide-react';

const DISMISS_KEY = 'fd-install-dismissed-at';
const DISMISS_DAYS = 7;

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true // iOS Safari
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function wasRecentlyDismissed() {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  if (Number.isNaN(dismissedAt)) return false;
  const days = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
  return days < DISMISS_DAYS;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [showIosSteps, setShowIosSteps] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasRecentlyDismissed()) return;

    // Chrome / Edge / Android — capture the native install prompt.
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // iOS Safari never fires beforeinstallprompt — show our own banner
    // with manual "Add to Home Screen" instructions instead.
    if (isIos()) {
      const t = setTimeout(() => setVisible(true), 1200);
      return () => {
        clearTimeout(t);
        window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  useEffect(() => {
    const onInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
    setShowIosSteps(false);
  };

  const handleInstall = async () => {
    if (isIos()) {
      setShowIosSteps(true);
      return;
    }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: '16px',
        right: '16px',
        bottom: '16px',
        zIndex: 9999,
        maxWidth: '420px',
        margin: '0 auto',
        background: 'var(--fd-surface, #1e2025)',
        border: '1px solid var(--fd-border, #2a2d36)',
        borderRadius: '14px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.28)',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img
          src="/icon-192.png"
          alt="Flowdesk"
          style={{ width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--fd-ink-1, #edeae4)', lineHeight: 1.25 }}>
            Install Flowdesk
          </div>
          <div style={{ fontSize: '12px', color: 'var(--fd-ink-4, #a8a49e)', lineHeight: 1.3 }}>
            Get the app for faster, full-screen access — no browser tabs.
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          style={{
            flexShrink: 0,
            width: '26px',
            height: '26px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            background: 'transparent',
            border: 'none',
            color: 'var(--fd-ink-4, #a8a49e)',
            cursor: 'pointer',
          }}
        >
          <X size={15} />
        </button>
      </div>

      {showIosSteps ? (
        <div
          style={{
            fontSize: '12.5px',
            color: 'var(--fd-ink-2, #c4c0b8)',
            background: 'var(--fd-surface-sunken, #191b20)',
            border: '1px solid var(--fd-border, #2a2d36)',
            borderRadius: '10px',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Share size={13} /> Tap the <strong>Share</strong> button in Safari
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <PlusSquare size={13} /> Then choose <strong>Add to Home Screen</strong>
          </div>
        </div>
      ) : (
        <button
          onClick={handleInstall}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            padding: '9px 12px',
            borderRadius: '10px',
            border: 'none',
            background: 'var(--fd-accent, #6e8ef5)',
            color: '#0b0e14',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Download size={15} />
          {isIos() ? 'How to install' : 'Install App'}
        </button>
      )}
    </div>
  );
}