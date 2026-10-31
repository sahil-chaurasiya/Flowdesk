import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Phone, MessageCircle, MapPin, Building2, Edit3, Trash2, Play,
  CheckCircle2, XCircle, RotateCcw, CalendarCheck, Wallet, Plus, Receipt,
  ThumbsUp, ThumbsDown, AlertTriangle, Save, ChevronRight, Briefcase,
} from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { Avatar, Card, CardContent, Spinner, EmptyState } from '../../components/shared/LoadingScreen';
import { Button, Modal, Input, useToast } from '../../components/ui/index';
import {
  typeMeta, REVIEW_TAGS, fieldLabel, money, whatsappLink, fmtDate, fmtDateTime, fmtTime,
  relativeDay, needsUpdate, Chip, StatusChip, PayChip, Stars, PaidBar, ProjectFormModal,
} from '../../components/contacts/contactShared';

function DetailRow({ label, children }) {
  if (children === null || children === undefined || children === '' || children === false) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-2.5" style={{ borderTop: '1px solid var(--fd-border-subtle)' }}>
      <dt className="text-[12px] flex-shrink-0" style={{ color: 'var(--fd-ink-4)' }}>{label}</dt>
      <dd className="text-[12.5px] text-right break-words min-w-0" style={{ color: 'var(--fd-ink-2)' }}>{children}</dd>
    </div>
  );
}

// "Sat, 14 Mar 2026 · 4:30 PM – 6:30 PM" (or both dates when it spans days)
function whenText(p) {
  if (!p.endDate) return fmtDateTime(p.startDate);
  const s = new Date(p.startDate), e = new Date(p.endDate);
  if (s.toDateString() === e.toDateString()) return `${fmtDateTime(p.startDate)} – ${fmtTime(p.endDate)}`;
  return `${fmtDateTime(p.startDate)} → ${fmtDateTime(p.endDate)}`;
}

