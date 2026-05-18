import type { Invoice, InvoiceCustomer, InvoiceItem, InvoiceStatus } from '@/types';

export type FinancialDocumentType = 'quote' | 'delivery_note' | 'invoice' | 'credit_note';
export type FinancialDocumentSource = 'remote' | 'local';
export type FinancialDocumentStatus =
  | InvoiceStatus
  | 'Approved'
  | 'Ready to Invoice'
  | 'Delivered'
  | 'Invoiced'
  | 'Converted';

export interface FinancialDocument {
  id: string;
  number: string;
  type: FinancialDocumentType;
  source: FinancialDocumentSource;
  remoteInvoiceId?: string;
  invoiceType?: Invoice['type'];
  customer: InvoiceCustomer;
  items: InvoiceItem[];
  issueDate: string;
  dueDate?: string;
  total: number;
  amountPaid?: number;
  balanceDue?: number;
  status: FinancialDocumentStatus;
  notes?: string;
  terms?: string;
  paymentLabel?: string;
  referenceInvoiceId?: string | null;
  linkedInvoiceId?: string | null;
  sourceDocumentIds?: string[];
  discount?: {
    type: 'fixed' | 'percentage';
    value: number;
  };
  taxRate?: number;
  shipping?: number;
  template?: Invoice['template'];
  color?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DocumentEditorPayload {
  documentType: FinancialDocumentType;
  customer: InvoiceCustomer;
  items: InvoiceItem[];
  issueDate: string;
  dueDate?: string;
  discount: {
    type: 'fixed' | 'percentage';
    value: number;
  };
  taxRate: number;
  shipping: number;
  notes: string;
  terms: string;
  template: Invoice['template'];
  color: string;
  status: FinancialDocumentStatus;
  referenceInvoiceId?: string | null;
  sourceDocumentIds?: string[];
}

export interface DocumentTableAction {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
}

export type AppLanguage = 'en' | 'fr' | 'ar';

type I18nMap<T extends string> = Record<AppLanguage, Record<T, string>>;

export const DOCUMENT_TYPE_LABELS_I18N: I18nMap<FinancialDocumentType> = {
  en: { quote: 'Quotes', delivery_note: 'Delivery Notes', invoice: 'Invoices', credit_note: 'Credit Notes' },
  fr: { quote: 'Devis', delivery_note: 'Bon de Livraison', invoice: 'Facture', credit_note: 'Avoir' },
  ar: { quote: 'عروض الأسعار', delivery_note: 'سندات التسليم', invoice: 'الفواتير', credit_note: 'إشعارات دائنة' },
};

export const DOCUMENT_TYPE_LABELS = DOCUMENT_TYPE_LABELS_I18N.fr;

export const DOCUMENT_TYPE_PLURAL_LABELS: Record<FinancialDocumentType, string> = {
  quote: 'Devis',
  delivery_note: 'Bons de Livraison',
  invoice: 'Factures',
  credit_note: 'Avoirs',
};

export const DOCUMENT_CREATE_LABELS_I18N: I18nMap<FinancialDocumentType> = {
  en: {
    quote: '+ Create Quote',
    delivery_note: '+ Create Delivery Note',
    invoice: '+ Create Invoice',
    credit_note: '+ Create Credit Note',
  },
  fr: {
    quote: '+ Créer un Devis',
    delivery_note: '+ Créer un Bon de Livraison',
    invoice: '+ Créer une Facture',
    credit_note: '+ Créer un Avoir',
  },
  ar: {
    quote: '+ إنشاء عرض سعر',
    delivery_note: '+ إنشاء سند تسليم',
    invoice: '+ إنشاء فاتورة',
    credit_note: '+ إنشاء إشعار دائن',
  },
};

export const DOCUMENT_CREATE_LABELS = DOCUMENT_CREATE_LABELS_I18N.fr;

export const DOCUMENT_EMPTY_LABELS_I18N: I18nMap<FinancialDocumentType> = {
  en: {
    quote: 'No quotes yet',
    delivery_note: 'No delivery notes yet',
    invoice: 'No invoices yet',
    credit_note: 'No credit notes yet',
  },
  fr: {
    quote: 'Aucun devis pour le moment',
    delivery_note: 'Aucun bon de livraison pour le moment',
    invoice: 'Aucune facture pour le moment',
    credit_note: 'Aucun avoir pour le moment',
  },
  ar: {
    quote: 'لا توجد عروض أسعار حالياً',
    delivery_note: 'لا توجد سندات تسليم حالياً',
    invoice: 'لا توجد فواتير حالياً',
    credit_note: 'لا توجد إشعارات دائنة حالياً',
  },
};

export const DOCUMENT_EMPTY_LABELS = DOCUMENT_EMPTY_LABELS_I18N.fr;

export const DOCUMENT_STATUS_LABELS_I18N: I18nMap<FinancialDocumentStatus> = {
  en: {
    Draft: 'Draft', Sent: 'Sent', Viewed: 'Viewed', 'Partially Paid': 'Partially Paid',
    Paid: 'Paid', Overdue: 'Overdue', Cancelled: 'Cancelled', Approved: 'Approved',
    'Ready to Invoice': 'Ready to Invoice', Delivered: 'Delivered', Invoiced: 'Invoiced', Converted: 'Converted',
  },
  fr: {
    Draft: 'Brouillon', Sent: 'Envoyé', Viewed: 'Vu', 'Partially Paid': 'Partiellement payé',
    Paid: 'Payé', Overdue: 'En retard', Cancelled: 'Annulé', Approved: 'Approuvé',
    'Ready to Invoice': 'Prêt à facturer', Delivered: 'Livré', Invoiced: 'Facturé', Converted: 'Converti',
  },
  ar: {
    Draft: 'مسودة', Sent: 'مُرسَل', Viewed: 'تم العرض', 'Partially Paid': 'مدفوع جزئياً',
    Paid: 'مدفوع', Overdue: 'متأخر', Cancelled: 'ملغى', Approved: 'موافق عليه',
    'Ready to Invoice': 'جاهز للفوترة', Delivered: 'تم التسليم', Invoiced: 'تمت الفوترة', Converted: 'تم التحويل',
  },
};

export const DOCUMENT_STATUS_LABELS: Record<FinancialDocumentStatus, string> = DOCUMENT_STATUS_LABELS_I18N.en;

export const LOCAL_FINANCIAL_DOCUMENTS_STORAGE_KEY = 'stockly-financial-suite-documents';

export const DELIVERY_NOTE_READY_STATUSES = new Set<FinancialDocumentStatus>([
  'Ready to Invoice',
  'Delivered',
]);
