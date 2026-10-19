import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Phone, Mail, MapPin, MessageCircle, ExternalLink, Edit3, Plus,
  UserCheck, Building2, CalendarCheck, ChevronRight, Users, Wallet,
  Briefcase, ThumbsUp, ThumbsDown, AlertTriangle, Receipt,
} from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { Avatar, Card, CardHeader, CardContent, Spinner, EmptyState } from '../../components/shared/LoadingScreen';
import { Button, Modal, Tabs, useToast } from '../../components/ui/index';
import { ContactForm } from './ContactsPage';
import {
  typeMeta, tagMeta, FIELD_COLORS, fieldLabel, RATE_LABELS, formatFollowers,
  money, whatsappLink, dateParts, fmtDate, fmtDateTime, relativeDay, needsUpdate,
  Chip, StatusChip, PayChip, Stars, PaidBar, ProjectFormModal,
} from '../../components/contacts/contactShared';

// ─── One project row (clickable → project page) ──────────────────────────────
function ProjectRow({ project, contactId, currency }) {
  const t = typeMeta(project.type);
  const TypeIcon = t.icon;
  const { day, month } = dateParts(project.startDate);
  const clientLabel = project.client?.company || project.client?.name || project.clientName;
  const open = ['upcoming', 'in_progress'].includes(project.status);
  const stale = needsUpdate(project);

  return (
    <Link
      to={`/admin/contacts/${contactId}/projects/${project._id}`}
      className="group flex items-stretch gap-4 px-5 py-4 transition-colors"
      style={{ borderTop: '1px solid var(--fd-border-subtle)', textDecoration: 'none' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--fd-table-row-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Date tile */}
      <div
        className="flex flex-col items-center justify-center rounded-xl flex-shrink-0 w-[52px] h-[56px]"
        style={{
          background: open ? 'var(--fd-accent-tint)' : 'var(--fd-surface-sunken)',
          color: open ? 'var(--fd-accent-hover)' : 'var(--fd-ink-3)',
          opacity: project.status === 'cancelled' ? 0.6 : 1,
        }}
      >
        <span className="text-[10.5px] font-semibold leading-none">{month}</span>
        <span className="text-[20px] font-bold leading-none mt-1 tabular-nums">{day}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className="text-[14px] font-semibold truncate max-w-full"
            style={{ color: 'var(--fd-ink-1)', textDecoration: project.status === 'cancelled' ? 'line-through' : 'none' }}
          >
            {project.title}
          </span>
          <StatusChip status={project.status} />
          {stale && <Chip kind="warning"><AlertTriangle size={10} /> Date passed — update status</Chip>}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[12px]" style={{ color: 'var(--fd-ink-3)' }}>
          <span className="inline-flex items-center gap-1"><TypeIcon size={12} />{t.label}</span>
          {clientLabel && <span className="inline-flex items-center gap-1"><Building2 size={12} />{clientLabel}</span>}
          {project.location && <span className="inline-flex items-center gap-1"><MapPin size={12} />{project.location}</span>}
          {open && <span style={{ color: 'var(--fd-accent-hover)', fontWeight: 500 }}>{relativeDay(project.startDate)}</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2">
          {project.fee > 0 && (
            <span className="text-[12px] font-medium tabular-nums" style={{ color: 'var(--fd-ink-2)' }}>
              {money(project.fee, currency)}
            </span>
          )}
          <PayChip project={project} />
          {project.pendingAmount > 0 && project.paidAmount > 0 && (
            <span className="text-[11.5px] tabular-nums" style={{ color: 'var(--fd-ink-4)' }}>
              {money(project.pendingAmount, currency)} left
            </span>
          )}
          {project.rating > 0 && <Stars value={project.rating} size={12} />}
        </div>
      </div>

      <ChevronRight
        size={16}
        className="self-center flex-shrink-0 transition-transform group-hover:translate-x-0.5"
        style={{ color: 'var(--fd-ink-4)' }}
      />
    </Link>
  );
}

// ─── Key/value row for the details card ──────────────────────────────────────
function DetailRow({ label, children }) {
  if (children === null || children === undefined || children === '' || children === false) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-2.5" style={{ borderTop: '1px solid var(--fd-border-subtle)' }}>
      <dt className="text-[12px] flex-shrink-0" style={{ color: 'var(--fd-ink-4)' }}>{label}</dt>
      <dd className="text-[12.5px] text-right break-words min-w-0" style={{ color: 'var(--fd-ink-2)' }}>{children}</dd>
    </div>
  );
}

export default function ContactDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const canManageMoney = ['admin', 'manager'].includes(user?.role);
  const canSeeClientPages = ['admin', 'manager'].includes(user?.role);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState(null);
  const [showProject, setShowProject] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: res } = await api.get(`/contacts/${id}`);
      setData(res);
      setNotFound(false);
    } catch (err) {
      if (err?.response?.status === 404) setNotFound(true);
      else toast({ type: 'error', title: 'Could not load contact' });
    } finally { setLoading(false); }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setLoading(true); setTab(null); load(); }, [load]);

  const contact = data?.contact;
  const stats = data?.stats;
  const projects = data?.projects || [];
  const currency = contact?.currency || 'INR';

  const upcoming = useMemo(
    () => projects.filter(p => ['upcoming', 'in_progress'].includes(p.status))
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate)),
    [projects]
  );
  const past = useMemo(
    () => projects.filter(p => ['completed', 'cancelled'].includes(p.status))
      .sort((a, b) => new Date(b.startDate) - new Date(a.startDate)),
    [projects]
  );
  const owing = useMemo(() => projects.filter(p => p.pendingAmount > 0), [projects]);
  const paymentHistory = useMemo(
    () => projects.flatMap(p => (p.payments || []).map(pay => ({ ...pay, project: p })))
      .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt)),
    [projects]
  );
  const nextProject = useMemo(
    () => (stats?.nextProject ? projects.find(p => p._id === stats.nextProject) : null),
    [stats, projects]
  );

  // Land on whichever tab has something to show
  useEffect(() => {
    if (data && tab === null) setTab(upcoming.length ? 'upcoming' : past.length ? 'past' : 'upcoming');
  }, [data, tab, upcoming.length, past.length]);

  const canEditContact = contact && (isAdmin || (contact.addedBy?._id || contact.addedBy) === user?._id);

  const handleSaveContact = async (form) => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.gender) delete payload.gender;
      await api.put(`/contacts/${id}`, payload);
      toast({ type: 'success', title: 'Contact updated' });
      setShowEdit(false);
      load();
    } catch (err) {
      toast({ type: 'error', title: 'Save failed', message: err?.response?.data?.message });
    } finally { setSaving(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-32"><Spinner size="lg" /></div>;
  }

  if (notFound || !contact) {
    return (
      <div className="space-y-5">
        <Link to="/admin/contacts" className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: 'var(--fd-ink-3)' }}>
          <ArrowLeft size={14} /> Contacts
        </Link>
        <EmptyState
          icon={Users}
          title="Contact not found"
          description="It may have been deleted. Head back to the contacts list to pick someone else."
          action={<Button size="sm" onClick={() => navigate('/admin/contacts')}>Back to contacts</Button>}
        />
      </div>
    );
  }

  const chip = FIELD_COLORS[contact.field] || FIELD_COLORS.other;
  const wa = whatsappLink(contact.phone);
  const topTags = Object.entries(stats.tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const rateText = contact.rateAmount
    ? `${money(contact.rateAmount, currency)} ${RATE_LABELS[contact.rateType] || ''}`.trim()
    : null;

  return (
    <div className="space-y-5">
      <Link
        to="/admin/contacts"
        className="inline-flex items-center gap-1.5 text-[13px] hover:underline"
        style={{ color: 'var(--fd-ink-3)' }}
      >
        <ArrowLeft size={14} /> Contacts
      </Link>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <CardContent>
          <div className="flex flex-col md:flex-row md:items-start gap-5">
            <Avatar name={contact.name} size={64} />

            <div className="flex-1 min-w-0">
              <h1 className="text-[24px] font-bold leading-tight tracking-[-0.02em]" style={{ color: 'var(--fd-ink-1)' }}>
                {contact.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {contact.field && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={chip}>{fieldLabel(contact.field)}</span>
                )}
                {!contact.isActive && <Chip kind="neutral">Inactive</Chip>}
                {contact.location && (
                  <span className="inline-flex items-center gap-1 text-[12.5px]" style={{ color: 'var(--fd-ink-3)' }}>
                    <MapPin size={12} />{contact.location}
                  </span>
                )}
                {contact.followers > 0 && (
                  <span className="inline-flex items-center gap-1 text-[12.5px]" style={{ color: 'var(--fd-ink-3)' }}>
                    <UserCheck size={12} />{formatFollowers(contact.followers)} followers
                  </span>
                )}
              </div>
              <p className="text-[12.5px] mt-3" style={{ color: 'var(--fd-ink-3)' }}>
                {stats.totalProjects === 0
                  ? 'No projects booked yet.'
                  : `${stats.completed} completed · ${stats.upcoming} coming up${stats.avgRating ? ` · rated ${stats.avgRating}/5` : ''}${stats.lastWorked ? ` · last worked together ${fmtDate(stats.lastWorked)}` : ''}`}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 md:justify-end md:max-w-[320px]">
              <Button size="sm" onClick={() => setShowProject(true)}><Plus size={13} /> Book a project</Button>
              {contact.phone && (
                <a href={`tel:${contact.phone}`}><Button variant="outline" size="sm"><Phone size={13} /> Call</Button></a>
              )}
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer"><Button variant="outline" size="sm"><MessageCircle size={13} /> WhatsApp</Button></a>
              )}
              {contact.email && (
                <a href={`mailto:${contact.email}`}><Button variant="outline" size="sm"><Mail size={13} /> Email</Button></a>
              )}
              {contact.portfolio && (
                <a href={contact.portfolio} target="_blank" rel="noreferrer"><Button variant="outline" size="sm"><ExternalLink size={13} /> Portfolio</Button></a>
              )}
              {canEditContact && (
                <Button variant="ghost" size="sm" onClick={() => setShowEdit(true)}><Edit3 size={13} /> Edit</Button>
              )}
            </div>
          </div>
        </CardContent>

        {nextProject && (
          <Link
            to={`/admin/contacts/${contact._id}/projects/${nextProject._id}`}
            className="flex items-center gap-3 px-5 py-3 transition-colors"
            style={{ background: 'var(--fd-accent-tint)', borderTop: '1px solid var(--fd-border)', textDecoration: 'none' }}
          >
            <CalendarCheck size={16} style={{ color: 'var(--fd-accent-hover)' }} className="flex-shrink-0" />
            <span className="text-[13px] min-w-0 truncate" style={{ color: 'var(--fd-ink-2)' }}>
              Next with us: <strong style={{ color: 'var(--fd-ink-1)' }}>{nextProject.title}</strong>
              {' '}— {relativeDay(nextProject.startDate)}, {fmtDateTime(nextProject.startDate)}
              {(nextProject.client?.company || nextProject.clientName) && ` · for ${nextProject.client?.company || nextProject.clientName}`}
            </span>
            <ChevronRight size={15} className="ml-auto flex-shrink-0" style={{ color: 'var(--fd-accent-hover)' }} />
          </Link>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* ── Left: work ─────────────────────────────────────────────────── */}
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-[15px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>Work with us</h2>
              <Tabs
                activeTab={tab || 'upcoming'}
                onChange={setTab}
                tabs={[
                  { value: 'upcoming', label: `Upcoming (${upcoming.length})` },
                  { value: 'past', label: `Past (${past.length})` },
                  { value: 'payments', label: owing.length ? `Payments (${owing.length} due)` : 'Payments' },
                ]}
              />
            </div>
          </CardHeader>

          {tab === 'upcoming' && (
            upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title="Nothing booked right now"
                description={`Book ${contact.name.split(' ')[0]} for a shoot, collab or edit and it will show up here.`}
                action={<Button size="sm" onClick={() => setShowProject(true)}><Plus size={13} /> Book a project</Button>}
              />
            ) : upcoming.map(p => <ProjectRow key={p._id} project={p} contactId={contact._id} currency={currency} />)
          )}

          {tab === 'past' && (
            past.length === 0 ? (
              <EmptyState
                icon={Briefcase}
                title="No past projects yet"
                description="Completed and cancelled projects will be listed here, with how each one went."
              />
            ) : past.map(p => <ProjectRow key={p._id} project={p} contactId={contact._id} currency={currency} />)
          )}

          {tab === 'payments' && (
            <div>
              {/* Still to pay */}
              <div className="px-5 pt-4 pb-2 text-[12.5px] font-semibold" style={{ color: 'var(--fd-ink-2)' }}>Still to pay</div>
              {owing.length === 0 ? (
                <p className="px-5 pb-5 text-[13px]" style={{ color: 'var(--fd-ink-3)' }}>
                  Nothing pending — every project with a fee has been settled.
                </p>
              ) : owing.map(p => (
                <div
                  key={p._id}
                  className="flex items-center gap-3 px-5 py-3"
                  style={{ borderTop: '1px solid var(--fd-border-subtle)' }}
                >
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/admin/contacts/${contact._id}/projects/${p._id}`}
                      className="text-[13px] font-medium hover:underline block truncate"
                      style={{ color: 'var(--fd-ink-1)' }}
                    >
                      {p.title}
                    </Link>
                    <div className="text-[11.5px]" style={{ color: 'var(--fd-ink-4)' }}>
                      {p.client?.company || p.clientName || 'No client'} · {fmtDate(p.startDate)}
                      {p.paidAmount > 0 && ` · ${money(p.paidAmount, currency)} paid of ${money(p.fee, currency)}`}
                    </div>
                  </div>
                  <span className="text-[13.5px] font-semibold tabular-nums" style={{ color: 'var(--fd-status-danger-text)' }}>
                    {money(p.pendingAmount, currency)}
                  </span>
                  {canManageMoney && (
                    <Button
                      size="xs" variant="outline"
                      onClick={() => navigate(`/admin/contacts/${contact._id}/projects/${p._id}?pay=1`)}
                    >
                      Record payment
                    </Button>
                  )}
                </div>
              ))}

              {/* History */}
              <div className="px-5 pt-5 pb-2 text-[12.5px] font-semibold" style={{ color: 'var(--fd-ink-2)', borderTop: '1px solid var(--fd-border)' }}>
                Payment history
              </div>
              {paymentHistory.length === 0 ? (
                <p className="px-5 pb-5 text-[13px]" style={{ color: 'var(--fd-ink-3)' }}>No payments recorded yet.</p>
              ) : paymentHistory.map(pay => (
                <div
                  key={pay._id}
                  className="flex items-center gap-3 px-5 py-3"
                  style={{ borderTop: '1px solid var(--fd-border-subtle)' }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--fd-status-success-bg)', color: 'var(--fd-status-success-text)' }}
                  >
                    <Receipt size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/admin/contacts/${contact._id}/projects/${pay.project._id}`}
                      className="text-[13px] font-medium hover:underline block truncate"
                      style={{ color: 'var(--fd-ink-1)' }}
                    >
                      {pay.project.title}
                    </Link>
                    <div className="text-[11.5px]" style={{ color: 'var(--fd-ink-4)' }}>
                      {fmtDate(pay.paidAt)}
                      {pay.method && ` · ${pay.method}`}
                      {pay.reference && ` · Ref ${pay.reference}`}
                    </div>
                  </div>
                  <span className="text-[13.5px] font-semibold tabular-nums" style={{ color: 'var(--fd-ink-1)' }}>
                    {money(pay.amount, currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── Right: ledger, track record, details ───────────────────────── */}
        <div className="space-y-5">
          <Card>
            <CardContent>
              <div className="flex items-center gap-2 mb-3">
                <Wallet size={15} style={{ color: 'var(--fd-ink-3)' }} />
                <h2 className="text-[14px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>Payments</h2>
              </div>
              {stats.totalValue === 0 && stats.totalPaid === 0 ? (
                <p className="text-[12.5px]" style={{ color: 'var(--fd-ink-3)' }}>
                  No fees agreed yet. Add a fee when booking a project to track what is owed.
                </p>
              ) : (
                <>
                  <div
                    className="text-[28px] font-bold leading-none tabular-nums tracking-tight"
                    style={{ color: stats.totalPending > 0 ? 'var(--fd-status-danger-text)' : 'var(--fd-status-success-text)' }}
                  >
                    {stats.totalPending > 0 ? money(stats.totalPending, currency) : 'All settled'}
                  </div>
                  <div className="text-[12px] mt-1.5 mb-3" style={{ color: 'var(--fd-ink-3)' }}>
                    {stats.totalPending > 0
                      ? `still to pay across ${owing.length} project${owing.length !== 1 ? 's' : ''}`
                      : 'nothing owed to them right now'}
                  </div>
                  <PaidBar paid={stats.totalPaid} total={stats.totalValue} />
                  <div className="flex justify-between mt-2 text-[12px] tabular-nums" style={{ color: 'var(--fd-ink-3)' }}>
                    <span>{money(stats.totalPaid, currency)} paid</span>
                    <span>{money(stats.totalValue, currency)} agreed</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <h2 className="text-[14px] font-semibold mb-3" style={{ color: 'var(--fd-ink-1)' }}>Track record</h2>
              {stats.ratingCount === 0 ? (
                <p className="text-[12.5px]" style={{ color: 'var(--fd-ink-3)' }}>
                  No reviews yet. After a project is completed, rate how it went and it will build up here.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[28px] font-bold leading-none tabular-nums" style={{ color: 'var(--fd-ink-1)' }}>
                      {stats.avgRating}
                    </span>
                    <div>
                      <Stars value={stats.avgRating} size={15} />
                      <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>
                        from {stats.ratingCount} review{stats.ratingCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  {stats.rehireTotal > 0 && (
                    <div className="flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--fd-ink-2)' }}>
                      {stats.rehireYes >= stats.rehireTotal / 2
                        ? <ThumbsUp size={13} style={{ color: 'var(--fd-status-success-text)' }} />
                        : <ThumbsDown size={13} style={{ color: 'var(--fd-status-danger-text)' }} />}
                      Would book again on {stats.rehireYes} of {stats.rehireTotal} project{stats.rehireTotal !== 1 ? 's' : ''}
                    </div>
                  )}
                  {topTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {topTags.map(([t, n]) => {
                        const m = tagMeta(t);
                        return (
                          <Chip key={t} kind={m.good ? 'completed' : 'warning'}>
                            {m.label}{n > 1 && ` ×${n}`}
                          </Chip>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {stats.clients.length > 0 && (
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--fd-border-subtle)' }}>
                  <div className="text-[12px] mb-2" style={{ color: 'var(--fd-ink-4)' }}>Has worked on clients</div>
                  <div className="flex flex-wrap gap-1.5">
                    {stats.clients.map(c => {
                      const inner = <>{c.name}{c.count > 1 && <span style={{ opacity: 0.7 }}> ×{c.count}</span>}</>;
                      const style = { background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-2)', border: '1px solid var(--fd-border)' };
                      const cls = 'inline-flex items-center gap-1 text-[11.5px] font-medium px-2 py-1 rounded-md';
                      return c._id && canSeeClientPages
                        ? <Link key={c._id} to={`/admin/clients/${c._id}`} className={`${cls} hover:underline`} style={style}>{inner}</Link>
                        : <span key={c._id || c.name} className={cls} style={style}>{inner}</span>;
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <h2 className="text-[14px] font-semibold mb-1" style={{ color: 'var(--fd-ink-1)' }}>Details</h2>
              <dl>
                <DetailRow label="Phone">{contact.phone}</DetailRow>
                <DetailRow label="Email">{contact.email}</DetailRow>
                <DetailRow label="Location">{contact.location}</DetailRow>
                <DetailRow label="Gender">{contact.gender && contact.gender[0].toUpperCase() + contact.gender.slice(1)}</DetailRow>
                <DetailRow label="Followers">{contact.followers > 0 && formatFollowers(contact.followers)}</DetailRow>
                <DetailRow label="Usual rate">{rateText}</DetailRow>
                <DetailRow label="Pays via">{contact.paymentMethod}</DetailRow>
                <DetailRow label="Added by">
                  {contact.addedBy?.name && `${contact.addedBy.name} · ${fmtDate(contact.createdAt)}`}
                </DetailRow>
              </dl>
              {contact.notes && (
                <p
                  className="text-[12.5px] leading-relaxed mt-3 pt-3 whitespace-pre-wrap"
                  style={{ color: 'var(--fd-ink-3)', borderTop: '1px solid var(--fd-border-subtle)' }}
                >
                  {contact.notes}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ProjectFormModal
        isOpen={showProject}
        onClose={() => setShowProject(false)}
        contact={contact}
        onSaved={() => { setTab('upcoming'); load(); }}
      />

      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit Contact" size="lg">
        <ContactForm initial={contact} onSubmit={handleSaveContact} loading={saving} onClose={() => setShowEdit(false)} />
      </Modal>
    </div>
  );
}