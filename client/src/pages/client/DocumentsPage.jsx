import React, { useState, useEffect, useRef } from 'react';
import { FileText, Plus, Save, X, Loader, Edit3 } from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { Spinner } from '../../components/shared/LoadingScreen';

// ── Reuse the same sanitizer used in admin side ────────────────────────────────
function sanitizeHtml(dirty) {
  if (!dirty) return '';
  return dirty
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/ on\w+="[^"]*"/g, '')
    .replace(/ on\w+='[^']*'/g, '');
}

// ── Minimal toolbar for client edit mode ──────────────────────────────────────
function ClientRichToolbar({ editorRef }) {
  const cmd = (command, value = null) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  };
  const TB = ({ onClick, title, children }) => (
    <button
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className="flex items-center justify-center rounded transition-all"
      style={{ width: 28, height: 28, flexShrink: 0, color: 'var(--fd-ink-2)', fontSize: 12, fontWeight: 600 }}
    >
      {children}
    </button>
  );
  const sep = <div style={{ width: 1, height: 18, background: 'var(--fd-border-strong)', margin: '0 3px', flexShrink: 0 }} />;
  return (
    <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 border-b select-none"
      style={{ borderColor: 'var(--fd-border)', background: 'var(--fd-surface)', minHeight: 40 }}>
      <TB onClick={() => cmd('bold')} title="Bold"><span style={{ fontWeight: 700, fontFamily: 'Georgia,serif', fontSize: 13 }}>B</span></TB>
      <TB onClick={() => cmd('italic')} title="Italic"><span style={{ fontStyle: 'italic', fontFamily: 'Georgia,serif', fontSize: 13 }}>I</span></TB>
      <TB onClick={() => cmd('underline')} title="Underline"><span style={{ textDecoration: 'underline', fontSize: 12 }}>U</span></TB>
      {sep}
      <TB onClick={() => cmd('insertUnorderedList')} title="Bullet list">
        <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor"><circle cx="1.5" cy="2.5" r="1.2"/><rect x="4" y="1.8" width="8" height="1.4" rx="0.7"/><circle cx="1.5" cy="6" r="1.2"/><rect x="4" y="5.3" width="8" height="1.4" rx="0.7"/><circle cx="1.5" cy="9.5" r="1.2"/><rect x="4" y="8.8" width="8" height="1.4" rx="0.7"/></svg>
      </TB>
      <TB onClick={() => cmd('insertOrderedList')} title="Numbered list">
        <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor"><rect x="4" y="1.8" width="8" height="1.4" rx="0.7"/><rect x="4" y="5.3" width="8" height="1.4" rx="0.7"/><rect x="4" y="8.8" width="8" height="1.4" rx="0.7"/></svg>
      </TB>
      {sep}
      <TB onClick={() => cmd('undo')} title="Undo">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
      </TB>
      <TB onClick={() => cmd('redo')} title="Redo">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>
      </TB>
    </div>
  );
}

// ── Document viewer/editor modal ──────────────────────────────────────────────
function DocViewerModal({ doc, canEdit, onClose, onSave }) {
  const editorRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (editorRef.current && !initialized.current) {
      initialized.current = true;
      editorRef.current.innerHTML = doc.html || '';
    }
  }, [doc.html]);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ html: editorRef.current?.innerHTML || '', title: doc.title });
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex flex-col rounded-2xl shadow-2xl overflow-hidden"
        style={{ width: 'min(92vw, 860px)', height: '88vh', background: 'var(--fd-surface)', border: '1px solid var(--fd-border)' }}>

        {/* Title bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b flex-shrink-0"
          style={{ borderColor: 'var(--fd-border)', background: 'var(--fd-surface)' }}>
          <FileText size={15} style={{ color: '#4f6ef0', flexShrink: 0 }} />
          <span className="flex-1 font-semibold text-[14px] truncate" style={{ color: 'var(--fd-ink-1)' }}>{doc.title}</span>
          <div className="flex items-center gap-2 flex-shrink-0">
            {canEdit && !editing && (
              <button onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold"
                style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-2)', border: '1px solid var(--fd-border-strong)' }}>
                <Edit3 size={12} /> Edit
              </button>
            )}
            {editing && (
              <>
                <button onClick={() => setEditing(false)}
                  className="px-3 py-1.5 rounded-xl text-[12px] font-medium"
                  style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-2)' }}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold"
                  style={{ background: '#4f6ef0', color: '#fff', opacity: saving ? 0.7 : 1 }}>
                  {saving ? <Loader size={12} className="animate-spin" /> : <Save size={12} />}
                  Save
                </button>
              </>
            )}
            <button onMouseDown={onClose} className="p-1.5 rounded-xl" style={{ color: 'var(--fd-ink-3)' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Toolbar if editing */}
        {editing && <ClientRichToolbar editorRef={editorRef} />}

        {/* Document area */}
        <div className="flex-1 overflow-y-auto py-8 px-6" style={{ background: '#f0f0f0' }}>
          <div style={{
            maxWidth: 720,
            margin: '0 auto',
            background: '#ffffff',
            minHeight: 'calc(100% - 32px)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 4px 24px rgba(0,0,0,0.08)',
            borderRadius: 2,
            padding: '48px 56px',
            color: '#111',
          }}>
            {editing ? (
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                spellCheck
                className="outline-none fd-rich-editor"
                style={{ minHeight: 400, fontSize: 14, lineHeight: 1.8, color: '#111', fontFamily: 'ui-sans-serif, system-ui, sans-serif', caretColor: '#4f6ef0' }}
              />
            ) : (
              <div
                className="fd-rich-editor"
                style={{ minHeight: 400, fontSize: 14, lineHeight: 1.8, color: '#111', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(doc.html) || '<p style="color:#9ca3af;font-style:italic;">This document is empty.</p>' }}
              />
            )}
          </div>
        </div>
      </div>

      <style>{`
        .fd-rich-editor h1 { font-size: 2em; font-weight: 700; margin: 0.67em 0; }
        .fd-rich-editor h2 { font-size: 1.5em; font-weight: 700; margin: 0.75em 0; }
        .fd-rich-editor h3 { font-size: 1.17em; font-weight: 700; margin: 0.83em 0; }
        .fd-rich-editor p  { margin: 0.5em 0; }
        .fd-rich-editor ul { list-style: disc; padding-left: 1.5em; margin: 0.5em 0; }
        .fd-rich-editor ol { list-style: decimal; padding-left: 1.5em; margin: 0.5em 0; }
        .fd-rich-editor li { margin: 0.25em 0; }
        .fd-rich-editor table { border-collapse: collapse; width: 100%; margin: 10px 0; }
        .fd-rich-editor th { border: 1px solid #d1d5db; padding: 7px 10px; background: #f9fafb; font-weight: 700; font-size: 13px; }
        .fd-rich-editor td { border: 1px solid #d1d5db; padding: 7px 10px; font-size: 13px; }
      `}</style>
    </div>
  );
}

