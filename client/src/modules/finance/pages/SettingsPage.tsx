import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { servicesApi, companySettingsApi } from '../services/api';
import { Save, CheckCircle, Plus, Pencil, Trash2, X, Building2, User, Briefcase, Info } from 'lucide-react';
import { Service, CompanySettings } from '../types';

const defaultCompany: CompanySettings = {
  companyName: 'To Fly Media',
  address: 'MANYA ARCADE, ISBT, Narmadapuram Rd, behind Nexa Showroom, Habib Ganj, Bhopal, Madhya Pradesh 462024',
  tagline: "We've got a PERFECT match for your needs #360marketingsolution",
  phone1: '6260154125',
  phone2: '9752523894',
  accountHolder: 'Aman Bhardwaj',
  accountType: 'Current Account',
  accountNumber: '50200077089748',
  ifsc: 'HDFC0003662',
  branch: 'GULMOHOR, BHOPAL',
  upi: '9752523894',
};

export default function SettingsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'company' | 'services' | 'about'>('company');

  const [company, setCompany] = useState<CompanySettings>(defaultCompany);
  const [companySuccess, setCompanySuccess] = useState('');
  const [companyError, setCompanyError] = useState('');

  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [svcName, setSvcName] = useState('');
  const [svcDesc, setSvcDesc] = useState('');
  const [svcPrice, setSvcPrice] = useState('');
  const [svcError, setSvcError] = useState('');

  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: async () => {
      const r = await servicesApi.getAll();
      return r.data;
    },
  });

  const { data: companyData } = useQuery<CompanySettings>({
    queryKey: ['company-settings'],
    queryFn: async () => {
      const r = await companySettingsApi.get();
      return r.data;
    },
  });

  useEffect(() => {
    if (companyData) setCompany(companyData);
  }, [companyData]);

  const updateCompanyMut = useMutation({
    mutationFn: (d: CompanySettings) => companySettingsApi.update(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-settings'] });
      setCompanySuccess('Company details saved!');
      setTimeout(() => setCompanySuccess(''), 3000);
    },
    onError: (e: any) => setCompanyError(e.response?.data?.message || 'Failed to save'),
  });

  const createSvcMut = useMutation({
    mutationFn: (d: any) => servicesApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] });
      resetServiceForm();
    },
    onError: (e: any) => setSvcError(e.response?.data?.message || 'Failed to create service'),
  });

  const updateSvcMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => servicesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] });
      resetServiceForm();
    },
    onError: (e: any) => setSvcError(e.response?.data?.message || 'Failed to update service'),
  });

  const deleteSvcMut = useMutation({
    mutationFn: (id: string) => servicesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  });

  const handleSaveCompany = () => {
    setCompanyError('');
    if (!company.companyName.trim()) {
      setCompanyError('Company name is required');
      return;
    }
    updateCompanyMut.mutate(company);
  };

  const openNewService = () => {
    setEditingService(null);
    setSvcName('');
    setSvcDesc('');
    setSvcPrice('');
    setSvcError('');
    setShowServiceForm(true);
  };

  const openEditService = (s: Service) => {
    setEditingService(s);
    setSvcName(s.name);
    setSvcDesc(s.description);
    setSvcPrice(String(s.price));
    setSvcError('');
    setShowServiceForm(true);
  };

  const resetServiceForm = () => {
    setShowServiceForm(false);
    setEditingService(null);
    setSvcName('');
    setSvcDesc('');
    setSvcPrice('');
    setSvcError('');
  };

  const handleSaveService = () => {
    setSvcError('');
    if (!svcName.trim()) {
      setSvcError('Service name is required');
      return;
    }
    const price = parseFloat(svcPrice);
    if (isNaN(price) || price < 0) {
      setSvcError('Enter a valid price');
      return;
    }
    const data = { name: svcName.trim(), description: svcDesc.trim(), price };
    if (editingService) updateSvcMut.mutate({ id: editingService._id, data });
    else createSvcMut.mutate(data);
  };

  const toggleActive = (s: Service) => {
    updateSvcMut.mutate({ id: s._id, data: { isActive: !s.isActive } });
  };

  const Field = ({
    label,
    value,
    onChange,
    placeholder,
    type = 'text',
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: string;
  }) => (
    <div>
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <input
        type={type}
        className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account, company details and services</p>
      </div>

      <div className="flex gap-1 border-b overflow-x-auto">
        {([
          { key: 'company', label: 'Company Details', icon: Building2 },
          { key: 'services', label: 'Services & Pricing', icon: Briefcase },
          { key: 'about', label: 'About', icon: Info },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              tab === t.key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'company' && (
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-gray-900">Company Details</h3>
        </div>
        <p className="text-xs text-gray-400 -mt-2">These appear on every generated invoice</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Field
              label="Company Name"
              value={company.companyName}
              onChange={(v) => setCompany((p) => ({ ...p, companyName: v }))}
              placeholder="To Fly Media"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-600">Address</label>
            <textarea
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              rows={2}
              value={company.address}
              onChange={(e) => setCompany((p) => ({ ...p, address: e.target.value }))}
              placeholder="Full address..."
            />
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Tagline"
              value={company.tagline}
              onChange={(v) => setCompany((p) => ({ ...p, tagline: v }))}
              placeholder="Your tagline..."
            />
          </div>
          <Field
            label="Phone 1"
            value={company.phone1}
            onChange={(v) => setCompany((p) => ({ ...p, phone1: v }))}
            placeholder="6260154125"
          />
          <Field
            label="Phone 2 / Office"
            value={company.phone2}
            onChange={(v) => setCompany((p) => ({ ...p, phone2: v }))}
            placeholder="9752523894"
          />
        </div>

        <div className="border-t pt-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Payment / Bank Details</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              label="Account Holder"
              value={company.accountHolder}
              onChange={(v) => setCompany((p) => ({ ...p, accountHolder: v }))}
              placeholder="Aman Bhardwaj"
            />
            <Field
              label="Account Type"
              value={company.accountType}
              onChange={(v) => setCompany((p) => ({ ...p, accountType: v }))}
              placeholder="Current Account"
            />
            <Field
              label="Account Number"
              value={company.accountNumber}
              onChange={(v) => setCompany((p) => ({ ...p, accountNumber: v }))}
              placeholder="50200077089748"
            />
            <Field
              label="IFSC Code"
              value={company.ifsc}
              onChange={(v) => setCompany((p) => ({ ...p, ifsc: v }))}
              placeholder="HDFC0003662"
            />
            <Field
              label="Branch"
              value={company.branch}
              onChange={(v) => setCompany((p) => ({ ...p, branch: v }))}
              placeholder="GULMOHOR, BHOPAL"
            />
            <Field
              label="UPI / Mobile"
              value={company.upi}
              onChange={(v) => setCompany((p) => ({ ...p, upi: v }))}
              placeholder="9752523894"
            />
          </div>
        </div>

        {companyError && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">
            {companyError}
          </div>
        )}
        {companySuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {companySuccess}
          </div>
        )}
        <button
          onClick={handleSaveCompany}
          disabled={updateCompanyMut.isPending}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> Save Company Details
        </button>
      </div>
      )}

      {tab === 'services' && (
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">Services &amp; Pricing</h3>
            <p className="text-xs text-gray-400 mt-0.5">These appear in the Invoice generator</p>
          </div>
          <button
            onClick={openNewService}
            className="flex items-center gap-1.5 bg-primary text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" /> Add Service
          </button>
        </div>

        {showServiceForm && (
          <div className="mb-4 p-4 border-2 border-primary/30 bg-primary/5 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-800">
                {editingService ? 'Edit Service' : 'New Service'}
              </h4>
              <button onClick={resetServiceForm} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Service Name *</label>
                <input
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. Social Media Management"
                  value={svcName}
                  onChange={(e) => setSvcName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Price (Rs.) *</label>
                <input
                  type="number"
                  min="0"
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="15000"
                  value={svcPrice}
                  onChange={(e) => setSvcPrice(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Description (shown on invoice)</label>
              <textarea
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                rows={2}
                placeholder="Brief description of deliverables..."
                value={svcDesc}
                onChange={(e) => setSvcDesc(e.target.value)}
              />
            </div>
            {svcError && <p className="text-xs text-red-500">{svcError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleSaveService}
                disabled={createSvcMut.isPending || updateSvcMut.isPending}
                className="flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" /> {editingService ? 'Update' : 'Save'} Service
              </button>
              <button onClick={resetServiceForm} className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        )}

        {services.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">No services added yet. Click "Add Service" to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {services.map((s) => (
              <div
                key={s._id}
                className={`flex items-center gap-3 p-3 border rounded-lg ${s.isActive ? '' : 'opacity-50 bg-gray-50'}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                    {!s.isActive && (
                      <span className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">Inactive</span>
                    )}
                  </div>
                  {s.description && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{s.description}</p>
                  )}
                </div>
                <span className="text-sm font-bold text-primary flex-shrink-0">
                  Rs.{s.price.toLocaleString('en-IN')}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => toggleActive(s)}
                    className="text-xs px-2 py-1 border rounded hover:bg-gray-50 text-gray-500"
                  >
                    {s.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => openEditService(s)}
                    className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete "${s.name}"?`)) deleteSvcMut.mutate(s._id);
                    }}
                    className="p-1.5 hover:bg-red-50 rounded text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {tab === 'about' && (
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-8 text-center bg-gray-50 border-b">
          <div className="w-16 h-16 mx-auto rounded-2xl overflow-hidden shadow-sm">
            <img src="/icon-512.png" alt="Tofly Accountant" className="w-full h-full object-contain" />
          </div>
          <h3 className="mt-4 font-bold text-lg text-gray-900">Tofly Accountant</h3>
          <p className="text-sm text-gray-500 mt-1">Revenue, clients and payments — all in one place.</p>
          <span className="inline-block mt-3 text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
            Version 1.0.0
          </span>
        </div>
        <div className="p-6 text-center text-xs text-gray-400">
          Built for {company.companyName || 'your agency'} · © {new Date().getFullYear()}
        </div>
      </div>
      )}
    </div>
  );
}