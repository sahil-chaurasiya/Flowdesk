import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientsApi, servicesApi, companySettingsApi } from '../services/api';
import { Service, Client, CompanySettings } from '../types';
import { generateInvoicePdf, defaultCompany } from '../lib/invoicePdf';
import { FileText, Plus, Minus, Download, X, Pencil, Trash2, Save, Settings2, UserPlus } from 'lucide-react';

interface LineItem {
  service: Service;
  quantity: number;
}

export default function InvoicePage() {
  const [selectedClient, setSelectedClient] = useState('');
  const [customClientName, setCustomClientName] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [notes, setNotes] = useState('');
  const [pendingAmountInput, setPendingAmountInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  // Inline service management (add / edit / delete services without leaving the invoice page)
  const queryClient = useQueryClient();
  const [showServiceManager, setShowServiceManager] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [svcName, setSvcName] = useState('');
  const [svcPrice, setSvcPrice] = useState('');
  const [svcDesc, setSvcDesc] = useState('');
  const [svcError, setSvcError] = useState('');

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: async () => { const r = await clientsApi.getAll(); return r.data; },
  });

  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: async () => { const r = await servicesApi.getAll(); return r.data; },
  });

  const { data: companyData } = useQuery<CompanySettings>({
    queryKey: ['company-settings'],
    queryFn: async () => { const r = await companySettingsApi.get(); return r.data; },
  });

  const company = companyData || defaultCompany;

  const createSvcMut = useMutation({
    mutationFn: (d: any) => servicesApi.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['services'] }); resetServiceForm(); },
    onError: (e: any) => setSvcError(e.response?.data?.message || 'Failed to create service'),
  });
  const updateSvcMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => servicesApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['services'] }); resetServiceForm(); },
    onError: (e: any) => setSvcError(e.response?.data?.message || 'Failed to update service'),
  });
  const deleteSvcMut = useMutation({
    mutationFn: (id: string) => servicesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services'] }),
  });

  const openNewService = () => {
    setEditingService(null);
    setSvcName('');
    setSvcPrice('');
    setSvcDesc('');
    setSvcError('');
    setShowServiceForm(true);
  };

  const openEditService = (s: Service) => {
    setEditingService(s);
    setSvcName(s.name);
    setSvcPrice(String(s.price));
    setSvcDesc(s.description || '');
    setSvcError('');
    setShowServiceForm(true);
  };

  const resetServiceForm = () => {
    setShowServiceForm(false);
    setEditingService(null);
    setSvcName('');
    setSvcPrice('');
    setSvcDesc('');
    setSvcError('');
  };

  const handleSaveService = () => {
    if (!svcName.trim()) { setSvcError('Service name is required'); return; }
    if (!svcPrice || Number(svcPrice) < 0) { setSvcError('Enter a valid price'); return; }
    const data = { name: svcName.trim(), price: Number(svcPrice), description: svcDesc.trim(), isActive: true };
    if (editingService) updateSvcMut.mutate({ id: editingService._id, data });
    else createSvcMut.mutate(data);
  };

  useEffect(() => {
    const now = new Date();
    const num = `tofly${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    setInvoiceNumber(num);
  }, []);

  const activeServices = services.filter(s => s.isActive);
  const selectedClientObj = clients.find(c => c._id === selectedClient);
  const billToName = selectedClientObj ? selectedClientObj.name : customClientName.trim();
  const filteredClients = clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()));
  const exactClientMatch = clients.some(c => c.name.toLowerCase() === clientSearch.trim().toLowerCase());

  const addService = (service: Service) => {
    setLineItems(prev => {
      const existing = prev.find(li => li.service._id === service._id);
      if (existing) return prev.map(li => li.service._id === service._id ? { ...li, quantity: li.quantity + 1 } : li);
      return [...prev, { service, quantity: 1 }];
    });
  };

  const removeItem = (id: string) => setLineItems(prev => prev.filter(li => li.service._id !== id));
  const changeQty = (id: string, delta: number) => {
    setLineItems(prev => prev.map(li => {
      if (li.service._id !== id) return li;
      const newQty = li.quantity + delta;
      return newQty < 1 ? li : { ...li, quantity: newQty };
    }));
  };

  const subtotal = lineItems.reduce((s, li) => s + li.service.price * li.quantity, 0);
  const pendingAmount = parseFloat(pendingAmountInput) || 0;
  const grandTotal = subtotal + pendingAmount;

  const generatePDF = async () => {
    if (!billToName || lineItems.length === 0) return;
    setGenerating(true);
    try {
      await generateInvoicePdf({
        company,
        billToName,
        invoiceNumber,
        invoiceDate,
        notes,
        pendingAmount,
        lineItems: lineItems.map(li => ({
          name: li.service.name,
          description: li.service.description,
          price: li.service.price,
          quantity: li.quantity,
        })),
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Generate Invoice</h1>
        <p className="text-gray-500 text-sm mt-1">Fill in the details and click Generate PDF</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left: Invoice Details */}
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Invoice Details</h3>

          <div className="relative">
            <label className="text-sm font-medium text-gray-700">Bill To (Client)</label>
            <input
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Search client or type a new name..."
              value={selectedClientObj ? selectedClientObj.name : clientSearch}
              onChange={e => { setClientSearch(e.target.value); setSelectedClient(''); setCustomClientName(''); setShowClientDropdown(true); }}
              onFocus={() => setShowClientDropdown(true)}
              onBlur={() => setTimeout(() => setShowClientDropdown(false), 150)}
            />
            {customClientName && !selectedClientObj && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <UserPlus className="w-3 h-3" /> Using custom client "{customClientName}" (not saved to your client list)
              </p>
            )}
            {showClientDropdown && clientSearch.trim() && (
              <div className="absolute z-10 w-full bg-white border rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                {filteredClients.map(c => (
                  <button
                    key={c._id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                    onMouseDown={() => { setSelectedClient(c._id); setCustomClientName(''); setClientSearch(''); setShowClientDropdown(false); }}
                  >
                    {c.name}
                  </button>
                ))}
                {!exactClientMatch && (
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-primary flex items-center gap-1.5 border-t"
                    onMouseDown={() => { setCustomClientName(clientSearch.trim()); setSelectedClient(''); setShowClientDropdown(false); }}
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Use "{clientSearch.trim()}" as client
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Invoice Number</label>
            <input
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Invoice Date</label>
            <input
              type="date"
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={invoiceDate}
              onChange={e => setInvoiceDate(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Notes (optional)</label>
            <textarea
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              rows={2}
              placeholder="Any additional notes..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Right: Service Picker */}
        <div className="bg-white rounded-xl border p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Add Services</h3>
            <button
              onClick={() => { setShowServiceManager(v => !v); resetServiceForm(); }}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-primary px-2 py-1 rounded hover:bg-gray-50"
            >
              <Settings2 className="w-3.5 h-3.5" /> {showServiceManager ? 'Done' : 'Manage'}
            </button>
          </div>

          {showServiceManager && (
            <div className="space-y-3">
              {!showServiceForm && (
                <button
                  onClick={openNewService}
                  className="flex items-center gap-1.5 bg-primary text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"
                >
                  <Plus className="w-4 h-4" /> Add New Service
                </button>
              )}

              {showServiceForm && (
                <div className="p-3 border-2 border-primary/30 bg-primary/5 rounded-lg space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-800">
                      {editingService ? 'Edit Service' : 'New Service'}
                    </h4>
                    <button onClick={resetServiceForm} className="p-1 hover:bg-gray-100 rounded">
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
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
                  <div>
                    <label className="text-xs font-medium text-gray-600">Description</label>
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
                <p className="text-sm text-gray-400">No services yet. Add your first one above.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {services.map(s => (
                    <div
                      key={s._id}
                      className={`flex items-center gap-2 p-2.5 border rounded-lg ${s.isActive ? '' : 'opacity-50 bg-gray-50'}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                        {!s.isActive && <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">Inactive</span>}
                      </div>
                      <span className="text-xs font-semibold text-primary flex-shrink-0">Rs.{s.price.toLocaleString('en-IN')}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => openEditService(s)} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { if (window.confirm(`Delete "${s.name}"?`)) deleteSvcMut.mutate(s._id); }}
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

          {!showServiceManager && (
            activeServices.length === 0 ? (
              <p className="text-sm text-gray-400">No services configured. Click "Manage" above to add one.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {activeServices.map(s => (
                  <button
                    key={s._id}
                    onClick={() => addService(s)}
                    className="w-full flex items-center justify-between px-3 py-2.5 border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-left group"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                      {s.description && <p className="text-xs text-gray-400 truncate">{s.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-sm font-semibold text-primary">Rs.{s.price.toLocaleString('en-IN')}</span>
                      <Plus className="w-4 h-4 text-gray-400 group-hover:text-primary" />
                    </div>
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Line Items */}
      {lineItems.length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Selected Services</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="text-left pb-2 font-medium">Service</th>
                <th className="text-center pb-2 font-medium w-24">Qty</th>
                <th className="text-right pb-2 font-medium w-28">Price</th>
                <th className="text-right pb-2 font-medium w-32">Amount</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map(li => (
                <tr key={li.service._id} className="border-b last:border-0">
                  <td className="py-3">
                    <p className="font-medium text-gray-900">{li.service.name}</p>
                    {li.service.description && (
                      <ul className="text-xs text-gray-400 list-disc list-inside mt-0.5 space-y-0.5">
                        {li.service.description
                          .split(/\r?\n/)
                          .map(line => line.replace(/^[-•]\s*/, '').trim())
                          .filter(Boolean)
                          .map((line, i) => <li key={i}>{line}</li>)}
                      </ul>
                    )}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => changeQty(li.service._id, -1)} className="w-6 h-6 flex items-center justify-center border rounded hover:bg-gray-100">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center font-medium">{li.quantity}</span>
                      <button onClick={() => changeQty(li.service._id, 1)} className="w-6 h-6 flex items-center justify-center border rounded hover:bg-gray-100">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                  <td className="py-3 text-right text-gray-600">Rs.{li.service.price.toLocaleString('en-IN')}</td>
                  <td className="py-3 text-right font-medium">Rs.{(li.service.price * li.quantity).toLocaleString('en-IN')}</td>
                  <td className="py-3 pl-2">
                    <button onClick={() => removeItem(li.service._id)} className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {/* Pending Amount Row */}
              <tr>
                <td colSpan={3} className="pt-3 text-right text-gray-700 font-medium">Pending Amount</td>
                <td className="pt-3 text-right">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={pendingAmountInput}
                    onChange={e => setPendingAmountInput(e.target.value)}
                    className="w-32 border rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </td>
                <td></td>
              </tr>
              {/* Total Row */}
              <tr>
                <td colSpan={3} className="pt-4 text-right font-bold text-gray-700">Total</td>
                <td className="pt-4 text-right font-bold text-lg text-primary">Rs.{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Generate Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={generatePDF}
          disabled={!billToName || lineItems.length === 0 || generating}
          className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? (
            <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span> Generating...</>
          ) : (
            <><Download className="w-4 h-4" /> Generate PDF Invoice</>
          )}
        </button>
        {(!billToName || lineItems.length === 0) && (
          <p className="text-sm text-gray-400">
            {!billToName ? 'Select or type a client name' : 'Add at least one service'}
          </p>
        )}
      </div>

      {lineItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl text-gray-400">
          <FileText className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">Select a client and add services to generate an invoice</p>
        </div>
      )}
    </div>
  );
}