const todayInput = () => {
  const d = new Date(); const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function ContactProjectDetailPage() {
  const { id, projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { user } = useAuthStore();
  const canManageMoney = ['admin', 'manager'].includes(user?.role);
  const canSeeClientPages = ['admin', 'manager'].includes(user?.role);

  const [project, setProject] = useState(null);
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [showEdit, setShowEdit] = useState(false);
  const [confirm, setConfirm] = useState(null); // 'cancel' | 'delete' | { removePayment: id }
  const [busy, setBusy] = useState(false);

  // payment modal
  const [showPay, setShowPay] = useState(false);
  const [pay, setPay] = useState({ amount: '', paidAt: todayInput(), method: '', reference: '', note: '' });

  // review form
  const [review, setReview] = useState({ rating: 0, tags: [], wouldRehire: null, note: '' });
  const [savingReview, setSavingReview] = useState(false);

  const currency = contact?.currency || 'INR';
  const canEdit = project && (
    canManageMoney || (project.createdBy?._id || project.createdBy) === user?._id
  );

  const seedReview = (p) => setReview({
    rating: p.rating || 0,
    tags: p.reviewTags || [],
    wouldRehire: typeof p.wouldRehire === 'boolean' ? p.wouldRehire : null,
    note: p.reviewNote || '',
  });

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/contacts/${id}/projects/${projectId}`);
      setProject(data.project);
      setContact(data.contact);
      seedReview(data.project);
      setNotFound(false);
    } catch (err) {
      if (err?.response?.status === 404) setNotFound(true);
      else toast({ type: 'error', title: 'Could not load project' });
    } finally { setLoading(false); }
  }, [id, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setLoading(true); load(); }, [load]);

  const openPayModal = useCallback((p = project, c = contact) => {
    if (!p) return;
    setPay({
      amount: p.pendingAmount > 0 ? String(p.pendingAmount) : '',
      paidAt: todayInput(),
      method: c?.paymentMethod || '',
      reference: '',
      note: '',
    });
    setShowPay(true);
  }, [project, contact]);

  // Arrived from "Record payment" on the contact page
  useEffect(() => {
    if (project && searchParams.get('pay') === '1') {
      if (canManageMoney) openPayModal(project, contact);
      setSearchParams({}, { replace: true });
    }
  }, [project]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeStatus = async (status, successTitle) => {
    setBusy(true);
    try {
      const { data } = await api.put(`/contacts/${id}/projects/${projectId}`, { status });
      setProject(data.project);
      seedReview(data.project);
      toast({ type: 'success', title: successTitle });
      if (status === 'completed' && !data.project.rating) {
        toast({ type: 'info', title: 'How did it go?', message: 'Add a rating below so the team knows how they did.' });
      }
    } catch (err) {
      toast({ type: 'error', title: 'Could not update status', message: err?.response?.data?.message });
    } finally { setBusy(false); setConfirm(null); }
  };

  const saveReview = async () => {
    setSavingReview(true);
    try {
      const { data } = await api.put(`/contacts/${id}/projects/${projectId}`, {
        rating: review.rating || null,
        reviewTags: review.tags,
        wouldRehire: review.wouldRehire,
        reviewNote: review.note,
      });
      setProject(data.project);
      seedReview(data.project);
      toast({ type: 'success', title: 'Review saved' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not save review', message: err?.response?.data?.message });
    } finally { setSavingReview(false); }
  };

  const recordPayment = async () => {
    const amount = Number(pay.amount);
    if (!amount || amount <= 0) return toast({ type: 'error', title: 'Enter an amount greater than 0' });
    setBusy(true);
    try {
      const { data } = await api.post(`/contacts/${id}/projects/${projectId}/payments`, {
        amount,
        paidAt: new Date(`${pay.paidAt}T12:00:00`).toISOString(),
        method: pay.method, reference: pay.reference, note: pay.note,
      });
      setProject(data.project);
      setShowPay(false);
      toast({ type: 'success', title: 'Payment recorded', message: money(amount, currency) });
    } catch (err) {
      toast({ type: 'error', title: 'Could not record payment', message: err?.response?.data?.message });
    } finally { setBusy(false); }
  };

  const removePayment = async (paymentId) => {
    setBusy(true);
    try {
      const { data } = await api.delete(`/contacts/${id}/projects/${projectId}/payments/${paymentId}`);
      setProject(data.project);
      toast({ type: 'success', title: 'Payment removed' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not remove payment', message: err?.response?.data?.message });
    } finally { setBusy(false); setConfirm(null); }
  };

  const deleteProject = async () => {
    setBusy(true);
    try {
      await api.delete(`/contacts/${id}/projects/${projectId}`);
      toast({ type: 'success', title: 'Project deleted' });
      navigate(`/admin/contacts/${id}`, { replace: true });
    } catch (err) {
      toast({ type: 'error', title: 'Could not delete project', message: err?.response?.data?.message });
      setBusy(false); setConfirm(null);
    }
  };

  const toggleTag = (t) => setReview(r => ({
    ...r, tags: r.tags.includes(t) ? r.tags.filter(x => x !== t) : [...r.tags, t],
  }));

  if (loading) return <div className="flex items-center justify-center py-32"><Spinner size="lg" /></div>;

  if (notFound || !project || !contact) {
    return (
      <div className="space-y-5">
        <Link to={`/admin/contacts/${id}`} className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: 'var(--fd-ink-3)' }}>
          <ArrowLeft size={14} /> Back
        </Link>
        <EmptyState
          icon={Briefcase}
          title="Project not found"
          description="It may have been deleted. Go back to the contact to see their other projects."
          action={<Button size="sm" onClick={() => navigate(`/admin/contacts/${id}`)}>Back to contact</Button>}
        />
      </div>
    );
  }

  const t = typeMeta(project.type);
  const TypeIcon = t.icon;
  const clientName = project.client?.company || project.client?.name || project.clientName;
  const wa = whatsappLink(contact.phone);
  const isOpen = ['upcoming', 'in_progress'].includes(project.status);
  const stale = needsUpdate(project);
  const goodTags = REVIEW_TAGS.filter(x => x.good);
  const badTags = REVIEW_TAGS.filter(x => !x.good);
  const reviewDirty =
    (review.rating || 0) !== (project.rating || 0) ||
    (review.note || '') !== (project.reviewNote || '') ||
    review.wouldRehire !== (typeof project.wouldRehire === 'boolean' ? project.wouldRehire : null) ||
    [...review.tags].sort().join() !== [...(project.reviewTags || [])].sort().join();

  return (
    <div className="space-y-5">
      <Link
        to={`/admin/contacts/${contact._id}`}
        className="inline-flex items-center gap-1.5 text-[13px] hover:underline"
        style={{ color: 'var(--fd-ink-3)' }}
      >
        <ArrowLeft size={14} /> {contact.name}
      </Link>

      {/* Stale nudge */}
      {stale && (
        <div
          className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'var(--fd-status-warning-bg)', color: 'var(--fd-status-warning-text)', border: '1px solid var(--fd-border)' }}
        >
          <div className="flex items-start gap-2 text-[13px] flex-1">
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
            <span>This project's date has passed but it's still marked {project.status === 'upcoming' ? 'upcoming' : 'in progress'}. Update it so the records stay accurate.</span>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <Button size="xs" loading={busy} onClick={() => changeStatus('completed', 'Marked completed')}>Mark completed</Button>
              <Button size="xs" variant="outline" onClick={() => setConfirm('cancel')}>Cancel it</Button>
            </div>
          )}
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Card>
        <CardContent>
          <div className="flex flex-col lg:flex-row lg:items-start gap-5">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--fd-accent-tint)', color: 'var(--fd-accent-hover)' }}
            >
              <TypeIcon size={26} strokeWidth={1.6} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  className="text-[22px] font-bold leading-tight tracking-[-0.02em]"
                  style={{
                    color: 'var(--fd-ink-1)',
                    textDecoration: project.status === 'cancelled' ? 'line-through' : 'none',
                  }}
                >
                  {project.title}
                </h1>
                <StatusChip status={project.status} />
                <PayChip project={project} />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-[13px]" style={{ color: 'var(--fd-ink-3)' }}>
                <span className="inline-flex items-center gap-1.5"><CalendarCheck size={13} />{whenText(project)}</span>
                {isOpen && <span style={{ color: 'var(--fd-accent-hover)', fontWeight: 500 }}>{relativeDay(project.startDate)}</span>}
                {project.location && <span className="inline-flex items-center gap-1.5"><MapPin size={13} />{project.location}</span>}
                {clientName && (
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 size={13} />
                    {project.client?._id && canSeeClientPages
                      ? <Link to={`/admin/clients/${project.client._id}`} className="hover:underline" style={{ color: 'var(--fd-accent-hover)' }}>{clientName}</Link>
                      : clientName}
                  </span>
                )}
              </div>
            </div>

            {canEdit && (
              <div className="flex flex-wrap gap-2 lg:justify-end">
                {project.status === 'upcoming' && (
                  <Button size="sm" variant="outline" loading={busy} onClick={() => changeStatus('in_progress', 'Marked in progress')}>
                    <Play size={13} /> Start work
                  </Button>
                )}
                {isOpen && (
                  <Button size="sm" loading={busy} onClick={() => changeStatus('completed', 'Marked completed')}>
                    <CheckCircle2 size={13} /> Mark completed
                  </Button>
                )}
                {isOpen && (
                  <Button size="sm" variant="outline" onClick={() => setConfirm('cancel')}>
                    <XCircle size={13} /> Cancel
                  </Button>
                )}
                {project.status === 'completed' && (
                  <Button size="sm" variant="outline" loading={busy} onClick={() => changeStatus('in_progress', 'Reopened')}>
                    <RotateCcw size={13} /> Reopen
                  </Button>
                )}
                {project.status === 'cancelled' && (
                  <Button size="sm" variant="outline" loading={busy} onClick={() => changeStatus('upcoming', 'Restored')}>
                    <RotateCcw size={13} /> Restore
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setShowEdit(true)}><Edit3 size={13} /> Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirm('delete')} style={{ color: '#b91c1c' }}>
                  <Trash2 size={13} />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* ── Left column: brief + review ─────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardContent>
              <h2 className="text-[14px] font-semibold mb-3" style={{ color: 'var(--fd-ink-1)' }}>What it was for</h2>
              {project.description ? (
                <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap max-w-[68ch]" style={{ color: 'var(--fd-ink-2)' }}>
                  {project.description}
                </p>
              ) : (
                <p className="text-[13px]" style={{ color: 'var(--fd-ink-4)' }}>
                  No brief was added for this project.{canEdit && ' Use Edit to describe what the work was for.'}
                </p>
              )}
              {project.deliverables && (
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--fd-border-subtle)' }}>
                  <div className="text-[12px] mb-1.5" style={{ color: 'var(--fd-ink-4)' }}>Deliverables</div>
                  <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap max-w-[68ch]" style={{ color: 'var(--fd-ink-2)' }}>
                    {project.deliverables}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Review */}
          <Card>
            <CardContent>
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-[14px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>How did it go?</h2>
                {project.status === 'completed' && project.reviewedAt && (
                  <span className="text-[11.5px]" style={{ color: 'var(--fd-ink-4)' }}>Reviewed {fmtDate(project.reviewedAt)}</span>
                )}
              </div>

              {project.status !== 'completed' ? (
                <p className="text-[13px]" style={{ color: 'var(--fd-ink-3)' }}>
                  {project.status === 'cancelled'
                    ? "This project was cancelled, so there's nothing to review."
                    : `Once the project is marked completed, you can rate ${contact.name.split(' ')[0]}'s work here — it feeds their track record.`}
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Stars value={review.rating} size={24} onChange={canEdit ? (n => setReview(r => ({ ...r, rating: n }))) : undefined} />
                    <span className="text-[12.5px]" style={{ color: 'var(--fd-ink-3)' }}>
                      {review.rating ? ['', 'Poor', 'Below expectations', 'Good', 'Very good', 'Outstanding'][review.rating] : (canEdit ? 'Tap a star to rate' : 'Not rated yet')}
                    </span>
                  </div>

                  <div>
                    <div className="text-[12px] mb-2" style={{ color: 'var(--fd-ink-4)' }}>What stood out</div>
                    <div className="flex flex-wrap gap-1.5">
                      {goodTags.map(g => {
                        const on = review.tags.includes(g.value);
                        return (
                          <button
                            key={g.value} type="button" disabled={!canEdit}
                            onClick={() => toggleTag(g.value)}
                            className="text-[12px] font-medium px-2.5 py-1 rounded-full transition-colors disabled:cursor-default"
                            style={on
                              ? { background: 'var(--fd-status-success-bg)', color: 'var(--fd-status-success-text)', border: '1px solid var(--fd-status-success-text)' }
                              : { background: 'transparent', color: 'var(--fd-ink-3)', border: '1px solid var(--fd-border-strong)' }}
                          >
                            {g.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="text-[12px] mt-3 mb-2" style={{ color: 'var(--fd-ink-4)' }}>Could have been better</div>
                    <div className="flex flex-wrap gap-1.5">
                      {badTags.map(g => {
                        const on = review.tags.includes(g.value);
                        return (
                          <button
                            key={g.value} type="button" disabled={!canEdit}
                            onClick={() => toggleTag(g.value)}
                            className="text-[12px] font-medium px-2.5 py-1 rounded-full transition-colors disabled:cursor-default"
                            style={on
                              ? { background: 'var(--fd-status-warning-bg)', color: 'var(--fd-status-warning-text)', border: '1px solid var(--fd-status-warning-text)' }
                              : { background: 'transparent', color: 'var(--fd-ink-3)', border: '1px solid var(--fd-border-strong)' }}
                          >
                            {g.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-[12px] mb-2" style={{ color: 'var(--fd-ink-4)' }}>Would you book them again?</div>
                    <div className="flex gap-2">
                      {[{ v: true, label: 'Yes', Icon: ThumbsUp }, { v: false, label: 'No', Icon: ThumbsDown }].map(({ v, label, Icon }) => {
                        const on = review.wouldRehire === v;
                        return (
                          <button
                            key={label} type="button" disabled={!canEdit}
                            onClick={() => setReview(r => ({ ...r, wouldRehire: r.wouldRehire === v ? null : v }))}
                            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium px-3 py-1.5 rounded-lg transition-colors disabled:cursor-default"
                            style={on
                              ? { background: v ? 'var(--fd-status-success-bg)' : 'var(--fd-status-danger-bg)', color: v ? 'var(--fd-status-success-text)' : 'var(--fd-status-danger-text)', border: `1px solid ${v ? 'var(--fd-status-success-text)' : 'var(--fd-status-danger-text)'}` }
                              : { background: 'transparent', color: 'var(--fd-ink-3)', border: '1px solid var(--fd-border-strong)' }}
                          >
                            <Icon size={13} /> {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] mb-1.5" style={{ color: 'var(--fd-ink-4)' }}>Notes for the team</label>
                    <textarea
                      className="fd-input resize-none" rows={3}
                      disabled={!canEdit}
                      value={review.note}
                      onChange={e => setReview(r => ({ ...r, note: e.target.value }))}
                      placeholder="How was their work, communication and timing? Anything the next person booking them should know."
                    />
                  </div>

                  {canEdit && (
                    <div className="flex justify-end">
                      <Button size="sm" loading={savingReview} disabled={!reviewDirty} onClick={saveReview}>
                        <Save size={13} /> Save review
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right column: payment, details, contact ─────────────────── */}
        <div className="space-y-5">
          <Card>
            <CardContent>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Wallet size={15} style={{ color: 'var(--fd-ink-3)' }} />
                  <h2 className="text-[14px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>Payment</h2>
                </div>
                {canManageMoney && project.status !== 'cancelled' && (
                  <Button size="xs" variant="outline" onClick={() => openPayModal()}>
                    <Plus size={12} /> Record
                  </Button>
                )}
              </div>

              {project.fee === 0 && project.paidAmount === 0 ? (
                <p className="text-[12.5px]" style={{ color: 'var(--fd-ink-3)' }}>
                  No fee was agreed for this project.{canEdit && ' Edit the project to add one.'}
                </p>
              ) : (
                <>
                  <div
                    className="text-[28px] font-bold leading-none tabular-nums tracking-tight"
                    style={{ color: project.pendingAmount > 0 ? 'var(--fd-status-danger-text)' : 'var(--fd-status-success-text)' }}
                  >
                    {project.status === 'cancelled'
                      ? money(project.paidAmount, currency)
                      : project.pendingAmount > 0 ? money(project.pendingAmount, currency) : 'Paid in full'}
                  </div>
                  <div className="text-[12px] mt-1.5 mb-3" style={{ color: 'var(--fd-ink-3)' }}>
                    {project.status === 'cancelled'
                      ? 'paid before it was cancelled'
                      : project.pendingAmount > 0 ? 'still to pay' : 'nothing owed on this project'}
                  </div>
                  {project.status !== 'cancelled' && <PaidBar paid={project.paidAmount} total={project.fee} />}
                  <div className="flex justify-between mt-2 text-[12px] tabular-nums" style={{ color: 'var(--fd-ink-3)' }}>
                    <span>{money(project.paidAmount, currency)} paid</span>
                    <span>{money(project.fee, currency)} agreed</span>
                  </div>
                  {canManageMoney && project.pendingAmount > 0 && (
                    <Button size="sm" className="w-full mt-4" onClick={() => openPayModal()}>
                      Pay {money(project.pendingAmount, currency)}
                    </Button>
                  )}
                </>
              )}

              {project.payments?.length > 0 && (
                <div className="mt-4">
                  {[...project.payments]
                    .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt))
                    .map(p => (
                      <div
                        key={p._id}
                        className="flex items-center gap-2.5 py-2.5"
                        style={{ borderTop: '1px solid var(--fd-border-subtle)' }}
                      >
                        <Receipt size={13} style={{ color: 'var(--fd-status-success-text)' }} className="flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[12.5px] font-medium tabular-nums" style={{ color: 'var(--fd-ink-1)' }}>
                            {money(p.amount, currency)}
                          </div>
                          <div className="text-[11.5px] truncate" style={{ color: 'var(--fd-ink-4)' }}>
                            {fmtDate(p.paidAt)}{p.method && ` · ${p.method}`}{p.reference && ` · ${p.reference}`}
                          </div>
                          {p.note && <div className="text-[11.5px]" style={{ color: 'var(--fd-ink-3)' }}>{p.note}</div>}
                        </div>
                        {canManageMoney && (
                          <button
                            className="btn-ghost p-1.5" title="Remove payment"
                            onClick={() => setConfirm({ removePayment: p._id })}
                            style={{ color: '#b91c1c' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <h2 className="text-[14px] font-semibold mb-1" style={{ color: 'var(--fd-ink-1)' }}>Details</h2>
              <dl>
                <DetailRow label="Type">{t.label}</DetailRow>
                <DetailRow label="Client">
                  {project.client?._id && canSeeClientPages
                    ? <Link to={`/admin/clients/${project.client._id}`} className="hover:underline" style={{ color: 'var(--fd-accent-hover)' }}>{clientName}</Link>
                    : clientName}
                </DetailRow>
                <DetailRow label="When">{whenText(project)}</DetailRow>
                <DetailRow label="Where">{project.location}</DetailRow>
                <DetailRow label="Status">{project.status === 'completed' && project.completedAt ? `Completed ${fmtDate(project.completedAt)}` : null}</DetailRow>
                <DetailRow label="Team calendar">
                  {project.calendarEvent && (
                    <Link to="/admin/calendar" className="inline-flex items-center gap-1 hover:underline" style={{ color: 'var(--fd-accent-hover)' }}>
                      <CalendarCheck size={12} /> On the calendar
                    </Link>
                  )}
                </DetailRow>
                <DetailRow label="Booked by">
                  {project.createdBy?.name && `${project.createdBy.name} · ${fmtDate(project.createdAt)}`}
                </DetailRow>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Link
                to={`/admin/contacts/${contact._id}`}
                className="flex items-center gap-3 group"
                style={{ textDecoration: 'none' }}
              >
                <Avatar name={contact.name} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold truncate" style={{ color: 'var(--fd-ink-1)' }}>{contact.name}</div>
                  <div className="text-[12px]" style={{ color: 'var(--fd-ink-3)' }}>{fieldLabel(contact.field)}</div>
                </div>
                <ChevronRight size={15} className="transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--fd-ink-4)' }} />
              </Link>
              {(contact.phone || wa) && (
                <div className="flex gap-2 mt-3">
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full"><Phone size={13} /> Call</Button>
                    </a>
                  )}
                  {wa && (
                    <a href={wa} target="_blank" rel="noreferrer" className="flex-1">
                      <Button variant="outline" size="sm" className="w-full"><MessageCircle size={13} /> WhatsApp</Button>
                    </a>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit */}
      <ProjectFormModal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        contact={contact}
        initial={project}
        onSaved={(p) => { setProject(p); seedReview(p); }}
      />

      {/* Record payment */}
      <Modal isOpen={showPay} onClose={() => setShowPay(false)} title="Record a payment" size="md">
        <div className="space-y-4">
          <p className="text-[12.5px]" style={{ color: 'var(--fd-ink-3)' }}>
            Paid to {contact.name} for “{project.title}”.
            {project.pendingAmount > 0 && ` ${money(project.pendingAmount, currency)} is still due.`}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input label={`Amount (${currency}) *`} type="number" min="1" value={pay.amount} onChange={e => setPay(p => ({ ...p, amount: e.target.value }))} autoFocus />
            <Input label="Date paid" type="date" value={pay.paidAt} max={todayInput()} onChange={e => setPay(p => ({ ...p, paidAt: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Method" value={pay.method} onChange={e => setPay(p => ({ ...p, method: e.target.value }))} placeholder="UPI, Bank Transfer, Cash" />
            <Input label="Reference / UTR" value={pay.reference} onChange={e => setPay(p => ({ ...p, reference: e.target.value }))} placeholder="Optional" />
          </div>
          <Input label="Note" value={pay.note} onChange={e => setPay(p => ({ ...p, note: e.target.value }))} placeholder="e.g. 50% advance" />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setShowPay(false)}>Cancel</Button>
            <Button size="sm" loading={busy} onClick={recordPayment}>Record payment</Button>
          </div>
        </div>
      </Modal>

      {/* Confirmations */}
      <Modal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        size="sm"
        title={confirm === 'delete' ? 'Delete project' : confirm === 'cancel' ? 'Cancel project' : 'Remove payment'}
      >
        <p className="text-[13px] mb-5" style={{ color: 'var(--fd-ink-2)' }}>
          {confirm === 'delete' && 'This permanently deletes the project, its payment records and review. This cannot be undone.'}
          {confirm === 'cancel' && 'Mark this project as cancelled? Nothing will be owed on it, and you can restore it later.'}
          {confirm?.removePayment && 'Remove this payment record? The amount will count as unpaid again.'}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfirm(null)}>Keep it</Button>
          {confirm === 'cancel' ? (
            <Button size="sm" loading={busy} onClick={() => changeStatus('cancelled', 'Project cancelled')}>Cancel project</Button>
          ) : (
            <Button
              size="sm" loading={busy}
              onClick={() => (confirm === 'delete' ? deleteProject() : removePayment(confirm.removePayment))}
              style={{ background: '#b91c1c', color: '#fff', borderColor: '#b91c1c' }}
            >
              <Trash2 size={13} /> {confirm === 'delete' ? 'Delete' : 'Remove'}
            </Button>
          )}
        </div>
      </Modal>
    </div>
  );
}