import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus, Search, Phone, Mail, MapPin, DollarSign,
  Edit3, Trash2, X, Save, Users, Filter,
} from 'lucide-react';
import api from '../../lib/api';
import { PageHeader, EmptyState, Card, CardContent, Spinner } from '../../components/shared/LoadingScreen';
import { Button, Modal, Input, Select, useToast } from '../../components/ui/index';

const FIELD_OPTIONS = [
  'videographer', 'photographer', 'graphic_designer', 'copywriter',
  'web_developer', 'video_editor', 'animator', 'voice_over', 'influencer',
  'content_writer', 'paid_ads_specialist', 'seo_specialist', 'other',
];

const RATE_TYPES = [
  { value: 'per_project', label: 'Per Project' },
  { value: 'per_hour',    label: 'Per Hour' },
  { value: 'per_day',     label: 'Per Day' },
  { value: 'monthly',     label: 'Monthly' },
  { value: 'other',       label: 'Other' },
];

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED'];

const FIELD_COLORS = {
  videographer:        { bg: '#eff0fe', color: '#3a56d4' },
  photographer:        { bg: '#fdf2ff', color: '#7e22ce' },
  graphic_designer:    { bg: '#fef7ea', color: '#92600a' },
  copywriter:          { bg: '#edf7f1', color: '#2a7d4f' },
  web_developer:       { bg: '#f0f9ff', color: '#0369a1' },
  video_editor:        { bg: '#fff0f0', color: '#b91c1c' },
  animator:            { bg: '#f0fdf4', color: '#15803d' },
  influencer:          { bg: '#fffbeb', color: '#b45309' },
  content_writer:      { bg: '#fdf2ff', color: '#7e22ce' },
  paid_ads_specialist: { bg: '#eff0fe', color: '#3a56d4' },
  seo_specialist:      { bg: '#edf7f1', color: '#2a7d4f' },
  other:               { bg: '#f5f5f5', color: '#555' },
};

function fieldLabel(f) {
  return f?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '—';
}

function formatRate(contact) {
  if (!contact.rateAmount) return '—';
  const label = RATE_TYPES.find(r => r.value === contact.rateType)?.label || '';
  return `${contact.currency || 'INR'} ${contact.rateAmount.toLocaleString()} ${label}`;
}

const EMPTY_FORM = {
  name: '', field: '', phone: '', email: '', location: '',
  rateType: 'per_project', rateAmount: '', currency: 'INR',
  paymentMethod: '', portfolio: '', notes: '', isActive: true,
};

function ContactForm({ initial, onSubmit, loading, onClose }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // If the contact's field is already saved but isn't one of the known options,
  // treat the dropdown as "Other" and show the custom text input pre-filled.
  const isKnownField = !form.field || FIELD_OPTIONS.includes(form.field);
  const [useCustomField, setUseCustomField] = useState(!isKnownField);
  const [customField, setCustomField] = useState(!isKnownField ? form.field : '');

  const handleFieldSelect = (value) => {
    if (value === 'other') {
      setUseCustomField(true);
      // Don't save the literal "other" — wait for the user's custom text.
      set('field', customField);
    } else {
      setUseCustomField(false);
      set('field', value);
    }
  };

  const handleCustomFieldChange = (value) => {
    setCustomField(value);
    set('field', value);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Full Name *" value={form.name} onChange={e => set('name', e.target.value)} required />
        <div>
          <Select
            label="Field / Specialisation"
            value={useCustomField ? 'other' : (form.field || '')}
            onChange={e => handleFieldSelect(e.target.value)}
          >
            <option value="">Select...</option>
            {FIELD_OPTIONS.filter(f => f !== 'other').map(f => <option key={f} value={f}>{fieldLabel(f)}</option>)}
            <option value="other">Other (custom)</option>
          </Select>
          {useCustomField && (
            <input
              className="fd-input mt-2"
              value={customField}
              onChange={e => handleCustomFieldChange(e.target.value)}
              placeholder="Type a custom field..."
              autoFocus
            />
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Phone" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98000 00000" />
        <Input label="Email" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
      </div>
      <Input label="Location" value={form.location} onChange={e => set('location', e.target.value)} placeholder="City, Country" />

      {/* Rate info */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--fd-surface-raised)', border: '1px solid var(--fd-border)' }}>
        <div className="text-[12px] font-semibold" style={{ color: 'var(--fd-ink-2)' }}>Payment / Rate</div>
        <div className="grid grid-cols-3 gap-3">
          <Select label="Rate Type" value={form.rateType} onChange={e => set('rateType', e.target.value)}>
            {RATE_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
          <Input label="Amount" type="number" value={form.rateAmount} onChange={e => set('rateAmount', e.target.value)} placeholder="0" />
          <Select label="Currency" value={form.currency} onChange={e => set('currency', e.target.value)}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
        <Input label="Payment Method" value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)} placeholder="e.g. UPI, Bank Transfer, Cash" />
      </div>

      <Input label="Portfolio / Website" value={form.portfolio} onChange={e => set('portfolio', e.target.value)} placeholder="https://..." />
      <div>
        <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--fd-ink-2)' }}>Notes</label>
        <textarea
          className="fd-input resize-none"
          rows={3}
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="Any additional notes..."
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="contactActive"
          checked={form.isActive}
          onChange={e => set('isActive', e.target.checked)}
          style={{ accentColor: '#4f6ef0' }}
        />
        <label htmlFor="contactActive" className="text-[13px]" style={{ color: 'var(--fd-ink-2)' }}>Active contact</label>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button
          size="sm"
          loading={loading}
          disabled={useCustomField && !customField.trim()}
          onClick={() => onSubmit(form)}
        >
          <Save size={13} /> Save Contact
        </Button>
      </div>
    </div>
  );
}

