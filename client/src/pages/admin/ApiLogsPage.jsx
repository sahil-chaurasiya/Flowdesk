import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Activity, AlertTriangle, Clock, Trash2, Search,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  X, Radio, Globe,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';
import api from '../../lib/api';
import { useSocket } from '../../context/SocketContext';

// ─── Design tokens ─────────────────────────────────────────────────────────────

const MC = {
  GET:    { glow: '#38bdf8', text: '#7dd3fc', badge: 'rgba(56,189,248,0.12)',  border: 'rgba(56,189,248,0.3)' },
  POST:   { glow: '#4ade80', text: '#86efac', badge: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.3)' },
  PUT:    { glow: '#fb923c', text: '#fdba74', badge: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.3)' },
  DELETE: { glow: '#f87171', text: '#fca5a5', badge: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)' },
  PATCH:  { glow: '#c084fc', text: '#d8b4fe', badge: 'rgba(192,132,252,0.12)', border: 'rgba(192,132,252,0.3)' },
};

function statusGlow(c) { return c>=500?'#f87171':c>=400?'#fb923c':c>=300?'#fbbf24':'#4ade80'; }
function statusBg(c)   { return c>=500?'rgba(248,113,113,0.12)':c>=400?'rgba(251,146,60,0.12)':c>=300?'rgba(251,191,36,0.12)':'rgba(74,222,128,0.12)'; }
function rtGlow(ms)    { return ms>1000?'#f87171':ms>500?'#fbbf24':'#4ade80'; }

