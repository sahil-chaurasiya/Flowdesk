import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, ChevronDown, ChevronUp, Table2, LayoutGrid, Building2, Trash2 } from 'lucide-react';
import api from '../../lib/api';
import { Card, CardContent } from './LoadingScreen';
import { Button, Modal, Input, Select } from '../ui/index';
import { formatDate, formatCurrency, formatNumber } from '../../lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// A report can come from either:
//  (a) manually entered metrics (adSpend, revenue, leads, ...), or
//  (b) an uploaded spreadsheet (report.columns + report.sheetData), where the
//      exact set of columns varies per upload — never assume all are present.
// Both views below tolerate missing fields gracefully.
// ─────────────────────────────────────────────────────────────────────────────

const METRIC_TILES = [
  { key: 'adSpend',     label: 'Ad Spend',    fmt: 'currency' },
  { key: 'revenue',     label: 'Revenue',     fmt: 'currency' },
  { key: 'roas',        label: 'ROAS',        fmt: 'roas' },
  { key: 'leads',       label: 'Leads',       fmt: 'number' },
  { key: 'conversions', label: 'Conversions', fmt: 'number' },
  { key: 'impressions', label: 'Impressions', fmt: 'number' },
  { key: 'reach',       label: 'Reach',       fmt: 'number' },
  { key: 'clicks',      label: 'Clicks',      fmt: 'number' },
  { key: 'cpl',         label: 'Cost / Result', fmt: 'currency' },
];

function formatMetricValue(value, fmt) {
  if (value === undefined || value === null || value === '') return null;
  if (fmt === 'currency') return formatCurrency(value);
  if (fmt === 'roas') return `${Number(value).toFixed(1)}x`;
  if (fmt === 'number') return formatNumber(value);
  return String(value);
}

// Render a single sheet cell sensibly regardless of its underlying type.
function formatCellValue(value) {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  // ISO-looking dates from the backend (we serialize Date cells to ISO strings)
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    const d = new Date(value);
    if (!isNaN(d)) return formatDate(d);
  }
  return String(value);
}

