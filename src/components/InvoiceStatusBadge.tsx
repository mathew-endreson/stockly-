import React from 'react';
import { Badge } from '@/components/ui/badge';
import type { Invoice, InvoiceStatus } from '@/types';

export const invoiceStatusBadgeColors: Record<InvoiceStatus, string> = {
  Draft: 'bg-gray-100 text-gray-700',
  Sent: 'bg-blue-100 text-blue-700',
  Viewed: 'bg-purple-100 text-purple-700',
  'Partially Paid': 'bg-yellow-100 text-yellow-700',
  Paid: 'bg-green-100 text-green-700',
  Overdue: 'bg-red-100 text-red-700',
  Cancelled: 'bg-gray-100 text-gray-500 line-through'
};

export const invoiceStatusTriggerColors: Record<InvoiceStatus, string> = {
  Draft: 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
  Sent: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
  Viewed: 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100',
  'Partially Paid': 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
  Paid: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  Overdue: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
  Cancelled: 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
};

export const invoiceStatusOptionStyles: Record<InvoiceStatus, string> = {
  Draft:
    'border-slate-200 bg-slate-50/80 text-slate-800 data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-900',
  Sent:
    'border-blue-200 bg-blue-50/80 text-blue-800 data-[highlighted]:bg-blue-100 data-[highlighted]:text-blue-900',
  Viewed:
    'border-violet-200 bg-violet-50/80 text-violet-800 data-[highlighted]:bg-violet-100 data-[highlighted]:text-violet-900',
  'Partially Paid':
    'border-amber-200 bg-amber-50/80 text-amber-800 data-[highlighted]:bg-amber-100 data-[highlighted]:text-amber-900',
  Paid:
    'border-emerald-200 bg-emerald-50/80 text-emerald-800 data-[highlighted]:bg-emerald-100 data-[highlighted]:text-emerald-900',
  Overdue:
    'border-red-200 bg-red-50/80 text-red-800 data-[highlighted]:bg-red-100 data-[highlighted]:text-red-900',
  Cancelled:
    'border-slate-200 bg-slate-50/80 text-slate-600 data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-800'
};

export const MANUAL_INVOICE_STATUSES: InvoiceStatus[] = ['Draft', 'Sent', 'Viewed', 'Overdue'];

export const normalizeInvoiceStatus = (status: string | InvoiceStatus): InvoiceStatus => {
  const value = String(status || '').trim();
  const statusMap: Record<string, InvoiceStatus> = {
    draft: 'Draft',
    sent: 'Sent',
    viewed: 'Viewed',
    partial: 'Partially Paid',
    'partially paid': 'Partially Paid',
    paid: 'Paid',
    overdue: 'Overdue',
    cancelled: 'Cancelled',
    canceled: 'Cancelled',
    Draft: 'Draft',
    Sent: 'Sent',
    Viewed: 'Viewed',
    'Partially Paid': 'Partially Paid',
    Paid: 'Paid',
    Overdue: 'Overdue',
    Cancelled: 'Cancelled'
  };
  return statusMap[value] || 'Draft';
};

const InvoiceStatusBadge: React.FC<{ status: Invoice['status'] }> = ({ status }) => {
  const normalizedStatus = normalizeInvoiceStatus(status);

  return (
    <Badge className={`${invoiceStatusBadgeColors[normalizedStatus]} font-medium`}>
      {normalizedStatus}
    </Badge>
  );
};

export default InvoiceStatusBadge;
