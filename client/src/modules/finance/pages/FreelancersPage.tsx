import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { freelancersApi, clientsApi } from '../services/api';
import { formatCurrency, formatDate, getCurrentMonthYear, MONTHS } from '../lib/utils';
import { Plus, Pencil, Trash2, Search, Wallet, Clock, Briefcase, TrendingDown, ArrowRight } from 'lucide-react';
import {
  FreelancerModal, JobModal, PaymentModal, JobStatusBadge, PayStatusBadge, Stars,
  JOB_STATUSES, invalidateFreelancerData, rateBasis, idOf, errMsg,
} from '../components/freelancers/FreelancerParts';

type Tab = 'overview' | 'jobs' | 'freelancers';

export default function FreelancersPage() {
  const qc = useQueryClient();
  const { month, year } = getCurrentMonthYear();
  const [tab, setTab] = useState<Tab>('overview');
  const [selMonth, setSelMonth] = useState(month);
  const [selYear, setSelYear] = useState(year);
  const years = Array.from({ length: 3 }, (_, i) => year - i);

  // modals — `null` = closed
  const [freelancerModal, setFreelancerModal] = useState<any>(null);
  const [jobModal, setJobModal] = useState<any>(null);
  const [payModal, setPayModal] = useState<any>(null);
  const [modalError, setModalError] = useState('');

  // filters
  const [search, setSearch] = useState('');
  const [jobStatus, setJobStatus] = useState('All');
  const [jobPay, setJobPay] = useState('All');
  const [jobFreelancer, setJobFreelancer] = useState('All');

  const { data: summary } = useQuery({
    queryKey: ['freelancer-summary', selMonth, selYear],
    queryFn: () => freelancersApi.getMonthlySummary(selMonth, selYear).then((r) => r.data),
  });
  const { data: freelancers = [] } = useQuery<any[]>({
    queryKey: ['freelancers'],
    queryFn: () => freelancersApi.getAll().then((r) => r.data),
  });
  const { data: jobs = [] } = useQuery<any[]>({
    queryKey: ['freelancer-jobs'],
    queryFn: () => freelancersApi.getJobs().then((r) => r.data),
  });
  // Only needed for the "which client was this for?" dropdown, so load it lazily.
  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ['freelancer-client-options'],
    queryFn: () => clientsApi.getAll().then((r) => r.data),
    enabled: jobModal !== null,
  });

  const done = () => { invalidateFreelancerData(qc); setFreelancerModal(null); setJobModal(null); setPayModal(null); setModalError(''); };
  const fail = (e: any) => setModalError(errMsg(e));
  const warn = (e: any) => alert(errMsg(e));

  const saveFreelancer = useMutation({
    mutationFn: ({ id, d }: any) => (id ? freelancersApi.update(id, d) : freelancersApi.create(d)),
    onSuccess: done, onError: fail,
  });
  const deleteFreelancer = useMutation({ mutationFn: (id: string) => freelancersApi.delete(id), onSuccess: () => invalidateFreelancerData(qc), onError: warn });
  const saveJob = useMutation({
    mutationFn: ({ id, d }: any) => (id ? freelancersApi.updateJob(id, d) : freelancersApi.createJob(d)),
    onSuccess: done, onError: fail,
  });
  const deleteJob = useMutation({ mutationFn: (id: string) => freelancersApi.deleteJob(id), onSuccess: () => invalidateFreelancerData(qc), onError: warn });
  const savePayment = useMutation({
    mutationFn: ({ id, d }: any) => (id ? freelancersApi.updatePayment(id, d) : freelancersApi.createPayment(d)),
    onSuccess: done, onError: fail,
  });
  const deletePayment = useMutation({ mutationFn: (id: string) => freelancersApi.deletePayment(id), onSuccess: () => invalidateFreelancerData(qc), onError: warn });

  const open = (setter: (v: any) => void, value: any) => { setModalError(''); setter(value); };
  const close = () => { setFreelancerModal(null); setJobModal(null); setPayModal(null); setModalError(''); };

  // Jobs in the shape the payment form needs (with the freelancer's name attached).
  const payableJobs = useMemo(() => jobs.map((j: any) => ({ ...j, freelancerName: j.freelancerId?.name || 'Unknown' })), [jobs]);
  const activeFreelancers = freelancers.filter((f: any) => f.isActive !== false);

  const filteredJobs = jobs.filter((j: any) => {
    if (jobStatus !== 'All' && j.status !== jobStatus) return false;
    if (jobPay !== 'All' && j.paymentStatus !== jobPay) return false;
    if (jobFreelancer !== 'All' && idOf(j.freelancerId) !== jobFreelancer) return false;
    const q = search.trim().toLowerCase();
    if (q && !`${j.title} ${j.clientName} ${j.freelancerId?.name || ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const filteredFreelancers = freelancers.filter((f: any) => {
    const q = search.trim().toLowerCase();
    return !q || `${f.name} ${f.role} ${f.phone} ${f.city}`.toLowerCase().includes(q);
  });

  const th = (h: string) => <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>;
  const iconBtn = 'p-1.5 hover:bg-gray-100 rounded';

  const SearchBox = () => (
    <div className="relative">
      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
      <input className="border rounded-lg pl-9 pr-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Freelancers</h1>
          <p className="text-gray-500 text-sm mt-1">People you hire per job — what was agreed, how they worked, and what you've paid</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => open(setFreelancerModal, {})} className="flex items-center gap-2 border bg-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
            <Plus className="w-4 h-4" /> Add Freelancer
          </button>
          <button onClick={() => open(setJobModal, {})} className="flex items-center gap-2 border bg-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
            <Briefcase className="w-4 h-4" /> Add Job
          </button>
          <button onClick={() => open(setPayModal, {})} className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90">
            <Wallet className="w-4 h-4" /> Record Payment
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b overflow-x-auto">
        {([['overview', 'Overview'], ['jobs', 'Jobs'], ['freelancers', 'Freelancer Register']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition ${tab === t ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{label}</button>
        ))}
      </div>

      {/* ------------------------------ OVERVIEW ------------------------------ */}
      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="flex gap-3">
            <select className="border rounded-lg px-3 py-2 text-sm" value={selMonth} onChange={(e) => setSelMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select className="border rounded-lg px-3 py-2 text-sm" value={selYear} onChange={(e) => setSelYear(Number(e.target.value))}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Paid in {MONTHS[selMonth - 1]}</p>
              <p className="text-xl font-bold text-red-500">{formatCurrency(summary?.totalPaid || 0)}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{summary?.paymentCount || 0} payment{summary?.paymentCount === 1 ? '' : 's'} · {summary?.freelancersPaid || 0} freelancer{summary?.freelancersPaid === 1 ? '' : 's'}</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Payable now</p>
              <p className="text-xl font-bold text-amber-600">{formatCurrency(summary?.payableNow || 0)}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Work done, not fully paid</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 mb-1">Committed on running jobs</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(summary?.committed || 0)}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Agreed, not due yet</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 mb-1">Active jobs</p>
              <p className="text-xl font-bold text-gray-900">{summary?.activeJobs || 0}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Planned or in progress</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 bg-white rounded-xl border overflow-hidden">
              <div className="px-5 py-4 border-b"><h3 className="font-semibold">Payments made — {MONTHS[selMonth - 1]} {selYear}</h3></div>
              {!summary?.payments?.length ? (
                <div className="p-8 text-center text-gray-400 text-sm">No freelancer payments this month</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b"><tr>{['Date', 'Freelancer', 'Job', 'Type', 'Method', 'Amount', ''].map(th)}</tr></thead>
                    <tbody className="divide-y">
                      {summary.payments.map((p: any) => (
                        <tr key={p._id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatDate(p.paymentDate)}</td>
                          <td className="px-4 py-3 font-medium">{p.freelancerId ? <Link to={`/admin/finance/freelancers/${p.freelancerId._id}`} className="hover:text-primary">{p.freelancerId.name}</Link> : 'Unknown'}</td>
                          <td className="px-4 py-3 text-gray-600">{p.jobId?.title || '—'}</td>
                          <td className="px-4 py-3"><span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded whitespace-nowrap">{p.paymentType}</span></td>
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{p.paymentMethod}</td>
                          <td className="px-4 py-3 font-semibold text-red-500 whitespace-nowrap">{formatCurrency(p.amount)}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <button className={iconBtn} onClick={() => { const job = payableJobs.find((j: any) => j._id === idOf(p.jobId)); if (job) open(setPayModal, { initial: p, lockedJobId: job._id }); }}><Pencil className="w-3.5 h-3.5 text-gray-500" /></button>
                              <button className="p-1.5 hover:bg-red-50 rounded" onClick={() => { if (confirm('Delete this payment? It will also be removed from your expenses.')) deletePayment.mutate(p._id); }}><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="space-y-5">
              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold mb-3">Needs payment</h3>
                {!summary?.dueJobs?.length ? (
                  <p className="text-gray-400 text-sm text-center py-4">Nothing owed 🎉</p>
                ) : (
                  <div className="space-y-2">
                    {summary.dueJobs.slice(0, 6).map((j: any) => (
                      <div key={j._id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{j.title}</p>
                          <p className="text-xs text-gray-400 truncate">{j.freelancerName}</p>
                        </div>
                        <span className="text-sm font-semibold text-amber-600 whitespace-nowrap">{formatCurrency(j.pending)}</span>
                        <button onClick={() => open(setPayModal, { lockedJobId: j._id })} className="text-xs bg-emerald-500 text-white px-2.5 py-1.5 rounded-lg hover:bg-emerald-600">Pay</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold mb-3">By freelancer</h3>
                {!summary?.byFreelancer?.length ? (
                  <p className="text-gray-400 text-sm text-center py-4">No payments this month</p>
                ) : (
                  <div className="space-y-2">
                    {summary.byFreelancer.map((f: any) => (
                      <div key={f.freelancerId || f.name} className="flex justify-between text-sm">
                        <span className="truncate pr-2">{f.name}{f.role && <span className="text-xs text-gray-400"> · {f.role}</span>}</span>
                        <span className="font-medium whitespace-nowrap">{formatCurrency(f.paid)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------- JOBS --------------------------------- */}
      {tab === 'jobs' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <SearchBox />
            <select className="border rounded-lg px-3 py-2 text-sm" value={jobFreelancer} onChange={(e) => setJobFreelancer(e.target.value)}>
              <option value="All">All freelancers</option>
              {freelancers.map((f: any) => <option key={f._id} value={f._id}>{f.name}</option>)}
            </select>
            <select className="border rounded-lg px-3 py-2 text-sm" value={jobStatus} onChange={(e) => setJobStatus(e.target.value)}>
              <option value="All">All job statuses</option>
              {JOB_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select className="border rounded-lg px-3 py-2 text-sm" value={jobPay} onChange={(e) => setJobPay(e.target.value)}>
              <option value="All">All payment statuses</option>
              {['Unpaid', 'Partial', 'Paid', 'Overpaid', 'Closed'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div className="bg-white rounded-xl border overflow-hidden">
            {filteredJobs.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">{jobs.length === 0 ? 'No jobs yet — add one to start tracking a freelancer’s work and payments' : 'No jobs match these filters'}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b"><tr>{['Job', 'Freelancer', 'Fee basis', 'Payable', 'Paid', 'Pending', 'Job', 'Payment', ''].map((h, i) => <th key={h + i} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>)}</tr></thead>
                  <tbody className="divide-y">
                    {filteredJobs.map((j: any) => {
                      const overdue = j.dueDate && (j.status === 'In Progress' || j.status === 'Planned') && new Date(j.dueDate) < new Date();
                      return (
                        <tr key={j._id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 min-w-[180px]">
                            <p className="font-medium">{j.title}</p>
                            <p className="text-xs text-gray-400">
                              {j.clientName ? `For ${j.clientName}` : 'No client linked'}
                              {j.dueDate && <span className={overdue ? 'text-red-500 font-medium' : ''}> · Due {formatDate(j.dueDate)}</span>}
                            </p>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {j.freelancerId ? <Link to={`/admin/finance/freelancers/${j.freelancerId._id}`} className="font-medium hover:text-primary">{j.freelancerId.name}</Link> : 'Unknown'}
                            {j.freelancerId?.role && <p className="text-xs text-gray-400">{j.freelancerId.role}</p>}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                            {rateBasis(j)}
                            {j.extraCharges > 0 && <p className="text-gray-400">+ {formatCurrency(j.extraCharges)} extra</p>}
                          </td>
                          <td className="px-4 py-3 font-semibold whitespace-nowrap">{formatCurrency(j.payable)}</td>
                          <td className="px-4 py-3 text-emerald-600 font-medium whitespace-nowrap">{formatCurrency(j.paid)}</td>
                          <td className="px-4 py-3 text-red-500 font-medium whitespace-nowrap">{j.pending > 0 ? formatCurrency(j.pending) : '—'}</td>
                          <td className="px-4 py-3"><JobStatusBadge status={j.status} /></td>
                          <td className="px-4 py-3"><PayStatusBadge status={j.paymentStatus} /></td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 items-center">
                              {j.pending > 0 && <button onClick={() => open(setPayModal, { lockedJobId: j._id })} className="text-xs bg-emerald-500 text-white px-2.5 py-1.5 rounded-lg hover:bg-emerald-600 mr-1">Pay</button>}
                              <button className={iconBtn} onClick={() => open(setJobModal, { initial: j })}><Pencil className="w-3.5 h-3.5 text-gray-500" /></button>
                              <button className="p-1.5 hover:bg-red-50 rounded" onClick={() => { if (confirm('Delete this job?')) deleteJob.mutate(j._id); }}><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ----------------------------- REGISTER ------------------------------- */}
      {tab === 'freelancers' && (
        <div className="space-y-4">
          <SearchBox />
          <div className="bg-white rounded-xl border overflow-hidden">
            {filteredFreelancers.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">{freelancers.length === 0 ? 'No freelancers yet — add the first one' : 'No freelancers match your search'}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b"><tr>{['Name', 'Contact', 'Jobs', 'Total Paid', 'Pending', 'Track record', 'Status', ''].map(th)}</tr></thead>
                  <tbody className="divide-y">
                    {filteredFreelancers.map((f: any) => (
                      <tr key={f._id} className={`hover:bg-gray-50 ${f.isActive === false ? 'opacity-60' : ''}`}>
                        <td className="px-4 py-3">
                          <Link to={`/admin/finance/freelancers/${f._id}`} className="font-medium hover:text-primary flex items-center gap-1 group">{f.name}<ArrowRight className="w-3 h-3 text-gray-300 group-hover:text-primary" /></Link>
                          {f.role && <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">{f.role}</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{f.phone || <span className="text-gray-300">—</span>}{f.city && <p className="text-gray-400">{f.city}</p>}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{f.stats?.jobCount || 0}{f.stats?.activeJobs ? <span className="text-xs text-blue-600"> · {f.stats.activeJobs} active</span> : null}</td>
                        <td className="px-4 py-3 font-semibold whitespace-nowrap">{formatCurrency(f.stats?.totalPaid || 0)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{f.stats?.totalPending ? <span className="font-medium text-red-500">{formatCurrency(f.stats.totalPending)}</span> : <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {f.stats?.avgRating != null ? <div className="flex items-center gap-1"><Stars value={f.stats.avgRating} /><span className="text-gray-500">{f.stats.avgRating}</span></div> : <span className="text-gray-300">Not rated</span>}
                          {f.stats?.onTimeRate != null && <p className="text-gray-400 mt-0.5">{f.stats.onTimeRate}% on time</p>}
                        </td>
                        <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-1 rounded-full ${f.isActive === false ? 'bg-gray-100 text-gray-600' : 'bg-emerald-100 text-emerald-700'}`}>{f.isActive === false ? 'Inactive' : 'Active'}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button className={iconBtn} onClick={() => open(setFreelancerModal, { initial: f })}><Pencil className="w-3.5 h-3.5 text-gray-500" /></button>
                            <button className="p-1.5 hover:bg-red-50 rounded" onClick={() => { if (confirm(`Delete ${f.name}?`)) deleteFreelancer.mutate(f._id); }}><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------------------------------- MODALS ------------------------------- */}
      {freelancerModal !== null && (
        <FreelancerModal initial={freelancerModal.initial} saving={saveFreelancer.isPending} error={modalError} onClose={close}
          onSave={(d: any) => saveFreelancer.mutate({ id: freelancerModal.initial?._id, d })} />
      )}
      {jobModal !== null && (
        <JobModal initial={jobModal.initial} freelancers={jobModal.initial ? freelancers : activeFreelancers} clients={clients}
          saving={saveJob.isPending} error={modalError} onClose={close}
          onSave={(d: any) => saveJob.mutate({ id: jobModal.initial?._id, d })} />
      )}
      {payModal !== null && (
        <PaymentModal jobs={payableJobs.filter((j: any) => j.status !== 'Cancelled' || j._id === payModal.lockedJobId)} lockedJobId={payModal.lockedJobId} initial={payModal.initial}
          saving={savePayment.isPending} error={modalError} onClose={close}
          onSave={(d: any) => savePayment.mutate({ id: payModal.initial?._id, d })} />
      )}
    </div>
  );
}