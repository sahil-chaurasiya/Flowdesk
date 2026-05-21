import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, parseISO } from 'date-fns';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const formatDate = (date, fmt = 'MMM d, yyyy') => {
  if (!date) return '—';
  return format(typeof date === 'string' ? parseISO(date) : date, fmt);
};

export const timeAgo = (date) => {
  if (!date) return '';
  return formatDistanceToNow(typeof date === 'string' ? parseISO(date) : date, { addSuffix: true });
};

export const formatCurrency = (amount, currency = 'INR') => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount || 0);
};
export const formatNumber = (num) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num?.toLocaleString() || '0';
};

export const getInitials = (name = '') => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

export const getStatusColor = (status) => {
  const map = {
    active: 'bg-emerald-100 text-emerald-700',
    inactive: 'bg-slate-100 text-slate-600',
    onboarding: 'bg-amber-100 text-amber-700',
    paused: 'bg-orange-100 text-orange-700',
    churned: 'bg-red-100 text-red-700',
  };
  return map[status] || 'bg-slate-100 text-slate-600';
};

export const getPriorityColor = (priority) => {
  const map = {
    low: 'bg-slate-100 text-slate-600',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-orange-100 text-orange-700',
    urgent: 'bg-red-100 text-red-700 font-semibold',
  };
  return map[priority] || 'bg-slate-100 text-slate-600';
};

export const getTaskStatusColor = (status) => {
  const map = {
    pending: 'bg-slate-100 text-slate-600',
    in_progress: 'bg-blue-100 text-blue-700',
    review: 'bg-purple-100 text-purple-700',
    completed: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-600',
  };
  return map[status] || 'bg-slate-100 text-slate-600';
};

export const formatFileSize = (bytes) => {
  if (!bytes) return '—';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

export const getFileIcon = (mimeType = '') => {
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.includes('image')) return '🖼️';
  if (mimeType.includes('zip') || mimeType.includes('archive')) return '📦';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📑';
  if (mimeType.includes('video')) return '🎬';
  return '📎';
};

// Static fallback — used only as seed data. The live list is stored in MongoDB
// and fetched via useServices() hook. These keys are inserted by seed.js.
export const SERVICE_LABELS = {
  seo: 'SEO',
  ppc: 'PPC / Paid Ads',
  social_media: 'Social Media',
  content_marketing: 'Content Marketing',
  email_marketing: 'Email Marketing',
  web_design: 'Web Design',
  analytics: 'Analytics',
  branding: 'Branding',
  video_production: 'Video Production',
  influencer_marketing: 'Influencer Marketing',
};

export const PLAN_LABELS = {
  starter: 'Starter',
  growth: 'Growth',
  professional: 'Professional',
  enterprise: 'Enterprise',
  custom: 'Custom',
};

export const PLAN_COLORS = {
  starter: 'bg-slate-100 text-slate-700',
  growth: 'bg-blue-100 text-blue-700',
  professional: 'bg-purple-100 text-purple-700',
  enterprise: 'bg-amber-100 text-amber-700',
  custom: 'bg-pink-100 text-pink-700',
};
