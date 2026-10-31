import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Target, TrendingUp, Users, ChevronDown, ChevronUp,
  Filter, Clock, Phone, Mail,
  MapPin, Building2, X, AlertCircle,
  Search, Bell, Calendar, Trash2, Plus,
  MessageSquare, ChevronRight,
  RefreshCw, Check,
} from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { EmptyState, Card, Spinner, StatCard } from '../../components/shared/LoadingScreen';
import { Select } from '../../components/ui/index';
import { formatDate, timeAgo } from '../../lib/utils';

// ── Status config ─────────────────────────────────────────────────────────────
const CLIENT_STATUSES = [
  { value: 'new',            label: 'New',            color: 'bg-zinc-100 text-zinc-600',      dot: '#a1a1aa', icon: '🟡' },
  { value: 'contacted',      label: 'Contacted',      color: 'bg-blue-100 text-blue-700',       dot: '#3b82f6', icon: '📞' },
  { value: 'qualified',      label: 'Qualified',      color: 'bg-amber-100 text-amber-700',     dot: '#f59e0b', icon: '⭐' },
  { value: 'converted',      label: 'Converted',      color: 'bg-emerald-100 text-emerald-700', dot: '#10b981', icon: '✅' },
  { value: 'not_interested', label: 'Not Interested', color: 'bg-purple-100 text-purple-600',   dot: '#9333ea', icon: '🚫' },
  { value: 'invalid',        label: 'Invalid',        color: 'bg-red-100 text-red-600',         dot: '#ef4444', icon: '❌' },
];
const STATUS_MAP = Object.fromEntries(CLIENT_STATUSES.map(s => [s.value, s]));
const PIPELINE = ['new', 'contacted', 'qualified', 'converted'];

function isOverdue(date) {
  if (!date) return false;
  return new Date(date) < new Date() && new Date(date).toDateString() !== new Date().toDateString();
}
function isToday(date) {
  if (!date) return false;
  return new Date(date).toDateString() === new Date().toDateString();
}

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 32 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const colors = ['#4f6ef0', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#f97316'];
  const hue = (initials.charCodeAt(0) || 0) % colors.length;
  return (
    <div className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38, background: colors[hue] }}>
      {initials}
    </div>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────────
