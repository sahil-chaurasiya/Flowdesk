import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { freelancersApi, clientsApi } from '../services/api';
import { formatCurrency, formatDate } from '../lib/utils';
import { ArrowLeft, Pencil, Trash2, Plus, Phone, Mail, MapPin, Copy, Wallet, Briefcase } from 'lucide-react';
import {
  FreelancerModal, JobModal, PaymentModal, JobStatusBadge, PayStatusBadge, Stars,
  invalidateFreelancerData, rateBasis, errMsg,
} from '../components/freelancers/FreelancerParts';
import { FreelancerDetail } from '../types';

export default function FreelancerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [freelancerModal, setFreelancerModal] = useState<any>(null);
  const [jobModal, setJobModal] = useState<any>(null);
  const [payModal, setPayModal] = useState<any>(null);
  const [modalError, setModalError] = useState('');
  const [copied, setCopied] = useState('');

  const { data: f, isLoading, isError } = useQuery<FreelancerDetail>({
    queryKey: ['freelancer', id],
    queryFn: () => freelancersApi.getOne(id!).then((r) => r.data),
    enabled: !!id,
  });
  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ['freelancer-client-options'],
    queryFn: () => clientsApi.getAll().then((r) => r.data),
    enabled: jobModal !== null,
  });

  const done = () => { invalidateFreelancerData(qc); setFreelancerModal(null); setJobModal(null); setPayModal(null); setModalError(''); };
  const fail = (e: any) => setModalError(errMsg(e));
  const warn = (e: any) => alert(errMsg(e));

  const saveFreelancer = useMutation({ mutationFn: (d: any) => freelancersApi.update(id!, d), onSuccess: done, onError: fail });
  const deleteFreelancer = useMutation({ mutationFn: () => freelancersApi.delete(id!), onSuccess: () => { invalidateFreelancerData(qc); navigate('/admin/finance/freelancers'); }, onError: warn });
  const saveJob = useMutation({
    mutationFn: ({ jid, d }: any) => (jid ? freelancersApi.updateJob(jid, d) : freelancersApi.createJob(d)),
    onSuccess: done, onError: fail,
  });
  const deleteJob = useMutation({ mutationFn: (jid: string) => freelancersApi.deleteJob(jid), onSuccess: () => invalidateFreelancerData(qc), onError: warn });
  const savePayment = useMutation({
    mutationFn: ({ pid, d }: any) => (pid ? freelancersApi.updatePayment(pid, d) : freelancersApi.createPayment(d)),
    onSuccess: done, onError: fail,
  });
  const deletePayment = useMutation({ mutationFn: (pid: string) => freelancersApi.deletePayment(pid), onSuccess: () => invalidateFreelancerData(qc), onError: warn });

  const open = (setter: (v: any) => void, value: any) => { setModalError(''); setter(value); };
  const close = () => { setFreelancerModal(null); setJobModal(null); setPayModal(null); setModalError(''); };
  const copy = (label: string, text: string) => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(label); setTimeout(() => setCopied(''), 1500); }).catch(() => {});
  };

  if (isLoading) return <div className="p-10 text-center text-gray-400">Loading…</div>;
  if (isError || !f) return (
    <div className="p-10 text-center">
      <p className="text-gray-500 mb-3">Freelancer not found.</p>
      <Link to="/admin/finance/freelancers" className="text-primary text-sm font-medium hover:underline">← Back to Freelancers</Link>
    </div>
  );

  const s = f.stats;
  // Jobs in the shape the payment form needs.
  const payableJobs = f.jobs.map((j) => ({ ...j, freelancerName: f.name }));
  const inactive = f.isActive === false;

  return (
    <div className="space-y-5">
      <Link to="/admin/finance/freelancers" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary"><ArrowLeft className="w-4 h-4" /> Freelancers</Link>

      {/* Profile */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary flex-shrink-0">{f.name.charAt(0).toUpperCase()}</div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{f.name}</h1>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${inactive ? 'bg-gray-100 text-gray-600' : 'bg-emerald-100 text-emerald-700'}`}>{inactive ? 'Inactive' : 'Active'}</span>
              </div>
              {f.role && <span className="inline-block mt-1 text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">{f.role}</span>}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => open(setJobModal, {})} className="flex items-center gap-2 border bg-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"><Briefcase className="w-4 h-4" /> Add Job</button>
            <button onClick={() => open(setFreelancerModal, { initial: f })} className="flex items-center gap-2 border bg-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"><Pencil className="w-4 h-4" /> Edit</button>
            <button onClick={() => { if (confirm(`Delete ${f.name}? Only possible if no payments were ever made.`)) deleteFreelancer.mutate(); }} className="flex items-center gap-2 border border-red-200 text-red-500 px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-50"><Trash2 className="w-4 h-4" /> Delete</button>
          </div>
        </div>

        <div className="mt-4 grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm text-gray-600">
          {f.phone && <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-gray-400" />{f.phone}</p>}
          {f.email && <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-gray-400" />{f.email}</p>}
          {f.city && <p className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-gray-400" />{f.city}</p>}
          {f.upiId && (
            <p className="flex items-center gap-2">
              <Wallet className="w-3.5 h-3.5 text-gray-400" />UPI: <span className="font-medium">{f.upiId}</span>
              <button onClick={() => copy('upi', f.upiId)} className="text-gray-400 hover:text-primary" title="Copy UPI ID"><Copy className="w-3.5 h-3.5" /></button>
              {copied === 'upi' && <span className="text-xs text-emerald-600">Copied</span>}
            </p>
          )}
        </div>
        {f.bankDetails && <p className="mt-3 text-xs text-gray-500 whitespace-pre-line bg-gray-50 border rounded-lg px-3 py-2"><span className="font-semibold text-gray-600">Bank details · </span>{f.bankDetails}</p>}
        {f.notes && <p className="mt-3 text-sm text-gray-500 italic">“{f.notes}”</p>}
      </div>

      {/* Numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4"><p className="text-xs text-gray-500 mb-1">Total paid to date</p><p className="text-xl font-bold text-emerald-600">{formatCurrency(s.totalPaid)}</p><p className="text-[11px] text-gray-400 mt-0.5">of {formatCurrency(s.totalPayable)} agreed</p></div>
        <div className="bg-white rounded-xl border p-4"><p className="text-xs text-gray-500 mb-1">Still to pay</p><p className={`text-xl font-bold ${s.totalPending > 0 ? 'text-red-500' : 'text-gray-900'}`}>{formatCurrency(s.totalPending)}</p><p className="text-[11px] text-gray-400 mt-0.5">{s.payableNow > 0 ? `${formatCurrency(s.payableNow)} due now (work done)` : 'Nothing due right now'}</p></div>
        <div className="bg-white rounded-xl border p-4"><p className="text-xs text-gray-500 mb-1">Jobs</p><p className="text-xl font-bold">{s.jobCount}</p><p className="text-[11px] text-gray-400 mt-0.5">{s.completedJobs} completed · {s.activeJobs} active</p></div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 mb-1">Track record</p>
          {s.avgRating != null ? <div className="flex items-center gap-2"><Stars value={s.avgRating} size="w-4 h-4" /><span className="text-lg font-bold">{s.avgRating}</span></div> : <p className="text-sm text-gray-400">Not rated yet</p>}
          <p className="text-[11px] text-gray-400 mt-0.5">{s.onTimeRate != null ? `${s.onTimeRate}% delivered on time` : 'No delivery data yet'}</p>
        </div>
      </div>

      {/* Jobs, each with its payments */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Jobs &amp; payments</h2>
        <button onClick={() => open(setJobModal, {})} className="flex items-center gap-1 text-sm text-primary font-medium hover:underline"><Plus className="w-4 h-4" /> Add job</button>
      </div>

      {f.jobs.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-400 text-sm">No jobs yet. Add the first job to start tracking what you agreed and what you pay.</div>
      ) : (
        <div className="space-y-4">
          {f.jobs.map((j) => {
            const pct = j.payable > 0 ? Math.min(100, Math.round((j.paid / j.payable) * 100)) : 0;
            return (
              <div key={j._id} className="bg-white rounded-xl border overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{j.title}</h3>
                        <JobStatusBadge status={j.status} />
                        <PayStatusBadge status={j.paymentStatus} />
                        {j.workStatus && <span className={`text-xs font-medium px-2 py-1 rounded-full ${j.workStatus === 'On Time' ? 'bg-teal-50 text-teal-700' : 'bg-orange-50 text-orange-700'}`}>{j.workStatus}</span>}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {j.clientName ? `For ${j.clientName}` : 'No client linked'}
                        {j.startDate && ` · Started ${formatDate(j.startDate)}`}
                        {j.dueDate && ` · Due ${formatDate(j.dueDate)}`}
                        {j.completedDate && ` · Completed ${formatDate(j.completedDate)}`}
                      </p>
                      {j.description && <p className="text-sm text-gray-600 mt-2 whitespace-pre-line">{j.description}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      {j.pending > 0 && <button onClick={() => open(setPayModal, { lockedJobId: j._id })} className="text-xs bg-emerald-500 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-600 mr-1">Record payment</button>}
                      <button className="p-1.5 hover:bg-gray-100 rounded" onClick={() => open(setJobModal, { initial: j })}><Pencil className="w-3.5 h-3.5 text-gray-500" /></button>
                      <button className="p-1.5 hover:bg-red-50 rounded" onClick={() => { if (confirm('Delete this job?')) deleteJob.mutate(j._id); }}><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div><p className="text-[11px] text-gray-400 uppercase">Terms</p><p className="font-medium text-gray-700">{rateBasis(j)}</p>{j.extraCharges > 0 && <p className="text-xs text-gray-400">+ {formatCurrency(j.extraCharges)}{j.extraChargesNote ? ` (${j.extraChargesNote})` : ' extra'}</p>}</div>
                    <div><p className="text-[11px] text-gray-400 uppercase">Payable</p><p className="font-semibold">{formatCurrency(j.payable)}</p></div>
                    <div><p className="text-[11px] text-gray-400 uppercase">Paid</p><p className="font-semibold text-emerald-600">{formatCurrency(j.paid)}</p></div>
                    <div><p className="text-[11px] text-gray-400 uppercase">Pending</p><p className={`font-semibold ${j.pending > 0 ? 'text-red-500' : 'text-gray-400'}`}>{j.pending > 0 ? formatCurrency(j.pending) : '—'}</p></div>
                  </div>

                  {j.status !== 'Cancelled' && (
                    <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} /></div>
                  )}

                  {(j.rating > 0 || j.feedback) && (
                    <div className="mt-4 bg-amber-50/60 border border-amber-100 rounded-lg px-3 py-2 text-sm">
                      {j.rating > 0 && <div className="flex items-center gap-2"><Stars value={j.rating} /><span className="text-xs text-gray-500">{j.rating}/5</span></div>}
                      {j.feedback && <p className="text-gray-600 mt-1">{j.feedback}</p>}
                    </div>
                  )}
                </div>

                {/* Payment history for this job */}
                <div className="border-t bg-gray-50/50">
                  {j.payments.length === 0 ? (
                    <p className="px-5 py-3 text-xs text-gray-400">No payments made on this job yet</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <tbody className="divide-y">
                          {j.payments.map((p) => (
                            <tr key={p._id}>
                              <td className="pl-5 pr-3 py-2.5 text-gray-400 whitespace-nowrap">{formatDate(p.paymentDate)}</td>
                              <td className="px-3 py-2.5"><span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded whitespace-nowrap">{p.paymentType}</span></td>
                              <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{p.paymentMethod}</td>
                              <td className="px-3 py-2.5 text-xs text-gray-400">{[p.reference, p.remarks].filter(Boolean).join(' · ')}</td>
                              <td className="px-3 py-2.5 font-semibold text-red-500 whitespace-nowrap text-right">{formatCurrency(p.amount)}</td>
                              <td className="pr-4 py-2.5 w-20">
                                <div className="flex gap-1 justify-end">
                                  <button className="p-1 hover:bg-gray-100 rounded" onClick={() => open(setPayModal, { initial: p, lockedJobId: j._id })}><Pencil className="w-3.5 h-3.5 text-gray-500" /></button>
                                  <button className="p-1 hover:bg-red-50 rounded" onClick={() => { if (confirm('Delete this payment? It will also be removed from your expenses.')) deletePayment.mutate(p._id); }}><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
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
            );
          })}
        </div>
      )}

      {freelancerModal !== null && (
        <FreelancerModal initial={freelancerModal.initial} saving={saveFreelancer.isPending} error={modalError} onClose={close} onSave={(d: any) => saveFreelancer.mutate(d)} />
      )}
      {jobModal !== null && (
        <JobModal initial={jobModal.initial} freelancers={[f]} presetFreelancerId={f._id} clients={clients}
          saving={saveJob.isPending} error={modalError} onClose={close}
          onSave={(d: any) => saveJob.mutate({ jid: jobModal.initial?._id, d })} />
      )}
      {payModal !== null && (
        <PaymentModal jobs={payableJobs} lockedJobId={payModal.lockedJobId} initial={payModal.initial}
          saving={savePayment.isPending} error={modalError} onClose={close}
          onSave={(d: any) => savePayment.mutate({ pid: payModal.initial?._id, d })} />
      )}
    </div>
  );
}