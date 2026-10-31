export interface PauseInterval {
  pausedAt: string;
  resumedAt: string | null;
}

export interface ContractValueOverride {
  year: number;
  month: number;
  value: number;
}

export interface Client {
  _id: string;
  name: string;
  startDate: string;
  contractValue: number;
  // 'monthly' (default) = recurring monthly retainer. 'fixed' = freelance/project
  // client: contractValue is ONE total fee covering `durationMonths` months.
  billingType?: 'monthly' | 'fixed';
  durationMonths?: number;
  notes: string;
  accountManager: string;
  workStatus: 'On Time' | 'Delayed' | '';
  paymentStatus: 'Pending' | 'Partially Paid' | 'Paid' | '';
  isActive: boolean;
  pauseHistory: PauseInterval[];
  // Set once a client's contract is ended — they stop being tracked/billed
  // for any month after the one this date falls in.
  endDate?: string | null;
  // One-off monthly contract value overrides — only the listed (year, month)
  // is affected.
  contractValueOverrides?: ContractValueOverride[];
  // The amount actually owed for the currently-selected month (accounts for
  // any override for that month). Use this instead of `contractValue` for
  // anything tied to a specific month.
  monthContractValue?: number;
  receivedAmount: number;
  pendingAmount: number;
  totalDue: number;
  dueDate?: string | null;
  status: 'Unpaid' | 'Partial' | 'Paid' | 'NotStarted' | 'Upcoming' | 'Paused' | 'Completed' | 'Covered';
  // Fixed-fee clients only: where the selected month sits in the service window.
  cycle?: { position: number; total: number; isBillingMonth: boolean; inWindow: boolean } | null;
  serviceEndDate?: string | null;
  payments?: Payment[];
  monthLedger?: MonthLedgerEntry[];
  createdAt: string;
}

export interface MonthLedgerEntry {
  month: number;
  year: number;
  contractValue: number;
  totalPaid: number;
  remaining: number;
  status: 'Unpaid' | 'Partial' | 'Paid' | 'Upcoming' | 'Paused' | 'Covered';
  dueDate: string;
  billable: boolean;
  payments: Payment[];
  // Fixed-fee clients only
  position?: number;
  total?: number;
  isBillingMonth?: boolean;
  inWindow?: boolean;
}

export interface Payment {
  _id: string;
  clientId?: string | { _id: string; name: string; contractValue: number } | null;
  isOneTime?: boolean;
  customClientName?: string;
  customClientPhone?: string;
  purpose?: string;
  totalAmount?: number;
  amount: number;
  paymentDate: string;
  month?: number;
  year?: number;
  paymentMethod: 'Bank Transfer' | 'Cash' | 'UPI' | 'Cheque' | 'Online';
  remarks: string;
  createdAt: string;
}

export interface Employee {
  _id: string;
  name: string;
  email?: string;
  joiningDate: string;
  monthlySalary: number;
  isActive: boolean;
  // Set once the employee has left. They stop showing up in the monthly
  // salary run from the month after this date onward.
  leavingDate?: string | null;
  salaryHistory?: { amount: number; effectiveFrom: string }[];
}

export interface SalaryPayment {
  _id: string;
  employeeId: string | Employee;
  month: number;
  year: number;
  amountPaid: number;
  paidDate?: string;
  status: 'Paid' | 'Pending';
}

export interface Expense {
  _id: string;
  title: string;
  category: 'Rent' | 'Internet' | 'Electricity' | 'Software' | 'Marketing' | 'Travel' | 'Miscellaneous';
  amount: number;
  expenseDate: string;
  remarks: string;
}

export interface Loan {
  _id: string;
  name: string;
  originalAmount: number;
  monthlyEMI: number;
  remainingAmount: number;
  startDate: string;
  status: 'Active' | 'Closed';
  payments?: EMIPayment[];
}

export interface EMIPayment {
  _id: string;
  loanId: string;
  amount: number;
  paymentDate: string;
  remarks: string;
}

