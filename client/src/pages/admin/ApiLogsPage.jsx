import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Activity, AlertTriangle, Clock, Trash2, Search,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  X, Radio, Globe, Zap, Shield, TrendingUp,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';
import api from '../../lib/api';
import { useSocket } from '../../context/SocketContext';
import { useTheme } from '../../context/ThemeContext';

// Method color palettes for dark + light
const MC = {
  GET:    { dark: { glow:'#38bdf8', text:'#7dd3fc', badge:'rgba(56,189,248,0.12)',  border:'rgba(56,189,248,0.3)'  }, light: { glow:'#0284c7', text:'#0369a1', badge:'rgba(2,132,199,0.09)',   border:'rgba(2,132,199,0.25)'   } },
  POST:   { dark: { glow:'#4ade80', text:'#86efac', badge:'rgba(74,222,128,0.12)',  border:'rgba(74,222,128,0.3)'  }, light: { glow:'#16a34a', text:'#15803d', badge:'rgba(22,163,74,0.09)',   border:'rgba(22,163,74,0.25)'   } },
  PUT:    { dark: { glow:'#fb923c', text:'#fdba74', badge:'rgba(251,146,60,0.12)',  border:'rgba(251,146,60,0.3)'  }, light: { glow:'#ea580c', text:'#c2410c', badge:'rgba(234,88,12,0.09)',   border:'rgba(234,88,12,0.25)'   } },
  DELETE: { dark: { glow:'#f87171', text:'#fca5a5', badge:'rgba(248,113,113,0.12)', border:'rgba(248,113,113,0.3)' }, light: { glow:'#dc2626', text:'#b91c1c', badge:'rgba(220,38,38,0.09)',  border:'rgba(220,38,38,0.25)'  } },
  PATCH:  { dark: { glow:'#c084fc', text:'#d8b4fe', badge:'rgba(192,132,252,0.12)', border:'rgba(192,132,252,0.3)' }, light: { glow:'#7c3aed', text:'#6d28d9', badge:'rgba(124,58,237,0.09)', border:'rgba(124,58,237,0.25)' } },
};

function getMC(method, isDark) {
  const base = MC[method];
  if (!base) return isDark
    ? { badge:'rgba(255,255,255,.07)', border:'rgba(255,255,255,.15)', text:'#94a3b8', glow:'transparent' }
    : { badge:'rgba(0,0,0,.05)', border:'rgba(0,0,0,.12)', text:'#64748b', glow:'transparent' };
  return isDark ? base.dark : base.light;
}