export default function ContactsPage() {
  const toast = useToast();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fieldFilter, setFieldFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editContact, setEditContact] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 100 });
      if (search)      params.set('search', search);
      if (fieldFilter) params.set('field', fieldFilter);
      const { data } = await api.get(`/contacts?${params}`);
      setContacts(data.contacts || []);
    } finally { setLoading(false); }
  }, [search, fieldFilter]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (form) => {
    setSaving(true);
    try {
      if (editContact) {
        await api.put(`/contacts/${editContact._id}`, form);
        toast({ type: 'success', title: 'Contact updated' });
      } else {
        await api.post('/contacts', form);
        toast({ type: 'success', title: 'Contact added' });
      }
      setShowModal(false);
      setEditContact(null);
      load();
    } catch (err) {
      toast({ type: 'error', title: 'Save failed', message: err?.response?.data?.message });
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/contacts/${deleteId}`);
      toast({ type: 'success', title: 'Contact deleted' });
      setDeleteId(null);
      load();
    } catch {
      toast({ type: 'error', title: 'Delete failed' });
    } finally { setDeleting(false); }
  };

  // Unique fields for filter dropdown
  const uniqueFields = [...new Set(contacts.map(c => c.field).filter(Boolean))].sort();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contacts"
        subtitle="Freelancers, vendors, and collaborators"
        actions={
          <Button onClick={() => { setEditContact(null); setShowModal(true); }}>
            <Plus size={14} /> Add Contact
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fd-ink-4)' }} />
          <input
            className="fd-input pl-9 w-full"
            placeholder="Search contacts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} style={{ color: 'var(--fd-ink-4)' }} />
          <select
            className="fd-input text-[13px] pr-8"
            value={fieldFilter}
            onChange={e => setFieldFilter(e.target.value)}
          >
            <option value="">All Fields</option>
            {uniqueFields.map(f => <option key={f} value={f}>{fieldLabel(f)}</option>)}
          </select>
        </div>
        <div className="text-[12px] self-center" style={{ color: 'var(--fd-ink-4)' }}>
          {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No contacts yet"
          description="Add freelancers, videographers, and other vendors you work with."
          action={<Button onClick={() => setShowModal(true)}><Plus size={14} />Add Contact</Button>}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="fd-table">
                <thead>
                  <tr>
                    {['Name', 'Field', 'Contact', 'Location', 'Rate', 'Payment Method', ''].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contacts.map(c => {
                    const chip = FIELD_COLORS[c.field] || FIELD_COLORS.other;
                    return (
                      <tr key={c._id}>
                        <td>
                          <div className="font-semibold text-[13px]" style={{ color: 'var(--fd-ink-1)' }}>{c.name}</div>
                          {c.portfolio && (
                            <a href={c.portfolio} target="_blank" rel="noreferrer"
                              className="text-[11px] hover:underline" style={{ color: '#4f6ef0' }}>
                              Portfolio ↗
                            </a>
                          )}
                        </td>
                        <td>
                          {c.field ? (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full capitalize" style={chip}>
                              {fieldLabel(c.field)}
                            </span>
                          ) : <span style={{ color: 'var(--fd-ink-5)' }}>—</span>}
                        </td>
                        <td>
                          <div className="space-y-0.5">
                            {c.phone && (
                              <div className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--fd-ink-2)' }}>
                                <Phone size={11} style={{ color: 'var(--fd-ink-4)' }} />{c.phone}
                              </div>
                            )}
                            {c.email && (
                              <div className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--fd-ink-2)' }}>
                                <Mail size={11} style={{ color: 'var(--fd-ink-4)' }} />{c.email}
                              </div>
                            )}
                            {!c.phone && !c.email && <span style={{ color: 'var(--fd-ink-5)' }}>—</span>}
                          </div>
                        </td>
                        <td>
                          {c.location ? (
                            <div className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--fd-ink-2)' }}>
                              <MapPin size={11} style={{ color: 'var(--fd-ink-4)' }} />{c.location}
                            </div>
                          ) : <span style={{ color: 'var(--fd-ink-5)' }}>—</span>}
                        </td>
                        <td>
                          <div className="flex items-center gap-1 text-[12.5px]" style={{ color: 'var(--fd-ink-2)' }}>
                            {formatRate(c)}
                          </div>
                        </td>
                        <td className="text-[12px]" style={{ color: 'var(--fd-ink-3)' }}>
                          {c.paymentMethod || '—'}
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setEditContact(c); setShowModal(true); }}
                              className="btn-ghost p-1.5"
                              title="Edit"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              onClick={() => setDeleteId(c._id)}
                              className="btn-ghost p-1.5"
                              title="Delete"
                              style={{ color: '#b91c1c' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y" style={{ borderColor: 'var(--fd-border-subtle)' }}>
              {contacts.map(c => {
                const chip = FIELD_COLORS[c.field] || FIELD_COLORS.other;
                return (
                  <div key={c._id} className="px-4 py-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-[14px]" style={{ color: 'var(--fd-ink-1)' }}>{c.name}</div>
                        {c.field && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full capitalize inline-block mt-1" style={chip}>
                            {fieldLabel(c.field)}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => { setEditContact(c); setShowModal(true); }} className="btn-ghost p-1.5"><Edit3 size={13} /></button>
                        <button onClick={() => setDeleteId(c._id)} className="btn-ghost p-1.5" style={{ color: '#b91c1c' }}><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <div className="text-[12px] space-y-1" style={{ color: 'var(--fd-ink-3)' }}>
                      {c.phone && <div className="flex items-center gap-1.5"><Phone size={11} />{c.phone}</div>}
                      {c.email && <div className="flex items-center gap-1.5"><Mail size={11} />{c.email}</div>}
                      {c.location && <div className="flex items-center gap-1.5"><MapPin size={11} />{c.location}</div>}
                      {c.rateAmount > 0 && <div className="flex items-center gap-1.5">{formatRate(c)}</div>}
                    </div>
                    {c.notes && <p className="text-[11.5px] italic" style={{ color: 'var(--fd-ink-4)' }}>{c.notes}</p>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditContact(null); }}
        title={editContact ? 'Edit Contact' : 'Add Contact'}
        size="lg"
      >
        <ContactForm
          initial={editContact}
          onSubmit={handleSubmit}
          loading={saving}
          onClose={() => { setShowModal(false); setEditContact(null); }}
        />
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Contact"
        size="sm"
      >
        <p className="text-[13px] mb-5" style={{ color: 'var(--fd-ink-2)' }}>
          Are you sure you want to delete this contact? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button size="sm" loading={deleting} onClick={handleDelete}
            style={{ background: '#b91c1c', color: '#fff', borderColor: '#b91c1c' }}>
            <Trash2 size={13} /> Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}