// ── Main DocumentsPage ─────────────────────────────────────────────────────────
export default function DocumentsPage() {
  const { user } = useAuthStore();
  const clientId = user?.clientId;

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDoc, setOpenDoc] = useState(null);
  const [error, setError] = useState('');

  const fetchDocs = async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/documents?client=${clientId}`);
      setDocs(data.documents || []);
    } catch {
      setError('Failed to load documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDocs(); }, [clientId]);

  const handleSave = async ({ html, title }) => {
    if (!openDoc) return;
    try {
      const { data } = await api.put(`/documents/${openDoc._id}`, { html, title });
      setDocs(prev => prev.map(d => d._id === openDoc._id ? data.document : d));
      setOpenDoc(data.document);
    } catch {
      // silently fail — user will see no change
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold" style={{ color: 'var(--fd-ink-1)' }}>Documents</h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>
            Documents shared with you by your account team
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : error ? (
        <div className="text-center py-16 text-[var(--fd-ink-3)]">{error}</div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl"
          style={{ background: 'var(--fd-surface)', border: '1px dashed var(--fd-border-strong)' }}>
          <FileText size={40} style={{ color: 'var(--fd-border)', marginBottom: 12 }} />
          <p className="font-semibold text-[15px]" style={{ color: 'var(--fd-ink-3)' }}>No documents yet</p>
          <p className="text-[12px] mt-1" style={{ color: 'var(--fd-ink-5)' }}>
            Your account manager will share documents here when ready
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {docs.map(doc => (
            <div
              key={doc._id}
              onClick={() => setOpenDoc(doc)}
              className="group relative rounded-xl border overflow-hidden transition-shadow hover:shadow-md cursor-pointer"
              style={{ background: 'var(--fd-surface)', borderColor: 'var(--fd-border)' }}
            >
              {/* Edit badge */}
              {doc.clientCanEdit && (
                <div className="absolute top-2 right-2 z-10">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: '#dcfce7', color: '#15803d' }}>
                    ✏️ Editable
                  </span>
                </div>
              )}

              <div className="p-4 pt-5">
                <div className="flex items-start gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: '#eff0fe' }}>
                    <FileText size={15} style={{ color: '#4f6ef0' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[14px] truncate" style={{ color: 'var(--fd-ink-1)' }}>
                      {doc.title}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--fd-ink-4)' }}>
                      by {doc.createdBy?.name || 'Team'}
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div
                  className="text-[12px] leading-relaxed"
                  style={{ color: 'var(--fd-ink-3)', overflow: 'hidden', maxHeight: 56, WebkitLineClamp: 3, display: '-webkit-box', WebkitBoxOrient: 'vertical' }}
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(doc.html) || '<p style="font-style:italic;">Empty document</p>'
                  }}
                />

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: 'var(--fd-ink-5)' }}>
                    {doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1"
                    style={{ background: 'var(--fd-surface-sunken)', color: 'var(--fd-ink-3)' }}>
                    {doc.clientCanEdit ? <Edit3 size={9} /> : null}
                    {doc.clientCanEdit ? 'View & Edit' : 'View only'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {openDoc && (
        <DocViewerModal
          doc={openDoc}
          canEdit={openDoc.clientCanEdit}
          onClose={() => setOpenDoc(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}