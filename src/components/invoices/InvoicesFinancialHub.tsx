import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  FileStack,
  FileText,
  Mail,
  PackageCheck,
  ReceiptText,
  Wallet,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import CreateInvoiceModal from './CreateInvoiceModal';
import DocumentEditor from './DocumentEditor';
import DocumentTable from './DocumentTable';
import StatusBadge from './StatusBadge';
import {
  DELIVERY_NOTE_READY_STATUSES,
  DOCUMENT_CREATE_LABELS_I18N,
  DOCUMENT_EMPTY_LABELS_I18N,
  DOCUMENT_TYPE_LABELS_I18N,
  LOCAL_FINANCIAL_DOCUMENTS_STORAGE_KEY,
  type AppLanguage,
  type DocumentEditorPayload,
  type DocumentTableAction,
  type FinancialDocument,
  type FinancialDocumentType,
} from './types';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useLanguage } from '@/context/LanguageContext';
import { invoicesAPI } from '@/services/api';
import type { Invoice, Payment } from '@/types';

const PAGE_SIZE = 10;
const MANUAL_INVOICE_STATUSES: Invoice['status'][] = ['Draft', 'Sent', 'Viewed', 'Overdue'];

const readLocalDocuments = (): FinancialDocument[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_FINANCIAL_DOCUMENTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const buildLocalNumber = (type: FinancialDocumentType, documents: FinancialDocument[]) => {
  const prefixMap: Record<FinancialDocumentType, string> = {
    quote: 'DV',
    delivery_note: 'BL',
    invoice: 'FC',
    credit_note: 'AV',
  };
  const year = new Date().getFullYear();
  const nextIndex = documents.filter((document) => document.type === type).length + 1;
  return `${prefixMap[type]}-${year}-${String(nextIndex).padStart(3, '0')}`;
};

const computePayloadTotal = (payload: DocumentEditorPayload) => {
  const subtotal = payload.items.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const discountAmount =
    payload.discount.type === 'percentage'
      ? (subtotal * Number(payload.discount.value || 0)) / 100
      : Number(payload.discount.value || 0);
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = (afterDiscount * Number(payload.taxRate || 0)) / 100;
  return afterDiscount + taxAmount + Number(payload.shipping || 0);
};

const mapInvoiceDocumentType = (invoice: Invoice): FinancialDocumentType => {
  if (invoice.type === 'Pro-Forma') return 'quote';
  if (invoice.type === 'Credit Note') return 'credit_note';
  return 'invoice';
};

const canDeleteInvoice = (invoice: Invoice | null | undefined) =>
  Boolean(invoice && ['Draft', 'Cancelled'].includes(invoice.status));

const canManuallyUpdateInvoiceStatus = (invoice: Invoice | null | undefined) => {
  if (!invoice) return false;
  if (invoice.status === 'Paid' || invoice.status === 'Cancelled') return false;
  return (invoice.amountPaid || 0) <= 0;
};

const InvoicesFinancialHub: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { formatCurrency } = useCurrencyFormatter();
  const { language } = useLanguage();
  const lang = (language || 'en') as AppLanguage;
  const tr = (en: string, fr: string, ar: string) =>
    lang === 'ar' ? ar : lang === 'fr' ? fr : en;
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<FinancialDocumentType>('invoice');
  const [loading, setLoading] = useState(true);
  const [isSavingDocument, setIsSavingDocument] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [localDocuments, setLocalDocuments] = useState<FinancialDocument[]>(() => readLocalDocuments());
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState<Partial<Payment>>({
    amount: 0,
    method: 'external_payment',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    reference: '',
  });
  const [cancellationReason, setCancellationReason] = useState('');
  const [editorState, setEditorState] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    documentType: FinancialDocumentType;
    initialDocument: Partial<FinancialDocument> | null;
    targetDocument: FinancialDocument | null;
  }>({
    open: false,
    mode: 'create',
    documentType: 'invoice',
    initialDocument: null,
    targetDocument: null,
  });

  const documentTypeLabels = useMemo(
    () => DOCUMENT_TYPE_LABELS_I18N[lang] || DOCUMENT_TYPE_LABELS_I18N.en,
    [lang]
  );

  const documentCreateLabels = useMemo(
    () => DOCUMENT_CREATE_LABELS_I18N[lang] || DOCUMENT_CREATE_LABELS_I18N.en,
    [lang]
  );

  const documentEmptyLabels = useMemo(
    () => DOCUMENT_EMPTY_LABELS_I18N[lang] || DOCUMENT_EMPTY_LABELS_I18N.en,
    [lang]
  );

  const formatDate = useCallback(
    (value?: string) => {
      if (!value) return 'N/A';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      const locale = language === 'fr' ? 'fr-FR' : language === 'ar' ? 'ar-DZ' : 'en-US';
      return date.toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    },
    [language]
  );

  const notifySuccess = (message: string) => setFeedback({ type: 'success', message });
  const notifyError = (message: string) => setFeedback({ type: 'error', message });

  const persistLocalDocuments = useCallback((updater: (previous: FinancialDocument[]) => FinancialDocument[]) => {
    setLocalDocuments((previous) => {
      const nextDocuments = updater(previous);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          LOCAL_FINANCIAL_DOCUMENTS_STORAGE_KEY,
          JSON.stringify(nextDocuments)
        );
      }
      return nextDocuments;
    });
  }, []);

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const firstResponse = await invoicesAPI.getInvoices({ page: 1, limit: 100 });
      let allInvoices = firstResponse.data.invoices;
      const totalPages = firstResponse.data.pagination.pages || 1;

      if (totalPages > 1) {
        const remainingResponses = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, index) =>
            invoicesAPI.getInvoices({ page: index + 2, limit: 100 })
          )
        );
        allInvoices = [
          ...allInvoices,
          ...remainingResponses.flatMap((response) => response.data.invoices),
        ];
      }

      setInvoices(allInvoices);
    } catch {
      notifyError(t('invoices.fetchError', 'Failed to fetch invoices'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, statusFilter]);

  useEffect(() => {
    const invoiceId = searchParams.get('invoiceId');
    if (!invoiceId) return;
    const invoice = invoices.find((entry) => entry._id === invoiceId);
    if (invoice) {
      setSelectedInvoice(invoice);
      setShowDetailDialog(true);
    }
  }, [invoices, searchParams]);

  const invoiceNumberLookup = useMemo(
    () => new Map(invoices.map((invoice) => [invoice._id, invoice.invoiceNumber])),
    [invoices]
  );

  const remoteDocuments = useMemo<FinancialDocument[]>(() => {
    return invoices.map((invoice) => {
      const type = mapInvoiceDocumentType(invoice);
      const referenceNumber = invoice.referenceInvoiceId
        ? invoiceNumberLookup.get(String(invoice.referenceInvoiceId))
        : null;
      const paymentLabel =
        type === 'invoice'
          ? invoice.status === 'Paid'
            ? tr('Paid', 'Reglée', 'مدفوع')
            : invoice.balanceDue > 0
              ? `${tr('Balance', 'Solde', 'الرصيد')} ${formatCurrency(invoice.balanceDue)}`
              : tr('Pending', 'En attente', 'قيد الانتظار')
          : type === 'quote'
            ? tr('Ready to convert', 'Prêt à convertir', 'جاهز للتحويل')
            : referenceNumber
              ? `${tr('Linked to', 'Lié à', 'مرتبط بـ')} ${referenceNumber}`
              : tr('Customer adjustment', 'Ajustement client', 'تعديل العميل');

      return {
        id: invoice._id,
        number: invoice.invoiceNumber,
        type,
        source: 'remote',
        remoteInvoiceId: invoice._id,
        invoiceType: invoice.type,
        customer: invoice.customer,
        items: invoice.items,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        total: invoice.total,
        amountPaid: invoice.amountPaid,
        balanceDue: invoice.balanceDue,
        status: invoice.status,
        notes: invoice.notes,
        terms: invoice.terms,
        paymentLabel,
        referenceInvoiceId: referenceNumber || null,
        discount: invoice.discount,
        taxRate: invoice.taxRate,
        shipping: invoice.shipping,
        template: invoice.template,
        color: invoice.color,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt,
      };
    });
  }, [formatCurrency, invoiceNumberLookup, invoices, lang, tr]);

  const allDocuments = useMemo(
    () => [...remoteDocuments, ...localDocuments],
    [localDocuments, remoteDocuments]
  );

  const activeDocuments = useMemo(
    () => allDocuments.filter((document) => document.type === activeTab),
    [activeTab, allDocuments]
  );

  const filteredDocuments = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return activeDocuments.filter((document) => {
      const matchesStatus = statusFilter === 'all' || document.status === statusFilter;
      const matchesSearch =
        !normalizedQuery ||
        document.number.toLowerCase().includes(normalizedQuery) ||
        String(document.customer.name || '').toLowerCase().includes(normalizedQuery) ||
        String(document.customer.email || '').toLowerCase().includes(normalizedQuery);
      return matchesStatus && matchesSearch;
    });
  }, [activeDocuments, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / PAGE_SIZE));
  const paginatedDocuments = filteredDocuments.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const statusOptions = useMemo(
    () => Array.from(new Set(activeDocuments.map((document) => document.status))),
    [activeDocuments]
  );

  const overviewCards = useMemo(() => {
    const totalValue = activeDocuments.reduce((sum, document) => sum + Number(document.total || 0), 0);
    const draftCount = activeDocuments.filter((document) => document.status === 'Draft').length;
    const attentionCount = activeDocuments.filter((document) =>
      ['Overdue', 'Ready to Invoice', 'Sent'].includes(document.status)
    ).length;
    const outstandingValue = activeDocuments.reduce(
      (sum, document) => sum + Number(document.balanceDue || 0),
      0
    );

    return [
      {
        label: 'Documents',
        value: String(activeDocuments.length),
        hint: documentTypeLabels[activeTab],
        icon: FileText,
      },
      {
        label: tr('Total value', 'Valeur totale', 'القيمة الإجمالية'),
        value: formatCurrency(totalValue),
        hint: tr('Active portfolio', 'Portefeuille actif', 'المحفظة النشطة'),
        icon: activeTab === 'delivery_note' ? PackageCheck : ReceiptText,
      },
      {
        label:
          activeTab === 'delivery_note'
            ? tr('To invoice', 'A facturer', 'للفوترة')
            : tr('Drafts', 'Brouillons', 'المسودات'),
        value: String(activeTab === 'delivery_note' ? attentionCount : draftCount),
        hint:
          activeTab === 'delivery_note'
            ? tr('Delivery notes ready to convert', 'BDLs a convertir', 'سندات تسليم جاهزة للتحويل')
            : tr('Documents still being prepared', 'Documents en preparation', 'مستندات قيد التحضير'),
        icon: activeTab === 'quote' ? FileStack : Calendar,
      },
      {
        label:
          activeTab === 'invoice'
            ? tr('Open balance', 'Solde ouvert', 'الرصيد المفتوح')
            : tr('Attention', 'Attention', 'انتباه'),
        value: activeTab === 'invoice' ? formatCurrency(outstandingValue) : String(attentionCount),
        hint:
          activeTab === 'invoice'
            ? tr('Amount left to collect', 'Montant restant a encaisser', 'المبلغ المتبقي للتحصيل')
            : tr('Documents that need follow-up', 'Documents a suivre', 'مستندات تحتاج متابعة'),
        icon: activeTab === 'invoice' ? Wallet : CreditCard,
      },
    ];
  }, [activeDocuments, activeTab, documentTypeLabels, formatCurrency, tr]);

  const openRemoteDetail = useCallback(
    (invoice: Invoice) => {
      setSelectedInvoice(invoice);
      setShowDetailDialog(true);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('invoiceId', invoice._id);
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleDetailDialogChange = useCallback(
    (open: boolean) => {
      setShowDetailDialog(open);
      if (!open) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('invoiceId');
        setSearchParams(nextParams, { replace: true });
      }
    },
    [searchParams, setSearchParams]
  );

  const openEditor = (
    documentType: FinancialDocumentType,
    initialDocument?: Partial<FinancialDocument> | null,
    mode: 'create' | 'edit' = 'create',
    targetDocument: FinancialDocument | null = null
  ) => {
    setEditorState({
      open: true,
      mode,
      documentType,
      initialDocument: initialDocument || null,
      targetDocument,
    });
  };

  const closeEditor = (open: boolean) => {
    setEditorState((previous) => ({ ...previous, open }));
  };

  const buildInvoiceMailto = (invoice: Invoice) => {
    const recipient = (invoice.customer?.email || '').trim();
    if (!recipient) return null;
    const subject = `Invoice ${invoice.invoiceNumber}`;
    const bodyLines = [
      `Hello ${invoice.customer.name || 'Customer'},`,
      '',
      `Invoice: ${invoice.invoiceNumber}`,
      `Total: ${formatCurrency(invoice.total || 0)}`,
      `Balance due: ${formatCurrency(invoice.balanceDue || 0)}`,
      `Due date: ${formatDate(invoice.dueDate)}`,
    ];
    return `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join('\n'))}`;
  };

  const handleSendInvoice = async (invoice: Invoice) => {
    const mailtoLink = buildInvoiceMailto(invoice);
    if (!mailtoLink) {
      notifyError('Customer email is required to send this document');
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = mailtoLink;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    try {
      await invoicesAPI.sendInvoice(invoice._id, { dueDate: invoice.dueDate });
      notifySuccess('Document sent successfully');
      await loadInvoices();
    } catch {
      notifyError('Failed to send document');
    }
  };

  const handleUpdateInvoiceStatus = async (invoice: Invoice, nextStatus: Invoice['status']) => {
    try {
      await invoicesAPI.updateInvoice(invoice._id, { status: nextStatus });
      notifySuccess('Document status updated');
      await loadInvoices();
    } catch {
      notifyError('Failed to update status');
    }
  };

  const handleDuplicateInvoice = async (invoice: Invoice) => {
    try {
      await invoicesAPI.duplicateInvoice(invoice._id);
      notifySuccess('Document duplicated successfully');
      await loadInvoices();
    } catch {
      notifyError('Failed to duplicate document');
    }
  };

  const handleDownloadPDF = async (invoice: Invoice) => {
    try {
      const blob = await invoicesAPI.generatePDF(invoice._id);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    } catch {
      notifyError('Failed to download PDF');
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedInvoice) return;
    try {
      await invoicesAPI.recordPayment(selectedInvoice._id, paymentForm);
      setShowPaymentDialog(false);
      setPaymentForm({
        amount: 0,
        method: 'external_payment',
        date: new Date().toISOString().split('T')[0],
        notes: '',
        reference: '',
      });
      notifySuccess('Payment recorded successfully');
      await loadInvoices();
    } catch {
      notifyError('Failed to record payment');
    }
  };

  const handleCancelInvoice = async () => {
    if (!selectedInvoice) return;
    try {
      await invoicesAPI.cancelInvoice(selectedInvoice._id, cancellationReason);
      setShowCancelDialog(false);
      setCancellationReason('');
      notifySuccess('Credit note created successfully');
      await loadInvoices();
    } catch {
      notifyError('Failed to create credit note');
    }
  };

  const handleDeleteInvoice = async () => {
    if (!selectedInvoice) return;
    try {
      await invoicesAPI.deleteInvoice(selectedInvoice._id);
      setShowDeleteDialog(false);
      setShowDetailDialog(false);
      setSelectedInvoice(null);
      notifySuccess('Document deleted successfully');
      await loadInvoices();
    } catch {
      notifyError('Failed to delete document');
    }
  };

  const duplicateLocalDocument = (document: FinancialDocument) => {
    persistLocalDocuments((previous) => {
      const copy: FinancialDocument = {
        ...document,
        id: `local-${Date.now()}`,
        number: buildLocalNumber(document.type, previous),
        status: document.type === 'delivery_note' ? 'Draft' : document.status,
        linkedInvoiceId: null,
      };
      return [copy, ...previous];
    });
    notifySuccess('Local document duplicated');
  };

  const deleteLocalDocument = (document: FinancialDocument) => {
    persistLocalDocuments((previous) => previous.filter((entry) => entry.id !== document.id));
    notifySuccess('Local document deleted');
  };

  const handleSubmitDocument = async (payload: DocumentEditorPayload) => {
    setIsSavingDocument(true);
    try {
      if (payload.documentType === 'invoice' || payload.documentType === 'quote') {
        const requestType =
          payload.documentType === 'quote'
            ? 'Pro-Forma'
            : editorState.targetDocument?.invoiceType || 'Standard';
        const requestPayload = {
          ...payload,
          type: requestType,
          status: payload.status as Invoice['status'],
        };

        if (editorState.mode === 'edit' && editorState.targetDocument?.remoteInvoiceId) {
          await invoicesAPI.updateInvoice(editorState.targetDocument.remoteInvoiceId, requestPayload);
          notifySuccess(`${documentTypeLabels[payload.documentType]} updated successfully`);
        } else {
          const response = await invoicesAPI.createInvoice(requestPayload);
          if (payload.sourceDocumentIds?.length) {
            const linkedNumber = response.data.invoice.invoiceNumber;
            persistLocalDocuments((previous) =>
              previous.map((document) =>
                payload.sourceDocumentIds?.includes(document.id)
                  ? { ...document, status: 'Invoiced', linkedInvoiceId: linkedNumber }
                  : document
              )
            );
          }
          notifySuccess(`${documentTypeLabels[payload.documentType]} created successfully`);
        }
        await loadInvoices();
      } else {
        persistLocalDocuments((previous) => {
          const total = computePayloadTotal(payload);
          const nextDocument: FinancialDocument = {
            id:
              editorState.mode === 'edit' && editorState.targetDocument
                ? editorState.targetDocument.id
                : `local-${Date.now()}`,
            number:
              editorState.mode === 'edit' && editorState.targetDocument
                ? editorState.targetDocument.number
                : buildLocalNumber(payload.documentType, previous),
            type: payload.documentType,
            source: 'local',
            customer: payload.customer,
            items: payload.items,
            issueDate: payload.issueDate,
            dueDate: payload.dueDate,
            total,
            amountPaid: 0,
            balanceDue: payload.documentType === 'credit_note' ? 0 : total,
            status: payload.status,
            notes: payload.notes,
            terms: payload.terms,
            paymentLabel:
              payload.documentType === 'delivery_note'
                ? 'Pret a facturer'
                : 'Brouillon local',
            referenceInvoiceId: payload.referenceInvoiceId || null,
            sourceDocumentIds: payload.sourceDocumentIds || [],
            linkedInvoiceId:
              editorState.mode === 'edit' && editorState.targetDocument
                ? editorState.targetDocument.linkedInvoiceId || null
                : null,
            discount: payload.discount,
            taxRate: payload.taxRate,
            shipping: payload.shipping,
            template: payload.template,
            color: payload.color,
            createdAt:
              editorState.mode === 'edit' && editorState.targetDocument
                ? editorState.targetDocument.createdAt || new Date().toISOString()
                : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          if (editorState.mode === 'edit' && editorState.targetDocument) {
            return previous.map((document) =>
              document.id === editorState.targetDocument?.id ? nextDocument : document
            );
          }

          return [nextDocument, ...previous];
        });
        notifySuccess(`${documentTypeLabels[payload.documentType]} saved locally`);
      }

      setEditorState((previous) => ({
        ...previous,
        open: false,
        targetDocument: null,
        initialDocument: null,
      }));
    } catch {
      notifyError('Failed to save document');
    } finally {
      setIsSavingDocument(false);
    }
  };

  const startInvoiceFromQuote = (quote: FinancialDocument) => {
    setShowCreateInvoiceModal(false);
    openEditor(
      'invoice',
      {
        customer: quote.customer,
        items: quote.items,
        notes: quote.notes ? `${quote.notes}\n\nSource devis: ${quote.number}` : `Source devis: ${quote.number}`,
        terms: quote.terms,
        referenceInvoiceId: quote.remoteInvoiceId || null,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      'create'
    );
  };

  const startInvoiceFromBdls = (documents: FinancialDocument[]) => {
    if (!documents.length) return;
    setShowCreateInvoiceModal(false);
    const mergedItems = documents.flatMap((document) =>
      document.items.map((item) => ({
        ...item,
        description: item.description || `Source ${document.number}`,
      }))
    );
    openEditor(
      'invoice',
      {
        customer: documents[0].customer,
        items: mergedItems,
        notes: `Facture preparee depuis ${documents.map((document) => document.number).join(', ')}`,
        sourceDocumentIds: documents.map((document) => document.id),
      },
      'create'
    );
  };

  const handlePrimaryAction = () => {
    if (activeTab === 'invoice') {
      setShowCreateInvoiceModal(true);
      return;
    }
    openEditor(activeTab);
  };

  const handleOpenDocument = (document: FinancialDocument) => {
    if (document.source === 'remote' && document.remoteInvoiceId) {
      const invoice = invoices.find((entry) => entry._id === document.remoteInvoiceId);
      if (invoice) openRemoteDetail(invoice);
      return;
    }
    openEditor(document.type, document, 'edit', document);
  };

  const openRemoteEditor = (document: FinancialDocument) => {
    openEditor(document.type, document, 'edit', document);
  };

  const getDocumentActions = (document: FinancialDocument): DocumentTableAction[] => {
      if (document.source === 'local') {
        const actions: DocumentTableAction[] = [
          { label: tr('Edit', 'Modifier', 'تعديل'), onSelect: () => openEditor(document.type, document, 'edit', document) },
        ];
        if (document.type === 'delivery_note' && !document.linkedInvoiceId) {
          actions.push({
            label: tr('Create Invoice', 'Créer une Facture', 'إنشاء فاتورة'),
            onSelect: () => startInvoiceFromBdls([document]),
            separatorBefore: true,
          });
        }
        actions.push({ label: tr('Duplicate', 'Dupliquer', 'نسخ'), onSelect: () => duplicateLocalDocument(document) });
        actions.push({
          label: tr('Delete', 'Supprimer', 'حذف'),
          onSelect: () => deleteLocalDocument(document),
          destructive: true,
          separatorBefore: true,
        });
        return actions;
      }

      const invoice = invoices.find((entry) => entry._id === document.remoteInvoiceId);
      if (!invoice) return [];

      const actions: DocumentTableAction[] = [{ label: tr('View', 'Voir', 'عرض'), onSelect: () => openRemoteDetail(invoice) }];

      if (invoice.status === 'Draft' && document.type !== 'credit_note') {
        actions.push({ label: tr('Edit', 'Modifier', 'تعديل'), onSelect: () => openRemoteEditor(document) });
      }

      if (document.type === 'quote') {
        actions.push({
          label: tr('Create Invoice', 'Créer une Facture', 'إنشاء فاتورة'),
          onSelect: () => startInvoiceFromQuote(document),
          separatorBefore: true,
        });
      }

      if (canManuallyUpdateInvoiceStatus(invoice)) {
        MANUAL_INVOICE_STATUSES.filter((statusOption) => statusOption !== invoice.status).forEach(
          (statusOption, index) => {
            actions.push({
              label: tr(`Set to ${statusOption}`, `Passer à ${statusOption}`, `تغيير إلى ${statusOption}`),
              onSelect: () => handleUpdateInvoiceStatus(invoice, statusOption),
              separatorBefore: index === 0,
            });
          }
        );
      }

      if (invoice.status === 'Draft' && document.type !== 'credit_note') {
        actions.push({
          label: tr('Send', 'Envoyer', 'إرسال'),
          onSelect: () => handleSendInvoice(invoice),
          separatorBefore: true,
        });
      }

      if (document.type === 'invoice' && ['Sent', 'Viewed', 'Partially Paid', 'Overdue'].includes(invoice.status)) {
        actions.push({
          label: tr('Record payment', 'Enregistrer un paiement', 'تسجيل دفعة'),
          onSelect: () => {
            setSelectedInvoice(invoice);
            setPaymentForm({
              amount: invoice.balanceDue || 0,
              method: 'external_payment',
              date: new Date().toISOString().split('T')[0],
              notes: '',
              reference: '',
            });
            setShowPaymentDialog(true);
          },
        });
      }

      actions.push({ label: tr('Download PDF', 'Télécharger le PDF', 'تحميل PDF'), onSelect: () => handleDownloadPDF(invoice) });
      actions.push({ label: tr('Duplicate', 'Dupliquer', 'نسخ'), onSelect: () => handleDuplicateInvoice(invoice) });

      if (document.type === 'invoice' && ['Draft', 'Sent', 'Viewed', 'Overdue'].includes(invoice.status)) {
        actions.push({
          label: tr('Create Credit Note', 'Créer un Avoir', 'إنشاء إشعار دائن'),
          onSelect: () => {
            setSelectedInvoice(invoice);
            setCancellationReason('');
            setShowCancelDialog(true);
          },
          destructive: true,
          separatorBefore: true,
        });
      }

      if (canDeleteInvoice(invoice)) {
        actions.push({
          label: tr('Delete', 'Supprimer', 'حذف'),
          onSelect: () => {
            setSelectedInvoice(invoice);
            setShowDeleteDialog(true);
          },
          destructive: true,
          separatorBefore: true,
        });
      }

      return actions;
    };

  const selectedInvoiceDocument = useMemo(
    () =>
      selectedInvoice
        ? remoteDocuments.find((document) => document.remoteInvoiceId === selectedInvoice._id) || null
        : null,
    [remoteDocuments, selectedInvoice]
  );
  return (
    <div className="page-shell">
      {feedback && (
        <div
          className={`rounded-md border p-3 text-sm shadow-sm ${
            feedback.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span>{feedback.message}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFeedback(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
        
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {tr('Financial Suite', 'Suite Financière', 'الجناح المالي')}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground sm:text-base">
            {tr(
              'Centralize quotes, delivery notes, invoices, and credit notes without changing the main navigation.',
              'Centralisez devis, bons de livraison, factures et avoirs sans changer la navigation principale.',
              'جمّع عروض الأسعار وسندات التسليم والفواتير والإشعارات الدائنة في مكان واحد.'
            )}
          </p>
        </div>
        <Button onClick={handlePrimaryAction} className="bg-[#001EF4] hover:bg-[#001EF4]/90">
          {documentCreateLabels[activeTab]}
        </Button>
      </div>
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as FinancialDocumentType)} className="space-y-5">
        <Card className="overflow-hidden">
          <CardContent className="space-y-5 p-4 sm:p-5">
            <TabsList className="h-auto w-full flex-wrap justify-start rounded-md bg-slate-100/80 p-1 dark:bg-muted/60">
              <TabsTrigger value="quote" className="rounded-md px-4 py-2">
                {tr('Quotes', 'Devis', 'عروض الأسعار')}
              </TabsTrigger>
              <TabsTrigger value="delivery_note" className="rounded-md px-4 py-2">
                {tr('Delivery Notes', 'Bons de Livraison', 'سندات التسليم')}
              </TabsTrigger>
              <TabsTrigger value="invoice" className="rounded-md px-4 py-2">
                {tr('Invoices', 'Factures', 'الفواتير')}
              </TabsTrigger>
              <TabsTrigger value="credit_note" className="rounded-md px-4 py-2">
                {tr('Credit Notes', 'Avoirs', 'إشعارات دائنة')}
              </TabsTrigger>
            </TabsList>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {overviewCards.map((card) => {
                const Icon = card.icon;
                return (
              <Card key={card.label} className="border-border/70 py-4 shadow-none">
                <CardContent className="flex items-start justify-between px-4 py-4">
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">{card.label}</p>
                        <p className="text-xl font-bold">{card.value}</p>
                        <p className="text-xs text-muted-foreground">{card.hint}</p>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#001EF4]/10 text-[#001EF4]">
                        <Icon className="h-5 w-5" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <Input
                placeholder={tr('Search by number, client, or email', 'Rechercher par numero, client ou email', 'البحث برقم، عميل أو بريد إلكتروني')}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[220px]">
                  <SelectValue placeholder={tr('Filter by status', 'Filtrer par statut', 'تصفية حسب الحالة')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr('All statuses', 'Tous les statuts', 'جميع الحالات')}</SelectItem>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {(['quote', 'delivery_note', 'invoice', 'credit_note'] as FinancialDocumentType[]).map((tab) => (
          <TabsContent key={tab} value={tab}>
            <DocumentTable
              documents={tab === activeTab ? paginatedDocuments : []}
              loading={tab === activeTab ? loading : false}
              activeType={tab}
              emptyLabel={documentEmptyLabels[tab]}
              actionLabel={documentCreateLabels[tab]}
              formatDate={formatDate}
              formatCurrency={formatCurrency}
              onCreateDocument={handlePrimaryAction}
              onOpenDocument={handleOpenDocument}
              getActions={getDocumentActions}
            />
          </TabsContent>
        ))}
      </Tabs>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {tr('Page', 'Page', 'صفحة')} {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
      <CreateInvoiceModal
        open={showCreateInvoiceModal}
        onOpenChange={setShowCreateInvoiceModal}
        quotes={allDocuments.filter((document) => document.type === 'quote')}
        deliveryNotes={allDocuments.filter(
          (document) =>
            document.type === 'delivery_note' &&
            !document.linkedInvoiceId &&
            DELIVERY_NOTE_READY_STATUSES.has(document.status)
        )}
        formatDate={formatDate}
        formatCurrency={formatCurrency}
        onBlank={() => {
          setShowCreateInvoiceModal(false);
          openEditor('invoice');
        }}
        onFromQuote={startInvoiceFromQuote}
        onFromBdls={startInvoiceFromBdls}
        onCreateDeliveryNote={() => {
          setShowCreateInvoiceModal(false);
          setActiveTab('delivery_note');
          openEditor('delivery_note');
        }}
      />

      <DocumentEditor
        open={editorState.open}
        mode={editorState.mode}
        documentType={editorState.documentType}
        initialDocument={editorState.initialDocument}
        isSubmitting={isSavingDocument}
        formatCurrency={formatCurrency}
        onOpenChange={closeEditor}
        onSubmit={handleSubmitDocument}
      />

      <Dialog open={showDetailDialog} onOpenChange={handleDetailDialogChange}>
        <DialogContent className="max-h-[90vh] w-[92vw] max-w-[92vw] overflow-y-auto sm:max-w-[80vw] lg:w-[40vw] lg:max-w-[40vw]">
          {selectedInvoice && selectedInvoiceDocument && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <DialogTitle className="text-2xl">{selectedInvoice.invoiceNumber}</DialogTitle>
                    <DialogDescription>
                      {documentTypeLabels[selectedInvoiceDocument.type]} {tr('created on', 'cree le', 'أُنشئ في')} {formatDate(selectedInvoice.createdAt)}
                    </DialogDescription>
                  </div>
                  <StatusBadge status={selectedInvoiceDocument.status} />
                </div>
              </DialogHeader>

              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border p-4">
                    <p className="text-sm font-semibold">{tr('Client', 'Client', 'العميل')}</p>
                    <div className="mt-3 space-y-2">
                      <p className="font-medium">{selectedInvoice.customer.name}</p>
                      {selectedInvoice.customer.email && (
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          {selectedInvoice.customer.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <p className="text-sm font-semibold">{tr('Summary', 'Resume', 'الملخص')}</p>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{tr('Issued', 'Emission', 'تاريخ الإصدار')}</span>
                        <span>{formatDate(selectedInvoice.issueDate)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{tr('Due date', 'Echeance', 'تاريخ الاستحقاق')}</span>
                        <span>{formatDate(selectedInvoice.dueDate)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{tr('Total', 'Total', 'الإجمالي')}</span>
                        <span className="font-semibold">{formatCurrency(selectedInvoice.total)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{tr('Balance', 'Balance', 'الرصيد')}</span>
                        <span>{formatCurrency(selectedInvoice.balanceDue || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border">
                  <div className="border-b px-4 py-3">
                    <p className="text-sm font-semibold">{tr('Line items', 'Lignes', 'البنود')}</p>
                  </div>
                  <div className="divide-y">
                    {selectedInvoice.items.map((item, index) => (
                      <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-muted-foreground">
                            {item.quantity} x {formatCurrency(item.unitPrice)}
                          </p>
                        </div>
                        <p className="font-semibold">{formatCurrency(item.total)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {(selectedInvoice.notes || selectedInvoice.terms) && (
                  <div className="grid gap-4 md:grid-cols-2">
                    {selectedInvoice.notes && (
                      <div className="rounded-2xl border p-4">
                        <p className="text-sm font-semibold">{tr('Notes', 'Notes', 'ملاحظات')}</p>
                        <p className="mt-2 text-sm text-muted-foreground">{selectedInvoice.notes}</p>
                      </div>
                    )}
                    {selectedInvoice.terms && (
                      <div className="rounded-2xl border p-4">
                        <p className="text-sm font-semibold">{tr('Terms', 'Conditions', 'الشروط')}</p>
                        <p className="mt-2 text-sm text-muted-foreground">{selectedInvoice.terms}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter className="border-t pt-6">
                <Button variant="outline" onClick={() => handleDownloadPDF(selectedInvoice)}>
                  <Download className="mr-2 h-4 w-4" />
                  PDF
                </Button>
                {selectedInvoiceDocument.type === 'invoice' &&
                  ['Sent', 'Viewed', 'Partially Paid', 'Overdue'].includes(selectedInvoice.status) && (
                    <Button
                      onClick={() => {
                        setPaymentForm({
                          amount: selectedInvoice.balanceDue || 0,
                          method: 'external_payment',
                          date: new Date().toISOString().split('T')[0],
                          notes: '',
                          reference: '',
                        });
                        setShowPaymentDialog(true);
                      }}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      {tr('Record payment', 'Enregistrer un paiement', 'تسجيل دفعة')}
                    </Button>
                  )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{tr('Record payment', 'Enregistrer un paiement', 'تسجيل دفعة')}</DialogTitle>
            <DialogDescription>
              {tr(
                'Record a payment to update this invoice balance.',
                'Enregistrez un paiement pour mettre a jour le solde de cette facture.',
                'سجّل دفعة لتحديث رصيد هذه الفاتورة.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{tr('Amount', 'Montant', 'المبلغ')}</Label>
              <Input
                type="number"
                value={paymentForm.amount ?? 0}
                onChange={(event) =>
                  setPaymentForm((previous) => ({ ...previous, amount: Number(event.target.value || 0) }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{tr('Method', 'Methode', 'الطريقة')}</Label>
              <Select
                value={paymentForm.method}
                onValueChange={(value) =>
                  setPaymentForm((previous) => ({ ...previous, method: value as Payment['method'] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="external_payment">{tr('External payment', 'Paiement externe', 'دفع خارجي')}</SelectItem>
                  <SelectItem value="cash">{tr('Cash', 'Especes', 'نقدي')}</SelectItem>
                  <SelectItem value="card">{tr('Card', 'Carte', 'بطاقة')}</SelectItem>
                  <SelectItem value="bank_transfer">{tr('Bank transfer', 'Virement', 'تحويل بنكي')}</SelectItem>
                  <SelectItem value="check">{tr('Check', 'Cheque', 'شيك')}</SelectItem>
                  <SelectItem value="online">{tr('Online', 'En ligne', 'عبر الإنترنت')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{tr('Reference', 'Reference', 'المرجع')}</Label>
              <Input
                value={paymentForm.reference || ''}
                onChange={(event) =>
                  setPaymentForm((previous) => ({ ...previous, reference: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{tr('Notes', 'Notes', 'ملاحظات')}</Label>
              <Textarea
                rows={3}
                value={paymentForm.notes || ''}
                onChange={(event) =>
                  setPaymentForm((previous) => ({ ...previous, notes: event.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter className="border-t pt-6">
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              {tr('Cancel', 'Annuler', 'إلغاء')}
            </Button>
            <Button onClick={handleRecordPayment}>{tr('Save payment', 'Valider le paiement', 'حفظ الدفعة')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{tr('Create Credit Note', 'Creer un Avoir', 'إنشاء إشعار دائن')}</DialogTitle>
            <DialogDescription>
              {tr(
                'A credit note will be generated from the selected invoice.',
                'Un avoir sera genere a partir de la facture selectionnee.',
                'سيتم إنشاء إشعار دائن من الفاتورة المحددة.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{tr('Reason', 'Raison', 'السبب')}</Label>
            <Textarea rows={4} value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} />
          </div>
          <DialogFooter className="border-t pt-6">
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              {tr('Cancel', 'Annuler', 'إلغاء')}
            </Button>
            <Button variant="destructive" onClick={handleCancelInvoice}>
              {tr('Generate credit note', 'Generer l avoir', 'إنشاء إشعار دائن')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{tr('Delete this document?', 'Supprimer ce document ?', 'حذف هذا المستند؟')}</DialogTitle>
            <DialogDescription>
              {tr(
                'This action is irreversible and will delete the selected document.',
                'Cette action est irreversible et supprimera le document selectionne.',
                'هذا الإجراء لا يمكن التراجع عنه وسيحذف المستند المحدد.'
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-t pt-6">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              {tr('Cancel', 'Annuler', 'إلغاء')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteInvoice}>
              {tr('Delete', 'Supprimer', 'حذف')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InvoicesFinancialHub;
