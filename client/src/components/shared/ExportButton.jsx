import React, { useState, useRef, useEffect } from 'react';
import { Download, FileText, Table, ChevronDown, Loader2 } from 'lucide-react';

/**
 * ExportButton
 * Props:
 *   onExport: (format: 'csv' | 'xlsx') => Promise<void> | void
 *   label?: string
 *   loading?: boolean
 *   disabled?: boolean
 */
export default function ExportButton({ onExport, label = 'Export', loading = false, disabled = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handle = async (format) => {
    setOpen(false);
    if (onExport) await onExport(format);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={disabled || loading}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all"
        style={{
          background: 'var(--fd-btn-secondary-bg)',
          border: '1px solid var(--fd-btn-secondary-border)',
          color: 'var(--fd-btn-secondary-text)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          opacity: disabled || loading ? 0.6 : 1,
          cursor: disabled || loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading
          ? <Loader2 size={13} className="animate-spin" />
          : <Download size={13} />
        }
        {label}
        <ChevronDown size={11} style={{ opacity: 0.6 }} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 rounded-xl overflow-hidden z-50 animate-scale-in"
          style={{
            background: 'var(--fd-surface)',
            border: '1px solid var(--fd-border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
            minWidth: 160,
          }}
        >
          <div className="py-1">
            <button
              onClick={() => handle('csv')}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12.5px] text-left transition-colors hover:bg-[var(--fd-surface-sunken)]"
              style={{ color: 'var(--fd-ink-2)' }}
            >
              <FileText size={13} style={{ color: 'var(--fd-ink-4)' }} />
              Export as CSV
            </button>
            <button
              onClick={() => handle('xlsx')}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12.5px] text-left transition-colors hover:bg-[var(--fd-surface-sunken)]"
              style={{ color: 'var(--fd-ink-2)' }}
            >
              <Table size={13} style={{ color: 'var(--fd-ink-4)' }} />
              Export as Excel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
