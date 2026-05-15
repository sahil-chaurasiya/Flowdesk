/**
 * exportUtils.js
 * Client-side CSV and Excel export utilities.
 * No extra dependencies needed — CSV is pure JS, Excel uses the xlsx
 * package already installed (imported dynamically to keep bundle lean).
 */

// ── CSV ───────────────────────────────────────────────────────────────────────

function escapeCell(v) {
  if (v == null) return '';
  const s = String(v).replace(/"/g, '""');
  return /[",\n\r]/.test(s) ? `"${s}"` : s;
}

export function arrayToCSV(rows, headers) {
  const lines = [headers.map(escapeCell).join(',')];
  rows.forEach(row => lines.push(headers.map(h => escapeCell(row[h])).join(',')));
  return lines.join('\r\n');
}

export function downloadCSV(filename, rows, headers) {
  const csv = arrayToCSV(rows, headers);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Excel (xlsx) ──────────────────────────────────────────────────────────────

export async function downloadExcel(filename, rows, headers, sheetName = 'Sheet1') {
  // Dynamic import so the chunk is only loaded when needed
  const XLSX = await import('xlsx');
  const data  = [headers, ...rows.map(row => headers.map(h => row[h] ?? ''))];
  const ws    = XLSX.utils.aoa_to_sheet(data);
  const wb    = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ── Domain-specific helpers ────────────────────────────────────────────────────

export function exportTasks(tasks, format = 'csv') {
  const headers = ['title', 'status', 'priority', 'category', 'client', 'assignedTo', 'deadline', 'createdAt'];
  const rows = tasks.map(t => ({
    title:      t.title,
    status:     t.status,
    priority:   t.priority,
    category:   t.category,
    client:     t.client?.company || '',
    assignedTo: t.assignedTo?.name || '',
    deadline:   t.deadline ? new Date(t.deadline).toLocaleDateString() : '',
    createdAt:  new Date(t.createdAt).toLocaleDateString(),
  }));

  if (format === 'xlsx') return downloadExcel('tasks-export', rows, headers, 'Tasks');
  downloadCSV('tasks-export', rows, headers);
}

export function exportLeads(leads, format = 'csv') {
  const headers = ['name', 'email', 'phone', 'company', 'location', 'source', 'campaign', 'status', 'quality', 'batchLabel', 'leadDate'];
  const rows = leads.map(l => ({
    name:       l.name,
    email:      l.email,
    phone:      l.phone,
    company:    l.company,
    location:   l.location,
    source:     l.source,
    campaign:   l.campaign,
    status:     l.status,
    quality:    l.quality,
    batchLabel: l.batchLabel,
    leadDate:   l.leadDate ? new Date(l.leadDate).toLocaleDateString() : '',
  }));

  if (format === 'xlsx') return downloadExcel('leads-export', rows, headers, 'Leads');
  downloadCSV('leads-export', rows, headers);
}

export function exportClients(clients, format = 'csv') {
  const headers = ['company', 'name', 'email', 'phone', 'industry', 'status', 'createdAt'];
  const rows = clients.map(c => ({
    company:   c.company,
    name:      c.name,
    email:     c.email,
    phone:     c.phone,
    industry:  c.industry,
    status:    c.status,
    createdAt: new Date(c.createdAt).toLocaleDateString(),
  }));

  if (format === 'xlsx') return downloadExcel('clients-export', rows, headers, 'Clients');
  downloadCSV('clients-export', rows, headers);
}
