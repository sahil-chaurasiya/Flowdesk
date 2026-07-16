import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Building2, ChevronRight, Trash2, LayoutGrid, Table2, GripVertical } from 'lucide-react';
import api from '../../lib/api';
import { PageHeader, EmptyState, Avatar, Card, CardHeader, CardContent, Spinner } from '../../components/shared/LoadingScreen';
import { Button, Modal, Input, Select } from '../../components/ui/index';
import { formatDate, PLAN_LABELS } from '../../lib/utils';
import { useServices } from '../../hooks/useServices';
import useAuthStore from '../../context/authStore';

// ── Status / plan / card-accent colors — theme-proof ────────────────────────
// The app ships 8 full themes (light, dark, ocean, forest, sunset, rose,
// midnight, slate — see ThemeContext.jsx), each defining its own
// --fd-status-*-bg/text and --fd-accent-* CSS variables in index.css. Reading
// those variables directly (instead of hardcoding hex per light/dark, which
// only covered 2 of the 8 themes and looked broken — mismatched pastel
// banners on dark backgrounds — in the other 6) means every color below is
// automatically correct in whichever theme is currently active, with no JS
// theme-detection needed at all.
const STATUS_TOKEN = {
  active:     { background: 'var(--fd-status-success-bg)', color: 'var(--fd-status-success-text)' },
  onboarding: { background: 'var(--fd-status-warning-bg)', color: 'var(--fd-status-warning-text)' },
  paused:     { background: 'var(--fd-status-warning-bg)', color: 'var(--fd-status-warning-text)' },
  inactive:   { background: 'var(--fd-status-neutral-bg)', color: 'var(--fd-status-neutral-text)' },
  churned:    { background: 'var(--fd-status-danger-bg)',  color: 'var(--fd-status-danger-text)' },
};

const PLAN_TOKEN = {
  '3_month':  { background: 'var(--fd-status-neutral-bg)', color: 'var(--fd-status-neutral-text)' },
  '6_month':  { background: 'var(--fd-accent-tint)',       color: 'var(--fd-accent-soft)' },
  '1_year':   { background: 'var(--fd-status-info-bg)',    color: 'var(--fd-status-info-text)' },
  // legacy
  starter:    { background: 'var(--fd-status-neutral-bg)', color: 'var(--fd-status-neutral-text)' },
  growth:     { background: 'var(--fd-accent-tint)',       color: 'var(--fd-accent-soft)' },
  scale:      { background: 'var(--fd-status-info-bg)',    color: 'var(--fd-status-info-text)' },
  enterprise: { background: 'var(--fd-status-warning-bg)', color: 'var(--fd-status-warning-text)' },
};

function getStatusStyle(status) {
  return STATUS_TOKEN[status] || STATUS_TOKEN.inactive;
}

function getPlanStyle(plan) {
  return PLAN_TOKEN[plan] || PLAN_TOKEN.starter;
}

// ── Box view card accent — a signature color band per client ─────────────────
// Rotates through the theme's own semantic tokens (accent, success, warning,
// info, danger, neutral) keyed off the first letter of the company name, so
// each client gets a consistent, distinct-looking banner that is always
// correct for the active theme.
const CARD_ACCENT_TOKENS = [
  { tint: 'var(--fd-accent-tint)',       ink: 'var(--fd-accent-soft)' },
  { tint: 'var(--fd-status-success-bg)', ink: 'var(--fd-status-success-text)' },
  { tint: 'var(--fd-status-warning-bg)', ink: 'var(--fd-status-warning-text)' },
  { tint: 'var(--fd-status-info-bg)',    ink: 'var(--fd-status-info-text)' },
  { tint: 'var(--fd-status-danger-bg)',  ink: 'var(--fd-status-danger-text)' },
  { tint: 'var(--fd-status-neutral-bg)', ink: 'var(--fd-status-neutral-text)' },
];
function getCardAccent(name) {
  const idx = (name?.charCodeAt(0) || 0) % CARD_ACCENT_TOKENS.length;
  return CARD_ACCENT_TOKENS[idx];
}

const STATUS_TABS = [
  { label: 'All',         value: '' },
  { label: 'Active',      value: 'active' },
  { label: 'Onboarding',  value: 'onboarding' },
  { label: 'Paused',      value: 'paused' },
  { label: 'Inactive',    value: 'inactive' },
];

