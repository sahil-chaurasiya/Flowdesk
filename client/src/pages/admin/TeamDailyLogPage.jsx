import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2,
  Clock, X, ClipboardList, Building2,
  CalendarDays, ExternalLink, ArrowLeft, TrendingUp, Users, Flame,
} from 'lucide-react';
import api from '../../lib/api';
import { getInitials } from '../../lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function todayStr() { return localDateStr(new Date()); }
function parseLocalDate(str) {
  const [y,m,d] = str.split('-').map(Number);
  return new Date(y, m-1, d);
}
function friendlyDate(str) {
  const t = todayStr();
  const yd = new Date(); yd.setDate(yd.getDate()-1);
  const ystr = localDateStr(yd);
  if (str === t) return 'Today';
  if (str === ystr) return 'Yesterday';
  return parseLocalDate(str).toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' });
}
function fullDate(str) {
  return parseLocalDate(str).toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_META = {
  completed:    { label:'Done',         color:'#10b981', bg:'rgba(16,185,129,.12)' },
  in_progress:  { label:'In Progress',  color:'#6366f1', bg:'rgba(99,102,241,.12)' },
  carried_over: { label:'Carried Over', color:'#f59e0b', bg:'rgba(245,158,11,.12)' },
};
const CATEGORY_LABELS = {
  paid_ads:'📊 Paid Ads', social_media:'📱 Social', video_editing:'🎬 Video',
  graphic_design:'🎨 Design', copywriting:'✍️ Copy', reporting:'📋 Reports',
  strategy:'🧠 Strategy', meetings:'🤝 Meetings', other:'📌 Other',
};
const ROLE_LABELS = {
  manager:'Project Manager', performance_marketer:'Performance Marketer',
  social_media_manager:'Social Media', video_editor:'Video Editor',
  graphic_designer:'Graphic Designer', copywriter:'Copywriter',
};
const ROLE_COLORS = {
  manager:'#8b5cf6', performance_marketer:'#f59e0b',
  social_media_manager:'#ec4899', video_editor:'#ef4444',
  graphic_designer:'#06b6d4', copywriter:'#10b981',
};

// ── CSS ───────────────────────────────────────────────────────────────────────

const css = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
.tdl { font-family: 'Plus Jakarta Sans', sans-serif; }
.tdl * { box-sizing: border-box; }
@keyframes tdl-spin { to { transform: rotate(360deg); } }
@keyframes tdl-in { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
.tdl { animation: tdl-in .3s ease both; }

.tdl .mc {
  border-radius: 18px; padding: 18px; cursor: pointer;
  border: 1px solid var(--fd-border); background: var(--fd-surface);
  position: relative; overflow: hidden;
  transition: transform .2s, box-shadow .2s, border-color .2s;
}
.tdl .mc:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,.1); border-color: rgba(99,102,241,.3); }
.tdl .mc.blocker { border-color: rgba(239,68,68,.3); background: rgba(239,68,68,.03); }

.tdl .prog-track { height: 4px; border-radius: 4px; background: var(--fd-border); overflow: hidden; margin-top: 10px; }
.tdl .prog-fill  { height: 100%; border-radius: 4px; transition: width .5s ease; }

.tdl .stat-pill {
  flex: 1; border-radius: 16px; padding: 14px 12px; text-align: center;
  border: 1px solid var(--fd-border); background: var(--fd-surface); transition: transform .15s;
}
.tdl .stat-pill:hover { transform: translateY(-1px); }