export interface MonthlyAccounting {
  _id?: string;
  month: number;
  year: number;
  openingBalance: number;
  reservedAmount: number;
  monthlyIncome: number;
  salaryExpenses: number;
  officeExpenses: number;
  emiExpenses: number;
  freelancerExpenses?: number;
  totalExpenses: number;
  closingBalance: number;
  notes?: string;
}

export interface DashboardData {
  month: number;
  year: number;
  cards: {
    totalContractValue: number;
    totalCollected: number;
    totalPending: number;
    currentMonthRevenue: number;
    currentMonthExpenses: number;
    salaryExpense: number;
    emiExpense: number;
    freelancerExpense?: number;
    netProfit: number;
  };
  topPendingClients: Array<{ _id: string; name: string; pendingAmount: number }>;
  revenueTrend: Array<{ month: string; income: number; expense: number; profit: number }>;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface Service {
  _id: string;
  name: string;
  description: string;
  price: number;
  isActive: boolean;
  createdAt: string;
}
export interface CompanySettings {
  _id?: string;
  companyName: string;
  address: string;
  tagline: string;
  phone1: string;
  phone2: string;
  accountHolder: string;
  accountType: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
  upi: string;
}

// ---------------------------------------------------------------------------
// Freelancers — people hired per job (photographer, editor, designer, ...)
// ---------------------------------------------------------------------------
export type FreelancerJobStatus = 'Planned' | 'In Progress' | 'Completed' | 'Cancelled';
export type FreelancerRateType = 'Fixed' | 'Hourly' | 'Daily' | 'Per Unit';
export type FreelancerPaymentStatus = 'Unpaid' | 'Partial' | 'Paid' | 'Overpaid' | 'Closed';

export interface FreelancerStats {
  jobCount: number;
  activeJobs: number;
  completedJobs: number;
  totalPayable: number;
  totalPaid: number;
  totalPending: number;
  // Pending on jobs that are already completed = owed right now.
  payableNow: number;
  avgRating: number | null;
  ratedJobs: number;
  onTimeRate: number | null;
  lastPaidOn: string | null;
}

export interface Freelancer {
  _id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  city: string;
  upiId: string;
  bankDetails: string;
  notes: string;
  isActive: boolean;
  createdAt: string;
  stats?: FreelancerStats;
}

export interface FreelancerPayment {
  _id: string;
  freelancerId: string | { _id: string; name: string; role?: string } | null;
  jobId: string | { _id: string; title: string } | null;
  jobTitle?: string;
  amount: number;
  paymentDate: string;
  paymentMethod: 'Bank Transfer' | 'Cash' | 'UPI' | 'Cheque' | 'Online';
  paymentType: 'Advance' | 'Part Payment' | 'Final Payment';
  reference: string;
  remarks: string;
}

export interface FreelancerJob {
  _id: string;
  freelancerId: string | { _id: string; name: string; role?: string };
  title: string;
  description: string;
  clientId?: string | null;
  clientName: string;
  startDate?: string | null;
  dueDate?: string | null;
  completedDate?: string | null;
  rateType: FreelancerRateType;
  rate: number;
  quantity: number;
  unitLabel: string;
  agreedAmount: number;
  extraCharges: number;
  extraChargesNote: string;
  status: FreelancerJobStatus;
  workStatus: 'On Time' | 'Delayed' | '';
  rating: number;
  feedback: string;
  // Computed by the server
  payable: number;
  paid: number;
  pending: number;
  paymentStatus: FreelancerPaymentStatus;
  lastPaymentDate: string | null;
  payments: FreelancerPayment[];
}

export interface FreelancerDetail extends Freelancer {
  stats: FreelancerStats;
  jobs: FreelancerJob[];
  payments: FreelancerPayment[];
}

export interface FreelancerMonthlySummary {
  month: number;
  year: number;
  totalPaid: number;
  paymentCount: number;
  freelancersPaid: number;
  byFreelancer: Array<{ freelancerId: string | null; name: string; role: string; paid: number; count: number }>;
  payments: FreelancerPayment[];
  payableNow: number;
  committed: number;
  activeJobs: number;
  dueJobs: Array<{ _id: string; title: string; pending: number; paymentStatus: FreelancerPaymentStatus; freelancerId: string | null; freelancerName: string }>;
}