import React, { useMemo, useState } from 'react';
import { ArrowRight, FilePlus2, FileStack, PackageCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useLanguage } from '@/context/LanguageContext';
import type { FinancialDocument, AppLanguage } from './types';

interface CreateInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotes: FinancialDocument[];
  deliveryNotes: FinancialDocument[];
  formatDate: (value?: string) => string;
  formatCurrency: (value: number) => string;
  onBlank: () => void;
  onFromQuote: (quote: FinancialDocument) => void;
  onFromBdls: (deliveryNotes: FinancialDocument[]) => void;
  onCreateDeliveryNote?: () => void;
}

type ModalStep = 'entry' | 'quote' | 'bdl-client' | 'bdl-select';

const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({
  open,
  onOpenChange,
  quotes,
  deliveryNotes,
  formatDate,
  formatCurrency,
  onBlank,
  onFromQuote,
  onFromBdls,
  onCreateDeliveryNote,
}) => {
  const { language } = useLanguage();
  const lang = (language || 'en') as AppLanguage;
  const tr = (en: string, fr: string, ar: string) => (lang === 'ar' ? ar : lang === 'fr' ? fr : en);
  const [step, setStep] = useState<ModalStep>('entry');
  const [selectedClientKey, setSelectedClientKey] = useState<string>('');
  const [selectedDeliveryNotes, setSelectedDeliveryNotes] = useState<string[]>([]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setStep('entry');
      setSelectedClientKey('');
      setSelectedDeliveryNotes([]);
    }
    onOpenChange(nextOpen);
  };

  const clientOptions = useMemo(() => {
    const grouped = new Map<string, { key: string; label: string }>();
    deliveryNotes
      .filter((document) => !document.linkedInvoiceId)
      .forEach((document) => {
        const key = `${document.customer.name || ''}::${document.customer.email || document.customer.phone || ''}`;
        if (!grouped.has(key)) {
          grouped.set(key, {
            key,
            label:
              document.customer.name ||
              document.customer.email ||
              tr('Unnamed client', 'Client sans nom', 'عميل بدون اسم'),
          });
        }
      });
    return Array.from(grouped.values());
  }, [deliveryNotes, lang]);

  const filteredDeliveryNotes = useMemo(() => {
    if (!selectedClientKey) return [];
    return deliveryNotes.filter((document) => {
      const clientKey = `${document.customer.name || ''}::${document.customer.email || document.customer.phone || ''}`;
      return clientKey === selectedClientKey && !document.linkedInvoiceId;
    });
  }, [deliveryNotes, selectedClientKey]);

  const toggleDeliveryNote = (documentId: string, checked: boolean) => {
    setSelectedDeliveryNotes((previous) =>
      checked ? [...previous, documentId] : previous.filter((entry) => entry !== documentId)
    );
  };

  const selectedBdlDocuments = filteredDeliveryNotes.filter((document) =>
    selectedDeliveryNotes.includes(document.id)
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[94vw] max-w-[94vw] sm:max-w-[82vw] lg:w-[42vw] lg:max-w-[42vw]">
        <DialogHeader>
          <DialogTitle>{tr('Create Invoice', 'Creer une Facture', 'إنشاء فاتورة')}</DialogTitle>
          <DialogDescription>
            {tr(
              'Choose the best way to start your invoice.',
              'Choisissez la meilleure facon de demarrer votre facture.',
              'اختر أفضل طريقة لبدء فاتورتك.'
            )}
          </DialogDescription>
        </DialogHeader>

        {step === 'entry' && (
          <div className="grid gap-3 md:grid-cols-3 md:gap-4">
            <button type="button" className="group text-left outline-none" onClick={() => setStep('bdl-client')}>
              <Card className="h-full border-[#001EF4]/20 transition group-hover:border-[#001EF4]/50 group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-[#001EF4]/30">
                <CardContent className="space-y-4 p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#001EF4]/10 text-[#001EF4]">
                      <PackageCheck className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                      {tr('Recommended', 'Recommande', 'موصى به')}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold">{tr('From BDLs', 'Depuis les BDLs', 'من سندات التسليم')}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {tr(
                        'Convert uninvoiced delivery notes into a complete invoice.',
                        'Convertissez des bons de livraison non factures en facture complete.',
                        'حوّل سندات التسليم غير المفوترة إلى فاتورة كاملة.'
                      )}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </CardContent>
              </Card>
            </button>

            <button type="button" className="group text-left outline-none" onClick={() => setStep('quote')}>
              <Card className="h-full border-border transition group-hover:border-[#001EF4]/40 group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-[#001EF4]/30">
                <CardContent className="space-y-4 p-4 sm:p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                    <FileStack className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{tr('From Quote', 'Depuis un Devis', 'من عرض أسعار')}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {tr(
                        'Turn an existing quote into an invoice ready to finalize.',
                        'Transformez un devis existant en facture prete a etre finalisee.',
                        'حوّل عرض أسعار موجود إلى فاتورة جاهزة للإنهاء.'
                      )}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </CardContent>
              </Card>
            </button>

            <button type="button" className="group text-left outline-none" onClick={onBlank}>
              <Card className="h-full border-border transition group-hover:border-[#001EF4]/40 group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-[#001EF4]/30">
                <CardContent className="space-y-4 p-4 sm:p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/5 text-slate-700">
                    <FilePlus2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{tr('Blank', 'Vierge', 'فارغ')}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {tr(
                        'Start from a blank document and configure everything manually.',
                        'Commencez a partir d un document vide et configurez tout manuellement.',
                        'ابدأ من مستند فارغ واضبط كل شيء يدويًا.'
                      )}
                    </p>
                  </div>
                  <Sparkles className="h-4 w-4 text-muted-foreground transition-transform group-hover:scale-110" />
                </CardContent>
              </Card>
            </button>
          </div>
        )}

        {step === 'quote' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{tr('Choose a quote to convert', 'Choisir un devis a convertir', 'اختر عرض أسعار للتحويل')}</p>
              <Button variant="ghost" size="sm" onClick={() => setStep('entry')}>
                {tr('Back', 'Retour', 'رجوع')}
              </Button>
            </div>
            {quotes.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/70 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                {tr('No quotes available yet.', 'Aucun devis disponible pour le moment.', 'لا توجد عروض أسعار متاحة حاليًا.')}
              </div>
            ) : (
              <div className="space-y-3">
                {quotes.map((quote) => (
                  <button
                    key={quote.id}
                    type="button"
                    className="w-full rounded-md border border-border/70 bg-background/40 p-4 text-left outline-none transition hover:border-[#001EF4]/40 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-[#001EF4]/30"
                    onClick={() => onFromQuote(quote)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{quote.number}</p>
                        <p className="text-sm text-muted-foreground">
                          {(quote.customer.name || tr('Unnamed client', 'Client sans nom', 'عميل بدون اسم'))} - {formatDate(quote.issueDate)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(quote.total)}</p>
                        <p className="text-xs text-muted-foreground">
                          {quote.items.length} {tr('lines', 'lignes', 'بنود')}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'bdl-client' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{tr('Step 1 - Select a client', 'Etape 1 - Selectionner un client', 'الخطوة 1 - اختيار عميل')}</p>
              <Button variant="ghost" size="sm" onClick={() => setStep('entry')}>
                {tr('Back', 'Retour', 'رجوع')}
              </Button>
            </div>
            <div className="space-y-2">
              <Label>{tr('Client', 'Client', 'العميل')}</Label>
              <Select value={selectedClientKey} onValueChange={setSelectedClientKey}>
                <SelectTrigger>
                  <SelectValue placeholder={tr('Choose a client', 'Choisir un client', 'اختيار عميل')} />
                </SelectTrigger>
                <SelectContent>
                  {clientOptions.map((client) => (
                    <SelectItem key={client.key} value={client.key}>
                      {client.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep('bdl-select')} disabled={!selectedClientKey}>
                {tr('Continue', 'Continuer', 'متابعة')}
              </Button>
            </div>
          </div>
        )}

        {step === 'bdl-select' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{tr('Step 2 - Select delivery notes', 'Etape 2 - Selectionner les BDLs', 'الخطوة 2 - اختيار سندات التسليم')}</p>
                <p className="text-xs text-muted-foreground">
                  {tr(
                    'Only uninvoiced delivery notes are listed here.',
                    'Seuls les bons de livraison non factures sont proposes ici.',
                    'يتم عرض سندات التسليم غير المفوترة فقط.'
                  )}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setStep('bdl-client')}>
                {tr('Back', 'Retour', 'رجوع')}
              </Button>
            </div>
            {filteredDeliveryNotes.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/70 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                {tr(
                  'No delivery notes are available for this client.',
                  'Aucun bon de livraison disponible pour ce client.',
                  'لا توجد سندات تسليم متاحة لهذا العميل.'
                )}
                {onCreateDeliveryNote && (
                  <div className="mt-4">
                    <Button variant="outline" onClick={onCreateDeliveryNote}>
                      {tr('Create delivery note', 'Creer un BDL', 'إنشاء سند تسليم')}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDeliveryNotes.map((document) => {
                  const checked = selectedDeliveryNotes.includes(document.id);
                  return (
                    <label
                      key={document.id}
                      className="flex cursor-pointer items-start gap-3 rounded-md border border-border/70 bg-background/40 p-4 transition hover:border-[#001EF4]/40 hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => toggleDeliveryNote(document.id, Boolean(value))}
                      />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">{document.number}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(document.issueDate)} - {document.items.length} {tr('lines', 'lignes', 'بنود')}
                            </p>
                          </div>
                          <p className="font-semibold">{formatCurrency(document.total)}</p>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col gap-3 rounded-md bg-muted/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedBdlDocuments.length}{' '}
                {lang === 'ar'
                  ? `سند ${selectedBdlDocuments.length > 1 ? 'تسليم محددة' : 'تسليم محدد'}`
                  : lang === 'fr'
                    ? `BDL selectionne${selectedBdlDocuments.length > 1 ? 's' : ''}`
                    : `delivery note${selectedBdlDocuments.length > 1 ? 's' : ''} selected`}
              </p>
              <Button onClick={() => onFromBdls(selectedBdlDocuments)} disabled={selectedBdlDocuments.length === 0}>
                {tr('Prepare invoice', 'Preparer la facture', 'تحضير الفاتورة')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateInvoiceModal;