.tdl .ftab {
  padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 700;
  cursor: pointer; font-family: inherit; transition: all .15s;
  border: 1px solid var(--fd-border); background: var(--fd-surface); color: var(--fd-ink-4);
}
.tdl .ftab.on  { background: rgba(99,102,241,.1);  border-color: rgba(99,102,241,.3);  color: #6366f1; }
.tdl .ftab.red { background: rgba(239,68,68,.1);   border-color: rgba(239,68,68,.3);   color: #ef4444; }

.tdl .datenav {
  width: 34px; height: 34px; border-radius: 10px;
  border: 1px solid var(--fd-border); background: var(--fd-surface);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all .15s; color: var(--fd-ink-3);
}
.tdl .datenav:hover:not(:disabled) { background: rgba(99,102,241,.08); border-color: rgba(99,102,241,.3); color: #6366f1; }
.tdl .datenav:disabled { opacity:.3; cursor:not-allowed; }

.tdl .date-btn {
  display: flex; align-items: center; gap: 7px;
  padding: 0 14px; height: 34px; border-radius: 10px;
  font-size: 12px; font-weight: 700; cursor: pointer;
  border: 1px solid var(--fd-border); background: var(--fd-surface);
  color: var(--fd-ink-1); min-width: 120px;
  font-family: inherit; transition: all .15s;
}
.tdl .date-btn:hover { border-color: rgba(99,102,241,.35); }

/* Calendar popup — inline positioning, no fixed */
.tdl .cal-wrap {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 200;
  border-radius: 18px;
  background: var(--fd-surface);
  border: 1px solid var(--fd-border);
  box-shadow: 0 16px 48px rgba(0,0,0,.2);
  width: 266px;
  overflow: hidden;
}
.tdl .cal-day {
  aspect-ratio: 1; display: flex; align-items: center; justify-content: center;
  font-size: 12px; border-radius: 8px; border: none; cursor: pointer;
  background: transparent; color: var(--fd-ink-2); font-family: inherit;
  transition: background .1s;
}
.tdl .cal-day:hover:not(:disabled) { background: var(--fd-canvas); }
.tdl .cal-day.sel { background: #6366f1 !important; color: #fff !important; font-weight: 800; }
.tdl .cal-day.tod { color: #6366f1; font-weight: 800; }
.tdl .cal-day:disabled { opacity:.25; cursor:not-allowed; }

/* Modal */
.modal-ov { position:fixed; inset:0; z-index:50; display:flex; align-items:center; justify-content:center; padding:16px; }
.modal-bg { position:absolute; inset:0; background:rgba(0,0,0,.5); backdrop-filter:blur(4px); }
.modal-box {
  position:relative; width:100%; max-width:520px;
  border-radius:22px; background:var(--fd-surface);
  border:1px solid var(--fd-border); max-height:88vh;
  display:flex; flex-direction:column;
  box-shadow:0 32px 80px rgba(0,0,0,.25);
}

.tdl .etile {
  padding: 13px 15px; border-radius: 14px;
  background: var(--fd-canvas); border: 1px solid var(--fd-border);
  margin-bottom: 8px; transition: border-color .15s;
}
.tdl .etile:hover { border-color: rgba(99,102,241,.2); }

.tdl .back-btn {
  display:flex; align-items:center; gap:6px;
  font-size:12px; font-weight:600; padding:8px 14px;
  border-radius:12px; cursor:pointer; font-family:inherit;
  background:var(--fd-surface); border:1px solid var(--fd-border);
  color:var(--fd-ink-3); transition:all .15s;
}
.tdl .back-btn:hover { background:rgba(99,102,241,.06); border-color:rgba(99,102,241,.3); color:#6366f1; }

.tdl .av, .modal-box .av { border-radius:14px; display:flex; align-items:center; justify-content:center; color:white; font-weight:800; overflow:hidden; flex-shrink:0; }
.tdl .spinner { width:26px; height:26px; border-radius:50%; border:2.5px solid #6366f1; border-top-color:transparent; animation:tdl-spin .8s linear infinite; }

/* History log item */
.tdl .hli {
  border-radius: 16px; overflow: hidden;
  border: 1px solid var(--fd-border); background: var(--fd-surface); margin-bottom: 8px;
}
.tdl .hli-hdr {
  width:100%; display:flex; align-items:center; gap:12px;
  padding:14px 18px; background:transparent; border:none; cursor:pointer; text-align:left;
  transition: background .1s;
}
.tdl .hli-hdr:hover { background: var(--fd-canvas); }
`;

// ── Calendar Picker (absolutely positioned relative to date button wrapper) ───

function CalendarPicker({ value, onChange, onClose }) {
  const [view, setView] = useState(() => {
    const d = parseLocalDate(value);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const today = new Date();
  const todayLocal = localDateStr(today);
  const firstDay = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const monthName = new Date(view.year, view.month, 1).toLocaleDateString('en-IN', { month:'long', year:'numeric' });

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const canNext = !(view.year === today.getFullYear() && view.month === today.getMonth());

  return (
    <>
      {/* click-outside capture */}
      <div style={{ position:'fixed', inset:0, zIndex:199 }} onClick={onClose} />
      <div className="cal-wrap">
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid var(--fd-border)' }}>
          <button
            onClick={() => setView(v => v.month === 0 ? { year:v.year-1, month:11 } : { year:v.year, month:v.month-1 })}
            style={{ padding:6, borderRadius:8, border:'none', background:'transparent', cursor:'pointer', color:'var(--fd-ink-3)', display:'flex' }}
          ><ChevronLeft size={13} /></button>
          <span style={{ fontSize:12, fontWeight:700, color:'var(--fd-ink-1)' }}>{monthName}</span>
          <button
            onClick={() => canNext && setView(v => v.month === 11 ? { year:v.year+1, month:0 } : { year:v.year, month:v.month+1 })}
            style={{ padding:6, borderRadius:8, border:'none', background:'transparent', cursor: canNext ? 'pointer' : 'not-allowed', color:'var(--fd-ink-3)', opacity: canNext ? 1 : 0.3, display:'flex' }}
          ><ChevronRight size={13} /></button>
        </div>
        {/* Day labels */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', padding:'8px 10px 0' }}>
          {['S','M','T','W','T','F','S'].map((d,i) => (
            <div key={i} style={{ textAlign:'center', fontSize:9, fontWeight:700, color:'var(--fd-ink-5)', padding:'4px 0' }}>{d}</div>
          ))}
        </div>
        {/* Days */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', padding:'2px 10px 12px', gap:2 }}>
          {cells.map((day,i) => {
            if (!day) return <div key={i} />;
            const ds = `${view.year}-${String(view.month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const isSel = ds === value;
            const isTod = ds === todayLocal;
            const isFut = ds > todayLocal;
            return (
              <button
                key={i}
                disabled={isFut}
                onClick={() => { onChange(ds); onClose(); }}
                className={`cal-day ${isSel ? 'sel' : ''} ${isTod && !isSel ? 'tod' : ''}`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── Member History View ───────────────────────────────────────────────────────

function MemberHistoryView({ member, onBack }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api.get(`/daily-logs/team/${member._id}?limit=60`)
      .then(r => {
        const l = r.data.logs || [];
        setLogs(l);
        if (l.length > 0) setExpanded(l[0]._id);
      })
      .finally(() => setLoading(false));
  }, [member._id]);

  const submittedCount = logs.filter(l => l.isSubmitted).length;
  const rc = ROLE_COLORS[member.role] || '#6366f1';

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:24 }}>
        <button className="back-btn" onClick={onBack}><ArrowLeft size={13} /> Back to Team</button>
        <span style={{ fontSize:11, color:'var(--fd-ink-4)' }}>Daily Log History</span>
      </div>

      {/* Hero */}
      <div style={{ borderRadius:20, padding:20, marginBottom:24, background:'var(--fd-surface)', border:'1px solid var(--fd-border)', display:'flex', alignItems:'center', gap:16, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${rc},${rc}66)` }} />
        <div className="av" style={{ width:56, height:56, fontSize:18, background:rc }}>
          {member.avatar ? <img src={member.avatar} alt={member.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : getInitials(member.name)}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:17, fontWeight:800, color:'var(--fd-ink-1)' }}>{member.name}</div>
          <div style={{ fontSize:11, color:'var(--fd-ink-4)', marginTop:2 }}>{ROLE_LABELS[member.role] || member.role}</div>
        </div>
        <div style={{ display:'flex', gap:20 }}>
          {[{v:logs.length,l:'Days logged',c:'#6366f1'},{v:submittedCount,l:'Submitted',c:'#10b981'}].map(s=>(
            <div key={s.l} style={{ textAlign:'center' }}>
              <div style={{ fontSize:22, fontWeight:800, color:s.c }}>{s.v}</div>
              <div style={{ fontSize:9, fontWeight:700, color:'var(--fd-ink-4)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {loading && <div style={{ display:'flex', justifyContent:'center', padding:'60px 0' }}><div className="spinner" /></div>}
      {!loading && logs.length === 0 && (
        <div style={{ textAlign:'center', padding:'60px 0' }}>
          <div style={{ fontSize:44, marginBottom:12 }}>📭</div>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--fd-ink-2)' }}>No logs yet</div>
          <div style={{ fontSize:12, color:'var(--fd-ink-4)', marginTop:4 }}>{member.name} hasn't submitted any daily logs.</div>
        </div>
      )}

      {logs.map(log => {
        const isOpen = expanded === log._id;
        const done = (log.entries||[]).filter(e=>e.status==='completed').length;
        const hasB = log.blockers?.trim();
        const d = parseLocalDate(log.date);
        return (
          <div key={log._id} className="hli" style={{ borderColor: hasB ? 'rgba(239,68,68,.25)' : isOpen ? 'rgba(99,102,241,.25)' : undefined }}>
            <button className="hli-hdr" onClick={() => setExpanded(isOpen ? null : log._id)}>
              <div style={{ width:40, height:40, borderRadius:12, flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background: isOpen ? 'rgba(99,102,241,.12)' : 'var(--fd-canvas)' }}>
                <span style={{ fontSize:15, fontWeight:800, lineHeight:1, color: isOpen ? '#6366f1' : 'var(--fd-ink-1)' }}>{d.getDate()}</span>
                <span style={{ fontSize:8, fontWeight:700, textTransform:'uppercase', color: isOpen ? '#6366f1' : 'var(--fd-ink-4)' }}>{d.toLocaleDateString('en-IN',{month:'short'})}</span>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--fd-ink-1)' }}>{d.toLocaleDateString('en-IN',{weekday:'long'})}</div>
                <div style={{ display:'flex', gap:10, marginTop:2, flexWrap:'wrap' }}>
                  <span style={{ fontSize:11, color:'var(--fd-ink-3)' }}>{(log.entries||[]).length} tasks</span>
                  {done > 0 && <span style={{ fontSize:11, color:'#10b981' }}>{done} done</span>}
                  {hasB && <span style={{ fontSize:11, color:'#ef4444' }}>⚠ Blocker</span>}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                <span style={{ fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:20, background: log.isSubmitted ? 'rgba(16,185,129,.12)' : 'rgba(245,158,11,.12)', color: log.isSubmitted ? '#10b981' : '#f59e0b' }}>
                  {log.isSubmitted ? 'Submitted' : 'Draft'}
                </span>
                <ChevronLeft size={13} style={{ color:'var(--fd-ink-4)', transform: isOpen ? 'rotate(-90deg)' : 'none', transition:'transform .2s' }} />
              </div>
            </button>
            {isOpen && (
              <div style={{ padding:'0 18px 18px', borderTop:'1px solid var(--fd-border)' }}>
                <div style={{ paddingTop:14 }}>
                  {(log.entries||[]).map((entry,i) => (
                    <div key={i} className="etile">
                      <div style={{ fontSize:13, color:'var(--fd-ink-1)', fontWeight:500 }}>{entry.description}</div>
                      <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap', alignItems:'center' }}>
                        <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:STATUS_META[entry.status]?.bg, color:STATUS_META[entry.status]?.color, fontWeight:700 }}>
                          {STATUS_META[entry.status]?.label}
                        </span>
                        {entry.category && entry.category !== 'other' && (
                          <span style={{ fontSize:10, color:'var(--fd-ink-4)' }}>{CATEGORY_LABELS[entry.category]}</span>
                        )}
                        {(entry.client?.company || entry.client?.name) && (
                          <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, color:'#6366f1', background:'rgba(99,102,241,.1)', padding:'2px 8px', borderRadius:10, fontWeight:600 }}>
                            <Building2 size={9} /> {entry.client.company || entry.client.name}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {hasB && (
                  <div style={{ marginTop:10, padding:'12px 14px', borderRadius:12, background:'rgba(239,68,68,.06)', border:'1px solid rgba(239,68,68,.15)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                      <AlertTriangle size={11} style={{ color:'#ef4444' }} />
                      <span style={{ fontSize:10, fontWeight:700, color:'#ef4444' }}>Blocker</span>
                    </div>
                    <div style={{ fontSize:12, color:'var(--fd-ink-2)' }}>{log.blockers}</div>
                  </div>
                )}
                {log.isSubmitted && log.submittedAt && (
                  <div style={{ marginTop:10, fontSize:10, color:'var(--fd-ink-5)' }}>
                    Submitted at {new Date(log.submittedAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Day Log Modal ─────────────────────────────────────────────────────────────

function DayLogModal({ item, date, onClose, onViewHistory }) {
  const { member, log } = item;
  const rc = ROLE_COLORS[member.role] || '#6366f1';
  return (
    <div className="modal-ov">
      <div className="modal-bg" onClick={onClose} />
      <div className="modal-box">
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 20px', borderBottom:'1px solid var(--fd-border)', flexShrink:0, background:`linear-gradient(135deg,${rc}0d 0%,transparent 100%)` }}>
          <div className="av" style={{ width:42, height:42, fontSize:13, background:rc }}>
            {member.avatar ? <img src={member.avatar} alt={member.name} style={{ width:'100%',height:'100%',objectFit:'cover' }} /> : getInitials(member.name)}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:800, color:'var(--fd-ink-1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{member.name}</div>
            <div style={{ fontSize:11, color:'var(--fd-ink-4)', marginTop:1 }}>{ROLE_LABELS[member.role] || member.role} · {friendlyDate(date)}</div>
          </div>
          <button onClick={onClose} style={{ padding:8, borderRadius:10, border:'none', background:'transparent', cursor:'pointer', color:'var(--fd-ink-3)', display:'flex' }}><X size={14} /></button>
        </div>

        <div style={{ overflowY:'auto', flex:1, padding:20 }}>
          {!log ? (
            <div style={{ textAlign:'center', padding:'40px 0' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>📭</div>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--fd-ink-2)' }}>No log for {friendlyDate(date)}</div>
            </div>
          ) : (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:18, flexWrap:'wrap' }}>
                {log.isSubmitted
                  ? <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:11, fontWeight:700, padding:'5px 12px', borderRadius:20, background:'rgba(16,185,129,.12)', color:'#10b981' }}><CheckCircle2 size={11} /> Submitted{log.submittedAt && ` · ${new Date(log.submittedAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}`}</span>
                  : <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:11, fontWeight:700, padding:'5px 12px', borderRadius:20, background:'rgba(245,158,11,.12)', color:'#f59e0b' }}><Clock size={11} /> Draft — not submitted yet</span>
                }
              </div>
              {(log.entries||[]).length === 0
                ? <div style={{ textAlign:'center', padding:'24px 0', color:'var(--fd-ink-4)', fontSize:12 }}>No tasks logged.</div>
                : (log.entries||[]).map((entry,i) => (
                    <div key={i} className="etile">
                      <div style={{ fontSize:13, color:'var(--fd-ink-1)', fontWeight:500 }}>{entry.description}</div>
                      <div style={{ display:'flex', gap:6, marginTop:7, flexWrap:'wrap', alignItems:'center' }}>
                        <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:STATUS_META[entry.status]?.bg, color:STATUS_META[entry.status]?.color, fontWeight:700 }}>
                          {STATUS_META[entry.status]?.label}
                        </span>
                        {entry.category && entry.category !== 'other' && <span style={{ fontSize:10, color:'var(--fd-ink-4)' }}>{CATEGORY_LABELS[entry.category]}</span>}
                        {(entry.client?.company || entry.client?.name) && (
                          <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, color:'#6366f1', background:'rgba(99,102,241,.1)', padding:'2px 8px', borderRadius:10, fontWeight:600 }}>
                            <Building2 size={9} /> {entry.client.company || entry.client.name}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
              }
              {log.blockers?.trim() && (
                <div style={{ padding:'12px 16px', borderRadius:14, background:'rgba(239,68,68,.06)', border:'1px solid rgba(239,68,68,.15)', marginTop:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}><AlertTriangle size={12} style={{ color:'#ef4444' }} /><span style={{ fontSize:11, fontWeight:700, color:'#ef4444' }}>Blocker raised</span></div>
                  <div style={{ fontSize:12, color:'var(--fd-ink-2)' }}>{log.blockers}</div>
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ display:'flex', gap:10, padding:'14px 20px', borderTop:'1px solid var(--fd-border)', flexShrink:0 }}>
          <button onClick={onClose} style={{ padding:'10px 16px', borderRadius:12, fontSize:12, fontWeight:600, cursor:'pointer', background:'var(--fd-canvas)', border:'1px solid var(--fd-border)', color:'var(--fd-ink-3)', fontFamily:'inherit' }}>
            Close
          </button>
          <button onClick={() => { onClose(); onViewHistory(member); }} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px 16px', borderRadius:12, fontSize:12, fontWeight:700, cursor:'pointer', background:`linear-gradient(135deg,${rc},${rc}bb)`, border:'none', color:'white', fontFamily:'inherit' }}>
            <ExternalLink size={13} /> View {member.name.split(' ')[0]}'s Full History
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Member Card ───────────────────────────────────────────────────────────────

function MemberCard({ item, onClick }) {
  const { member, log } = item;
  const hasBlocker = log?.blockers?.trim();
  const done = log?.entries?.filter(e => e.status === 'completed').length || 0;
  const total = log?.entries?.length || 0;
  const rc = ROLE_COLORS[member.role] || '#6366f1';

  return (
    <div className={`mc ${hasBlocker ? 'blocker' : ''}`} onClick={onClick}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${rc},${rc}44)`, opacity:.7 }} />
      <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
        <div className="av" style={{ width:44, height:44, fontSize:13, background:rc }}>
          {member.avatar ? <img src={member.avatar} alt={member.name} style={{ width:'100%',height:'100%',objectFit:'cover' }} /> : getInitials(member.name)}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--fd-ink-1)' }}>{member.name}</div>
              <div style={{ fontSize:10, color:rc, fontWeight:600, marginTop:1 }}>{ROLE_LABELS[member.role] || member.role}</div>
            </div>
            {!log
              ? <span style={{ fontSize:10, padding:'3px 9px', borderRadius:20, fontWeight:700, background:'rgba(156,163,175,.15)', color:'var(--fd-ink-4)', flexShrink:0 }}>Not logged</span>
              : log.isSubmitted
                ? <span style={{ fontSize:10, padding:'3px 9px', borderRadius:20, fontWeight:700, background:'rgba(16,185,129,.12)', color:'#10b981', flexShrink:0 }}>✓ Submitted</span>
                : <span style={{ fontSize:10, padding:'3px 9px', borderRadius:20, fontWeight:700, background:'rgba(245,158,11,.12)', color:'#f59e0b', flexShrink:0 }}>Draft</span>
            }
          </div>
          {log && total > 0 && (
            <>
              <div className="prog-track">
                <div className="prog-fill" style={{ width:`${Math.round(done/total*100)}%`, background: done===total ? '#10b981' : rc }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:5 }}>
                <span style={{ fontSize:10, color:'var(--fd-ink-3)', fontWeight:500 }}>{total} task{total!==1?'s':''}</span>
                <span style={{ fontSize:10, color:'#10b981', fontWeight:700 }}>{done}/{total} done</span>
              </div>
            </>
          )}
          {log?.entries?.[0] && (
            <div style={{ marginTop:8, fontSize:11, color:'var(--fd-ink-4)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {log.entries[0].description}
              {log.entries.length > 1 && <span style={{ color:'var(--fd-ink-5)' }}> +{log.entries.length-1} more</span>}
            </div>
          )}
          {hasBlocker && (
            <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:5, fontSize:10, fontWeight:700, color:'#ef4444' }}>
              <AlertTriangle size={10} /> Blocker raised
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TeamDailyLogPage() {
  const [date, setDate] = useState(todayStr);
  const [data, setData] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [historyMember, setHistoryMember] = useState(null);
  const [filter, setFilter] = useState('all');
  const [showCal, setShowCal] = useState(false);

  const load = useCallback(async (d) => {
    setLoading(true);
    try {
      const [teamRes, statsRes] = await Promise.all([
        api.get(`/daily-logs/team?date=${d}`),
        api.get('/daily-logs/stats?days=7'),
      ]);
      setData(teamRes.data.result || []);
      setStats(statsRes.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(date); }, [date, load]);

  const changeDate = (delta) => {
    const d = parseLocalDate(date);
    d.setDate(d.getDate() + delta);
    const s = localDateStr(d);
    if (s > todayStr()) return;
    setDate(s);
  };

  const isToday = date === todayStr();
  const submitted = data.filter(i => i.log?.isSubmitted).length;
  const drafts    = data.filter(i => i.log && !i.log.isSubmitted).length;
  const notLogged = data.filter(i => !i.log).length;
  const blockers  = data.filter(i => i.log?.blockers?.trim()).length;

  const filtered = data.filter(item => {
    if (filter === 'submitted')     return item.log?.isSubmitted;
    if (filter === 'not_submitted') return !item.log || !item.log.isSubmitted;
    if (filter === 'blocker')       return item.log?.blockers?.trim();
    return true;
  });

  if (historyMember) return (
    <>
      <style>{css}</style>
      <div className="tdl" style={{ maxWidth:760, margin:'0 auto' }}>
        <MemberHistoryView member={historyMember} onBack={() => setHistoryMember(null)} />
      </div>
    </>
  );

  return (
    <>
      <style>{css}</style>
      <div className="tdl" style={{ maxWidth:900, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, gap:16 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
              <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <ClipboardList size={16} color="white" />
              </div>
              <h1 style={{ fontSize:22, fontWeight:800, color:'var(--fd-ink-1)', margin:0 }}>Team Daily Log</h1>
            </div>
            <p style={{ fontSize:12, color:'var(--fd-ink-4)', margin:0 }}>
              {isToday ? 'What your team shipped today' : `Work on ${fullDate(date)}`}
            </p>
          </div>

          {/* Date navigator — wrapper is position:relative so calendar pops below it */}
          <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0, position:'relative' }}>
            <button className="datenav" onClick={() => changeDate(-1)}><ChevronLeft size={14} /></button>
            <button className="date-btn" onClick={() => setShowCal(v => !v)}>
              <CalendarDays size={12} style={{ color:'#6366f1', flexShrink:0 }} />
              {friendlyDate(date)}
            </button>
            <button className="datenav" onClick={() => changeDate(1)} disabled={isToday}><ChevronRight size={14} /></button>

            {showCal && <CalendarPicker value={date} onChange={d => { setDate(d); setShowCal(false); }} onClose={() => setShowCal(false)} />}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:'flex', gap:10, marginBottom:20 }}>
          {[
            { label:'Submitted',  value:submitted, color:'#10b981' },
            { label:'Draft',      value:drafts,    color:'#f59e0b' },
            { label:'Not logged', value:notLogged, color:'var(--fd-ink-4)' },
            { label:'Blockers',   value:blockers,  color: blockers>0 ? '#ef4444' : 'var(--fd-ink-4)', red:blockers>0 },
          ].map(s => (
            <div key={s.label} className="stat-pill" style={{ background: s.red ? 'rgba(239,68,68,.04)' : undefined, borderColor: s.red ? 'rgba(239,68,68,.2)' : undefined }}>
              <div style={{ fontSize:26, fontWeight:800, color:s.color, lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:10, fontWeight:600, color:'var(--fd-ink-4)', marginTop:4, textTransform:'uppercase', letterSpacing:'.04em' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap' }}>
          {[
            { key:'all',           label:`All  ${data.length}` },
            { key:'submitted',     label:`Submitted  ${submitted}` },
            { key:'not_submitted', label:`Not submitted  ${notLogged+drafts}` },
            { key:'blocker',       label:`⚠ Blockers  ${blockers}`, red:true },
          ].map(tab => (
            <button
              key={tab.key}
              className={`ftab ${filter===tab.key ? (tab.red ? 'red' : 'on') : ''}`}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:'80px 0' }}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 0' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>📋</div>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--fd-ink-2)' }}>Nothing here</div>
            <div style={{ fontSize:12, color:'var(--fd-ink-4)', marginTop:4 }}>No logs match this filter for {friendlyDate(date)}.</div>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:12 }}>
            {filtered.map(item => <MemberCard key={item.member._id} item={item} onClick={() => setSelected(item)} />)}
          </div>
        )}

        {/* 7-day trend */}
        {stats?.stats?.length > 0 && (
          <div style={{ marginTop:32, borderRadius:20, padding:20, background:'var(--fd-surface)', border:'1px solid var(--fd-border)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
              <TrendingUp size={14} style={{ color:'#6366f1' }} />
              <span style={{ fontSize:12, fontWeight:700, color:'var(--fd-ink-2)' }}>7-Day Submission Rate</span>
              <span style={{ fontSize:11, color:'var(--fd-ink-4)', marginLeft:'auto' }}>{stats.totalTeam} members</span>
            </div>
            <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:72 }}>
              {[...stats.stats].reverse().map(day => {
                const pct = Math.round((day.submitted/(stats.totalTeam||1))*100);
                const isSel = day.date === date;
                return (
                  <button key={day.date} onClick={() => setDate(day.date)} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, background:'none', border:'none', cursor:'pointer', padding:0 }} title={`${friendlyDate(day.date)}: ${day.submitted}/${stats.totalTeam}`}>
                    <div style={{ width:'100%', borderRadius:'6px 6px 0 0', height:`${Math.max(8,pct*.62)}px`, background: isSel ? '#6366f1' : pct>=80 ? '#10b981' : pct>=50 ? '#6366f1' : '#f59e0b', opacity: isSel ? 1 : .65, outline: isSel ? '2px solid #6366f1' : 'none', outlineOffset:2, transition:'all .2s' }} />
                    <span style={{ fontSize:9, fontWeight: isSel ? 800 : 500, color: isSel ? '#6366f1' : 'var(--fd-ink-5)' }}>
                      {new Date(day.date+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short'})}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

      </div>
      {selected && <DayLogModal item={selected} date={date} onClose={() => setSelected(null)} onViewHistory={m => setHistoryMember(m)} />}
    </>
  );
}