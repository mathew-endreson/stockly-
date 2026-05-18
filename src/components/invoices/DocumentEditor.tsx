import React, { useEffect, useMemo, useState } from 'react';
import { Package, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/context/LanguageContext';
import { productsAPI } from '@/services/api';
import type { Invoice, InvoiceCustomer, InvoiceItem, Product } from '@/types';
import type {
  DocumentEditorPayload,
  FinancialDocument,
  FinancialDocumentStatus,
  FinancialDocumentType,
  AppLanguage,
} from './types';

interface DocumentEditorProps {
  open: boolean;
  mode?: 'create' | 'edit';
  documentType: FinancialDocumentType;
  initialDocument?: Partial<FinancialDocument> | null;
  isSubmitting?: boolean;
  formatCurrency: (value: number) => string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: DocumentEditorPayload) => void;
}

interface EditorState {
  customer: InvoiceCustomer;
  items: InvoiceItem[];
  issueDate: string;
  dueDate: string;
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

const todayValue = () => new Date().toISOString().split('T')[0];
const inThirtyDays = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

const defaultStatusByType: Record<FinancialDocumentType, FinancialDocumentStatus> = {
  quote: 'Draft',
  delivery_note: 'Ready to Invoice',
  invoice: 'Draft',
  credit_note: 'Draft',
};

const titleByType: Record<FinancialDocumentType, { create: string; edit: string; description: string }> = {
  quote: {
    create: 'Creer un Devis',
    edit: 'Modifier le Devis',
    description: 'Preparez une proposition commerciale reutilisable et prete a convertir.',
  },
  delivery_note: {
    create: 'Creer un Bon de Livraison',
    edit: 'Modifier le Bon de Livraison',
    description: 'Enregistrez les articles livres avant leur facturation.',
  },
  invoice: {
    create: 'Creer une Facture',
    edit: 'Modifier la Facture',
    description: 'Finalisez votre facture avec les bonnes echeances et lignes de facturation.',
  },
  credit_note: {
    create: 'Creer un Avoir',
    edit: 'Modifier l Avoir',
    description: 'Preparez un avoir ou un ajustement negatif pour le client.',
  },
};

const englishTitleByType: Record<FinancialDocumentType, { create: string; edit: string; description: string }> = {
  quote: {
    create: 'Create Quote',
    edit: 'Edit Quote',
    description: 'Prepare a reusable commercial proposal that can be converted later.',
  },
  delivery_note: {
    create: 'Create Delivery Note',
    edit: 'Edit Delivery Note',
    description: 'Record delivered items before they are invoiced.',
  },
  invoice: {
    create: 'Create Invoice',
    edit: 'Edit Invoice',
    description: 'Finalize your invoice with due dates and billing lines.',
  },
  credit_note: {
    create: 'Create Credit Note',
    edit: 'Edit Credit Note',
    description: 'Prepare a credit note or negative adjustment for the client.',
  },
};

const arabicTitleByType: Record<FinancialDocumentType, { create: string; edit: string; description: string }> = {
  quote: {
    create: 'إنشاء عرض أسعار',
    edit: 'تعديل عرض الأسعار',
    description: 'أعدّ عرضًا تجاريًا قابلًا للتحويل لاحقًا.',
  },
  delivery_note: {
    create: 'إنشاء سند تسليم',
    edit: 'تعديل سند التسليم',
    description: 'سجّل الأصناف المُسلّمة قبل الفوترة.',
  },
  invoice: {
    create: 'إنشاء فاتورة',
    edit: 'تعديل الفاتورة',
    description: 'أكمل الفاتورة بتواريخ الاستحقاق وبنود الفوترة.',
  },
  credit_note: {
    create: 'إنشاء إشعار دائن',
    edit: 'تعديل الإشعار الدائن',
    description: 'أعدّ إشعارًا دائنًا أو تعديلًا سلبيًا للعميل.',
  },
};

const buildInitialState = (
  documentType: FinancialDocumentType,
  initialDocument?: Partial<FinancialDocument> | null
): EditorState => ({
  customer: {
    name: initialDocument?.customer?.name || '',
    email: initialDocument?.customer?.email || '',
    phone: initialDocument?.customer?.phone || '',
    address: initialDocument?.customer?.address || {},
    taxId: initialDocument?.customer?.taxId || '',
  },
  items: initialDocument?.items?.length
    ? initialDocument.items
    : [
        {
          name: '',
          description: '',
          quantity: 1,
          unitPrice: 0,
          discount: 0,
          tax: 0,
          total: 0,
        },
      ],
  issueDate: initialDocument?.issueDate?.split('T')[0] || todayValue(),
  dueDate: initialDocument?.dueDate?.split('T')[0] || inThirtyDays(),
  discount: initialDocument?.discount || { type: 'fixed', value: 0 },
  taxRate: initialDocument?.taxRate || 0,
  shipping: initialDocument?.shipping || 0,
  notes: initialDocument?.notes || '',
  terms: initialDocument?.terms || '',
  template: initialDocument?.template || 'modern',
  color: initialDocument?.color || '#001EF4',
  status: initialDocument?.status || defaultStatusByType[documentType],
  referenceInvoiceId: initialDocument?.referenceInvoiceId || null,
  sourceDocumentIds: initialDocument?.sourceDocumentIds || [],
});

const statusOptionsByType: Record<FinancialDocumentType, FinancialDocumentStatus[]> = {
  quote: ['Draft', 'Sent', 'Viewed'],
  delivery_note: ['Draft', 'Delivered', 'Ready to Invoice', 'Invoiced'],
  invoice: ['Draft', 'Sent', 'Viewed', 'Overdue'],
  credit_note: ['Draft', 'Sent', 'Cancelled'],
};

const DocumentEditor: React.FC<DocumentEditorProps> = ({
  open,
  mode = 'create',
  documentType,
  initialDocument,
  isSubmitting = false,
  formatCurrency,
  onOpenChange,
  onSubmit,
}) => {
  const { language } = useLanguage();
  const lang = (language || 'en') as AppLanguage;
  const tr = (en: string, fr: string, ar: string) => (lang === 'ar' ? ar : lang === 'fr' ? fr : en);
  const [form, setForm] = useState<EditorState>(() => buildInitialState(documentType, initialDocument));
  const [productSearch, setProductSearch] = useState('');
  const [stockProducts, setStockProducts] = useState<Product[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(buildInitialState(documentType, initialDocument));
      setProductSearch('');
      setStockProducts([]);
    }
  }, [documentType, initialDocument, open]);

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(async () => {
      try {
        setSearchingProducts(true);
        const response = await productsAPI.getProducts({
          page: 1,
          limit: 8,
          sort: '-createdAt',
          search: productSearch.trim() || undefined,
        });
        setStockProducts(response.data.products || []);
      } catch {
        setStockProducts([]);
      } finally {
        setSearchingProducts(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [open, productSearch]);

  const totals = useMemo(() => {
    const subtotal = form.items.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const discountAmount =
      form.discount.type === 'percentage'
        ? (subtotal * Number(form.discount.value || 0)) / 100
        : Number(form.discount.value || 0);
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = (afterDiscount * Number(form.taxRate || 0)) / 100;
    const total = afterDiscount + taxAmount + Number(form.shipping || 0);
    return { subtotal, discountAmount, taxAmount, total };
  }, [form.discount.type, form.discount.value, form.items, form.shipping, form.taxRate]);

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    setForm((previous) => {
      const nextItems = [...previous.items];
      const nextItem = { ...nextItems[index], [field]: value };
      const quantity = Number(nextItem.quantity || 0);
      const unitPrice = Number(nextItem.unitPrice || 0);
      const discount = Number(nextItem.discount || 0);
      const tax = Number(nextItem.tax || 0);
      nextItem.total = quantity * unitPrice - discount + tax;
      nextItems[index] = nextItem;
      return { ...previous, items: nextItems };
    });
  };

  const addEmptyItem = () => {
    setForm((previous) => ({
      ...previous,
      items: [
        ...previous.items,
        {
          name: '',
          description: '',
          quantity: 1,
          unitPrice: 0,
          discount: 0,
          tax: 0,
          total: 0,
        },
      ],
    }));
  };

  const removeItem = (index: number) => {
    setForm((previous) => ({
      ...previous,
      items: previous.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const addProduct = (product: Product) => {
    setForm((previous) => {
      const unitPrice =
        documentType === 'credit_note' ? -Math.abs(product.price || 0) : product.price || 0;
      const nextItems = [
        ...previous.items,
        {
          product: product._id,
          name: product.name,
          description: product.description || '',
          quantity: 1,
          unitPrice,
          discount: 0,
          tax: 0,
          total: unitPrice,
        },
      ];
      return { ...previous, items: nextItems };
    });
  };

  const dateFieldLabel =
    documentType === 'quote'
      ? tr('Valid until', 'Validite jusqu au', 'صالح حتى')
      : documentType === 'delivery_note'
        ? tr('Delivery date', 'Date de livraison', 'تاريخ التسليم')
        : documentType === 'credit_note'
          ? tr('Credit note date', 'Date de l avoir', 'تاريخ الإشعار الدائن')
          : tr('Due date', 'Date d echeance', 'تاريخ الاستحقاق');

  const helperText =
    documentType === 'delivery_note'
      ? tr(
          'Delivery notes can be used later as the base for invoicing.',
          'Les BDLs servent de base pour la facturation client.',
          'يمكن استخدام سندات التسليم لاحقًا كأساس للفوترة.'
        )
      : documentType === 'credit_note'
        ? tr(
            'Add negative lines to represent the adjustment.',
            'Ajoutez des lignes negatives pour representer l ajustement.',
            'أضف بنودًا سلبية لتمثيل التعديل.'
          )
        : tr(
            'Product lines automatically feed the document totals.',
            'Les lignes produits alimentent automatiquement les totaux du document.',
            'بنود المنتجات تغذّي إجماليات المستند تلقائيًا.'
          );

  const titleByLang: Record<FinancialDocumentType, { create: string; edit: string; description: string }> =
    lang === 'ar' ? arabicTitleByType : lang === 'fr' ? titleByType : englishTitleByType;
  const dialogCopy = titleByLang[documentType];

  const handleSubmit = () => {
    onSubmit({
      documentType,
      customer: form.customer,
      items: form.items.filter((item) => item.name.trim()),
      issueDate: form.issueDate,
      dueDate: documentType === 'credit_note' ? form.issueDate : form.dueDate,
      discount: form.discount,
      taxRate: form.taxRate,
      shipping: form.shipping,
      notes: form.notes,
      terms: form.terms,
      template: form.template,
      color: form.color,
      status: form.status,
      referenceInvoiceId: form.referenceInvoiceId || null,
      sourceDocumentIds: form.sourceDocumentIds || [],
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[92vw] max-w-[92vw] overflow-y-auto sm:max-w-[88vw] lg:w-[40vw] lg:max-w-[40vw]">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? dialogCopy.edit : dialogCopy.create}</DialogTitle>
          <DialogDescription>{dialogCopy.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-8 py-1">
          <section className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{tr('Client', 'Client', 'العميل')}</Label>
                <Input
                  value={form.customer.name || ''}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      customer: { ...previous.customer, name: event.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{tr('Email', 'Email', 'البريد الإلكتروني')}</Label>
                <Input
                  value={form.customer.email || ''}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      customer: { ...previous.customer, email: event.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{tr('Phone', 'Telephone', 'الهاتف')}</Label>
                <Input
                  value={form.customer.phone || ''}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      customer: { ...previous.customer, phone: event.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{dateFieldLabel}</Label>
                <Input
                  type="date"
                  value={documentType === 'credit_note' ? form.issueDate : form.dueDate}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      dueDate: event.target.value,
                      issueDate: documentType === 'credit_note' ? event.target.value : previous.issueDate,
                    }))
                  }
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{tr('Document lines', 'Lignes du document', 'بنود المستند')}</p>
                <p className="text-xs text-muted-foreground">{helperText}</p>
              </div>
              <Button variant="outline" size="sm" onClick={addEmptyItem}>
                {tr('Add line', 'Ajouter une ligne', 'إضافة بند')}
              </Button>
            </div>

            <div className="space-y-3 rounded-2xl border bg-card/40 p-4">
              <Label>{tr('Add from stock', 'Ajouter depuis le stock', 'إضافة من المخزون')}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder={tr('Search product by name, SKU, or barcode', 'Rechercher un produit par nom, SKU ou code-barres', 'بحث عن منتج بالاسم أو SKU أو الباركود')}
                  className="pl-10"
                />
              </div>
              <div className="max-h-48 overflow-y-auto rounded-xl border">
                {searchingProducts ? (
                  <div className="p-3 text-sm text-muted-foreground">{tr('Loading products...', 'Chargement des produits...', 'جاري تحميل المنتجات...')}</div>
                ) : stockProducts.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">{tr('No products found.', 'Aucun produit trouve.', 'لم يتم العثور على منتجات.')}</div>
                ) : (
                  stockProducts.map((product) => (
                    <button
                      key={product._id}
                      type="button"
                      className="flex w-full items-center justify-between border-b px-3 py-3 text-left last:border-b-0 hover:bg-muted/50"
                      onClick={() => addProduct(product)}
                    >
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {product.sku || '-'} - {tr('Stock', 'Stock', 'المخزون')} {product.quantity}
                        </p>
                      </div>
                      <p className="text-sm font-semibold">{formatCurrency(product.price || 0)}</p>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-3">
              {form.items.map((item, index) => (
                <div
                  key={`${item.name}-${index}`}
                  className="grid gap-3 rounded-2xl border bg-card/30 p-4 md:grid-cols-[minmax(0,2fr)_100px_120px_120px_48px]"
                >
                  <div className="space-y-2">
                    <Input
                      placeholder={tr('Line name', 'Nom de la ligne', 'اسم البند')}
                      value={item.name}
                      onChange={(event) => updateItem(index, 'name', event.target.value)}
                    />
                    <Input
                      placeholder={tr('Description', 'Description', 'الوصف')}
                      value={item.description}
                      onChange={(event) => updateItem(index, 'description', event.target.value)}
                    />
                  </div>
                  <Input
                    type="number"
                    value={item.quantity}
                    onChange={(event) => updateItem(index, 'quantity', Number(event.target.value || 0))}
                  />
                  <Input
                    type="number"
                    value={item.unitPrice}
                    onChange={(event) => updateItem(index, 'unitPrice', Number(event.target.value || 0))}
                  />
                  <Input value={formatCurrency(item.total)} disabled />
                  <Button variant="ghost" size="icon" onClick={() => removeItem(index)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.95fr)]">
            <div className="space-y-4 rounded-2xl border bg-card/30 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Package className="h-4 w-4" />
                {tr('Document settings', 'Reglages du document', 'إعدادات المستند')}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{tr('Status', 'Statut', 'الحالة')}</Label>
                  <Select
                    value={form.status}
                    onValueChange={(value) =>
                      setForm((previous) => ({
                        ...previous,
                        status: value as FinancialDocumentStatus,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptionsByType[documentType].map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{tr('Template', 'Template', 'القالب')}</Label>
                  <Select
                    value={form.template}
                    onValueChange={(value) =>
                      setForm((previous) => ({
                        ...previous,
                        template: value as Invoice['template'],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="modern">Modern</SelectItem>
                      <SelectItem value="classic">Classic</SelectItem>
                      <SelectItem value="minimal">Minimal</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{tr('Discount type', 'Type de remise', 'نوع الخصم')}</Label>
                  <Select
                    value={form.discount.type}
                    onValueChange={(value) =>
                      setForm((previous) => ({
                        ...previous,
                        discount: {
                          ...previous.discount,
                          type: value as 'fixed' | 'percentage',
                        },
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">{tr('Fixed', 'Fixe', 'ثابت')}</SelectItem>
                      <SelectItem value="percentage">{tr('Percentage', 'Pourcentage', 'نسبة مئوية')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{tr('Discount value', 'Valeur de remise', 'قيمة الخصم')}</Label>
                  <Input
                    type="number"
                    value={form.discount.value}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        discount: {
                          ...previous.discount,
                          value: Number(event.target.value || 0),
                        },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tr('VAT (%)', 'TVA (%)', 'ضريبة القيمة المضافة (%)')}</Label>
                  <Input
                    type="number"
                    value={form.taxRate}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        taxRate: Number(event.target.value || 0),
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tr('Additional fees', 'Frais additionnels', 'رسوم إضافية')}</Label>
                  <Input
                    type="number"
                    value={form.shipping}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        shipping: Number(event.target.value || 0),
                      }))
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{tr('Notes', 'Notes', 'ملاحظات')}</Label>
                  <Textarea
                    rows={4}
                    value={form.notes}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, notes: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    {documentType === 'delivery_note'
                      ? tr('Delivery instructions', 'Instructions de livraison', 'تعليمات التسليم')
                      : tr('Terms', 'Conditions', 'الشروط')}
                  </Label>
                  <Textarea
                    rows={4}
                    value={form.terms}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, terms: event.target.value }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-muted/50 p-5">
              <p className="text-sm font-semibold">{tr('Summary', 'Resume', 'الملخص')}</p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{tr('Subtotal', 'Sous-total', 'المجموع الفرعي')}</span>
                  <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{tr('Discount', 'Remise', 'الخصم')}</span>
                  <span className="font-medium">-{formatCurrency(totals.discountAmount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{tr('VAT', 'TVA', 'ض.ق.م')}</span>
                  <span className="font-medium">{formatCurrency(totals.taxAmount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{tr('Fees', 'Frais', 'رسوم')}</span>
                  <span className="font-medium">{formatCurrency(form.shipping)}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-3 text-base font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <DialogFooter className="border-t pt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tr('Cancel', 'Annuler', 'إلغاء')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!form.customer.name.trim() || form.items.filter((item) => item.name.trim()).length === 0 || isSubmitting}
            className="bg-[#001EF4] hover:bg-[#001EF4]/90"
          >
            {isSubmitting
              ? tr('Saving...', 'Enregistrement...', 'جاري الحفظ...')
              : mode === 'edit'
                ? tr('Update', 'Mettre a jour', 'تحديث')
                : tr('Save', 'Enregistrer', 'حفظ')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentEditor;