function statusGlow(c, isDark) {
  if (isDark) return c>=500?'#f87171':c>=400?'#fb923c':c>=300?'#fbbf24':'#4ade80';
  return c>=500?'#dc2626':c>=400?'#ea580c':c>=300?'#d97706':'#16a34a';
}
function statusBg(c, isDark) {
  if (isDark) return c>=500?'rgba(248,113,113,0.12)':c>=400?'rgba(251,146,60,0.12)':c>=300?'rgba(251,191,36,0.12)':'rgba(74,222,128,0.12)';
  return c>=500?'rgba(220,38,38,0.08)':c>=400?'rgba(234,88,12,0.08)':c>=300?'rgba(217,119,6,0.08)':'rgba(22,163,74,0.08)';
}
function rtGlow(ms, isDark) {
  if (isDark) return ms>1000?'#f87171':ms>500?'#fbbf24':'#4ade80';
  return ms>1000?'#dc2626':ms>500?'#d97706':'#16a34a';
}
function fmtHMS(ts)  { return new Date(ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'}); }
function fmtMD(ts)   { return new Date(ts).toLocaleDateString([],{month:'short',day:'numeric'}); }
function trunc(s,n=55){ return s?.length>n?s.slice(0,n)+'...':(s||''); }

const DATE_PRESETS = [
  { value:'live',   label:'Live'   },
  { value:'today',  label:'Today'  },
  { value:'7d',     label:'7 days' },
  { value:'30d',    label:'30 days'},
  { value:'custom', label:'Custom' },
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

// Dynamic injected CSS
function buildCSS(isDark) {
  const accent = isDark ? '#38bdf8' : '#0284c7';
  const scanFaint = isDark ? 'rgba(56,189,248,.025)' : 'rgba(2,132,199,.03)';
  const rowHoverBg = isDark ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.022)';
  const gridLine = isDark ? 'rgba(56,189,248,.03)' : 'rgba(2,132,199,.025)';
  return `
    @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap');
    @keyframes api-scan {
      0%   { transform:translateY(-100%); }
      100% { transform:translateY(500%); }
    }
    @keyframes api-blink {
      0%,100%{ opacity:1; transform:scale(1); }
      50%    { opacity:.4; transform:scale(.65); }
    }
    @keyframes api-fadein {
      from { opacity:0; transform:translateY(-6px); }
      to   { opacity:1; transform:translateY(0); }
    }
    @keyframes api-spin { to { transform:rotate(360deg); } }
    @keyframes api-countup {
      from { opacity:0; transform:translateY(8px) scale(.95); }
      to   { opacity:1; transform:translateY(0) scale(1); }
    }
    @keyframes api-sliderow {
      from { opacity:0; transform:translateX(-8px); }
      to   { opacity:1; transform:translateX(0); }
    }
    .api-scan-parent { position:relative; overflow:hidden; }
    .api-scan-parent::after {
      content:''; position:absolute; top:0; left:0; right:0; height:28%;
      background:linear-gradient(to bottom,transparent,${scanFaint} 50%,transparent);
      animation:api-scan 7s linear infinite; pointer-events:none;
    }
    .api-new-row   { animation:api-sliderow .28s cubic-bezier(.22,.68,0,1.2) forwards; }
    .api-stat-num  { animation:api-countup .4s cubic-bezier(.22,.68,0,1.2) forwards; }
    .api-live-dot  { animation:api-blink 1.2s ease-in-out infinite; }
    .api-row-hover { transition:background .12s; }
    .api-row-hover:hover { background:${rowHoverBg} !important; cursor:pointer; }
    .api-corner-tl,.api-corner-tr,.api-corner-bl,.api-corner-br { position:absolute; width:9px; height:9px; pointer-events:none; }
    .api-corner-tl { top:0; left:0; border-top:1.5px solid ${accent}; border-left:1.5px solid ${accent}; border-radius:2px 0 0 0; }
    .api-corner-tr { top:0; right:0; border-top:1.5px solid ${accent}; border-right:1.5px solid ${accent}; border-radius:0 2px 0 0; }
    .api-corner-bl { bottom:0; left:0; border-bottom:1.5px solid ${accent}; border-left:1.5px solid ${accent}; border-radius:0 0 0 2px; }
    .api-corner-br { bottom:0; right:0; border-bottom:1.5px solid ${accent}; border-right:1.5px solid ${accent}; border-radius:0 0 2px 0; }
    .api-grid-bg {
      background-image:
        linear-gradient(${gridLine} 1px, transparent 1px),
        linear-gradient(90deg, ${gridLine} 1px, transparent 1px);
      background-size: 32px 32px;
    }
    input[type=datetime-local].api-date::-webkit-calendar-picker-indicator { filter:${isDark?'invert(.5)':'none'}; }
    select.api-select option { background:${isDark?'#0f172a':'#f8fafc'}; color:${isDark?'#e2e8f0':'#1e293b'}; }
  `;
}

// Corner brackets decoration
function Corners() {
  return (
    <>
      <div className="api-corner-tl" />
      <div className="api-corner-tr" />
      <div className="api-corner-bl" />
      <div className="api-corner-br" />
    </>
  );
}

function MethodBadge({ method, isDark }) {
  const c = getMC(method, isDark);
  return (
    <span style={{
      background:c.badge, border:`1px solid ${c.border}`, color:c.text,
      padding:'2px 8px', borderRadius:3, fontSize:10, fontWeight:700,
      fontFamily:'Space Mono, monospace', letterSpacing:'.05em',
      textShadow: isDark ? `0 0 8px ${c.glow}80` : 'none',
      display:'inline-block',
    }}>{method}</span>
  );
}

function StatusBadge({ code, isDark }) {
  const col=statusGlow(code,isDark), bg=statusBg(code,isDark);
  return (
    <span style={{
      background:bg, border:`1px solid ${col}55`, color:col,
      padding:'2px 8px', borderRadius:3, fontSize:11, fontWeight:700,
      fontFamily:'Space Mono, monospace',
      textShadow: isDark ? `0 0 10px ${col}70` : 'none',
    }}>{code}</span>
  );
}

function GlassPanel({ children, style={}, className='' }) {
  const { isDark } = useTheme();
  return (
    <div className={`api-scan-parent ${className}`} style={{
      background: isDark ? 'rgba(255,255,255,.028)' : 'rgba(255,255,255,.75)',
      border: isDark ? '1px solid rgba(255,255,255,.07)' : '1px solid rgba(0,0,0,.075)',
      borderRadius: 10,
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
      boxShadow: isDark
        ? '0 2px 24px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.04)'
        : '0 2px 18px rgba(0,0,0,.055), inset 0 1px 0 rgba(255,255,255,.9)',
      position: 'relative',
      ...style,
    }}>
      <Corners />
      {children}
    </div>
  );
}

function StatCard({ label, value, color, icon:Icon, loading, isDark }) {
  const effectiveColor = isDark ? color
    : color === '#38bdf8' ? '#0284c7'
    : color === '#4ade80' ? '#16a34a'
    : color === '#f87171' ? '#dc2626'
    : color === '#fbbf24' ? '#d97706'
    : color;
  return (
    <GlassPanel style={{ padding:'20px 22px', flex:1, minWidth:130, overflow:'hidden' }}>
      <div style={{ position:'absolute', top:-28, right:-28, width:100, height:100, borderRadius:'50%',
        background:`radial-gradient(circle,${effectiveColor}${isDark?'18':'10'} 0%,transparent 70%)`, pointerEvents:'none' }} />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <span style={{ fontSize:9, fontWeight:700, letterSpacing:'.18em', textTransform:'uppercase',
          color: isDark ? 'rgba(255,255,255,.3)' : 'rgba(0,0,0,.38)', fontFamily:'Space Mono, monospace' }}>
          {label}
        </span>
        {Icon && <Icon size={12} style={{ color:`${effectiveColor}99` }} />}
      </div>
      <div key={String(value)} className="api-stat-num" style={{
        fontSize:30, fontWeight:800, color:effectiveColor,
        letterSpacing:'-.03em', lineHeight:1,
        fontFamily:'Space Mono, monospace',
        textShadow: isDark ? `0 0 24px ${color}55` : 'none',
      }}>
        {loading ? <span style={{ opacity:.2 }}>--</span> : value}
      </div>
    </GlassPanel>
  );
}

function ChartTip({ active, payload, label, isDark }) {
  if(!active||!payload?.length) return null;
  return (
    <div style={{
      background: isDark ? 'rgba(8,12,28,.96)' : 'rgba(255,255,255,.98)',
      border: isDark ? '1px solid rgba(56,189,248,.3)' : '1px solid rgba(2,132,199,.2)',
      borderRadius:6, padding:'8px 12px', fontSize:12,
      boxShadow: isDark ? '0 4px 20px rgba(0,0,0,.5)' : '0 4px 12px rgba(0,0,0,.1)',
      fontFamily:'DM Sans, sans-serif',
    }}>
      <div style={{ color: isDark ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.4)', marginBottom:2 }}>
        {label ? new Date(label).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : ''}
      </div>
      <div style={{ color:'#f87171', fontWeight:700 }}>{payload[0].value} errors</div>
    </div>
  );
}

function LogRow({ log, isNew, isDark }) {
  const [open, setOpen] = useState(false);
  const user = log.userId;
  const accent = isDark ? '#38bdf8' : '#0284c7';
  const textSub = isDark ? 'rgba(255,255,255,.3)' : 'rgba(0,0,0,.4)';
  const textMid = isDark ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.62)';
  const divider = isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.05)';

  return (
    <>
      <tr
        className={`api-row-hover${isNew?' api-new-row':''}`}
        onClick={() => setOpen(v=>!v)}
        style={{
          borderBottom:`1px solid ${divider}`,
          background: open ? (isDark ? 'rgba(56,189,248,.05)' : 'rgba(2,132,199,.04)') : 'transparent',
        }}
      >
        <td style={{ padding:'10px 6px 10px 16px', width:20 }}>
          {isNew && <div style={{ width:6,height:6,borderRadius:'50%',background:'#4ade80',boxShadow:'0 0 8px #4ade80',animation:'api-blink 1.5s ease-in-out 3' }} />}
        </td>
        <td style={{ padding:'10px 14px',whiteSpace:'nowrap',fontSize:11,color:textSub,fontFamily:'Space Mono, monospace' }}>
          <div>{fmtHMS(log.timestamp)}</div>
          <div style={{ fontSize:10,opacity:.6 }}>{fmtMD(log.timestamp)}</div>
        </td>
        <td style={{ padding:'10px 14px',whiteSpace:'nowrap' }}><MethodBadge method={log.method} isDark={isDark} /></td>
        <td style={{ padding:'10px 14px',maxWidth:280 }}>
          <span style={{ fontSize:12,fontFamily:'Space Mono, monospace',color:textMid,display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }} title={log.url}>{log.url}</span>
        </td>
        <td style={{ padding:'10px 14px',whiteSpace:'nowrap' }}><StatusBadge code={log.statusCode} isDark={isDark} /></td>
        <td style={{ padding:'10px 14px',whiteSpace:'nowrap',fontFamily:'Space Mono, monospace',fontSize:12,color:rtGlow(log.responseTime,isDark),textShadow: isDark ? `0 0 8px ${rtGlow(log.responseTime,true)}70` : 'none' }}>
          {log.responseTime}<span style={{ fontSize:9,opacity:.5,marginLeft:2 }}>ms</span>
        </td>
        <td style={{ padding:'10px 14px',whiteSpace:'nowrap',fontSize:11,color:textSub,fontFamily:'DM Sans, sans-serif' }}>
          {user?.name || <span style={{ color: isDark ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.2)' }}>—</span>}
        </td>
        <td style={{ padding:'10px 14px 10px 6px',textAlign:'right' }}>
          {open ? <ChevronUp size={11} style={{ color:accent }} /> : <ChevronDown size={11} style={{ color:textSub }} />}
        </td>
      </tr>
      {open && (
        <tr style={{ borderBottom:`1px solid ${divider}` }}>
          <td colSpan={8} style={{ padding:'0 14px 16px' }}>
            <div style={{
              background: isDark ? 'rgba(0,0,0,.35)' : 'rgba(248,250,252,.92)',
              border: isDark ? `1px solid rgba(56,189,248,.15)` : `1px solid rgba(2,132,199,.15)`,
              borderRadius:8, padding:16,
              display:'grid', gridTemplateColumns:'1fr 1fr', gap:14,
            }}>
              {[
                { label:'Full URL',   value:log.url,  mono:true },
                { label:'IP Address', value:log.ip||'—', mono:true },
              ].map(({label,value,mono})=>(
                <div key={label}>
                  <div style={{ fontSize:9,color:textSub,letterSpacing:'.14em',textTransform:'uppercase',marginBottom:5,fontFamily:'Space Mono, monospace' }}>{label}</div>
                  <div style={{ fontSize:12,fontFamily:mono?'Space Mono, monospace':'DM Sans, sans-serif',color: isDark ? 'rgba(255,255,255,.65)' : 'rgba(0,0,0,.7)',wordBreak:'break-all' }}>{value}</div>
                </div>
              ))}
              {log.userAgent && (
                <div style={{ gridColumn:'1/-1' }}>
                  <div style={{ fontSize:9,color:textSub,letterSpacing:'.14em',textTransform:'uppercase',marginBottom:5,fontFamily:'Space Mono, monospace' }}>User Agent</div>
                  <div style={{ fontSize:11,color: isDark ? 'rgba(255,255,255,.4)' : 'rgba(0,0,0,.5)',wordBreak:'break-all',fontFamily:'DM Sans, sans-serif' }}>{log.userAgent}</div>
                </div>
              )}
              {log.errorMessage && (
                <div style={{ gridColumn:'1/-1' }}>
                  <div style={{ fontSize:9,color:'#f87171',letterSpacing:'.14em',textTransform:'uppercase',marginBottom:5,fontFamily:'Space Mono, monospace' }}>Error</div>
                  <div style={{ fontSize:12,color: isDark ? '#fca5a5' : '#dc2626',fontFamily:'Space Mono, monospace' }}>{log.errorMessage}</div>
                </div>
              )}
              {log.requestBody && Object.keys(log.requestBody).length>0 && (
                <div style={{ gridColumn:'1/-1' }}>
                  <div style={{ fontSize:9,color:textSub,letterSpacing:'.14em',textTransform:'uppercase',marginBottom:5,fontFamily:'Space Mono, monospace' }}>Request Body</div>
                  <pre style={{ fontSize:11,fontFamily:'Space Mono, monospace',color: isDark ? '#7dd3fc' : '#0369a1',background: isDark ? 'rgba(0,0,0,.4)' : 'rgba(240,249,255,.85)',border: isDark ? '1px solid rgba(56,189,248,.15)' : '1px solid rgba(2,132,199,.15)',borderRadius:6,padding:10,overflowX:'auto',margin:0 }}>
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

function ClearDialog({ onConfirm, onCancel, isDark }) {
  const [days, setDays] = useState('7');
  const textSub = isDark ? 'rgba(255,255,255,.4)' : 'rgba(0,0,0,.5)';
  return (
    <div style={{ position:'fixed',inset:0,zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',
      background: isDark ? 'rgba(0,0,0,.72)' : 'rgba(0,0,0,.45)',backdropFilter:'blur(10px)' }}>
      <GlassPanel style={{ padding:28,width:360,border: isDark ? '1px solid rgba(248,113,113,.3)' : '1px solid rgba(220,38,38,.2)' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14 }}>
          <span style={{ fontSize:14,fontWeight:700,color: isDark ? '#f87171' : '#dc2626',fontFamily:'DM Sans, sans-serif' }}>Clear Old Logs</span>
          <button onClick={onCancel} style={{ background:'none',border:'none',cursor:'pointer',color:textSub }}><X size={14}/></button>
        </div>
        <p style={{ fontSize:13,color:textSub,marginBottom:16,fontFamily:'DM Sans, sans-serif' }}>Permanently delete logs older than:</p>
        <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:20 }}>
          <input type="number" min="1" max="365" value={days} onChange={e=>setDays(e.target.value)}
            style={{ width:72,padding:'6px 10px',borderRadius:6,fontSize:14,fontFamily:'Space Mono, monospace',
              background: isDark ? 'rgba(0,0,0,.45)' : 'rgba(255,255,255,.85)',
              border: isDark ? '1px solid rgba(248,113,113,.35)' : '1px solid rgba(220,38,38,.3)',
              color: isDark ? '#f87171' : '#dc2626',outline:'none' }} />
          <span style={{ fontSize:13,color:textSub,fontFamily:'DM Sans, sans-serif' }}>days</span>
        </div>
        <div style={{ display:'flex',justifyContent:'flex-end',gap:8 }}>
          <button onClick={onCancel} style={{ padding:'7px 16px',borderRadius:6,fontSize:12,fontFamily:'DM Sans, sans-serif',fontWeight:500,
            background:'transparent',border: isDark ? '1px solid rgba(255,255,255,.1)' : '1px solid rgba(0,0,0,.12)',
            color:textSub,cursor:'pointer' }}>Cancel</button>
          <button onClick={()=>onConfirm(parseInt(days,10))} style={{ padding:'7px 16px',borderRadius:6,fontSize:12,fontWeight:600,fontFamily:'DM Sans, sans-serif',
            background: isDark ? 'rgba(248,113,113,.15)' : 'rgba(220,38,38,.08)',
            border: isDark ? '1px solid rgba(248,113,113,.4)' : '1px solid rgba(220,38,38,.3)',
            color: isDark ? '#f87171' : '#dc2626',cursor:'pointer' }}>Delete</button>
        </div>
      </GlassPanel>
    </div>
  );
}

const MAX_LIVE = 200;

export default function ApiLogsPage() {
  const { socket, connected } = useSocket();
  const { isDark } = useTheme();

  const accent       = isDark ? '#38bdf8' : '#0284c7';
  const accentFaint  = isDark ? 'rgba(56,189,248,.13)' : 'rgba(2,132,199,.09)';
  const accentBorder = isDark ? 'rgba(56,189,248,.38)' : 'rgba(2,132,199,.28)';
  const textPrimary  = isDark ? 'rgba(255,255,255,.9)'  : 'rgba(0,0,0,.85)';
  const textSub      = isDark ? 'rgba(255,255,255,.3)'  : 'rgba(0,0,0,.38)';
  const textMid      = isDark ? 'rgba(255,255,255,.52)' : 'rgba(0,0,0,.56)';
  const divider      = isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)';
  const inputBg      = isDark ? 'rgba(0,0,0,.28)'       : 'rgba(255,255,255,.72)';
  const inputBorder  = isDark ? 'rgba(255,255,255,.09)' : 'rgba(0,0,0,.1)';
  const tHeadBg      = isDark ? 'rgba(0,0,0,.2)'        : 'rgba(248,250,252,.92)';
  const selectBg     = isDark ? 'rgba(0,0,0,.35)'       : 'rgba(255,255,255,.82)';

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

  useEffect(() => {
    if (!socket) return;
    const handler = (log) => {
      if (livePaused) return;
      setLiveBuffer(prev => [log, ...prev].slice(0, MAX_LIVE));
      setNewIds(prev => { const s=new Set(prev); s.add(log._id); return s; });
      setTimeout(() => setNewIds(prev => { const s=new Set(prev); s.delete(log._id); return s; }), 3000);
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

  useEffect(() => { const id=setInterval(fetchStats,30000); return ()=>clearInterval(id); }, [fetchStats]);

  const handlePageChange = (p) => { setPage(p); fetchLogs(p); };

  const handleClear = async (days) => {
    setShowClear(false);
    try {
      const {data} = await api.delete('/logs',{params:{days}});
      flash(data.message);
      setLiveBuffer([]); fetchStats();
      if(!isLive) fetchLogs(1);
    } catch(err) { flash(err.response?.data?.message||'Failed','error'); }
  };

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

  return (
    <>
      <style>{buildCSS(isDark)}</style>

      {/* ambient bg */}
      <div style={{ position:'fixed',inset:0,pointerEvents:'none',zIndex:0 }}>
        <div style={{ position:'absolute',inset:0,
          background: isDark
            ? 'radial-gradient(ellipse 90% 50% at 50% -5%,rgba(56,189,248,.058) 0%,transparent 65%)'
            : 'radial-gradient(ellipse 90% 50% at 50% -5%,rgba(2,132,199,.045) 0%,transparent 65%)',
        }} />
        <div className="api-grid-bg" style={{ position:'absolute',inset:0,opacity: isDark ? 1 : .5 }} />
      </div>

      <div style={{ position:'relative',zIndex:1,display:'flex',flexDirection:'column',gap:16 }}>

        {/* Toast */}
        {toast && (
          <div style={{ position:'fixed',top:20,right:20,zIndex:200,animation:'api-fadein .2s ease',
            background: toast.type==='error'
              ? (isDark?'rgba(248,113,113,.14)':'rgba(220,38,38,.08)')
              : (isDark?'rgba(74,222,128,.14)':'rgba(22,163,74,.08)'),
            border:`1px solid ${toast.type==='error'?(isDark?'rgba(248,113,113,.4)':'rgba(220,38,38,.3)'):(isDark?'rgba(74,222,128,.4)':'rgba(22,163,74,.3)')}`,
            color: toast.type==='error'?(isDark?'#fca5a5':'#dc2626'):(isDark?'#86efac':'#16a34a'),
            padding:'10px 20px',borderRadius:8,fontSize:13,fontWeight:500,backdropFilter:'blur(12px)',
            fontFamily:'DM Sans, sans-serif',
            boxShadow: isDark ? '0 4px 20px rgba(0,0,0,.4)' : '0 4px 14px rgba(0,0,0,.1)',
          }}>
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:12 }}>
          <div>
            <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:5 }}>
              <div style={{ width:20,height:1,background:accent,opacity:.6 }} />
              <span style={{ fontSize:9,fontWeight:700,letterSpacing:'.2em',textTransform:'uppercase',color:accent,fontFamily:'Space Mono, monospace',opacity:.75 }}>
                System Telemetry
              </span>
            </div>
            <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:4 }}>
              <h1 style={{ fontSize:24,fontWeight:800,color:textPrimary,letterSpacing:'-.04em',margin:0,fontFamily:'DM Sans, sans-serif' }}>
                API <span style={{ color:accent,textShadow: isDark ? `0 0 28px ${accent}55` : 'none' }}>Monitor</span>
              </h1>
              <div style={{ display:'flex',alignItems:'center',gap:5,padding:'3px 10px',borderRadius:20,fontSize:9,fontWeight:700,
                background:connected?(isDark?'rgba(74,222,128,.1)':'rgba(22,163,74,.08)'):(isDark?'rgba(248,113,113,.1)':'rgba(220,38,38,.08)'),
                border:`1px solid ${connected?(isDark?'rgba(74,222,128,.3)':'rgba(22,163,74,.25)'):(isDark?'rgba(248,113,113,.3)':'rgba(220,38,38,.25)')}`,
                color:connected?(isDark?'#4ade80':'#16a34a'):(isDark?'#f87171':'#dc2626'),
                letterSpacing:'.1em',fontFamily:'Space Mono, monospace',
              }}>
                <div className="api-live-dot" style={{ width:5,height:5,borderRadius:'50%',
                  background:connected?(isDark?'#4ade80':'#16a34a'):(isDark?'#f87171':'#dc2626') }} />
                {connected?'LIVE':'OFFLINE'}
              </div>
            </div>
            <p style={{ fontSize:11.5,color:textSub,margin:0,fontFamily:'DM Sans, sans-serif' }}>Real-time HTTP request telemetry &amp; performance analysis</p>
          </div>

          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            {isLive && (
              <button onClick={()=>setLivePaused(v=>!v)} style={{
                display:'flex',alignItems:'center',gap:6,padding:'8px 16px',borderRadius:7,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'DM Sans, sans-serif',transition:'all .15s',
                background:livePaused?(isDark?'rgba(251,191,36,.1)':'rgba(217,119,6,.08)'):(isDark?'rgba(74,222,128,.1)':'rgba(22,163,74,.08)'),
                border:`1px solid ${livePaused?(isDark?'rgba(251,191,36,.3)':'rgba(217,119,6,.25)'):(isDark?'rgba(74,222,128,.3)':'rgba(22,163,74,.25)')}`,
                color:livePaused?(isDark?'#fbbf24':'#d97706'):(isDark?'#4ade80':'#16a34a'),
              }}>
                <Radio size={12} />{livePaused?'Resume':'Pause'}
              </button>
            )}
            <button onClick={()=>setShowClear(true)} style={{
              display:'flex',alignItems:'center',gap:6,padding:'8px 16px',borderRadius:7,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'DM Sans, sans-serif',transition:'all .15s',
              background: isDark?'rgba(248,113,113,.08)':'rgba(220,38,38,.06)',
              border: isDark?'1px solid rgba(248,113,113,.22)':'1px solid rgba(220,38,38,.2)',
              color: isDark?'#f87171':'#dc2626',
            }}>
              <Trash2 size={12} />Clear logs
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display:'flex',gap:12,flexWrap:'wrap' }}>
          <StatCard label="Requests today" value={(stats?.totalToday??0).toLocaleString()} color="#38bdf8" icon={Activity} loading={statsLoading} isDark={isDark} />
          <StatCard label="Error rate"     value={`${stats?.errorRate??0}%`} color={(stats?.errorRate??0)>5?'#f87171':'#4ade80'} icon={Shield} loading={statsLoading} isDark={isDark} />
          <StatCard label="Avg latency"    value={`${stats?.avgResponseTime??0}ms`} color={(stats?.avgResponseTime??0)>500?'#fbbf24':'#4ade80'} icon={Zap} loading={statsLoading} isDark={isDark} />

          {/* Error chart */}
          <GlassPanel style={{ flex:2,minWidth:200,padding:'16px 20px' }}>
            <div style={{ fontSize:9,fontWeight:700,letterSpacing:'.18em',textTransform:'uppercase',color:textSub,marginBottom:10,fontFamily:'Space Mono, monospace',display:'flex',alignItems:'center',gap:6 }}>
              <TrendingUp size={9} style={{ color: isDark?'#f87171':'#dc2626' }} />
              Errors / 24h
            </div>
            <ResponsiveContainer width="100%" height={50}>
              <AreaChart data={chartData} margin={{top:2,right:2,bottom:0,left:-30}}>
                <defs>
                  <linearGradient id="eGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f87171" stopOpacity={isDark?.35:.2}/>
                    <stop offset="95%" stopColor="#f87171" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour" hide />
                <YAxis hide />
                <Tooltip content={(p)=><ChartTip {...p} isDark={isDark} />} />
                <Area type="monotone" dataKey="errors" stroke="#f87171" strokeWidth={1.5} fill="url(#eGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </GlassPanel>

          {isLive && (
            <GlassPanel style={{ flex:2,minWidth:200,padding:'16px 20px' }}>
              <div style={{ fontSize:9,fontWeight:700,letterSpacing:'.18em',textTransform:'uppercase',color:textSub,marginBottom:10,fontFamily:'Space Mono, monospace',display:'flex',alignItems:'center',gap:6 }}>
                <div className="api-live-dot" style={{ width:5,height:5,borderRadius:'50%',background: isDark?'#4ade80':'#16a34a' }} />
                Throughput (5s)
              </div>
              <ResponsiveContainer width="100%" height={50}>
                <LineChart data={rateData} margin={{top:2,right:2,bottom:0,left:-30}}>
                  <XAxis dataKey="t" hide />
                  <YAxis hide />
                  <Line type="monotone" dataKey="rps" stroke={accent} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </GlassPanel>
          )}
        </div>

        {/* Filters */}
        <GlassPanel style={{ padding:'12px 16px',display:'flex',flexWrap:'wrap',gap:10,alignItems:'center' }}>
          {/* Date presets */}
          <div style={{ display:'flex',gap:3 }}>
            {DATE_PRESETS.map(d=>{
              const act=datePreset===d.value;
              return (
                <button key={d.value} onClick={()=>{setDatePreset(d.value);setPage(1);}} style={{
                  padding:'5px 12px',borderRadius:5,fontSize:11,fontWeight:600,cursor:'pointer',transition:'all .12s',fontFamily:'DM Sans, sans-serif',
                  background:act?accentFaint:'transparent',
                  border:act?`1px solid ${accentBorder}`:`1px solid ${divider}`,
                  color:act?accent:textSub,
                  textShadow: act&&isDark ? `0 0 14px ${accent}80` : 'none',
                }}>
                  {d.value==='live' && (
                    <span style={{ display:'inline-flex',alignItems:'center',gap:5 }}>
                      {act && <span className="api-live-dot" style={{ display:'inline-block',width:5,height:5,borderRadius:'50%',background:accent,verticalAlign:'middle' }} />}
                      {d.label}
                    </span>
                  )}
                  {d.value!=='live' && d.label}
                </button>
              );
            })}
          </div>

          <div style={{ width:1,height:18,background:divider,flexShrink:0 }} />

          {/* Method pills */}
          <div style={{ display:'flex',gap:3,flexWrap:'wrap' }}>
            {['','GET','POST','PUT','DELETE','PATCH'].map(m=>{
              const mc=m?getMC(m,isDark):null, act=method===m;
              return (
                <button key={m} onClick={()=>setMethod(m)} style={{
                  padding:'4px 10px',borderRadius:4,fontSize:10,fontWeight:700,fontFamily:'Space Mono, monospace',letterSpacing:'.05em',cursor:'pointer',transition:'all .12s',
                  background:act&&mc?mc.badge:act?(isDark?'rgba(255,255,255,.08)':'rgba(0,0,0,.06)'):'transparent',
                  border:act&&mc?`1px solid ${mc.border}`:act?`1px solid ${isDark?'rgba(255,255,255,.2)':'rgba(0,0,0,.18)'}`:`1px solid ${divider}`,
                  color:act&&mc?mc.text:act?(isDark?'#fff':'#111'):textSub,
                }}>{m||'ALL'}</button>
              );
            })}
          </div>

          <div style={{ width:1,height:18,background:divider,flexShrink:0 }} />

          {/* Status select */}
          <select value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}
            className="api-select"
            style={{ padding:'5px 10px',borderRadius:5,fontSize:11,background:selectBg,border:`1px solid ${inputBorder}`,color:textMid,outline:'none',cursor:'pointer',fontFamily:'DM Sans, sans-serif' }}>
            {STATUS_OPTS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          {/* URL search */}
          <div style={{ display:'flex',alignItems:'center',gap:6,background:inputBg,border:`1px solid ${inputBorder}`,borderRadius:5,padding:'5px 10px',flex:1,minWidth:150 }}>
            <Search size={10} style={{ color:textSub,flexShrink:0 }} />
            <input type="text" placeholder="Filter endpoint..." value={urlSearch} onChange={e=>{setUrlSearch(e.target.value);setPage(1);}}
              style={{ background:'none',border:'none',outline:'none',fontSize:12,color:textMid,width:'100%',fontFamily:'Space Mono, monospace' }} />
            {urlSearch && <button onClick={()=>setUrlSearch('')} style={{ background:'none',border:'none',cursor:'pointer',color:textSub,padding:0 }}><X size={10}/></button>}
          </div>

          {/* Custom date pickers */}
          {datePreset==='custom' && (
            <div style={{ display:'flex',alignItems:'center',gap:8 }}>
              {[{v:customFrom,s:setCustomFrom,l:'From'},{v:customTo,s:setCustomTo,l:'To'}].map(({v,s,l})=>(
                <React.Fragment key={l}>
                  <span style={{ fontSize:10,color:textSub,fontFamily:'Space Mono, monospace' }}>{l}</span>
                  <input type="datetime-local" value={v} onChange={e=>s(e.target.value)}
                    className="api-date"
                    style={{ padding:'4px 8px',borderRadius:5,fontSize:11,background:selectBg,border:`1px solid ${inputBorder}`,color:textMid,outline:'none',fontFamily:'DM Sans, sans-serif' }} />
                </React.Fragment>
              ))}
            </div>
          )}

          {isLive && (
            <div style={{ marginLeft:'auto',display:'flex',alignItems:'center',gap:6,fontSize:11,color:textSub,fontFamily:'Space Mono, monospace' }}>
              <div className="api-live-dot" style={{ width:5,height:5,borderRadius:'50%',background:livePaused?(isDark?'#fbbf24':'#d97706'):(isDark?'#4ade80':'#16a34a') }} />
              {displayedLive.length}/{MAX_LIVE}
            </div>
          )}
        </GlassPanel>

        {/* Table */}
        <GlassPanel style={{ overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%',borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:`1px solid ${divider}` }}>
                  {['','Time','Method','Endpoint','Status','Latency','User',''].map((h,i)=>(
                    <th key={i} style={{
                      padding: i===0?'11px 6px 11px 16px':i===7?'11px 16px 11px 6px':'11px 14px',
                      textAlign:'left',fontSize:9,fontWeight:700,letterSpacing:'.18em',textTransform:'uppercase',
                      color:textSub,whiteSpace:'nowrap',background:tHeadBg,fontFamily:'Space Mono, monospace',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && !isLive ? (
                  <tr><td colSpan={8} style={{ textAlign:'center',padding:64 }}>
                    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:12 }}>
                      <div style={{ width:28,height:28,border:`2px solid ${accentFaint}`,borderTopColor:accent,borderRadius:'50%',animation:'api-spin .8s linear infinite' }} />
                      <span style={{ fontSize:12,color:textSub,fontFamily:'Space Mono, monospace' }}>Loading telemetry...</span>
                    </div>
                  </td></tr>
                ) : rows.length===0 ? (
                  <tr><td colSpan={8} style={{ textAlign:'center',padding:72 }}>
                    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:10 }}>
                      <Globe size={28} style={{ color: isDark?'rgba(255,255,255,.1)':'rgba(0,0,0,.14)' }} />
                      <span style={{ fontSize:13,color:textSub,fontFamily:'DM Sans, sans-serif' }}>
                        {isLive?'Waiting for incoming requests...':'No logs match your filters'}
                      </span>
                    </div>
                  </td></tr>
                ) : (
                  rows.map(log=><LogRow key={log._id} log={log} isNew={newIds.has(log._id)} isDark={isDark} />)
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!isLive && pagination && pagination.pages>1 && (
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 18px',borderTop:`1px solid ${divider}` }}>
              <span style={{ fontSize:11,color:textSub,fontFamily:'Space Mono, monospace' }}>
                {((pagination.page-1)*pagination.limit)+1}&ndash;{Math.min(pagination.page*pagination.limit,pagination.total)} of {pagination.total.toLocaleString()}
              </span>
              <div style={{ display:'flex',gap:4 }}>
                {[
                  { label:<ChevronLeft size={12}/>, p:page-1, dis:page<=1 },
                  ...Array.from({length:Math.min(5,pagination.pages)},(_,i)=>{ const p=Math.max(1,Math.min(pagination.pages-4,page-2))+i; return {label:p,p,isCur:p===page}; }),
                  { label:<ChevronRight size={12}/>, p:page+1, dis:page>=pagination.pages },
                ].map((btn,i)=>(
                  <button key={i} onClick={()=>!btn.dis&&handlePageChange(btn.p)} disabled={btn.dis} style={{
                    minWidth:28,height:28,padding:'0 6px',borderRadius:5,fontSize:11,fontFamily:'Space Mono, monospace',cursor:btn.dis?'default':'pointer',
                    background:btn.isCur?accentFaint:(isDark?'rgba(255,255,255,.04)':'rgba(0,0,0,.03)'),
                    border:btn.isCur?`1px solid ${accentBorder}`:`1px solid ${divider}`,
                    color:btn.isCur?accent:btn.dis?(isDark?'rgba(255,255,255,.12)':'rgba(0,0,0,.2)'):(isDark?'rgba(255,255,255,.35)':'rgba(0,0,0,.42)'),
                    display:'flex',alignItems:'center',justifyContent:'center',transition:'all .12s',
                  }}>{btn.label}</button>
                ))}
              </div>
            </div>
          )}
        </GlassPanel>

        {/* Analytics */}
        {stats && (
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
            {[
              { title:'Slowest Endpoints',     emoji:'⚡', data:stats.slowestEndpoints, key:'avgTime', unit:'ms'  },
              { title:'Most Called Endpoints',  emoji:'🔥', data:stats.topEndpoints,    key:'count',   unit:'req' },
            ].map(({title,emoji,data,key,unit})=>(
              <GlassPanel key={title} style={{ padding:'20px 22px' }}>
                <div style={{ fontSize:9,fontWeight:700,letterSpacing:'.18em',textTransform:'uppercase',color:textSub,marginBottom:16,fontFamily:'Space Mono, monospace',display:'flex',alignItems:'center',gap:7 }}>
                  <span>{emoji}</span>{title}
                </div>
                <div style={{ display:'flex',flexDirection:'column',gap:13 }}>
                  {!data?.length && <span style={{ fontSize:12,color:textSub,fontFamily:'DM Sans, sans-serif' }}>No data yet</span>}
                  {data?.map((ep,i)=>{
                    const maxVal=data[0]?.[key]||1, pct=Math.round((ep[key]/maxVal)*100);
                    return (
                      <div key={i} style={{ display:'flex',alignItems:'center',gap:10 }}>
                        <MethodBadge method={ep.method} isDark={isDark} />
                        <div style={{ flex:1,overflow:'hidden' }}>
                          <div style={{ fontSize:11,fontFamily:'Space Mono, monospace',color:textMid,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:5 }} title={ep.url}>{trunc(ep.url,42)}</div>
                          <div style={{ height:2,borderRadius:2,background: isDark?'rgba(255,255,255,.06)':'rgba(0,0,0,.06)' }}>
                            <div style={{ height:'100%',borderRadius:2,width:`${pct}%`,
                              background:i===0?accent:(isDark?`${accent}50`:`${accent}40`),transition:'width .5s ease' }} />
                          </div>
                        </div>
                        <span style={{ fontSize:12,fontFamily:'Space Mono, monospace',color:accent,flexShrink:0,minWidth:54,textAlign:'right',
                          textShadow: isDark?`0 0 10px ${accent}55`:'none' }}>
                          {ep[key]}<span style={{ fontSize:9,color:textSub,marginLeft:3 }}>{unit}</span>
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

      {showClear && <ClearDialog onConfirm={handleClear} onCancel={()=>setShowClear(false)} isDark={isDark} />}
    </>
  );
}