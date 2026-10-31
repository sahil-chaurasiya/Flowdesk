import React, { useEffect, useState, useCallback } from 'react';
import { Link2, Unlink, AlertTriangle, CheckCircle2 } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../components/ui/index';

/**
 * Identity reconciliation: Flowdesk accounts ↔ Attendance profiles.
 * Attendance lives in its own database with its own user records, so the two
 * are never assumed to be the same person because an id or name looks similar.
 * A link is either an explicit admin-approved one, or an exact e-mail match.
 */
const STATUS = {
  linked: { label: 'Linked', color: 'var(--fd-success, #2a7d4f)' },
  unmatched: { label: 'No attendance profile', color: 'var(--fd-ink-4)' },
  ambiguous: { label: 'Ambiguous e-mail', color: 'var(--fd-warning, #92600a)' },
  claimed_by_other: { label: 'Profile linked to someone else', color: 'var(--fd-warning, #92600a)' },
  broken_link: { label: 'Broken link', color: 'var(--fd-danger, #b91c1c)' },
};

export default function IdentityPage() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [picking, setPicking] = useState({}); // flowdeskUserId -> attendanceUserId

  const load = useCallback(async () => {
    try {
      const r = await api.get('/identity/attendance');
      setData(r.data); setError(null);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const link = async (fd) => {
    const attendanceUserId = picking[fd.id];
    if (!attendanceUserId) return;
    const att = data.orphanAttendanceUsers.find((a) => a.id === attendanceUserId);
    let confirmEmailMismatch = false;
    if (att && att.email?.toLowerCase() !== fd.email?.toLowerCase()) {
      if (!window.confirm(`The e-mails differ:\n\nFlowdesk: ${fd.email}\nAttendance: ${att.email}\n\nLink them anyway? Only do this if they are the same person.`)) return;
      confirmEmailMismatch = true;
    }
    try {
      await api.post('/identity/attendance/links', { flowdeskUserId: fd.id, attendanceUserId, confirmEmailMismatch });
      toast({ type: 'success', title: 'Linked' }); load();
    } catch (e) { toast({ type: 'error', title: 'Could not link', message: e.response?.data?.message }); }
  };

  const unlink = async (fd) => {
    if (!window.confirm(`Remove the explicit link for ${fd.name}?`)) return;
    try { await api.delete(`/identity/attendance/links/${fd.linkId}`); toast({ type: 'success', title: 'Link removed' }); load(); }
    catch (e) { toast({ type: 'error', title: 'Could not remove link', message: e.response?.data?.message }); }
  };

  if (error) return <div className="text-[13px]" style={{ color: 'var(--fd-ink-3)' }}>{error}</div>;
  if (!data) return <div className="text-[13px]" style={{ color: 'var(--fd-ink-3)' }}>Loading…</div>;

  const problems = data.flowdeskUsers.filter((u) => u.isActive && u.status !== 'linked');

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-[22px] font-bold tracking-[-0.02em]" style={{ color: 'var(--fd-ink-1)' }}>Identity reconciliation</h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--fd-ink-3)' }}>
          Connects each Flowdesk account to its profile in the Attendance database. Nothing is merged or rewritten — a link only says
          “these two records are the same person”. {data.emailFallbackEnabled
            ? 'Accounts with an identical e-mail are matched automatically; an explicit link always takes priority.'
            : 'Automatic e-mail matching is OFF: only explicit links grant access.'}
        </p>
      </div>

      {problems.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg p-3 text-[12.5px]" style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-2)' }}>
          <AlertTriangle size={14} className="mt-0.5" /> {problems.length} active account(s) have no working attendance link.
        </div>
      )}

      <div className="rounded-xl overflow-x-auto" style={{ background: 'var(--fd-card-bg)', border: '1px solid var(--fd-border)' }}>
        <table className="w-full text-[12.5px]">
          <thead>
            <tr style={{ background: 'var(--fd-table-head-bg)', color: 'var(--fd-table-head-text)' }}>
              {['Flowdesk account', 'Role', 'Status', 'Attendance profile', ''].map((h) => <th key={h} className="text-left font-semibold px-3 py-2">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.flowdeskUsers.map((u) => {
              const st = STATUS[u.status] || STATUS.unmatched;
              const canPick = ['unmatched', 'broken_link', 'ambiguous', 'claimed_by_other'].includes(u.status) && !u.linkId;
              return (
                <tr key={u.id} style={{ borderTop: '1px solid var(--fd-table-row-border)', opacity: u.isActive ? 1 : 0.55 }}>
                  <td className="px-3 py-2"><div style={{ color: 'var(--fd-ink-1)' }} className="font-medium">{u.name}</div><div style={{ color: 'var(--fd-ink-4)' }}>{u.email}</div></td>
                  <td className="px-3 py-2" style={{ color: 'var(--fd-ink-3)' }}>{u.role}</td>
                  <td className="px-3 py-2"><span className="inline-flex items-center gap-1 font-medium" style={{ color: st.color }}>{u.status === 'linked' && <CheckCircle2 size={12} />}{st.label}{u.source ? ` · ${u.source === 'link' ? 'explicit' : 'e-mail'}` : ''}</span></td>
                  <td className="px-3 py-2">
                    {u.attendanceUser
                      ? <><div style={{ color: 'var(--fd-ink-1)' }}>{u.attendanceUser.name}</div><div style={{ color: 'var(--fd-ink-4)' }}>{u.attendanceUser.email}</div></>
                      : canPick && (
                        <select className="input" style={{ maxWidth: 260 }} value={picking[u.id] || ''} onChange={(e) => setPicking((p) => ({ ...p, [u.id]: e.target.value }))}>
                          <option value="">Choose attendance profile…</option>
                          {data.orphanAttendanceUsers.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.email}</option>)}
                        </select>
                      )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {canPick && <button className="btn-primary" disabled={!picking[u.id]} onClick={() => link(u)}><Link2 size={13} /> Link</button>}
                    {u.linkId && <button className="btn-secondary" onClick={() => unlink(u)}><Unlink size={13} /> Unlink</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="text-[14px] font-semibold mb-2" style={{ color: 'var(--fd-ink-1)' }}>Attendance profiles not matched to any Flowdesk account ({data.orphanAttendanceUsers.length})</h2>
        {data.orphanAttendanceUsers.length === 0
          ? <div className="text-[12.5px]" style={{ color: 'var(--fd-ink-3)' }}>None — every attendance profile resolves to a Flowdesk account.</div>
          : <ul className="text-[12.5px] space-y-1" style={{ color: 'var(--fd-ink-2)' }}>
              {data.orphanAttendanceUsers.map((a) => <li key={a.id}>{a.name} — <span style={{ color: 'var(--fd-ink-4)' }}>{a.email}</span>{a.isActive ? '' : ' (inactive)'}</li>)}
            </ul>}
      </div>
    </div>
  );
}
