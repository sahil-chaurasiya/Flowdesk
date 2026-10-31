/**
 * Revenue & Finance API client.
 *
 * The standalone accountant app had its own axios instance, its own token in
 * localStorage('token') and its own login. In the unified app Flowdesk signs
 * the user in, so this re-uses Flowdesk's axios instance (access token + silent
 * refresh) and prefixes every path with /finance → /api/finance/*.
 * The accountant's /auth endpoints are intentionally gone.
 */
import flowdeskApi from '../../../lib/api';

const pre = (u: string) => `/finance${u}`;
const api = {
  get: (u: string, c?: any) => flowdeskApi.get(pre(u), c),
  delete: (u: string, c?: any) => flowdeskApi.delete(pre(u), c),
  post: (u: string, d?: any, c?: any) => flowdeskApi.post(pre(u), d, c),
  put: (u: string, d?: any, c?: any) => flowdeskApi.put(pre(u), d, c),
  patch: (u: string, d?: any, c?: any) => flowdeskApi.patch(pre(u), d, c),
};

// Clients
export const clientsApi = {
  getAll: (params?: any) => api.get('/clients', { params }),
  getOne: (id: string) => api.get(`/clients/${id}`),
  create: (data: any) => api.post('/clients', data),
  update: (id: string, data: any) => api.put(`/clients/${id}`, data),
  reorder: (order: string[]) => api.put('/clients/reorder', { order }),
  pause: (id: string) => api.post(`/clients/${id}/pause`, {}),
  resume: (id: string) => api.post(`/clients/${id}/resume`, {}),
  complete: (id: string, endDate?: string) => api.post(`/clients/${id}/complete`, endDate ? { endDate } : {}),
  reactivate: (id: string) => api.post(`/clients/${id}/reactivate`, {}),
  setMonthValue: (id: string, month: number, year: number, value: number | null) => api.put(`/clients/${id}/month-value`, { month, year, value }),
  delete: (id: string) => api.delete(`/clients/${id}`),
};

// Payments
export const paymentsApi = {
  getAll: (params?: any) => api.get('/payments', { params }),
  create: (data: any) => api.post('/payments', data),
  update: (id: string, data: any) => api.put(`/payments/${id}`, data),
  delete: (id: string) => api.delete(`/payments/${id}`),
};

// Invoices — hands out stable invoice numbers (tofly_oct_2026_001, ...) for a client's monthly invoice
export const invoicesApi = {
  getMonthlyNumber: (clientId: string, month: number, year: number, amount?: number) =>
    api.post('/invoices/monthly', { clientId, month, year, amount }),
};

// Employees
export const employeesApi = {
  getAll: () => api.get('/employees'),
  create: (data: any) => api.post('/employees', data),
  update: (id: string, data: any) => api.put(`/employees/${id}`, data),
  delete: (id: string) => api.delete(`/employees/${id}`),
};

// Salaries
export const salariesApi = {
  getAll: (params?: any) => api.get('/salaries', { params }),
  getMonthlySummary: (month: number, year: number) => api.get(`/salaries/summary/${month}/${year}`),
  create: (data: any) => api.post('/salaries', data),
  update: (id: string, data: any) => api.put(`/salaries/${id}`, data),
  revert: (id: string) => api.put(`/salaries/${id}/revert`),
};

// Expenses
export const expensesApi = {
  getAll: (params?: any) => api.get('/expenses', { params }),
  getMonthlySummary: (month: number, year: number) => api.get(`/expenses/summary/${month}/${year}`),
  create: (data: any) => api.post('/expenses', data),
  update: (id: string, data: any) => api.put(`/expenses/${id}`, data),
  delete: (id: string) => api.delete(`/expenses/${id}`),
};

// EMI
export const emiApi = {
  getLoans: () => api.get('/emis'),
  getLoan: (id: string) => api.get(`/emis/${id}`),
  createLoan: (data: any) => api.post('/emis', data),
  updateLoan: (id: string, data: any) => api.put(`/emis/${id}`, data),
  deleteLoan: (id: string) => api.delete(`/emis/${id}`),
  recordPayment: (data: any) => api.post('/emis/payment', data),
  deletePayment: (id: string) => api.delete(`/emis/payment/${id}`),
};

// Accounting
export const accountingApi = {
  getAll: () => api.get('/accounting'),
  getMonth: (month: number, year: number) => api.get(`/accounting/${month}/${year}`),
  upsert: (data: any) => api.post('/accounting', data),
};

// Dashboard
export const dashboardApi = {
  get: (params?: { month?: number; year?: number }) => api.get('/dashboard', { params }),
};

// Reports
export const reportsApi = {
  get: (params: any) => api.get('/reports', { params }),
};

// Services
export const servicesApi = {
  getAll: () => api.get('/services'),
  create: (data: any) => api.post('/services', data),
  update: (id: string, data: any) => api.put(`/services/${id}`, data),
  delete: (id: string) => api.delete(`/services/${id}`),
};

// Freelancers — people hired per job: their jobs, and what we paid them
export const freelancersApi = {
  getAll: () => api.get('/freelancers'),
  getOne: (id: string) => api.get(`/freelancers/${id}`),
  create: (data: any) => api.post('/freelancers', data),
  update: (id: string, data: any) => api.put(`/freelancers/${id}`, data),
  delete: (id: string) => api.delete(`/freelancers/${id}`),
  getMonthlySummary: (month: number, year: number) => api.get(`/freelancers/summary/${month}/${year}`),
  // Jobs
  getJobs: (params?: any) => api.get('/freelancers/jobs', { params }),
  createJob: (data: any) => api.post('/freelancers/jobs', data),
  updateJob: (id: string, data: any) => api.put(`/freelancers/jobs/${id}`, data),
  deleteJob: (id: string) => api.delete(`/freelancers/jobs/${id}`),
  // Payments
  getPayments: (params?: any) => api.get('/freelancers/payments', { params }),
  createPayment: (data: any) => api.post('/freelancers/payments', data),
  updatePayment: (id: string, data: any) => api.put(`/freelancers/payments/${id}`, data),
  deletePayment: (id: string) => api.delete(`/freelancers/payments/${id}`),
};

export default api;

// Company Settings
export const companySettingsApi = {
  get: () => api.get('/company-settings'),
  update: (data: any) => api.put('/company-settings', data),
};