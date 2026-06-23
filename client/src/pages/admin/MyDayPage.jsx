import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus, Send, CheckCircle2, AlertTriangle,
  RotateCcw, Save, History, X, Sparkles, Zap, Target, Coffee, StickyNote,
} from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: 'paid_ads',       label: '📊 Paid Ads' },
  { value: 'social_media',   label: '📱 Social Media' },
  { value: 'video_editing',  label: '🎬 Video Editing' },
  { value: 'graphic_design', label: '🎨 Graphic Design' },
  { value: 'copywriting',    label: '✍️ Copywriting' },
  { value: 'reporting',      label: '📋 Reporting' },
  { value: 'strategy',       label: '🧠 Strategy' },
  { value: 'meetings',       label: '🤝 Meetings' },
  { value: 'other',          label: '📌 Other' },
];

const STATUS_OPTIONS = [
  { value: 'completed',    label: '✅ Done' },
  { value: 'in_progress',  label: '🔄 In Progress' },
  { value: 'carried_over', label: '⏳ Pending' },
];

const STATUS_META = {
  completed:    { label: 'Done',         color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  in_progress:  { label: 'In Progress',  color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  carried_over: { label: 'Pending',      color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
};

const MOTIVATIONAL = [
  "Every task logged is a step forward 🚀",
  "Your work matters. Document it! ✨",
  "Small wins add up to big victories 💪",
  "Log it. Ship it. Own it. 🔥",
];

function todayLabel() {
  return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function blankEntry() {
  return { description: '', client: '', category: 'other', status: 'completed', notes: '' };
}

// ── Styles ────────────────────────────────────────────────────────────────────

const css = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

.myd { font-family: 'Plus+Jakarta+Sans', 'Plus Jakarta Sans', sans-serif; }
.myd * { box-sizing: border-box; }

@keyframes myd-spin { to { transform: rotate(360deg); } }
@keyframes myd-in   { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
.myd { animation: myd-in .3s ease both; }

/* ── Entry card ── */
.myd .ec {
  position: relative;
  border-radius: 18px;
  padding: 18px 18px 14px 18px;
  margin-bottom: 10px;
  border: 1.5px solid rgba(99,102,241,.13);
  background: linear-gradient(145deg, rgba(99,102,241,.04) 0%, var(--fd-surface) 60%);
  box-shadow: 0 2px 12px rgba(0,0,0,.06), 0 1px 3px rgba(0,0,0,.04);
  transition: border-color .2s, box-shadow .2s, transform .15s;
}
.myd .ec:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(99,102,241,.1), 0 2px 6px rgba(0,0,0,.05);
}
.myd .ec:focus-within {
  border-color: rgba(99,102,241,.5);
  box-shadow: 0 0 0 3px rgba(99,102,241,.1), 0 6px 20px rgba(99,102,241,.1);
  transform: translateY(-1px);
}
.myd .ec textarea {
  width: 100%; border: none !important; outline: none !important; resize: none;
  background: transparent;
  color: var(--fd-ink-1);
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 500;
  line-height: 1.6;
  box-shadow: none !important;
}
.myd .ec textarea::placeholder { color: var(--fd-ink-4); font-weight: 400; }

/* ── Pill selects — inherit theme ── */
.myd .ps-wrap { position: relative; display: inline-flex; align-items: center; }
.myd .ps-wrap svg { position:absolute; right:8px; pointer-events:none; }
.myd .ps {
  appearance: none; -webkit-appearance: none;
  border-radius: 20px;
  padding: 5px 28px 5px 12px;
  font-size: 11px; font-weight: 600;
  cursor: pointer; outline: none;
  border: 1.5px solid var(--fd-border);
  background: var(--fd-canvas);
  color: var(--fd-ink-2);
  font-family: inherit;
  transition: border-color .15s, box-shadow .15s;
}
.myd .ps:hover { border-color: rgba(99,102,241,.45); box-shadow: 0 2px 8px rgba(99,102,241,.1); }
.myd .ps:focus { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,.15); }

/* ── Remove btn ── */
.myd .rb {
  position: absolute; top: 10px; right: 10px;
  width: 24px; height: 24px;
  border-radius: 7px; border: none;
  background: transparent; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--fd-ink-4); opacity: 0; transition: all .15s;
}
.myd .ec:hover .rb { opacity: 1; }
.myd .rb:hover { background: rgba(239,68,68,.12); color: #ef4444; }

/* ── Number badge ── */
.myd .nb {
  width: 22px; height: 22px; border-radius: 7px; flex-shrink: 0;
  background: rgba(99,102,241,.12); color: #6366f1;
  font-size: 10px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
}

/* ── Submit btn ── */
.myd .sub-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 13px 24px; border-radius: 14px; border: none;
  background: linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);
  color: #fff; font-size: 14px; font-weight: 700; cursor: pointer;
  transition: all .2s; font-family: inherit; position: relative; overflow: hidden;
}
.myd .sub-btn::before {
  content:''; position:absolute; inset:0;
  background: linear-gradient(135deg,rgba(255,255,255,.15) 0%,transparent 60%);
}
.myd .sub-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(99,102,241,.35); }
.myd .sub-btn:disabled { opacity:.6; cursor:not-allowed; }