function StatusPill({ status, size = 'md' }) {
  const cfg = STATUS_MAP[status] || STATUS_MAP.new;
  return (
    <span className={`inline-flex items-center gap-1 font-semibold rounded-full ${
      size === 'sm' ? 'text-[10.5px] px-2 py-0.5' : 'text-[11.5px] px-2.5 py-1'
    } ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ── Lead Drawer ───────────────────────────────────────────────────────────────
function LeadDrawer({ lead: initialLead, onClose, onUpdated }) {
  const [lead, setLead]                   = useState(initialLead);
  const [noteText, setNoteText]           = useState('');
  const [addingNote, setAddingNote]       = useState(false);
  const [savingStatus, setSavingStatus]   = useState(false);
  const [followUp, setFollowUp]           = useState(
    lead.clientFollowUpDate ? new Date(lead.clientFollowUpDate).toISOString().slice(0, 16) : ''
  );
  const [followUpNote, setFollowUpNote]   = useState(lead.clientFollowUpNote || '');
  const [savingFU, setSavingFU]           = useState(false);
  const [fuSaved, setFuSaved]             = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => { setLead(initialLead); }, [initialLead]);

  // On mount: lock background scroll and reset drawer to top
  useEffect(() => {
    // Reset drawer scroll to top immediately
    if (bodyRef.current) bodyRef.current.scrollTop = 0;

    // Lock the layout scroll container
    const mainEl = document.getElementById('client-main-scroll');
    if (mainEl) {
      const prev = mainEl.style.overflowY;
      mainEl.style.overflowY = 'hidden';
      return () => { mainEl.style.overflowY = prev; };
    }
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const updateStatus = async (newStatus) => {
    if (newStatus === lead.clientStatus) return;
    setSavingStatus(true);
    try {
      const { data } = await api.patch(`/leads/${lead._id}/client-update`, { clientStatus: newStatus });
      setLead(data.lead); onUpdated?.(data.lead);
    } catch (err) { alert(err.response?.data?.message || 'Failed to update'); }
    finally { setSavingStatus(false); }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    setAddingNote(true);
    try {
      const { data } = await api.post(`/leads/${lead._id}/client-notes`, { body: noteText.trim() });
      setLead(data.lead); onUpdated?.(data.lead); setNoteText('');
    } catch (err) { alert(err.response?.data?.message || 'Failed to add note'); }
    finally { setAddingNote(false); }
  };

  const deleteNote = async (noteId) => {
    if (!window.confirm('Delete this note?')) return;
    try {
      const { data } = await api.delete(`/leads/${lead._id}/client-notes/${noteId}`);
      setLead(data.lead); onUpdated?.(data.lead);
    } catch (err) { alert(err.response?.data?.message || 'Failed to delete'); }
  };

  const saveFollowUp = async () => {
    setSavingFU(true);
    try {
      const { data } = await api.patch(`/leads/${lead._id}/client-update`, {
        clientFollowUpDate: followUp || null,
        clientFollowUpNote: followUpNote,
      });
      setLead(data.lead); onUpdated?.(data.lead);
      setFuSaved(true); setTimeout(() => setFuSaved(false), 3000);
    } finally { setSavingFU(false); }
  };

  const clearFollowUp = async () => {
    setFollowUp(''); setFollowUpNote(''); setSavingFU(true);
    try {
      const { data } = await api.patch(`/leads/${lead._id}/client-update`, { clientFollowUpDate: null, clientFollowUpNote: '' });
      setLead(data.lead); onUpdated?.(data.lead);
    } finally { setSavingFU(false); }
  };

  const notes = [...(lead.clientNotesHistory || [])].reverse();
  const followUpDate = lead.clientFollowUpDate;
  const fuOverdue = isOverdue(followUpDate);
  const fuToday = isToday(followUpDate);

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)'
      }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 9999,
        width: 'min(480px, 100vw)', height: '100%',
        display: 'flex', flexDirection: 'column',
        background: 'var(--fd-card-bg)',
        borderLeft: '1px solid var(--fd-border)',
        boxShadow: '0 0 40px rgba(0,0,0,0.4)',
        animation: 'slideInRight 0.22s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <style>{`
          @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
          @keyframes fadeInNote { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
          .note-item { animation: fadeInNote 0.18s ease-out; }
        `}</style>

        {/* Header */}
        <div style={{ flexShrink: 0, borderBottom: '1px solid var(--fd-border)', background: 'var(--fd-surface-sunken)' }}
          className="flex items-start justify-between px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={lead.name || lead.company || '?'} size={42} />
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold truncate" style={{ color: 'var(--fd-ink-1)' }}>
                {lead.name || 'Anonymous Lead'}
              </h2>
              {lead.company && (
                <div className="text-[12px] flex items-center gap-1 mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>
                  <Building2 size={11} />{lead.company}
                </div>
              )}
              <div className="mt-1.5"><StatusPill status={lead.clientStatus} /></div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg ml-2 flex-shrink-0 hover:bg-[var(--fd-surface)] transition-colors" style={{ color: 'var(--fd-ink-4)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div ref={bodyRef} style={{ flex: 1, minHeight: 0, overflowY: 'scroll', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}>

          {/* Contact */}
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--fd-border)' }}>
            <p className="text-[10.5px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--fd-ink-4)' }}>Contact Details</p>
            <div className="space-y-2.5">
              {lead.phone && (
                <a href={`tel:${lead.phone}`} className="flex items-center gap-2.5 text-[13px] hover:opacity-80 transition-opacity" style={{ color: 'var(--fd-ink-2)' }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(79,110,240,0.1)' }}>
                    <Phone size={13} style={{ color: '#4f6ef0' }} />
                  </div>{lead.phone}
                </a>
              )}
              {lead.email && (
                <a href={`mailto:${lead.email}`} className="flex items-center gap-2.5 text-[13px] hover:opacity-80 transition-opacity" style={{ color: 'var(--fd-ink-2)' }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(79,110,240,0.1)' }}>
                    <Mail size={13} style={{ color: '#4f6ef0' }} />
                  </div>{lead.email}
                </a>
              )}
              {lead.location && (
                <div className="flex items-center gap-2.5 text-[13px]" style={{ color: 'var(--fd-ink-3)' }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--fd-surface-sunken)' }}>
                    <MapPin size={13} style={{ color: 'var(--fd-ink-4)' }} />
                  </div>{lead.location}
                </div>
              )}
              {lead.source && (
                <div className="flex items-center gap-2.5 text-[13px]" style={{ color: 'var(--fd-ink-3)' }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--fd-surface-sunken)' }}>
                    <Target size={13} style={{ color: 'var(--fd-ink-4)' }} />
                  </div>
                  <span><span style={{ color: 'var(--fd-ink-4)' }}>Source: </span>
                  <span className="font-medium text-blue-600">{lead.source}</span></span>
                </div>
              )}
              {(lead.leadDate || lead.createdAt) && (
                <div className="flex items-center gap-2.5 text-[12.5px]" style={{ color: 'var(--fd-ink-4)' }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--fd-surface-sunken)' }}>
                    <Calendar size={12} style={{ color: 'var(--fd-ink-4)' }} />
                  </div>
                  Lead received {formatDate(lead.leadDate || lead.createdAt)}
                </div>
              )}
            </div>
          </div>

          {/* Status pipeline */}
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--fd-border)' }}>
            <p className="text-[10.5px] font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--fd-ink-4)' }}>Update Status</p>
            {/* Pipeline */}
            <div className="flex items-center mb-4">
              {PIPELINE.map((sv, i) => {
                const cfg = STATUS_MAP[sv];
                const isActive = lead.clientStatus === sv;
                const isPast = PIPELINE.indexOf(lead.clientStatus) > i;
                return (
                  <React.Fragment key={sv}>
                    <button onClick={() => updateStatus(sv)} disabled={savingStatus}
                      title={cfg.label} className="flex flex-col items-center gap-1 flex-1 group transition-all">
                      <div className="relative w-7 h-7 rounded-full flex items-center justify-center transition-all"
                        style={{
                          background: isActive ? cfg.dot : isPast ? cfg.dot + '40' : 'var(--fd-surface-sunken)',
                          border: `2px solid ${isActive ? cfg.dot : isPast ? cfg.dot + '60' : 'var(--fd-border)'}`,
                          transform: isActive ? 'scale(1.2)' : 'scale(1)',
                          boxShadow: isActive ? `0 0 0 3px ${cfg.dot}25` : 'none',
                        }}>
                        {(isActive || isPast)
                          ? <Check size={12} color="white" strokeWidth={3} />
                          : <span className="text-[10px]">{cfg.icon}</span>}
                      </div>
                      <span className="text-[9.5px] font-semibold text-center leading-tight"
                        style={{ color: isActive ? cfg.dot : 'var(--fd-ink-4)' }}>
                        {cfg.label}
                      </span>
                    </button>
                    {i < PIPELINE.length - 1 && (
                      <div className="h-0.5 flex-shrink-0 mb-4 mx-0.5" style={{
                        width: 20,
                        background: PIPELINE.indexOf(lead.clientStatus) > i ? (STATUS_MAP[PIPELINE[i]].dot + '50') : 'var(--fd-border)',
                      }} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            {/* Other statuses */}
            <div className="flex flex-wrap gap-1.5">
              {CLIENT_STATUSES.filter(s => !PIPELINE.includes(s.value)).map(s => (
                <button key={s.value} onClick={() => updateStatus(s.value)} disabled={savingStatus}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all ${s.color}`}
                  style={{
                    opacity: lead.clientStatus === s.value ? 1 : 0.6,
                    border: `1.5px solid ${lead.clientStatus === s.value ? s.dot : 'transparent'}`,
                    transform: lead.clientStatus === s.value ? 'scale(1.04)' : 'scale(1)',
                  }}>
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
            {lead.clientStatus === 'invalid' && (
              <div className="mt-3 flex items-start gap-2 p-3 rounded-xl text-[11.5px] text-amber-700"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
                <span>Marking as <strong>Invalid</strong> means you believe the contact details are incorrect or unreachable. Our team may review this claim.</span>
              </div>
            )}
          </div>

          {/* Follow-up */}
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--fd-border)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10.5px] font-bold uppercase tracking-widest" style={{ color: 'var(--fd-ink-4)' }}>Follow-up Reminder</p>
              {followUpDate && (
                <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: fuOverdue ? 'rgba(239,68,68,0.1)' : fuToday ? 'rgba(245,158,11,0.1)' : 'rgba(79,110,240,0.1)',
                    color: fuOverdue ? '#ef4444' : fuToday ? '#f59e0b' : '#4f6ef0',
                  }}>
                  {fuOverdue ? '⚠ Overdue' : fuToday ? '🔔 Today' : `📅 ${formatDate(followUpDate)}`}
                </span>
              )}
            </div>
            <div className="space-y-2">
              <input type="datetime-local"
                className="w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
                style={{ background: 'var(--fd-input-bg)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-1)' }}
                value={followUp} onChange={e => setFollowUp(e.target.value)} />
              <input type="text" placeholder="What to discuss, what to ask..."
                className="w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
                style={{ background: 'var(--fd-input-bg)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-1)' }}
                value={followUpNote} onChange={e => setFollowUpNote(e.target.value)} maxLength={500} />
              <div className="flex items-center gap-2">
                <button onClick={saveFollowUp} disabled={savingFU}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white transition-all"
                  style={{ background: 'var(--fd-sidebar-link-active)', opacity: savingFU ? 0.7 : 1 }}>
                  {fuSaved ? <><Check size={12} /> Saved!</> : <><Bell size={12} /> Set Reminder</>}
                </button>
                {followUpDate && (
                  <button onClick={clearFollowUp} className="text-[11px] ml-auto hover:opacity-70 transition-opacity" style={{ color: '#ef4444' }}>
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10.5px] font-bold uppercase tracking-widest" style={{ color: 'var(--fd-ink-4)' }}>
                Notes {notes.length > 0 && <span style={{ color: 'var(--fd-ink-2)' }}>({notes.length})</span>}
              </p>
            </div>

            {/* Add note */}
            <div className="rounded-xl overflow-hidden mb-4"
              style={{ border: '1px solid var(--fd-border)', background: 'var(--fd-input-bg)' }}>
              <textarea rows={3}
                placeholder="Add a note — e.g. Called twice, no answer. Will retry Friday at 3pm."
                className="w-full px-3 py-2.5 text-[12.5px] outline-none resize-none bg-transparent"
                style={{ color: 'var(--fd-ink-1)' }}
                value={noteText} onChange={e => setNoteText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addNote(); }} />
              <div className="flex items-center justify-between px-3 pb-2.5">
                <span className="text-[10.5px]" style={{ color: 'var(--fd-ink-5)' }}>Ctrl+Enter to save</span>
                <button onClick={addNote} disabled={addingNote || !noteText.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white transition-all"
                  style={{ background: 'var(--fd-sidebar-link-active)', opacity: (!noteText.trim() || addingNote) ? 0.5 : 1 }}>
                  <Plus size={12} />{addingNote ? 'Adding…' : 'Add Note'}
                </button>
              </div>
            </div>

            {/* Notes list */}
            {notes.length === 0 ? (
              <div className="text-center py-8 rounded-xl"
                style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}>
                <MessageSquare size={22} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--fd-ink-3)' }} />
                <p className="text-[12px]" style={{ color: 'var(--fd-ink-4)' }}>No notes yet. Add your first note above.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notes.map((note, i) => (
                  <div key={note._id || i} className="note-item rounded-xl p-3.5 group"
                    style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[12.5px] leading-relaxed flex-1" style={{ color: 'var(--fd-ink-2)' }}>{note.body}</p>
                      <button onClick={() => deleteNote(note._id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded flex-shrink-0"
                        style={{ color: '#ef4444' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="mt-2 text-[10.5px]" style={{ color: 'var(--fd-ink-5)' }}>
                      {timeAgo(note.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Lead Row (desktop table) ──────────────────────────────────────────────────
function LeadRow({ lead, onClick }) {
  const noteCount = (lead.clientNotesHistory || []).length;
  const followUpDate = lead.clientFollowUpDate;
  const fuOverdue = isOverdue(followUpDate);
  const fuToday = isToday(followUpDate);
  return (
    <tr className="cursor-pointer hover:bg-[var(--fd-surface-raised)] transition-colors group" onClick={onClick}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={lead.name || lead.company || '?'} size={28} />
          <div>
            <div className="font-semibold text-[12.5px]" style={{ color: 'var(--fd-ink-1)' }}>{lead.name || 'Anonymous'}</div>
            {lead.company && <div className="text-[11px] flex items-center gap-1" style={{ color: 'var(--fd-ink-4)' }}><Building2 size={9} />{lead.company}</div>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-[12px]" style={{ color: 'var(--fd-ink-3)' }}>
        <div className="space-y-0.5">
          {lead.email && <div className="flex items-center gap-1"><Mail size={10} className="opacity-60 flex-shrink-0" /><span className="truncate max-w-[150px]">{lead.email}</span></div>}
          {lead.phone && <div className="flex items-center gap-1"><Phone size={10} className="opacity-60 flex-shrink-0" />{lead.phone}</div>}
        </div>
      </td>
      <td className="px-4 py-3 text-[12px]" style={{ color: 'var(--fd-ink-4)' }}>
        {lead.location && <div className="flex items-center gap-1"><MapPin size={10} />{lead.location}</div>}
        {lead.source && <span className="inline-block mt-1 text-[10.5px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{lead.source}</span>}
      </td>
      <td className="px-4 py-3"><StatusPill status={lead.clientStatus} size="sm" /></td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {noteCount > 0 && <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--fd-ink-4)' }}><MessageSquare size={11} />{noteCount}</span>}
          {followUpDate && (
            <span className="flex items-center gap-1 text-[11px] font-medium"
              style={{ color: fuOverdue ? '#ef4444' : fuToday ? '#f59e0b' : 'var(--fd-ink-4)' }}>
              <Bell size={11} />{fuOverdue ? 'Overdue' : fuToday ? 'Today' : formatDate(followUpDate)}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-[11.5px]" style={{ color: 'var(--fd-ink-4)' }}>{formatDate(lead.leadDate || lead.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[11.5px] font-medium" style={{ color: 'var(--fd-sidebar-link-active)' }}>
          Open <ChevronRight size={12} />
        </div>
      </td>
    </tr>
  );
}

// ── Mobile Lead Card ──────────────────────────────────────────────────────────
function MobileLeadCard({ lead, onClick }) {
  const noteCount = (lead.clientNotesHistory || []).length;
  const followUpDate = lead.clientFollowUpDate;
  const fuOverdue = isOverdue(followUpDate);
  const fuToday = isToday(followUpDate);
  return (
    <div className="p-4 border-b cursor-pointer hover:bg-[var(--fd-surface-raised)] transition-colors"
      style={{ borderColor: 'var(--fd-border-subtle)' }} onClick={onClick}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar name={lead.name || lead.company || '?'} size={32} />
          <div className="min-w-0">
            <div className="font-semibold text-[13px] truncate" style={{ color: 'var(--fd-ink-1)' }}>{lead.name || 'Anonymous'}</div>
            {lead.company && <div className="text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>{lead.company}</div>}
          </div>
        </div>
        <StatusPill status={lead.clientStatus} size="sm" />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11.5px]" style={{ color: 'var(--fd-ink-4)' }}>
        {lead.phone && <span className="flex items-center gap-1"><Phone size={10} />{lead.phone}</span>}
        {lead.email && <span className="flex items-center gap-1 truncate max-w-[180px]"><Mail size={10} />{lead.email}</span>}
      </div>
      <div className="flex items-center gap-3 mt-2">
        {noteCount > 0 && <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--fd-ink-4)' }}><MessageSquare size={11} />{noteCount} note{noteCount > 1 ? 's' : ''}</span>}
        {followUpDate && (
          <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: fuOverdue ? '#ef4444' : fuToday ? '#f59e0b' : 'var(--fd-ink-4)' }}>
            <Bell size={11} />{fuOverdue ? 'Overdue' : fuToday ? 'Today' : formatDate(followUpDate)}
          </span>
        )}
        <span className="ml-auto text-[10.5px]" style={{ color: 'var(--fd-ink-5)' }}>{formatDate(lead.leadDate || lead.createdAt)}</span>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ClientLeadsPage() {
  const { user } = useAuthStore();
  const [batches, setBatches]             = useState([]);
  const [leads, setLeads]                 = useState([]);
  const [stats, setStats]                 = useState(null);
  const [loading, setLoading]             = useState(true);
  const [expandedBatch, setExpandedBatch] = useState(null);
  const [statusFilter, setStatusFilter]   = useState('');
  const [search, setSearch]               = useState('');
  const [selectedLead, setSelectedLead]   = useState(null);

  const load = useCallback(async () => {
    if (!user?.clientId) return;
    setLoading(true);
    try {
      const [batchRes, statsRes] = await Promise.all([api.get('/leads/batches'), api.get('/leads/stats')]);
      setBatches(batchRes.data.batches || []);
      setStats(statsRes.data);
    } finally { setLoading(false); }
  }, [user?.clientId]);

  useEffect(() => { load(); }, [load]);

  const loadBatchLeads = async (batchId) => {
    if (expandedBatch === batchId) { setExpandedBatch(null); setLeads([]); return; }
    setExpandedBatch(batchId);
    const params = new URLSearchParams({ batchId, limit: 200 });
    if (statusFilter) params.set('clientStatus', statusFilter);
    const { data } = await api.get(`/leads?${params}`);
    setLeads(data.leads || []);
  };

  const handleLeadUpdated = (updatedLead) => {
    setLeads(prev => prev.map(l => l._id === updatedLead._id ? updatedLead : l));
    if (selectedLead?._id === updatedLead._id) setSelectedLead(updatedLead);
  };

  const totalLeads = stats?.total || 0;
  const converted  = stats?.byClientStatus?.find(s => s._id === 'converted')?.count || 0;
  const newLeads   = stats?.byClientStatus?.find(s => s._id === 'new')?.count || 0;
  const contacted  = (stats?.byClientStatus?.find(s => s._id === 'contacted')?.count || 0)
                   + (stats?.byClientStatus?.find(s => s._id === 'qualified')?.count || 0);
  const convRate   = totalLeads > 0 ? ((converted / totalLeads) * 100).toFixed(1) : '0';

  const filteredLeads = leads.filter(l => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (l.name || '').toLowerCase().includes(q) ||
      (l.email || '').toLowerCase().includes(q) ||
      (l.phone || '').includes(q) ||
      (l.company || '').toLowerCase().includes(q) ||
      (l.location || '').toLowerCase().includes(q)
    );
  });

  const colors = { contacted: '#3b82f6', qualified: '#f59e0b', converted: '#22c55e', not_interested: '#a855f7', invalid: '#ef4444' };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--fd-ink-1)' }}>🎯 Your Leads</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--fd-ink-3)' }}>
            Leads generated from your campaigns. Click any lead to update status, add notes, and set follow-up reminders.
          </p>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-[var(--fd-surface-raised)] transition-colors flex-shrink-0"
          style={{ color: 'var(--fd-ink-4)' }} title="Refresh">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Leads"  value={totalLeads}      icon={Users}      color="blue"   subtitle="All batches" />
        <StatCard title="Unworked"     value={newLeads}        icon={Clock}      color="orange" subtitle="Not yet contacted" />
        <StatCard title="In Progress"  value={contacted}       icon={Target}     color="purple" subtitle="Contacted / Qualified" />
        <StatCard title="Converted"    value={`${convRate}%`}  icon={TrendingUp} color="green"  subtitle={`${converted} won`} />
      </div>

      {/* Progress bar */}
      {totalLeads > 0 && (
        <Card className="px-5 py-4">
          <div className="text-[12px] font-semibold mb-3" style={{ color: 'var(--fd-ink-2)' }}>Your Progress</div>
          <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
            {CLIENT_STATUSES.filter(s => s.value !== 'new').map(s => {
              const count = stats?.byClientStatus?.find(b => b._id === s.value)?.count || 0;
              const pct = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
              if (!pct) return null;
              return <div key={s.value} title={`${s.label}: ${count} (${pct.toFixed(0)}%)`}
                style={{ width: `${pct}%`, background: colors[s.value] || '#ccc', minWidth: pct > 0 ? '4px' : 0 }} />;
            })}
            {(() => {
              const worked = stats?.byClientStatus?.filter(s => s._id !== 'new').reduce((a, s) => a + s.count, 0) || 0;
              const newPct = totalLeads > 0 ? ((totalLeads - worked) / totalLeads) * 100 : 100;
              return newPct > 0
                ? <div title={`New: ${totalLeads - worked} (${newPct.toFixed(0)}%)`}
                    style={{ width: `${newPct}%`, background: 'var(--fd-border)', minWidth: '4px' }} />
                : null;
            })()}
          </div>
          <div className="flex flex-wrap gap-3 mt-2.5">
            {CLIENT_STATUSES.map(s => {
              const count = s.value === 'new' ? newLeads : (stats?.byClientStatus?.find(b => b._id === s.value)?.count || 0);
              if (!count) return null;
              return (
                <div key={s.value} className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--fd-ink-3)' }}>
                  <span>{s.icon}</span><span>{s.label}</span>
                  <span className="font-semibold" style={{ color: 'var(--fd-ink-1)' }}>{count}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Sources */}
      {stats?.bySource?.length > 0 && (
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3" style={{ color: 'var(--fd-ink-1)' }}>Leads by Source</div>
          <div className="flex flex-wrap gap-2">
            {stats.bySource.map(s => (
              <div key={s._id} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                style={{ background: 'var(--fd-surface-raised)', border: '1px solid var(--fd-border)' }}>
                <span className="font-semibold" style={{ color: 'var(--fd-ink-2)' }}>{s._id || 'Unknown'}</span>
                <span className="bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-bold">{s.count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter size={15} style={{ color: 'var(--fd-ink-4)' }} />
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-48">
          <option value="">All Statuses</option>
          {CLIENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.icon} {s.label}</option>)}
        </Select>
      </div>

      {/* Batches */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : batches.length === 0 ? (
        <EmptyState icon={Target} title="No leads yet"
          description="Your team will upload leads generated from your campaigns here. Check back after your next campaign goes live." />
      ) : (
        <div className="space-y-3">
          {batches.map(batch => {
            const contactedInBatch = batch.contactedCount || 0;
            const pctContacted = batch.count > 0 ? Math.round((contactedInBatch / batch.count) * 100) : 0;
            const isExpanded = expandedBatch === batch._id;

            return (
              <Card key={batch._id} className="overflow-hidden">
                {/* Batch header */}
                <div className="flex items-center justify-between p-5 cursor-pointer hover:bg-[var(--fd-surface-raised)] transition-colors"
                  onClick={() => loadBatchLeads(batch._id)}>
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, var(--fd-sidebar-link-active), #6366f1)', boxShadow: '0 4px 12px rgba(99,102,241,0.25)' }}>
                      <Target size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold" style={{ color: 'var(--fd-ink-1)' }}>{batch.batchLabel || 'Lead Upload'}</div>
                      <div className="text-xs flex flex-wrap items-center gap-2 mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>
                        <span className="font-medium" style={{ color: 'var(--fd-sidebar-link-active)' }}>{batch.count} leads</span>
                        <span>·</span><span>Uploaded {timeAgo(batch.createdAt)}</span>
                        {batch.sources?.filter(Boolean).length > 0 && (
                          <><span>·</span><span style={{ color: 'var(--fd-ink-3)' }}>{batch.sources.filter(Boolean).join(', ')}</span></>
                        )}
                      </div>
                      {pctContacted > 0 && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--fd-border)' }}>
                            <div className="h-full rounded-full" style={{ width: `${pctContacted}%`, background: 'var(--fd-sidebar-link-active)' }} />
                          </div>
                          <span className="text-[10.5px]" style={{ color: 'var(--fd-ink-4)' }}>{pctContacted}% worked</span>
                          {batch.convertedCount > 0 && (
                            <span className="text-[10.5px] font-medium" style={{ color: '#10b981' }}>✓ {batch.convertedCount} converted</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    {isExpanded ? <ChevronUp size={16} style={{ color: 'var(--fd-ink-4)' }} /> : <ChevronDown size={16} style={{ color: 'var(--fd-ink-4)' }} />}
                  </div>
                </div>

                {/* Leads table */}
                {isExpanded && (
                  <div className="border-t" style={{ borderColor: 'var(--fd-border-subtle)' }}>
                    {/* Search */}
                    <div className="px-4 py-3 border-b flex items-center gap-3"
                      style={{ borderColor: 'var(--fd-border-subtle)', background: 'var(--fd-surface-sunken)' }}>
                      <div className="relative flex-1 max-w-xs">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fd-ink-4)' }} />
                        <input type="text" placeholder="Search by name, phone, email…"
                          value={search} onChange={e => setSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-[12.5px] rounded-lg outline-none"
                          style={{ background: 'var(--fd-input-bg)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-1)' }} />
                      </div>
                      <span className="text-[11.5px]" style={{ color: 'var(--fd-ink-4)' }}>
                        {filteredLeads.length} of {leads.length} leads
                      </span>
                    </div>

                    {leads.length === 0 ? (
                      <div className="py-8 flex justify-center"><Spinner /></div>
                    ) : filteredLeads.length === 0 ? (
                      <div className="py-10 text-center" style={{ color: 'var(--fd-ink-4)' }}>
                        <Search size={20} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No leads match your search.</p>
                      </div>
                    ) : (
                      <>
                        {/* Desktop */}
                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead style={{ background: 'var(--fd-surface-raised)' }}>
                              <tr>
                                {['Name', 'Contact', 'Location / Source', 'Status', 'Activity', 'Date', ''].map(h => (
                                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                                    style={{ color: 'var(--fd-ink-3)' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--fd-border)]">
                              {filteredLeads.map(lead => (
                                <LeadRow key={lead._id} lead={lead} onClick={() => setSelectedLead(lead)} />
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {/* Mobile */}
                        <div className="md:hidden">
                          {filteredLeads.map(lead => (
                            <MobileLeadCard key={lead._id} lead={lead} onClick={() => setSelectedLead(lead)} />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Drawer */}
      {selectedLead && createPortal(
        <LeadDrawer key={selectedLead._id} lead={selectedLead} onClose={() => setSelectedLead(null)} onUpdated={handleLeadUpdated} />,
        document.body
      )}
    </div>
  );
}