import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, Search, Upload, X, ChevronDown, Phone, Mail,
  Building2, MapPin, Globe, Tag, Flame, Thermometer, Snowflake,
  Calendar, Clock, StickyNote, Trash2, Edit3, Check, ChevronRight,
  ArrowRight, MoreHorizontal, Download, Filter, RefreshCw,
  TrendingUp, Users, DollarSign, Bell, FileText, Linkedin,
  Facebook, Instagram, MessageCircle, Target, BarChart2,
} from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { Button } from '../../components/ui/index';
import { formatDate, timeAgo } from '../../lib/utils';

// ── Constants ─────────────────────────────────────────────────────────────────
const STAGES = [
  { id: 'new',               label: 'New',               color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  { id: 'contacted',         label: 'Contacted',         color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  { id: 'meeting_scheduled', label: 'Meeting Scheduled', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  { id: 'proposal_sent',     label: 'Proposal Sent',     color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  { id: 'negotiation',       label: 'Negotiation',       color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  { id: 'won',               label: 'Won ✓',             color: '#22c55e', bg: 'rgba(34,197,94,0.12)'  },
  { id: 'lost',              label: 'Lost',              color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
];

const SOURCES = [
  { id: 'referral',      label: 'Referral',       icon: Users },
  { id: 'linkedin',      label: 'LinkedIn',        icon: Linkedin },
  { id: 'facebook',      label: 'Facebook',        icon: Facebook },
  { id: 'instagram',     label: 'Instagram',       icon: Instagram },
  { id: 'cold_outreach', label: 'Cold Outreach',   icon: MessageCircle },
  { id: 'website',       label: 'Website',         icon: Globe },
  { id: 'walk_in',       label: 'Walk-in',         icon: Building2 },
  { id: 'other',         label: 'Other',           icon: Tag },
];

const SERVICES_OPTIONS = [
  'Meta Ads', 'Google Ads', 'TikTok Ads', 'SEO', 'Content Marketing',
  'Social Media Management', 'Email Marketing', 'Branding', 'Video Production',
  'Influencer Marketing', 'WhatsApp Marketing', 'Website Development',
];

const QUALITY_ICONS = {
  hot:  { icon: Flame,       color: '#ef4444', label: 'Hot'  },
  warm: { icon: Thermometer, color: '#f59e0b', label: 'Warm' },
  cold: { icon: Snowflake,   color: '#3b82f6', label: 'Cold' },
};

// ── Portal ────────────────────────────────────────────────────────────────────
function Portal({ children }) {
  return createPortal(children, document.body);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function stageInfo(id) { return STAGES.find(s => s.id === id) || STAGES[0]; }

function QualityBadge({ quality }) {
  const q = QUALITY_ICONS[quality] || QUALITY_ICONS.warm;
  const Icon = q.icon;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ color: q.color, background: q.color + '18' }}>
      <Icon size={11} strokeWidth={2.2} />
      {q.label}
    </span>
  );
}

function StagePill({ stage }) {
  const s = stageInfo(stage);
  return (
    <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ color: s.color, background: s.bg }}>
      {s.label}
    </span>
  );
}

function Avatar({ name, size = 28 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const colors = ['#4f6ef0','#8b5cf6','#f59e0b','#22c55e','#ef4444','#f97316'];
  const hue = initials.charCodeAt(0) % colors.length;
  return (
    <div className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38, background: colors[hue] }}>
      {initials}
    </div>
  );
}

function isOverdue(date) {
  if (!date) return false;
  return new Date(date) < new Date() && new Date(date).toDateString() !== new Date().toDateString();
}

function isToday(date) {
  if (!date) return false;
  return new Date(date).toDateString() === new Date().toDateString();
}

// ── Lead Card (for Kanban) ────────────────────────────────────────────────────
function LeadCard({ lead, onClick, onDragStart, isDragging }) {
  const s = stageInfo(lead.stage);
  const followUp = lead.followUpDate;
  const overdue  = isOverdue(followUp);
  const todayFU  = isToday(followUp);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="rounded-xl p-3.5 cursor-pointer transition-all select-none"
      style={{
        background: 'var(--fd-card-bg)',
        border: '1px solid var(--fd-border)',
        opacity: isDragging ? 0.5 : 1,
        boxShadow: isDragging
          ? '0 8px 24px rgba(0,0,0,0.18)'
          : '0 1px 3px rgba(0,0,0,0.07)',
        transform: isDragging ? 'rotate(2deg)' : 'none',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar name={lead.name || lead.company || '?'} size={26} />
          <div className="min-w-0">
            <div className="text-[12.5px] font-semibold truncate" style={{ color: 'var(--fd-ink-1)' }}>
              {lead.name || '—'}
            </div>
            {lead.company && (
              <div className="text-[11px] truncate" style={{ color: 'var(--fd-ink-4)' }}>
                {lead.company}
              </div>
            )}
          </div>
        </div>
        <QualityBadge quality={lead.quality} />
      </div>

      {/* Services */}
      {lead.services?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {lead.services.slice(0, 3).map(s => (
            <span key={s} className="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)' }}>
              {s}
            </span>
          ))}
          {lead.services.length > 3 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ color: 'var(--fd-ink-4)' }}>
              +{lead.services.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          {lead.phone && (
            <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 text-[11px] transition-opacity hover:opacity-70"
              style={{ color: 'var(--fd-ink-4)' }}>
              <Phone size={10} /> {lead.phone}
            </a>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {lead.notes?.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px]" style={{ color: 'var(--fd-ink-5)' }}>
              <StickyNote size={10} />{lead.notes.length}
            </span>
          )}
          {followUp && (
            <span className="flex items-center gap-0.5 text-[10.5px] font-medium"
              style={{ color: overdue ? '#ef4444' : todayFU ? '#f59e0b' : 'var(--fd-ink-4)' }}>
              <Bell size={10} />
              {overdue ? 'Overdue' : todayFU ? 'Today' : formatDate(followUp)}
            </span>
          )}
          {lead.budget && (
            <span className="text-[10px] font-semibold" style={{ color: '#22c55e' }}>
              {lead.budget}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Kanban Column ─────────────────────────────────────────────────────────────
function KanbanColumn({ stage, leads, onDrop, onDragOver, onLeadClick, draggedId }) {
  const s = stageInfo(stage.id);
  const total = leads.reduce((acc, l) => acc + (l.dealValue || 0), 0);

  return (
    <div className="flex flex-col rounded-2xl min-h-[400px] w-[260px] flex-shrink-0"
      style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}
      onDrop={onDrop}
      onDragOver={onDragOver}>
      {/* Column header */}
      <div className="px-3.5 py-3 flex items-center justify-between border-b"
        style={{ borderColor: 'var(--fd-border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
          <span className="text-[12.5px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>{s.label}</span>
          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: s.bg, color: s.color }}>
            {leads.length}
          </span>
        </div>
        {total > 0 && (
          <span className="text-[10.5px] font-bold" style={{ color: '#22c55e' }}>
            ₹{total.toLocaleString('en-IN')}
          </span>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 p-2.5 space-y-2 overflow-y-auto">
        {leads.map(lead => (
          <LeadCard
            key={lead._id}
            lead={lead}
            onClick={() => onLeadClick(lead)}
            onDragStart={(e) => { e.dataTransfer.setData('leadId', lead._id); e.dataTransfer.setData('fromStage', lead.stage); }}
            isDragging={draggedId === lead._id}
          />
        ))}
        {leads.length === 0 && (
          <div className="flex flex-col items-center justify-center h-24 text-[11px]"
            style={{ color: 'var(--fd-ink-5)' }}>
            <Target size={16} strokeWidth={1.5} className="mb-1" />
            Drop leads here
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add / Edit Lead Modal ──────────────────────────────────────────────────────
function LeadFormModal({ lead, onClose, onSave }) {
  const [form, setForm] = useState(() => {
    const overrides = {
      services:     lead?.services || [],
      tags:         (lead?.tags || []).join(', '),
      dealValue:    lead?.dealValue ?? '',
      followUpDate: lead?.followUpDate ? new Date(lead.followUpDate).toISOString().slice(0, 16) : '',
    };
    return {
      name: '',
      email: '',
      phone: '',
      company: '',
      website: '',
      location: '',
      source: 'other',
      sourceDetail: '',
      budget: '',
      dealValue: '',
      quality: 'warm',
      stage: 'new',
      services: [],
      requirements: '',
      followUpDate: '',
      followUpNote: '',
      tags: '',
      ...(lead || {}),
      ...overrides,
    };
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleService = (s) => {
    set('services', form.services.includes(s)
      ? form.services.filter(x => x !== s)
      : [...form.services, s]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        dealValue: Number(form.dealValue) || 0,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        followUpDate: form.followUpDate || null,
      };
      await onSave(payload);
      onClose();
    } catch(e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const InputClass = "w-full rounded-lg px-3 py-2 text-[13px] outline-none transition-all";
  const inputStyle = {
    background: 'var(--fd-input-bg)',
    border: '1px solid var(--fd-border)',
    color: 'var(--fd-ink-1)',
  };

  return (
    <Portal>
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)', zIndex: 9999 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ background: 'var(--fd-card-bg)', border: '1px solid var(--fd-border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--fd-border)' }}>
          <h2 className="text-[15px] font-bold" style={{ color: 'var(--fd-ink-1)' }}>
            {lead?._id ? 'Edit Lead' : 'Add New Lead'}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg"><X size={16} /></button>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          {/* Contact info */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--fd-ink-4)' }}>
              Contact Info
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[['name','Name','text'],['email','Email','email'],['phone','Phone','tel'],['company','Company','text'],['website','Website','url'],['location','Location','text']].map(([k, label, type]) => (
                <div key={k}>
                  <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--fd-ink-3)' }}>{label}</label>
                  <input type={type} className={InputClass} style={inputStyle}
                    value={form[k] || ''} onChange={e => set(k, e.target.value)}
                    placeholder={label} />
                </div>
              ))}
            </div>
          </div>

          {/* Lead details */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--fd-ink-4)' }}>
              Lead Details
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--fd-ink-3)' }}>Quality</label>
                <select className={InputClass} style={inputStyle} value={form.quality} onChange={e => set('quality', e.target.value)}>
                  <option value="hot">🔥 Hot</option>
                  <option value="warm">🌡️ Warm</option>
                  <option value="cold">❄️ Cold</option>
                </select>
              </div>
              <div>
                <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--fd-ink-3)' }}>Stage</label>
                <select className={InputClass} style={inputStyle} value={form.stage} onChange={e => set('stage', e.target.value)}>
                  {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--fd-ink-3)' }}>Source</label>
                <select className={InputClass} style={inputStyle} value={form.source} onChange={e => set('source', e.target.value)}>
                  {SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--fd-ink-3)' }}>Budget / Month</label>
                <input className={InputClass} style={inputStyle} value={form.budget || ''} onChange={e => set('budget', e.target.value)} placeholder="e.g. ₹30,000 / $2000" />
              </div>
              <div>
                <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--fd-ink-3)' }}>Deal Value (₹)</label>
                <input type="number" className={InputClass} style={inputStyle} value={form.dealValue || ''} onChange={e => set('dealValue', e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--fd-ink-3)' }}>Source Detail</label>
                <input className={InputClass} style={inputStyle} value={form.sourceDetail || ''} onChange={e => set('sourceDetail', e.target.value)} placeholder="Referred by / campaign name" />
              </div>
              <div>
                <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--fd-ink-3)' }}>Tags (comma-sep)</label>
                <input className={InputClass} style={inputStyle} value={form.tags || ''} onChange={e => set('tags', e.target.value)} placeholder="ecommerce, startup, local" />
              </div>
            </div>
          </div>

          {/* Services */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--fd-ink-4)' }}>Services Interested In</p>
            <div className="flex flex-wrap gap-1.5">
              {SERVICES_OPTIONS.map(svc => (
                <button key={svc} onClick={() => toggleService(svc)}
                  className="text-[11.5px] px-2.5 py-1 rounded-lg font-medium transition-all"
                  style={form.services.includes(svc)
                    ? { background: '#4f6ef0', color: '#fff', border: '1px solid #3a56d4' }
                    : { background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)', border: '1px solid var(--fd-border)' }}>
                  {svc}
                </button>
              ))}
            </div>
          </div>

          {/* Follow-up */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--fd-ink-4)' }}>
              Follow-up
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--fd-ink-3)' }}>Follow-up Date & Time</label>
                <input type="datetime-local" className={InputClass} style={inputStyle}
                  value={form.followUpDate || ''} onChange={e => set('followUpDate', e.target.value)} />
              </div>
              <div>
                <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--fd-ink-3)' }}>Follow-up Reminder Note</label>
                <input className={InputClass} style={inputStyle} value={form.followUpNote || ''}
                  onChange={e => set('followUpNote', e.target.value)} placeholder="What to discuss..." />
              </div>
            </div>
          </div>

          {/* Requirements */}
          <div>
            <label className="text-[11.5px] font-medium mb-1 block" style={{ color: 'var(--fd-ink-3)' }}>Requirements / Context</label>
            <textarea rows={3} className={InputClass} style={{ ...inputStyle, resize: 'vertical' }}
              value={form.requirements || ''} onChange={e => set('requirements', e.target.value)}
              placeholder="What does this lead need? Any context..." />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t"
          style={{ borderColor: 'var(--fd-border)' }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : lead?._id ? 'Save Changes' : 'Add Lead'}
          </Button>
        </div>
      </div>
    </div>
    </Portal>
  );
}

// ── Lead Detail Drawer ────────────────────────────────────────────────────────
function LeadDrawer({ lead: initialLead, onClose, onUpdate, onDelete }) {
  const { user } = useAuthStore();
  const [lead, setLead] = useState(initialLead);
  const [note, setNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [followUp, setFollowUp] = useState(lead.followUpDate ? new Date(lead.followUpDate).toISOString().slice(0,16) : '');
  const [followUpNote, setFollowUpNote] = useState(lead.followUpNote || '');
  const [savingFU, setSavingFU] = useState(false);
  const [fuSaved, setFuSaved] = useState(false);

  useEffect(() => { setLead(initialLead); }, [initialLead]);

  const addNote = async () => {
    if (!note.trim()) return;
    setAddingNote(true);
    try {
      const { data } = await api.post(`/internal-leads/${lead._id}/notes`, { body: note.trim() });
      setLead(data.lead);
      setNote('');
      onUpdate(data.lead);
    } finally { setAddingNote(false); }
  };

  const deleteNote = async (noteId) => {
    const { data } = await api.delete(`/internal-leads/${lead._id}/notes/${noteId}`);
    setLead(data.lead);
    onUpdate(data.lead);
  };

  const saveFollowUp = async () => {
    setSavingFU(true);
    try {
      const { data } = await api.put(`/internal-leads/${lead._id}`, { followUpDate: followUp || null, followUpNote });
      setLead(data.lead);
      onUpdate(data.lead);
      setFuSaved(true);
      setTimeout(() => setFuSaved(false), 3000);
    } finally { setSavingFU(false); }
  };

  const changeStage = async (stageId) => {
    const { data } = await api.put(`/internal-leads/${lead._id}`, { stage: stageId });
    setLead(data.lead);
    onUpdate(data.lead);
  };

  const s = stageInfo(lead.stage);

  return (
    <Portal>
    <>
      <div className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.3)', zIndex: 9998 }} onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 flex flex-col w-[440px] max-w-full shadow-2xl overflow-hidden"
        style={{ background: 'var(--fd-card-bg)', borderLeft: '1px solid var(--fd-border)', zIndex: 9999 }}>

        {/* Drawer header */}
        <div className="flex items-start justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--fd-border)', background: 'var(--fd-surface-sunken)' }}>
          <div className="flex items-center gap-3">
            <Avatar name={lead.name || lead.company || '?'} size={38} />
            <div>
              <h2 className="text-[15px] font-bold" style={{ color: 'var(--fd-ink-1)' }}>
                {lead.name || '—'}
              </h2>
              {lead.company && (
                <div className="text-[12px]" style={{ color: 'var(--fd-ink-4)' }}>{lead.company}</div>
              )}
              <div className="flex items-center gap-2 mt-1">
                <StagePill stage={lead.stage} />
                <QualityBadge quality={lead.quality} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowEditModal(true)} className="btn-ghost p-1.5 rounded-lg"><Edit3 size={15} /></button>
            <button onClick={() => { if (window.confirm('Delete this lead?')) { onDelete(lead._id); onClose(); } }}
              className="btn-ghost p-1.5 rounded-lg" style={{ color: '#ef4444' }}><Trash2 size={15} /></button>
            <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg"><X size={16} /></button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Contact details */}
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--fd-border)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--fd-ink-4)' }}>Contact</p>
            <div className="space-y-2">
              {lead.phone && (
                <a href={`tel:${lead.phone}`} className="flex items-center gap-2.5 text-[13px] hover:opacity-80" style={{ color: 'var(--fd-ink-2)' }}>
                  <Phone size={13} style={{ color: '#4f6ef0' }} />{lead.phone}
                </a>
              )}
              {lead.email && (
                <a href={`mailto:${lead.email}`} className="flex items-center gap-2.5 text-[13px] hover:opacity-80" style={{ color: 'var(--fd-ink-2)' }}>
                  <Mail size={13} style={{ color: '#4f6ef0' }} />{lead.email}
                </a>
              )}
              {lead.location && (
                <span className="flex items-center gap-2.5 text-[13px]" style={{ color: 'var(--fd-ink-3)' }}>
                  <MapPin size={13} style={{ color: 'var(--fd-ink-4)' }} />{lead.location}
                </span>
              )}
              {lead.website && (
                <a href={lead.website} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 text-[13px] hover:opacity-80" style={{ color: '#4f6ef0' }}>
                  <Globe size={13} />{lead.website}
                </a>
              )}
            </div>
          </div>

          {/* Deal info */}
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--fd-border)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--fd-ink-4)' }}>Deal Info</p>
            <div className="grid grid-cols-2 gap-3" style={{ wordBreak: 'break-word' }}>
              {[
                ['Budget', lead.budget],
                ['Deal Value', lead.dealValue ? `₹${lead.dealValue.toLocaleString('en-IN')}` : null],
                ['Source', SOURCES.find(s => s.id === lead.source)?.label],
                ['Source Detail', lead.sourceDetail],
              ].map(([label, val]) => val ? (
                <div key={label}>
                  <div className="text-[10.5px] mb-0.5" style={{ color: 'var(--fd-ink-4)' }}>{label}</div>
                  <div className="text-[13px] font-medium" style={{ color: 'var(--fd-ink-1)' }}>{val}</div>
                </div>
              ) : null)}
            </div>
            {lead.services?.length > 0 && (
              <div className="mt-3">
                <div className="text-[10.5px] mb-1.5" style={{ color: 'var(--fd-ink-4)' }}>Services</div>
                <div className="flex flex-wrap gap-1">
                  {lead.services.map(s => (
                    <span key={s} className="text-[11px] px-2 py-0.5 rounded font-medium"
                      style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)', border: '1px solid var(--fd-border)' }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {lead.requirements && (
              <div className="mt-3">
                <div className="text-[10.5px] mb-1" style={{ color: 'var(--fd-ink-4)' }}>Requirements</div>
                <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--fd-ink-2)' }}>{lead.requirements}</p>
              </div>
            )}
          </div>

          {/* Move stage */}
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--fd-border)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: 'var(--fd-ink-4)' }}>Move Stage</p>
            <div className="flex flex-wrap gap-1.5">
              {STAGES.map(st => (
                <button key={st.id} onClick={() => changeStage(st.id)}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all"
                  style={lead.stage === st.id
                    ? { background: st.bg, color: st.color, border: `1.5px solid ${st.color}40` }
                    : { background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)', border: '1px solid var(--fd-border)' }}>
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Follow-up */}
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--fd-border)' }}>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--fd-ink-4)' }}>Follow-up</p>
              {lead.followUpDate && (
                <span
                  className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: isOverdue(lead.followUpDate) ? 'rgba(239,68,68,0.1)' : isToday(lead.followUpDate) ? 'rgba(245,158,11,0.1)' : 'rgba(79,110,240,0.1)',
                    color: isOverdue(lead.followUpDate) ? '#ef4444' : isToday(lead.followUpDate) ? '#f59e0b' : '#4f6ef0',
                  }}
                >
                  {isOverdue(lead.followUpDate) ? '⚠ Overdue' : isToday(lead.followUpDate) ? '🔔 Today' : `Scheduled: ${formatDate(lead.followUpDate)}`}
                </span>
              )}
            </div>
            <div className="space-y-2">
              <input type="datetime-local"
                className="w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
                style={{ background: 'var(--fd-input-bg)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-1)' }}
                value={followUp} onChange={e => setFollowUp(e.target.value)} />
              <input placeholder="Reminder note (what to discuss)"
                className="w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
                style={{ background: 'var(--fd-input-bg)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-1)' }}
                value={followUpNote} onChange={e => setFollowUpNote(e.target.value)} />
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={saveFollowUp} disabled={savingFU}>
                  {savingFU ? 'Saving…' : fuSaved ? <><Check size={12} /> Saved!</> : <><Check size={12} /> Set Follow-up</>}
                </Button>
                {fuSaved && (
                  <span className="text-[11.5px] font-medium" style={{ color: '#22c55e' }}>
                    Follow-up scheduled ✓
                  </span>
                )}
                {lead.followUpDate && (
                  <button
                    className="text-[11px] ml-auto transition-opacity hover:opacity-70"
                    style={{ color: '#ef4444' }}
                    onClick={async () => {
                      setFollowUp('');
                      setFollowUpNote('');
                      setSavingFU(true);
                      try {
                        const { data } = await api.put(`/internal-leads/${lead._id}`, { followUpDate: null, followUpNote: '' });
                        setLead(data.lead);
                        onUpdate(data.lead);
                      } finally { setSavingFU(false); }
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--fd-border)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--fd-ink-4)' }}>Notes ({lead.notes?.length || 0})</p>
            <div className="flex gap-2 mb-3">
              <textarea rows={2} placeholder="Add a note…"
                className="flex-1 rounded-lg px-3 py-2 text-[12.5px] outline-none resize-none"
                style={{ background: 'var(--fd-input-bg)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-1)' }}
                value={note} onChange={e => setNote(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addNote(); }} />
              <button onClick={addNote} disabled={addingNote || !note.trim()}
                className="btn-primary px-3 py-2 rounded-lg text-[12px] h-fit self-end"
                style={{ opacity: !note.trim() ? 0.5 : 1 }}>
                {addingNote ? '…' : 'Add'}
              </button>
            </div>
            <div className="space-y-2 max-h-[220px] overflow-y-auto">
              {[...(lead.notes || [])].reverse().map(n => (
                <div key={n._id} className="rounded-xl p-3"
                  style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12.5px] leading-relaxed flex-1" style={{ color: 'var(--fd-ink-2)' }}>{n.body}</p>
                    <button onClick={() => deleteNote(n._id)} className="btn-ghost p-1 rounded flex-shrink-0"
                      style={{ color: '#ef4444' }}><X size={11} /></button>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 text-[10.5px]" style={{ color: 'var(--fd-ink-5)' }}>
                    <Avatar name={n.createdBy?.name || '?'} size={14} />
                    {n.createdBy?.name} · {timeAgo(n.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity */}
          {lead.activity?.length > 0 && (
            <div className="px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--fd-ink-4)' }}>Activity</p>
              <div className="space-y-2.5 max-h-[240px] overflow-y-auto">
                {[...(lead.activity || [])].reverse().slice(0, 20).map((a, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#4f6ef0' }} />
                    <div>
                      <p className="text-[12px]" style={{ color: 'var(--fd-ink-2)' }}>{a.note}</p>
                      <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--fd-ink-5)' }}>
                        {a.by?.name} · {timeAgo(a.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showEditModal && (
        <LeadFormModal
          lead={lead}
          onClose={() => setShowEditModal(false)}
          onSave={async (payload) => {
            const { data } = await api.put(`/internal-leads/${lead._id}`, payload);
            setLead(data.lead);
            onUpdate(data.lead);
          }}
        />
      )}
    </>
    </Portal>
  );
}

// ── Import Modal ──────────────────────────────────────────────────────────────
function ImportModal({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef();

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/internal-leads/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data);
      onImported();
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Portal>
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)', zIndex: 9999 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl"
        style={{ background: 'var(--fd-card-bg)', border: '1px solid var(--fd-border)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--fd-border)' }}>
          <h2 className="text-[14px] font-bold" style={{ color: 'var(--fd-ink-1)' }}>Import Leads from Excel</h2>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          {result ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-2">🎉</div>
              <p className="text-[14px] font-bold" style={{ color: 'var(--fd-ink-1)' }}>
                {result.count} leads imported!
              </p>
              <Button variant="primary" className="mt-4" onClick={onClose}>Done</Button>
            </div>
          ) : (
            <>
              <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--fd-ink-3)' }}>
                Upload an Excel or CSV file. Supported columns:
                <br /><span className="font-mono text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>
                  name, email, phone, company, website, location, source, budget, requirements
                </span>
              </div>
              <div
                className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors"
                style={{ borderColor: file ? '#4f6ef0' : 'var(--fd-border)', background: file ? 'rgba(79,110,240,0.05)' : 'var(--fd-surface-sunken)' }}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files[0]); }}>
                <Upload size={24} className="mx-auto mb-2" style={{ color: file ? '#4f6ef0' : 'var(--fd-ink-4)' }} />
                <p className="text-[13px] font-medium" style={{ color: file ? '#4f6ef0' : 'var(--fd-ink-3)' }}>
                  {file ? file.name : 'Drop file here or click to browse'}
                </p>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                  onChange={e => setFile(e.target.files[0])} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button variant="primary" onClick={handleImport} disabled={!file || loading}>
                  {loading ? 'Importing…' : <><Upload size={13} /> Import</>}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
    </Portal>
  );
}

// ── Stats Bar ─────────────────────────────────────────────────────────────────
function StatsBar({ stats }) {
  if (!stats) return null;

  const byStage = stats.byStage || {};
  const totalLeads = Object.values(byStage).reduce((a, b) => a + b.count, 0);

  // Top row: summary KPIs
  const summaryItems = [
    { label: 'Total',             value: totalLeads,                                                                        icon: Target,    color: '#4f6ef0' },
    { label: 'Hot',               value: stats.byQuality?.hot || 0,                                                         icon: Flame,     color: '#ef4444' },
    { label: 'Follow-ups Today',  value: stats.followUpsToday || 0,                                                         icon: Bell,      color: '#f59e0b' },
    { label: 'Won Value',         value: stats.totalWonValue ? `₹${stats.totalWonValue.toLocaleString('en-IN')}` : '₹0',   icon: TrendingUp, color: '#22c55e' },
  ];

  // Bottom row: per-stage counts
  const stageItems = STAGES.map(s => ({
    label: s.label,
    value: byStage[s.id]?.count ?? 0,
    color: s.color,
    bg:    s.bg,
  }));

  return (
    <div className="space-y-3">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summaryItems.map(item => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background: 'var(--fd-card-bg)', border: '1px solid var(--fd-border)' }}>
              <div className="p-2 rounded-lg flex-shrink-0" style={{ background: item.color + '18' }}>
                <Icon size={15} style={{ color: item.color }} />
              </div>
              <div>
                <div className="text-[16px] font-bold" style={{ color: 'var(--fd-ink-1)' }}>{item.value}</div>
                <div className="text-[10.5px]" style={{ color: 'var(--fd-ink-4)' }}>{item.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Per-stage KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {stageItems.map(item => (
          <div key={item.label} className="rounded-xl px-3 py-2.5 flex items-center gap-2.5"
            style={{ background: 'var(--fd-card-bg)', border: `1px solid ${item.color}28` }}>
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
            <div className="min-w-0">
              <div className="text-[15px] font-bold" style={{ color: item.color }}>{item.value}</div>
              <div className="text-[10px] truncate" style={{ color: 'var(--fd-ink-4)' }}>{item.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function InternalLeadsPage() {
  const { user } = useAuthStore();
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterQuality, setFilterQuality] = useState('');
  const [view, setView] = useState('kanban'); // 'kanban' | 'list'
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [draggedId, setDraggedId] = useState(null);
  const [showFollowUpsOnly, setShowFollowUpsOnly] = useState(false);

  // Auto-open a lead drawer if ?lead=ID is in the URL
  const [searchParams, setSearchParams] = useSearchParams();
  const autoOpenLeadId = searchParams.get('lead');

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (filterQuality) params.quality = filterQuality;
      if (showFollowUpsOnly) params.followUpToday = true;
      const [leadsRes, statsRes] = await Promise.all([
        api.get('/internal-leads', { params }),
        api.get('/internal-leads/stats'),
      ]);
      setLeads(leadsRes.data.leads);
      setStats(statsRes.data);
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, filterQuality, showFollowUpsOnly]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Once leads are loaded, auto-open the lead from the URL param
  useEffect(() => {
    if (!autoOpenLeadId || leads.length === 0) return;
    const found = leads.find(l => l._id === autoOpenLeadId);
    if (found) {
      setSelectedLead(found);
      // Remove the ?lead= param from URL so a refresh doesn't re-open
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete('lead');
        return next;
      }, { replace: true });
    }
  }, [autoOpenLeadId, leads]);

  const handleDrop = async (e, targetStage) => {
    e.preventDefault();
    const leadId   = e.dataTransfer.getData('leadId');
    const fromStage = e.dataTransfer.getData('fromStage');
    if (!leadId || fromStage === targetStage) return;

    // Optimistic update
    setLeads(prev => prev.map(l => l._id === leadId ? { ...l, stage: targetStage } : l));
    setDraggedId(null);

    try {
      const { data } = await api.put(`/internal-leads/${leadId}`, { stage: targetStage });
      setLeads(prev => prev.map(l => l._id === data.lead._id ? data.lead : l));
    } catch(e) {
      console.error(e);
      fetchLeads();
    }
  };

  const handleAddLead = async (payload) => {
    const { data } = await api.post('/internal-leads', payload);
    setLeads(prev => [data.lead, ...prev]);
    fetchLeads(); // refresh stats
  };

  const handleUpdateLead = (updated) => {
    setLeads(prev => prev.map(l => l._id === updated._id ? updated : l));
    if (selectedLead?._id === updated._id) setSelectedLead(updated);
  };

  const handleDeleteLead = async (id) => {
    await api.delete(`/internal-leads/${id}`);
    setLeads(prev => prev.filter(l => l._id !== id));
    fetchLeads();
  };

  // Group leads by stage for kanban
  const byStage = STAGES.reduce((acc, s) => {
    acc[s.id] = leads.filter(l => l.stage === s.id);
    return acc;
  }, {});

  const filteredLeads = leads; // search/filter already applied server-side

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold tracking-[-0.02em]" style={{ color: 'var(--fd-ink-1)' }}>
            🎯 Internal Leads
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>
            Company's own lead pipeline — visible to Admin & Performance Marketers only
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={fetchLeads}
            className="btn-ghost p-2 rounded-lg" title="Refresh">
            <RefreshCw size={15} />
          </button>
          <button onClick={() => setShowImportModal(true)}
            className="btn-secondary flex items-center gap-1.5 text-[12.5px]">
            <Upload size={13} /><span className="hidden sm:inline"> Import Excel</span><span className="sm:hidden"> Import</span>
          </button>
          <button onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-1.5 text-[12.5px]">
            <Plus size={13} /> Add Lead
          </button>
        </div>
      </div>

      {/* Stats */}
      <StatsBar stats={stats} />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-[280px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fd-ink-4)' }} />
          <input
            className="w-full pl-8 pr-3 py-2 rounded-lg text-[12.5px] outline-none"
            style={{ background: 'var(--fd-input-bg)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-1)' }}
            placeholder="Search leads…"
            value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Quality filter */}
        <select
          className="rounded-lg px-3 py-2 text-[12.5px] outline-none"
          style={{ background: 'var(--fd-input-bg)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-1)' }}
          value={filterQuality}
          onChange={e => setFilterQuality(e.target.value)}>
          <option value="">All quality</option>
          <option value="hot">🔥 Hot</option>
          <option value="warm">🌡️ Warm</option>
          <option value="cold">❄️ Cold</option>
        </select>

        {/* Follow-ups today filter */}
        <button
          onClick={() => setShowFollowUpsOnly(!showFollowUpsOnly)}
          className="flex items-center gap-1.5 text-[12.5px] px-3 py-2 rounded-lg font-medium transition-all"
          style={showFollowUpsOnly
            ? { background: '#f59e0b18', color: '#f59e0b', border: '1.5px solid #f59e0b40' }
            : { background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)', border: '1px solid var(--fd-border)' }}>
          <Bell size={12} />
          Today's Follow-ups
          {stats?.followUpsToday > 0 && (
            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
              style={{ background: '#f59e0b', color: '#fff' }}>
              {stats.followUpsToday}
            </span>
          )}
        </button>

        <div className="ml-auto flex items-center gap-1 rounded-lg p-1" style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}>
          {['kanban', 'list'].map(v => (
            <button key={v} onClick={() => setView(v)}
              className="px-3 py-1.5 rounded-md text-[12px] font-medium capitalize transition-all"
              style={view === v
                ? { background: 'var(--fd-card-bg)', color: 'var(--fd-ink-1)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                : { color: 'var(--fd-ink-4)' }}>
              {v === 'kanban' ? '⬛ Kanban' : '≡ List'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-[#4f6ef0] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : view === 'kanban' ? (
        /* Kanban board */
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
            {STAGES.map(stage => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                leads={byStage[stage.id] || []}
                draggedId={draggedId}
                onLeadClick={setSelectedLead}
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(e, stage.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        /* List view */
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--fd-border)' }}>
          <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]" style={{ minWidth: 700 }}>
            <thead>
              <tr style={{ background: 'var(--fd-surface-sunken)', borderBottom: '1px solid var(--fd-border)' }}>
                {['Name / Company','Contact','Stage','Quality','Follow-up','Budget','Added'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--fd-ink-4)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12" style={{ color: 'var(--fd-ink-4)' }}>
                    No leads yet. Add your first lead!
                  </td>
                </tr>
              ) : filteredLeads.map(lead => {
                const fu = lead.followUpDate;
                const overdue = isOverdue(fu);
                const todayFU = isToday(fu);
                return (
                  <tr key={lead._id}
                    className="border-b cursor-pointer transition-colors hover:bg-[var(--fd-table-row-hover)]"
                    style={{ borderColor: 'var(--fd-table-row-border)' }}
                    onClick={() => setSelectedLead(lead)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={lead.name || lead.company || '?'} size={28} />
                        <div>
                          <div className="font-semibold" style={{ color: 'var(--fd-ink-1)' }}>{lead.name || '—'}</div>
                          {lead.company && <div style={{ color: 'var(--fd-ink-4)' }}>{lead.company}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--fd-ink-3)' }}>
                      {lead.phone || lead.email || '—'}
                    </td>
                    <td className="px-4 py-3"><StagePill stage={lead.stage} /></td>
                    <td className="px-4 py-3"><QualityBadge quality={lead.quality} /></td>
                    <td className="px-4 py-3">
                      {fu ? (
                        <span className="flex items-center gap-1"
                          style={{ color: overdue ? '#ef4444' : todayFU ? '#f59e0b' : 'var(--fd-ink-3)' }}>
                          <Bell size={11} />
                          {overdue ? 'Overdue' : todayFU ? 'Today' : formatDate(fu)}
                        </span>
                      ) : <span style={{ color: 'var(--fd-ink-5)' }}>—</span>}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--fd-ink-3)' }}>{lead.budget || '—'}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--fd-ink-4)' }}>{timeAgo(lead.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Modals & Drawer */}
      {showAddModal && (
        <LeadFormModal onClose={() => setShowAddModal(false)} onSave={handleAddLead} />
      )}
      {showImportModal && (
        <ImportModal onClose={() => setShowImportModal(false)} onImported={fetchLeads} />
      )}
      {selectedLead && (
        <LeadDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={handleUpdateLead}
          onDelete={handleDeleteLead}
        />
      )}
    </div>
  );
}