function fmtHMS(ts)  { return new Date(ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'}); }
function fmtMD(ts)   { return new Date(ts).toLocaleDateString([],{month:'short',day:'numeric'}); }
function trunc(s,n=55){ return s?.length>n?s.slice(0,n)+'…':(s||''); }

const DATE_PRESETS = [
  { value:'live',   label:'⬤  Live'  },
  { value:'today',  label:'Today'    },
  { value:'7d',     label:'7 days'   },
  { value:'30d',    label:'30 days'  },
  { value:'custom', label:'Custom'   },
];
const STATUS_OPTS = [
  { value:'',             label:'All'  },
  { value:'success',      label:'2xx'  },
  { value:'redirect',     label:'3xx'  },
  { value:'client-error', label:'4xx'  },
  { value:'server-error', label:'5xx'  },
];

function getDateRange(preset, from, to) {
  const now=new Date(), today=new Date(now); today.setHours(0,0,0,0);
  if(preset==='live')   return { dateFrom: new Date(now-30*60000).toISOString(), dateTo: now.toISOString() };
  if(preset==='today')  return { dateFrom: today.toISOString(), dateTo: now.toISOString() };
  if(preset==='7d')     return { dateFrom: new Date(now-7*86400000).toISOString(), dateTo: now.toISOString() };
  if(preset==='30d')    return { dateFrom: new Date(now-30*86400000).toISOString(), dateTo: now.toISOString() };
  if(preset==='custom') return { dateFrom: from, dateTo: to };
  return {};
}

// ─── Injected CSS ──────────────────────────────────────────────────────────────

const CSS = `
  @keyframes scan {
    0%   { transform:translateY(-100%); }
    100% { transform:translateY(500%);  }
  }
  @keyframes blink {
    0%,100%{ opacity:1; transform:scale(1);   }
    50%    { opacity:.4; transform:scale(.65); }
  }
  @keyframes fadein {
    from { opacity:0; transform:translateY(-5px); }
    to   { opacity:1; transform:translateY(0);    }
  }
  @keyframes spin { to { transform:rotate(360deg); } }
  @keyframes countup {
    from { opacity:0; transform:translateY(5px); }
    to   { opacity:1; transform:translateY(0);   }
  }
  .scan-parent { position:relative; overflow:hidden; }
  .scan-parent::after {
    content:''; position:absolute; top:0; left:0; right:0; height:35%;
    background:linear-gradient(to bottom,transparent,rgba(56,189,248,.025) 50%,transparent);
    animation:scan 5s linear infinite; pointer-events:none;
  }
  .new-row   { animation:fadein .2s ease forwards; }
  .stat-num  { animation:countup .3s ease forwards; }
  .live-dot  { animation:blink 1.2s ease-in-out infinite; }
  .row-hover { transition:background .12s; }
  .row-hover:hover { background:rgba(255,255,255,.025) !important; }
  input[type=datetime-local]::-webkit-calendar-picker-indicator { filter:invert(.5); }
  select option { background:#0f172a; }
`;

// ─── Atoms ─────────────────────────────────────────────────────────────────────

function MethodBadge({ method }) {
  const c = MC[method] || { badge:'rgba(255,255,255,.07)', border:'rgba(255,255,255,.15)', text:'#94a3b8', glow:'transparent' };
  return (
    <span style={{
      background:c.badge, border:`1px solid ${c.border}`, color:c.text,
      padding:'1px 8px', borderRadius:4, fontSize:10, fontWeight:700,
      fontFamily:'monospace', letterSpacing:'.06em',
      textShadow:`0 0 8px ${c.glow}`,
    }}>{method}</span>
  );
}

function StatusBadge({ code }) {
  const col=statusGlow(code), bg=statusBg(code);
  return (
    <span style={{
      background:bg, border:`1px solid ${col}50`, color:col,
      padding:'1px 8px', borderRadius:4, fontSize:11, fontWeight:700,
      fontFamily:'monospace', textShadow:`0 0 10px ${col}80`,
    }}>{code}</span>
  );
}

function GlassPanel({ children, style={}, className='' }) {
  return (
    <div className={`scan-parent ${className}`} style={{
      background:'rgba(255,255,255,.028)',
      border:'1px solid rgba(255,255,255,.07)',
      borderRadius:14,
      backdropFilter:'blur(14px)',
      ...style,
    }}>{children}</div>
  );
}

function StatCard({ label, value, color='#38bdf8', icon:Icon, loading }) {
  return (
    <GlassPanel style={{ padding:'18px 20px', flex:1, minWidth:130, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:-24, right:-24, width:90, height:90, borderRadius:'50%', background:`radial-gradient(circle,${color}15 0%,transparent 70%)`, pointerEvents:'none' }} />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <span style={{ fontSize:9.5, fontWeight:600, letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(255,255,255,.28)' }}>{label}</span>
        {Icon && <Icon size={12} style={{ color:`${color}88` }} />}
      </div>
      <div key={String(value)} className="stat-num" style={{ fontSize:28, fontWeight:800, color, letterSpacing:'-.02em', lineHeight:1, fontFamily:'monospace', textShadow:`0 0 22px ${color}55` }}>
        {loading ? <span style={{ opacity:.2 }}>—</span> : value}
      </div>
    </GlassPanel>
  );
}

function ChartTip({ active, payload, label }) {
  if(!active||!payload?.length) return null;
  return (
    <div style={{ background:'rgba(8,12,28,.96)', border:'1px solid rgba(56,189,248,.3)', borderRadius:8, padding:'8px 12px', fontSize:12 }}>
      <div style={{ color:'rgba(255,255,255,.35)', marginBottom:2 }}>{label?new Date(label).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):''}</div>
      <div style={{ color:'#f87171', fontWeight:700 }}>{payload[0].value} errors</div>
    </div>
  );
}

// ─── Log row ───────────────────────────────────────────────────────────────────

function LogRow({ log, isNew }) {
  const [open, setOpen] = useState(false);
  const user = log.userId;

  return (
    <>
      <tr
        className={`row-hover${isNew?' new-row':''}`}
        onClick={() => setOpen(v=>!v)}
        style={{ borderBottom:'1px solid rgba(255,255,255,.04)', cursor:'pointer', background: open?'rgba(56,189,248,.05)':'transparent' }}
      >
        {/* live flash */}
        <td style={{ padding:'9px 6px 9px 14px', width:18 }}>
          {isNew && <div style={{ width:6,height:6,borderRadius:'50%',background:'#4ade80',boxShadow:'0 0 8px #4ade80',animation:'blink 1.5s ease-in-out 3' }} />}
        </td>
        {/* time */}
        <td style={{ padding:'9px 14px',whiteSpace:'nowrap',fontSize:11,color:'rgba(255,255,255,.3)',fontFamily:'monospace' }}>
          <div>{fmtHMS(log.timestamp)}</div>
          <div style={{ fontSize:10,opacity:.6 }}>{fmtMD(log.timestamp)}</div>
        </td>
        {/* method */}
        <td style={{ padding:'9px 14px',whiteSpace:'nowrap' }}><MethodBadge method={log.method} /></td>
        {/* url */}
        <td style={{ padding:'9px 14px',maxWidth:280 }}>
          <span style={{ fontSize:12,fontFamily:'monospace',color:'rgba(255,255,255,.6)',display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }} title={log.url}>{log.url}</span>
        </td>
        {/* status */}
        <td style={{ padding:'9px 14px',whiteSpace:'nowrap' }}><StatusBadge code={log.statusCode} /></td>
        {/* latency */}
        <td style={{ padding:'9px 14px',whiteSpace:'nowrap',fontFamily:'monospace',fontSize:12,color:rtGlow(log.responseTime),textShadow:`0 0 8px ${rtGlow(log.responseTime)}80` }}>
          {log.responseTime}ms
        </td>
        {/* user */}
        <td style={{ padding:'9px 14px',whiteSpace:'nowrap',fontSize:11,color:'rgba(255,255,255,.3)' }}>
          {user?.name||<span style={{ color:'rgba(255,255,255,.15)' }}>—</span>}
        </td>
        {/* expand */}
        <td style={{ padding:'9px 14px 9px 6px',textAlign:'right' }}>
          {open ? <ChevronUp size={11} style={{ color:'#38bdf8' }} /> : <ChevronDown size={11} style={{ color:'rgba(255,255,255,.18)' }} />}
        </td>
      </tr>

      {open && (
        <tr style={{ borderBottom:'1px solid rgba(255,255,255,.04)' }}>
          <td colSpan={8} style={{ padding:'0 14px 14px' }}>
            <div style={{ background:'rgba(0,0,0,.35)', border:'1px solid rgba(56,189,248,.15)', borderRadius:10, padding:16, display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              {[
                { label:'Full URL',   value:log.url,  mono:true },
                { label:'IP Address', value:log.ip||'—', mono:true },
              ].map(({label,value,mono})=>(
                <div key={label}>
                  <div style={{ fontSize:9.5,color:'rgba(255,255,255,.28)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:4 }}>{label}</div>
                  <div style={{ fontSize:12,fontFamily:mono?'monospace':'inherit',color:'rgba(255,255,255,.65)',wordBreak:'break-all' }}>{value}</div>
                </div>
              ))}
              {log.userAgent&&(
                <div style={{ gridColumn:'1/-1' }}>
                  <div style={{ fontSize:9.5,color:'rgba(255,255,255,.28)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:4 }}>User Agent</div>
                  <div style={{ fontSize:11,color:'rgba(255,255,255,.4)',wordBreak:'break-all' }}>{log.userAgent}</div>
                </div>
              )}
              {log.errorMessage&&(
                <div style={{ gridColumn:'1/-1' }}>
                  <div style={{ fontSize:9.5,color:'#f87171',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:4 }}>⚠ Error</div>
                  <div style={{ fontSize:12,color:'#fca5a5',fontFamily:'monospace' }}>{log.errorMessage}</div>
                </div>
              )}
              {log.requestBody&&Object.keys(log.requestBody).length>0&&(
                <div style={{ gridColumn:'1/-1' }}>
                  <div style={{ fontSize:9.5,color:'rgba(255,255,255,.28)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:4 }}>Request Body</div>
                  <pre style={{ fontSize:11,fontFamily:'monospace',color:'#7dd3fc',background:'rgba(0,0,0,.4)',border:'1px solid rgba(56,189,248,.15)',borderRadius:6,padding:10,overflowX:'auto',margin:0 }}>
                    {JSON.stringify(log.requestBody,null,2)}
                  </pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Clear dialog ──────────────────────────────────────────────────────────────

function ClearDialog({ onConfirm, onCancel }) {
  const [days, setDays] = useState('7');
  return (
    <div style={{ position:'fixed',inset:0,zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,.72)',backdropFilter:'blur(10px)' }}>
      <GlassPanel style={{ padding:28,width:360,border:'1px solid rgba(248,113,113,.3)' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14 }}>
          <span style={{ fontSize:14,fontWeight:700,color:'#f87171' }}>⚠ Clear Old Logs</span>
          <button onClick={onCancel} style={{ background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,.3)' }}><X size={14}/></button>
        </div>
        <p style={{ fontSize:13,color:'rgba(255,255,255,.4)',marginBottom:16 }}>Permanently delete logs older than:</p>
        <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:20 }}>
          <input type="number" min="1" max="365" value={days} onChange={e=>setDays(e.target.value)}
            style={{ width:72,padding:'6px 10px',borderRadius:7,fontSize:14,fontFamily:'monospace',background:'rgba(0,0,0,.45)',border:'1px solid rgba(248,113,113,.35)',color:'#f87171',outline:'none' }} />
          <span style={{ fontSize:13,color:'rgba(255,255,255,.35)' }}>days</span>
        </div>
        <div style={{ display:'flex',justifyContent:'flex-end',gap:8 }}>
          <button onClick={onCancel} style={{ padding:'7px 16px',borderRadius:7,fontSize:12,background:'transparent',border:'1px solid rgba(255,255,255,.1)',color:'rgba(255,255,255,.4)',cursor:'pointer' }}>Cancel</button>
          <button onClick={()=>onConfirm(parseInt(days,10))} style={{ padding:'7px 16px',borderRadius:7,fontSize:12,fontWeight:600,background:'rgba(248,113,113,.15)',border:'1px solid rgba(248,113,113,.4)',color:'#f87171',cursor:'pointer' }}>Delete</button>
        </div>
      </GlassPanel>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

const MAX_LIVE = 200;

export default function ApiLogsPage() {
  const { socket, connected } = useSocket();

  const [logs,        setLogs]         = useState([]);
  const [stats,       setStats]        = useState(null);
  const [loading,     setLoading]      = useState(true);
  const [statsLoading,setStatsLoading] = useState(true);
  const [page,        setPage]         = useState(1);
  const [pagination,  setPagination]   = useState(null);
  const [showClear,   setShowClear]    = useState(false);
  const [toast,       setToast]        = useState(null);
  const [newIds,      setNewIds]       = useState(new Set());

  const [datePreset,  setDatePreset]   = useState('live');
  const [liveBuffer,  setLiveBuffer]   = useState([]);
  const [livePaused,  setLivePaused]   = useState(false);

  const [method,      setMethod]       = useState('');
  const [status,      setStatus]       = useState('');
  const [urlSearch,   setUrlSearch]    = useState('');
  const [customFrom,  setCustomFrom]   = useState('');
  const [customTo,    setCustomTo]     = useState('');

  const isLive = datePreset === 'live';

  const flash = (msg, type='success') => {
    setToast({ msg, type });
    setTimeout(()=>setToast(null), 3500);
  };

  // ── Socket feed ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const handler = (log) => {
      if (livePaused) return;
      setLiveBuffer(prev => [log, ...prev].slice(0, MAX_LIVE));
      setNewIds(prev => { const s=new Set(prev); s.add(log._id); return s; });
      setTimeout(() => setNewIds(prev => { const s=new Set(prev); s.delete(log._id); return s; }), 3000);
      // Optimistic stat counters
      setStats(prev => {
        if (!prev) return prev;
        const isErr = log.statusCode >= 400;
        const total = prev.totalToday + 1;
        const errs  = prev.errorsToday + (isErr ? 1 : 0);
        return { ...prev, totalToday:total, errorsToday:errs, errorRate:parseFloat(((errs/total)*100).toFixed(1)), avgResponseTime:Math.round((prev.avgResponseTime*(total-1)+log.responseTime)/total) };
      });
    };
    socket.on('api:log', handler);
    return () => socket.off('api:log', handler);
  }, [socket, livePaused]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try { const {data} = await api.get('/logs/stats'); setStats(data.data); } catch(_){}
    finally { setStatsLoading(false); }
  }, []);

  const fetchLogs = useCallback(async (pg=1) => {
    if (isLive) return;
    setLoading(true);
    try {
      const range = getDateRange(datePreset, customFrom, customTo);
      const {data} = await api.get('/logs', { params:{ page:pg,limit:50,...(method?{method}:{}),...(status?{status}:{}),...(urlSearch?{url:urlSearch}:{}), ...range } });
      setLogs(data.data); setPagination(data.pagination);
    } catch(_){}
    finally { setLoading(false); }
  }, [isLive, method, status, urlSearch, datePreset, customFrom, customTo]);

  useEffect(() => {
    fetchStats();
    if (!isLive) { fetchLogs(1); setPage(1); }
    else setLoading(false);
  }, [fetchStats, fetchLogs, isLive]);

  // Periodic stats refresh
  useEffect(() => { const id=setInterval(fetchStats,30000); return ()=>clearInterval(id); }, [fetchStats]);

  const handleClear = async (days) => {
    setShowClear(false);
    try {
      const {data} = await api.delete('/logs',{params:{days}});
      flash(data.message);
      setLiveBuffer([]); fetchStats();
      if(!isLive) fetchLogs(1);
    } catch(err) { flash(err.response?.data?.message||'Failed','error'); }
  };

  // ── Chart data ─────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (!stats) return [];
    const map={}; stats.errorsByHour?.forEach(e=>{map[e.hour]=e.errors;});
    const now=new Date();
    return Array.from({length:24},(_,i)=>{
      const h=new Date(now-(23-i)*3600000); h.setMinutes(0,0,0);
      const key=h.toISOString().slice(0,14)+'00:00.000Z';
      return { hour:h.toISOString(), errors:map[key]||0 };
    });
  }, [stats]);

  const rateData = useMemo(() => {
    const b={}; liveBuffer.forEach(l=>{ const s=Math.floor(new Date(l.timestamp)/5000)*5000; b[s]=(b[s]||0)+1; });
    const now=Date.now();
    return Array.from({length:20},(_,i)=>{ const t=Math.floor((now-(19-i)*5000)/5000)*5000; return {t,rps:b[t]||0}; });
  }, [liveBuffer]);

  const displayedLive = useMemo(() => liveBuffer.filter(l => {
    if (method && l.method!==method) return false;
    if (urlSearch && !l.url.toLowerCase().includes(urlSearch.toLowerCase())) return false;
    if (status) {
      const c=l.statusCode;
      if(status==='success'&&!(c>=200&&c<300)) return false;
      if(status==='redirect'&&!(c>=300&&c<400)) return false;
      if(status==='client-error'&&!(c>=400&&c<500)) return false;
      if(status==='server-error'&&!(c>=500)) return false;
    }
    return true;
  }), [liveBuffer, method, urlSearch, status]);

  const rows = isLive ? displayedLive : logs;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{CSS}</style>

      {/* ambient glow */}
      <div style={{ position:'fixed',inset:0,pointerEvents:'none',zIndex:0, background:'radial-gradient(ellipse 90% 55% at 50% -5%,rgba(56,189,248,.055) 0%,transparent 68%)' }} />

      <div style={{ position:'relative',zIndex:1,display:'flex',flexDirection:'column',gap:18 }}>

        {/* toast */}
        {toast && (
          <div style={{ position:'fixed',top:20,right:20,zIndex:200,animation:'fadein .2s ease',
            background:toast.type==='error'?'rgba(248,113,113,.14)':'rgba(74,222,128,.14)',
            border:`1px solid ${toast.type==='error'?'rgba(248,113,113,.4)':'rgba(74,222,128,.4)'}`,
            color:toast.type==='error'?'#fca5a5':'#86efac',
            padding:'9px 18px',borderRadius:10,fontSize:13,fontWeight:500,backdropFilter:'blur(12px)' }}>
            {toast.msg}
          </div>
        )}

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:12 }}>
          <div>
            <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:3 }}>
              <h1 style={{ fontSize:21,fontWeight:800,color:'#f1f5f9',letterSpacing:'-.03em',margin:0 }}>API Monitor</h1>
              {/* connection badge */}
              <div style={{ display:'flex',alignItems:'center',gap:5,padding:'3px 10px',borderRadius:20,fontSize:10,fontWeight:700,
                background:connected?'rgba(74,222,128,.1)':'rgba(248,113,113,.1)',
                border:`1px solid ${connected?'rgba(74,222,128,.3)':'rgba(248,113,113,.3)'}`,
                color:connected?'#4ade80':'#f87171', letterSpacing:'.08em' }}>
                <div className="live-dot" style={{ width:5,height:5,borderRadius:'50%',background:connected?'#4ade80':'#f87171' }} />
                {connected?'LIVE':'OFFLINE'}
              </div>
            </div>
            <p style={{ fontSize:11.5,color:'rgba(255,255,255,.28)',margin:0 }}>Real-time HTTP request telemetry</p>
          </div>
          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            {isLive && (
              <button onClick={()=>setLivePaused(v=>!v)} style={{
                display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',
                background:livePaused?'rgba(251,191,36,.1)':'rgba(74,222,128,.1)',
                border:`1px solid ${livePaused?'rgba(251,191,36,.3)':'rgba(74,222,128,.3)'}`,
                color:livePaused?'#fbbf24':'#4ade80',
              }}>
                <Radio size={12} />{livePaused?'Resume':'Pause'}
              </button>
            )}
            <button onClick={()=>setShowClear(true)} style={{ display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',background:'rgba(248,113,113,.08)',border:'1px solid rgba(248,113,113,.22)',color:'#f87171' }}>
              <Trash2 size={12} />Clear logs
            </button>
          </div>
        </div>

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        <div style={{ display:'flex',gap:12,flexWrap:'wrap' }}>
          <StatCard label="Requests today" value={(stats?.totalToday??0).toLocaleString()} color="#38bdf8" icon={Activity} loading={statsLoading} />
          <StatCard label="Error rate"     value={`${stats?.errorRate??0}%`} color={(stats?.errorRate??0)>5?'#f87171':'#4ade80'} icon={AlertTriangle} loading={statsLoading} />
          <StatCard label="Avg latency"    value={`${stats?.avgResponseTime??0}ms`} color={(stats?.avgResponseTime??0)>500?'#fbbf24':'#4ade80'} icon={Clock} loading={statsLoading} />

          {/* 24h error area chart */}
          <GlassPanel style={{ flex:2,minWidth:200,padding:'14px 18px' }}>
            <div style={{ fontSize:9.5,fontWeight:600,letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(255,255,255,.28)',marginBottom:8 }}>Errors / 24 h</div>
            <ResponsiveContainer width="100%" height={52}>
              <AreaChart data={chartData} margin={{top:2,right:2,bottom:0,left:-30}}>
                <defs>
                  <linearGradient id="eG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f87171" stopOpacity={.35}/>
                    <stop offset="95%" stopColor="#f87171" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour" hide />
                <YAxis hide />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="errors" stroke="#f87171" strokeWidth={1.5} fill="url(#eG)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </GlassPanel>

          {/* live req-rate */}
          {isLive && (
            <GlassPanel style={{ flex:2,minWidth:200,padding:'14px 18px' }}>
              <div style={{ fontSize:9.5,fontWeight:600,letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(255,255,255,.28)',marginBottom:8,display:'flex',alignItems:'center',gap:6 }}>
                <div className="live-dot" style={{ width:5,height:5,borderRadius:'50%',background:'#4ade80' }} />
                Throughput (5 s)
              </div>
              <ResponsiveContainer width="100%" height={52}>
                <LineChart data={rateData} margin={{top:2,right:2,bottom:0,left:-30}}>
                  <XAxis dataKey="t" hide />
                  <YAxis hide />
                  <Line type="monotone" dataKey="rps" stroke="#38bdf8" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </GlassPanel>
          )}
        </div>

        {/* ── Filters ────────────────────────────────────────────────────── */}
        <GlassPanel style={{ padding:'13px 18px',display:'flex',flexWrap:'wrap',gap:10,alignItems:'center' }}>
          {/* date presets */}
          <div style={{ display:'flex',gap:4 }}>
            {DATE_PRESETS.map(d=>{
              const act=datePreset===d.value;
              return (
                <button key={d.value} onClick={()=>{setDatePreset(d.value);setPage(1);}} style={{
                  padding:'5px 12px',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer',transition:'all .12s',
                  background:act?'rgba(56,189,248,.14)':'transparent',
                  border:act?'1px solid rgba(56,189,248,.4)':'1px solid rgba(255,255,255,.07)',
                  color:act?'#38bdf8':'rgba(255,255,255,.32)',
                  textShadow:act?'0 0 14px #38bdf880':'none',
                }}>{d.label}</button>
              );
            })}
          </div>

          <div style={{ width:1,height:18,background:'rgba(255,255,255,.08)',flexShrink:0 }} />

          {/* method pills */}
          <div style={{ display:'flex',gap:4,flexWrap:'wrap' }}>
            {['','GET','POST','PUT','DELETE','PATCH'].map(m=>{
              const mc=MC[m], act=method===m;
              return (
                <button key={m} onClick={()=>setMethod(m)} style={{
                  padding:'4px 10px',borderRadius:5,fontSize:10,fontWeight:700,fontFamily:'monospace',letterSpacing:'.06em',cursor:'pointer',transition:'all .12s',
                  background:act&&mc?mc.badge:act?'rgba(255,255,255,.08)':'transparent',
                  border:act&&mc?`1px solid ${mc.border}`:act?'1px solid rgba(255,255,255,.2)':'1px solid rgba(255,255,255,.07)',
                  color:act&&mc?mc.text:act?'#fff':'rgba(255,255,255,.28)',
                }}>{m||'ALL'}</button>
              );
            })}
          </div>

          <div style={{ width:1,height:18,background:'rgba(255,255,255,.08)',flexShrink:0 }} />

          {/* status */}
          <select value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}} style={{ padding:'5px 10px',borderRadius:6,fontSize:11,background:'rgba(0,0,0,.35)',border:'1px solid rgba(255,255,255,.1)',color:'rgba(255,255,255,.55)',outline:'none',cursor:'pointer' }}>
            {STATUS_OPTS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          {/* url search */}
          <div style={{ display:'flex',alignItems:'center',gap:6,background:'rgba(0,0,0,.28)',border:'1px solid rgba(255,255,255,.09)',borderRadius:6,padding:'5px 10px',flex:1,minWidth:150 }}>
            <Search size={10} style={{ color:'rgba(255,255,255,.28)',flexShrink:0 }} />
            <input type="text" placeholder="Filter endpoint…" value={urlSearch} onChange={e=>{setUrlSearch(e.target.value);setPage(1);}}
              style={{ background:'none',border:'none',outline:'none',fontSize:12,color:'rgba(255,255,255,.65)',width:'100%' }} />
            {urlSearch && <button onClick={()=>setUrlSearch('')} style={{ background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,.28)',padding:0 }}><X size={10}/></button>}
          </div>

          {/* custom pickers */}
          {datePreset==='custom' && (
            <div style={{ display:'flex',alignItems:'center',gap:8 }}>
              {[{v:customFrom,s:setCustomFrom,l:'From'},{v:customTo,s:setCustomTo,l:'To'}].map(({v,s,l})=>(
                <React.Fragment key={l}>
                  <span style={{ fontSize:10,color:'rgba(255,255,255,.28)' }}>{l}</span>
                  <input type="datetime-local" value={v} onChange={e=>s(e.target.value)}
                    style={{ padding:'4px 8px',borderRadius:6,fontSize:11,background:'rgba(0,0,0,.35)',border:'1px solid rgba(255,255,255,.1)',color:'rgba(255,255,255,.55)',outline:'none' }} />
                </React.Fragment>
              ))}
            </div>
          )}

          {/* live counter */}
          {isLive && (
            <div style={{ marginLeft:'auto',display:'flex',alignItems:'center',gap:6,fontSize:11,color:'rgba(255,255,255,.25)',fontFamily:'monospace' }}>
              <div className="live-dot" style={{ width:5,height:5,borderRadius:'50%',background:livePaused?'#fbbf24':'#4ade80' }} />
              {displayedLive.length}/{MAX_LIVE}
            </div>
          )}
        </GlassPanel>

        {/* ── Table ──────────────────────────────────────────────────────── */}
        <GlassPanel style={{ overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%',borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid rgba(255,255,255,.06)' }}>
                  {['','Time','Method','Endpoint','Status','Latency','User',''].map((h,i)=>(
                    <th key={i} style={{
                      padding: i===0?'10px 6px 10px 14px':i===7?'10px 14px 10px 6px':'10px 14px',
                      textAlign:'left',fontSize:9.5,fontWeight:600,letterSpacing:'.12em',textTransform:'uppercase',
                      color:'rgba(255,255,255,.22)',whiteSpace:'nowrap',background:'rgba(0,0,0,.18)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && !isLive ? (
                  <tr><td colSpan={8} style={{ textAlign:'center',padding:56 }}>
                    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:10 }}>
                      <div style={{ width:30,height:30,border:'2px solid rgba(56,189,248,.25)',borderTopColor:'#38bdf8',borderRadius:'50%',animation:'spin .8s linear infinite' }} />
                      <span style={{ fontSize:12,color:'rgba(255,255,255,.25)' }}>Loading telemetry…</span>
                    </div>
                  </td></tr>
                ) : rows.length===0 ? (
                  <tr><td colSpan={8} style={{ textAlign:'center',padding:64 }}>
                    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:8 }}>
                      <Globe size={26} style={{ color:'rgba(255,255,255,.1)' }} />
                      <span style={{ fontSize:13,color:'rgba(255,255,255,.2)' }}>
                        {isLive?'Waiting for incoming requests…':'No logs match your filters'}
                      </span>
                    </div>
                  </td></tr>
                ) : (
                  rows.map(log=><LogRow key={log._id} log={log} isNew={newIds.has(log._id)} />)
                )}
              </tbody>
            </table>
          </div>

          {/* pagination */}
          {!isLive && pagination && pagination.pages>1 && (
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 18px',borderTop:'1px solid rgba(255,255,255,.05)' }}>
              <span style={{ fontSize:11,color:'rgba(255,255,255,.22)',fontFamily:'monospace' }}>
                {((pagination.page-1)*pagination.limit)+1}–{Math.min(pagination.page*pagination.limit,pagination.total)} of {pagination.total.toLocaleString()}
              </span>
              <div style={{ display:'flex',gap:4 }}>
                {[
                  { label:<ChevronLeft size={12}/>, p:page-1, dis:page<=1 },
                  ...Array.from({length:Math.min(5,pagination.pages)},(_,i)=>{ const p=Math.max(1,Math.min(pagination.pages-4,page-2))+i; return {label:p,p,isCur:p===page}; }),
                  { label:<ChevronRight size={12}/>, p:page+1, dis:page>=pagination.pages },
                ].map((btn,i)=>(
                  <button key={i} onClick={()=>!btn.dis&&handlePageChange(btn.p)} disabled={btn.dis} style={{
                    minWidth:28,height:28,padding:'0 6px',borderRadius:6,fontSize:11,fontFamily:'monospace',cursor:btn.dis?'default':'pointer',
                    background:btn.isCur?'rgba(56,189,248,.2)':'rgba(255,255,255,.04)',
                    border:btn.isCur?'1px solid rgba(56,189,248,.4)':'1px solid rgba(255,255,255,.07)',
                    color:btn.isCur?'#38bdf8':btn.dis?'rgba(255,255,255,.12)':'rgba(255,255,255,.35)',
                    display:'flex',alignItems:'center',justifyContent:'center',
                  }}>{btn.label}</button>
                ))}
              </div>
            </div>
          )}
        </GlassPanel>

        {/* ── Analytics ──────────────────────────────────────────────────── */}
        {stats && (
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
            {[
              { title:'⚡ Slowest Endpoints',     data:stats.slowestEndpoints, key:'avgTime', unit:'ms' },
              { title:'🔥 Most Called Endpoints',  data:stats.topEndpoints,    key:'count',   unit:'req' },
            ].map(({title,data,key,unit})=>(
              <GlassPanel key={title} style={{ padding:'18px 20px' }}>
                <div style={{ fontSize:12,fontWeight:700,color:'rgba(255,255,255,.6)',marginBottom:14 }}>{title}</div>
                <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
                  {!data?.length && <span style={{ fontSize:12,color:'rgba(255,255,255,.2)' }}>No data yet</span>}
                  {data?.map((ep,i)=>{
                    const maxVal=data[0]?.[key]||1, pct=Math.round((ep[key]/maxVal)*100);
                    return (
                      <div key={i} style={{ display:'flex',alignItems:'center',gap:10 }}>
                        <MethodBadge method={ep.method} />
                        <div style={{ flex:1,overflow:'hidden' }}>
                          <div style={{ fontSize:11,fontFamily:'monospace',color:'rgba(255,255,255,.48)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:4 }} title={ep.url}>{trunc(ep.url,42)}</div>
                          <div style={{ height:2,borderRadius:2,background:'rgba(255,255,255,.06)' }}>
                            <div style={{ height:'100%',borderRadius:2,width:`${pct}%`,background:i===0?'#38bdf8':'rgba(56,189,248,.35)',transition:'width .5s ease' }} />
                          </div>
                        </div>
                        <span style={{ fontSize:12,fontFamily:'monospace',color:'#38bdf8',flexShrink:0,minWidth:54,textAlign:'right',textShadow:'0 0 10px #38bdf860' }}>
                          {ep[key]}<span style={{ fontSize:9.5,color:'rgba(255,255,255,.25)',marginLeft:3 }}>{unit}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </GlassPanel>
            ))}
          </div>
        )}
      </div>

      {showClear && <ClearDialog onConfirm={handleClear} onCancel={()=>setShowClear(false)} />}
    </>
  );
}