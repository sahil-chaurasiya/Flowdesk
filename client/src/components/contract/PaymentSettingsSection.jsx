import React, { useEffect, useState } from 'react';
import { Save, Upload } from 'lucide-react';
import api from '../../lib/api';
import { Button, Input, useToast } from '../../components/ui/index';
import useAuthStore from '../../context/authStore';

export default function PaymentSettingsSection() {
  const { user }       = useAuthStore();
  const { showToast }  = useToast();
  const isAdmin        = user?.role === 'admin';

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({
    upiId: '', bankAccountName: '', accountNumber: '', ifscCode: '',
  });
  const [qrFile, setQrFile]     = useState(null);
  const [qrPreview, setPreview] = useState(null);

  useEffect(() => {
    api.get('/payments/settings')
      .then(r => {
        const s = r.data.settings || {};
        setForm({
          upiId: s.upiId || '',
          bankAccountName: s.bankAccountName || '',
          accountNumber:   s.accountNumber   || '',
          ifscCode:        s.ifscCode        || '',
        });
        if (s.qrImageUrl) setPreview(s.qrImageUrl);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleQrChange = e => {
    const f = e.target.files[0];
    if (!f) return;
    setQrFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (qrFile) fd.append('qrImage', qrFile);
      await api.put('/payments/settings', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showToast('Payment settings saved', 'success');
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to save', 'error');
    } finally { setSaving(false); }
  };

  if (loading) return null;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="rounded-xl p-5"
      style={{ background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}>
      <div className="mb-4">
        <h3 className="text-[14px] font-semibold" style={{ color: 'var(--fd-ink-1)' }}>
          Payment Settings
        </h3>
        <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--fd-ink-3)' }}>
          Configure UPI and bank details shown to clients for contract renewals.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="UPI ID"
          value={form.upiId}
          onChange={e => set('upiId', e.target.value)}
          placeholder="yourname@upi"
          disabled={!isAdmin}
        />
        <Input
          label="Bank Account Name"
          value={form.bankAccountName}
          onChange={e => set('bankAccountName', e.target.value)}
          placeholder="Account holder name"
          disabled={!isAdmin}
        />
        <Input
          label="Account Number"
          value={form.accountNumber}
          onChange={e => set('accountNumber', e.target.value)}
          placeholder="Bank account number"
          disabled={!isAdmin}
        />
        <Input
          label="IFSC Code"
          value={form.ifscCode}
          onChange={e => set('ifscCode', e.target.value)}
          placeholder="e.g. HDFC0001234"
          disabled={!isAdmin}
        />
      </div>

      <div className="mt-4">
        <label className="block text-[12px] font-medium mb-2"
          style={{ color: 'var(--fd-ink-2)' }}>
          QR Code Image
        </label>
        <div className="flex items-start gap-4">
          {qrPreview && (
            <img src={qrPreview} alt="QR Code"
              className="w-28 h-28 rounded-lg object-contain"
              style={{ border: '1px solid var(--fd-border)' }} />
          )}
          {isAdmin && (
            <div>
              <label
                className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-[12.5px] font-medium transition-colors"
                style={{
                  background: 'var(--fd-surface-sunken)',
                  border: '1px solid var(--fd-border)',
                  color: 'var(--fd-ink-2)',
                }}
              >
                <Upload size={13} />
                {qrPreview ? 'Change QR Image' : 'Upload QR Image'}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleQrChange}
                />
              </label>
              <p className="text-[11px] mt-1" style={{ color: 'var(--fd-ink-4)' }}>
                PNG or JPG, max 5 MB
              </p>
            </div>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="mt-5">
          <Button
            onClick={handleSave}
            disabled={saving}
            style={{ background: '#4f6ef0', color: '#fff' }}
          >
            <Save size={13} className="mr-1.5" />
            {saving ? 'Saving…' : 'Save Payment Settings'}
          </Button>
        </div>
      )}
    </div>
  );
}