// ── Table view: default column order + persistence key ───────────────────────
const DEFAULT_TABLE_COLUMNS = [
  { id: 'client',   label: 'Client' },
  { id: 'services', label: 'Services' },
  { id: 'manager',  label: 'Manager' },
  { id: 'plan',     label: 'Plan' },
  { id: 'status',   label: 'Status' },
  { id: 'since',    label: 'Since' },
];
// Client drag-and-drop order now lives in the database (per-user, on the
// User document via /api/users/me/client-order) so it persists forever and
// across devices/browsers instead of just this browser's localStorage. The
// localStorage key below is only used as an instant-paint cache while the
// real order loads from the server on first mount.
const CLIENT_ORDER_KEY = 'fd_clients_priority_order_cache_v1';
const VIEW_MODE_KEY = 'fd_clients_view_mode_v1';

function ClientForm({ initial, onSubmit, loading, managers }) {
  const { services: servicesList } = useServices();
  const { user: currentUser } = useAuthStore();
  const isAdmin = currentUser?.role === 'admin';
  const SERVICES_LIST = servicesList.filter(s => s.isActive).map(s => [s.key, s.label]);
  const [form, setForm] = useState(initial || {
    name: '', company: '', email: '', phone: '', website: '', industry: '',
    status: 'onboarding', plan: '3_month', services: [], monthlyBudget: '',
    accountManager: '', startDate: new Date().toISOString().split('T')[0], notes: '',
    createPortalUser: false, portalEmail: '', portalPassword: '',
    whatsappGroup: '', whatsappPhone: '',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const toggleService = s => set('services', form.services.includes(s)
    ? form.services.filter(x => x !== s) : [...form.services, s]);

  // Logo state — preview URL (for display) + actual File object (for upload)
  const [logoPreview, setLogoPreview] = useState(initial?.logo || null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoRemoved, setLogoRemoved] = useState(false);
  const logoInputRef = React.useRef(null);

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setLogoRemoved(false);
    e.target.value = '';
  };

  const handleLogoRemove = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setLogoRemoved(true);
  };

  const companyInitials = form.company
    ? form.company.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const PLAN_OPTIONS = [
    { value: '3_month',  label: '3 Month' },
    { value: '6_month',  label: '6 Month' },
    { value: '1_year',   label: '1 Year' },
  ];

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form, logoFile, logoRemoved); }} className="space-y-4">

      {/* Company Logo — top of form */}
      <div className="flex items-center gap-4 p-3 rounded-xl" style={{ background: 'var(--fd-surface-raised)', border: '1px solid var(--fd-border)' }}>
        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
        {/* Avatar preview */}
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer border-2 border-dashed transition-colors"
          style={{
            borderColor: logoPreview ? 'transparent' : 'var(--fd-border)',
            background: logoPreview ? 'transparent' : 'var(--fd-surface-sunken)',
          }}
          onClick={() => logoInputRef.current?.click()}
          title="Click to upload logo"
        >
          {logoPreview ? (
            <img src={logoPreview} alt="logo" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[15px] font-bold" style={{ color: 'var(--fd-ink-4)' }}>{companyInitials}</span>
          )}
        </div>
        {/* Label + buttons */}
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium mb-1" style={{ color: 'var(--fd-ink-2)' }}>Company Logo</div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all"
              style={{ background: 'var(--fd-btn-secondary-bg)', color: 'var(--fd-btn-secondary-text)', borderColor: 'var(--fd-btn-secondary-border)' }}
            >
              {logoPreview ? 'Change' : 'Upload'}
            </button>
            {logoPreview && (
              <button
                type="button"
                onClick={handleLogoRemove}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all"
                style={{ background: 'transparent', color: '#b91c1c', borderColor: '#fca5a5' }}
              >
                Remove
              </button>
            )}
            <span className="text-[10.5px]" style={{ color: 'var(--fd-ink-5)' }}>PNG, JPG · shown in client list</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Company *" value={form.company} onChange={e => set('company', e.target.value)} required />
        <Input label="Contact Name *" value={form.name} onChange={e => set('name', e.target.value)} required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Email *" type="email" value={form.email} onChange={e => set('email', e.target.value)} required />
        <Input label="Phone" value={form.phone} onChange={e => set('phone', e.target.value)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Website" value={form.website} onChange={e => set('website', e.target.value)} />
        <Input label="Industry" value={form.industry} onChange={e => set('industry', e.target.value)} />
      </div>
      <div className={`grid grid-cols-1 gap-3 ${isAdmin ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        <Select label="Status" value={form.status} onChange={e => set('status', e.target.value)}>
          {['onboarding','active','paused','inactive','churned'].map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </Select>
        <Select label="Plan" value={form.plan} onChange={e => set('plan', e.target.value)}>
          {PLAN_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
        {isAdmin && (
          <Input label="Monthly Budget" type="number" value={form.monthlyBudget} onChange={e => set('monthlyBudget', e.target.value)} />
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select label="Account Manager" value={form.accountManager} onChange={e => set('accountManager', e.target.value)}>
          <option value="">Select manager...</option>
          {managers.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
        </Select>
        <Input label="Start Date" type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
      </div>

      {/* Services */}
      <div>
        <label className="block text-[12px] font-medium mb-2 text-[var(--fd-ink-2)]">Services</label>
        <div className="flex flex-wrap gap-2">
          {SERVICES_LIST.map(([val, label]) => (
            <button
              type="button"
              key={val}
              onClick={() => toggleService(val)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all"
              style={form.services.includes(val)
                ? { background: '#4f6ef0', color: '#ffffff', borderColor: '#4060e0' }
                : { background: 'var(--fd-btn-secondary-bg)', color: 'var(--fd-btn-secondary-text)', borderColor: 'var(--fd-btn-secondary-border)' }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[12px] font-medium mb-1.5 text-[var(--fd-ink-2)]">Notes</label>
        <textarea
          className="fd-input resize-none"
          rows={3}
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
        />
      </div>

      <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--fd-surface-raised)', border: '1px solid var(--fd-border)' }}>
        <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--fd-ink-4)' }}>WhatsApp</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Group Link" placeholder="https://chat.whatsapp.com/..." value={form.whatsappGroup} onChange={e => set('whatsappGroup', e.target.value)} />
          <Input label="Phone Number (fallback)" placeholder="+91XXXXXXXXXX" value={form.whatsappPhone} onChange={e => set('whatsappPhone', e.target.value)} />
        </div>
        <p className="text-[11px]" style={{ color: 'var(--fd-ink-5)' }}>Group link takes priority. Phone is fallback for 1-on-1 chats.</p>
      </div>

      {!initial && (
        <div className="rounded-xl p-4 space-y-3 bg-[var(--fd-surface-raised)] border border-[var(--fd-border)]">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.createPortalUser}
              onChange={e => set('createPortalUser', e.target.checked)}
              className="rounded"
              style={{ accentColor: '#4f6ef0' }}
            />
            <span className="text-[13px] font-medium text-[var(--fd-ink-2)]">
              Create client portal login
            </span>
          </label>
          {form.createPortalUser && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <Input label="Portal Email" type="email" value={form.portalEmail} onChange={e => set('portalEmail', e.target.value)} />
              <Input label="Portal Password" value={form.portalPassword} onChange={e => set('portalPassword', e.target.value)} placeholder="Min 8 characters" />
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" loading={loading}>{initial ? 'Save Changes' : 'Create Client'}</Button>
      </div>
    </form>
  );
}

// ── Box view: draggable client card ───────────────────────────────────────────
// Redesigned as a small "profile card": a signature tinted banner (unique per
// client, same color family as their initials avatar) with the avatar
// overlapping it, name + contact underneath, then services and manager.
function ClientCard({ client, serviceLabels, onDragStart, onDragEnd, onDragOver, onDrop, onOpen, canDelete, onDelete, isDragging, isDragOver }) {
  const accent = getCardAccent(client.company);
  return (
    <div
      draggable
      onDragStart={e => { e.stopPropagation(); onDragStart(e, client); }}
      onDragEnd={onDragEnd}
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); onDragOver(client); }}
      onDrop={e => { e.preventDefault(); e.stopPropagation(); onDrop(client); }}
      onClick={() => onOpen(client._id)}
      className="group relative rounded-2xl cursor-pointer transition-all duration-200 hover:-translate-y-1 overflow-hidden"
      style={{
        background: 'var(--fd-surface)',
        border: isDragOver ? '1.5px solid #4f6ef0' : '1px solid var(--fd-border)',
        boxShadow: isDragOver
          ? '0 0 0 3px rgba(79,110,240,0.15)'
          : 'var(--fd-card-shadow, 0 1px 2px rgba(0,0,0,0.04))',
        opacity: isDragging ? 0.4 : 1,
      }}
      onMouseEnter={e => { if (!isDragOver) e.currentTarget.style.boxShadow = '0 10px 24px -8px rgba(0,0,0,0.14)'; }}
      onMouseLeave={e => { if (!isDragOver) e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'; }}
    >
      {/* Signature banner — this client's own color, echoed by their avatar */}
      <div className="h-11" style={{ background: accent.tint }} />

      {/* Drag handle floats over the banner, top-right */}
      <div
        className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2.5 cursor-grab active:cursor-grabbing w-6 h-6 rounded-lg flex items-center justify-center"
        style={{ color: accent.ink, background: 'rgba(255,255,255,0.6)' }}
        title="Drag to reorder"
      >
        <GripVertical size={13} />
      </div>

      <div className="px-3.5 pb-3.5">
        {/* Avatar overlaps the banner like a profile photo, status pill sits beside it */}
        <div className="flex items-end justify-between -mt-6">
          <Avatar
            name={client.company}
            src={client.logo}
            size="lg"
            className="ring-4 ring-[var(--fd-surface)]"
          />
          <span
            className="mb-0.5 text-[9.5px] font-semibold px-2 py-0.5 rounded-full capitalize shadow-sm"
            style={getStatusStyle(client.status)}
          >
            {client.status}
          </span>
        </div>

        <div className="mt-2.5">
          <div className="font-semibold text-[13px] truncate" style={{ color: 'var(--fd-ink-1)' }}>
            {client.company}
          </div>
          <div className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--fd-ink-4)' }}>
            {client.name}
          </div>
        </div>

        {client.services?.length > 0 && (
          <div className="flex gap-1 flex-wrap mt-2.5">
            {client.services.slice(0, 2).map(s => (
              <span
                key={s}
                className="px-1.5 py-0.5 rounded-md text-[10px] font-medium"
                style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)' }}
              >
                {serviceLabels[s] || s}
              </span>
            ))}
            {client.services.length > 2 && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px]" style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-4)' }}>
                +{client.services.length - 2}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--fd-border-subtle)' }}>
          <div className="flex items-center gap-1.5 min-w-0">
            {client.accountManager ? (
              <>
                <Avatar name={client.accountManager.name} size="xs" />
                <span className="text-[10.5px] truncate" style={{ color: 'var(--fd-ink-4)' }}>
                  {client.accountManager.name}
                </span>
              </>
            ) : (
              <span className="text-[10.5px]" style={{ color: 'var(--fd-ink-5)' }}>No manager</span>
            )}
          </div>
          {canDelete && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(client); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
              style={{ background: '#fef2f2', color: '#b91c1c' }}
              title="Delete client"
            >
              <Trash2 size={10} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Box view: a single free-flowing grid of client cards ─────────────────────
// No grouping by status — just cards you can drag into whatever priority
// order you want. Purely visual & saved in this browser; never touches the
// client's real status or any server data. The order itself lives in the
// parent component and is shared with the Table view, so reordering in
// either view stays in sync.
function ClientsBoardView({ orderedClients, serviceLabels, navigate, canDeleteClient, onDeleteRequest, onReorder }) {
  const dragClient = useRef(null);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const handleDragStart = (e, client) => {
    dragClient.current = client;
    setDraggingId(client._id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragEnd = () => {
    dragClient.current = null;
    setDraggingId(null);
    setDragOverId(null);
  };
  const handleDragOverCard = (client) => {
    if (dragClient.current && dragClient.current._id !== client._id) {
      setDragOverId(client._id);
    }
  };
  // Drop on a card: move dragged card to that card's position
  const handleDropOnCard = (targetClient) => {
    const dragged = dragClient.current;
    if (!dragged || dragged._id === targetClient._id) { handleDragEnd(); return; }
    onReorder(dragged._id, targetClient._id);
    handleDragEnd();
  };
  // Drop on empty grid background: send dragged card to the end
  const handleDropOnGrid = () => {
    const dragged = dragClient.current;
    if (!dragged) return;
    onReorder(dragged._id, null); // null target = move to end
    handleDragEnd();
  };

  return (
    <div
      onDragOver={e => e.preventDefault()}
      onDrop={handleDropOnGrid}
      className="grid gap-4"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
    >
      {orderedClients.map(client => (
        <ClientCard
          key={client._id}
          client={client}
          serviceLabels={serviceLabels}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOverCard}
          onDrop={handleDropOnCard}
          onOpen={id => navigate(`/admin/clients/${id}`)}
          canDelete={canDeleteClient(client)}
          onDelete={onDeleteRequest}
          isDragging={draggingId === client._id}
          isDragOver={dragOverId === client._id}
        />
      ))}
    </div>
  );
}

export default function ClientsPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [managers, setManagers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const MANAGER_FILTER_KEY = 'fd_clients_manager_filter';
  const [managerFilter, setManagerFilter] = useState(() => {
    try { return localStorage.getItem(MANAGER_FILTER_KEY) || ''; } catch { return ''; }
  });
  const updateManagerFilter = (val) => {
    setManagerFilter(val);
    try { localStorage.setItem(MANAGER_FILTER_KEY, val); } catch {}
  };
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const { serviceLabels } = useServices();
  const { user: currentUser } = useAuthStore();
  const isAdmin = currentUser?.role === 'admin';
  const isManager = currentUser?.role === 'manager';

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // ── View mode: table (default) or box, remembered per-browser ──────────────
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem(VIEW_MODE_KEY) || 'table'; } catch { return 'table'; }
  });
  const switchView = (mode) => {
    setViewMode(mode);
    try { localStorage.setItem(VIEW_MODE_KEY, mode); } catch {}
  };

  // ── Table columns: fixed order (only rows are draggable now) ────────────────
  const tableColumns = DEFAULT_TABLE_COLUMNS;

  // ── Shared client priority order — used by BOTH Table and Box views ────────
  // Dragging a row in Table view or a card in Box view updates this single
  // order, so the two views always stay in sync. It's saved permanently in
  // the database, per user (User.clientOrder) — so it never disappears, and
  // each user's own reordering never affects any other user. It never
  // touches the client's real status or any shared client data.
  //
  // On first paint we use whatever was cached in localStorage (instant,
  // avoids a flash of unordered clients) then immediately fetch the real,
  // permanent order from the server and switch to that.
  const [clientOrder, setClientOrder] = useState(() => {
    try {
      const raw = localStorage.getItem(CLIENT_ORDER_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const orderLoadedFromServer = useRef(false);
  const saveOrderTimeout = useRef(null);

  // Load this user's saved order from the database once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/users/me/client-order');
        if (cancelled) return;
        orderLoadedFromServer.current = true;
        if (Array.isArray(data.order)) {
          setClientOrder(data.order);
          try { localStorage.setItem(CLIENT_ORDER_KEY, JSON.stringify(data.order)); } catch {}
        }
      } catch {
        // Offline / request failed — keep using the local cache; next
        // successful reorder will retry saving to the server.
        orderLoadedFromServer.current = true;
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const persistClientOrder = (ids) => {
    setClientOrder(ids);
    try { localStorage.setItem(CLIENT_ORDER_KEY, JSON.stringify(ids)); } catch {}
    // Debounce the network save slightly so rapid successive drags (e.g.
    // dragging one card past several others) don't fire an API call each.
    if (saveOrderTimeout.current) clearTimeout(saveOrderTimeout.current);
    saveOrderTimeout.current = setTimeout(() => {
      api.put('/users/me/client-order', { order: ids }).catch(() => {
        // Save failed (offline/network) — order stays correct locally via
        // localStorage and will sync again on the next reorder or reload.
      });
    }, 400);
  };
  // Apply saved order to the current client list; newcomers appended at the end
  const orderedClients = useMemo(() => {
    const byId = Object.fromEntries(clients.map(c => [c._id, c]));
    const ordered = clientOrder.filter(id => byId[id]).map(id => byId[id]);
    const seen = new Set(ordered.map(c => c._id));
    const remaining = clients.filter(c => !seen.has(c._id));
    return [...ordered, ...remaining];
  }, [clients, clientOrder]);
  // Move `draggedId` to just before `targetId`. targetId === null moves it to the end.
  const reorderClients = (draggedId, targetId) => {
    if (!draggedId || draggedId === targetId) return;
    const ids = orderedClients.map(c => c._id).filter(id => id !== draggedId);
    if (targetId === null) {
      ids.push(draggedId);
    } else {
      const targetIdx = ids.indexOf(targetId);
      ids.splice(targetIdx === -1 ? ids.length : targetIdx, 0, draggedId);
    }
    persistClientOrder(ids);
  };

  // Table row drag state (drag handle in the leftmost cell of each row)
  const dragRowRef = useRef(null);
  const [dragOverRowId, setDragOverRowId] = useState(null);
  const [draggingRowId, setDraggingRowId] = useState(null);
  const handleRowDragStart = (e, clientId) => {
    dragRowRef.current = clientId;
    setDraggingRowId(clientId);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleRowDragEnd = () => {
    dragRowRef.current = null;
    setDraggingRowId(null);
    setDragOverRowId(null);
  };
  const handleRowDrop = (targetId) => {
    reorderClients(dragRowRef.current, targetId);
    handleRowDragEnd();
  };

  // Pagination
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  const fetchClients = async (p, search, statusFilter, managerFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (managerFilter) params.set('accountManager', managerFilter);
      params.set('limit', LIMIT);
      params.set('page', p);
      params.set('_t', Date.now()); // cache bust
      const { data } = await api.get(`/clients?${params}`);
      setClients(data.clients);
      setTotal(data.total);
    } finally { setLoading(false); }
  };

  // When filters change, reset to page 1 and reload
  const isFirstRender = React.useRef(true);
  const prevFiltersRef = React.useRef({ search, statusFilter, managerFilter });
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchClients(1, search, statusFilter, managerFilter);
      return;
    }
    const prev = prevFiltersRef.current;
    const filtersChanged =
      prev.search !== search ||
      prev.statusFilter !== statusFilter ||
      prev.managerFilter !== managerFilter;
    prevFiltersRef.current = { search, statusFilter, managerFilter };
    if (filtersChanged) {
      setPage(1);
      fetchClients(1, search, statusFilter, managerFilter);
    } else {
      fetchClients(page, search, statusFilter, managerFilter);
    }
  }, [search, statusFilter, managerFilter, page]);

  const loadClients = () => fetchClients(page, search, statusFilter, managerFilter);
  useEffect(() => {
    api.get('/users?role=manager,admin').then(res => {
      setManagers(res.data.users || []);
    });
  }, []);

  const handleCreate = async (form, logoFile, logoRemoved) => {
    setSaving(true);
    try {
      const { data } = await api.post('/clients', form);
      // Upload logo if one was selected
      if (logoFile && data.client?._id) {
        try {
          const fd = new FormData();
          fd.append('logo', logoFile);
          await api.post(`/clients/${data.client._id}/logo`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch (_) { /* non-fatal */ }
      }
      setShowModal(false);
      loadClients();
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/clients/${deleteTarget._id}`);
      setDeleteTarget(null);
      loadClients();
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to delete client');
    } finally {
      setDeleting(false);
    }
  };

  // A manager can only delete clients where they are the account manager
  const canDeleteClient = (client) => {
    if (isAdmin) return true;
    if (isManager) {
      return String(client.accountManager?._id || client.accountManager) === String(currentUser._id);
    }
    return false;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Clients"
        subtitle={`${total} client${total !== 1 ? 's' : ''} total`}
        actions={
          <Button onClick={() => setShowModal(true)}>
            <Plus size={14} />Add Client
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-sm flex-shrink-0">
          <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--fd-ink-4)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="fd-input pl-9"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {STATUS_TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-all flex-shrink-0 border"
              style={statusFilter === t.value
                ? { background: '#4f6ef0', color: '#ffffff', borderColor: '#4060e0', boxShadow: '0 1px 3px rgba(79,110,240,0.25)' }
                : { background: 'var(--fd-btn-secondary-bg)', color: 'var(--fd-btn-secondary-text)', borderColor: 'var(--fd-btn-secondary-border)' }
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        {managers.length > 0 && (
          <div className="flex-shrink-0">
            <select
              value={managerFilter}
              onChange={e => updateManagerFilter(e.target.value)}
              className="fd-input text-[12px]"
              style={{ minWidth: '160px' }}
            >
              <option value="">All Managers</option>
              {managers.map(m => (
                <option key={m._id} value={m._id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}
        {/* View toggle: Table / Box */}
        <div
          className="flex items-center gap-0.5 p-0.5 rounded-lg flex-shrink-0 sm:ml-auto"
          style={{ background: 'var(--fd-surface-sunken)', border: '1px solid var(--fd-border)' }}
        >
          <button
            onClick={() => switchView('table')}
            title="Table view"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-all"
            style={viewMode === 'table'
              ? { background: 'var(--fd-surface)', color: 'var(--fd-ink-1)', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }
              : { background: 'transparent', color: 'var(--fd-ink-4)' }
            }
          >
            <Table2 size={13} /><span className="hidden sm:inline">Table</span>
          </button>
          <button
            onClick={() => switchView('box')}
            title="Box view"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-all"
            style={viewMode === 'box'
              ? { background: 'var(--fd-surface)', color: 'var(--fd-ink-1)', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }
              : { background: 'transparent', color: 'var(--fd-ink-4)' }
            }
          >
            <LayoutGrid size={13} /><span className="hidden sm:inline">Box</span>
          </button>
        </div>
      </div>

      {/* Box view */}
      {viewMode === 'box' && (
        loading ? (
          <Card><div className="flex justify-center py-16"><Spinner /></div></Card>
        ) : clients.length === 0 ? (
          <Card>
            <EmptyState
              icon={Building2}
              title="No clients found"
              description="Add your first client or adjust the filters."
              action={<Button onClick={() => setShowModal(true)}><Plus size={14} />Add Client</Button>}
            />
          </Card>
        ) : (
          <ClientsBoardView
            orderedClients={orderedClients}
            serviceLabels={serviceLabels}
            navigate={navigate}
            canDeleteClient={canDeleteClient}
            onDeleteRequest={setDeleteTarget}
            onReorder={reorderClients}
          />
        )
      )}

      {/* Table card */}
      {viewMode === 'table' && (
      <Card>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : clients.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No clients found"
            description="Add your first client or adjust the filters."
            action={<Button onClick={() => setShowModal(true)}><Plus size={14} />Add Client</Button>}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="fd-table">
                <thead>
                  <tr>
                    <th style={{ width: '28px' }}></th>
                    {tableColumns.map(col => (
                      <th key={col.id}>{col.label}</th>
                    ))}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {orderedClients.map(client => {
                    const cellFor = (colId) => {
                      switch (colId) {
                        case 'client':
                          return (
                            <div className="flex items-center gap-3">
                              <Avatar name={client.company} src={client.logo} size="sm" />
                              <div>
                                <div className="font-semibold text-[13px] text-[var(--fd-ink-1)]">
                                  {client.company}
                                </div>
                                <div className="text-[11px] mt-0.5 text-[var(--fd-ink-4)]">
                                  {client.name} · {client.email}
                                </div>
                              </div>
                            </div>
                          );
                        case 'services':
                          return (
                            <div className="flex gap-1 flex-wrap">
                              {client.services?.slice(0, 2).map(s => (
                                <span
                                  key={s}
                                  className="px-2 py-0.5 rounded text-[10.5px] font-medium"
                                  style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)' }}
                                >
                                  {serviceLabels[s] || s}
                                </span>
                              ))}
                              {client.services?.length > 2 && (
                                <span
                                  className="px-2 py-0.5 rounded text-[10.5px]"
                                  style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-4)' }}
                                >
                                  +{client.services.length - 2}
                                </span>
                              )}
                            </div>
                          );
                        case 'manager':
                          return client.accountManager ? (
                            <div className="flex items-center gap-2">
                              <Avatar name={client.accountManager.name} size="xs" />
                              <span className="text-[12.5px] text-[var(--fd-ink-2)]">
                                {client.accountManager.name}
                              </span>
                            </div>
                          ) : <span style={{ color: 'var(--fd-ink-5)' }}>—</span>;
                        case 'plan':
                          return (
                            <span
                              className="text-[11px] font-medium px-2 py-0.5 rounded-full capitalize"
                              style={getPlanStyle(client.plan)}
                            >
                              {(PLAN_LABELS || {})[client.plan] || client.plan}
                            </span>
                          );
                        case 'status':
                          return (
                            <span
                              className="text-[11px] font-medium px-2.5 py-0.5 rounded-full capitalize"
                              style={getStatusStyle(client.status)}
                            >
                              {client.status}
                            </span>
                          );
                        case 'since':
                          return formatDate(client.startDate);
                        default:
                          return null;
                      }
                    };
                    const isRowDragOver = dragOverRowId === client._id;
                    const isRowDragging = draggingRowId === client._id;
                    return (
                    <tr
                      key={client._id}
                      onClick={() => navigate(`/admin/clients/${client._id}`)}
                      onDragOver={e => { e.preventDefault(); setDragOverRowId(client._id); }}
                      onDrop={e => { e.preventDefault(); handleRowDrop(client._id); }}
                      className="cursor-pointer hover:bg-[var(--fd-table-row-hover)] transition-colors"
                      style={{
                        opacity: isRowDragging ? 0.4 : 1,
                        boxShadow: isRowDragOver ? 'inset 0 2px 0 #4f6ef0' : 'none',
                      }}
                    >
                      <td
                        draggable
                        onDragStart={e => { e.stopPropagation(); handleRowDragStart(e, client._id); }}
                        onDragEnd={e => { e.stopPropagation(); handleRowDragEnd(); }}
                        onClick={e => e.stopPropagation()}
                        className="cursor-grab active:cursor-grabbing"
                        title="Drag to reorder"
                      >
                        <GripVertical size={14} style={{ color: 'var(--fd-ink-5)' }} />
                      </td>
                      {tableColumns.map(col => (
                        <td key={col.id} className={col.id === 'since' ? 'text-[12px] font-mono text-[var(--fd-ink-4)]' : undefined}>
                          {cellFor(col.id)}
                        </td>
                      ))}
                      <td>
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          {(client.whatsappGroup || client.whatsappPhone) && (
                            <a
                              href={client.whatsappGroup || `https://wa.me/${(client.whatsappPhone||'').replace(/\D/g,'')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-6 h-6 rounded-md flex items-center justify-center transition-opacity hover:opacity-80"
                              style={{ background: '#25d366' }}
                              title="Open WhatsApp"
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                            </a>
                          )}
                          {canDeleteClient(client) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteTarget(client); }}
                              className="w-6 h-6 rounded-md flex items-center justify-center transition-all hover:opacity-80"
                              style={{ background: '#fef2f2', color: '#b91c1c' }}
                              title="Delete client"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                          <ChevronRight size={15} style={{ color: 'var(--fd-ink-5)' }} />
                        </div>
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y" style={{ borderColor: 'var(--fd-border-subtle)' }}>
              {orderedClients.map(client => (
                <div
                  key={client._id}
                  className="flex items-center gap-3.5 px-4 py-4 transition-colors hover:bg-[var(--fd-table-row-hover)]"
                >
                  <Link to={`/admin/clients/${client._id}`} className="flex items-center gap-3.5 flex-1 min-w-0">
                    <Avatar name={client.company} src={client.logo} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[13px] truncate text-[var(--fd-ink-1)]">
                        {client.company}
                      </div>
                      <div className="text-[11.5px] mt-0.5 truncate text-[var(--fd-ink-3)]">
                        {client.name}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span
                          className="text-[10.5px] font-medium px-2 py-0.5 rounded-full capitalize"
                          style={getStatusStyle(client.status)}
                        >
                          {client.status}
                        </span>
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {canDeleteClient(client) && (
                      <button
                        onClick={(e) => { e.preventDefault(); setDeleteTarget(client); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: '#fef2f2', color: '#b91c1c' }}
                        title="Delete client"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                    <ChevronRight size={14} style={{ color: 'var(--fd-ink-5)' }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
      )}

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex items-center justify-between">
          <span className="text-[12px]" style={{ color: 'var(--fd-ink-4)' }}>
            Showing {Math.min((page - 1) * LIMIT + 1, total)}–{Math.min(page * LIMIT, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => { const p = page - 1; setPage(p); }}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all disabled:opacity-40"
              style={{ background: 'var(--fd-btn-secondary-bg)', color: 'var(--fd-btn-secondary-text)', borderColor: 'var(--fd-btn-secondary-border)' }}
            >
              ← Prev
            </button>
            {Array.from({ length: Math.ceil(total / LIMIT) }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => { setPage(p); }}
                className="w-8 h-8 rounded-lg text-[12px] font-medium border transition-all"
                style={page === p
                  ? { background: '#4f6ef0', color: '#fff', borderColor: '#4060e0' }
                  : { background: 'var(--fd-btn-secondary-bg)', color: 'var(--fd-btn-secondary-text)', borderColor: 'var(--fd-btn-secondary-border)' }
                }
              >
                {p}
              </button>
            ))}
            <button
              disabled={page >= Math.ceil(total / LIMIT)}
              onClick={() => { const p = page + 1; setPage(p); }}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all disabled:opacity-40"
              style={{ background: 'var(--fd-btn-secondary-bg)', color: 'var(--fd-btn-secondary-text)', borderColor: 'var(--fd-btn-secondary-border)' }}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Client" size="lg">
        <ClientForm onSubmit={handleCreate} loading={saving} managers={managers} />
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Client"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              loading={deleting}
              onClick={handleDelete}
              style={{ background: '#b91c1c', borderColor: '#b91c1c', color: '#fff' }}
            >
              Delete Client
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-[13.5px]" style={{ color: 'var(--fd-ink-2)' }}>
            Are you sure you want to permanently delete{' '}
            <span className="font-semibold" style={{ color: 'var(--fd-ink-1)' }}>
              {deleteTarget?.company || deleteTarget?.name}
            </span>
            ? This action cannot be undone.
          </p>
          <p className="text-[12px] px-3 py-2 rounded-lg" style={{ background: '#fef2f2', color: '#b91c1c' }}>
            Associated updates, files, reports, and other records will be permanently removed.
            Tasks will be kept as work history and marked with a "Deleted Client" tag.
          </p>
        </div>
      </Modal>
    </div>
  );
}