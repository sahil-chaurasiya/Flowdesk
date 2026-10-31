import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import Spinner from '../../components/common/Spinner';

const panelStyle = {
  background: 'var(--fd-card-bg)',
  
  border: '1px solid var(--fd-border)',
};

const todayStr = () => {
  const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return ist.toISOString().split('T')[0];
};

// Last day of "next month" from today — used as the max selectable date so
// admins are picking from the current or upcoming month, as intended.
const maxSelectableDate = () => {
  const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const lastOfNextMonth = new Date(ist.getFullYear(), ist.getMonth() + 2, 0);
  return lastOfNextMonth.toISOString().split('T')[0];
};

const fmtDate = (dateStr) =>
  new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export default function HolidaysCard({ onChange }) {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ date: '', name: '', label: '' });

  const fetchHolidays = useCallback(async () => {
    try {
      const { data } = await api.get('/holidays');
      const upcoming = (data.holidays || []).filter((h) => h.date >= todayStr());
      setHolidays(upcoming.sort((a, b) => a.date.localeCompare(b.date)));
    } catch {
      toast.error('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHolidays(); }, [fetchHolidays]);

  const todayHoliday = holidays.find((h) => h.date === todayStr());

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.date || !form.name.trim()) {
      toast.error('Please pick a date and enter a name');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post('/holidays', form);
      toast.success(data.message || 'Holiday added');
      setForm({ date: '', name: '', label: '' });
      setShowForm(false);
      fetchHolidays();
      onChange?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add holiday');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (holiday) => {
    if (!window.confirm(`Remove "${holiday.name}" (${fmtDate(holiday.date)})? Employees auto-marked present for this day will revert to no record.`)) return;
    try {
      await api.delete(`/holidays/${holiday._id}`);
      toast.success('Holiday removed');
      fetchHolidays();
      onChange?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove holiday');
    }
  };

  return (
    <div className="rounded-2xl overflow-hidden relative animate-fade-in" style={panelStyle}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.2), transparent)' }} />
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--fd-border)' }}>
        <div className="flex items-center gap-2">
          <span className="text-lg">🎉</span>
          <p className="section-title">Holidays</p>
          {todayHoliday && (
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}>
              Today: {todayHoliday.name}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: 'rgba(var(--fd-accent-rgb),0.1)', border: '1px solid rgba(var(--fd-accent-rgb),0.25)', color: 'var(--fd-accent)' }}
        >
          {showForm ? '✕ Cancel' : '+ Add Holiday'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="px-5 py-4 space-y-3 animate-fade-in" style={{ borderBottom: '1px solid var(--fd-border)' }}>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label mb-1 block">Date</label>
              <input
                type="date"
                className="input w-full"
                max={maxSelectableDate()}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label mb-1 block">Holiday Name</label>
              <input
                type="text"
                className="input w-full"
                placeholder="e.g. Diwali"
                maxLength={100}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
          </div>
          <div>
            <label className="label mb-1 block">Label <span className="text-gray-600">(optional)</span></label>
            <input
              type="text"
              className="input w-full"
              placeholder="e.g. Festival, National Holiday"
              maxLength={50}
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
          </div>
          <p className="text-[11px] text-gray-600">Everyone will automatically be marked present for this date — it won't count as absent.</p>
          <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto px-5 py-2 text-sm">
            {submitting ? 'Adding…' : 'Add Holiday'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Spinner size="md" className="text-attbrand-500" /></div>
      ) : holidays.length === 0 ? (
        <p className="text-center text-gray-600 py-8 text-sm">No upcoming holidays declared</p>
      ) : (
        <div>
          {holidays.map((h, i) => (
            <div
              key={h._id}
              className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors"
              style={i < holidays.length - 1 ? { borderBottom: '1px solid var(--fd-border)' } : {}}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc' }}
                >
                  {new Date(h.date + 'T00:00:00').getDate()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-200">{h.name}</p>
                  <p className="text-[11px] text-gray-600">{fmtDate(h.date)}{h.label ? ` · ${h.label}` : ''}</p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(h)}
                className="text-gray-600 hover:text-red-400 transition-colors text-xs px-2 py-1"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}