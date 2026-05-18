import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/context/LanguageContext';
import { DOCUMENT_STATUS_LABELS_I18N, type AppLanguage, type FinancialDocumentStatus } from './types';

const statusClasses: Record<FinancialDocumentStatus, string> = {
  Draft: 'border-slate-200 bg-slate-50 text-slate-700',
  Sent: 'border-blue-200 bg-blue-50 text-blue-700',
  Viewed: 'border-violet-200 bg-violet-50 text-violet-700',
  'Partially Paid': 'border-amber-200 bg-amber-50 text-amber-700',
  Paid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Overdue: 'border-red-200 bg-red-50 text-red-700',
  Cancelled: 'border-slate-200 bg-slate-100 text-slate-500',
  Approved: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  'Ready to Invoice': 'border-indigo-200 bg-indigo-50 text-indigo-700',
  Delivered: 'border-sky-200 bg-sky-50 text-sky-700',
  Invoiced: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Converted: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
};

const StatusBadge: React.FC<{ status: FinancialDocumentStatus; className?: string }> = ({
  status,
  className = '',
}) => {
  const { language } = useLanguage();
  const lang = (language || 'en') as AppLanguage;
  const label = DOCUMENT_STATUS_LABELS_I18N[lang]?.[status] || DOCUMENT_STATUS_LABELS_I18N.en[status] || status;

  return (
    <Badge
      variant="outline"
      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusClasses[status]} ${className}`.trim()}
    >
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current/70" />
      {label}
    </Badge>
  );
};

export default StatusBadge;
