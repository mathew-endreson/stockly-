import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ShoppingCart,
  Package,
  Users,
  DollarSign,
  Search,
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Phone,
  Mail,
  TrendingUp,
  Plus,
  ScanLine,
  Printer,
  Trash2,
  Edit3,
  MoreHorizontal,
  CalendarClock,
  Download,
  FileUp,
  Truck,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

import { businessAPI, clientsAPI, integrationsAPI, productsAPI, salesAPI } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import type {
  ClientRecord,
  ClothingVariant,
  Product,
  ProductMeasurementType,
  Sale,
  ShippingCarrier,
  ShippingProviderConnectionStatus,
  ShippingProviderKey,
  SalesAnalytics
} from '@/types';
import BarcodeScanner from '@/components/BarcodeScanner';
import { OrderQuickViewPanel } from '@/components/orders/OrderQuickViewPanel';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useKeyboardBarcodeScanner } from '@/hooks/useKeyboardBarcodeScanner';
import {
  formatQuantityWithUnit,
  getMeasurementOption,
  isCountMeasurementType,
  normalizeProductMeasurementType
} from '@/constants/productMeasurements';
import { ALGERIA_WILAYA_OPTIONS } from '@/constants/algeriaWilayas';
import {
  getCommunesByWilayaAndDaira,
  getDairasByWilaya
} from '@/constants/algeriaAdmin';
import {
  SHIPPING_CARRIER_OPTIONS,
  formatShippingCarrier
} from '@/constants/shippingCarriers';
import {
  getShippingProviderLabel
} from '@/constants/shippingProviders';
import {
  isSaleImportRowEmpty,
  mapSaleHeadersToCanonical,
  normalizeSaleImportRow,
  type NormalizedSaleImportRow,
  type SaleImportRowIssue
} from '@/lib/salesCsvImport';
import { getPriceForTier, normalizePricingTier } from '@/lib/pricing';
import {
  parseTabularImportFile,
  downloadTabularRows,
  type TabularFormat
} from '@/lib/tabularFiles';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  confirmed: 'bg-[#0E92F0]',
  processing: 'bg-[#F2700F]',
  shipping: 'bg-[#BBF00F]',
  delivered: 'bg-[#10E642]',
  cancelled: 'bg-[#F0162F]',
  reversed: 'bg-[#0A1DF5]',
  pending: 'bg-[#F2700F]',
  shipped: 'bg-[#BBF00F]',
  refunded: 'bg-[#0A1DF5]',
};

const paymentStatusColors: Record<string, string> = {
  pending: 'bg-yellow-500',
  paid: 'bg-green-500',
  partial: 'bg-orange-500',
  refunded: 'bg-gray-500',
  failed: 'bg-red-500',
};

const statusTriggerColors: Record<string, string> = {
  confirmed: 'border-[#0E92F0]/35 bg-[#0E92F0]/10 text-[#0E92F0] hover:bg-[#0E92F0]/15',
  processing: 'border-[#F2700F]/35 bg-[#F2700F]/10 text-[#F2700F] hover:bg-[#F2700F]/15',
  shipping: 'border-[#BBF00F]/45 bg-[#BBF00F]/15 text-[#BBF00F] hover:bg-[#BBF00F]/20',
  delivered: 'border-[#10E642]/35 bg-[#10E642]/10 text-[#10E642] hover:bg-[#10E642]/15',
  cancelled: 'border-[#F0162F]/35 bg-[#F0162F]/10 text-[#F0162F] hover:bg-[#F0162F]/15',
  reversed: 'border-[#0A1DF5]/35 bg-[#0A1DF5]/10 text-[#0A1DF5] hover:bg-[#0A1DF5]/15',
  pending: 'border-[#F2700F]/35 bg-[#F2700F]/10 text-[#F2700F] hover:bg-[#F2700F]/15',
  shipped: 'border-[#BBF00F]/45 bg-[#BBF00F]/15 text-[#BBF00F] hover:bg-[#BBF00F]/20',
  refunded: 'border-[#0A1DF5]/35 bg-[#0A1DF5]/10 text-[#0A1DF5] hover:bg-[#0A1DF5]/15',
};

const paymentTriggerColors: Record<string, string> = {
  pending: 'border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100',
  paid: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  partial: 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100',
  refunded: 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
  failed: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
};

const statusOptionStyles: Record<string, string> = {
  confirmed:
    'border-[#0E92F0]/35 bg-[#0E92F0]/10 text-[#0E92F0] data-[highlighted]:bg-[#0E92F0]/20 data-[highlighted]:text-[#0E92F0]',
  processing:
    'border-[#F2700F]/35 bg-[#F2700F]/10 text-[#F2700F] data-[highlighted]:bg-[#F2700F]/20 data-[highlighted]:text-[#F2700F]',
  shipping:
    'border-[#BBF00F]/45 bg-[#BBF00F]/15 text-[#BBF00F] data-[highlighted]:bg-[#BBF00F]/25 data-[highlighted]:text-[#BBF00F]',
  delivered:
    'border-[#10E642]/35 bg-[#10E642]/10 text-[#10E642] data-[highlighted]:bg-[#10E642]/20 data-[highlighted]:text-[#10E642]',
  cancelled:
    'border-[#F0162F]/35 bg-[#F0162F]/10 text-[#F0162F] data-[highlighted]:bg-[#F0162F]/20 data-[highlighted]:text-[#F0162F]',
  reversed:
    'border-[#0A1DF5]/35 bg-[#0A1DF5]/10 text-[#0A1DF5] data-[highlighted]:bg-[#0A1DF5]/20 data-[highlighted]:text-[#0A1DF5]',
  pending:
    'border-[#F2700F]/35 bg-[#F2700F]/10 text-[#F2700F] data-[highlighted]:bg-[#F2700F]/20 data-[highlighted]:text-[#F2700F]',
  shipped:
    'border-[#BBF00F]/45 bg-[#BBF00F]/15 text-[#BBF00F] data-[highlighted]:bg-[#BBF00F]/25 data-[highlighted]:text-[#BBF00F]',
  refunded:
    'border-[#0A1DF5]/35 bg-[#0A1DF5]/10 text-[#0A1DF5] data-[highlighted]:bg-[#0A1DF5]/20 data-[highlighted]:text-[#0A1DF5]',
};

const paymentOptionStyles: Record<string, string> = {
  pending:
    'border-yellow-200 bg-yellow-50/80 text-yellow-800 data-[highlighted]:bg-yellow-100 data-[highlighted]:text-yellow-900',
  paid:
    'border-emerald-200 bg-emerald-50/80 text-emerald-800 data-[highlighted]:bg-emerald-100 data-[highlighted]:text-emerald-900',
  partial:
    'border-orange-200 bg-orange-50/80 text-orange-800 data-[highlighted]:bg-orange-100 data-[highlighted]:text-orange-900',
  refunded:
    'border-slate-200 bg-slate-50/80 text-slate-800 data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-900',
  failed:
    'border-red-200 bg-red-50/80 text-red-800 data-[highlighted]:bg-red-100 data-[highlighted]:text-red-900',
};

const saleStatusOptions: Array<Sale['status']> = [
  'confirmed',
  'processing',
  'shipping',
  'delivered',
  'cancelled',
  'reversed',
];

const paymentStatusOptions: Array<Sale['paymentStatus']> = [
  'pending',
  'paid',
  'partial',
  'refunded',
  'failed',
];

const DATE_LOCALE_BY_LANGUAGE: Record<string, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  ar: 'ar-DZ',
};

const WALK_IN_CUSTOMER_ALIASES = new Set([
  'walk-in customer',
  'walk in customer',
  'عميل داخل المتجر',
  'client en magasin',
]);

const normalizeSaleStatusForUi = (status: string): Sale['status'] => {
  if (status === 'pending') return 'processing';
  if (status === 'shipped') return 'shipping';
  if (status === 'refunded') return 'reversed';
  return status as Sale['status'];
};

const normalizeSaleForUi = (sale: Sale): Sale => ({
  ...sale,
  status: normalizeSaleStatusForUi(sale.status),
});

const ACTIVE_QUICK_VIEW_STATUSES: Sale['status'][] = ['processing', 'confirmed', 'shipping'];

const getSaleActivityTimestamp = (sale: Pick<Sale, 'updatedAt' | 'createdAt'>) => {
  const updatedAtTime = Date.parse(sale.updatedAt);
  if (Number.isFinite(updatedAtTime)) return updatedAtTime;

  const createdAtTime = Date.parse(sale.createdAt);
  if (Number.isFinite(createdAtTime)) return createdAtTime;

  return 0;
};

const resolveRealActiveSale = (sales: Sale[]): Sale | null => {
  if (sales.length === 0) return null;

  const activeCandidates = sales.filter((sale) =>
    ACTIVE_QUICK_VIEW_STATUSES.includes(normalizeSaleStatusForUi(sale.status))
  );

  if (activeCandidates.length === 0) return null;

  return activeCandidates
    .slice()
    .sort((left, right) => getSaleActivityTimestamp(right) - getSaleActivityTimestamp(left))[0];
};

type QuickSellCartItem = {
  productId: string;
  name: string;
  sku: string;
  measurementType: ProductMeasurementType;
  price: number;
  prices?: Product['prices'];
  soldDiscountPercent?: number;
  secondPrice?: number | null;
  variants: ClothingVariant[];
  variantId?: string;
  quantity: number;
  availableQuantity: number;
  unitPrice: number;
  minimumUnitPrice: number | null;
};

type OrderType = 'walk_in' | 'shipped';
type HighlightPriority = 'high' | 'medium' | 'low';
const MANUAL_CLIENT_SELECT_VALUE = '__manual__';

type ShippingFormState = {
  mode: 'domestic' | 'stopdesk';
  phone: string;
  street: string;
  wilaya: string;
  daira: string;
  commune: string;
  carrier: ShippingCarrier;
  trackingNumber: string;
  notes: string;
  shippingCost: string;
};

const createInitialShippingForm = (): ShippingFormState => ({
  mode: 'domestic',
  phone: '',
  street: '',
  wilaya: '',
  daira: '',
  commune: '',
  carrier: 'yassir',
  trackingNumber: '',
  notes: '',
  shippingCost: '',
});

type OrderImportResult = {
  totalRows: number;
  importedOrders: number;
  importedItems: number;
  skipped: SaleImportRowIssue[];
  unmappedHeaders: { header: string; reason: string }[];
  errors: { order: string; error: string }[];
};

type ProductLookupIndex = {
  byId: Map<string, Product>;
  bySku: Map<string, Product>;
  byBarcode: Map<string, Product>;
  byName: Map<string, Product[]>;
};

const HIGHLIGHT_ROW_CLASS_BY_PRIORITY: Record<HighlightPriority, string> = {
  high: 'bg-red-50 dark:bg-red-950/30 shadow-[inset_0_0_0_2px_rgb(239_68_68)] hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors duration-200',
  medium:
    'bg-orange-50 dark:bg-orange-950/30 shadow-[inset_0_0_0_2px_rgb(249_115_22)] hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors duration-200',
  low: 'bg-green-50 dark:bg-green-950/30 shadow-[inset_0_0_0_2px_rgb(34_197_94)] hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors duration-200',
};

const getResolvedMeasurementType = (
  value: ProductMeasurementType | string | null | undefined
): ProductMeasurementType => normalizeProductMeasurementType(value);

const normalizeShippingMode = (
  value: string | null | undefined
): 'domestic' | 'stopdesk' => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
  return ['stopdesk', 'stop_desk', 'desk_pickup', 'pickup_desk'].includes(normalized)
    ? 'stopdesk'
    : 'domestic';
};

const buildShippingCity = (shipping: ShippingFormState): string => {
  const parts = [shipping.commune, shipping.daira, shipping.wilaya]
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.join(', ');
};

const getProductSoldDiscountPercent = (product?: Pick<Product, 'soldDiscountPercent'> | null) =>
  Math.max(0, Math.min(100, Number(product?.soldDiscountPercent) || 0));

const getProductMinimumSalePrice = (product?: Pick<Product, 'secondPrice'> | null) => {
  const parsed = Number(product?.secondPrice);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
};

const getDiscountedUnitPrice = (
  product: Pick<Product, 'price' | 'prices' | 'soldDiscountPercent' | 'secondPrice'>,
  pricingTier: ClientRecord['pricingTier'] | undefined = 'default'
) => {
  const discountPercent = getProductSoldDiscountPercent(product);
  const discounted = getPriceForTier(product, pricingTier) * (1 - discountPercent / 100);
  const secondPrice = getProductMinimumSalePrice(product);
  const effective = secondPrice === null ? discounted : Math.max(discounted, secondPrice);
  return Number(effective.toFixed(2));
};

const getVariantProductId = (variant: ClothingVariant): string => {
  if (typeof variant.product === 'string') return String(variant.product);
  return String(variant.product?._id || '');
};