// ── Sheet (table) view of an uploaded report ─────────────────────────────────
export function ReportSheetTable({ report }) {
  const columns = report.columns || [];
  const rows = report.sheetData || [];

  if (!columns.length || !rows.length) {
    return <p className="text-[12px] text-[var(--fd-ink-4)] py-4 text-center">No sheet data available for this report.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--fd-border-subtle)' }}>
      <table className="fd-table text-[12px]">
        <thead>
          <tr>
            {columns.map(col => <th key={col} className="whitespace-nowrap">{col}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map(col => (
                <td key={col} className="whitespace-nowrap">{formatCellValue(row[col])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Card (summary) view of a report — works for both manual and uploaded ────
// `onDelete(reportId)`: called after the report is successfully deleted on the
// server, so the parent can remove it from its own list state.
export function ReportCard({ report, showClient = false, onDelete }) {
  const [view, setView] = useState('cards'); // 'cards' | 'sheet'
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const hasSheet = (report.columns?.length > 0) && (report.sheetData?.length > 0);

  const tiles = METRIC_TILES
    .map(t => ({ ...t, value: formatMetricValue(report.metrics?.[t.key], t.fmt) }))
    .filter(t => t.value !== null);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/reports/${report._id}`);
      setShowDeleteConfirm(false);
      onDelete?.(report._id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
          <div>
            <div className="font-semibold text-[var(--fd-ink-1)]">{report.title}</div>
            <div className="flex items-center gap-2 text-[11.5px] text-[var(--fd-ink-3)] mt-0.5 flex-wrap">
              {showClient && report.client && (
                <span className="flex items-center gap-1">
                  <Building2 size={10} />{report.client.company || report.client.name}
                </span>
              )}
              {showClient && report.client && <span>·</span>}
              <span>{formatDate(report.startDate)} – {formatDate(report.endDate)}</span>
              {report.sourceFile?.name && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1 truncate max-w-[200px]" title={report.sourceFile.name}>
                    <FileSpreadsheet size={10} />{report.sourceFile.name}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-[var(--fd-surface-sunken)] text-[var(--fd-ink-2)] rounded-full text-[11px] capitalize">
              {report.period}
            </span>
            {hasSheet && (
              <button
                onClick={() => setView(v => v === 'cards' ? 'sheet' : 'cards')}
                className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg transition-colors"
                style={{ background: 'var(--fd-surface-raised)', color: 'var(--fd-ink-2)', border: '1px solid var(--fd-border)' }}
              >
                {view === 'cards' ? <><Table2 size={11} />Sheet view</> : <><LayoutGrid size={11} />Card view</>}
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                title="Delete report"
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--fd-ink-4)' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#b91c1c'; e.currentTarget.style.background = 'var(--fd-surface-raised)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--fd-ink-4)'; e.currentTarget.style.background = 'transparent'; }}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {view === 'sheet' && hasSheet ? (
          <ReportSheetTable report={report} />
        ) : (
          <>
            {tiles.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {tiles.map(t => (
                  <div key={t.key} className="bg-[var(--fd-surface-raised)] rounded-lg p-2.5 text-center">
                    <div className="text-[11px] text-[var(--fd-ink-4)]">{t.label}</div>
                    <div className="font-bold text-[var(--fd-ink-1)] text-sm mt-0.5">{t.value}</div>
                  </div>
                ))}
              </div>
            ) : hasSheet ? (
              <p className="text-[12px] text-[var(--fd-ink-4)]">
                {report.sheetData.length} row{report.sheetData.length !== 1 ? 's' : ''} uploaded — switch to sheet view to see the full data.
              </p>
            ) : (
              <p className="text-[12px] text-[var(--fd-ink-4)]">No metrics recorded for this report.</p>
            )}

            {(report.highlights?.length > 0 || report.recommendations?.length > 0) && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {report.highlights?.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold text-[var(--fd-ink-2)] uppercase tracking-wide mb-2">Highlights</div>
                    <ul className="space-y-1">{report.highlights.map((h, i) => <li key={i} className="text-[12px] text-[var(--fd-ink-2)] flex items-start gap-1.5"><span className="text-emerald-500 mt-0.5">✓</span>{h}</li>)}</ul>
                  </div>
                )}
                {report.recommendations?.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold text-[var(--fd-ink-2)] uppercase tracking-wide mb-2">Recommendations</div>
                    <ul className="space-y-1">{report.recommendations.map((rec, i) => <li key={i} className="text-[12px] text-[var(--fd-ink-2)] flex items-start gap-1.5"><span className="text-brand-500 mt-0.5">→</span>{rec}</li>)}</ul>
                  </div>
                )}
              </div>
            )}
            {report.notes && <p className="mt-3 text-[12px] text-[var(--fd-ink-3)] bg-[var(--fd-surface-raised)] rounded-lg p-3">{report.notes}</p>}
          </>
        )}
      </CardContent>

      {showDeleteConfirm && (
        <Modal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          title="Delete Report"
          size="sm"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
              <Button
                loading={deleting}
                onClick={handleDelete}
                style={{ background: '#b91c1c', color: '#fff', borderColor: '#b91c1c' }}
              >
                <Trash2 size={13} /> Delete
              </Button>
            </div>
          }
        >
          <p className="text-[13px]" style={{ color: 'var(--fd-ink-2)' }}>
            Delete <strong>{report.title}</strong>? This cannot be undone.
          </p>
        </Modal>
      )}
    </Card>
  );
}

// ── Upload modal — create a report from an Excel/CSV file ───────────────────
// `fixedClientId`: when provided (e.g. from the client detail page), the
// client picker is hidden and that client is always used.
export function ReportUploadModal({ isOpen, onClose, onUploaded, clients, fixedClientId }) {
  const [file, setFile] = useState(null);
  const [clientId, setClientId] = useState(fixedClientId || '');
  const [title, setTitle] = useState('');
  const [period, setPeriod] = useState('custom');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const PERIODS = ['daily', 'weekly', 'monthly', 'quarterly', 'annual', 'custom'];

  const reset = () => {
    setFile(null);
    setTitle('');
    setPeriod('custom');
    setError('');
    if (!fixedClientId) setClientId('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleUpload = async () => {
    if (!file) return;
    const effectiveClientId = fixedClientId || clientId;
    if (!effectiveClientId) { setError('Please select a client.'); return; }

    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('clientId', effectiveClientId);
      if (title.trim()) fd.append('title', title.trim());
      fd.append('period', period);
      const { data } = await api.post('/reports/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onUploaded?.(data.report);
      reset();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed. Please check the file and try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Upload Report"
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button loading={uploading} onClick={handleUpload} disabled={!file}>
            <Upload size={14} />Upload
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div
          className="px-4 py-3 rounded-lg text-[12px] leading-relaxed"
          style={{ background: 'var(--fd-sidebar-active)', border: '1px solid var(--fd-border-strong)', color: 'var(--fd-sidebar-link-active)' }}
        >
          Upload an ad-platform export (e.g. Meta Ads Manager). Any columns it contains will be saved — it's fine if some are missing.
        </div>

        <div>
          <label className="block text-[12px] font-medium mb-1.5 text-[var(--fd-ink-2)]">
            File <span className="text-red-500">*</span>
          </label>
          <div
            onClick={() => fileRef.current?.click()}
            className="rounded-xl p-8 text-center cursor-pointer transition-all"
            style={file
              ? { background: 'var(--fd-sidebar-active)', border: '2px dashed var(--fd-sidebar-link-active)' }
              : { background: 'var(--fd-surface-raised)', border: '2px dashed var(--fd-border-strong)' }
            }
          >
            <FileSpreadsheet
              size={22}
              className="mx-auto mb-3"
              style={{ color: file ? 'var(--fd-sidebar-link-active)' : 'var(--fd-ink-5)' }}
              strokeWidth={1.5}
            />
            <div className="text-[13px] font-medium" style={{ color: file ? 'var(--fd-sidebar-link-active)' : 'var(--fd-ink-2)' }}>
              {file ? file.name : 'Click to select file'}
            </div>
            <div className="text-[11.5px] mt-1 text-[var(--fd-ink-4)]">.xlsx, .xls, .csv — max 10 MB</div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>

        {!fixedClientId && (
          <Select label="Client *" value={clientId} onChange={e => setClientId(e.target.value)}>
            <option value="">Select client...</option>
            {clients?.map(c => <option key={c._id} value={c._id}>{c.company || c.name}</option>)}
          </Select>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Title (optional)"
            placeholder="Defaults to filename"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <Select label="Period" value={period} onChange={e => setPeriod(e.target.value)}>
            {PERIODS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </Select>
        </div>

        {error && (
          <p className="text-[12px] text-red-600">{error}</p>
        )}
      </div>
    </Modal>
  );
}