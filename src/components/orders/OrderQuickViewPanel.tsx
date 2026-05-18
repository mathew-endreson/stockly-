import React, { useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Sale } from '@/types';

type QuickViewStatus = {
  label: string;
  className: string;
};

type NormalizedSaleItem = Sale['items'][number] & {
  key: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

const WALK_IN_CUSTOMER_ALIASES = new Set([
  'walk-in customer',
  'walk in customer',
  'عميل داخل المتجر',
  'client en magasin',
]);

const clampNonNegative = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
};

const toCurrencyUnits = (value: number, fractionDigits: number) => {
  const factor = 10 ** fractionDigits;
  const maxAmount = Number.MAX_SAFE_INTEGER / factor;
  const bounded = Math.min(clampNonNegative(value), maxAmount);
  return Math.round(bounded * factor);
};

const fromCurrencyUnits = (value: number, fractionDigits: number) => {
  const factor = 10 ** fractionDigits;
  return clampNonNegative(value) / factor;
};

const parseAmountInput = (rawValue: string) => {
  const cleaned = String(rawValue || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.]/g, '');

  if (!cleaned) return 0;

  const firstDotIndex = cleaned.indexOf('.');
  const normalized =
    firstDotIndex === -1
      ? cleaned
      : `${cleaned.slice(0, firstDotIndex + 1)}${cleaned
          .slice(firstDotIndex + 1)
          .replace(/\./g, '')}`;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(parsed, Number.MAX_SAFE_INTEGER);
};

const formatEditableAmount = (value: number, fractionDigits: number) => {
  const safe = clampNonNegative(value);
  if (fractionDigits === 0) return String(Math.round(safe));
  return safe.toFixed(fractionDigits).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
};

const titleize = (value: string) =>
  String(value || '')
    .replace(/_/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());

const getQuickViewStatus = (order: Sale, t: TFunction): QuickViewStatus => {
  const isCancelled =
    order.status === 'cancelled' ||
    order.status === 'reversed' ||
    order.paymentStatus === 'failed' ||
    order.paymentStatus === 'refunded';

  if (isCancelled) {
    return {
      label: t('ecommerce.quickView.status.cancelled', 'Cancelled'),
      className: 'bg-rose-100 text-rose-700 border border-rose-200',
    };
  }

  if (order.paymentStatus === 'paid') {
    return {
      label: t('ecommerce.quickView.status.paid', 'Paid'),
      className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    };
  }

  return {
    label: t('ecommerce.quickView.status.pending', 'Pending'),
    className: 'bg-amber-100 text-amber-700 border border-amber-200',
  };
};

type OrderQuickViewPanelProps = {
  order: Sale | null;
  formatCurrency: (value: number) => string;
  locale?: string;
  currency?: string;
  hidePaymentCalculator?: boolean;
};