const normalizeLookupToken = (value: string | undefined | null) =>
  (value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const getSaleOrderType = (sale: Sale): OrderType => {
  if (sale.orderType === 'walk_in' || sale.orderType === 'shipped') return sale.orderType;

  const hasShippingDetails = Boolean(
    sale.customer?.address?.street ||
      sale.customer?.address?.city ||
      sale.shipping?.trackingNumber ||
      sale.shipping?.carrier ||
      sale.shipping?.shippingDate ||
      sale.shipping?.deliveryDate ||
      (Number(sale.shippingCost) || 0) > 0
  );

  return hasShippingDetails ? 'shipped' : 'walk_in';
};

const normalizeCarrierToken = (value: string | undefined | null) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const SHIPPING_CARRIER_BY_TOKEN = (() => {
  const entries: Array<[string, ShippingCarrier]> = [];
  SHIPPING_CARRIER_OPTIONS.forEach((option) => {
    entries.push([normalizeCarrierToken(option.value), option.value]);
    entries.push([normalizeCarrierToken(option.label), option.value]);
  });
  entries.push(['yalidine', 'yalidine_express']);
  entries.push(['yassir_express', 'yassir']);
  entries.push(['local', 'local']);
  entries.push(['other', 'other']);
  return new Map(entries);
})();

const resolveShippingCarrierFromInput = (value: string | undefined | null): ShippingCarrier => {
  const token = normalizeCarrierToken(value);
  if (!token) return 'other';
  return SHIPPING_CARRIER_BY_TOKEN.get(token) || (token as ShippingCarrier);
};

const buildPageNumberItems = (
  currentPage: number,
  totalPages: number
): Array<number | 'ellipsis'> => {
  if (totalPages <= 0) return [];

  const pagesToShow = new Set<number>([1, totalPages]);
  for (
    let page = Math.max(1, currentPage - 1);
    page <= Math.min(totalPages, currentPage + 1);
    page += 1
  ) {
    pagesToShow.add(page);
  }

  if (currentPage <= 3) {
    for (let page = 1; page <= Math.min(totalPages, 4); page += 1) {
      pagesToShow.add(page);
    }
  }

  if (currentPage >= totalPages - 2) {
    for (let page = Math.max(1, totalPages - 3); page <= totalPages; page += 1) {
      pagesToShow.add(page);
    }
  }

  const sortedPages = Array.from(pagesToShow).sort((a, b) => a - b);
  const items: Array<number | 'ellipsis'> = [];

  sortedPages.forEach((page, index) => {
    if (index > 0) {
      const previousPage = sortedPages[index - 1];
      if (page - previousPage > 1) {
        items.push('ellipsis');
      }
    }
    items.push(page);
  });

  return items;
};

const EcommercePage: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL, language } = useLanguage();
  const { user, canManageSales, canManageEcommerce, canViewAnalytics, canDelete, updateOnboarding } = useAuth();
  const canManageSalesAccess = canManageSales();
  const canAccessOrders = canManageEcommerce();
  const canAccessOrderAnalytics = canViewAnalytics();
  const canDeleteAccess = canDelete();
  const isEcommerceBusiness = user?.businessType === 'ecommerce';
  const isClothingRetailBusiness = user?.businessType === 'clothing_retail';
  const isSupermarketBusiness = user?.businessType === 'supermarket';
  const hasShippingCapability = (() => {
    if (isEcommerceBusiness) return true;
    const orderType = user?.nicheQuestionnaireAnswers?.orderType;
    return orderType === 'shipping' || orderType === 'both';
  })();
  const canDispatchOrdersToShipping = canAccessOrders && hasShippingCapability;
  const supportsVariantProducts = isClothingRetailBusiness || isEcommerceBusiness;
  const { formatCurrency, currency } = useCurrencyFormatter();
  const isDzdCurrency = currency === 'DZD';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const notifyAnalyticsRefresh = () => {
    window.dispatchEvent(new CustomEvent('stockly:analytics-refresh'));
  };
  const notifyActivity = (detail: { id: string; title: string; description: string; badge?: string; amount?: number }) => {
    window.dispatchEvent(new CustomEvent('stockly:activity', { detail }));
  };

  const blockNonIntegerPriceKeys = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDzdCurrency) return;
    if (['.', ',', 'e', 'E', '+', '-'].includes(event.key)) {
      event.preventDefault();
    }
  };

  const blockNonIntegerPricePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    if (!isDzdCurrency) return;
    const pastedValue = event.clipboardData.getData('text');
    if (/[.,eE+-]/.test(pastedValue)) {
      event.preventDefault();
    }
  };

  const parseCurrencyInput = (rawValue: string): number | null => {
    const normalized = String(rawValue || '').trim();
    if (!normalized) return 0;
    if (isDzdCurrency && /[.,]/.test(normalized)) return null;
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    if (isDzdCurrency && !Number.isInteger(parsed)) return null;
    return parsed;
  };
  
  const [sales, setSales] = useState<Sale[]>([]);
  const [analytics, setAnalytics] = useState<SalesAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState<'day' | '3days' | 'week' | 'month' | 'year' | 'all'>('all');
  const [selectedSaleIds, setSelectedSaleIds] = useState<string[]>([]);
  const [shippingProviders, setShippingProviders] = useState<ShippingProviderConnectionStatus[]>([]);
  const [isShippingProvidersLoading, setIsShippingProvidersLoading] = useState(false);
  const [isShippingDispatchDialogOpen, setIsShippingDispatchDialogOpen] = useState(false);
  const [shippingDispatchProvider, setShippingDispatchProvider] = useState<ShippingProviderKey | ''>('');
  const [shippingDispatchSaleIds, setShippingDispatchSaleIds] = useState<string[]>([]);
  const [isShippingDispatching, setIsShippingDispatching] = useState(false);
  const [highlightSaleIds, setHighlightSaleIds] = useState<string[]>([]);
  const [highlightPriority, setHighlightPriority] = useState<HighlightPriority>('medium');
  const [didAutoScrollToHighlight, setDidAutoScrollToHighlight] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isOrdersQuickViewMode, setIsOrdersQuickViewMode] = useState(false);
  const [isQuickViewCurrentSaleFocused, setIsQuickViewCurrentSaleFocused] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isScanNotFoundDialogOpen, setIsScanNotFoundDialogOpen] = useState(false);
  const [scanNotFoundBarcode, setScanNotFoundBarcode] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [editStatus, setEditStatus] = useState('');
  const [editPaymentStatus, setEditPaymentStatus] = useState('');
  const [updatingSaleField, setUpdatingSaleField] = useState<string | null>(null);
  const [isQuickSellModalOpen, setIsQuickSellModalOpen] = useState(false);
  const [quickSellCart, setQuickSellCart] = useState<QuickSellCartItem[]>([]);
  const [quickSellBuyerName, setQuickSellBuyerName] = useState('');
  const [savedClients, setSavedClients] = useState<ClientRecord[]>([]);
  const [selectedQuickSellClientKey, setSelectedQuickSellClientKey] = useState(MANUAL_CLIENT_SELECT_VALUE);
  const [quickSellError, setQuickSellError] = useState('');
  const [isCreatingQuickSellOrder, setIsCreatingQuickSellOrder] = useState(false);
  const quickSellAddInFlightRef = useRef<Set<string>>(new Set());
  const [quickSellAddingProductIds, setQuickSellAddingProductIds] = useState<Set<string>>(
    () => new Set()
  );
  const [quickSellOrderType, setQuickSellOrderType] = useState<OrderType>(
    isEcommerceBusiness ? 'shipped' : 'walk_in'
  );
  const [quickSellShipping, setQuickSellShipping] = useState<ShippingFormState>(
    createInitialShippingForm()
  );
  const [quickSellProductSearch, setQuickSellProductSearch] = useState('');
  const [quickSellProductResults, setQuickSellProductResults] = useState<Product[]>([]);
  const [quickSellProductSearchError, setQuickSellProductSearchError] = useState('');
  const [isQuickSellProductSearchLoading, setIsQuickSellProductSearchLoading] = useState(false);
  const [quickViewAmountReceivedInput, setQuickViewAmountReceivedInput] = useState('');
  const [isOrdersImportModalOpen, setIsOrdersImportModalOpen] = useState(false);
  const [ordersImportRows, setOrdersImportRows] = useState<string[][]>([]);
  const [ordersImportFileName, setOrdersImportFileName] = useState('');
  const [ordersImportResult, setOrdersImportResult] = useState<OrderImportResult | null>(null);
  const [isImportingOrders, setIsImportingOrders] = useState(false);
  const [isExportingOrders, setIsExportingOrders] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    pages: 0,
  });
  const variantCacheRef = useRef<Map<string, ClothingVariant[]>>(new Map());
  const selectableClients = savedClients.filter((client) => String(client?.name || '').trim() !== '');
  const selectedQuickSellClient = useMemo(
    () =>
      selectedQuickSellClientKey === MANUAL_CLIENT_SELECT_VALUE
        ? null
        : selectableClients.find((client) => client.clientKey === selectedQuickSellClientKey) || null,
    [selectableClients, selectedQuickSellClientKey]
  );
  const connectedShippingProviders = useMemo(
    () => shippingProviders.filter((provider) => provider.isActive),
    [shippingProviders]
  );
  const canSelectOrders = canDeleteAccess || canDispatchOrdersToShipping;
  const selectedSalesForShippingDispatch = useMemo(
    () =>
      sales.filter((sale) => shippingDispatchSaleIds.includes(String(sale._id))),
    [sales, shippingDispatchSaleIds]
  );
  const selectedQuickSellPricingTier = normalizePricingTier(selectedQuickSellClient?.pricingTier);

  const loadSavedClients = useCallback(async () => {
    if (!canManageSalesAccess) return;
    try {
      const response = await clientsAPI.getClients({
        range: '30days',
        sortBy: 'name',
        sortDirection: 'asc',
        page: 1,
        limit: 200
      });
      setSavedClients(response.data?.clients || []);
    } catch {
      setSavedClients([]);
    }
  }, [canManageSalesAccess]);

  const findSavedClientByName = (name: string) => {
    const normalized = String(name || '').trim().toLowerCase();
    if (!normalized) return null;
    return (
      selectableClients.find(
        (client) => String(client.name || '').trim().toLowerCase() === normalized
      ) || null
    );
  };

  const handleQuickSellClientSelection = (value: string) => {
    setSelectedQuickSellClientKey(value);
    if (value === MANUAL_CLIENT_SELECT_VALUE) return;
    const selectedClient = selectableClients.find((client) => client.clientKey === value);
    if (!selectedClient) return;
    setQuickSellBuyerName(selectedClient.name || '');
    setQuickSellShipping((prev) => ({
      ...prev,
      phone: prev.phone || selectedClient.phone || ''
    }));
    if (quickSellError) {
      setQuickSellError('');
    }
  };

  useEffect(() => {
    setQuickSellCart((prev) =>
      prev.map((item) => ({
        ...item,
        unitPrice: getDiscountedUnitPrice(item, selectedQuickSellPricingTier),
      }))
    );
  }, [selectedQuickSellPricingTier]);

  useEffect(() => {
    if (!selectedQuickSellClient?.phone) return;
    setQuickSellShipping((prev) => ({
      ...prev,
      phone: prev.phone || selectedQuickSellClient.phone || '',
    }));
  }, [selectedQuickSellClient]);

  useEffect(() => {
    if (!canAccessOrders) {
      setSales([]);
      setAnalytics(null);
      setLoading(false);
      return;
    }
    fetchSales();
    if (canAccessOrderAnalytics) {
      fetchAnalytics();
    } else {
      setAnalytics(null);
    }
  }, [canAccessOrders, canAccessOrderAnalytics, pagination.page, search, statusFilter, dateRange, highlightSaleIds]);

  useEffect(() => {
    const handleOfflineSyncComplete = () => {
      if (!canAccessOrders) return;
      fetchSales();
      if (canAccessOrderAnalytics) {
        fetchAnalytics();
      }
    };
    window.addEventListener('stockly:offline-sync-complete', handleOfflineSyncComplete);
    return () => {
      window.removeEventListener('stockly:offline-sync-complete', handleOfflineSyncComplete);
    };
  }, [canAccessOrders, canAccessOrderAnalytics, pagination.page, search, statusFilter, dateRange, highlightSaleIds]);

  useEffect(() => {
    void fetchShippingProviders();
  }, [canDispatchOrdersToShipping]);

  useEffect(() => {
    if (!canManageSalesAccess) {
      setSavedClients([]);
      return;
    }
    void loadSavedClients();
  }, [canManageSalesAccess, loadSavedClients]);

  useEffect(() => {
    setSelectedSaleIds([]);
  }, [pagination.page, search, statusFilter, dateRange]);

  useEffect(() => {
    if (!canAccessOrders) return;
    const multiIdsParam = searchParams.get('highlightSaleIds');
    const singleIdParam = searchParams.get('highlightSaleId');
    const legacySaleParam = searchParams.get('sale');
    const highlightPriorityParam = searchParams.get('highlightPriority');

    const parsedIds = multiIdsParam
      ? multiIdsParam.split(',').map((id) => id.trim())
      : singleIdParam
        ? [singleIdParam.trim()]
        : legacySaleParam
          ? [legacySaleParam.trim()]
          : [];

    const uniqueIds = Array.from(new Set(parsedIds.filter(Boolean)));
    setHighlightSaleIds(uniqueIds);
    setDidAutoScrollToHighlight(false);
    setHighlightPriority(
      highlightPriorityParam === 'high' || highlightPriorityParam === 'low'
        ? highlightPriorityParam
        : 'medium'
    );
  }, [canAccessOrders, searchParams]);

  useEffect(() => {
    setQuickSellOrderType(isEcommerceBusiness ? 'shipped' : 'walk_in');
  }, [isEcommerceBusiness, isSupermarketBusiness]);

  const quickSellSearchQuery = quickSellProductSearch.trim();
  const shouldLoadQuickSellProducts =
    isQuickSellModalOpen || (isOrdersQuickViewMode && quickSellSearchQuery.length > 0);

  useEffect(() => {
    if (!shouldLoadQuickSellProducts) {
      setQuickSellProductResults([]);
      setQuickSellProductSearchError('');
      setIsQuickSellProductSearchLoading(false);
      return;
    }

    const query = quickSellSearchQuery;
    let cancelled = false;
    setIsQuickSellProductSearchLoading(true);
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await productsAPI.getProducts({
          page: 1,
          limit: 8,
          ...(query ? { search: query } : {}),
        });
        if (cancelled) return;
        setQuickSellProductResults(response.data.products || []);
        setQuickSellProductSearchError('');
      } catch {
        if (cancelled) return;
        setQuickSellProductResults([]);
        setQuickSellProductSearchError(
          t('ecommerce.searchProductFailed', 'Failed to search products.')
        );
      } finally {
        if (!cancelled) {
          setIsQuickSellProductSearchLoading(false);
        }
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [shouldLoadQuickSellProducts, quickSellSearchQuery, t]);

  const { connection: hardwareScannerConnection } = useKeyboardBarcodeScanner({
    enabled: canManageSales() && !isScannerOpen,
    captureInEditableTargets: true,
    requireScannerLikeTiming: true,
    onScan: async (rawBarcode) => {
      const barcode = rawBarcode.trim();
      if (!barcode) return;

      try {
        const response = await productsAPI.getProductByBarcode(barcode);
        const product = response.data?.product as Product | undefined;

        if (!product) {
          setScanNotFoundBarcode(barcode);
          setIsScanNotFoundDialogOpen(true);
          return;
        }

        await addProductToQuickSellCart(product);
        if (!isOrdersQuickViewMode) {
          setIsQuickSellModalOpen(true);
        }
        setQuickSellError('');
      } catch {
        setScanNotFoundBarcode(barcode);
        setIsScanNotFoundDialogOpen(true);
      }
    },
    onInvalidScan: () => {
      if (!isOrdersQuickViewMode) {
        setIsQuickSellModalOpen(true);
      }
      setQuickSellError(
        t('scanner.invalidBarcode', 'Invalid barcode scanned. Please rescan.')
      );
    },
    minLength: 6,
  });

  const getDateRange = (range: typeof dateRange) => {
    if (range === 'all') return null;
    const endDate = new Date();
    const startDate = new Date(endDate);
    if (range === 'day') startDate.setHours(0, 0, 0, 0);
    if (range === '3days') startDate.setDate(endDate.getDate() - 2);
    if (range === 'week') startDate.setDate(endDate.getDate() - 6);
    if (range === 'month') startDate.setDate(endDate.getDate() - 29);
    if (range === 'year') startDate.setFullYear(endDate.getFullYear() - 1);
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  };

  const buildSalesFilters = (pageValue = pagination.page, limitValue = pagination.limit) => {
    const filters: Record<string, string | number> = {
      page: pageValue,
      limit: limitValue,
    };
    if (search) filters.search = search;
    if (statusFilter !== 'all') filters.status = statusFilter;
    const range = getDateRange(dateRange);
    if (range) {
      filters.startDate = range.startDate;
      filters.endDate = range.endDate;
    }
    return filters;
  };

  const fetchSales = async () => {
    try {
      setLoading(true);
      const filters = buildSalesFilters();

      const response = await salesAPI.getSales(filters);
      let normalizedSales = (response.data.sales || []).map((sale: Sale) => normalizeSaleForUi(sale));

      if (highlightSaleIds.length > 0) {
        const visibleIds = new Set(normalizedSales.map((sale) => String(sale._id)));
        const missingHighlightIds = highlightSaleIds.filter((id) => !visibleIds.has(id));

        if (missingHighlightIds.length > 0) {
          const missingSales = (
            await Promise.all(
              missingHighlightIds.map(async (id) => {
                try {
                  const saleResponse = await salesAPI.getSale(id);
                  return normalizeSaleForUi(saleResponse.data.sale);
                } catch {
                  return null;
                }
              })
            )
          ).filter(Boolean) as Sale[];

          if (missingSales.length > 0) {
            const seen = new Set<string>();
            normalizedSales = [...missingSales, ...normalizedSales].filter((sale) => {
              const id = String(sale._id);
              if (seen.has(id)) return false;
              seen.add(id);
              return true;
            });
          }
        }
      }

      setSales(normalizedSales);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!highlightSaleIds.length || loading || didAutoScrollToHighlight) return;
    const firstVisibleHighlightedId = highlightSaleIds.find((id) =>
      Boolean(document.getElementById(`sale-row-${id}`))
    );
    if (!firstVisibleHighlightedId) return;

    const row = document.getElementById(`sale-row-${firstVisibleHighlightedId}`);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setDidAutoScrollToHighlight(true);
    }
  }, [sales, loading, highlightSaleIds, didAutoScrollToHighlight]);

  const fetchAnalytics = async () => {
    try {
      const response = await salesAPI.getAnalytics();
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const fetchShippingProviders = async () => {
    if (!canDispatchOrdersToShipping) {
      setShippingProviders([]);
      return;
    }

    try {
      setIsShippingProvidersLoading(true);
      const response = await integrationsAPI.getShippingProviders();
      setShippingProviders(response.data.providers || []);
    } catch (error) {
      console.error('Error fetching shipping providers:', error);
    } finally {
      setIsShippingProvidersLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(DATE_LOCALE_BY_LANGUAGE[language] || 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatPaymentMethod = (paymentMethod: string) => {
    const fallback = paymentMethod.replace('_', ' ');
    return t(`ecommerce.paymentMethods.${paymentMethod}`, fallback);
  };

  const formatCustomerName = (saleLike: { customer?: { name?: string | null }; orderType?: string | null }) => {
    const rawCustomerName = String(saleLike.customer?.name || '').trim();
    const normalizedCustomerName = rawCustomerName.toLowerCase();
    const isWalkInOrder = String(saleLike.orderType || '')
      .trim()
      .toLowerCase() === 'walk_in';

    if (WALK_IN_CUSTOMER_ALIASES.has(normalizedCustomerName) || (!rawCustomerName && isWalkInOrder)) {
      return t('ecommerce.walkInCustomer', 'Walk-in Customer');
    }

    return rawCustomerName || t('ecommerce.customer', 'Customer');
  };

  const openSaleDetail = (sale: Sale) => {
    setSelectedSale(normalizeSaleForUi(sale));
    setIsDetailModalOpen(true);
  };

  const resetQuickSell = () => {
    setQuickSellCart([]);
    setQuickSellBuyerName('');
    setSelectedQuickSellClientKey(MANUAL_CLIENT_SELECT_VALUE);
    setQuickSellError('');
    setQuickSellOrderType(isEcommerceBusiness ? 'shipped' : 'walk_in');
    setQuickSellShipping(createInitialShippingForm());
    setQuickSellProductSearch('');
    setQuickSellProductResults([]);
    setQuickSellProductSearchError('');
    setIsQuickSellProductSearchLoading(false);
    setQuickViewAmountReceivedInput('0');
  };

  const loadVariantsForProduct = async (productId: string): Promise<ClothingVariant[]> => {
    if (!supportsVariantProducts) return [];
    try {
      const response = await businessAPI.getClothingVariants(productId);
      return (response.data.variants || []).filter(
        (variant) => getVariantProductId(variant) === productId
      );
    } catch (error) {
      console.error('Error loading product variants:', error);
      return [];
    }
  };

  const addProductToQuickSellCart = async (product: Product) => {
    const productId = String(product._id);
    if (quickSellAddInFlightRef.current.has(productId)) return;
    quickSellAddInFlightRef.current.add(productId);
    setQuickSellAddingProductIds((prev) => {
      if (prev.has(productId)) return prev;
      const next = new Set(prev);
      next.add(productId);
      return next;
    });

    try {
      const measurementType = getResolvedMeasurementType(product.measurementType);
      const measurementOption = getMeasurementOption(measurementType);
      const minimumUnitPrice = getProductMinimumSalePrice(product);
      const existingItem = quickSellCart.find((item) => item.productId === productId);
      const variants = await loadVariantsForProduct(productId);

      const defaultVariant = variants.find((variant) => Number(variant.quantity) > 0) || variants[0];
      const existingSelectedVariant = existingItem
        ? variants.find((variant) => String(variant._id) === existingItem.variantId)
        : undefined;
      const selectedVariant = existingSelectedVariant || defaultVariant;
      const maxAvailableByVariant = selectedVariant
        ? Math.min(product.quantity, Number(selectedVariant.quantity) || 0)
        : product.quantity;

      if (maxAvailableByVariant <= 0) {
        setQuickSellError(
          t('ecommerce.outOfStockScan', '{{name}} is out of stock', { name: product.name })
        );
        if (!isOrdersQuickViewMode) {
          setIsQuickSellModalOpen(true);
        }
        return;
      }

      const reachedStockLimit = Boolean(existingItem && existingItem.quantity >= maxAvailableByVariant);
      setQuickSellError(
        reachedStockLimit
          ? t('ecommerce.maxStockReached', 'Maximum available stock reached for {{name}}', {
              name: product.name,
            })
          : ''
      );

      setQuickSellCart((prev) => {
        const existing = prev.find((item) => item.productId === productId);

        if (!existing) {
          const initialQuantity = Math.max(
            isCountMeasurementType(measurementType) ? 1 : 0.000001,
            Math.min(maxAvailableByVariant, measurementOption.minPositive)
          );
          return [
            ...prev,
            {
              productId,
              name: product.name,
              sku: product.sku || '-',
              measurementType,
              price: Number(product.price) || 0,
              prices: product.prices,
              soldDiscountPercent: product.soldDiscountPercent,
              secondPrice: product.secondPrice,
              variants,
              variantId: selectedVariant ? String(selectedVariant._id) : undefined,
              quantity: initialQuantity,
              availableQuantity: product.quantity,
              unitPrice: getDiscountedUnitPrice(product, selectedQuickSellPricingTier),
              minimumUnitPrice,
            },
          ];
        }

        if (existing.quantity >= maxAvailableByVariant) {
          return prev.map((item) =>
            item.productId === productId
              ? {
                  ...item,
                  variants,
                  variantId: selectedVariant ? String(selectedVariant._id) : item.variantId,
                  availableQuantity: product.quantity,
                  unitPrice: Math.max(item.unitPrice, minimumUnitPrice ?? 0),
                  minimumUnitPrice,
                }
              : item
          );
        }

        return prev.map((item) =>
          item.productId === productId
            ? {
                ...item,
                variants,
                variantId: selectedVariant ? String(selectedVariant._id) : item.variantId,
                quantity: Math.min(
                  maxAvailableByVariant,
                  item.quantity + measurementOption.minPositive
                ),
                availableQuantity: product.quantity,
                unitPrice: Math.max(item.unitPrice, minimumUnitPrice ?? 0),
                minimumUnitPrice,
              }
            : item
        );
      });
      if (isOrdersQuickViewMode) {
        setIsQuickViewCurrentSaleFocused(true);
      }
      if (!isOrdersQuickViewMode) {
        setIsQuickSellModalOpen(true);
      }
    } finally {
      quickSellAddInFlightRef.current.delete(productId);
      setQuickSellAddingProductIds((prev) => {
        if (!prev.has(productId)) return prev;
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }
  };

  const updateQuickSellCartQuantity = (productId: string, value: number) => {
    setQuickSellError('');
    setQuickSellCart((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const measurementOption = getMeasurementOption(item.measurementType);
        const safeQuantity = Number.isFinite(value) ? value : measurementOption.minPositive;
        const normalizedQuantity = isCountMeasurementType(item.measurementType)
          ? Math.round(safeQuantity)
          : safeQuantity;
        const selectedVariant = item.variants.find(
          (variant) => String(variant._id) === item.variantId
        );
        const maxAllowed = Math.min(
          item.availableQuantity,
          selectedVariant ? Number(selectedVariant.quantity) || 0 : item.availableQuantity
        );
        const minimumAllowed = Math.min(maxAllowed, measurementOption.minPositive);
        return {
          ...item,
          quantity: Math.max(
            minimumAllowed,
            Math.min(maxAllowed, normalizedQuantity)
          ),
        };
      })
    );
  };

  const updateQuickSellCartVariant = (productId: string, variantId: string) => {
    setQuickSellError('');
    setQuickSellCart((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const selectedVariant = item.variants.find(
          (variant) => String(variant._id) === variantId
        );
        const maxAllowed = Math.min(
          item.availableQuantity,
          selectedVariant ? Number(selectedVariant.quantity) || 0 : item.availableQuantity
        );
        const measurementOption = getMeasurementOption(item.measurementType);
        const minimumAllowed = Math.min(maxAllowed, measurementOption.minPositive);
        return {
          ...item,
          variantId,
          quantity: Math.max(minimumAllowed, Math.min(maxAllowed, item.quantity))
        };
      })
    );
  };

  const updateQuickSellCartPrice = (productId: string, value: number) => {
    setQuickSellError('');
    setQuickSellCart((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const minimumAllowedPrice = item.minimumUnitPrice ?? 0;
        const safePrice = Number.isFinite(value) ? value : minimumAllowedPrice;
        return {
          ...item,
          unitPrice: Math.max(minimumAllowedPrice, safePrice),
        };
      })
    );
  };

  const removeQuickSellCartItem = (productId: string) => {
    setQuickSellError('');
    setQuickSellCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const quickSellTotal = quickSellCart.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  const effectiveQuickSellOrderType: OrderType = isEcommerceBusiness
    ? 'shipped'
    : (isSupermarketBusiness ? 'walk_in' : quickSellOrderType);
  const quickSellGrandTotal =
    quickSellTotal +
    (effectiveQuickSellOrderType === 'shipped' ? Number(quickSellShipping.shippingCost) || 0 : 0);
  const quickViewMinorFactor = isDzdCurrency ? 1 : 100;
  const toQuickViewMinor = (value: number) =>
    Math.round(Math.max(0, Number.isFinite(value) ? value : 0) * quickViewMinorFactor);
  const fromQuickViewMinor = (value: number) => Math.max(0, value) / quickViewMinorFactor;
  const formatQuickViewInputAmount = (value: number) => {
    const safe = Math.max(0, Number.isFinite(value) ? value : 0);
    if (isDzdCurrency) return String(Math.round(safe));
    return safe.toFixed(2).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
  };
  const parseQuickViewAmountInput = (rawValue: string): number | null => {
    const normalized = String(rawValue || '')
      .trim()
      .replace(/\s+/g, '')
      .replace(',', '.')
      .replace(/[^0-9.]/g, '');
    if (!normalized) return 0;
    return parseCurrencyInput(normalized);
  };
  const quickViewReceivedAmountParsed = parseQuickViewAmountInput(quickViewAmountReceivedInput);
  const quickViewReceivedAmount = quickViewReceivedAmountParsed === null ? 0 : quickViewReceivedAmountParsed;
  const quickViewTotalMinor = toQuickViewMinor(quickSellGrandTotal);
  const quickViewReceivedMinor = toQuickViewMinor(quickViewReceivedAmount);
  const quickViewChangeMinor = Math.max(0, quickViewReceivedMinor - quickViewTotalMinor);
  const quickViewChangeAmount = fromQuickViewMinor(quickViewChangeMinor);
  const quickViewPaymentFeedback =
    quickViewReceivedMinor < quickViewTotalMinor
      ? {
          tone: 'text-red-600',
          message: t('ecommerce.insufficientPayment', 'Insufficient payment'),
        }
      : quickViewReceivedMinor === quickViewTotalMinor
        ? {
            tone: 'text-emerald-600',
            message: t('ecommerce.exactPayment', 'Exact payment'),
          }
        : {
            tone: 'text-emerald-600',
            message: `${t('ecommerce.changeToReturn', 'Change to return')}: ${formatCurrency(
              quickViewChangeAmount
            )}`,
          };
  const addQuickViewReceivedAmount = (amount: number) => {
    const incrementMinor = toQuickViewMinor(amount);
    const nextMinor = Math.max(0, quickViewReceivedMinor + incrementMinor);
    setQuickViewAmountReceivedInput(formatQuickViewInputAmount(fromQuickViewMinor(nextMinor)));
  };
  const setQuickViewExactAmount = () => {
    setQuickViewAmountReceivedInput(formatQuickViewInputAmount(quickSellGrandTotal));
  };
  const selectedSaleStatus: Sale['status'] = selectedSale
    ? normalizeSaleStatusForUi(selectedSale.status)
    : 'confirmed';
  const activeSale = useMemo(() => {
    const resolvedActiveSale = resolveRealActiveSale(sales);
    if (resolvedActiveSale) return normalizeSaleForUi(resolvedActiveSale);

    return null;
  }, [sales]);
  const activeSaleId = activeSale ? String(activeSale._id) : null;
  const ongoingQuickViewOrder = useMemo<Sale>(() => {
    const nowIso = new Date().toISOString();
    const customerName =
      quickSellBuyerName.trim() || t('ecommerce.walkInCustomer', 'Walk-in Customer');
    const shippingFee =
      effectiveQuickSellOrderType === 'shipped'
        ? Math.max(0, Number(quickSellShipping.shippingCost) || 0)
        : 0;
    const ongoingTotal = quickSellTotal + shippingFee;

    return {
      _id: 'ongoing-quick-view-order',
      user: user?.id || 'ongoing-quick-view-user',
      orderNumber: t('ecommerce.ongoingOrderNumber', 'ONGOING ORDER'),
      items: quickSellCart.map((item) => {
        const selectedVariant = item.variants.find(
          (variant) => String(variant._id) === item.variantId
        );
        return {
          product: item.productId,
          name: item.name,
          sku: item.sku || '-',
          ...(item.variantId ? { variantId: item.variantId } : {}),
          ...(selectedVariant?.variantSku ? { variantSku: selectedVariant.variantSku } : {}),
          ...(selectedVariant?.size ? { variantSize: selectedVariant.size } : {}),
          ...(selectedVariant?.color ? { variantColor: selectedVariant.color } : {}),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.quantity * item.unitPrice,
        };
      }),
      customer: {
        name: customerName,
        ...(selectedQuickSellClient?.clientKey ? { clientKey: selectedQuickSellClient.clientKey } : {}),
        ...(selectedQuickSellClient?.pricingTier ? { pricingTier: selectedQuickSellClient.pricingTier } : {}),
        ...(quickSellShipping.phone.trim()
          ? { phone: quickSellShipping.phone.trim() }
          : {}),
        ...(effectiveQuickSellOrderType === 'shipped'
          ? {
              address: {
                ...(quickSellShipping.street.trim()
                  ? { street: quickSellShipping.street.trim() }
                  : {}),
                city: buildShippingCity(quickSellShipping),
              },
            }
          : {}),
      },
      shipping:
        effectiveQuickSellOrderType === 'shipped'
          ? {
              mode: quickSellShipping.mode,
              carrier: quickSellShipping.carrier || 'other',
              ...(quickSellShipping.trackingNumber.trim()
                ? { trackingNumber: quickSellShipping.trackingNumber.trim() }
                : {}),
              ...(quickSellShipping.notes.trim()
                ? { notes: quickSellShipping.notes.trim() }
                : {}),
            }
          : {},
      orderType: effectiveQuickSellOrderType,
      status: 'confirmed',
      paymentStatus: 'pending',
      paymentMethod: 'cash',
      subtotal: quickSellTotal,
      tax: 0,
      discount: 0,
      shippingCost: shippingFee,
      total: ongoingTotal,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }, [
    quickSellBuyerName,
    selectedQuickSellClient,
    quickSellCart,
    quickSellShipping,
    quickSellTotal,
    effectiveQuickSellOrderType,
    t,
    user?.id,
  ]);
  const selectedQuickViewSale = useMemo(() => {
    if (!selectedSale) return null;
    const selectedId = String(selectedSale._id);
    const matched = sales.find((sale) => String(sale._id) === selectedId);
    return matched ? normalizeSaleForUi(matched) : null;
  }, [sales, selectedSale]);
  const quickViewActiveOrderCard = isQuickViewCurrentSaleFocused
    ? ongoingQuickViewOrder
    : (selectedQuickViewSale || activeSale || ongoingQuickViewOrder);
  const quickViewActiveOrderIsOngoing =
    String(quickViewActiveOrderCard._id) === 'ongoing-quick-view-order';
  const quickViewSelectedSaleId = selectedQuickViewSale
    ? String(selectedQuickViewSale._id)
    : null;
  const quickViewHighlightedSaleId = isQuickViewCurrentSaleFocused
    ? null
    : (quickViewSelectedSaleId || activeSaleId);
  const shouldShowQuickViewSearchResults =
    isOrdersQuickViewMode && canManageSales() && quickSellSearchQuery.length > 0;

  const handleScan = async (barcode: string, product?: Product | null) => {
    setIsScannerOpen(false);
    if (!product) {
      setScanNotFoundBarcode(barcode);
      setIsScanNotFoundDialogOpen(true);
      return;
    }

    await addProductToQuickSellCart(product);
  };

  const openNewSalePanel = () => {
    void loadSavedClients();
    resetQuickSell();
    setIsQuickSellModalOpen(true);
  };

  const startNewSaleInQuickView = () => {
    void loadSavedClients();
    resetQuickSell();
    setIsQuickSellModalOpen(false);
    setIsQuickViewCurrentSaleFocused(true);
    setSelectedSale(null);
    setQuickSellProductSearch('');
    setQuickSellProductResults([]);
    setQuickSellProductSearchError('');
    setIsQuickSellProductSearchLoading(false);
    setQuickViewAmountReceivedInput('0');
  };

  const handleToggleOrdersQuickViewMode = () => {
    if (!isSupermarketBusiness) return;
    setIsOrdersQuickViewMode((prev) => {
      const next = !prev;
      if (next) {
        setIsQuickViewCurrentSaleFocused(false);
        setQuickViewAmountReceivedInput(formatQuickViewInputAmount(quickSellGrandTotal));
        const resolvedActiveSale = resolveRealActiveSale(sales);
        setSelectedSale(resolvedActiveSale ? normalizeSaleForUi(resolvedActiveSale) : null);
      }
      if (!next) {
        setIsQuickViewCurrentSaleFocused(false);
        setQuickSellProductSearch('');
        setQuickSellProductResults([]);
        setQuickSellProductSearchError('');
        setIsQuickSellProductSearchLoading(false);
        setQuickViewAmountReceivedInput('');
      }
      return next;
    });
  };

  useEffect(() => {
    if (!isSupermarketBusiness && isOrdersQuickViewMode) {
      setIsOrdersQuickViewMode(false);
      setIsQuickViewCurrentSaleFocused(false);
    }
  }, [isSupermarketBusiness, isOrdersQuickViewMode]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('stockly:orders-quick-view-mode', {
        detail: { enabled: isSupermarketBusiness && isOrdersQuickViewMode },
      })
    );
  }, [isSupermarketBusiness, isOrdersQuickViewMode]);

  useEffect(() => {
    return () => {
      window.dispatchEvent(
        new CustomEvent('stockly:orders-quick-view-mode', {
          detail: { enabled: false },
        })
      );
    };
  }, []);

  const handleQuickSellModalChange = (open: boolean) => {
    setIsQuickSellModalOpen(open);
    if (!open) {
      setQuickSellProductResults([]);
      setQuickSellProductSearchError('');
      setIsQuickSellProductSearchLoading(false);
    }
  };

  const handleQuickSellProductPick = async (product: Product) => {
    try {
      await addProductToQuickSellCart(product);
      setQuickSellProductSearch('');
      setQuickSellProductResults([]);
      setQuickSellProductSearchError('');
    } catch (error) {
      console.error('Error adding searched product to cart:', error);
      setQuickSellProductSearchError(
        t('ecommerce.addProductFailed', 'Failed to add this product.')
      );
    }
  };

  const handleRescanAfterNotFound = () => {
    setIsScanNotFoundDialogOpen(false);
    setIsScannerOpen(true);
  };

  const handleCreateItemAfterNotFound = () => {
    if (!scanNotFoundBarcode) return;
    setIsScanNotFoundDialogOpen(false);
    navigate(`/dashboard/inventory?action=add&barcode=${encodeURIComponent(scanNotFoundBarcode)}`);
  };

  const handleQuickSell = async () => {
    if (isCreatingQuickSellOrder) return;
    if (quickSellCart.length === 0) return;
    const trimmedBuyerName = quickSellBuyerName.trim();
    const selectedQuickSellClient =
      selectedQuickSellClientKey === MANUAL_CLIENT_SELECT_VALUE
        ? null
        : selectableClients.find((client) => client.clientKey === selectedQuickSellClientKey) || null;
    const resolvedQuickSellCustomerName = isEcommerceBusiness
      ? trimmedBuyerName
      : (trimmedBuyerName || t('ecommerce.walkInCustomer', 'Walk-in Customer'));
    const resolvedQuickSellPhone =
      quickSellShipping.phone.trim() || String(selectedQuickSellClient?.phone || '').trim();
    const resolvedQuickSellEmail = String(selectedQuickSellClient?.email || '').trim();
    if (isEcommerceBusiness && !trimmedBuyerName) {
      setQuickSellError(
        t('ecommerce.customerNameRequired', 'Customer name is required for e-commerce orders.')
      );
      return;
    }
    const requiresQuickSellStreetAddress = quickSellShipping.mode !== 'stopdesk';
    if (
      effectiveQuickSellOrderType === 'shipped' &&
      !quickSellShipping.wilaya.trim()
    ) {
      setQuickSellError(
        t(
          'ecommerce.shippingDestinationRequired',
          'For shipped orders, wilaya is required.'
        )
      );
      return;
    }
    if (
      effectiveQuickSellOrderType === 'shipped' &&
      requiresQuickSellStreetAddress &&
      !quickSellShipping.street.trim()
    ) {
      setQuickSellError(
        t(
          'ecommerce.domesticAddressRequired',
          'For domestic shipped orders, street address is required.'
        )
      );
      return;
    }
    const parsedShippingFee = Number(quickSellShipping.shippingCost);
    if (
      effectiveQuickSellOrderType === 'shipped' &&
      (
        !quickSellShipping.shippingCost.trim() ||
        !Number.isFinite(parsedShippingFee) ||
        parsedShippingFee < 0
      )
    ) {
      setQuickSellError(
        t(
          'ecommerce.shippingFeeRequired',
          'Please enter a valid shipping fee.'
        )
      );
      return;
    }

    const hasInvalidCartQuantity = quickSellCart.some((item) => {
      if (item.quantity <= 0) return true;
      if (isCountMeasurementType(item.measurementType) && !Number.isInteger(item.quantity)) {
        return true;
      }
      const selectedVariant = item.variants.find(
        (variant) => String(variant._id) === item.variantId
      );
      if (selectedVariant) {
        const maxAllowed = Math.min(
          item.availableQuantity,
          Number(selectedVariant.quantity) || 0
        );
        if (item.quantity > maxAllowed) return true;
      }
      return false;
    });

    if (hasInvalidCartQuantity) {
      setQuickSellError('One or more cart items have invalid quantities for their product type.');
      return;
    }

    const hasInvalidCartPrice = quickSellCart.some((item) => {
      if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) return true;
      const minimumAllowedPrice = item.minimumUnitPrice ?? 0;
      return item.unitPrice < minimumAllowedPrice;
    });

    if (hasInvalidCartPrice) {
      setQuickSellError(
        t(
          'ecommerce.minimumPriceError',
          'One or more cart items have a price below the minimum allowed.'
        )
      );
      return;
    }

    const missingRequiredVariant = supportsVariantProducts && quickSellCart.some((item) => {
      if (item.variants.length === 0) return false;
      return !item.variantId;
    });

    if (missingRequiredVariant) {
      setQuickSellError('Select a variant for each item with variants before confirming the sale.');
      return;
    }
    const quickSellStreetForPayload =
      quickSellShipping.mode === 'stopdesk'
        ? (quickSellShipping.street.trim() || 'Stop Desk')
        : quickSellShipping.street.trim();

    try {
      setIsCreatingQuickSellOrder(true);
      const createSaleResponse = await salesAPI.createSale({
        items: quickSellCart.map((item) => ({
          productId: item.productId,
          ...(item.variantId ? { variantId: item.variantId } : {}),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        customer: {
          name: resolvedQuickSellCustomerName,
          ...(selectedQuickSellClient?.clientKey ? { clientKey: selectedQuickSellClient.clientKey } : {}),
          ...(selectedQuickSellClient?.pricingTier ? { pricingTier: selectedQuickSellClient.pricingTier } : {}),
          ...(resolvedQuickSellEmail ? { email: resolvedQuickSellEmail } : {}),
          ...(resolvedQuickSellPhone ? { phone: resolvedQuickSellPhone } : {}),
          ...(effectiveQuickSellOrderType === 'shipped'
            ? {
                address: {
                  ...(quickSellStreetForPayload ? { street: quickSellStreetForPayload } : {}),
                  city: buildShippingCity(quickSellShipping),
                },
              }
            : {}),
        },
        orderType: effectiveQuickSellOrderType,
        ...(effectiveQuickSellOrderType === 'shipped'
          ? {
            shipping: {
                mode: quickSellShipping.mode,
                carrier: quickSellShipping.carrier || 'other',
                status: 'processing',
                ...(quickSellShipping.trackingNumber.trim()
                  ? { trackingNumber: quickSellShipping.trackingNumber.trim() }
                  : {}),
                ...(quickSellShipping.notes.trim()
                  ? { notes: quickSellShipping.notes.trim() }
                  : {}),
              },
              shippingCost: Math.max(0, parsedShippingFee),
            }
          : {}),
        paymentMethod: 'cash',
      });
      const createdSale = createSaleResponse.data?.sale
        ? normalizeSaleForUi(createSaleResponse.data.sale)
        : null;
      await updateOnboarding({ recordedFirstSale: true });
      setIsQuickSellModalOpen(false);
      resetQuickSell();
      if (isOrdersQuickViewMode) {
        setIsQuickViewCurrentSaleFocused(false);
        setSelectedSale(createdSale);
      }
      fetchSales();
      fetchAnalytics();
      notifyAnalyticsRefresh();
    } catch (error) {
      console.error('Error recording quick sale:', error);
    } finally {
      setIsCreatingQuickSellOrder(false);
    }
  };

  const openEditModal = (sale: Sale) => {
    const normalizedSale = normalizeSaleForUi(sale);
    setSelectedSale(normalizedSale);
    setEditStatus(normalizedSale.status);
    setEditPaymentStatus(sale.paymentStatus);
    setIsEditModalOpen(true);
  };

  const handleUpdateSale = async () => {
    if (!selectedSale) return;
    try {
      await salesAPI.updateSaleStatus(selectedSale._id, {
        status: editStatus,
        paymentStatus: editPaymentStatus,
      });
      setIsEditModalOpen(false);
      fetchSales();
      fetchAnalytics();
      notifyAnalyticsRefresh();
    } catch (error) {
      console.error('Error updating sale:', error);
    }
  };

  const handleInlineSaleUpdate = async (
    sale: Sale,
    data: { status?: Sale['status']; paymentStatus?: Sale['paymentStatus'] }
  ) => {
    const isStatusUpdate = typeof data.status !== 'undefined';
    const currentStatus = normalizeSaleStatusForUi(sale.status);
    const nextStatus = data.status ? normalizeSaleStatusForUi(data.status) : undefined;
    const nextPaymentStatus = data.paymentStatus;

    if (isStatusUpdate && nextStatus === currentStatus) return;
    if (!isStatusUpdate && nextPaymentStatus === sale.paymentStatus) return;

    const fieldKey = `${sale._id}:${isStatusUpdate ? 'status' : 'paymentStatus'}`;
    try {
      setUpdatingSaleField(fieldKey);
      await salesAPI.updateSaleStatus(sale._id, data);
      await fetchSales();
      await fetchAnalytics();
      notifyAnalyticsRefresh();
    } catch (error) {
      console.error('Error updating sale inline:', error);
    } finally {
      setUpdatingSaleField(null);
    }
  };

  const handleSaleRowClick = (event: React.MouseEvent<HTMLTableRowElement>, sale: Sale) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-row-interactive="true"]')) return;
    if (isOrdersQuickViewMode) {
      setSelectedSale(normalizeSaleForUi(sale));
      return;
    }
    openSaleDetail(sale);
  };

  const openDeleteDialog = (sale: Sale) => {
    setSelectedSale(normalizeSaleForUi(sale));
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteSale = async () => {
    if (!selectedSale) return;
    try {
      await salesAPI.deleteSale(selectedSale._id);
      setIsDeleteDialogOpen(false);
      fetchSales();
      fetchAnalytics();
      notifyAnalyticsRefresh();
      notifyActivity({
        id: `sale-delete-${selectedSale._id}`,
        title: selectedSale.orderNumber,
        description: t('analytics.activityOrderDeleted', 'Order deleted'),
        badge: 'sale',
        amount: selectedSale.total,
      });
    } catch (error) {
      console.error('Error deleting sale:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedSaleIds.length === 0) return;
    try {
      const deletedSales = sales.filter((sale) => selectedSaleIds.includes(String(sale._id)));
      await Promise.all(selectedSaleIds.map((id) => salesAPI.deleteSale(id)));
      setSelectedSaleIds([]);
      setIsBulkDeleteOpen(false);
      fetchSales();
      fetchAnalytics();
      notifyAnalyticsRefresh();
      deletedSales.forEach((sale) => {
        notifyActivity({
          id: `sale-delete-${sale._id}`,
          title: sale.orderNumber,
          description: t('analytics.activityOrderDeleted', 'Order deleted'),
          badge: 'sale',
          amount: sale.total,
        });
      });
    } catch (error) {
      console.error('Error bulk deleting sales:', error);
    }
  };

  const closeShippingDispatchDialog = () => {
    setIsShippingDispatchDialogOpen(false);
    setShippingDispatchSaleIds([]);
    setShippingDispatchProvider('');
  };

  const openShippingDispatchDialog = (saleIds: string[]) => {
    if (!canDispatchOrdersToShipping || saleIds.length === 0) return;

    if (connectedShippingProviders.length === 0) {
      toast.error(
        t(
          'ecommerce.shippingProviderRequired',
          'Connect a shipping provider in Settings before sending orders.'
        )
      );
      navigate('/settings');
      return;
    }

    const selectedSales = sales.filter((sale) => saleIds.includes(String(sale._id)));
    const preferredCarrier =
      selectedSales.length === 1
        ? normalizeCarrierToken(selectedSales[0]?.shipping?.carrier)
        : '';
    const preferredProvider =
      connectedShippingProviders.find((provider) => provider.provider === preferredCarrier)?.provider ||
      connectedShippingProviders[0]?.provider ||
      '';

    setShippingDispatchSaleIds(saleIds);
    setShippingDispatchProvider(preferredProvider);
    setIsShippingDispatchDialogOpen(true);
  };

  const handleShippingDispatch = async () => {
    if (!shippingDispatchProvider || shippingDispatchSaleIds.length === 0) return;

    try {
      setIsShippingDispatching(true);
      const response = await integrationsAPI.dispatchOrdersToShippingProvider(
        shippingDispatchProvider,
        { saleIds: shippingDispatchSaleIds }
      );

      const successfulResults = response.data.results.filter((result) => result.success);
      const failedResults = response.data.results.filter((result) => !result.success);
      const successfulIds = successfulResults.map((result) => result.saleId);

      if (successfulResults.length > 0) {
        toast.success(
          t(
            'ecommerce.shippingDispatchSuccess',
            '{{count}} order(s) sent to {{provider}}.',
            {
              count: successfulResults.length,
              provider: getShippingProviderLabel(response.data.provider.provider)
            }
          )
        );
      }

      if (failedResults.length > 0) {
        toast.error(
          t(
            'ecommerce.shippingDispatchPartialFailure',
            '{{count}} order(s) could not be sent. {{message}}',
            {
              count: failedResults.length,
              message: failedResults[0]?.message || ''
            }
          )
        );
      }

      if (successfulIds.length > 0) {
        setHighlightSaleIds(successfulIds);
        setDidAutoScrollToHighlight(false);
      }

      setSelectedSaleIds((prev) =>
        prev.filter((saleId) => !successfulIds.includes(saleId))
      );
      closeShippingDispatchDialog();
      await fetchSales();
      if (canAccessOrderAnalytics) {
        await fetchAnalytics();
      }
      void fetchShippingProviders();
      notifyAnalyticsRefresh();
    } catch (error: unknown) {
      console.error('Error dispatching orders to shipping provider:', error);
      const apiError = error as { response?: { data?: { message?: string } } };
      toast.error(
        apiError?.response?.data?.message ||
          t(
            'ecommerce.shippingDispatchFailed',
            'Failed to send orders to the shipping provider.'
          )
      );
    } finally {
      setIsShippingDispatching(false);
    }
  };

  const openReceiptModal = (sale: Sale) => {
    setSelectedSale(normalizeSaleForUi(sale));
    setIsReceiptModalOpen(true);
  };

  const handlePrintReceipt = () => {
    const previousTitle = document.title;
    const restoreTitle = () => {
      document.title = previousTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };
    window.addEventListener('afterprint', restoreTitle);
    document.title = 'Receipt';
    window.print();
    window.setTimeout(restoreTitle, 1000);
  };

  const parseOrderImportRows = (rows: string[][]) => {
    const normalizedRows = rows
      .map((row) => row.map((value) => String(value ?? '')))
      .filter((row) => row.some((value) => value.trim() !== ''));

    if (normalizedRows.length === 0) {
      return { headers: [] as string[], dataRows: [] as string[][] };
    }

    const headers = normalizedRows[0].map((value) =>
      value.replace(/^\uFEFF/, '').trim().replace(/^"|"$/g, '')
    );
    const dataRows = normalizedRows.slice(1).map((row) =>
      Array.from({ length: headers.length }, (_, index) => String(row[index] ?? ''))
    );

    return { headers, dataRows };
  };

  const handleOrdersImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const parsed = await parseTabularImportFile(file);
      setOrdersImportRows(parsed.rows);
      setOrdersImportFileName(file.name);
      setOrdersImportResult(null);
    } catch (error) {
      const message = (error as Error).message || 'Failed to read orders import file.';
      setOrdersImportRows([]);
      setOrdersImportFileName(file.name);
      setOrdersImportResult({
        totalRows: 0,
        importedOrders: 0,
        importedItems: 0,
        skipped: [{ row: 1, reason: message }],
        unmappedHeaders: [],
        errors: [],
      });
    }
  };

  const buildProductLookupIndex = (products: Product[]): ProductLookupIndex => {
    const byId = new Map<string, Product>();
    const bySku = new Map<string, Product>();
    const byBarcode = new Map<string, Product>();
    const byName = new Map<string, Product[]>();

    products.forEach((product) => {
      const id = String(product._id || '').trim();
      if (id) byId.set(id, product);

      const skuToken = normalizeLookupToken(product.sku);
      if (skuToken && !bySku.has(skuToken)) bySku.set(skuToken, product);

      const barcodeToken = normalizeLookupToken(product.barcode);
      if (barcodeToken && !byBarcode.has(barcodeToken)) byBarcode.set(barcodeToken, product);

      const nameToken = normalizeLookupToken(product.name);
      if (nameToken) {
        const existing = byName.get(nameToken) || [];
        existing.push(product);
        byName.set(nameToken, existing);
      }
    });

    return { byId, bySku, byBarcode, byName };
  };

  const fetchAllProductsForLookup = async (): Promise<Product[]> => {
    const limit = 200;
    let page = 1;
    let pages = 1;
    const allProducts: Product[] = [];

    while (page <= pages) {
      const response = await productsAPI.getProducts({ page, limit });
      allProducts.push(...(response.data.products || []));
      pages = response.data.pagination?.pages || 1;
      page += 1;
    }

    return allProducts;
  };

  const resolveProductForImportRow = (
    row: NormalizedSaleImportRow,
    lookup: ProductLookupIndex
  ): { product?: Product; error?: string } => {
    if (row.productId) {
      const byId = lookup.byId.get(row.productId.trim());
      if (byId) return { product: byId };
    }

    if (row.productSku) {
      const bySku = lookup.bySku.get(normalizeLookupToken(row.productSku));
      if (bySku) return { product: bySku };
    }

    if (row.productBarcode) {
      const byBarcode = lookup.byBarcode.get(normalizeLookupToken(row.productBarcode));
      if (byBarcode) return { product: byBarcode };
    }

    if (row.productName) {
      const matches = lookup.byName.get(normalizeLookupToken(row.productName)) || [];
      if (matches.length === 1) {
        return { product: matches[0] };
      }
      if (matches.length > 1) {
        return {
          error: `Ambiguous product name "${row.productName}". Use SKU, barcode, or product id.`,
        };
      }
    }

    return {
      error:
        row.productName || row.productSku || row.productBarcode || row.productId
          ? `Product not found in inventory (${row.productName || row.productSku || row.productBarcode || row.productId}).`
          : 'Missing product identifier.',
    };
  };

  const resolveVariantIdForImport = async (
    product: Product,
    row: NormalizedSaleImportRow
  ): Promise<{ variantId?: string; error?: string }> => {
    if (!supportsVariantProducts) return {};

    const productId = String(product._id);
    let variants = variantCacheRef.current.get(productId);
    if (!variants) {
      try {
        const response = await businessAPI.getClothingVariants(productId);
        variants = (response.data.variants || []).filter(
          (variant) => getVariantProductId(variant) === productId
        );
        variantCacheRef.current.set(productId, variants);
      } catch {
        return { error: `Failed to load variants for ${product.name}.` };
      }
    }

    if (!variants || variants.length === 0) return {};

    const rowVariantId = String(row.variantId || '').trim();
    const rowVariantSku = normalizeLookupToken(row.variantSku);

    let selectedVariant: ClothingVariant | undefined;
    if (rowVariantId) {
      selectedVariant = variants.find((variant) => String(variant._id) === rowVariantId);
      if (!selectedVariant) {
        return {
          error: `Variant "${row.variantId}" not found for ${product.name}.`,
        };
      }
    } else if (rowVariantSku) {
      selectedVariant = variants.find(
        (variant) => normalizeLookupToken(variant.variantSku) === rowVariantSku
      );
      if (!selectedVariant) {
        return {
          error: `Variant SKU "${row.variantSku}" not found for ${product.name}.`,
        };
      }
    } else {
      selectedVariant = variants.find((variant) => Number(variant.quantity) > 0) || variants[0];
    }

    if (!selectedVariant) {
      return { error: `No valid variant found for ${product.name}.` };
    }

    if ((Number(selectedVariant.quantity) || 0) < row.quantity) {
      return {
        error: `Insufficient variant stock for ${product.name} (${selectedVariant.variantSku}).`,
      };
    }

    return { variantId: String(selectedVariant._id) };
  };

  const getImportOrderLabel = (rows: NormalizedSaleImportRow[]) => {
    const explicitOrder = rows.find((row) => row.orderNumber)?.orderNumber;
    if (explicitOrder) return explicitOrder;
    const firstRow = rows[0]?.rowNumber || 0;
    return `Row ${firstRow}`;
  };

  const handleImportOrders = async () => {
    if (ordersImportRows.length === 0 || isImportingOrders) return;

    setIsImportingOrders(true);
    variantCacheRef.current.clear();
    try {
      const { headers, dataRows } = parseOrderImportRows(ordersImportRows);
      if (headers.length === 0) {
        setOrdersImportResult({
          totalRows: 0,
          importedOrders: 0,
          importedItems: 0,
          skipped: [{ row: 1, reason: 'No file headers found.' }],
          unmappedHeaders: [],
          errors: [],
        });
        return;
      }

      const { headerIndexByField, unmappedHeaders } = mapSaleHeadersToCanonical(headers, dataRows);
      const quantityHeaderIndex = headerIndexByField.quantity;
      const hasProductIdentifier =
        typeof headerIndexByField.productId !== 'undefined' ||
        typeof headerIndexByField.productSku !== 'undefined' ||
        typeof headerIndexByField.productBarcode !== 'undefined' ||
        typeof headerIndexByField.productName !== 'undefined';

      if (typeof quantityHeaderIndex === 'undefined' || !hasProductIdentifier) {
        setOrdersImportResult({
          totalRows: dataRows.length,
          importedOrders: 0,
          importedItems: 0,
          skipped: [
            {
              row: 1,
              reason:
                'Missing required columns. Include Quantity plus at least one product field (Product Name/SKU/Barcode/ID).',
            },
          ],
          unmappedHeaders,
          errors: [],
        });
        return;
      }

      const skipped: SaleImportRowIssue[] = [];
      const normalizedRows: NormalizedSaleImportRow[] = [];

      dataRows.forEach((values, index) => {
        const rowNumber = index + 2;
        if (isSaleImportRowEmpty(values)) {
          skipped.push({ row: rowNumber, reason: 'Empty row' });
          return;
        }

        const { row, issues } = normalizeSaleImportRow(values, headerIndexByField, rowNumber);
        if (issues.length > 0) {
          skipped.push({ row: rowNumber, reason: issues.join(', ') });
          return;
        }
        normalizedRows.push(row);
      });

      if (normalizedRows.length === 0) {
        setOrdersImportResult({
          totalRows: dataRows.length,
          importedOrders: 0,
          importedItems: 0,
          skipped,
          unmappedHeaders,
          errors: [],
        });
        return;
      }

      const allProducts = await fetchAllProductsForLookup();
      const productLookup = buildProductLookupIndex(allProducts);
      const groupedRows = new Map<string, NormalizedSaleImportRow[]>();

      normalizedRows.forEach((row) => {
        const key = row.orderNumber || `row-${row.rowNumber}`;
        const existing = groupedRows.get(key) || [];
        existing.push(row);
        groupedRows.set(key, existing);
      });

      const errors: { order: string; error: string }[] = [];
      let importedOrders = 0;
      let importedItems = 0;

      for (const orderRows of groupedRows.values()) {
        const orderLabel = getImportOrderLabel(orderRows);
        const firstText = (picker: (row: NormalizedSaleImportRow) => string | undefined) => {
          for (const row of orderRows) {
            const value = picker(row);
            if (value && value.trim()) return value.trim();
          }
          return '';
        };
        const firstNumber = (picker: (row: NormalizedSaleImportRow) => number | undefined) => {
          for (const row of orderRows) {
            const value = picker(row);
            if (typeof value === 'number' && Number.isFinite(value)) return value;
          }
          return undefined;
        };
        const firstOrderType = () => {
          for (const row of orderRows) {
            if (row.orderType) return row.orderType;
          }
          return undefined;
        };
        const firstPaymentMethod = () => {
          for (const row of orderRows) {
            if (row.paymentMethod) return row.paymentMethod;
          }
          return undefined;
        };
        const firstShippingMode = () => {
          for (const row of orderRows) {
            if (row.shippingMode) return row.shippingMode;
          }
          return undefined;
        };

        try {
          const parsedOrderType = firstOrderType() || 'walk_in';
          const customerName = firstText((row) => row.customerName);
          const matchedClient = findSavedClientByName(customerName);
          const resolvedOrderType: OrderType = isEcommerceBusiness
            ? 'shipped'
            : (isSupermarketBusiness ? 'walk_in' : parsedOrderType);

          const itemPayload: Array<{
            productId: string;
            variantId?: string;
            quantity: number;
            unitPrice: number;
          }> = [];

          for (const row of orderRows) {
            const productResolution = resolveProductForImportRow(row, productLookup);
            if (!productResolution.product) {
              throw new Error(productResolution.error || `Unable to resolve product for row ${row.rowNumber}.`);
            }

            const product = productResolution.product;
            const measurementType = getResolvedMeasurementType(product.measurementType);
            if (isCountMeasurementType(measurementType) && !Number.isInteger(row.quantity)) {
              throw new Error(
                `Row ${row.rowNumber}: quantity must be whole for ${product.name} (${measurementType}).`
              );
            }

            const variantResolution = await resolveVariantIdForImport(product, row);
            if (variantResolution.error) {
              throw new Error(`Row ${row.rowNumber}: ${variantResolution.error}`);
            }

            const unitPrice =
              typeof row.unitPrice === 'number' && row.unitPrice >= 0
                ? row.unitPrice
                : getDiscountedUnitPrice(product, matchedClient?.pricingTier);
            const minimumAllowedPrice = getProductMinimumSalePrice(product);
            if (minimumAllowedPrice !== null && unitPrice < minimumAllowedPrice) {
              throw new Error(
                `Row ${row.rowNumber}: unit price cannot be lower than second price (${minimumAllowedPrice.toFixed(2)}) for ${product.name}.`
              );
            }

            itemPayload.push({
              productId: String(product._id),
              ...(variantResolution.variantId ? { variantId: variantResolution.variantId } : {}),
              quantity: row.quantity,
              unitPrice,
            });
          }

          if (itemPayload.length === 0) {
            throw new Error('No valid items mapped for this order.');
          }

          const fallbackWalkInName = t('ecommerce.walkInCustomer', 'Walk-in Customer');

          if (isEcommerceBusiness && !customerName) {
            throw new Error('Customer name is required for shipped/e-commerce orders.');
          }

          const shippingStreet = firstText((row) => row.shippingStreet);
          let shippingWilaya = firstText((row) => row.shippingWilaya);
          let shippingDaira = firstText((row) => row.shippingDaira);
          const rawShippingCity = firstText((row) => row.shippingCommune);
          const shippingCityParts = rawShippingCity
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean);
          const shippingCommune = shippingCityParts[0] || rawShippingCity;
          if (!shippingWilaya && shippingCityParts.length > 0) {
            shippingWilaya = shippingCityParts[shippingCityParts.length - 1];
          }
          if (!shippingDaira && shippingCityParts.length >= 3) {
            shippingDaira = shippingCityParts[shippingCityParts.length - 2];
          }
          const shippingPhone = firstText((row) => row.customerPhone);
          const shippingTracking = firstText((row) => row.trackingNumber);
          const shippingNotes = firstText((row) => row.shippingNotes);
          const shippingCarrier = resolveShippingCarrierFromInput(
            firstText((row) => row.shippingCarrier)
          );
          const shippingMode = normalizeShippingMode(firstShippingMode());
          const shippingCost = firstNumber((row) => row.shippingCost);
          const paymentMethod = firstPaymentMethod() || 'cash';

          if (resolvedOrderType === 'shipped') {
            if (!shippingWilaya) {
              throw new Error('Shipped orders require wilaya.');
            }
            if (shippingMode === 'domestic' && !shippingStreet) {
              throw new Error('Domestic shipped orders require street and wilaya.');
            }
            if (typeof shippingCost !== 'number' || !Number.isFinite(shippingCost) || shippingCost < 0) {
              throw new Error('Shipped orders require a valid shipping fee.');
            }
          }
          const shippingStreetForPayload =
            shippingMode === 'stopdesk'
              ? (shippingStreet || 'Stop Desk')
              : shippingStreet;

          await salesAPI.createSale({
            items: itemPayload,
            customer: {
              name: customerName || fallbackWalkInName,
              ...(matchedClient?.clientKey ? { clientKey: matchedClient.clientKey } : {}),
              ...(matchedClient?.pricingTier ? { pricingTier: matchedClient.pricingTier } : {}),
              ...(firstText((row) => row.customerEmail)
                ? { email: firstText((row) => row.customerEmail) }
                : {}),
              ...(shippingPhone ? { phone: shippingPhone } : {}),
              ...(resolvedOrderType === 'shipped'
                ? {
                    address: {
                      ...(shippingStreetForPayload ? { street: shippingStreetForPayload } : {}),
                      city: [shippingCommune, shippingDaira, shippingWilaya]
                        .filter(Boolean)
                        .join(', '),
                    },
                  }
                : {}),
            },
            orderType: resolvedOrderType,
            ...(resolvedOrderType === 'shipped'
              ? {
                  shipping: {
                    mode: shippingMode,
                    carrier: shippingCarrier || 'other',
                    status: 'processing',
                    ...(shippingTracking ? { trackingNumber: shippingTracking } : {}),
                    ...(shippingNotes ? { notes: shippingNotes } : {}),
                  },
                  shippingCost: Math.max(0, Number(shippingCost) || 0),
                }
              : {}),
            paymentMethod,
          });

          importedOrders += 1;
          importedItems += itemPayload.length;
        } catch (error) {
          const message =
            (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            (error as Error).message ||
            'Import failed.';
          errors.push({ order: orderLabel, error: message });
        }
      }

      if (importedOrders > 0) {
        await updateOnboarding({ recordedFirstSale: true });
        await fetchSales();
        await fetchAnalytics();
        notifyAnalyticsRefresh();
      }

      setOrdersImportResult({
        totalRows: dataRows.length,
        importedOrders,
        importedItems,
        skipped,
        unmappedHeaders,
        errors,
      });
    } catch (error) {
      console.error('Error importing orders:', error);
      setOrdersImportResult({
        totalRows: 0,
        importedOrders: 0,
        importedItems: 0,
        skipped: [],
        unmappedHeaders: [],
        errors: [
          {
            order: ordersImportFileName || 'File',
            error: (error as Error).message || 'Unable to import file.',
          },
        ],
      });
    } finally {
      setIsImportingOrders(false);
    }
  };

  const handleExportOrders = async (format: TabularFormat) => {
    if (isExportingOrders) return;
    setIsExportingOrders(true);

    try {
      const limit = 100;
      let page = 1;
      let pages = 1;
      const exportSales: Sale[] = [];

      while (page <= pages) {
        const response = await salesAPI.getSales(buildSalesFilters(page, limit));
        exportSales.push(...((response.data.sales || []).map((sale) => normalizeSaleForUi(sale))));
        pages = response.data.pagination?.pages || 1;
        page += 1;
      }

      const headers = [
        'Order Number',
        'Order Type',
        'Date',
        'Status',
        'Payment Status',
        'Payment Method',
        'Customer Name',
        'Customer Email',
        'Customer Phone',
        'Street',
        'Wilaya',
        'Daira',
        'Commune',
        'Carrier',
        'Tracking Number',
        'Shipping Cost',
        'Product Name',
        'SKU',
        'Variant SKU',
        'Variant Size',
        'Variant Color',
        'Quantity',
        'Unit Price',
        'Line Total',
        'Subtotal',
        'Tax',
        'Discount',
        'Total',
      ];

      const exportRows: string[][] = [headers];
      exportSales.forEach((sale) => {
        const orderType = getSaleOrderType(sale);
        const cityParts = String(sale.customer?.address?.city || '')
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean);
        const exportWilaya =
          cityParts.length >= 2 ? cityParts[cityParts.length - 1] : (cityParts[0] || '');
        const exportDaira = cityParts.length >= 3 ? cityParts[cityParts.length - 2] : '';
        const exportCommune = cityParts[0] || '';
        sale.items.forEach((item) => {
          const row = [
            String(sale.orderNumber || ''),
            String(orderType || ''),
            String(sale.createdAt || ''),
            String(normalizeSaleStatusForUi(sale.status) || ''),
            String(sale.paymentStatus || ''),
            String(sale.paymentMethod || ''),
            String(sale.customer?.name || ''),
            String(sale.customer?.email || ''),
            String(sale.customer?.phone || ''),
            String(sale.customer?.address?.street || ''),
            String(exportWilaya),
            String(exportDaira),
            String(exportCommune),
            String(sale.shipping?.carrier || ''),
            String(sale.shipping?.trackingNumber || ''),
            String(Number(sale.shippingCost) || 0),
            String(item.name || ''),
            String(item.sku || ''),
            String(item.variantSku || ''),
            String(item.variantSize || ''),
            String(item.variantColor || ''),
            String(Number(item.quantity) || 0),
            String(Number(item.unitPrice) || 0),
            String(Number(item.totalPrice) || 0),
            String(Number(sale.subtotal) || 0),
            String(Number(sale.tax) || 0),
            String(Number(sale.discount) || 0),
            String(Number(sale.total) || 0),
          ];
          exportRows.push(row);
        });
      });

      const dateStamp = new Date().toISOString().slice(0, 10);
      downloadTabularRows({
        rows: exportRows,
        format,
        fileNameBase: `orders-${dateStamp}`
      });
    } catch (error) {
      console.error('Error exporting orders:', error);
    } finally {
      setIsExportingOrders(false);
    }
  };

  const statCards = [
    {
      title: t('ecommerce.totalOrders', 'Total Orders'),
      value: analytics?.overview?.totalSales || 0,
      icon: ShoppingCart,
      color: 'text-[#BBF00F]',
      bgColor: 'bg-[#BBF00F]/20',
    },
    {
      title: t('ecommerce.totalRevenue', 'Total Revenue'),
      value: formatCurrency(analytics?.overview?.totalRevenue || 0),
      icon: DollarSign,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      title: t('ecommerce.itemsSold', 'Items Sold'),
      value: analytics?.overview?.totalItems || 0,
      icon: Package,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: t('ecommerce.avgOrderValue', 'Avg Order Value'),
      value: formatCurrency(analytics?.overview?.averageOrderValue || 0),
      icon: TrendingUp,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10',
    },
  ];
  const scannerConnected = hardwareScannerConnection.connected;
  const scannerStatusLabel = scannerConnected
    ? t(
        hardwareScannerConnection.source === 'hid'
          ? 'scanner.hardwareConnected'
          : 'scanner.hardwareInputDetected',
        hardwareScannerConnection.source === 'hid'
          ? 'Hardware scanner connected'
          : 'Hardware scanner input detected'
      )
    : t('scanner.hardwareWaiting', 'Waiting for hardware scanner input');
  const quickSellDairaOptions = getDairasByWilaya(quickSellShipping.wilaya);
  const quickSellCommuneOptions = getCommunesByWilayaAndDaira(
    quickSellShipping.wilaya,
    quickSellShipping.daira
  );

  if (!canAccessOrders) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('ecommerce.label', 'Sales')}</CardTitle>
          <CardDescription>
            {t('ecommerce.permissionDenied', 'Orders access is disabled for this workspace')}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="page-shell" dir={isRTL ? 'rtl' : 'ltr'}>
      {isSupermarketBusiness && isOrdersQuickViewMode && (
        <div
          className={`fixed inset-y-0 z-[40] bg-background/95 backdrop-blur-sm ${
            isRTL ? 'left-0 right-0 lg:left-0 lg:right-20' : 'left-0 right-0 lg:left-20 lg:right-0'
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="border-b bg-background px-4 py-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">
                    {t('ecommerce.quickViewMode', 'Quick View Mode')}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t(
                      'ecommerce.quickViewModeDesc',
                      'Full-screen order quick view with fast checkout actions.'
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {canManageSales() && (
                    <Button onClick={startNewSaleInQuickView}>
                      <Plus className="w-4 h-4 mr-2" />
                      {t('ecommerce.newSale', 'New Sale')}
                    </Button>
                  )}
                  <Button variant="outline" onClick={handleToggleOrdersQuickViewMode}>
                    <X className="w-4 h-4 mr-2" />
                    {t('ecommerce.exitQuickViewMode', 'Exit Quick View Mode')}
                  </Button>
                </div>
              </div>

            </div>

            <div className="min-h-0 flex-1 overflow-hidden p-4 sm:p-6">
              <div className="grid h-full gap-4 xl:grid-cols-[300px_minmax(420px,0.9fr)_1fr]">
                <div className="min-h-0 rounded-2xl border bg-card">
                  <div className="border-b px-4 py-3">
                    <p className="text-sm font-semibold">
                      {t('ecommerce.ordersQueue', 'Previous Orders')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('ecommerce.ordersQueueHint', 'Select an order to preview actions.')}
                    </p>
                  </div>
                  <div className="max-h-full overflow-y-auto p-2">
                    {loading ? (
                      <div className="flex items-center justify-center py-10">
                        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                      </div>
                    ) : sales.length === 0 ? (
                      <div className="py-10 text-center text-sm text-muted-foreground">
                        {t('ecommerce.noOrdersFound', 'No orders found')}
                      </div>
                    ) : (
                      sales.map((sale) => {
                        const isActiveSale = quickViewHighlightedSaleId === String(sale._id);
                        const saleStatus = normalizeSaleStatusForUi(sale.status);
                        return (
                          <button
                            key={`quick-view-order-${sale._id}`}
                            type="button"
                            onClick={() => {
                              setIsQuickViewCurrentSaleFocused(false);
                              setSelectedSale(normalizeSaleForUi(sale));
                            }}
                            className={`mb-2 w-full rounded-xl border p-3 text-left transition-colors ${
                              isActiveSale
                                ? 'border-[#001EF4]/35 bg-[#001EF4]/8'
                                : 'border-border hover:bg-muted/40'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-mono text-xs">{sale.orderNumber}</span>
                              <Badge className={`${statusColors[saleStatus]} text-white`}>
                                {t(`status.${saleStatus}`, saleStatus)}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm font-semibold">{formatCustomerName(sale)}</p>
                            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                              <span>{formatDate(sale.createdAt)}</span>
                              <span>{formatCurrency(sale.total)}</span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="min-h-0 overflow-y-auto pr-1 space-y-4">
                  {canManageSales() && (
                    <div className="rounded-2xl border bg-card p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">
                            {t('ecommerce.currentSale', 'Current Sale')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t('ecommerce.itemsInCart', '{{count}} item(s) in cart', {
                              count: quickSellCart.length,
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">{t('ecommerce.total', 'Total')}</p>
                          <p className="text-xl font-extrabold">{formatCurrency(quickSellGrandTotal)}</p>
                        </div>
                      </div>

                      {quickSellError && (
                        <p className="text-xs text-destructive">{quickSellError}</p>
                      )}

                      <div className="space-y-2">
                        <Label>{t('clients.savedClients', 'Saved Clients')}</Label>
                        <Select
                          value={selectedQuickSellClientKey}
                          onValueChange={handleQuickSellClientSelection}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t('clients.selectClient', 'Select a saved client')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={MANUAL_CLIENT_SELECT_VALUE}>
                              {t('clients.manualEntry', 'Type manually')}
                            </SelectItem>
                            {selectableClients.map((client) => (
                              <SelectItem
                                key={`quick-view-client-${client.clientKey}`}
                                value={client.clientKey}
                              >
                                {client.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Label>{t('ecommerce.buyerName', 'Buyer name (optional)')}</Label>
                        <Input
                          value={quickSellBuyerName}
                          onChange={(event) => {
                            const nextName = event.target.value;
                            setQuickSellBuyerName(nextName);
                            const matchedClient = findSavedClientByName(nextName);
                            setSelectedQuickSellClientKey(
                              matchedClient?.clientKey || MANUAL_CLIENT_SELECT_VALUE
                            );
                            if (quickSellError) setQuickSellError('');
                          }}
                          placeholder={t('ecommerce.buyerNamePlaceholder', 'Enter buyer name')}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>{t('ecommerce.searchProducts', 'Search products to add...')}</Label>
                        <div className="relative">
                          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            value={quickSellProductSearch}
                            onChange={(event) => {
                              setQuickSellProductSearch(event.target.value);
                              if (quickSellProductSearchError) setQuickSellProductSearchError('');
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' && quickSellProductResults.length > 0) {
                                event.preventDefault();
                                void handleQuickSellProductPick(quickSellProductResults[0]);
                              }
                            }}
                            placeholder={t('ecommerce.searchProducts', 'Search products to add...')}
                            className="pr-10"
                          />
                        </div>
                        {quickSellProductSearchError && (
                          <p className="text-xs text-destructive">{quickSellProductSearchError}</p>
                        )}
                        {shouldShowQuickViewSearchResults && (
                          <div className="max-h-44 overflow-y-auto rounded-lg border p-2">
                            {isQuickSellProductSearchLoading ? (
                              <div className="flex items-center justify-center py-6">
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                              </div>
                            ) : quickSellProductResults.length === 0 ? (
                              <p className="py-4 text-center text-sm text-muted-foreground">
                                {t('inventory.noProductsFound', 'No products found')}
                              </p>
                            ) : (
                              quickSellProductResults.map((product) => {
                                const productId = String(product._id);
                                const isAdding = quickSellAddingProductIds.has(productId);
                                return (
                                  <button
                                    key={`quick-view-product-inline-${productId}`}
                                    type="button"
                                    disabled={isAdding}
                                    onClick={() => void handleQuickSellProductPick(product)}
                                    className="mb-1 flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left hover:bg-muted/40 disabled:opacity-60 last:mb-0"
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium">
                                        {product.name || t('inventory.unnamedProduct', 'Unnamed product')}
                                      </p>
                                      <p className="truncate text-xs text-muted-foreground">{product.sku || '-'}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-xs text-muted-foreground">
                                        {formatCurrency(getDiscountedUnitPrice(product, selectedQuickSellPricingTier))}
                                      </p>
                                      <p className="text-xs font-medium text-primary">
                                        {isAdding
                                          ? t('common.loading', 'Loading...')
                                          : t('ecommerce.addToSale', 'Add to sale')}
                                      </p>
                                    </div>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>

                      {quickSellCart.length === 0 ? (
                        <div className="rounded-lg border p-4 text-sm text-center text-muted-foreground">
                          {t('ecommerce.cartEmpty', 'No scanned items yet')}
                        </div>
                      ) : (
                        <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                          {quickSellCart.map((item) => (
                            <div
                              key={`quick-view-cart-${item.productId}`}
                              className="rounded-lg border px-3 py-2 flex items-center gap-3"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{item.name}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {item.sku || '-'} - {formatCurrency(item.unitPrice)}
                                </p>
                              </div>
                              <div className="w-24">
                                <Input
                                  type="number"
                                  min={getMeasurementOption(item.measurementType).minPositive}
                                  step={getMeasurementOption(item.measurementType).step}
                                  max={item.availableQuantity}
                                  value={item.quantity}
                                  onChange={(event) =>
                                    updateQuickSellCartQuantity(
                                      item.productId,
                                      Number(event.target.value) || getMeasurementOption(item.measurementType).minPositive
                                    )
                                  }
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold">
                                  {formatCurrency(item.quantity * item.unitPrice)}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => removeQuickSellCartItem(item.productId)}
                                  className="text-xs text-red-600 hover:underline"
                                >
                                  {t('ecommerce.removeItem', 'Remove item')}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="rounded-lg border p-3 space-y-3">
                        <p className="text-sm font-semibold">
                          {t('ecommerce.changeCalculator', 'Change Calculator')}
                        </p>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <div className="space-y-1">
                            <Label className="text-xs">{t('ecommerce.total', 'Total')}</Label>
                            <Input
                              readOnly
                              value={formatCurrency(quickSellGrandTotal)}
                              className="h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">{t('ecommerce.amountReceived', 'Amount Received')}</Label>
                            <Input
                              value={quickViewAmountReceivedInput}
                              onKeyDown={blockNonIntegerPriceKeys}
                              onPaste={blockNonIntegerPricePaste}
                              onChange={(event) =>
                                setQuickViewAmountReceivedInput(
                                  event.target.value.replace(/[^0-9.,\s]/g, '')
                                )
                              }
                              className="h-9"
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">{t('ecommerce.changeToReturn', 'Change to return')}</Label>
                            <Input
                              readOnly
                              value={formatCurrency(quickViewChangeAmount)}
                              className="h-9 font-semibold"
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => addQuickViewReceivedAmount(50)}>
                            +50
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => addQuickViewReceivedAmount(100)}>
                            +100
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => addQuickViewReceivedAmount(200)}>
                            +200
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={setQuickViewExactAmount}>
                            {t('ecommerce.exactAmount', 'Exact Amount')}
                          </Button>
                        </div>
                        <p className={`text-xs font-semibold ${quickViewPaymentFeedback.tone}`}>
                          {quickViewPaymentFeedback.message}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={startNewSaleInQuickView}
                          disabled={isCreatingQuickSellOrder}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          {t('ecommerce.newSale', 'New Sale')}
                        </Button>
                        <Button
                          type="button"
                          onClick={handleQuickSell}
                          disabled={quickSellCart.length === 0 || isCreatingQuickSellOrder}
                        >
                          {isCreatingQuickSellOrder
                            ? t('ecommerce.processingSale', 'Processing...')
                            : t('ecommerce.completeSale', 'Complete Sale')}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="min-h-0 overflow-y-auto pr-1 space-y-4">
                  <div className="rounded-2xl bg-gradient-to-r from-[#001EF4] via-[#1D33FF] to-[#3348FF] p-4 text-white shadow-[0_14px_35px_rgba(0,30,244,0.28)]">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/75">
                      {t('ecommerce.activeOrder', 'Active Order')}
                    </p>
                    <p className="mt-1 text-4xl font-black tracking-tight sm:text-5xl">
                      {formatCurrency(quickViewActiveOrderCard.total)}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/85">
                      <span>{quickViewActiveOrderCard.orderNumber}</span>
                      <span>{formatCustomerName(quickViewActiveOrderCard)}</span>
                      <span>{formatDate(quickViewActiveOrderCard.createdAt)}</span>
                    </div>
                    {quickViewActiveOrderIsOngoing ? (
                      <p className="mt-3 text-sm text-white/80">
                        {t('ecommerce.liveSalePreview', 'Live sale preview')}
                      </p>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          className="h-9"
                          onClick={() => openSaleDetail(quickViewActiveOrderCard)}
                        >
                          {t('inventory.viewDetails', 'View details')}
                        </Button>
                        <Button
                          variant="secondary"
                          className="h-9"
                          onClick={() => openReceiptModal(quickViewActiveOrderCard)}
                        >
                          {t('ecommerce.printReceipt', 'Print Receipt')}
                        </Button>
                        {canManageSales() && (
                          <Button
                            variant="secondary"
                            className="h-9"
                            onClick={() => openEditModal(quickViewActiveOrderCard)}
                          >
                            {t('ecommerce.editStatus', 'Edit Status')}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  <OrderQuickViewPanel
                    order={quickViewActiveOrderCard}
                    formatCurrency={formatCurrency}
                    locale={DATE_LOCALE_BY_LANGUAGE[language] || 'en-US'}
                    currency={currency}
                    hidePaymentCalculator
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('ecommerceManager', 'Orders Manager')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">{t('manageOrdersSalesShipping', 'Manage orders, sales, and shipping')}</p>
        </div>
        <div className="page-actions">
          {isSupermarketBusiness && (
            <Badge
              className={`px-2 sm:px-3 py-1 border text-xs sm:text-sm ${
                scannerConnected
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : 'bg-amber-100 text-amber-800 border-amber-200'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    scannerConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                  }`}
                />
                {scannerStatusLabel}
              </span>
            </Badge>
          )}
          <Button variant="outline" onClick={() => setIsScannerOpen(true)} className="h-9 sm:h-10 text-xs sm:text-sm">
            <ScanLine className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
            <span className="hidden sm:inline">{t('ecommerce.scanToSell', 'Scan to Sell')}</span>
          </Button>
          {canManageSales() && (
            <Button variant="outline" onClick={() => setIsOrdersImportModalOpen(true)} className="h-9 sm:h-10 text-xs sm:text-sm">
              <FileUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('inventory.import', 'Import')}</span>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isExportingOrders} className="h-9 sm:h-10 text-xs sm:text-sm">
                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                {isExportingOrders ? t('common.loading', 'Loading...') : t('inventory.export', 'Export')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => void handleExportOrders('excel')}>
                {t('inventory.exportExcel', 'Export as Excel (.xlsx)')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleExportOrders('csv')}>
                {t('inventory.exportCsv', 'Export as CSV (.csv)')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleExportOrders('json')}>
                {t('inventory.exportJson', 'Export as JSON (.json)')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link to="/dashboard/inventory">
            <Button variant="outline" className="h-9 sm:h-10 text-xs sm:text-sm">
              <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('ecommerce.products', 'Products')}</span>
            </Button>
          </Link>
          {canManageSales() && (
            <Button onClick={openNewSalePanel} className="h-9 sm:h-10 text-xs sm:text-sm">
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('ecommerce.newSale', 'New Sale')}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      {canAccessOrderAnalytics && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:gap-5">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="py-4">
                <CardContent className="px-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex h-12 flex-col justify-between">
                      <p className="text-xs text-muted-foreground leading-none">{stat.title}</p>
                      <p className="text-xl font-bold leading-none">{stat.value}</p>
                    </div>
                    <div className={`w-8 h-8 ${stat.bgColor} rounded-md flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Orders Section */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            {t('ecommerce.orders', 'Orders')}
          </CardTitle>
          <CardDescription>
            {t('ecommerce.ordersDescription', 'View and manage all customer orders')}
          </CardDescription>
        </CardHeader>
        <CardContent className="content-breathe pt-0">
          {/* Filters */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="relative flex-1">
              <Search
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
              />
              <Input
                placeholder={t('ecommerce.searchOrdersCustomers', 'Search orders, customers...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                dir={isRTL ? 'rtl' : 'ltr'}
                className={`pr-10 ${isRTL ? 'text-right' : 'text-left'}`}
              />
            </div>
            <Select value={dateRange} onValueChange={(value) => setDateRange(value as typeof dateRange)}>
              <SelectTrigger className="w-full sm:w-[160px] md:w-[180px]">
                <CalendarClock className="w-4 h-4 mr-2" />
                <SelectValue placeholder={t('ecommerce.dateRange', 'Date range')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">{t('ecommerce.today', 'Today')}</SelectItem>
                <SelectItem value="3days">{t('ecommerce.last3Days', 'Last 3 Days')}</SelectItem>
                <SelectItem value="week">{t('ecommerce.thisWeek', 'This Week')}</SelectItem>
                <SelectItem value="month">{t('ecommerce.thisMonth', 'This Month')}</SelectItem>
                <SelectItem value="year">{t('ecommerce.thisYear', 'This Year')}</SelectItem>
                <SelectItem value="all">{t('ecommerce.allTime', 'All Time')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px] md:w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder={t('ecommerce.filterByStatus', 'Filter by status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('ecommerce.allStatuses', 'All Statuses')}</SelectItem>
                <SelectItem value="confirmed">{t('status.confirmed', 'Confirmed')}</SelectItem>
                <SelectItem value="processing">{t('status.processing', 'Processing')}</SelectItem>
                <SelectItem value="shipping">{t('status.shipping', 'Shipping')}</SelectItem>
                <SelectItem value="delivered">{t('status.delivered', 'Delivered')}</SelectItem>
                <SelectItem value="cancelled">{t('status.cancelled', 'Cancelled')}</SelectItem>
                <SelectItem value="reversed">{t('status.reversed', 'Reversed')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isSupermarketBusiness && (
            <div className="mb-6 flex items-center justify-end">
              <Button
                type="button"
                variant={isOrdersQuickViewMode ? 'default' : 'outline'}
                className={isOrdersQuickViewMode ? 'bg-[#001EF4] hover:bg-[#001EF4]/90 text-white' : ''}
                onClick={handleToggleOrdersQuickViewMode}
              >
                <Eye className="w-4 h-4 mr-2" />
                {isOrdersQuickViewMode
                  ? t('ecommerce.exitQuickViewMode', 'Exit Quick View Mode')
                  : t('ecommerce.quickViewMode', 'Quick View Mode')}
              </Button>
            </div>
          )}

          {selectedSaleIds.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {canDispatchOrdersToShipping && (
                <Button
                  variant="outline"
                  onClick={() => openShippingDispatchDialog(selectedSaleIds)}
                  disabled={isShippingDispatching || isShippingProvidersLoading}
                >
                  <Truck className="w-4 h-4 mr-2" />
                  {t('ecommerce.sendToShipping', 'Send to Shipping')} ({selectedSaleIds.length})
                </Button>
              )}
              {canDeleteAccess && (
                <Button variant="destructive" onClick={() => setIsBulkDeleteOpen(true)}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t('ecommerce.bulkDelete', 'Delete Selected')} ({selectedSaleIds.length})
                </Button>
              )}
            </div>
          )}

          {/* Orders Table */}
          <div className="table-responsive">
            <Table className="min-w-[980px] table-fixed">
              <TableHeader>
                <TableRow>
                  {canSelectOrders && (
                    <TableHead className="w-[3%] text-left">
                      <Checkbox
                        checked={selectedSaleIds.length > 0 && selectedSaleIds.length === sales.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedSaleIds(sales.map((sale) => String(sale._id)));
                          } else {
                            setSelectedSaleIds([]);
                          }
                        }}
                        aria-label={t('ecommerce.selectAllOrders', 'Select all orders')}
                      />
                    </TableHead>
                  )}
                  <TableHead className={`w-[16%] whitespace-nowrap ${isRTL ? 'text-right' : 'text-left'}`}>
                    <span
                      dir={language === 'ar' ? 'rtl' : 'ltr'}
                      className={`inline-block ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      {t('ecommerce.orderNumber', 'Order #')}
                    </span>
                  </TableHead>
                  <TableHead className={`w-[17%] whitespace-nowrap pr-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('ecommerce.customer', 'Customer')}
                  </TableHead>
                  <TableHead className={`w-[9%] whitespace-nowrap text-center ${isRTL ? '' : 'pl-0 pr-8'}`}>
                    {t('ecommerce.quantity', 'Quantity')}
                  </TableHead>
                  <TableHead className={`w-[11%] whitespace-nowrap ${isRTL ? 'text-center' : 'text-left'}`}>
                    {t('ecommerce.total', 'Total')}
                  </TableHead>
                  <TableHead className={`w-[13%] whitespace-nowrap ${isRTL ? 'text-center' : 'text-left'}`}>
                    {t('ecommerce.status', 'Status')}
                  </TableHead>
                  <TableHead className={`w-[12%] whitespace-nowrap ${isRTL ? 'text-center' : 'text-left'}`}>
                    {t('ecommerce.payment', 'Payment')}
                  </TableHead>
                  <TableHead className={`w-[12%] whitespace-nowrap ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('ecommerce.date', 'Date')}
                  </TableHead>
                  <TableHead className={`w-[14%] whitespace-nowrap ${isRTL ? 'text-left' : 'text-right'}`}>
                    {t('common.actions', 'Actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={canSelectOrders ? 9 : 8} className="py-12 text-center">
                      <div className="mx-auto flex flex-col items-center gap-3 text-sm text-muted-foreground">
                        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        <span>{t('common.loading', 'Loading...')}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : sales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canSelectOrders ? 9 : 8} className="py-12 text-center text-muted-foreground">
                      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 rounded-md border border-dashed border-border/70 bg-muted/20 p-6">
                        <ShoppingCart className="h-10 w-10 text-primary/50" />
                        <p className="font-medium text-foreground">{t('ecommerce.noOrdersFound', 'No orders found')}</p>
                        <p className="text-sm text-muted-foreground">{t('ecommerce.noOrdersHint', 'New customer orders will appear here.')}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sales.map((sale) => {
                    const saleStatus = normalizeSaleStatusForUi(sale.status);
                    const isHighlightedSale = highlightSaleIds.includes(String(sale._id));
                    const rowHoverClass = 'hover:bg-muted/50 transition-colors duration-150';
                    const rowClass = isHighlightedSale
                      ? HIGHLIGHT_ROW_CLASS_BY_PRIORITY[highlightPriority]
                      : rowHoverClass;
                    return (
                    <TableRow
                      key={sale._id}
                      id={`sale-row-${sale._id}`}
                      className={`cursor-pointer ${rowClass}`}
                      onClick={(event) => handleSaleRowClick(event, sale)}
                    >
                      {canSelectOrders && (
                        <TableCell
                          className="w-[3%] text-left"
                          data-row-interactive="true"
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={selectedSaleIds.includes(String(sale._id))}
                            onCheckedChange={(checked) => {
                              const id = String(sale._id);
                              setSelectedSaleIds((prev) => {
                                if (checked) return Array.from(new Set([...prev, id]));
                                return prev.filter((item) => item !== id);
                              });
                            }}
                            aria-label={t('ecommerce.selectOrder', 'Select order {{orderNumber}}', {
                              orderNumber: sale.orderNumber,
                            })}
                          />
                        </TableCell>
                      )}
                      <TableCell
                        className={`w-[16%] font-mono text-sm whitespace-nowrap truncate ${isRTL ? 'text-right' : 'text-left'}`}
                      >
                        <span dir="ltr" className="inline-block">{sale.orderNumber}</span>
                      </TableCell>
                      <TableCell className={`w-[17%] pr-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                        <div className={isRTL ? 'text-right' : 'text-left'}>
                          <p className="font-medium">{formatCustomerName(sale)}</p>
                          {sale.customer.email && (
                            <p className="text-xs text-muted-foreground">{sale.customer.email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className={`w-[9%] text-center whitespace-nowrap ${isRTL ? '' : 'pl-0 pr-8'}`}>
                        {sale.items.reduce((total, item) => total + (Number(item.quantity) || 0), 0)}
                      </TableCell>
                      <TableCell className={`w-[11%] font-medium whitespace-nowrap ${isRTL ? 'text-center' : 'text-left'}`}>
                        {formatCurrency(sale.total)}
                      </TableCell>
                      <TableCell
                        className={`w-[13%] ${isRTL ? 'text-center' : 'text-left'}`}
                        data-row-interactive="true"
                      >
                        {canManageSales() ? (
                          <div className={`flex ${isRTL ? 'justify-center' : 'justify-start'}`}>
                          <Select
                            value={saleStatus}
                            disabled={updatingSaleField === `${sale._id}:status`}
                            onValueChange={(value) =>
                              void handleInlineSaleUpdate(sale, { status: value as Sale['status'] })
                            }
                          >
                            <SelectTrigger
                              data-row-interactive="true"
                              className={`h-7 min-w-[112px] w-fit rounded-full border px-2 shadow-none transition-colors [&_svg]:h-3 [&_svg]:w-3 ${statusTriggerColors[saleStatus] || 'border-slate-200 bg-slate-50 text-slate-700'}`}
                            >
                              <span className="pointer-events-none inline-flex items-center gap-1.5 font-medium text-[11px] capitalize">
                                <span className="h-1.5 w-1.5 rounded-full bg-current/70" />
                                {t(`status.${saleStatus}`, saleStatus)}
                              </span>
                            </SelectTrigger>
                            <SelectContent
                              align={isRTL ? 'start' : 'end'}
                              position="popper"
                              sideOffset={6}
                              className="rounded-xl border-border/80 bg-popover p-1.5 shadow-xl"
                            >
                              {saleStatusOptions.map((statusOption) => (
                                <SelectItem
                                  key={statusOption}
                                  value={statusOption}
                                  className={`mb-1 rounded-lg border ${statusOptionStyles[statusOption] || 'border-slate-200 bg-slate-50 text-slate-800'} last:mb-0`}
                                >
                                  <span className="inline-flex items-center gap-2">
                                    <span
                                      className={`h-2 w-2 rounded-full ${statusColors[statusOption] || 'bg-slate-500'}`}
                                    />
                                    {t(`status.${statusOption}`, statusOption)}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          </div>
                        ) : (
                          <Badge className={`${statusColors[saleStatus]} text-white`}>
                            {t(`status.${saleStatus}`, saleStatus)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell
                        className={`w-[12%] ${isRTL ? 'text-center' : 'text-left'}`}
                        data-row-interactive="true"
                      >
                        {canManageSales() ? (
                          <div className={`flex ${isRTL ? 'justify-center' : 'justify-start'}`}>
                          <Select
                            value={sale.paymentStatus}
                            disabled={updatingSaleField === `${sale._id}:paymentStatus`}
                            onValueChange={(value) =>
                              void handleInlineSaleUpdate(sale, {
                                paymentStatus: value as Sale['paymentStatus'],
                              })
                            }
                          >
                            <SelectTrigger
                              data-row-interactive="true"
                              className={`h-7 min-w-[102px] w-fit rounded-full border px-2 shadow-none transition-colors [&_svg]:h-3 [&_svg]:w-3 ${paymentTriggerColors[sale.paymentStatus] || 'border-slate-200 bg-slate-50 text-slate-700'}`}
                            >
                              <span className="pointer-events-none inline-flex items-center gap-1.5 font-medium text-[11px] capitalize">
                                <span className="h-1.5 w-1.5 rounded-full bg-current/70" />
                                {t(`payment.${sale.paymentStatus}`, sale.paymentStatus)}
                              </span>
                            </SelectTrigger>
                            <SelectContent
                              align={isRTL ? 'start' : 'end'}
                              position="popper"
                              sideOffset={6}
                              className="rounded-xl border-border/80 bg-popover p-1.5 shadow-xl"
                            >
                              {paymentStatusOptions.map((paymentOption) => (
                                <SelectItem
                                  key={paymentOption}
                                  value={paymentOption}
                                  className={`mb-1 rounded-lg border ${paymentOptionStyles[paymentOption] || 'border-slate-200 bg-slate-50 text-slate-800'} last:mb-0`}
                                >
                                  <span className="inline-flex items-center gap-2">
                                    <span
                                      className={`h-2 w-2 rounded-full ${paymentStatusColors[paymentOption] || 'bg-slate-500'}`}
                                    />
                                    {t(`payment.${paymentOption}`, paymentOption)}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          </div>
                        ) : (
                          <Badge className={`${paymentStatusColors[sale.paymentStatus]} text-white`}>
                            {t(`payment.${sale.paymentStatus}`, sale.paymentStatus)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className={`w-[12%] whitespace-nowrap ${isRTL ? 'text-right' : 'text-left'}`}>
                        {formatDate(sale.createdAt)}
                      </TableCell>
                      <TableCell
                        className={`w-[14%] ${isRTL ? 'text-left' : 'text-right'}`}
                        data-row-interactive="true"
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <div className={`flex items-center gap-2 ${isRTL ? 'justify-start' : 'justify-end'}`}>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              asChild
                              onClick={(e) => e.stopPropagation()}
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                              <DropdownMenuItem onClick={() => openSaleDetail(sale)}>
                                <Eye className="w-4 h-4 mr-2" />
                                {t('inventory.viewDetails', 'View details')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openReceiptModal(sale)}>
                                <Printer className="w-4 h-4 mr-2" />
                                {t('ecommerce.printReceipt', 'Print Receipt')}
                              </DropdownMenuItem>
                              {canDispatchOrdersToShipping && getSaleOrderType(sale) === 'shipped' && (
                                <DropdownMenuItem
                                  onClick={() => openShippingDispatchDialog([String(sale._id)])}
                                >
                                  <Truck className="w-4 h-4 mr-2" />
                                  {t('ecommerce.sendToShipping', 'Send to Shipping')}
                                </DropdownMenuItem>
                              )}
                              {canManageSales() && (
                                <DropdownMenuItem onClick={() => openEditModal(sale)}>
                                  <Edit3 className="w-4 h-4 mr-2" />
                                  {t('ecommerce.editStatus', 'Edit Status')}
                                </DropdownMenuItem>
                              )}
                              {canDeleteAccess && (
                                <DropdownMenuItem
                                  onClick={() => openDeleteDialog(sale)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  {t('ecommerce.delete', 'Delete')}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className={`flex items-center justify-between mt-4 pt-4 border-t ${isRTL ? 'flex-row-reverse' : ''}`}>
              <p className="text-sm text-muted-foreground">
                {t('inventory.pageOf', 'Page {{page}} of {{pages}}', {
                  page: pagination.page,
                  pages: pagination.pages,
                })}
              </p>
              <div className="flex items-center gap-2">
                {isRTL ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                      disabled={pagination.page === pagination.pages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    {buildPageNumberItems(pagination.page, pagination.pages).map((item, index) =>
                      item === 'ellipsis' ? (
                        <span
                          key={`orders-page-ellipsis-${index}`}
                          className="px-1 text-sm text-muted-foreground"
                        >
                          ...
                        </span>
                      ) : (
                        <Button
                          key={`orders-page-${item}`}
                          variant={item === pagination.page ? 'default' : 'outline'}
                          size="sm"
                          className="min-w-9 px-3"
                          onClick={() => setPagination((p) => ({ ...p, page: item }))}
                        >
                          {item}
                        </Button>
                      )
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                      disabled={pagination.page === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                      disabled={pagination.page === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    {buildPageNumberItems(pagination.page, pagination.pages).map((item, index) =>
                      item === 'ellipsis' ? (
                        <span
                          key={`orders-page-ellipsis-${index}`}
                          className="px-1 text-sm text-muted-foreground"
                        >
                          ...
                        </span>
                      ) : (
                        <Button
                          key={`orders-page-${item}`}
                          variant={item === pagination.page ? 'default' : 'outline'}
                          size="sm"
                          className="min-w-9 px-3"
                          onClick={() => setPagination((p) => ({ ...p, page: item }))}
                        >
                          {item}
                        </Button>
                      )
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                      disabled={pagination.page === pagination.pages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedSale && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>
                    {t('ecommerce.orderLabel', 'Order {{orderNumber}}', {
                      orderNumber: selectedSale.orderNumber,
                    })}
                  </span>
                  <Badge className={`${statusColors[selectedSaleStatus]} text-white`}>
                    {t(`status.${selectedSaleStatus}`, selectedSaleStatus)}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {t('ecommerce.placedOn', 'Placed on {{date}}', { date: formatDate(selectedSale.createdAt) })}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Customer Info */}
                <div className="bg-muted rounded-lg p-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {t('ecommerce.customerInformation', 'Customer Information')}
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('settings.name', 'Name')}</p>
                      <p className="font-medium">{formatCustomerName(selectedSale)}</p>
                    </div>
                    {selectedSale.customer.email && (
                      <div>
                        <p className="text-sm text-muted-foreground">{t('settings.email', 'Email')}</p>
                        <p className="font-medium flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {selectedSale.customer.email}
                        </p>
                      </div>
                    )}
                    {selectedSale.customer.phone && (
                      <div>
                        <p className="text-sm text-muted-foreground">{t('ecommerce.phone', 'Phone')}</p>
                        <p className="font-medium flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {selectedSale.customer.phone}
                        </p>
                      </div>
                    )}
                    {selectedSale.customer.address && (
                      <div className="sm:col-span-2">
                        <p className="text-sm text-muted-foreground">{t('ecommerce.address', 'Address')}</p>
                        <p className="font-medium flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {[
                            selectedSale.shipping?.mode === 'stopdesk'
                              ? ''
                              : selectedSale.customer.address.street,
                            selectedSale.customer.address.city,
                          ].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    {t('ecommerce.orderItems', 'Order Items')}
                  </h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-start p-3 text-sm font-medium">{t('inventory.productName', 'Product')}</th>
                          <th className="text-center p-3 text-sm font-medium">{t('ecommerce.quantity', 'Qty')}</th>
                          <th className={isRTL ? 'text-left p-3 text-sm font-medium' : 'text-right p-3 text-sm font-medium'}>
                            {t('inventory.price', 'Price')}
                          </th>
                          <th className={isRTL ? 'text-left p-3 text-sm font-medium' : 'text-right p-3 text-sm font-medium'}>
                            {t('ecommerce.total', 'Total')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSale.items.map((item, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="p-3">
                              <div className="flex items-center gap-3">
                                {item.image && (
                                  <img src={item.image} alt={item.name} className="w-10 h-10 object-cover rounded" />
                                )}
                                <div>
                                  <p className="font-medium">{item.name}</p>
                                  <p className="text-xs text-muted-foreground">{item.sku || '-'}</p>
                                  {(item.variantSku || item.variantSize || item.variantColor) && (
                                    <p className="text-xs text-muted-foreground">
                                      Variant: {[item.variantSku, item.variantSize, item.variantColor]
                                        .filter(Boolean)
                                        .join(' | ')}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-center">{item.quantity}</td>
                            <td className={isRTL ? 'p-3 text-left' : 'p-3 text-right'}>{formatCurrency(item.unitPrice)}</td>
                            <td className={isRTL ? 'p-3 text-left font-medium' : 'p-3 text-right font-medium'}>
                              {formatCurrency(item.totalPrice)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Order Summary */}
                <div className="border-t pt-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t('ecommerce.subtotal', 'Subtotal')}
                      </span>
                      <span>{formatCurrency(selectedSale.subtotal)}</span>
                    </div>
                    {selectedSale.tax > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('ecommerce.tax', 'Tax')}</span>
                        <span>{formatCurrency(selectedSale.tax)}</span>
                      </div>
                    )}
                    {selectedSale.discount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {t('ecommerce.discount', 'Discount')}
                        </span>
                        <span className="text-green-600">-{formatCurrency(selectedSale.discount)}</span>
                      </div>
                    )}
                    {selectedSale.shippingCost > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('ecommerce.shippingFee', 'Shipping Fee')}</span>
                        <span>{formatCurrency(selectedSale.shippingCost)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold pt-2 border-t">
                      <span>{t('ecommerce.total', 'Total')}</span>
                      <span>{formatCurrency(selectedSale.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="flex items-center justify-between bg-muted rounded-lg p-3">
                  <span className="text-sm text-muted-foreground">{t('ecommerce.paymentMethod', 'Payment Method')}</span>
                  <span className="font-medium capitalize">{formatPaymentMethod(selectedSale.paymentMethod)}</span>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>
                  {t('common.close', 'Close')}
                </Button>
                <Button onClick={() => { setIsDetailModalOpen(false); openReceiptModal(selectedSale); }}>
                  <Printer className="w-4 h-4 mr-2" />
                  {t('ecommerce.printReceipt', 'Print Receipt')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Orders Dialog */}
      <Dialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">{t('ecommerce.bulkDeleteTitle', 'Delete Selected Orders?')}</DialogTitle>
            <DialogDescription>
              {t('ecommerce.bulkDeleteDesc', 'Are you sure you want to delete the selected orders? This action cannot be undone.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkDeleteOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              {t('ecommerce.bulkDelete', 'Delete Selected')} ({selectedSaleIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isShippingDispatchDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeShippingDispatchDialog();
          } else {
            setIsShippingDispatchDialogOpen(true);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t('ecommerce.sendToShippingTitle', 'Send to Shipping Provider')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'ecommerce.sendToShippingDesc',
                'Choose a connected provider and send the selected orders directly from Stockly.'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('ecommerce.shippingProvider', 'Shipping Provider')}</Label>
              <Select
                value={shippingDispatchProvider}
                onValueChange={(value) =>
                  setShippingDispatchProvider(value as ShippingProviderKey)
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t(
                      'ecommerce.selectShippingProvider',
                      'Select a shipping provider'
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  {connectedShippingProviders.map((provider) => (
                    <SelectItem key={provider.provider} value={provider.provider}>
                      {provider.accountName
                        ? `${provider.label} - ${provider.accountName}`
                        : provider.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t(
                  'ecommerce.shippingDispatchHint',
                  'Only shipped orders with customer phone and address details can be accepted by the provider.'
                )}
              </p>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">
                  {t('ecommerce.ordersSelected', 'Orders selected')}
                </p>
                <span className="text-sm text-muted-foreground">
                  {shippingDispatchSaleIds.length}
                </span>
              </div>

              <div className="space-y-2">
                {selectedSalesForShippingDispatch.slice(0, 5).map((sale) => (
                  <div
                    key={sale._id}
                    className="flex flex-col gap-1 rounded-lg border bg-muted/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{sale.orderNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCustomerName(sale)}
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {getShippingProviderLabel(sale.shipping?.carrier) || t('ecommerce.shipping', 'Shipping')} - {formatCurrency(sale.total)}
                    </div>
                  </div>
                ))}
                {selectedSalesForShippingDispatch.length > 5 && (
                  <p className="text-sm text-muted-foreground">
                    {t(
                      'ecommerce.moreOrdersSelected',
                      '+{{count}} more orders selected',
                      { count: selectedSalesForShippingDispatch.length - 5 }
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeShippingDispatchDialog}
              disabled={isShippingDispatching}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={handleShippingDispatch}
              disabled={
                !shippingDispatchProvider ||
                isShippingDispatching ||
                selectedSalesForShippingDispatch.length === 0
              }
            >
              <Truck className="w-4 h-4 mr-2" />
              {isShippingDispatching
                ? t('ecommerce.sendingToShipping', 'Sending...')
                : t('ecommerce.sendOrders', 'Send Orders')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Barcode Scanner */}
      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScan}
        mode="callback"
      />

      <Dialog open={isScanNotFoundDialogOpen} onOpenChange={setIsScanNotFoundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('ecommerce.productNotFound', 'Product not found')}</DialogTitle>
            <DialogDescription>
              {t(
                'ecommerce.productNotFoundDescription',
                "We couldn't find a product with this barcode. You can rescan or create the item now."
              )}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('ecommerce.scannedBarcode', 'Barcode')}: <span className="font-mono">{scanNotFoundBarcode}</span>
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={handleRescanAfterNotFound}>
              {t('scanner.retry', 'Rescan')}
            </Button>
            <Button onClick={handleCreateItemAfterNotFound}>
              {t('scanner.createProduct', 'Create Item')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Orders Import Modal */}
      <Dialog open={isOrdersImportModalOpen} onOpenChange={setIsOrdersImportModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('ecommerce.importOrders', 'Import Orders')}</DialogTitle>
            <DialogDescription>
              {t(
                'ecommerce.importOrdersDesc',
                'Upload CSV, Excel, or JSON. Required: Quantity + one product field (Product Name, SKU, Barcode, or Product ID). Optional grouping by Order Number.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orders-import-file">{t('inventory.importFile', 'Upload file')}</Label>
              <Input
                id="orders-import-file"
                type="file"
                accept=".csv,.json,.xls,.xlsx,text/csv,application/json,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleOrdersImportFile}
              />
              {ordersImportFileName ? (
                <p className="text-sm text-muted-foreground">
                  {t('inventory.fileSelected', 'Selected file')}: <span className="font-medium">{ordersImportFileName}</span>
                  {ordersImportRows.length > 1
                    ? ` (${ordersImportRows.length - 1} ${t('inventory.rows', 'rows')})`
                    : ''}
                </p>
              ) : null}
            </div>
            {ordersImportResult && (
              <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg bg-muted p-4 text-sm">
                <p className="text-muted-foreground">
                  {t('inventory.totalRows', 'Total Rows')}: {ordersImportResult.totalRows}
                </p>
                <p className="text-emerald-600">
                  {t('ecommerce.importedOrders', 'Imported Orders')}: {ordersImportResult.importedOrders}
                </p>
                <p className="text-blue-600">
                  {t('ecommerce.importedItems', 'Imported Items')}: {ordersImportResult.importedItems}
                </p>
                {ordersImportResult.skipped.length > 0 && (
                  <div className="mt-2">
                    <p className="text-orange-600">
                      {t('inventory.skipped', 'Skipped')}: {ordersImportResult.skipped.length}
                    </p>
                    <ul className="mt-1 text-orange-500">
                      {ordersImportResult.skipped.slice(0, 5).map((item, index) => (
                        <li key={`${item.row}-${index}`}>Row {item.row}: {item.reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {ordersImportResult.unmappedHeaders.length > 0 && (
                  <div className="mt-2">
                    <p className="text-amber-600">
                      {t('inventory.unmapped', 'Unmapped Columns')}: {ordersImportResult.unmappedHeaders.length}
                    </p>
                    <ul className="mt-1 text-amber-500">
                      {ordersImportResult.unmappedHeaders.slice(0, 5).map((item, index) => (
                        <li key={`${item.header}-${index}`}>{item.header}: {item.reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {ordersImportResult.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-destructive">
                      {t('inventory.errors', 'Errors')}: {ordersImportResult.errors.length}
                    </p>
                    <ul className="mt-1 text-destructive/90">
                      {ordersImportResult.errors.slice(0, 5).map((item, index) => (
                        <li key={`${item.order}-${index}`}>{item.order}: {item.error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsOrdersImportModalOpen(false);
                setOrdersImportRows([]);
                setOrdersImportFileName('');
                setOrdersImportResult(null);
              }}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleImportOrders} disabled={ordersImportRows.length < 2 || isImportingOrders}>
              <FileUp className="mr-2 h-4 w-4" />
              {isImportingOrders
                ? t('ecommerce.importing', 'Importing...')
                : t('inventory.import', 'Import')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Sell Modal */}
      <Dialog open={isQuickSellModalOpen} onOpenChange={handleQuickSellModalChange}>
        <DialogContent className="w-[95vw] sm:max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('ecommerce.newSalePanel', 'New Sale')}</DialogTitle>
            <DialogDescription>
              {t('ecommerce.itemsInCart', '{{count}} item(s) in cart', {
                count: quickSellCart.length,
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-10 py-1 [&_[data-slot=input]]:h-11 [&_[data-slot=input]]:w-full [&_[data-slot=input]]:text-base [&_[data-slot=input]]:font-normal [&_[data-slot=select-trigger]]:h-11 [&_[data-slot=select-trigger]]:w-full [&_[data-slot=select-trigger]]:text-base [&_[data-slot=select-trigger]]:font-normal [&_[data-slot=select-value]]:text-base [&_[data-slot=select-value]]:font-normal [&_[data-slot=label]]:text-sm [&_[data-slot=label]]:font-medium">
            {quickSellError && (
              <p className="text-sm text-destructive">{quickSellError}</p>
            )}

            <section className="space-y-4 rounded-lg border bg-card/30 p-6">
              <Label>{t('ecommerce.product', 'Product')}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={quickSellProductSearch}
                  onChange={(e) => {
                    setQuickSellProductSearch(e.target.value);
                    setQuickSellProductSearchError('');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && quickSellProductResults.length > 0) {
                      event.preventDefault();
                      void handleQuickSellProductPick(quickSellProductResults[0]);
                    }
                  }}
                  className="h-11 pl-10 text-base"
                  placeholder={t(
                    'ecommerce.quickProductSearch',
                    'Tiny search: name, SKU, or barcode'
                  )}
                />
              </div>
              {isQuickSellProductSearchLoading && (
                  <p className="text-sm text-muted-foreground">
                    {t('common.loading', 'Loading...')}
                  </p>
                )}
              {quickSellProductSearchError && (
                <p className="text-sm text-destructive">{quickSellProductSearchError}</p>
              )}
              {quickSellProductResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-md border">
                  {quickSellProductResults.map((product) => {
                    const available = Number(product.quantity) || 0;
                    const outOfStock = available <= 0;
                    const productId = String(product._id);
                    const isAdding = quickSellAddingProductIds.has(productId);
                    return (
                      <button
                        key={product._id}
                        type="button"
                        className="flex w-full items-center justify-between gap-3 border-b px-3 py-3 text-left text-sm last:border-b-0 hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={outOfStock || isAdding}
                        onClick={() => void handleQuickSellProductPick(product)}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{product.name}</span>
                          <span className="block truncate text-muted-foreground">
                            {product.sku || '-'} | {formatCurrency(getDiscountedUnitPrice(product, selectedQuickSellPricingTier))}
                          </span>
                        </span>
                        {isAdding ? (
                          <span className="text-muted-foreground">
                            {t('common.loading', 'Loading...')}
                          </span>
                        ) : (
                          <span className={outOfStock ? 'text-destructive' : 'text-muted-foreground'}>
                            {t('ecommerce.available', 'Available')}: {formatQuantityWithUnit(available, getResolvedMeasurementType(product.measurementType))}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {quickSellCart.length === 0 ? (
              <div className="rounded-lg border bg-card/30 p-6 text-center text-sm text-muted-foreground">
                {t('ecommerce.cartEmpty', 'No scanned items yet')}
              </div>
            ) : (
              <div className="rounded-lg border bg-card/30 p-4 space-y-3 max-h-80 overflow-y-auto pr-1">
                {quickSellCart.map((item) => {
                  const selectedVariant = item.variants.find(
                    (variant) => String(variant._id) === item.variantId
                  );
                  const maxAllowedQuantity = Math.min(
                    item.availableQuantity,
                    selectedVariant ? Number(selectedVariant.quantity) || 0 : item.availableQuantity
                  );
                  const minAllowedQuantity = Math.min(
                    maxAllowedQuantity,
                    getMeasurementOption(item.measurementType).minPositive
                  );

                  return (
                    <div
                      key={item.productId}
                      className="border rounded-md bg-card/20 p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="flex-1 min-w-0 space-y-2">
                        <div>
                          <p className="font-medium truncate">{item.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.sku || '-'} - {t('ecommerce.available', 'Available')}:{' '}
                            {formatQuantityWithUnit(maxAllowedQuantity, item.measurementType)}
                          </p>
                        </div>
                        {supportsVariantProducts && item.variants.length > 0 && (
                          <div className="space-y-2">
                            <Label>{t('ecommerce.variant', 'Variant')}</Label>
                            <Select
                              value={item.variantId || undefined}
                              onValueChange={(value) => updateQuickSellCartVariant(item.productId, value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={t('ecommerce.selectVariant', 'Select variant')} />
                              </SelectTrigger>
                              <SelectContent>
                                {item.variants.map((variant) => (
                                  <SelectItem key={variant._id} value={String(variant._id)}>
                                    {variant.variantSku} | {variant.size || '-'} | {variant.color || '-'} |{' '}
                                    {t('ecommerce.qtyShort', 'Qty')} {variant.quantity}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                      <div className="w-full sm:w-32 space-y-2">
                        <Label>
                          {t('ecommerce.quantity', 'Quantity')}
                          {!isCountMeasurementType(item.measurementType)
                            ? ` (${getMeasurementOption(item.measurementType).unitLabel})`
                            : ''}
                        </Label>
                        <Input
                          type="number"
                          min={minAllowedQuantity}
                          step={getMeasurementOption(item.measurementType).step}
                          max={maxAllowedQuantity}
                          value={item.quantity}
                          onChange={(e) =>
                            updateQuickSellCartQuantity(
                              item.productId,
                              Number(e.target.value) || getMeasurementOption(item.measurementType).minPositive
                            )
                          }
                        />
                      </div>
                      <div className="w-full sm:w-44 space-y-2">
                        <Label>{t('inventory.price', 'Price')}</Label>
                        <Input
                          type="number"
                          min={item.minimumUnitPrice ?? 0}
                          step={isDzdCurrency ? '1' : '0.01'}
                          value={item.unitPrice}
                          onKeyDown={blockNonIntegerPriceKeys}
                          onPaste={blockNonIntegerPricePaste}
                          onChange={(e) => {
                            const parsedValue = parseCurrencyInput(e.target.value);
                            if (parsedValue === null) return;
                            updateQuickSellCartPrice(item.productId, parsedValue);
                          }}
                        />
                        {item.minimumUnitPrice !== null && item.minimumUnitPrice > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Min: {formatCurrency(item.minimumUnitPrice)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-end justify-between sm:justify-end sm:w-44">
                        <div className="text-sm">
                          <p className="text-muted-foreground">{t('ecommerce.total', 'Total')}</p>
                          <p className="font-semibold">
                            {formatCurrency(item.quantity * item.unitPrice)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeQuickSellCartItem(item.productId)}
                          aria-label={t('ecommerce.removeItem', 'Remove item')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <section className="space-y-4 rounded-lg border bg-card/30 p-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t('clients.savedClients', 'Saved Clients')}</Label>
                  <Select
                    value={selectedQuickSellClientKey}
                    onValueChange={handleQuickSellClientSelection}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('clients.selectClient', 'Select a saved client')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={MANUAL_CLIENT_SELECT_VALUE}>
                        {t('clients.manualEntry', 'Type manually')}
                      </SelectItem>
                      {selectableClients.map((client) => (
                        <SelectItem key={`quick-modal-client-${client.clientKey}`} value={client.clientKey}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Label>
                    {isEcommerceBusiness
                      ? t('ecommerce.customerNameLabel', 'Customer name *')
                      : t('ecommerce.buyerName', 'Buyer name (optional)')}
                  </Label>
                  <Input
                    value={quickSellBuyerName}
                    onChange={(e) => {
                      const nextName = e.target.value;
                      setQuickSellBuyerName(nextName);
                      const matchedClient = findSavedClientByName(nextName);
                      setSelectedQuickSellClientKey(
                        matchedClient?.clientKey || MANUAL_CLIENT_SELECT_VALUE
                      );
                      if (quickSellError) setQuickSellError('');
                    }}
                    placeholder={
                      isEcommerceBusiness
                        ? t('ecommerce.customerNamePlaceholder', 'Enter customer name')
                        : t('ecommerce.buyerNamePlaceholder', 'Enter buyer name')
                    }
                    required={isEcommerceBusiness}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('ecommerce.orderType', 'Order Type')}</Label>
                  <Select
                    value={effectiveQuickSellOrderType}
                    onValueChange={(value) => {
                      setQuickSellOrderType(value as OrderType);
                      setQuickSellError('');
                    }}
                    disabled={isEcommerceBusiness || isSupermarketBusiness}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="walk_in">{t('ecommerce.walkInOrder', 'Walk-in order')}</SelectItem>
                      <SelectItem value="shipped">{t('ecommerce.shippedOrder', 'Shipped order')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {isEcommerceBusiness && (
                <p className="text-sm text-muted-foreground">
                  {t('ecommerce.ecommerceShippedOnly', 'E-commerce niche uses shipped orders only.')}
                </p>
              )}
            </section>

            {effectiveQuickSellOrderType === 'shipped' && (
              <section className="space-y-4 rounded-lg border bg-card/30 p-6">
                <p className="text-sm font-medium">
                  {t('ecommerce.shippingInformation', 'Shipping Information')}
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('ecommerce.phone', 'Phone')}</Label>
                    <Input
                      value={quickSellShipping.phone}
                      onChange={(e) =>
                        setQuickSellShipping((prev) => ({ ...prev, phone: e.target.value }))
                      }
                      placeholder={t('ecommerce.phonePlaceholder', 'Recipient phone')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('ecommerce.deliveryType', 'Delivery Type')}</Label>
                    <Select
                      value={quickSellShipping.mode}
                      onValueChange={(value) =>
                        setQuickSellShipping((prev) => ({
                          ...prev,
                          mode: value === 'stopdesk' ? 'stopdesk' : 'domestic',
                          ...(value === 'stopdesk' ? { street: '' } : {}),
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="domestic">{t('ecommerce.domestic', 'Domestic')}</SelectItem>
                        <SelectItem value="stopdesk">{t('ecommerce.stopdesk', 'Stop Desk')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('ecommerce.carrier', 'Carrier')}</Label>
                    <Select
                      value={quickSellShipping.carrier}
                      onValueChange={(value) =>
                        setQuickSellShipping((prev) => ({
                          ...prev,
                          carrier: value as ShippingFormState['carrier'],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SHIPPING_CARRIER_OPTIONS.map((carrierOption) => (
                          <SelectItem key={carrierOption.value} value={carrierOption.value}>
                            {carrierOption.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {quickSellShipping.mode === 'domestic' && (
                    <div className="sm:col-span-2 space-y-2">
                      <Label>{t('ecommerce.streetAddress', 'Street Address')}</Label>
                      <Input
                        value={quickSellShipping.street}
                        onChange={(e) =>
                          setQuickSellShipping((prev) => ({ ...prev, street: e.target.value }))
                        }
                        placeholder={t('ecommerce.streetAddressPlaceholder', 'Street and number')}
                        required={effectiveQuickSellOrderType === 'shipped'}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>{t('ecommerce.wilaya', 'Wilaya')}</Label>
                    <Select
                      value={quickSellShipping.wilaya}
                      onValueChange={(value) =>
                        setQuickSellShipping((prev) => ({
                          ...prev,
                          wilaya: value,
                          daira: '',
                          commune: '',
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('ecommerce.wilayaPlaceholder', 'Select wilaya')} />
                      </SelectTrigger>
                      <SelectContent>
                        {ALGERIA_WILAYA_OPTIONS.map((wilaya) => (
                          <SelectItem key={wilaya.code} value={wilaya.name}>
                            {wilaya.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('ecommerce.daira', 'Daira')}</Label>
                    <Select
                      value={quickSellShipping.daira}
                      onValueChange={(value) =>
                        setQuickSellShipping((prev) => ({
                          ...prev,
                          daira: value,
                          commune: '',
                        }))
                      }
                      disabled={!quickSellShipping.wilaya}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t(
                            'ecommerce.dairaPlaceholder',
                            quickSellShipping.wilaya ? 'Select daira' : 'Select wilaya first'
                          )}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {quickSellDairaOptions.map((daira) => (
                          <SelectItem key={daira} value={daira}>
                            {daira}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('ecommerce.commune', 'Commune')}</Label>
                    <Select
                      value={quickSellShipping.commune}
                      onValueChange={(value) =>
                        setQuickSellShipping((prev) => ({ ...prev, commune: value }))
                      }
                      disabled={!quickSellShipping.daira}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t(
                            'ecommerce.communePlaceholder',
                            quickSellShipping.daira ? 'Select commune' : 'Select daira first'
                          )}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {quickSellCommuneOptions.map((commune) => (
                          <SelectItem key={commune} value={commune}>
                            {commune}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('ecommerce.trackingNumber', 'Tracking #')}</Label>
                    <Input
                      value={quickSellShipping.trackingNumber}
                      onChange={(e) =>
                        setQuickSellShipping((prev) => ({
                          ...prev,
                          trackingNumber: e.target.value,
                        }))
                      }
                      placeholder={t('ecommerce.trackingPlaceholder', 'Optional tracking number')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('ecommerce.shippingFee', 'Shipping Fee')}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={quickSellShipping.shippingCost}
                      onChange={(e) =>
                        setQuickSellShipping((prev) => ({
                          ...prev,
                          shippingCost: e.target.value,
                        }))
                      }
                      required={effectiveQuickSellOrderType === 'shipped'}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('ecommerce.notes', 'Notes')}</Label>
                  <Input
                    value={quickSellShipping.notes}
                    onChange={(e) =>
                      setQuickSellShipping((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    placeholder={t('ecommerce.shippingNotesPlaceholder', 'Shipping notes (optional)')}
                  />
                </div>
              </section>
            )}
            <div className="rounded-lg border bg-muted/60 p-6">
              <div className="flex items-center justify-between text-lg font-semibold">
                <span>{t('ecommerce.total', 'Total')}</span>
                <span className="tabular-nums">{formatCurrency(quickSellGrandTotal)}</span>
              </div>
            </div>
          </div>
          <DialogFooter className="sm:justify-between gap-2 border-t pt-6">
            <Button
              variant="outline"
              onClick={() => {
                setIsQuickSellModalOpen(false);
                setIsScannerOpen(true);
              }}
            >
              <ScanLine className="w-4 h-4 mr-2" />
              {t('ecommerce.scanMore', 'Scan More')}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsQuickSellModalOpen(false);
                  resetQuickSell();
                }}
                disabled={isCreatingQuickSellOrder}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                onClick={handleQuickSell}
                disabled={quickSellCart.length === 0 || isCreatingQuickSellOrder}
                aria-busy={isCreatingQuickSellOrder}
              >
                {isCreatingQuickSellOrder
                  ? t('common.loading', 'Loading...')
                  : t('ecommerce.confirmSale', 'Confirm Sale')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Sale Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('ecommerce.editOrder', 'Edit Order')}</DialogTitle>
            <DialogDescription>
              {selectedSale?.orderNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('ecommerce.orderStatus', 'Order Status')}</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/80 bg-popover p-1.5 shadow-xl">
                  {saleStatusOptions.map((statusOption) => (
                    <SelectItem
                      key={statusOption}
                      value={statusOption}
                      className={`mb-1 rounded-lg border ${statusOptionStyles[statusOption] || 'border-slate-200 bg-slate-50 text-slate-800'} last:mb-0`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${statusColors[statusOption] || 'bg-slate-500'}`}
                        />
                        {t(`status.${statusOption}`, statusOption)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('ecommerce.paymentStatus', 'Payment Status')}</Label>
              <Select value={editPaymentStatus} onValueChange={setEditPaymentStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/80 bg-popover p-1.5 shadow-xl">
                  {paymentStatusOptions.map((paymentOption) => (
                    <SelectItem
                      key={paymentOption}
                      value={paymentOption}
                      className={`mb-1 rounded-lg border ${paymentOptionStyles[paymentOption] || 'border-slate-200 bg-slate-50 text-slate-800'} last:mb-0`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${paymentStatusColors[paymentOption] || 'bg-slate-500'}`}
                        />
                        {t(`payment.${paymentOption}`, paymentOption)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleUpdateSale}>
              {t('common.save', 'Save Changes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Sale Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">{t('ecommerce.deleteOrder', 'Delete Order?')}</DialogTitle>
            <DialogDescription>
              {t('ecommerce.deleteOrderDesc', 'Are you sure you want to delete this order? This action cannot be undone.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteSale}>
              <Trash2 className="w-4 h-4 mr-2" />
              {t('ecommerce.delete', 'Delete Order')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Modal */}
      <Dialog open={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('ecommerce.receipt', 'Receipt')}</DialogTitle>
            <DialogDescription className="sr-only">
              {t('ecommerce.receiptDesc', 'Receipt preview for the selected order.')}
            </DialogDescription>
          </DialogHeader>
          {selectedSale && (
            <div className="print:p-0" id="receipt">
              {(() => {
                const shippingAddress = [
                  selectedSale.shipping?.mode === 'stopdesk'
                    ? ''
                    : selectedSale.customer?.address?.street,
                  selectedSale.customer?.address?.city,
                ]
                  .filter(Boolean)
                  .join(', ');
                const shippingCarrier = formatShippingCarrier(selectedSale.shipping?.carrier);
                const hasShippingDetails = Boolean(
                  shippingAddress ||
                    selectedSale.customer?.phone ||
                    selectedSale.shipping?.trackingNumber ||
                    selectedSale.shipping?.shippingDate ||
                    selectedSale.shipping?.deliveryDate ||
                    (selectedSale.shippingCost ?? 0) > 0 ||
                    (shippingCarrier && selectedSale.shipping?.carrier !== 'local')
                );

                return (
                  <>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold">Stockly</h2>
                <p className="text-muted-foreground">{t('ecommerce.receipt', 'Sales Receipt')}</p>
              </div>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('ecommerce.orderNumber', 'Order #')}</span>
                  <span className="font-mono">{selectedSale.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('ecommerce.date', 'Date')}</span>
                  <span>{formatDate(selectedSale.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('ecommerce.customer', 'Customer')}</span>
                  <span>{formatCustomerName(selectedSale)}</span>
                </div>
              </div>

              {hasShippingDetails && (
                <div className="rounded-md border p-3 mb-4 space-y-1.5">
                  <p className="text-sm font-semibold">
                    {t('ecommerce.shippingInformation', 'Shipping Information')}
                  </p>
                  {shippingAddress && (
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">{t('ecommerce.address', 'Address')}</span>
                      <span className="text-right">{shippingAddress}</span>
                    </div>
                  )}
                  {selectedSale.customer?.phone && (
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">{t('ecommerce.phone', 'Phone')}</span>
                      <span>{selectedSale.customer.phone}</span>
                    </div>
                  )}
                  {selectedSale.shipping?.trackingNumber && (
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">
                        {t('ecommerce.trackingNumber', 'Tracking #')}
                      </span>
                      <span className="font-mono">{selectedSale.shipping.trackingNumber}</span>
                    </div>
                  )}
                  {shippingCarrier && selectedSale.shipping?.carrier !== 'local' && (
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">{t('ecommerce.carrier', 'Carrier')}</span>
                      <span>{shippingCarrier}</span>
                    </div>
                  )}
                  {selectedSale.shipping?.shippingDate && (
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">{t('ecommerce.shippedDate', 'Shipped Date')}</span>
                      <span>{formatDate(selectedSale.shipping.shippingDate)}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-b py-4 mb-4">
                {selectedSale.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-1">
                    <span>
                      {item.name}
                      {(item.variantSku || item.variantSize || item.variantColor) && (
                        <span className="text-xs text-muted-foreground">
                          {' '}({[item.variantSku, item.variantSize, item.variantColor]
                            .filter(Boolean)
                            .join(' | ')})
                        </span>
                      )}{' '}
                      x {item.quantity}
                    </span>
                    <span>{formatCurrency(item.totalPrice)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('ecommerce.subtotal', 'Subtotal')}</span>
                  <span>{formatCurrency(selectedSale.subtotal)}</span>
                </div>
                {selectedSale.tax > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('ecommerce.tax', 'Tax')}</span>
                    <span>{formatCurrency(selectedSale.tax)}</span>
                  </div>
                )}
                {selectedSale.discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('ecommerce.discount', 'Discount')}</span>
                    <span className="text-green-600">-{formatCurrency(selectedSale.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold pt-2 border-t">
                  <span>{t('ecommerce.total', 'Total')}</span>
                  <span>{formatCurrency(selectedSale.total)}</span>
                </div>
              </div>

              <div className="text-center mt-8 text-muted-foreground text-sm">
                <p>{t('ecommerce.thankYou', 'Thank you for your business!')}</p>
              </div>
                  </>
                );
              })()}
            </div>
          )}
          <DialogFooter className="print:hidden">
            <Button variant="outline" onClick={() => setIsReceiptModalOpen(false)}>
              {t('common.close', 'Close')}
            </Button>
            <Button onClick={handlePrintReceipt}>
              <Printer className="w-4 h-4 mr-2" />
              {t('ecommerce.print', 'Print')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EcommercePage;