/* ── Save btn ── */
.myd .save-btn {
  display: flex; align-items: center; gap: 7px;
  padding: 12px 18px; border-radius: 14px;
  font-size: 13px; font-weight: 600; cursor: pointer;
  border: 1px solid var(--fd-border); background: var(--fd-surface);
  color: var(--fd-ink-2); transition: all .2s; font-family: inherit;
}
.myd .save-btn.saved { border-color: rgba(16,185,129,.4); color: #10b981; }
.myd .save-btn:hover:not(:disabled) { border-color: rgba(99,102,241,.4); }

/* ── Add task btn ── */
.myd .add-btn {
  width: 100%; padding: 13px; border-radius: 16px;
  border: 2px dashed rgba(99,102,241,.25); background: rgba(99,102,241,.02);
  cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
  font-size: 12px; font-weight: 700; color: var(--fd-ink-4);
  transition: all .2s; font-family: inherit; letter-spacing: .01em;
}
.myd .add-btn:hover { border-color: #6366f1; color: #6366f1; background: rgba(99,102,241,.06); transform: translateY(-1px); box-shadow: 0 4px 14px rgba(99,102,241,.1); }

/* ── Stat card ── */
.myd .sc {
  flex: 1; border-radius: 16px; padding: 16px 14px; text-align: center;
  border: 1px solid var(--fd-border); background: var(--fd-surface);
  position: relative; overflow: hidden;
}

/* ── Greeting bar ── */
.myd .greet {
  background: rgba(99,102,241,.07);
  border: 1px solid rgba(99,102,241,.15);
  border-radius: 14px; padding: 13px 18px; margin-bottom: 24px;
  display: flex; align-items: center; gap: 12px;
}

/* ── Submitted banner ── */
.myd .sub-banner {
  background: rgba(16,185,129,.07);
  border: 1px solid rgba(16,185,129,.2);
  border-radius: 16px; padding: 15px 18px; margin-bottom: 20px;
  display: flex; align-items: center; gap: 12px;
}

/* ── Blockers ── */
.myd .blk {
  border-radius: 18px; padding: 16px 18px; margin-bottom: 20px;
  background: linear-gradient(145deg, rgba(245,158,11,.05) 0%, var(--fd-surface) 70%);
  border: 1.5px solid rgba(245,158,11,.22);
  box-shadow: 0 2px 12px rgba(245,158,11,.06), 0 1px 3px rgba(0,0,0,.04);
  transition: border-color .2s, box-shadow .2s, transform .15s;
}
.myd .blk:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(245,158,11,.1), 0 2px 6px rgba(0,0,0,.04);
}
.myd .blk:focus-within {
  border-color: rgba(245,158,11,.5);
  box-shadow: 0 0 0 3px rgba(245,158,11,.1), 0 6px 18px rgba(245,158,11,.08);
  transform: translateY(-1px);
}
.myd .blk textarea {
  width: 100%; border: none !important; outline: none !important; resize: none;
  box-shadow: none !important;
  background: transparent; color: var(--fd-ink-1);
  font-family: inherit; font-size: 13px; font-weight: 500; line-height: 1.6;
}
.myd .blk textarea::placeholder { color: var(--fd-ink-4); font-weight: 400; }

/* ── History modal ── */
.myd .hm-overlay {
  position: fixed; inset: 0; z-index: 50;
  display: flex; align-items: center; justify-content: center; padding: 16px;
}
.myd .hm-bg {
  position: absolute; inset: 0;
  background: rgba(0,0,0,.5); backdrop-filter: blur(4px);
}
.myd .hm-box {
  position: relative; width: 100%; max-width: 520px;
  border-radius: 20px; background: var(--fd-surface);
  border: 1px solid var(--fd-border); max-height: 82vh;
  display: flex; flex-direction: column;
  box-shadow: 0 24px 60px rgba(0,0,0,.25);
}
.myd .hm-row {
  border-radius: 12px; overflow: hidden; margin-bottom: 8px;
  border: 1px solid var(--fd-border); transition: border-color .15s;
}
.myd .hm-row:hover { border-color: rgba(99,102,241,.3); }
.myd .hm-row-btn {
  width: 100%; display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; background: transparent; border: none; cursor: pointer; text-align: left;
}
.myd .hm-row-btn:hover { background: var(--fd-canvas); }

.myd .spinner {
  width: 20px; height: 20px; border-radius: 50%;
  border: 2px solid #6366f1; border-top-color: transparent;
  animation: myd-spin .8s linear infinite;
}

/* ── Task notes ── */
.myd .note-toggle {
  display: inline-flex; align-items: center; gap: 5px;
  margin-top: 10px; padding: 2px 0;
  border: none; background: transparent; cursor: pointer;
  font-size: 11px; font-weight: 600; color: var(--fd-ink-4);
  font-family: inherit; transition: color .15s;
}
.myd .note-toggle:hover { color: #6366f1; }
.myd .note-box {
  margin-top: 10px; padding: 10px 12px; border-radius: 12px;
  background: rgba(99,102,241,.04); border: 1px solid rgba(99,102,241,.12);
}
.myd .note-box-label {
  display: flex; align-items: center; gap: 5px; margin-bottom: 5px;
  font-size: 10px; font-weight: 700; color: var(--fd-ink-4);
  text-transform: uppercase; letter-spacing: .03em;
}
.myd .note-box textarea {
  width: 100%; border: none !important; outline: none !important; resize: none;
  background: transparent; color: var(--fd-ink-2);
  font-family: inherit; font-size: 12.5px; font-weight: 500; line-height: 1.55;
  box-shadow: none !important;
}
.myd .note-box textarea::placeholder { color: var(--fd-ink-4); font-weight: 400; }
`;

// ── Sub-components ─────────────────────────────────────────────────────────────

function EntryRow({ entry, index, clients, onChange, onRemove, readOnly, removing }) {
  const [showNotes, setShowNotes] = useState(!!entry.notes);

  return (
    <div className="ec">
      {!readOnly && (
        <button className="rb" onClick={() => onRemove(index)} disabled={removing} style={removing ? { cursor: 'not-allowed' } : undefined}><X size={12} /></button>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div className="nb" style={{ marginTop: 2 }}>{index + 1}</div>
        <div style={{ flex: 1 }}>
          {entry.status === 'carried_over' && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10,
              fontWeight: 700, padding: '3px 8px', borderRadius: 20, marginBottom: 8,
              background: 'rgba(245,158,11,.12)', color: '#f59e0b',
            }}>
              <RotateCcw size={9} /> Pending
            </div>
          )}

          <textarea
            value={entry.description}
            onChange={e => onChange(index, 'description', e.target.value)}
            readOnly={readOnly}
            placeholder="What did you work on? e.g. 'Edited 3 Reels for client, uploaded to Drive'"
            rows={2}
          />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(99,102,241,.08)' }}>
            {/* Category */}
            <div className="ps-wrap">
              <select className="ps" value={entry.category} onChange={e => onChange(index, 'category', e.target.value)} disabled={readOnly}>
                {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <svg width="9" height="9" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="var(--fd-ink-4)" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>

            {/* Status */}
            <div className="ps-wrap">
              <select
                className="ps"
                value={entry.status}
                onChange={e => onChange(index, 'status', e.target.value)}
                disabled={readOnly}
                style={{
                  background: STATUS_META[entry.status]?.bg,
                  borderColor: STATUS_META[entry.status]?.color + '55',
                  color: STATUS_META[entry.status]?.color,
                }}
              >
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <svg width="9" height="9" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke={STATUS_META[entry.status]?.color || 'var(--fd-ink-4)'} strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>

            {/* Client — shows company name */}
            {clients.length > 0 && (
              <div className="ps-wrap">
                <select
                  className="ps"
                  value={entry.client || ''}
                  onChange={e => onChange(index, 'client', e.target.value)}
                  disabled={readOnly}
                  style={entry.client ? {
                    background: 'rgba(99,102,241,.1)',
                    borderColor: 'rgba(99,102,241,.35)',
                    color: '#6366f1',
                  } : {}}
                >
                  <option value="">No client</option>
                  {clients.map(c => (
                    <option key={c._id} value={c._id}>{c.company || c.name}</option>
                  ))}
                </select>
                <svg width="9" height="9" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke={entry.client ? '#6366f1' : 'var(--fd-ink-4)'} strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
            )}
          </div>

          {/* Notes */}
          {showNotes || entry.notes ? (
            <div className="note-box">
              <div className="note-box-label"><StickyNote size={10} /> Note</div>
              <textarea
                value={entry.notes || ''}
                onChange={e => onChange(index, 'notes', e.target.value)}
                readOnly={readOnly}
                placeholder="Add a note for this task… e.g. 'Waiting on client approval before publishing'"
                rows={2}
              />
            </div>
          ) : (
            !readOnly && (
              <button type="button" className="note-toggle" onClick={() => setShowNotes(true)}>
                <StickyNote size={11} /> Add note
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function HistoryModal({ onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api.get('/daily-logs/my/history?limit=14')
      .then(r => setLogs(r.data.logs || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="hm-overlay">
      <div className="hm-bg" onClick={onClose} />
      <div className="hm-box">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--fd-border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <History size={15} style={{ color:'#6366f1' }} />
            <span style={{ fontSize:14, fontWeight:700, color:'var(--fd-ink-1)' }}>Past Logs</span>
          </div>
          <button onClick={onClose} style={{ padding:6, borderRadius:8, border:'none', background:'transparent', cursor:'pointer', color:'var(--fd-ink-3)', display:'flex' }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ overflowY:'auto', flex:1, padding:16 }}>
          {loading && <div style={{ display:'flex', justifyContent:'center', padding:'40px 0' }}><div className="spinner" /></div>}
          {!loading && logs.length === 0 && (
            <div style={{ textAlign:'center', padding:'40px 0', color:'var(--fd-ink-4)', fontSize:13 }}>No past logs yet. Start logging today! 🌱</div>
          )}
          {logs.map(log => {
            const isOpen = expanded === log._id;
            const completedCount = log.entries.filter(e => e.status === 'completed').length;
            return (
              <div key={log._id} className="hm-row">
                <button className="hm-row-btn" onClick={() => setExpanded(isOpen ? null : log._id)}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{
                      width:36, height:36, borderRadius:10, flexShrink:0,
                      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                      background: isOpen ? 'rgba(99,102,241,.12)' : 'var(--fd-canvas)',
                    }}>
                      <span style={{ fontSize:14, fontWeight:800, lineHeight:1, color: isOpen ? '#6366f1' : 'var(--fd-ink-1)' }}>
                        {new Date(log.date + 'T00:00:00').getDate()}
                      </span>
                      <span style={{ fontSize:8, fontWeight:700, textTransform:'uppercase', color: isOpen ? '#6366f1' : 'var(--fd-ink-4)' }}>
                        {new Date(log.date + 'T00:00:00').toLocaleDateString('en-IN', { month:'short' })}
                      </span>
                    </div>
                    <div>
                      <div style={{ fontSize:12, fontWeight:600, color:'var(--fd-ink-1)' }}>
                        {new Date(log.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday:'long' })}
                      </div>
                      <div style={{ fontSize:10, color:'var(--fd-ink-4)', marginTop:1 }}>
                        {log.entries.length} task{log.entries.length !== 1 ? 's' : ''}
                        {completedCount > 0 && <span style={{ color:'#10b981', marginLeft:6 }}>{completedCount} done</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{
                      fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:20,
                      background: log.isSubmitted ? 'rgba(16,185,129,.12)' : 'rgba(245,158,11,.12)',
                      color: log.isSubmitted ? '#10b981' : '#f59e0b',
                    }}>
                      {log.isSubmitted ? 'Submitted' : 'Draft'}
                    </span>
                    <svg width="12" height="12" viewBox="0 0 10 6" fill="none" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition:'transform .2s' }}>
                      <path d="M1 1l4 4 4-4" stroke="var(--fd-ink-4)" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                </button>
                {isOpen && (
                  <div style={{ padding:'0 16px 14px', borderTop:'1px solid var(--fd-border)' }}>
                    <div style={{ paddingTop:12, display:'flex', flexDirection:'column', gap:8 }}>
                      {log.entries.map((e, i) => (
                        <div key={i} style={{ display:'flex', gap:8 }}>
                          <div style={{ width:6, height:6, borderRadius:'50%', background:STATUS_META[e.status]?.color, flexShrink:0, marginTop:5 }} />
                          <div>
                            <div style={{ fontSize:12, color:'var(--fd-ink-1)' }}>{e.description}</div>
                            <div style={{ display:'flex', gap:6, marginTop:3, flexWrap:'wrap' }}>
                              <span style={{ fontSize:10, padding:'1px 7px', borderRadius:10, background:STATUS_META[e.status]?.bg, color:STATUS_META[e.status]?.color, fontWeight:600 }}>
                                {STATUS_META[e.status]?.label}
                              </span>
                              {(e.client?.company || e.client?.name) && (
                                <span style={{ fontSize:10, color:'var(--fd-ink-4)' }}>{e.client.company || e.client.name}</span>
                              )}
                            </div>
                            {e.notes && (
                              <div style={{ display:'flex', alignItems:'flex-start', gap:4, marginTop:4, fontSize:11, color:'var(--fd-ink-4)', fontStyle:'italic' }}>
                                <StickyNote size={10} style={{ flexShrink:0, marginTop:2 }} /> {e.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {log.blockers && (
                      <div style={{ marginTop:10, padding:'10px 12px', borderRadius:10, background:'rgba(239,68,68,.06)', border:'1px solid rgba(239,68,68,.15)' }}>
                        <div style={{ fontSize:10, fontWeight:700, color:'#ef4444', marginBottom:3 }}>⚠ Blocker</div>
                        <div style={{ fontSize:11, color:'var(--fd-ink-2)' }}>{log.blockers}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MyDayPage() {
  const { user } = useAuthStore();
  const [log, setLog] = useState(null);
  const [entries, setEntries] = useState([]);
  const [blockers, setBlockers] = useState('');
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState('');
  const [motiveTip] = useState(() => MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)]);

  const isSubmitted = log?.isSubmitted || false;

  const load = useCallback(async () => {
    try {
      const [logRes, clientRes] = await Promise.all([
        api.get('/daily-logs/my/today'),
        api.get('/clients?limit=200&fields=name,company'),
      ]);
      const l = logRes.data.log;
      setLog(l);
      setEntries(l.entries?.length ? l.entries.map(e => ({
        ...e,
        client: e.client?._id || e.client || '',
      })) : [blankEntry()]);
      setBlockers(l.blockers || '');
      setClients(clientRes.data.clients || []);
    } catch {
      setError('Failed to load your daily log.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleEntryChange = (idx, field, value) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
    setSaved(false);
  };

  const addEntry = () => { setEntries(prev => [...prev, blankEntry()]); setSaved(false); };

  const removeEntry = async (idx) => {
    const updated = entries.filter((_, i) => i !== idx);
    setEntries(updated);
    setSaved(false);
    // Persist the removal right away — otherwise it only lives in local state
    // and a refresh (or loading the page on another device) brings the task back.
    setError(''); setSaving(true);
    try {
      const res = await api.put('/daily-logs/my/today', buildPayload(updated));
      setLog(res.data.log); setSaved(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not remove task — please try again.');
    } finally {
      setSaving(false);
    }
  };

  const buildPayload = (entriesOverride = entries) => ({
    entries: entriesOverride.filter(e => e.description.trim()).map(e => ({
      description: e.description.trim(),
      client: e.client || null,
      category: e.category,
      status: e.status,
      notes: (e.notes || '').trim(),
    })),
    blockers: blockers.trim(),
  });

  const handleSave = async () => {
    const valid = entries.filter(e => e.description.trim());
    if (!valid.length) { setError('Add at least one task.'); return; }
    setError(''); setSaving(true);
    try {
      const res = await api.put('/daily-logs/my/today', buildPayload());
      setLog(res.data.log); setSaved(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed.');
    } finally { setSaving(false); }
  };

  const handleSubmit = async () => {
    const valid = entries.filter(e => e.description.trim());
    if (!valid.length) { setError('Add at least one task.'); return; }
    setError(''); setSubmitting(true);
    try {
      await api.put('/daily-logs/my/today', buildPayload());
      const res = await api.post('/daily-logs/my/today/submit', buildPayload());
      setLog(res.data.log);
    } catch (err) {
      setError(err.response?.data?.message || 'Submit failed.');
    } finally { setSubmitting(false); }
  };

  const completedCount = entries.filter(e => e.status === 'completed').length;
  const totalTasks = entries.filter(e => e.description.trim()).length;

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:240 }}>
        <div style={{ width:28, height:28, borderRadius:'50%', border:'2.5px solid #6366f1', borderTopColor:'transparent', animation:'myd-spin .8s linear infinite' }} />
        <style>{`@keyframes myd-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <>
      <style>{css}</style>
      <div className="myd" style={{ maxWidth:640, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
              <div style={{ width:32, height:32, borderRadius:10, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Sparkles size={15} color="white" />
              </div>
              <h1 style={{ fontSize:22, fontWeight:800, color:'var(--fd-ink-1)', margin:0 }}>My Day</h1>
            </div>
            <p style={{ fontSize:12, color:'var(--fd-ink-4)', margin:0 }}>{todayLabel()}</p>
          </div>
          <button
            onClick={() => setShowHistory(true)}
            style={{
              display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600,
              padding:'8px 14px', borderRadius:12, cursor:'pointer',
              background:'var(--fd-surface)', border:'1px solid var(--fd-border)', color:'var(--fd-ink-3)',
              fontFamily:'inherit',
            }}
          >
            <History size={13} /> Past Logs
          </button>
        </div>

        {/* Greeting */}
        {!isSubmitted && (
          <div className="greet">
            <Coffee size={15} style={{ color:'#6366f1', flexShrink:0 }} />
            <span style={{ fontSize:12, color:'var(--fd-ink-2)', fontWeight:500 }}>{motiveTip}</span>
          </div>
        )}

        {/* Submitted banner */}
        {isSubmitted && (
          <div className="sub-banner">
            <CheckCircle2 size={20} style={{ color:'#10b981', flexShrink:0 }} />
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'#10b981' }}>Day submitted! Great work 🎉</div>
              <div style={{ fontSize:11, color:'var(--fd-ink-4)', marginTop:2 }}>
                {log?.submittedAt
                  ? `Submitted at ${new Date(log.submittedAt).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })} · Visible to your manager.`
                  : 'Visible to your manager.'}
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        {totalTasks > 0 && (
          <div style={{ display:'flex', gap:10, marginBottom:20 }}>
            {[
              { value: totalTasks, label: 'Tasks logged', color: '#6366f1' },
              { value: completedCount, label: 'Completed', color: '#10b981' },
              { value: `${totalTasks > 0 ? Math.round(completedCount/totalTasks*100) : 0}%`, label: 'Done rate', color: '#f59e0b' },
            ].map(s => (
              <div key={s.label} className="sc">
                <div style={{ fontSize:24, fontWeight:800, color:s.color, lineHeight:1 }}>{s.value}</div>
                <div style={{ fontSize:10, fontWeight:600, color:'var(--fd-ink-4)', marginTop:4 }}>{s.label}</div>
                <div style={{ position:'absolute', bottom:0, left:'50%', transform:'translateX(-50%)', width:'40%', height:2, borderRadius:2, background:s.color, opacity:.4 }} />
              </div>
            ))}
          </div>
        )}

        {/* Section label */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12 }}>
          <Target size={13} style={{ color:'#6366f1' }} />
          <span style={{ fontSize:13, fontWeight:700, color:'var(--fd-ink-2)' }}>What did you work on today?</span>
        </div>

        {/* Entries */}
        <div style={{ marginBottom:12 }}>
          {entries.map((entry, i) => (
            <EntryRow key={i} entry={entry} index={i} clients={clients} onChange={handleEntryChange} onRemove={removeEntry} readOnly={isSubmitted} removing={saving} />
          ))}
          {!isSubmitted && (
            <button className="add-btn" onClick={addEntry}>
              <Plus size={14} /> Add another task
            </button>
          )}
        </div>

        {/* Blockers */}
        <div className="blk">
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
            <AlertTriangle size={13} style={{ color:'#f59e0b' }} />
            <span style={{ fontSize:12, fontWeight:700, color:'var(--fd-ink-2)' }}>Blockers</span>
            <span style={{ fontSize:10, color:'var(--fd-ink-5)' }}>optional</span>
          </div>
          <textarea
            value={blockers}
            onChange={e => { setBlockers(e.target.value); setSaved(false); }}
            readOnly={isSubmitted}
            placeholder="Anything stopping you? e.g. 'Waiting for client assets for the Reel project'"
            rows={2}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{ marginBottom:12, fontSize:12, color:'#ef4444', padding:'8px 12px', borderRadius:10, background:'rgba(239,68,68,.07)', border:'1px solid rgba(239,68,68,.2)' }}>
            {error}
          </div>
        )}

        {/* Actions */}
        {!isSubmitted && (
          <div style={{ display:'flex', gap:10 }}>
            <button className={`save-btn ${saved ? 'saved' : ''}`} onClick={handleSave} disabled={saving}>
              {saving
                ? <div style={{ width:14, height:14, borderRadius:'50%', border:'2px solid #6366f1', borderTopColor:'transparent', animation:'myd-spin .8s linear infinite' }} />
                : <Save size={14} />
              }
              {saved ? '✓ Saved' : 'Save draft'}
            </button>
            <button className="sub-btn" onClick={handleSubmit} disabled={submitting || saving}>
              {submitting
                ? <div style={{ width:16, height:16, borderRadius:'50%', border:'2px solid white', borderTopColor:'transparent', animation:'myd-spin .8s linear infinite' }} />
                : <Zap size={15} />
              }
              Submit day
            </button>
          </div>
        )}

        {showHistory && <HistoryModal onClose={() => setShowHistory(false)} />}
      </div>
    </>
  );
}