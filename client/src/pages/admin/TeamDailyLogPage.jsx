import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2,
  Clock, X, ClipboardList, BarChart2, Building2,
  CalendarDays, ExternalLink, ArrowLeft, TrendingUp,
  Users, Flame,
} from 'lucide-react';
import api from '../../lib/api';
import { getInitials } from '../../lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayStr() { return localDateStr(new Date()); }

function parseLocalDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function friendlyDate(str) {
  const today = todayStr();
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yesterday = localDateStr(d);
  if (str === today) return 'Today';
  if (str === yesterday) return 'Yesterday';
  return parseLocalDate(str).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function fullDate(str) {
  return parseLocalDate(str).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_META = {
  completed:    { label: 'Completed',    color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  in_progress:  { label: 'In Progress',  color: '#4f6ef0', bg: 'rgba(79,110,240,0.1)' },
  carried_over: { label: 'Carried Over', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
};

const CATEGORY_LABELS = {
  paid_ads: '📊 Paid Ads', social_media: '📱 Social', video_editing: '🎬 Video',
  graphic_design: '🎨 Design', copywriting: '✍️ Copy', reporting: '📋 Reports',
  strategy: '🧠 Strategy', meetings: '🤝 Meetings', other: '📌 Other',
};

const ROLE_LABELS = {
  manager: 'Project Manager', performance_marketer: 'Performance Marketer',
  social_media_manager: 'Social Media', video_editor: 'Video Editor',
  graphic_designer: 'Graphic Designer', copywriter: 'Copywriter',
};

const ROLE_COLORS = {
  manager: '#8b5cf6', performance_marketer: '#f59e0b',
  social_media_manager: '#ec4899', video_editor: '#ef4444',
  graphic_designer: '#06b6d4', copywriter: '#22c55e',
};

// ── Mini Calendar Picker ──────────────────────────────────────────────────────

function CalendarPicker({ value, onChange, onClose, anchorRef }) {
  const [view, setView] = useState(() => {
    const d = parseLocalDate(value);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const today = new Date();
  const todayLocal = localDateStr(today);

  const firstDay = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();

  const prevMonth = () => {
    setView(v => {
      if (v.month === 0) return { year: v.year - 1, month: 11 };
      return { year: v.year, month: v.month - 1 };
    });
  };
  const nextMonth = () => {
    setView(v => {
      if (v.month === 11) return { year: v.year + 1, month: 0 };
      return { year: v.year, month: v.month + 1 };
    });
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthName = new Date(view.year, view.month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute rounded-2xl shadow-xl overflow-hidden"
        style={{
          top: anchorRef.current ? anchorRef.current.getBoundingClientRect().bottom + 8 : '50%',
          left: anchorRef.current ? Math.max(8, anchorRef.current.getBoundingClientRect().right - 260) : '50%',
          width: 260,
          background: 'var(--fd-surface)',
          border: '1px solid var(--fd-border)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Month nav */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--fd-border)' }}>
          <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-[var(--fd-canvas)] transition-colors">
            <ChevronLeft size={14} style={{ color: 'var(--fd-ink-3)' }} />
          </button>
          <span className="text-[12px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>{monthName}</span>
          <button
            onClick={nextMonth}
            disabled={view.year === today.getFullYear() && view.month === today.getMonth()}
            className="p-1 rounded-lg hover:bg-[var(--fd-canvas)] transition-colors disabled:opacity-30"
          >
            <ChevronRight size={14} style={{ color: 'var(--fd-ink-3)' }} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 px-2 pt-2">
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <div key={i} className="text-center text-[10px] font-semibold py-1" style={{ color: 'var(--fd-ink-5)' }}>{d}</div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7 gap-0 px-2 pb-3">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const dateStr = `${view.year}-${String(view.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isSelected = dateStr === value;
            const isToday = dateStr === todayLocal;
            const isFuture = dateStr > todayLocal;
            return (
              <button
                key={i}
                disabled={isFuture}
                onClick={() => { onChange(dateStr); onClose(); }}
                className="aspect-square flex items-center justify-center text-[12px] rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: isSelected ? '#4f6ef0' : 'transparent',
                  color: isSelected ? '#fff' : isToday ? '#4f6ef0' : 'var(--fd-ink-2)',
                  fontWeight: isToday || isSelected ? '700' : '400',
                }}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </div>
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
        setLogs(r.data.logs || []);
        // auto-expand the first (most recent) log
        if (r.data.logs?.length > 0) setExpanded(r.data.logs[0]._id);
      })
      .finally(() => setLoading(false));
  }, [member._id]);

  const totalHoursAll = logs.reduce((s, l) => s + (l.entries || []).reduce((ss, e) => ss + (parseFloat(e.hoursSpent) || 0), 0), 0);
  const submittedCount = logs.filter(l => l.isSubmitted).length;

  const roleColor = ROLE_COLORS[member.role] || '#4f6ef0';

  return (
    <div>
      {/* Back header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-3)' }}
        >
          <ArrowLeft size={13} /> Back to Team
        </button>
        <div className="text-[12px]" style={{ color: 'var(--fd-ink-4)' }}>Daily Log History</div>
      </div>

      {/* Member hero card */}
      <div
        className="rounded-2xl p-5 mb-6 flex items-center gap-4"
        style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-[16px] font-bold flex-shrink-0 overflow-hidden"
          style={{ background: roleColor }}
        >
          {member.avatar
            ? <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
            : getInitials(member.name)
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[16px] font-bold" style={{ color: 'var(--fd-ink-1)' }}>{member.name}</div>
          <div className="text-[12px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>{ROLE_LABELS[member.role] || member.role}</div>
        </div>
        {/* Summary stats */}
        <div className="flex gap-4 text-center">
          <div>
            <div className="text-[18px] font-bold" style={{ color: '#4f6ef0' }}>{logs.length}</div>
            <div className="text-[10px]" style={{ color: 'var(--fd-ink-4)' }}>Days logged</div>
          </div>
          <div>
            <div className="text-[18px] font-bold" style={{ color: '#22c55e' }}>{submittedCount}</div>
            <div className="text-[10px]" style={{ color: 'var(--fd-ink-4)' }}>Submitted</div>
          </div>
          {totalHoursAll > 0 && (
            <div>
              <div className="text-[18px] font-bold" style={{ color: roleColor }}>{totalHoursAll}h</div>
              <div className="text-[10px]" style={{ color: 'var(--fd-ink-4)' }}>Total hours</div>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-[#4f6ef0] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && logs.length === 0 && (
        <div className="text-center py-16">
          <div className="text-[40px] mb-3">📭</div>
          <div className="text-[14px] font-medium" style={{ color: 'var(--fd-ink-2)' }}>No logs yet</div>
          <div className="text-[12px] mt-1" style={{ color: 'var(--fd-ink-4)' }}>{member.name} hasn't submitted any daily logs.</div>
        </div>
      )}

      {/* Log timeline */}
      <div className="space-y-3">
        {logs.map(log => {
          const isOpen = expanded === log._id;
          const totalHours = (log.entries || []).reduce((s, e) => s + (parseFloat(e.hoursSpent) || 0), 0);
          const completedCount = (log.entries || []).filter(e => e.status === 'completed').length;
          const hasBlocker = log.blockers?.trim();
          const d = parseLocalDate(log.date);
          const dayName = d.toLocaleDateString('en-IN', { weekday: 'long' });
          const dayDate = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

          return (
            <div
              key={log._id}
              className="rounded-2xl overflow-hidden transition-all"
              style={{
                border: `1px solid ${hasBlocker ? 'rgba(239,68,68,0.25)' : isOpen ? 'rgba(79,110,240,0.25)' : 'var(--fd-border)'}`,
                background: 'var(--fd-surface)',
              }}
            >
              {/* Row header — always visible */}
              <button
                onClick={() => setExpanded(isOpen ? null : log._id)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[var(--fd-canvas)] transition-colors"
              >
                {/* Date block */}
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex flex-col items-center justify-center"
                  style={{ background: isOpen ? 'rgba(79,110,240,0.12)' : 'var(--fd-canvas)' }}
                >
                  <div className="text-[15px] font-bold leading-none" style={{ color: isOpen ? '#4f6ef0' : 'var(--fd-ink-1)' }}>
                    {d.getDate()}
                  </div>
                  <div className="text-[9px] font-semibold uppercase" style={{ color: isOpen ? '#4f6ef0' : 'var(--fd-ink-4)' }}>
                    {d.toLocaleDateString('en-IN', { month: 'short' })}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>{dayName}</span>
                    <span className="text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>{dayDate}</span>
                  </div>
                  {/* Mini summary */}
                  {log.entries?.length > 0 ? (
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-[11px]" style={{ color: 'var(--fd-ink-3)' }}>
                        {log.entries.length} task{log.entries.length !== 1 ? 's' : ''}
                      </span>
                      {completedCount > 0 && <span className="text-[11px]" style={{ color: '#22c55e' }}>{completedCount} done</span>}
                      {totalHours > 0 && <span className="text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>{totalHours}h</span>}
                      {hasBlocker && <span className="text-[11px]" style={{ color: '#ef4444' }}>⚠ Blocker</span>}
                    </div>
                  ) : (
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--fd-ink-5)' }}>No entries</div>
                  )}
                </div>

                {/* Right: status + chevron */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {log.isSubmitted ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
                      Submitted
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                      Draft
                    </span>
                  )}
                  <ChevronLeft
                    size={13}
                    style={{
                      color: 'var(--fd-ink-4)',
                      transform: isOpen ? 'rotate(-90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}
                  />
                </div>
              </button>

              {/* Expanded entries */}
              {isOpen && (
                <div className="px-5 pb-5" style={{ borderTop: '1px solid var(--fd-border)' }}>
                  {log.entries?.length === 0 ? (
                    <div className="py-4 text-center text-[12px]" style={{ color: 'var(--fd-ink-4)' }}>No tasks logged this day.</div>
                  ) : (
                    <div className="pt-4 space-y-3">
                      {log.entries.map((entry, i) => (
                        <div
                          key={i}
                          className="flex gap-3"
                        >
                          {/* Status dot + line */}
                          <div className="flex flex-col items-center">
                            <div
                              className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                              style={{ background: STATUS_META[entry.status]?.color || '#ccc' }}
                            />
                            {i < log.entries.length - 1 && (
                              <div className="w-px flex-1 mt-1" style={{ background: 'var(--fd-border)' }} />
                            )}
                          </div>

                          <div className="flex-1 pb-3">
                            <div className="text-[13px]" style={{ color: 'var(--fd-ink-1)' }}>{entry.description}</div>
                            <div className="flex gap-2 mt-1.5 flex-wrap">
                              <span
                                className="text-[10px] px-2 py-0.5 rounded font-medium"
                                style={{ background: STATUS_META[entry.status]?.bg, color: STATUS_META[entry.status]?.color }}
                              >
                                {STATUS_META[entry.status]?.label}
                              </span>
                              {entry.category && entry.category !== 'other' && (
                                <span className="text-[10px]" style={{ color: 'var(--fd-ink-4)' }}>{CATEGORY_LABELS[entry.category]}</span>
                              )}
                              {entry.client?.name && (
                                <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--fd-ink-4)' }}>
                                  <Building2 size={9} /> {entry.client.name}
                                </span>
                              )}
                              {entry.hoursSpent && (
                                <span className="text-[10px]" style={{ color: 'var(--fd-ink-4)' }}>{entry.hoursSpent}h</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Blocker */}
                  {hasBlocker && (
                    <div
                      className="mt-3 p-3 rounded-xl"
                      style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <AlertTriangle size={11} style={{ color: '#ef4444' }} />
                        <div className="text-[10px] font-semibold" style={{ color: '#ef4444' }}>Blocker</div>
                      </div>
                      <div className="text-[12px]" style={{ color: 'var(--fd-ink-2)' }}>{log.blockers}</div>
                    </div>
                  )}

                  {/* Submit time */}
                  {log.isSubmitted && log.submittedAt && (
                    <div className="mt-3 text-[10px]" style={{ color: 'var(--fd-ink-5)' }}>
                      Submitted at {new Date(log.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Day Log Modal (single day quick view) ─────────────────────────────────────

function DayLogModal({ item, date, onClose, onViewHistory }) {
  const { member, log } = item;
  const roleColor = ROLE_COLORS[member.role] || '#4f6ef0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[3px]" onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-2xl flex flex-col overflow-hidden"
        style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)', maxHeight: '85vh' }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ borderBottom: '1px solid var(--fd-border)', flexShrink: 0 }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0 overflow-hidden"
            style={{ background: roleColor }}
          >
            {member.avatar
              ? <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
              : getInitials(member.name)
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-bold truncate" style={{ color: 'var(--fd-ink-1)' }}>{member.name}</div>
            <div className="text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>
              {ROLE_LABELS[member.role] || member.role} · {friendlyDate(date)}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--fd-canvas)] transition-colors">
            <X size={14} style={{ color: 'var(--fd-ink-3)' }} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {!log ? (
            <div className="text-center py-10">
              <div className="text-[40px] mb-3">📭</div>
              <div className="text-[14px] font-medium" style={{ color: 'var(--fd-ink-2)' }}>No log for {friendlyDate(date)}</div>
              <div className="text-[12px] mt-1" style={{ color: 'var(--fd-ink-4)' }}>{member.name} hasn't logged anything for this day.</div>
            </div>
          ) : (
            <>
              {/* Status bar */}
              <div className="flex items-center gap-2 mb-5 flex-wrap">
                {log.isSubmitted ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
                    <CheckCircle2 size={11} /> Submitted
                    {log.submittedAt && ` · ${new Date(log.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                    <Clock size={11} /> Draft — not submitted yet
                  </span>
                )}
                {log.entries?.length > 0 && (() => {
                  const hrs = log.entries.reduce((s, e) => s + (parseFloat(e.hoursSpent) || 0), 0);
                  return hrs > 0 ? <span className="text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>{hrs}h logged</span> : null;
                })()}
              </div>

              {/* Task list */}
              {(log.entries || []).length === 0 ? (
                <div className="text-center py-6 text-[12px]" style={{ color: 'var(--fd-ink-4)' }}>No tasks in this log.</div>
              ) : (
                <div className="space-y-3 mb-4">
                  {log.entries.map((entry, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl"
                      style={{ background: 'var(--fd-canvas)', border: '1px solid var(--fd-border)' }}
                    >
                      <div className="text-[13px]" style={{ color: 'var(--fd-ink-1)' }}>{entry.description}</div>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <span className="text-[10px] px-2 py-0.5 rounded font-medium"
                          style={{ background: STATUS_META[entry.status]?.bg, color: STATUS_META[entry.status]?.color }}>
                          {STATUS_META[entry.status]?.label}
                        </span>
                        {entry.category && entry.category !== 'other' && (
                          <span className="text-[10px]" style={{ color: 'var(--fd-ink-4)' }}>{CATEGORY_LABELS[entry.category]}</span>
                        )}
                        {entry.client?.name && (
                          <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--fd-ink-4)' }}>
                            <Building2 size={9} /> {entry.client.name}
                          </span>
                        )}
                        {entry.hoursSpent && (
                          <span className="text-[10px]" style={{ color: 'var(--fd-ink-4)' }}>{entry.hoursSpent}h</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Blocker */}
              {log.blockers?.trim() && (
                <div className="p-4 rounded-xl" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <AlertTriangle size={12} style={{ color: '#ef4444' }} />
                    <div className="text-[11px] font-semibold" style={{ color: '#ef4444' }}>Blocker raised</div>
                  </div>
                  <div className="text-[12px]" style={{ color: 'var(--fd-ink-2)' }}>{log.blockers}</div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ borderTop: '1px solid var(--fd-border)', flexShrink: 0 }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-[12px] font-medium transition-colors"
            style={{ background: 'var(--fd-canvas)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-3)' }}
          >
            Close
          </button>
          <button
            onClick={() => { onClose(); onViewHistory(member); }}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition-opacity"
            style={{ background: roleColor }}
          >
            <ExternalLink size={13} />
            View {member.name.split(' ')[0]}'s Full History
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
  const totalHours = log?.entries?.reduce((s, e) => s + (parseFloat(e.hoursSpent) || 0), 0) || 0;
  const completedCount = log?.entries?.filter(e => e.status === 'completed').length || 0;
  const roleColor = ROLE_COLORS[member.role] || '#4f6ef0';

  return (
    <div
      onClick={onClick}
      className="rounded-xl p-4 cursor-pointer transition-all group"
      style={{
        background: 'var(--fd-surface)',
        border: `1px solid ${hasBlocker ? 'rgba(239,68,68,0.3)' : 'var(--fd-border)'}`,
      }}
    >
      <div className="flex items-start gap-3">
        {/* Avatar with role color */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0 overflow-hidden"
          style={{ background: roleColor }}
        >
          {member.avatar
            ? <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
            : getInitials(member.name)
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[13px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>{member.name}</div>
              <div className="text-[10.5px]" style={{ color: roleColor }}>{ROLE_LABELS[member.role] || member.role}</div>
            </div>
            {/* Status pill */}
            {!log ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0" style={{ background: 'rgba(156,163,175,0.15)', color: 'var(--fd-ink-4)' }}>
                Not logged
              </span>
            ) : log.isSubmitted ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
                ✓ Submitted
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                Draft
              </span>
            )}
          </div>

          {/* Stats row */}
          {log && log.entries?.length > 0 && (
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="text-[11px]" style={{ color: 'var(--fd-ink-3)' }}>
                {log.entries.length} task{log.entries.length !== 1 ? 's' : ''}
              </span>
              {completedCount > 0 && (
                <span className="text-[11px]" style={{ color: '#22c55e' }}>{completedCount} ✓</span>
              )}
              {totalHours > 0 && (
                <span className="text-[11px]" style={{ color: 'var(--fd-ink-4)' }}>{totalHours}h</span>
              )}
            </div>
          )}

          {/* First entry preview */}
          {log?.entries?.[0] && (
            <div className="mt-2 text-[11px] truncate" style={{ color: 'var(--fd-ink-4)' }}>
              {log.entries[0].description}
              {log.entries.length > 1 && <span style={{ color: 'var(--fd-ink-5)' }}> +{log.entries.length - 1} more</span>}
            </div>
          )}

          {/* Blocker flag */}
          {hasBlocker && (
            <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold" style={{ color: '#ef4444' }}>
              <AlertTriangle size={10} /> Blocker raised
            </div>
          )}
        </div>
      </div>

      {/* Hover hint */}
      <div className="mt-3 pt-2.5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity" style={{ borderTop: '1px solid var(--fd-border)' }}>
        <span className="text-[10px]" style={{ color: 'var(--fd-ink-5)' }}>Click to view details</span>
        <ExternalLink size={10} style={{ color: 'var(--fd-ink-5)' }} />
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
  const [selected, setSelected] = useState(null);     // for day modal
  const [historyMember, setHistoryMember] = useState(null); // for history view
  const [filter, setFilter] = useState('all');
  const [showCal, setShowCal] = useState(false);
  const dateRef = useRef(null);

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
    const newStr = localDateStr(d);
    if (newStr > todayStr()) return;
    setDate(newStr);
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

  // If viewing a member's full history, render that instead
  if (historyMember) {
    return (
      <div className="max-w-4xl mx-auto">
        <MemberHistoryView member={historyMember} onBack={() => setHistoryMember(null)} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">

      {/* Page header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList size={18} style={{ color: '#4f6ef0' }} />
            <h1 className="text-[18px] font-bold" style={{ color: 'var(--fd-ink-1)' }}>Team Daily Log</h1>
          </div>
          <p className="text-[12px]" style={{ color: 'var(--fd-ink-4)' }}>
            {isToday ? "Today's work across your team" : `Work on ${fullDate(date)}`}
          </p>
        </div>

        {/* Date navigator */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => changeDate(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors"
            style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}
          >
            <ChevronLeft size={14} style={{ color: 'var(--fd-ink-3)' }} />
          </button>

          <button
            ref={dateRef}
            onClick={() => setShowCal(true)}
            className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-[12px] font-semibold transition-colors"
            style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)', color: 'var(--fd-ink-1)', minWidth: 110 }}
          >
            <CalendarDays size={12} style={{ color: '#4f6ef0', flexShrink: 0 }} />
            {friendlyDate(date)}
          </button>

          <button
            onClick={() => changeDate(1)}
            disabled={isToday}
            className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors disabled:opacity-30"
            style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}
          >
            <ChevronRight size={14} style={{ color: 'var(--fd-ink-3)' }} />
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Submitted', value: submitted, color: '#22c55e', icon: CheckCircle2 },
          { label: 'Draft',     value: drafts,    color: '#f59e0b', icon: Clock },
          { label: 'Not logged',value: notLogged, color: 'var(--fd-ink-3)', icon: Users },
          { label: 'Blockers',  value: blockers,  color: blockers > 0 ? '#ef4444' : 'var(--fd-ink-3)', icon: Flame, red: blockers > 0 },
        ].map(s => (
          <div
            key={s.label}
            className="rounded-2xl px-4 py-4 flex flex-col gap-1"
            style={{
              background: s.red ? 'rgba(239,68,68,0.05)' : 'var(--fd-surface)',
              border: `1px solid ${s.red ? 'rgba(239,68,68,0.2)' : 'var(--fd-border)'}`,
            }}
          >
            <div className="text-[24px] font-bold leading-none" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[10px] font-medium" style={{ color: 'var(--fd-ink-4)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {[
          { key: 'all',           label: `All  ${data.length}` },
          { key: 'submitted',     label: `Submitted  ${submitted}` },
          { key: 'not_submitted', label: `Not submitted  ${notLogged + drafts}` },
          { key: 'blocker',       label: `Blockers  ${blockers}`, red: true },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: filter === tab.key ? (tab.red ? 'rgba(239,68,68,0.12)' : 'rgba(79,110,240,0.12)') : 'var(--fd-surface)',
              color: filter === tab.key ? (tab.red ? '#ef4444' : '#4f6ef0') : 'var(--fd-ink-4)',
              border: `1px solid ${filter === tab.key ? (tab.red ? 'rgba(239,68,68,0.25)' : 'rgba(79,110,240,0.25)') : 'var(--fd-border)'}`,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-7 h-7 border-2 border-[#4f6ef0] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-[40px] mb-3">📋</div>
          <div className="text-[14px] font-medium" style={{ color: 'var(--fd-ink-2)' }}>Nothing here</div>
          <div className="text-[12px] mt-1" style={{ color: 'var(--fd-ink-4)' }}>No logs match this filter for {friendlyDate(date)}.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(item => (
            <MemberCard
              key={item.member._id}
              item={item}
              onClick={() => setSelected(item)}
            />
          ))}
        </div>
      )}

      {/* 7-day trend */}
      {stats && stats.stats?.length > 0 && (
        <div
          className="mt-8 rounded-2xl p-5"
          style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={14} style={{ color: '#4f6ef0' }} />
            <div className="text-[12px] font-semibold" style={{ color: 'var(--fd-ink-2)' }}>7-Day Submission Rate</div>
            <div className="text-[11px] ml-auto" style={{ color: 'var(--fd-ink-4)' }}>{stats.totalTeam} team members</div>
          </div>
          <div className="flex items-end gap-1.5" style={{ height: 64 }}>
            {[...stats.stats].reverse().map((day) => {
              const total = stats.totalTeam || 1;
              const pct = Math.round((day.submitted / total) * 100);
              const isSelected = day.date === date;
              return (
                <button
                  key={day.date}
                  onClick={() => setDate(day.date)}
                  className="flex-1 flex flex-col items-center gap-1 group"
                  title={`${friendlyDate(day.date)}: ${day.submitted}/${total} submitted`}
                >
                  <div
                    className="w-full rounded-t transition-all group-hover:opacity-80"
                    style={{
                      height: `${Math.max(6, pct * 0.56)}px`,
                      background: isSelected ? '#4f6ef0' : pct >= 80 ? '#22c55e' : pct >= 50 ? '#4f6ef0' : '#f59e0b',
                      outline: isSelected ? '2px solid #4f6ef0' : 'none',
                      outlineOffset: 2,
                    }}
                  />
                  <div className="text-[9px] font-medium" style={{ color: isSelected ? '#4f6ef0' : 'var(--fd-ink-5)' }}>
                    {new Date(day.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Calendar picker */}
      {showCal && (
        <CalendarPicker
          value={date}
          onChange={setDate}
          onClose={() => setShowCal(false)}
          anchorRef={dateRef}
        />
      )}

      {/* Day log modal */}
      {selected && (
        <DayLogModal
          item={selected}
          date={date}
          onClose={() => setSelected(null)}
          onViewHistory={(member) => setHistoryMember(member)}
        />
      )}
    </div>
  );
}