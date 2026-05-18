import React from 'react';
import { FileText, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLanguage } from '@/context/LanguageContext';
import StatusBadge from './StatusBadge';
import type {
  DocumentTableAction,
  FinancialDocument,
  FinancialDocumentType,
  AppLanguage,
} from './types';

interface DocumentTableProps {
  documents: FinancialDocument[];
  loading?: boolean;
  activeType: FinancialDocumentType;
  emptyLabel: string;
  actionLabel: string;
  formatDate: (value?: string) => string;
  formatCurrency: (value: number) => string;
  onOpenDocument?: (document: FinancialDocument) => void;
  onCreateDocument?: () => void;
  getActions?: (document: FinancialDocument) => DocumentTableAction[];
}

const DocumentTable: React.FC<DocumentTableProps> = ({
  documents,
  loading = false,
  activeType,
  emptyLabel,
  actionLabel,
  formatDate,
  formatCurrency,
  onOpenDocument,
  onCreateDocument,
  getActions,
}) => {
  const { language } = useLanguage();
  const lang = (language || 'en') as AppLanguage;
  const tr = (en: string, fr: string, ar: string) => (lang === 'ar' ? ar : lang === 'fr' ? fr : en);
  const secondaryDateLabelByType: Record<FinancialDocumentType, string> = {
    quote: tr('Validity', 'Validite', 'الصلاحية'),
    delivery_note: tr('Delivery', 'Livraison', 'التسليم'),
    invoice: tr('Due date', 'Echeance', 'الاستحقاق'),
    credit_note: tr('Reference', 'Reference', 'المرجع'),
  };

  return (
    <div className="overflow-hidden rounded-md border border-border/70 bg-card shadow-sm">
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow>
            <TableHead>Document</TableHead>
            <TableHead>{tr('Client', 'Client', 'العميل')}</TableHead>
            <TableHead>{tr('Issued', 'Emission', 'الإصدار')}</TableHead>
            <TableHead>{secondaryDateLabelByType[activeType]}</TableHead>
            <TableHead>{tr('Total', 'Total', 'الإجمالي')}</TableHead>
            <TableHead>{tr('Status', 'Statut', 'الحالة')}</TableHead>
            <TableHead className="text-right">{tr('Actions', 'Actions', 'إجراءات')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={7} className="py-12 text-center">
                <div className="mx-auto flex flex-col items-center gap-3 text-sm text-muted-foreground">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span>{tr('Loading documents...', 'Chargement des documents...', 'جار تحميل المستندات...')}</span>
                </div>
              </TableCell>
            </TableRow>
          ) : documents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                <div className="mx-auto flex max-w-sm flex-col items-center gap-3 rounded-md border border-dashed border-border/70 bg-muted/20 p-6">
                  <FileText className="h-10 w-10 text-primary/50" />
                  <p className="font-medium text-foreground">{emptyLabel}</p>
                  <p className="text-sm text-muted-foreground">
                    {tr('Create a document to see it here.', 'Creez un document pour le voir ici.', 'أنشئ مستندًا ليظهر هنا.')}
                  </p>
                {onCreateDocument && (
                  <Button variant="outline" className="mt-1" onClick={onCreateDocument}>
                    {actionLabel}
                  </Button>
                )}
                </div>
              </TableCell>
            </TableRow>
          ) : (
            documents.map((document) => {
              const actions = getActions?.(document) || [];
              const secondColumnValue =
                activeType === 'credit_note'
                  ? document.referenceInvoiceId || document.linkedInvoiceId || 'N/A'
                  : formatDate(document.dueDate || document.issueDate);

              return (
                <TableRow
                  key={document.id}
                  className={onOpenDocument ? 'cursor-pointer hover:bg-muted/45' : undefined}
                  onClick={() => onOpenDocument?.(document)}
                >
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium">{document.number}</p>
                      <p className="text-xs text-muted-foreground">
                        {document.items.length} {lang === 'ar' ? (document.items.length > 1 ? 'بنود' : 'بند') : lang === 'fr' ? `ligne${document.items.length > 1 ? 's' : ''}` : `line${document.items.length > 1 ? 's' : ''}`}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium">{document.customer.name || tr('Unnamed client', 'Client sans nom', 'عميل بدون اسم')}</p>
                      <p className="text-xs text-muted-foreground">
                        {document.customer.email || document.customer.phone || tr('No contact', 'Sans contact', 'بدون جهة اتصال')}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(document.issueDate)}</TableCell>
                  <TableCell>{secondColumnValue}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium">{formatCurrency(document.total)}</p>
                      {document.paymentLabel && (
                        <p className="text-xs text-muted-foreground">{document.paymentLabel}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={document.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {actions.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                          {actions.map((action, index) => (
                            <React.Fragment key={`${document.id}-${action.label}-${index}`}>
                              {action.separatorBefore && <DropdownMenuSeparator />}
                              <DropdownMenuItem
                                onClick={action.onSelect}
                                disabled={action.disabled}
                                className={action.destructive ? 'text-red-600 focus:text-red-600' : undefined}
                              >
                                {action.label}
                              </DropdownMenuItem>
                            </React.Fragment>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default DocumentTable;