export const OrderQuickViewPanel: React.FC<OrderQuickViewPanelProps> = ({
  order,
  formatCurrency,
  locale = 'en-US',
  currency = 'DZD',
  hidePaymentCalculator = false,
}) => {
  const { t } = useTranslation();
  const fractionDigits = currency === 'DZD' ? 0 : 2;
  const formatCustomerName = (rawName?: string | null, orderType?: string | null) => {
    const normalizedRawName = String(rawName || '').trim();
    const lowerName = normalizedRawName.toLowerCase();
    const isWalkInOrder = String(orderType || '').trim().toLowerCase() === 'walk_in';

    if (WALK_IN_CUSTOMER_ALIASES.has(lowerName) || (!normalizedRawName && isWalkInOrder)) {
      return t('ecommerce.walkInCustomer', 'Walk-in Customer');
    }

    return normalizedRawName || t('ecommerce.customer', 'Customer');
  };

  // Normalize item values once so table values and totals always stay in sync.
  const normalizedItems = useMemo<NormalizedSaleItem[]>(() => {
    if (!order) return [];
    return order.items.map((item, index) => {
      const quantity = clampNonNegative(Number(item.quantity));
      const unitPrice = clampNonNegative(Number(item.unitPrice));
      const fallbackLineTotal = quantity * unitPrice;
      const providedLineTotal = Number(item.totalPrice);
      const lineTotal = Number.isFinite(providedLineTotal)
        ? clampNonNegative(providedLineTotal)
        : clampNonNegative(fallbackLineTotal);

      return {
        ...item,
        key: `${String(item.product)}-${item.sku || 'sku'}-${index}`,
        quantity,
        unitPrice,
        lineTotal,
      };
    });
  }, [order]);

  // Use integer units for money math to avoid floating-point drift.
  const subtotalUnits = useMemo(
    () =>
      normalizedItems.reduce(
        (sum, item) => sum + toCurrencyUnits(item.lineTotal, fractionDigits),
        0
      ),
    [normalizedItems, fractionDigits]
  );
  const discountUnits = toCurrencyUnits(order?.discount ?? 0, fractionDigits);
  const taxUnits = toCurrencyUnits(order?.tax ?? 0, fractionDigits);
  const shippingUnits = toCurrencyUnits(order?.shippingCost ?? 0, fractionDigits);
  const finalTotalUnits = Math.max(0, subtotalUnits - discountUnits + taxUnits + shippingUnits);

  const subtotalAmount = fromCurrencyUnits(subtotalUnits, fractionDigits);
  const discountAmount = fromCurrencyUnits(discountUnits, fractionDigits);
  const taxAmount = fromCurrencyUnits(taxUnits, fractionDigits);
  const shippingAmount = fromCurrencyUnits(shippingUnits, fractionDigits);
  const totalAmount = fromCurrencyUnits(finalTotalUnits, fractionDigits);

  const totalQuantity = useMemo(
    () => normalizedItems.reduce((sum, item) => sum + item.quantity, 0),
    [normalizedItems]
  );

  const [amountReceivedInput, setAmountReceivedInput] = useState(() =>
    formatEditableAmount(totalAmount, fractionDigits)
  );

  const receivedAmount = parseAmountInput(amountReceivedInput);
  const receivedUnits = toCurrencyUnits(receivedAmount, fractionDigits);
  const changeUnits = Math.max(0, receivedUnits - finalTotalUnits);
  const changeAmount = fromCurrencyUnits(changeUnits, fractionDigits);

  // Payment state reacts to every keystroke in the amount received input.
  const paymentFeedback =
    receivedUnits < finalTotalUnits
      ? {
          tone: 'text-red-600',
          message: t('ecommerce.quickView.payment.insufficient', 'Insufficient payment'),
        }
      : receivedUnits === finalTotalUnits
        ? {
            tone: 'text-emerald-600',
            message: t('ecommerce.quickView.payment.exact', 'Exact payment'),
          }
        : {
            tone: 'text-emerald-600',
            message: t('ecommerce.quickView.payment.change', 'Change to return: {{amount}}', {
              amount: formatCurrency(changeAmount),
            }),
          };

  const quickViewStatus = order ? getQuickViewStatus(order, t) : null;

  const quickAddAmount = (amount: number) => {
    const incrementUnits = toCurrencyUnits(amount, fractionDigits);
    const nextUnits = Math.min(Number.MAX_SAFE_INTEGER, receivedUnits + incrementUnits);
    const nextAmount = fromCurrencyUnits(nextUnits, fractionDigits);
    setAmountReceivedInput(formatEditableAmount(nextAmount, fractionDigits));
  };

  const applyExactAmount = () => {
    setAmountReceivedInput(formatEditableAmount(totalAmount, fractionDigits));
  };

  if (!order || !quickViewStatus) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-card p-6 text-center text-sm text-muted-foreground">
        {t('ecommerce.quickView.empty', 'Select an order to open quick view mode.')}
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50/70 to-white p-4 shadow-sm dark:border-slate-700/70 dark:from-slate-900 dark:to-slate-950">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('ecommerce.quickView.orderSummary', 'Order Summary')}
          </h3>
          <Badge className={`rounded-full px-3 py-1 text-xs font-semibold ${quickViewStatus.className}`}>
            {quickViewStatus.label}
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-700/70 dark:bg-slate-800/40">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('ecommerce.quickView.orderNumber', 'Order Number')}
            </p>
            <p className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
              {order.orderNumber}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-700/70 dark:bg-slate-800/40">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('ecommerce.quickView.clientName', 'Client Name')}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {formatCustomerName(order.customer?.name, order.orderType)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-700/70 dark:bg-slate-800/40">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('ecommerce.quickView.dateTime', 'Date & Time')}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {new Date(order.createdAt).toLocaleString(locale, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-700/70 dark:bg-slate-800/40">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('ecommerce.quickView.orderStatus', 'Order Status')}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {quickViewStatus.label}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-700/70 dark:bg-slate-800/40">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('ecommerce.quickView.paymentMethod', 'Payment Method')}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {titleize(order.paymentMethod)}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('ecommerce.products', 'Products')}
          </h3>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {normalizedItems.length}{' '}
            {t('ecommerce.quickView.line', 'line')}
            {normalizedItems.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="max-h-[300px] overflow-auto rounded-xl border border-slate-200/80 dark:border-slate-700/70">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100/90 backdrop-blur dark:bg-slate-800/95">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">
                  {t('ecommerce.quickView.productName', 'Product Name')}
                </th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                  {t('ecommerce.quantity', 'Quantity')}
                </th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                  {t('ecommerce.quickView.unitPrice', 'Unit Price')}
                </th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                  {t('ecommerce.quickView.totalPrice', 'Total Price')}
                </th>
              </tr>
            </thead>
            <tbody>
              {normalizedItems.map((item) => (
                <tr
                  key={item.key}
                  className="border-t border-slate-200/80 transition-colors hover:bg-slate-50 dark:border-slate-700/70 dark:hover:bg-slate-800/50"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{item.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.sku || '-'}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                    {item.quantity}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">
                    {formatCurrency(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 z-10 border-t border-slate-200/80 bg-white/95 dark:border-slate-700/70 dark:bg-slate-900/95">
              <tr>
                <td className="px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {t('ecommerce.quickView.itemsTotal', 'Items Total')}
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {totalQuantity}
                </td>
                <td />
                <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(subtotalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-4 space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-700/70 dark:bg-slate-800/40">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">
              {t('ecommerce.subtotal', 'Subtotal')}
            </span>
            <span className="font-medium text-slate-800 dark:text-slate-100">
              {formatCurrency(subtotalAmount)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">
              {t('ecommerce.discount', 'Discount')}
            </span>
            <span className="font-medium text-emerald-600">-{formatCurrency(discountAmount)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">
              {t('ecommerce.tax', 'Tax')}
            </span>
            <span className="font-medium text-slate-800 dark:text-slate-100">
              {formatCurrency(taxAmount)}
            </span>
          </div>
          {shippingAmount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">
                {t('ecommerce.shipping', 'Shipping')}
              </span>
              <span className="font-medium text-slate-800 dark:text-slate-100">
                {formatCurrency(shippingAmount)}
              </span>
            </div>
          )}
          <div className="mt-2 flex items-end justify-between border-t border-slate-200/80 pt-3 dark:border-slate-700/70">
            <span className="text-base font-semibold text-slate-700 dark:text-slate-100">
              {t('ecommerce.quickView.finalTotal', 'Final Total')}
            </span>
            <span className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-50">
              {formatCurrency(totalAmount)}
            </span>
          </div>
        </div>
      </section>

      {!hidePaymentCalculator && (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700/70 dark:bg-slate-900">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t(
              'ecommerce.quickView.paymentCalculator',
              'Smart Payment & Change Calculator'
            )}
          </h3>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('ecommerce.quickView.totalAmount', 'Total Amount')}
              </label>
              <Input readOnly value={formatCurrency(totalAmount)} className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800/60" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('ecommerce.quickView.amountReceived', 'Amount Received')}
              </label>
              <Input
                inputMode="decimal"
                value={amountReceivedInput}
                onChange={(event) =>
                  setAmountReceivedInput(
                    event.target.value.replace(/[^0-9.,\s]/g, '')
                  )
                }
                className="h-11 rounded-xl"
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('ecommerce.quickView.changeToReturn', 'Change to Return')}
              </label>
              <Input
                readOnly
                value={formatCurrency(changeAmount)}
                className="h-11 rounded-xl bg-slate-50 font-semibold dark:bg-slate-800/60"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => quickAddAmount(50)}>
              +50
            </Button>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => quickAddAmount(100)}>
              +100
            </Button>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => quickAddAmount(200)}>
              +200
            </Button>
            <Button type="button" variant="outline" className="rounded-xl" onClick={applyExactAmount}>
              {t('ecommerce.quickView.exactAmount', 'Exact Amount')}
            </Button>
          </div>

          <p className={`mt-3 text-sm font-semibold ${paymentFeedback.tone}`}>{paymentFeedback.message}</p>
        </section>
      )}
    </div>
  );
};
