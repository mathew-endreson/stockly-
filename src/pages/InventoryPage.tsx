import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Boxes,
  MoreHorizontal,
  Edit,
  Trash2,
  Barcode,
  Package,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  ShoppingCart,
  Upload,
  X,
  Image as ImageIcon,
  Download,
  FileUp,
  ScanLine,
  Info,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import BarcodeScanner from '@/components/BarcodeScanner';
import StockTransferDialog from '@/components/StockTransferDialog';
import { businessAPI, clientsAPI, productsAPI, salesAPI } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import type { ClientRecord, ClothingVariant, Product, ProductMeasurementType, ShippingCarrier } from '@/types';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useKeyboardBarcodeScanner } from '@/hooks/useKeyboardBarcodeScanner';
import {
  getNormalizedProductPrices,
  getPriceForTier,
  isWholesaleBusinessType,
  PRICING_TIERS,
  PRICING_TIER_LABELS,
} from '@/lib/pricing';
import {
  PRODUCT_MEASUREMENT_OPTIONS,
  formatQuantityWithUnit,
  getDefaultMinQuantityForMeasurement,
  getMeasurementOption,
  isCountMeasurementType,
  normalizeProductMeasurementType
} from '@/constants/productMeasurements';
import { ALGERIA_WILAYA_OPTIONS } from '@/constants/algeriaWilayas';
import {
  getCommunesByWilayaAndDaira,
  getDairasByWilaya
} from '@/constants/algeriaAdmin';
import { SHIPPING_CARRIER_OPTIONS } from '@/constants/shippingCarriers';
import {
  mapHeadersToCanonical,
  normalizeHeaders,
  normalizeRowToProduct,
  isRowEmpty,
  type ImportRowIssue,
  type NormalizedProduct,
} from '@/lib/csvImport';
import {
  parseTabularImportFile,
  downloadTabularRows,
  type TabularFormat
} from '@/lib/tabularFiles';

type BulkSaleItem = {
  productId: string;
  name: string;
  sku: string;
  measurementType: ProductMeasurementType;
  availableQuantity: number;
  variants: ClothingVariant[];
  variantId?: string;
  quantity: number;
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

type VariantDraftRow = {
  key: string;
  variantId?: string;
  variantSku?: string;
  size: string;
  barcode: string;
  quantity: number;
  priceAdjustment: number;
};

type VariantDraftGroup = {
  key: string;
  color: string;
  // E-commerce businesses might not use sizes. In that case we allow a single "color-only" variant.
  colorOnlyRow?: VariantDraftRow | null;
  rows: VariantDraftRow[];
};

type FlattenedVariantDraft = VariantDraftRow & {
  color: string;
};

const COMMON_VARIANT_COLORS = [
  'Black',
  'White',
  'Gray',
  'Silver',
  'Navy',
  'Blue',
  'Sky Blue',
  'Teal',
  'Green',
  'Olive',
  'Yellow',
  'Mustard',
  'Orange',
  'Red',
  'Burgundy',
  'Pink',
  'Purple',
  'Brown',
  'Beige',
  'Cream',
  'Gold',
  'Maroon',
  'Khaki'
];

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

const HIGHLIGHT_ROW_CLASS_BY_PRIORITY: Record<HighlightPriority, string> = {
  high: 'bg-red-50 dark:bg-red-950/30 shadow-[inset_0_0_0_2px_rgb(239_68_68)] hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors duration-200',
  medium:
    'bg-orange-50 dark:bg-orange-950/30 shadow-[inset_0_0_0_2px_rgb(249_115_22)] hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors duration-200',
  low: 'bg-green-50 dark:bg-green-950/30 shadow-[inset_0_0_0_2px_rgb(34_197_94)] hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors duration-200',
};

const getResolvedMeasurementType = (
  value: ProductMeasurementType | string | null | undefined
): ProductMeasurementType => normalizeProductMeasurementType(value);

const isSingleUnitCountInStock = (
  product: Pick<Product, 'measurementType' | 'quantity' | 'salesCount'>
) => {
  const measurementType = getResolvedMeasurementType(product.measurementType);
  return (
    isCountMeasurementType(measurementType) &&
    Number(product.quantity) === 1 &&
    Number(product.salesCount) === 0
  );
};

const isLowStockProduct = (
  product: Pick<Product, 'measurementType' | 'quantity' | 'minQuantity' | 'salesCount'>
) => {
  const quantity = Number(product.quantity) || 0;
  const minQuantity = Number(product.minQuantity) || 0;
  if (quantity <= 0) return false;
  if (isSingleUnitCountInStock(product)) return false;
  return quantity <= minQuantity;
};

const isSoldOutCountProduct = (
  product: Pick<Product, 'measurementType' | 'quantity' | 'salesCount'>
) => {
  const measurementType = getResolvedMeasurementType(product.measurementType);
  return (
    isCountMeasurementType(measurementType) &&
    Number(product.quantity) <= 0 &&
    Number(product.salesCount) === 1
  );
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

const toDateInputValue = (value?: string | null) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

const formatDateLabel = (value?: string | null) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString();
};

const createDraftKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeVariantToken = (value: string) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const buildFallbackVariantSku = ({
  productSku,
  productName,
  color,
  size,
  index,
}: {
  productSku: string;
  productName: string;
  color: string;
  size: string;
  index: number;
}) => {
  const base = normalizeVariantToken(productSku) || normalizeVariantToken(productName) || 'VARIANT';
  const colorToken = normalizeVariantToken(color) || 'COLOR';
  const sizeToken = normalizeVariantToken(size) || `SIZE-${index + 1}`;
  return `${base}-${colorToken}-${sizeToken}`.slice(0, 80);
};

const ensureUniqueVariantSku = (candidate: string, usedSkus: Set<string>) => {
  const normalizedBase = normalizeVariantToken(candidate) || 'VARIANT';
  let normalized = normalizedBase;
  let suffix = 2;
  while (usedSkus.has(normalized)) {
    normalized = `${normalizedBase}-${suffix}`;
    suffix += 1;
  }
  usedSkus.add(normalized);
  return normalized;
};

const generateRandomBarcodeCandidate = (length = 13) => {
  const safeLength = Math.max(8, length);
  const randomDigits = new Uint32Array(safeLength);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(randomDigits);
  } else {
    for (let index = 0; index < safeLength; index += 1) {
      randomDigits[index] = Math.floor(Math.random() * 10);
    }
  }

  return Array.from(randomDigits, (value) => String(value % 10)).join('');
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

const InventoryPage: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const withArabicFallback = (englishText: string, arabicText: string) =>
    isRTL ? arabicText : englishText;
  const getMeasurementTypeLabel = (measurementType: ProductMeasurementType) => {
    if (measurementType === 'kg') {
      return t('inventory.measurementTypeKg', withArabicFallback('Weight (kg)', 'الوزن (كغ)'));
    }
    if (measurementType === 'meter') {
      return t('inventory.measurementTypeMeter', withArabicFallback('Length (meters)', 'الطول (متر)'));
    }
    return t('inventory.measurementTypeCount', withArabicFallback('Count (numbers)', 'عدد (بالقطع)'));
  };
  const { user, canEdit, canManageSales, canViewProductCost, updateOnboarding, accessibleStocks, currentStockId } = useAuth();
  const canSeeProductCost = canViewProductCost();
  const isStandardBusiness = user?.businessType === 'standard';
  const isEcommerceBusiness = user?.businessType === 'ecommerce';
  const isClothingRetailBusiness = user?.businessType === 'clothing_retail';
  const isSupermarketBusiness = user?.businessType === 'supermarket';
  const isWholesaleBusiness = isWholesaleBusinessType(user?.businessType);
  const supportsExpirationDate = isStandardBusiness || isEcommerceBusiness || isSupermarketBusiness;
  const supportsVariantProducts = isClothingRetailBusiness || isEcommerceBusiness;
  const canManageSalesAccess = canManageSales();
  const ownedBranchStocks = (accessibleStocks || []).filter(
    (s) => s.isOwnedStock && s.stockId !== currentStockId
  );
  const canTransferStock = canManageSalesAccess && ownedBranchStocks.length > 0;
  const { formatCurrency, currency } = useCurrencyFormatter();
  const isDzdCurrency = currency === 'DZD';
  const [searchParams, setSearchParams] = useSearchParams();

  const notifyAnalyticsRefresh = () => {
    window.dispatchEvent(new CustomEvent('stockly:analytics-refresh'));
  };
  const notifyActivity = (detail: { id: string; title: string; description: string; badge?: string }) => {
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

  const parseOptionalCurrencyInput = (rawValue: string): number | null | undefined => {
    const normalized = String(rawValue || '').trim();
    if (!normalized) return null;
    if (isDzdCurrency && /[.,]/.test(normalized)) return undefined;
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) return undefined;
    if (isDzdCurrency && !Number.isInteger(parsed)) return undefined;
    return parsed;
  };
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [highlightProductIds, setHighlightProductIds] = useState<string[]>([]);
  const [didAutoScrollToHighlight, setDidAutoScrollToHighlight] = useState(false);
  const [highlightPriority, setHighlightPriority] = useState<HighlightPriority>('medium');
  const [highlightSellingAtLoss, setHighlightSellingAtLoss] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    pages: 0,
  });
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importRows, setImportRows] = useState<string[][]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [isImportingProducts, setIsImportingProducts] = useState(false);
  const [isExportingProducts, setIsExportingProducts] = useState(false);
  const [importResults, setImportResults] = useState<{
    totalRows: number;
    created: number;
    updated: number;
    imported: number;
    skipped: ImportRowIssue[];
    unmappedHeaders: { header: string; reason: string }[];
    errors: { sku: string; error: string }[];
  } | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkSaleModalOpen, setIsBulkSaleModalOpen] = useState(false);
  const [bulkSaleItems, setBulkSaleItems] = useState<BulkSaleItem[]>([]);
  const [bulkSaleCustomerName, setBulkSaleCustomerName] = useState('');
  const [selectedBulkClientKey, setSelectedBulkClientKey] = useState(MANUAL_CLIENT_SELECT_VALUE);
  const [bulkSaleError, setBulkSaleError] = useState('');
  const [bulkSaleOrderType, setBulkSaleOrderType] = useState<OrderType>(
    isEcommerceBusiness ? 'shipped' : 'walk_in'
  );
  const [bulkSaleShipping, setBulkSaleShipping] = useState<ShippingFormState>(
    createInitialShippingForm()
  );

  // Modal states
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isProductDetailsOpen, setIsProductDetailsOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isScanResultOpen, setIsScanResultOpen] = useState(false);
  const [transferProduct, setTransferProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProductVariants, setSelectedProductVariants] = useState<ClothingVariant[]>([]);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [sellingProduct, setSellingProduct] = useState<Product | null>(null);
  const [saleVariants, setSaleVariants] = useState<ClothingVariant[]>([]);
  const [selectedSaleVariantId, setSelectedSaleVariantId] = useState('');
  const [savedClients, setSavedClients] = useState<ClientRecord[]>([]);
  const [selectedSaleClientKey, setSelectedSaleClientKey] = useState(MANUAL_CLIENT_SELECT_VALUE);
  const [saleFormError, setSaleFormError] = useState('');
  const [isRecordingQuickSale, setIsRecordingQuickSale] = useState(false);
  const [productFormError, setProductFormError] = useState('');
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isGeneratingBarcode, setIsGeneratingBarcode] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [scanTarget, setScanTarget] = useState<'inventory' | 'productForm'>('inventory');
  const [scanResult, setScanResult] = useState<{ barcode: string; product: Product | null } | null>(null);
  const [resumeProductModal, setResumeProductModal] = useState(false);
  const [variantGroups, setVariantGroups] = useState<VariantDraftGroup[]>([]);
  const [removedVariantIds, setRemovedVariantIds] = useState<string[]>([]);
  const [isVariantPanelOpen, setIsVariantPanelOpen] = useState(false);
  const [isVariantEditorLoading, setIsVariantEditorLoading] = useState(false);
  const [savedVariantSizes, setSavedVariantSizes] = useState<string[]>([]);
  const [savedVariantColors, setSavedVariantColors] = useState<string[]>(COMMON_VARIANT_COLORS);
  const [variantsByProductId, setVariantsByProductId] = useState<Record<string, ClothingVariant[]>>({});
  const [expandedVariantProductIds, setExpandedVariantProductIds] = useState<string[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    measurementType: 'count' as ProductMeasurementType,
    category: '',
    description: '',
    quantity: 0,
    minQuantity: 1,
    price: 0,
    prices: { default: 0, bronze: 0, silver: 0, gold: 0 },
    secondPrice: null as number | null,
    soldDiscountPercent: 0,
    expirationDate: '',
    cost: 0,
    images: [] as { url: string; alt: string; isPrimary?: boolean }[],
  });

  // Sale form state
  const [saleForm, setSaleForm] = useState({
    quantity: 1,
    unitPrice: 0,
    customerName: '',
  });
  const [saleOrderType, setSaleOrderType] = useState<OrderType>(
    isEcommerceBusiness ? 'shipped' : 'walk_in'
  );
  const [saleShipping, setSaleShipping] = useState<ShippingFormState>(createInitialShippingForm());
  const selectableClients = savedClients.filter((client) => String(client?.name || '').trim() !== '');

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

  const handleSaleClientSelection = (value: string) => {
    setSelectedSaleClientKey(value);
    if (value === MANUAL_CLIENT_SELECT_VALUE) return;
    const selectedClient = selectableClients.find((client) => client.clientKey === value);
    if (!selectedClient) return;
    setSaleForm((prev) => ({
      ...prev,
      customerName: selectedClient.name || prev.customerName,
      ...(sellingProduct
        ? { unitPrice: getDiscountedUnitPrice(sellingProduct, selectedClient.pricingTier) }
        : {})
    }));
    setSaleShipping((prev) => ({
      ...prev,
      phone: prev.phone || selectedClient.phone || ''
    }));
  };

  const handleBulkClientSelection = (value: string) => {
    setSelectedBulkClientKey(value);
    if (value === MANUAL_CLIENT_SELECT_VALUE) return;
    const selectedClient = selectableClients.find((client) => client.clientKey === value);
    if (!selectedClient) return;
    setBulkSaleCustomerName(selectedClient.name || '');
    setBulkSaleItems((prev) =>
      prev.map((item) => {
        const product = products.find((entry) => entry._id === item.productId);
        if (!product) return item;
        return {
          ...item,
          unitPrice: getDiscountedUnitPrice(product, selectedClient.pricingTier)
        };
      })
    );
    setBulkSaleShipping((prev) => ({
      ...prev,
      phone: prev.phone || selectedClient.phone || ''
    }));
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [pagination.page, search, categoryFilter, stockFilter, highlightProductIds]);

  useEffect(() => {
    const handleOfflineSyncComplete = () => {
      fetchProducts();
      fetchCategories();
    };
    window.addEventListener('stockly:offline-sync-complete', handleOfflineSyncComplete);
    return () => {
      window.removeEventListener('stockly:offline-sync-complete', handleOfflineSyncComplete);
    };
  }, [pagination.page, search, categoryFilter, stockFilter, highlightProductIds]);

  useEffect(() => {
    if (!canManageSalesAccess) {
      setSavedClients([]);
      return;
    }
    void loadSavedClients();
  }, [canManageSalesAccess, loadSavedClients]);

  useEffect(() => {
    setSelectedProductIds([]);
  }, [pagination.page, search, categoryFilter, stockFilter]);

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'add') {
      openProductModal();
      searchParams.delete('action');
      setSearchParams(searchParams);
    }
  }, [searchParams]);

  useEffect(() => {
    const multiIdsParam = searchParams.get('highlightProductIds');
    const singleIdParam = searchParams.get('highlightProductId');
    const highlightLossParam = searchParams.get('highlightSellingAtLoss');
    const highlightPriorityParam = searchParams.get('highlightPriority');

    const parsedIds = multiIdsParam
      ? multiIdsParam.split(',').map((id) => id.trim())
      : singleIdParam
        ? [singleIdParam.trim()]
        : [];

    const uniqueIds = Array.from(new Set(parsedIds.filter(Boolean)));
    setHighlightProductIds(uniqueIds);
    setDidAutoScrollToHighlight(false);
    setHighlightSellingAtLoss(highlightLossParam === '1');
    setHighlightPriority(
      highlightPriorityParam === 'high' || highlightPriorityParam === 'low'
        ? highlightPriorityParam
        : 'medium'
      );
  }, [searchParams]);

  useEffect(() => {
    setSaleOrderType(isEcommerceBusiness ? 'shipped' : 'walk_in');
    setBulkSaleOrderType(isEcommerceBusiness ? 'shipped' : 'walk_in');
  }, [isEcommerceBusiness, isSupermarketBusiness]);

  useEffect(() => {
    if (!isClothingRetailBusiness) return;
    setFormData((prev) => {
      if (prev.measurementType === 'count') return prev;
      return {
        ...prev,
        measurementType: 'count',
        quantity: Math.round(prev.quantity),
        minQuantity: Math.round(prev.minQuantity),
      };
    });
  }, [isClothingRetailBusiness]);

  useEffect(() => {
    if (!supportsVariantProducts) {
      setVariantsByProductId({});
      setSavedVariantSizes([]);
      setSavedVariantColors(COMMON_VARIANT_COLORS);
      setExpandedVariantProductIds([]);
      return;
    }
    void refreshClothingVariantRegistry();
  }, [supportsVariantProducts]);

  useEffect(() => {
    const visibleProductIds = new Set(products.map((product) => String(product._id)));
    setExpandedVariantProductIds((prev) => prev.filter((id) => visibleProductIds.has(id)));
  }, [products]);

  const { connection: hardwareScannerConnection } = useKeyboardBarcodeScanner({
    enabled: !isScannerOpen,
    captureInEditableTargets: true,
    requireScannerLikeTiming: true,
    onScan: async (rawBarcode) => {
      const barcode = rawBarcode.trim();
      if (!barcode) return;

      // If product modal is open, scanner input should populate barcode field directly.
      if (isProductModalOpen) {
        setFormData((prev) => ({ ...prev, barcode }));
        setProductFormError('');
        return;
      }

      try {
        const response = await productsAPI.getProductByBarcode(barcode);
        const product = (response.data?.product || null) as Product | null;
        setScanTarget('inventory');
        setScanResult({ barcode, product });
        setIsScanResultOpen(true);

        if (product) {
          updateOnboarding({ scannedFirstBarcode: true });
        }
      } catch {
        setScanTarget('inventory');
        setScanResult({ barcode, product: null });
        setIsScanResultOpen(true);
      }
    },
    onInvalidScan: (rawValue) => {
      if (isProductModalOpen) {
        const trimmed = rawValue.trim();
        if (trimmed) {
          setFormData((prev) => ({ ...prev, barcode: trimmed }));
        }
        return;
      }
      setScanTarget('inventory');
      setScanResult({ barcode: rawValue, product: null });
      setIsScanResultOpen(true);
    },
    minLength: 6,
  });

  useEffect(() => {
    if (!highlightProductIds.length || loading || didAutoScrollToHighlight) return;
    const firstVisibleHighlightedId = highlightProductIds.find((id) =>
      Boolean(document.getElementById(`product-row-${id}`))
    );
    if (!firstVisibleHighlightedId) return;

    const row = document.getElementById(`product-row-${firstVisibleHighlightedId}`);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setDidAutoScrollToHighlight(true);
    }
  }, [products, loading, highlightProductIds, didAutoScrollToHighlight]);

  const mergeSavedVariantSizes = (
    nextSource: Array<string | undefined | null>,
    previous: string[] = savedVariantSizes
  ) => {
    const mergedMap = new Map<string, string>();
    [...previous, ...nextSource]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .forEach((value) => {
        const key = value.toLowerCase();
        if (!mergedMap.has(key)) {
          mergedMap.set(key, value);
        }
      });
    return Array.from(mergedMap.values()).sort((a, b) => a.localeCompare(b));
  };

  const mergeSavedVariantColors = (
    nextSource: Array<string | undefined | null>,
    previous: string[] = savedVariantColors
  ) => {
    const mergedMap = new Map<string, string>();
    [...COMMON_VARIANT_COLORS, ...previous, ...nextSource]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .forEach((value) => {
        const key = value.toLowerCase();
        if (!mergedMap.has(key)) {
          mergedMap.set(key, value);
        }
      });
    return Array.from(mergedMap.values()).sort((a, b) => a.localeCompare(b));
  };

  async function refreshClothingVariantRegistry() {
    if (!supportsVariantProducts) {
      setVariantsByProductId({});
      setSavedVariantSizes([]);
      setSavedVariantColors(COMMON_VARIANT_COLORS);
      return;
    }

    try {
      const response = await businessAPI.getClothingVariants();
      const variants = response.data.variants || [];
      const byProduct: Record<string, ClothingVariant[]> = {};

      variants.forEach((variant) => {
        const productId = getVariantProductId(variant);
        if (!productId) return;
        if (!byProduct[productId]) byProduct[productId] = [];
        byProduct[productId].push(variant);
      });

      Object.keys(byProduct).forEach((productId) => {
        byProduct[productId] = byProduct[productId].sort((a, b) => {
          const colorA = String(a.color || '').toLowerCase();
          const colorB = String(b.color || '').toLowerCase();
          if (colorA !== colorB) return colorA.localeCompare(colorB);
          const sizeA = String(a.size || '').toLowerCase();
          const sizeB = String(b.size || '').toLowerCase();
          if (sizeA !== sizeB) return sizeA.localeCompare(sizeB);
          return String(a.variantSku || '').localeCompare(String(b.variantSku || ''));
        });
      });

      setVariantsByProductId(byProduct);
      setSavedVariantSizes((prev) => mergeSavedVariantSizes(variants.map((variant) => variant.size), prev));
      setSavedVariantColors((prev) => mergeSavedVariantColors(variants.map((variant) => variant.color), prev));
    } catch (error) {
      console.error('Error loading clothing variants:', error);
    }
  }

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const filters: Record<string, string | number> = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (search) filters.search = search;
      if (categoryFilter !== 'all') filters.category = categoryFilter;
      if (stockFilter !== 'all') filters.stockStatus = stockFilter;

      const response = await productsAPI.getProducts(filters);
      let nextProducts = response.data.products || [];

      if (highlightProductIds.length > 0) {
        const visibleIds = new Set(nextProducts.map((product) => String(product._id)));
        const missingHighlightIds = highlightProductIds.filter((id) => !visibleIds.has(id));

        if (missingHighlightIds.length > 0) {
          const missingProducts = (
            await Promise.all(
              missingHighlightIds.map(async (id) => {
                try {
                  const productResponse = await productsAPI.getProduct(id);
                  return productResponse.data.product;
                } catch {
                  return null;
                }
              })
            )
          ).filter(Boolean) as Product[];

          if (missingProducts.length > 0) {
            const seen = new Set<string>();
            nextProducts = [...missingProducts, ...nextProducts].filter((product) => {
              const id = String(product._id);
              if (seen.has(id)) return false;
              seen.add(id);
              return true;
            });
          }
        }
      }

      setProducts(nextProducts);
      setPagination(response.data.pagination);
      if (supportsVariantProducts) {
        await refreshClothingVariantRegistry();
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await productsAPI.getCategories();
      setCategories(response.data.categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const resetToFirstPage = () => {
    setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
  };

  const handleSearchChange = (value: string) => {
    resetToFirstPage();
    setSearch(value);
  };

  const handleCategoryFilterChange = (value: string) => {
    resetToFirstPage();
    setCategoryFilter(value);
  };

  const handleStockFilterChange = (value: string) => {
    resetToFirstPage();
    setStockFilter(value);
  };

  const toggleProductVariantRow = (productId: string) => {
    setExpandedVariantProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const createEmptyVariantGroup = (): VariantDraftGroup => ({
    key: createDraftKey(),
    color: '',
    colorOnlyRow: null,
    rows: [],
  });

  const createEmptyVariantRow = (): VariantDraftRow => ({
    key: createDraftKey(),
    size: '',
    barcode: '',
    quantity: 0,
    priceAdjustment: 0,
  });

  const mapVariantsToDraftGroups = (variants: ClothingVariant[]): VariantDraftGroup[] => {
    const grouped = new Map<string, VariantDraftGroup>();

    variants.forEach((variant) => {
      const normalizedColor = String(variant.color || '').trim();
      const groupKey = normalizedColor.toLowerCase() || '__no_color__';
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          key: createDraftKey(),
          color: normalizedColor,
          colorOnlyRow: null,
          rows: [],
        });
      }

      const group = grouped.get(groupKey);
      if (!group) return;

      const normalizedSize = String(variant.size || '').trim();
      const draftRow: VariantDraftRow = {
        key: createDraftKey(),
        variantId: String(variant._id),
        variantSku: String(variant.variantSku || '').trim(),
        size: normalizedSize,
        barcode: String(variant.barcode || '').trim(),
        quantity: Math.max(0, Math.round(Number(variant.quantity) || 0)),
        priceAdjustment: Number(variant.priceAdjustment || 0),
      };

      if (isEcommerceBusiness && !normalizedSize) {
        // Keep at most one color-only row per color group; fall back to normal rows if duplicated.
        if (!group.colorOnlyRow) {
          group.colorOnlyRow = { ...draftRow, size: '' };
          return;
        }
      }

      group.rows.push(draftRow);
    });

    return Array.from(grouped.values()).sort((a, b) => a.color.localeCompare(b.color));
  };

  const addVariantGroup = () => {
    setIsVariantPanelOpen(true);
    setVariantGroups((prev) => [...prev, createEmptyVariantGroup()]);
  };

  const removeVariantGroup = (groupKey: string) => {
    setVariantGroups((prev) => {
      const target = prev.find((group) => group.key === groupKey);
      if (target) {
        const existingIds = target.rows
          .map((row) => row.variantId)
          .filter((id): id is string => Boolean(id));
        if (target.colorOnlyRow?.variantId) {
          existingIds.push(target.colorOnlyRow.variantId);
        }
        if (existingIds.length > 0) {
          setRemovedVariantIds((removed) => Array.from(new Set([...removed, ...existingIds])));
        }
      }

      return prev.filter((group) => group.key !== groupKey);
    });
  };

  const updateVariantGroupColor = (groupKey: string, color: string) => {
    const trimmed = String(color || '').trim();
    if (trimmed) {
      setSavedVariantColors((prev) => mergeSavedVariantColors([trimmed], prev));
    }
    setVariantGroups((prev) =>
      prev.map((group) =>
        group.key === groupKey
          ? {
              ...group,
              color,
            }
          : group
      )
    );
  };

  const updateVariantGroupColorOnlyRow = (
    groupKey: string,
    patch: Partial<Pick<VariantDraftRow, 'size' | 'barcode' | 'quantity'>>
  ) => {
    setVariantGroups((prev) =>
      prev.map((group) => {
        if (group.key !== groupKey) return group;

        // If size rows exist, a color-only row should not coexist.
        if (group.rows.length > 0) return { ...group, colorOnlyRow: null };

        const existing = group.colorOnlyRow || {
          ...createEmptyVariantRow(),
          size: '',
          barcode: '',
          quantity: 0,
        };

        return {
          ...group,
          colorOnlyRow: {
            ...existing,
            ...patch,
          },
        };
      })
    );
  };

  const updateVariantGroupColorOnlyQuantity = (groupKey: string, rawQuantity: string) => {
    const nextQuantity = rawQuantity.trim() === '' ? null : Math.max(0, Math.round(Number(rawQuantity) || 0));

    setVariantGroups((prev) =>
      prev.map((group) => {
        if (group.key !== groupKey) return group;

        // If this group already has size rows, don't keep a color-only variant around.
        if (group.rows.length > 0) return { ...group, colorOnlyRow: null };

        const existing = group.colorOnlyRow;

        if (nextQuantity === null) {
          // For an existing color-only variant, treat blank as "0" (don't silently delete server data).
          if (existing?.variantId) {
            return { ...group, colorOnlyRow: { ...existing, quantity: 0 } };
          }
          return { ...group, colorOnlyRow: null };
        }

        if (existing) {
          return { ...group, colorOnlyRow: { ...existing, quantity: nextQuantity } };
        }

        const created = createEmptyVariantRow();
        return {
          ...group,
          colorOnlyRow: {
            ...created,
            size: '',
            barcode: '',
            quantity: nextQuantity,
          },
        };
      })
    );
  };

  const addVariantSizeRow = (groupKey: string) => {
    setVariantGroups((prev) =>
      prev.map((group) => {
        if (group.key !== groupKey) return group;
        const removedId = group.colorOnlyRow?.variantId;
        if (removedId) {
          setRemovedVariantIds((removed) =>
            removed.includes(removedId) ? removed : [...removed, removedId]
          );
        }
        return {
          ...group,
          colorOnlyRow: null,
          rows: [...group.rows, createEmptyVariantRow()],
        };
      })
    );
  };

  const removeVariantSizeRow = (groupKey: string, rowKey: string) => {
    setVariantGroups((prev) =>
      prev.map((group) => {
        if (group.key !== groupKey) return group;
        const targetRow = group.rows.find((row) => row.key === rowKey);
        if (targetRow?.variantId) {
          setRemovedVariantIds((removed) =>
            removed.includes(targetRow.variantId as string)
              ? removed
              : [...removed, targetRow.variantId as string]
          );
        }

        return {
          ...group,
          rows: group.rows.filter((row) => row.key !== rowKey),
        };
      })
    );
  };

  const updateVariantSizeRow = (
    groupKey: string,
    rowKey: string,
    patch: Partial<Omit<VariantDraftRow, 'key'>>
  ) => {
    setVariantGroups((prev) =>
      prev.map((group) => {
        if (group.key !== groupKey) return group;
        return {
          ...group,
          rows: group.rows.map((row) =>
            row.key === rowKey
              ? {
                  ...row,
                  ...patch,
                }
              : row
          ),
        };
      })
    );
  };

  const openProductModal = (product?: Product, initialBarcode?: string) => {
    setProductFormError('');
    setRemovedVariantIds([]);
    setVariantGroups([]);
    setIsVariantPanelOpen(false);
    setIsVariantEditorLoading(false);

    if (product) {
      const resolvedMeasurementType = isClothingRetailBusiness
        ? 'count'
        : getResolvedMeasurementType(product.measurementType);
      setEditingProduct(product);
      setFormData({
        name: product.name,
        sku: product.sku || '',
        barcode: product.barcode || '',
        measurementType: resolvedMeasurementType,
        category: product.category,
        description: product.description || '',
        quantity: isClothingRetailBusiness ? Math.round(product.quantity) : product.quantity,
        minQuantity: isClothingRetailBusiness ? Math.round(product.minQuantity) : product.minQuantity,
        price: product.price,
        prices: getNormalizedProductPrices(product),
        secondPrice: Number.isFinite(Number(product.secondPrice)) ? Number(product.secondPrice) : null,
        soldDiscountPercent: getProductSoldDiscountPercent(product),
        expirationDate: supportsExpirationDate ? toDateInputValue(product.expirationDate) : '',
        cost: canSeeProductCost ? product.cost : 0,
        images: product.images || [],
      });
      setUploadedImages(product.images?.map(img => img.url) || []);

      if (supportsVariantProducts) {
        setIsVariantEditorLoading(true);
        void loadVariantsForProduct(String(product._id))
          .then((variants) => {
            setVariantGroups(mapVariantsToDraftGroups(variants));
            setIsVariantPanelOpen(variants.length > 0);
            setSavedVariantSizes((prev) => mergeSavedVariantSizes(variants.map((item) => item.size), prev));
            setSavedVariantColors((prev) => mergeSavedVariantColors(variants.map((item) => item.color), prev));
          })
          .finally(() => {
            setIsVariantEditorLoading(false);
          });
      }
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        sku: '',
        barcode: initialBarcode || '',
        measurementType: 'count',
        category: '',
        description: '',
        quantity: 0,
        minQuantity: 1,
        price: 0,
        prices: { default: 0, bronze: 0, silver: 0, gold: 0 },
        secondPrice: null,
        soldDiscountPercent: 0,
        expirationDate: '',
        cost: 0,
        images: [],
      });
      setUploadedImages([]);
    }
    setIsProductModalOpen(true);
  };

  const closeProductModal = () => {
    setIsProductModalOpen(false);
    setEditingProduct(null);
    setProductFormError('');
    setUploadedImages([]);
    setVariantGroups([]);
    setRemovedVariantIds([]);
    setIsVariantPanelOpen(false);
    setIsVariantEditorLoading(false);
  };

  const isGeneratedBarcodeUnique = async (barcode: string) => {
    const normalizedBarcode = String(barcode || '').trim();
    if (!normalizedBarcode) return false;

    const localDuplicate = products.some((product) => {
      const existingBarcode = String(product.barcode || '').trim();
      if (!existingBarcode || existingBarcode !== normalizedBarcode) return false;
      if (!editingProduct) return true;
      return String(product._id) !== String(editingProduct._id);
    });
    if (localDuplicate) return false;

    try {
      const response = await productsAPI.getProductByBarcode(normalizedBarcode);
      const existingProduct = response.data?.product;
      if (!existingProduct) return true;
      if (editingProduct && String(existingProduct._id) === String(editingProduct._id)) {
        return true;
      }
      return false;
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404) return true;
      throw error;
    }
  };

  const handleGenerateBarcode = async () => {
    setProductFormError('');
    setIsGeneratingBarcode(true);

    try {
      const maxAttempts = 40;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const candidate = generateRandomBarcodeCandidate(13);
        const isUnique = await isGeneratedBarcodeUnique(candidate);
        if (isUnique) {
          setFormData((prev) => ({ ...prev, barcode: candidate }));
          return;
        }
      }

      setProductFormError('Could not generate a unique barcode. Please try again.');
    } catch (error) {
      console.error('Error generating barcode:', error);
      setProductFormError('Could not verify barcode uniqueness. Please try again.');
    } finally {
      setIsGeneratingBarcode(false);
    }
  };

  const loadVariantsForProduct = async (productId: string): Promise<ClothingVariant[]> => {
    if (!supportsVariantProducts) return [];
    try {
      const response = await businessAPI.getClothingVariants(productId);
      const variants = (response.data.variants || []).filter(
        (variant) => getVariantProductId(variant) === productId
      );
      setVariantsByProductId((prev) => ({
        ...prev,
        [productId]: variants,
      }));
      setSavedVariantSizes((prev) => mergeSavedVariantSizes(variants.map((item) => item.size), prev));
      setSavedVariantColors((prev) => mergeSavedVariantColors(variants.map((item) => item.color), prev));
      return variants;
    } catch (error) {
      console.error('Error loading product variants:', error);
      return [];
    }
  };

  const openProductDetailsModal = async (product: Product) => {
    const productId = String(product._id);
    setSelectedProduct(product);
    if (supportsVariantProducts) {
      const variants = await loadVariantsForProduct(productId);
      setSelectedProductVariants(variants);
    } else {
      setSelectedProductVariants([]);
    }
    setIsProductDetailsOpen(true);
  };

  const closeProductDetailsModal = () => {
    setIsProductDetailsOpen(false);
    setSelectedProduct(null);
    setSelectedProductVariants([]);
  };

  const handleProductRowDoubleClick = (
    event: React.MouseEvent<HTMLTableRowElement>,
    product: Product
  ) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, input, a, [role="checkbox"], [data-row-interactive="true"]')) {
      return;
    }
    void openProductDetailsModal(product);
  };

  const flattenVariantDrafts = (): FlattenedVariantDraft[] =>
    variantGroups.flatMap((group) => {
      const color = String(group.color || '').trim();
      const rows = group.rows.map((row) => ({ ...row, color }));
      const colorOnly = group.colorOnlyRow ? [{ ...group.colorOnlyRow, color }] : [];
      return [...colorOnly, ...rows];
    });

  const validateVariantDrafts = (): { ok: true; drafts: FlattenedVariantDraft[] } | { ok: false; message: string } => {
    const drafts = flattenVariantDrafts();

    for (const draft of drafts) {
      if (!draft.color) {
        return { ok: false, message: 'Each variant needs a color.' };
      }
      const quantity = Number(draft.quantity);
      if (!Number.isFinite(quantity) || quantity < 0 || !Number.isInteger(quantity)) {
        return { ok: false, message: 'Variant quantity must be a non-negative whole number.' };
      }
    }

    const seenBarcodes = new Set<string>();
    const productBarcode = String(formData.barcode || '').trim();
    for (const draft of drafts) {
      const variantBarcode = String(draft.barcode || '').trim();
      if (!variantBarcode) continue;
      if (variantBarcode === productBarcode) {
        return {
          ok: false,
          message: `Variant barcode "${variantBarcode}" matches the main product barcode.`,
        };
      }
      if (seenBarcodes.has(variantBarcode)) {
        return {
          ok: false,
          message: `Duplicate variant barcode "${variantBarcode}" in this product.`,
        };
      }
      seenBarcodes.add(variantBarcode);
    }

    return { ok: true, drafts };
  };

  const syncClothingVariantsForProduct = async (
    productId: string,
    drafts: FlattenedVariantDraft[]
  ) => {
    if (!supportsVariantProducts) return;

    const usedVariantSkus = new Set<string>();

    for (let index = 0; index < drafts.length; index += 1) {
      const draft = drafts[index];
      const requestedSku = String(draft.variantSku || '').trim();
      const fallbackSku = buildFallbackVariantSku({
        productSku: formData.sku,
        productName: formData.name,
        color: draft.color,
        size: draft.size,
        index,
      });
      const variantSku = ensureUniqueVariantSku(requestedSku || fallbackSku, usedVariantSkus);

      const payload = {
        variantSku,
        size: String(draft.size || '').trim(),
        color: String(draft.color || '').trim(),
        barcode: String(draft.barcode || '').trim(),
        quantity: Math.max(0, Math.round(Number(draft.quantity) || 0)),
        priceAdjustment: Number(draft.priceAdjustment || 0),
      };

      if (draft.variantId) {
        await businessAPI.updateClothingVariant(String(draft.variantId), payload);
      } else {
        await businessAPI.createClothingVariant({
          productId,
          ...payload,
        });
      }
    }

    const removedIds = Array.from(new Set(removedVariantIds.filter(Boolean)));
    if (removedIds.length > 0) {
      await Promise.all(removedIds.map((variantId) => businessAPI.deleteClothingVariant(variantId)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingProduct) return;
    setProductFormError('');

    const normalizedMeasurementType = isClothingRetailBusiness
      ? 'count'
      : getResolvedMeasurementType(formData.measurementType);
    const normalizedMinQuantity = Number(formData.minQuantity) || 0;
    const normalizedPrice = Number(formData.price) || 0;
    const parsedSecondPrice = formData.secondPrice;
    const normalizedExpirationDate = supportsExpirationDate
      ? String(formData.expirationDate || '').trim()
      : '';

    if (parsedSecondPrice !== null && (!Number.isFinite(parsedSecondPrice) || parsedSecondPrice < 0)) {
      setProductFormError('Second price must be a non-negative number.');
      return;
    }

    if (parsedSecondPrice !== null && parsedSecondPrice >= normalizedPrice) {
      setProductFormError('Second price must be lower than the main price.');
      return;
    }

    if (normalizedExpirationDate && Number.isNaN(new Date(normalizedExpirationDate).getTime())) {
      setProductFormError('Expiration date must be a valid date.');
      return;
    }

    const variantValidation = supportsVariantProducts
      ? validateVariantDrafts()
      : { ok: true as const, drafts: [] as FlattenedVariantDraft[] };

    if (!variantValidation.ok) {
      setProductFormError(variantValidation.message);
      return;
    }

    const variantsQuantityTotal = variantValidation.drafts.reduce(
      (sum, draft) => sum + Math.max(0, Math.round(Number(draft.quantity) || 0)),
      0
    );
    const normalizedQuantity = supportsVariantProducts && variantValidation.drafts.length > 0
      ? variantsQuantityTotal
      : (Number(formData.quantity) || 0);

    if (
      isCountMeasurementType(normalizedMeasurementType) &&
      (!Number.isInteger(normalizedQuantity) || !Number.isInteger(normalizedMinQuantity))
    ) {
      setProductFormError('Count-based products require whole number quantities.');
      return;
    }

    const toApiErrorMessage = (error: unknown): string => {
      const err = error as {
        response?: {
          data?: {
            code?: string;
            message?: string;
            details?: {
              field?: 'sku' | 'barcode';
              productName?: string | null;
            };
            errors?: Array<{ msg?: string; message?: string }>;
          };
        };
      };
      const payload = err.response?.data;
      const duplicateField = payload?.details?.field;
      const duplicateProductName = payload?.details?.productName || '';
      if (payload?.code === 'ITEM_ALREADY_EXISTS') {
        if (duplicateField === 'barcode') {
          return duplicateProductName
            ? `Barcode is already used by "${duplicateProductName}".`
            : t('inventory.barcodeAlreadyExists', 'Barcode is already used by another product.');
        }
        if (duplicateField === 'sku') {
          return duplicateProductName
            ? `SKU is already used by "${duplicateProductName}".`
            : t('inventory.skuAlreadyExists', 'SKU is already used by another product.');
        }
        if (payload?.message) return payload.message;
        return t('inventory.itemAlreadyExists', 'Item already exists');
      }
      if (payload?.message?.toLowerCase().includes('already exists')) {
        return payload.message;
      }
      if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
        const joined = payload.errors
          .map((item) => item.msg || item.message)
          .filter(Boolean)
          .join(', ');
        if (joined) return joined;
      }
      if (payload?.message) return payload.message;
      return t('inventory.saveProductFailed', 'Failed to save product');
    };

    try {
      setIsSavingProduct(true);
      const data: Partial<Product> = { ...formData, measurementType: normalizedMeasurementType, images: uploadedImages.map((url, i) => ({
        url,
        alt: formData.name,
        isPrimary: i === 0
      })) };

      data.quantity = isCountMeasurementType(normalizedMeasurementType)
        ? Math.round(normalizedQuantity)
        : normalizedQuantity;
      data.minQuantity = isCountMeasurementType(normalizedMeasurementType)
        ? Math.round(normalizedMinQuantity)
        : normalizedMinQuantity;
      data.price = normalizedPrice;
      data.prices = {
        ...formData.prices,
        default: normalizedPrice,
      };
      data.secondPrice = parsedSecondPrice;
      data.expirationDate = normalizedExpirationDate || null;
      if (!supportsExpirationDate) {
        delete (data as { expirationDate?: string | null }).expirationDate;
      }
      if (!canSeeProductCost) {
        delete (data as { cost?: number }).cost;
      }

      let savedProduct: Product;
      if (editingProduct) {
        const response = await productsAPI.updateProduct(editingProduct._id, data);
        savedProduct = response.data.product;
      } else {
        const response = await productsAPI.createProduct(data);
        savedProduct = response.data.product;
        await updateOnboarding({ addedFirstProduct: true });
      }

      if (supportsVariantProducts) {
        await syncClothingVariantsForProduct(String(savedProduct._id), variantValidation.drafts);
        await refreshClothingVariantRegistry();
      }

      closeProductModal();
      fetchProducts();
      notifyAnalyticsRefresh();
    } catch (error) {
      console.error('Error saving product:', error);
      setProductFormError(toApiErrorMessage(error));
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingProduct) return;
    try {
      await productsAPI.deleteProduct(deletingProduct._id);
      setIsDeleteModalOpen(false);
      setDeletingProduct(null);
      fetchProducts();
      notifyAnalyticsRefresh();
      notifyActivity({
        id: `product-delete-${deletingProduct._id}`,
        title: deletingProduct.name,
        description: t('analytics.activityProductDeleted', 'Product deleted'),
        badge: 'stock',
      });
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProductIds.length === 0) return;
    try {
      const productIds = selectedProductIds.filter(Boolean);
      const deletedProducts = products.filter((product) => selectedProductIds.includes(String(product._id)));
      const results = await Promise.allSettled(productIds.map((id) => productsAPI.deleteProduct(id)));
      const failedIds = results
        .map((result, index) => (result.status === 'rejected' ? productIds[index] : null))
        .filter((id): id is string => Boolean(id));

      setSelectedProductIds(failedIds);
      setIsBulkDeleteOpen(false);
      fetchProducts();
      notifyAnalyticsRefresh();
      deletedProducts.forEach((product) => {
        if (failedIds.includes(String(product._id))) return;
        notifyActivity({
          id: `product-delete-${product._id}`,
          title: product.name,
          description: t('analytics.activityProductDeleted', 'Product deleted'),
          badge: 'stock',
        });
      });
      if (failedIds.length > 0) {
        console.error('Some products failed to delete:', failedIds);
      }
    } catch (error) {
      console.error('Error bulk deleting products:', error);
    }
  };

  const handleScan = async (barcode: string, product?: Product | null) => {
    if (scanTarget === 'productForm') {
      setFormData((prev) => ({ ...prev, barcode }));
      setIsScannerOpen(false);
      if (resumeProductModal) {
        setIsProductModalOpen(true);
        setResumeProductModal(false);
      }
      setScanTarget('inventory');
      return;
    }

    setIsScannerOpen(false);

    if (product) {
      setScanResult({ barcode, product });
      setIsScanResultOpen(true);
      return;
    }

    if (product === null) {
      setScanResult({ barcode, product: null });
      setIsScanResultOpen(true);
      return;
    }

    try {
      const response = await productsAPI.getProductByBarcode(barcode);
      const found = response.data.product || null;
      setScanResult({ barcode, product: found });
      setIsScanResultOpen(true);
    } catch {
      setScanResult({ barcode, product: null });
      setIsScanResultOpen(true);
    }
  };

  const openSaleModal = async (product: Product) => {
    void loadSavedClients();
    const productId = String(product._id);
    const measurementOption = getMeasurementOption(product.measurementType);
    const initialQuantity = Math.max(
      isCountMeasurementType(product.measurementType || 'count') ? 1 : 0.000001,
      Math.min(product.quantity, measurementOption.minPositive)
    );
    const variants = await loadVariantsForProduct(productId);
    const defaultVariant = variants.find((variant) => Number(variant.quantity) > 0) || variants[0];
    const maxQuantityByVariant = defaultVariant
      ? Math.min(product.quantity, Number(defaultVariant.quantity) || 0)
      : product.quantity;
    const initialSaleQuantity =
      maxQuantityByVariant <= 0
        ? 0
        : Math.max(
            measurementOption.minPositive,
            Math.min(maxQuantityByVariant, initialQuantity)
          );
    setSellingProduct(product);
    setSaleVariants(variants);
    setSelectedSaleVariantId(defaultVariant ? String(defaultVariant._id) : '');
    setSaleForm({
      quantity: initialSaleQuantity,
      unitPrice: getDiscountedUnitPrice(product),
      customerName: '',
    });
    setSelectedSaleClientKey(MANUAL_CLIENT_SELECT_VALUE);
    setSaleFormError('');
    setSaleOrderType(isEcommerceBusiness ? 'shipped' : 'walk_in');
    setSaleShipping(createInitialShippingForm());
    setIsSaleModalOpen(true);
  };

  const handleQuickSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRecordingQuickSale) return;
    if (!sellingProduct) return;
    setSaleFormError('');
    const effectiveSaleOrderType: OrderType = isEcommerceBusiness
      ? 'shipped'
      : (isSupermarketBusiness ? 'walk_in' : saleOrderType);
    const selectedVariant = saleVariants.find(
      (variant) => String(variant._id) === selectedSaleVariantId
    );
    const hasVariantOptions = saleVariants.length > 0;
    if (supportsVariantProducts && hasVariantOptions && !selectedVariant) {
      setSaleFormError('Select a variant before completing the sale.');
      return;
    }
    const trimmedCustomerName = saleForm.customerName.trim();
    const selectedSaleClient =
      selectedSaleClientKey === MANUAL_CLIENT_SELECT_VALUE
        ? null
        : selectableClients.find((client) => client.clientKey === selectedSaleClientKey) || null;
    const resolvedSaleCustomerName = isEcommerceBusiness
      ? trimmedCustomerName
      : (trimmedCustomerName || t('ecommerce.walkInCustomer', 'Walk-in Customer'));
    const resolvedSalePhone =
      saleShipping.phone.trim() || String(selectedSaleClient?.phone || '').trim();
    const resolvedSaleEmail = String(selectedSaleClient?.email || '').trim();
    if (isEcommerceBusiness && !trimmedCustomerName) {
      return;
    }
    const requiresSaleStreetAddress = saleShipping.mode !== 'stopdesk';
    if (effectiveSaleOrderType === 'shipped' && !saleShipping.wilaya.trim()) {
      setSaleFormError('Shipping destination (wilaya) is required.');
      return;
    }
    if (
      effectiveSaleOrderType === 'shipped' &&
      requiresSaleStreetAddress &&
      !saleShipping.street.trim()
    ) {
      setSaleFormError('Street address is required for domestic delivery.');
      return;
    }
    const parsedSaleShippingFee = Number(saleShipping.shippingCost);
    if (
      effectiveSaleOrderType === 'shipped' &&
      (
        !saleShipping.shippingCost.trim() ||
        !Number.isFinite(parsedSaleShippingFee) ||
        parsedSaleShippingFee < 0
      )
    ) {
      return;
    }

    const saleMeasurementType = getResolvedMeasurementType(sellingProduct.measurementType);
    if (saleForm.quantity <= 0) {
      return;
    }
    if (isCountMeasurementType(saleMeasurementType) && !Number.isInteger(saleForm.quantity)) {
      return;
    }
    const minimumAllowedPrice = getProductMinimumSalePrice(sellingProduct);
    if (minimumAllowedPrice !== null && saleForm.unitPrice < minimumAllowedPrice) {
      setSaleFormError(`Price cannot be lower than ${formatCurrency(minimumAllowedPrice)}.`);
      return;
    }
    const maxAllowedQuantity = Math.min(
      sellingProduct.quantity,
      selectedVariant ? Number(selectedVariant.quantity) || 0 : sellingProduct.quantity
    );
    if (saleForm.quantity > maxAllowedQuantity) {
      setSaleFormError(
        `Quantity exceeds available stock (${formatQuantityWithUnit(
          maxAllowedQuantity,
          sellingProduct.measurementType
        )}).`
      );
      return;
    }
    const saleStreetForPayload =
      saleShipping.mode === 'stopdesk'
        ? (saleShipping.street.trim() || 'Stop Desk')
        : saleShipping.street.trim();

    try {
      setIsRecordingQuickSale(true);
      await salesAPI.quickSale({
        productId: sellingProduct._id,
        ...(selectedVariant ? { variantId: String(selectedVariant._id) } : {}),
        quantity: saleForm.quantity,
        unitPrice: saleForm.unitPrice,
        customer: {
          name: resolvedSaleCustomerName,
          ...(selectedSaleClient?.clientKey ? { clientKey: selectedSaleClient.clientKey } : {}),
          ...(selectedSaleClient?.pricingTier ? { pricingTier: selectedSaleClient.pricingTier } : {}),
          ...(resolvedSaleEmail ? { email: resolvedSaleEmail } : {}),
          ...(resolvedSalePhone ? { phone: resolvedSalePhone } : {}),
          ...(effectiveSaleOrderType === 'shipped'
            ? {
                address: {
                  ...(saleStreetForPayload ? { street: saleStreetForPayload } : {}),
                  city: buildShippingCity(saleShipping),
                },
              }
            : {}),
        },
        orderType: effectiveSaleOrderType,
        ...(effectiveSaleOrderType === 'shipped'
          ? {
            shipping: {
                mode: saleShipping.mode,
                carrier: saleShipping.carrier || 'other',
                status: 'processing',
                ...(saleShipping.trackingNumber.trim()
                  ? { trackingNumber: saleShipping.trackingNumber.trim() }
                  : {}),
                ...(saleShipping.notes.trim() ? { notes: saleShipping.notes.trim() } : {}),
              },
              shippingCost: Math.max(0, parsedSaleShippingFee),
            }
          : {}),
      });
      await updateOnboarding({ recordedFirstSale: true });
      setIsSaleModalOpen(false);
      setSellingProduct(null);
      setSaleVariants([]);
      setSelectedSaleVariantId('');
      setSelectedSaleClientKey(MANUAL_CLIENT_SELECT_VALUE);
      setSaleFormError('');
      setSaleOrderType(isEcommerceBusiness ? 'shipped' : 'walk_in');
      setSaleShipping(createInitialShippingForm());
      fetchProducts();
      notifyAnalyticsRefresh();
    } catch (error) {
      console.error('Error recording sale:', error);
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to record sale.';
      setSaleFormError(message);
    } finally {
      setIsRecordingQuickSale(false);
    }
  };

  const openBulkSaleModal = async () => {
    void loadSavedClients();
    const selectedSellableProducts = products.filter(
      (product) =>
        selectedProductIds.includes(String(product._id)) &&
        product.quantity > 0
    );

    if (selectedSellableProducts.length === 0) return;

    const bulkItems = await Promise.all(
      selectedSellableProducts.map(async (product) => {
        const measurementType = getResolvedMeasurementType(product.measurementType);
        const measurementOption = getMeasurementOption(measurementType);
        const variants = await loadVariantsForProduct(String(product._id));
        const defaultVariant = variants.find((variant) => Number(variant.quantity) > 0) || variants[0];
        const maxQuantityByVariant = defaultVariant
          ? Math.min(product.quantity, Number(defaultVariant.quantity) || 0)
          : product.quantity;
        const initialQuantity =
          maxQuantityByVariant <= 0
            ? 0
            : Math.max(
                isCountMeasurementType(measurementType) ? 1 : 0.000001,
                Math.min(maxQuantityByVariant, measurementOption.minPositive)
              );
        return {
          productId: String(product._id),
          name: product.name,
          sku: product.sku || '-',
          measurementType,
          availableQuantity: product.quantity,
          variants,
          variantId: defaultVariant ? String(defaultVariant._id) : undefined,
          quantity: initialQuantity,
          unitPrice: getDiscountedUnitPrice(product),
          minimumUnitPrice: getProductMinimumSalePrice(product),
        };
      })
    );
    setBulkSaleItems(bulkItems);
    setBulkSaleCustomerName('');
    setSelectedBulkClientKey(MANUAL_CLIENT_SELECT_VALUE);
    setBulkSaleError('');
    setBulkSaleOrderType(isEcommerceBusiness ? 'shipped' : 'walk_in');
    setBulkSaleShipping(createInitialShippingForm());
    setIsBulkSaleModalOpen(true);
  };

  const closeBulkSaleModal = () => {
    setIsBulkSaleModalOpen(false);
    setBulkSaleItems([]);
    setBulkSaleCustomerName('');
    setSelectedBulkClientKey(MANUAL_CLIENT_SELECT_VALUE);
    setBulkSaleError('');
    setBulkSaleOrderType(isEcommerceBusiness ? 'shipped' : 'walk_in');
    setBulkSaleShipping(createInitialShippingForm());
  };

  const updateBulkSaleItemQuantity = (productId: string, quantity: number) => {
    setBulkSaleItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const measurementOption = getMeasurementOption(item.measurementType);
        const safeQuantity = Number.isFinite(quantity) ? quantity : measurementOption.minPositive;
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

  const updateBulkSaleItemVariant = (productId: string, variantId: string) => {
    setBulkSaleItems((prev) =>
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
          quantity: Math.max(minimumAllowed, Math.min(maxAllowed, item.quantity)),
        };
      })
    );
  };

  const updateBulkSaleItemPrice = (productId: string, unitPrice: number) => {
    setBulkSaleItems((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? {
              ...item,
              unitPrice: Math.max(
                item.minimumUnitPrice ?? 0,
                Number.isFinite(unitPrice) ? unitPrice : 0
              ),
            }
          : item
      )
    );
  };

  const removeBulkSaleItem = (productId: string) => {
    setBulkSaleItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const bulkSaleTotal = bulkSaleItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  const effectiveBulkSaleOrderType: OrderType = isEcommerceBusiness
    ? 'shipped'
    : (isSupermarketBusiness ? 'walk_in' : bulkSaleOrderType);
  const bulkSaleGrandTotal =
    bulkSaleTotal +
    (effectiveBulkSaleOrderType === 'shipped' ? Number(bulkSaleShipping.shippingCost) || 0 : 0);

  const handleBulkSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkSaleError('');
    if (bulkSaleItems.length === 0) return;
    const trimmedBulkCustomerName = bulkSaleCustomerName.trim();
    const selectedBulkClient =
      selectedBulkClientKey === MANUAL_CLIENT_SELECT_VALUE
        ? null
        : selectableClients.find((client) => client.clientKey === selectedBulkClientKey) || null;
    const resolvedBulkCustomerName = isEcommerceBusiness
      ? trimmedBulkCustomerName
      : (trimmedBulkCustomerName || t('ecommerce.walkInCustomer', 'Walk-in Customer'));
    const resolvedBulkPhone =
      bulkSaleShipping.phone.trim() || String(selectedBulkClient?.phone || '').trim();
    const resolvedBulkEmail = String(selectedBulkClient?.email || '').trim();
    if (isEcommerceBusiness && !trimmedBulkCustomerName) {
      return;
    }
    const requiresBulkStreetAddress = bulkSaleShipping.mode !== 'stopdesk';
    if (
      effectiveBulkSaleOrderType === 'shipped' &&
      !bulkSaleShipping.wilaya.trim()
    ) {
      setBulkSaleError('Shipping destination (wilaya) is required.');
      return;
    }
    if (
      effectiveBulkSaleOrderType === 'shipped' &&
      requiresBulkStreetAddress &&
      !bulkSaleShipping.street.trim()
    ) {
      setBulkSaleError('Street address is required for domestic delivery.');
      return;
    }
    const parsedBulkShippingFee = Number(bulkSaleShipping.shippingCost);
    if (
      effectiveBulkSaleOrderType === 'shipped' &&
      (
        !bulkSaleShipping.shippingCost.trim() ||
        !Number.isFinite(parsedBulkShippingFee) ||
        parsedBulkShippingFee < 0
      )
    ) {
      return;
    }

    const validItems = bulkSaleItems.filter((item) => {
      if (item.quantity <= 0) return false;
      if (isCountMeasurementType(item.measurementType) && !Number.isInteger(item.quantity)) {
        return false;
      }
      return true;
    });
    if (validItems.length === 0) {
      setBulkSaleError('At least one valid item is required to continue.');
      return;
    }

    const missingRequiredVariant = supportsVariantProducts && validItems.some((item) => {
      const hasVariants = item.variants.length > 0;
      if (!hasVariants) return false;
      return !item.variantId;
    });
    if (missingRequiredVariant) {
      setBulkSaleError('Select a variant for each item with variants before completing the sale.');
      return;
    }

    const quantityExceedsVariantStock = validItems.some((item) => {
      const selectedVariant = item.variants.find(
        (variant) => String(variant._id) === item.variantId
      );
      if (!selectedVariant) return false;
      const maxAllowed = Math.min(
        item.availableQuantity,
        Number(selectedVariant.quantity) || 0
      );
      return item.quantity > maxAllowed;
    });
    if (quantityExceedsVariantStock) {
      setBulkSaleError('One or more quantities exceed selected variant stock.');
      return;
    }

    const hasInvalidUnitPrice = validItems.some(
      (item) => item.minimumUnitPrice !== null && item.unitPrice < item.minimumUnitPrice
    );
    if (hasInvalidUnitPrice) {
      setBulkSaleError('One or more prices are below the product second price.');
      return;
    }
    const bulkStreetForPayload =
      bulkSaleShipping.mode === 'stopdesk'
        ? (bulkSaleShipping.street.trim() || 'Stop Desk')
        : bulkSaleShipping.street.trim();

    try {
      await salesAPI.createSale({
        items: validItems.map((item) => ({
          productId: item.productId,
          ...(item.variantId ? { variantId: item.variantId } : {}),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        customer: {
          name: resolvedBulkCustomerName,
          ...(selectedBulkClient?.clientKey ? { clientKey: selectedBulkClient.clientKey } : {}),
          ...(selectedBulkClient?.pricingTier ? { pricingTier: selectedBulkClient.pricingTier } : {}),
          ...(resolvedBulkEmail ? { email: resolvedBulkEmail } : {}),
          ...(resolvedBulkPhone ? { phone: resolvedBulkPhone } : {}),
          ...(effectiveBulkSaleOrderType === 'shipped'
            ? {
                address: {
                  ...(bulkStreetForPayload ? { street: bulkStreetForPayload } : {}),
                  city: buildShippingCity(bulkSaleShipping),
                },
              }
            : {}),
        },
        orderType: effectiveBulkSaleOrderType,
        ...(effectiveBulkSaleOrderType === 'shipped'
          ? {
            shipping: {
                mode: bulkSaleShipping.mode,
                carrier: bulkSaleShipping.carrier || 'other',
                status: 'processing',
                ...(bulkSaleShipping.trackingNumber.trim()
                  ? { trackingNumber: bulkSaleShipping.trackingNumber.trim() }
                  : {}),
                ...(bulkSaleShipping.notes.trim() ? { notes: bulkSaleShipping.notes.trim() } : {}),
              },
              shippingCost: Math.max(0, parsedBulkShippingFee),
            }
          : {}),
        paymentMethod: 'cash',
      });
      await updateOnboarding({ recordedFirstSale: true });
      setSelectedProductIds([]);
      closeBulkSaleModal();
      fetchProducts();
      notifyAnalyticsRefresh();
    } catch (error) {
      console.error('Error recording bulk sale:', error);
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to record bulk sale.';
      setBulkSaleError(message);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImages((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const fetchAllProductsForExport = async (): Promise<Product[]> => {
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

  const buildProductExportRows = (sourceProducts: Product[]): string[][] => {
    const headers = [
      'Name',
      'SKU',
      'Barcode',
      'Category',
      'Product Type',
      'Quantity',
      'Min Quantity',
      'Price',
      'Second Price',
      'Sold % Off',
      'Supplier Name',
      'Supplier Email',
      'Supplier Phone'
    ];
    if (canSeeProductCost) {
      headers.splice(10, 0, 'Cost');
    }

    const rows = sourceProducts.map((product) => {
      const row = [
        String(product.name || ''),
        String(product.sku || ''),
        String(product.barcode || ''),
        String(product.category || ''),
        String(product.measurementType || 'count'),
        String(Number(product.quantity) || 0),
        String(Number(product.minQuantity) || 0),
        String(Number(product.price) || 0),
        Number.isFinite(Number(product.secondPrice)) ? String(Number(product.secondPrice)) : '',
        String(Number(product.soldDiscountPercent || 0)),
        String(product.supplier?.name || ''),
        String(product.supplier?.email || ''),
        String(product.supplier?.phone || '')
      ];
      if (canSeeProductCost) {
        row.splice(10, 0, String(Number(product.cost) || 0));
      }
      return row;
    });

    return [headers, ...rows];
  };

  const handleExportProducts = async (format: TabularFormat) => {
    if (isExportingProducts) return;
    setIsExportingProducts(true);
    try {
      const allProducts = await fetchAllProductsForExport();
      const rows = buildProductExportRows(allProducts);
      const dateStamp = new Date().toISOString().slice(0, 10);
      downloadTabularRows({
        rows,
        format,
        fileNameBase: `products-${dateStamp}`
      });
    } catch (error) {
      console.error('Error exporting products:', error);
    } finally {
      setIsExportingProducts(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const parsed = await parseTabularImportFile(file);
      setImportRows(parsed.rows);
      setImportFileName(file.name);
      setImportResults(null);
    } catch (error) {
      const message = (error as Error).message || 'Failed to read import file.';
      setImportRows([]);
      setImportFileName(file.name);
      setImportResults({
        totalRows: 0,
        created: 0,
        updated: 0,
        imported: 0,
        skipped: [{ row: 1, reason: message }],
        unmappedHeaders: [],
        errors: []
      });
    }
  };

  const handleImportProducts = async () => {
    if (isImportingProducts) return;
    setIsImportingProducts(true);
    try {
      const normalizedRows = importRows.filter((row) =>
        row.some((value) => String(value || '').trim() !== '')
      );
      if (normalizedRows.length === 0) return;

      const headers = normalizeHeaders(normalizedRows[0]);
      const dataRows = normalizedRows.slice(1).map((row) =>
        Array.from({ length: headers.length }, (_, index) => String(row[index] ?? ''))
      );
      const { headerIndexByField, unmappedHeaders } = mapHeadersToCanonical(headers);

      if (Object.keys(headerIndexByField).length === 0) {
        setImportResults({
          totalRows: 0,
          created: 0,
          updated: 0,
          imported: 0,
          skipped: [{ row: 1, reason: 'No recognizable headers found' }],
          unmappedHeaders,
          errors: [],
        });
        return;
      }

      const nameHeaderIndex = headerIndexByField.name;
      if (nameHeaderIndex === undefined) {
        setImportResults({
          totalRows: 0,
          created: 0,
          updated: 0,
          imported: 0,
          skipped: [{ row: 1, reason: 'Missing required Name column' }],
          unmappedHeaders,
          errors: [],
        });
        return;
      }

      const skipped: ImportRowIssue[] = [];
      const products: NormalizedProduct[] = [];
      const usedSkus = new Set<string>();

      dataRows.forEach((values, index) => {
        const rowNumber = index + 2;
        if (isRowEmpty(values)) {
          skipped.push({ row: rowNumber, reason: 'Empty row' });
          return;
        }

        const { product, issues } = normalizeRowToProduct(values, headerIndexByField);
        if (issues.length > 0) {
          skipped.push({ row: rowNumber, reason: issues.join(', ') });
          return;
        }

        if (product.sku) {
          if (usedSkus.has(product.sku)) {
            skipped.push({ row: rowNumber, reason: `Duplicate SKU in file: ${product.sku}` });
            return;
          }
          usedSkus.add(product.sku);
        }

        products.push(product);
      });

      if (products.length === 0) {
        setImportResults({
          totalRows: dataRows.length,
          created: 0,
          updated: 0,
          imported: 0,
          skipped,
          unmappedHeaders,
          errors: [],
        });
        return;
      }

      const response = await productsAPI.importProducts(products);
      const created = response.data.created || 0;
      const updated = response.data.updated || 0;
      const errors = response.data.errors || [];
      const imported = created + updated;

      if (unmappedHeaders.length > 0) {
        console.warn('Product import: unmapped headers', unmappedHeaders);
      }

      setImportResults({
        totalRows: dataRows.length,
        created,
        updated,
        imported,
        skipped,
        unmappedHeaders,
        errors,
      });

      fetchProducts();
      notifyAnalyticsRefresh();
    } catch (error) {
      console.error('Error importing products:', error);
    } finally {
      setIsImportingProducts(false);
    }
  };

  const formatStockQuantityLabel = (product: Product) =>
    isSingleUnitCountInStock(product)
      ? t('inventory.singleUnitStock', '1 of 1')
      : isSoldOutCountProduct(product)
        ? t('inventory.soldSingleUnitStock', 'Sold (1 of 1)')
      : formatQuantityWithUnit(product.quantity, product.measurementType);

  const getStockStatusBadge = (product: Product) => {
    if (product.stockStatus === 'expired') {
      return (
        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
          <AlertTriangle className="w-3 h-3" />
          {t('inventory.expired', 'Expired')}
        </Badge>
      );
    }
    if (isSoldOutCountProduct(product)) {
      return (
        <Badge className="flex items-center gap-1 w-fit bg-slate-500 text-white">
          <CheckCircle className="w-3 h-3" />
          {t('inventory.sold', 'Sold')}
        </Badge>
      );
    }
    if (product.quantity === 0) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
          <XCircle className="w-3 h-3" />
          {t('inventory.outOfStock', 'Out of Stock')}
        </Badge>
      );
    }
    if (isLowStockProduct(product)) {
      return (
        <Badge className="flex items-center gap-1 w-fit bg-orange-500 text-white">
          <AlertTriangle className="w-3 h-3" />
          {t('inventory.lowStock', 'Low Stock')}
        </Badge>
      );
    }
    return (
      <Badge className="flex items-center gap-1 w-fit bg-emerald-500 text-white">
        <CheckCircle className="w-3 h-3" />
        {t('inventory.inStock', 'In Stock')}
      </Badge>
    );
  };

  const selectedSellableProductsCount = products.filter(
    (product) =>
      selectedProductIds.includes(String(product._id)) &&
      product.quantity > 0
  ).length;
  const variantDraftRows = flattenVariantDrafts();
  const variantQuantityTotal = variantDraftRows.reduce(
    (sum, row) => sum + Math.max(0, Math.round(Number(row.quantity) || 0)),
    0
  );
  const isVariantQuantityAuto = supportsVariantProducts && variantDraftRows.length > 0;
  const formMeasurementOption = getMeasurementOption(formData.measurementType);
  const sellingMeasurementOption = getMeasurementOption(sellingProduct?.measurementType);
  const selectedSaleVariant = saleVariants.find(
    (variant) => String(variant._id) === selectedSaleVariantId
  );
  const maxQuickSaleQuantity = Math.min(
    sellingProduct?.quantity || 0,
    selectedSaleVariant
      ? Number(selectedSaleVariant.quantity) || 0
      : (sellingProduct?.quantity || 0)
  );
  const minQuickSaleQuantity =
    maxQuickSaleQuantity <= 0
      ? 0
      : Math.min(maxQuickSaleQuantity, sellingMeasurementOption.minPositive);
  const minQuickSaleUnitPrice = getProductMinimumSalePrice(sellingProduct);
  const saleDairaOptions = getDairasByWilaya(saleShipping.wilaya);
  const saleCommuneOptions = getCommunesByWilayaAndDaira(
    saleShipping.wilaya,
    saleShipping.daira
  );
  const bulkSaleDairaOptions = getDairasByWilaya(bulkSaleShipping.wilaya);
  const bulkSaleCommuneOptions = getCommunesByWilayaAndDaira(
    bulkSaleShipping.wilaya,
    bulkSaleShipping.daira
  );
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

  return (
    <div className="page-shell">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('inventory.title', 'Inventory')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">{t('manageProductsStock', 'Manage your products and stock levels')}</p>
        </div>
        <div className="page-actions">
          {isSupermarketBusiness && (
            <Badge
              className={`border px-2.5 py-1 text-xs sm:text-sm ${
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
          {canEdit() && (
            <>
              {isRTL && (
                <Button onClick={() => openProductModal()} className="h-9 sm:h-10 text-xs sm:text-sm">
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                  <span className="hidden sm:inline">{t('inventory.addProduct', 'Add Product')}</span>
                </Button>
              )}
              <Button variant="outline" onClick={() => setIsImportModalOpen(true)} className="h-9 sm:h-10 text-xs sm:text-sm">
                <FileUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">{t('inventory.import', 'Import')}</span>
              </Button>
              <Button
                variant="outline"
                className="h-9 sm:h-10 text-xs sm:text-sm"
                onClick={() => {
                  setScanTarget('inventory');
                  setIsScannerOpen(true);
                }}
              >
                <Barcode className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">{t('inventory.scan', 'Scan')}</span>
              </Button>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isExportingProducts} className="h-9 sm:h-10 text-xs sm:text-sm">
                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">
                  {isExportingProducts
                    ? t('common.loading', 'Loading...')
                    : t('inventory.export', 'Export')}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => void handleExportProducts('excel')}>
                {t('inventory.exportExcel', 'Export as Excel (.xlsx)')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleExportProducts('csv')}>
                {t('inventory.exportCsv', 'Export as CSV (.csv)')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleExportProducts('json')}>
                {t('inventory.exportJson', 'Export as JSON (.json)')}
              </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          {canEdit() && !isRTL && (
            <Button onClick={() => openProductModal()} className="h-9 sm:h-10 text-xs sm:text-sm">
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('inventory.addProduct', 'Add Product')}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="content-breathe">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="relative flex-1">
              <Search
                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground ${
                  isRTL ? 'right-3' : 'left-3'
                }`}
              />
              <Input
                placeholder={t('inventory.searchProducts', 'Search products...')}
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className={isRTL ? 'pr-10' : 'pl-10'}
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
              <Select value={categoryFilter} onValueChange={handleCategoryFilterChange}>
                <SelectTrigger className="w-full sm:w-[150px] md:w-[170px] [&>span:last-child]:hidden">
                  <Filter className="w-4 h-4 mr-2 shrink-0" />
                  <SelectValue className="min-w-0 flex-1" placeholder={t('inventory.category', 'Category')} />
                  <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('inventory.allCategories', 'All Categories')}</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={stockFilter} onValueChange={handleStockFilterChange}>
                <SelectTrigger className="w-full sm:w-[150px] md:w-[170px] [&>span:last-child]:hidden">
                  <Boxes className="w-4 h-4 mr-2 shrink-0" />
                  <SelectValue className="min-w-0 flex-1" placeholder={t('inventory.stockStatus', 'Stock')} />
                  <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('inventory.allStock', 'All Stock')}</SelectItem>
                  <SelectItem value="in_stock">{t('inventory.inStock', 'In Stock')}</SelectItem>
                  <SelectItem value="low_stock">{t('inventory.lowStock', 'Low Stock')}</SelectItem>
                  <SelectItem value="out_of_stock">{t('inventory.outOfStock', 'Out of Stock')}</SelectItem>
                  <SelectItem value="expired">{t('inventory.expired', 'Expired')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {canEdit() && selectedProductIds.length > 0 && (
            <div
              className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-b bg-muted/20 ${
                isRTL ? 'sm:flex-row-reverse' : ''
              }`}
            >
              <p className="text-sm text-muted-foreground">
                {t('inventory.selectedCount', '{{count}} selected', {
                  count: selectedProductIds.length,
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                {canManageSales() && (
                  <Button
                    onClick={() => void openBulkSaleModal()}
                    disabled={selectedSellableProductsCount === 0}
                    className="border-[#10B981] bg-[#10B981] text-white hover:border-[#0f9f72] hover:bg-[#0f9f72] hover:text-white focus-visible:ring-[#10B981]/40 disabled:border-[#10B981]/50 disabled:bg-[#10B981]/55 disabled:text-white"
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    {t('inventory.bulkSell', 'Bulk Sell')} ({selectedSellableProductsCount})
                  </Button>
                )}
                <Button
                  onClick={() => setIsBulkDeleteOpen(true)}
                  className="border-[#F0162F] bg-[#F0162F] text-white hover:border-[#D9142A] hover:bg-[#D9142A] hover:text-white focus-visible:ring-[#F0162F]/40"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t('inventory.bulkDelete', 'Delete Selected')} ({selectedProductIds.length})
                </Button>
              </div>
            </div>
          )}
          <div className="table-responsive" dir={isRTL ? 'rtl' : 'ltr'}>
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  {canEdit() && (
                    <TableHead className="w-12 text-center [&:has([role=checkbox])]:px-2">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={selectedProductIds.length > 0 && selectedProductIds.length === products.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedProductIds(products.map((product) => String(product._id)));
                            } else {
                              setSelectedProductIds([]);
                            }
                          }}
                          aria-label={t('inventory.selectAllProducts', 'Select all products')}
                        />
                      </div>
                    </TableHead>
                  )}
                  <TableHead>{t('inventory.productName', 'Product')}</TableHead>
                  <TableHead className="min-w-[120px] text-center">{t('inventory.sku', 'SKU')}</TableHead>
                  <TableHead className="min-w-[120px] text-center">{t('inventory.category', 'Category')}</TableHead>
                  <TableHead className="min-w-[120px] text-center">{t('inventory.quantity', 'Stock')}</TableHead>
                  <TableHead className="min-w-[120px] text-center">{t('inventory.price', 'Price')}</TableHead>
                  <TableHead className="w-[180px] min-w-[180px] text-center whitespace-nowrap overflow-visible">
                    <span dir={isRTL ? 'rtl' : 'ltr'} className="inline-flex w-full items-center justify-center px-2 text-center">
                      {t('inventory.stockStatus', 'Status')}
                    </span>
                  </TableHead>
                  <TableHead className={isRTL ? 'text-left' : 'text-right'}>
                    {t('common.actions', 'Actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={canEdit() ? 8 : 7} className="py-12 text-center">
                      <div className="mx-auto flex flex-col items-center gap-3 text-sm text-muted-foreground">
                        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        <span>{t('common.loading', 'Loading...')}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canEdit() ? 8 : 7} className="py-12 text-center text-muted-foreground">
                      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 rounded-md border border-dashed border-border/70 bg-muted/20 p-6">
                        <Package className="h-10 w-10 text-primary/50" />
                        <p className="font-medium text-foreground">{t('inventory.noProductsFound', 'No products found')}</p>
                        <p className="text-sm text-muted-foreground">{t('inventory.adjustFiltersOrAddProduct', 'Adjust filters or add a product to get started.')}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    (() => {
                      const isLossProduct = canSeeProductCost && highlightSellingAtLoss && product.price < product.cost;
                      const isHighlightedProduct = highlightProductIds.includes(String(product._id));
                      const isSoldOutCount = isSoldOutCountProduct(product);
                      const rowClass = isLossProduct
                        ? 'bg-red-50 dark:bg-red-950/30 shadow-[inset_0_0_0_2px_rgb(239_68_68)] hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors duration-1000'
                        : isHighlightedProduct
                          ? HIGHLIGHT_ROW_CLASS_BY_PRIORITY[highlightPriority]
                          : undefined;

                      const productId = String(product._id);
                      const productVariants = variantsByProductId[productId] || [];
                      const hasProductVariants = supportsVariantProducts && productVariants.length > 0;
                      const isVariantRowExpanded = expandedVariantProductIds.includes(productId);

                      return (
                        <React.Fragment key={productId}>
                          <TableRow
                            id={`product-row-${product._id}`}
                            className={`${rowClass || ''} ${isSoldOutCount ? 'bg-slate-100/80 text-slate-500 dark:bg-slate-900/40 dark:text-slate-400' : ''} cursor-pointer`}
                            onDoubleClick={(event) => handleProductRowDoubleClick(event, product)}
                          >
                            {canEdit() && (
                              <TableCell
                                className="align-middle text-center [&:has([role=checkbox])]:px-2"
                                data-row-interactive="true"
                              >
                                <div className="flex items-center justify-center">
                                  <Checkbox
                                    checked={selectedProductIds.includes(String(product._id))}
                                    onCheckedChange={(checked) => {
                                      const id = String(product._id);
                                      setSelectedProductIds((prev) => {
                                        if (checked) return Array.from(new Set([...prev, id]));
                                        return prev.filter((item) => item !== id);
                                      });
                                    }}
                                    aria-label={t('inventory.selectProduct', 'Select {{name}}', { name: product.name })}
                                  />
                                </div>
                              </TableCell>
                            )}
                            <TableCell>
                              <div className="flex items-center gap-3">
                                {product.primaryImage ? (
                                  <img
                                    src={product.primaryImage}
                                    alt={product.name}
                                    className="w-10 h-10 object-cover rounded-lg"
                                  />
                                ) : (
                                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                                    <ImageIcon className="w-5 h-5 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className={`font-medium truncate ${isSoldOutCount ? 'line-through' : ''}`}>{product.name}</p>
                                    {hasProductVariants && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        data-row-interactive="true"
                                        className="h-6 px-2 text-[11px]"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          toggleProductVariantRow(productId);
                                        }}
                                      >
                                        <ChevronDown
                                          className={`w-3 h-3 mr-1 transition-transform ${
                                            isVariantRowExpanded ? 'rotate-180' : ''
                                          }`}
                                        />
                                        {productVariants.length}
                                      </Button>
                                    )}
                                  </div>
                                  {product.barcode && (
                                    <p className="text-xs text-muted-foreground">{product.barcode}</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm text-center">
                              <span dir="ltr" className="inline-block">
                                {product.sku || '-'}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary">{product.category}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <span
                                className={
                                  isSoldOutCount
                                    ? 'line-through font-medium'
                                    : (isLowStockProduct(product) ? 'text-orange-500 font-medium' : '')
                                }
                              >
                                {formatStockQuantityLabel(product)}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              {(() => {
                                const soldDiscountPercent = getProductSoldDiscountPercent(product);
                                if (soldDiscountPercent <= 0) {
                                  return (
                                    <span dir="ltr" className="inline-block">
                                      {formatCurrency(product.price)}
                                    </span>
                                  );
                                }
                                return (
                                  <div className="space-y-0.5">
                                    <p dir="ltr" className="inline-block text-sm font-medium text-emerald-600">
                                      {formatCurrency(getDiscountedUnitPrice(product))}
                                    </p>
                                    <p dir="ltr" className="inline-block text-xs text-muted-foreground line-through">
                                      {formatCurrency(product.price)}
                                    </p>
                                    <p dir="ltr" className="inline-block text-[11px] text-emerald-700">
                                      {soldDiscountPercent}% off
                                    </p>
                                  </div>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="w-[180px] min-w-[180px]">
                              <div className="flex items-center justify-center">
                                {getStockStatusBadge(product)}
                              </div>
                            </TableCell>
                            <TableCell className={isRTL ? 'text-left' : 'text-right'} data-row-interactive="true">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                                  <DropdownMenuItem onClick={() => void openProductDetailsModal(product)}>
                                    <Eye className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                                    {t('inventory.viewDetails', 'View details')}
                                  </DropdownMenuItem>
                                  {canEdit() && (
                                    <DropdownMenuItem onClick={() => openProductModal(product)}>
                                      <Edit className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                                      {t('common.edit', 'Edit')}
                                    </DropdownMenuItem>
                                  )}
                                  {canManageSales() && product.quantity > 0 && (
                                    <DropdownMenuItem onClick={() => void openSaleModal(product)}>
                                      <ShoppingCart className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                                      {t('ecommerce.quickSell', 'Quick Sale')}
                                    </DropdownMenuItem>
                                  )}
                                  {canTransferStock && product.quantity > 0 && (
                                    <DropdownMenuItem
                                      onClick={() => setTransferProduct(product)}
                                    >
                                      <ArrowRight className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                                      {t('transfer.menuItem', 'Transfer to Stock')}
                                    </DropdownMenuItem>
                                  )}
                                  {canEdit() && (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setDeletingProduct(product);
                                        setIsDeleteModalOpen(true);
                                      }}
                                      className="text-red-600"
                                    >
                                      <Trash2 className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                                      {t('common.delete', 'Delete')}
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                          {hasProductVariants && isVariantRowExpanded && (
                            <TableRow className="bg-muted/20">
                              <TableCell colSpan={canEdit() ? 8 : 7} className="py-3">
                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                  {productVariants.map((variant) => (
                                    <div
                                      key={variant._id}
                                      className="rounded-md border bg-background px-3 py-2"
                                    >
                                      <p className="text-xs font-semibold">{variant.variantSku}</p>
                                      <p className="text-xs text-muted-foreground">
                                        Color: {variant.color || '-'} | Size: {variant.size || '-'}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Barcode: {variant.barcode || '-'} | Qty: {variant.quantity}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })()
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className={`flex items-center justify-between p-4 border-t ${isRTL ? 'flex-row-reverse' : ''}`}>
              <p className="text-sm text-muted-foreground">
                {t('inventory.pageOf', 'Page {{page}} of {{pages}}', {
                  page: pagination.page,
                  pages: pagination.pages,
                })}
              </p>
              <div className="flex flex-wrap items-center justify-end gap-2">
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
                          key={`inventory-page-ellipsis-${index}`}
                          className="px-1 text-sm text-muted-foreground"
                        >
                          ...
                        </span>
                      ) : (
                        <Button
                          key={`inventory-page-${item}`}
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
                          key={`inventory-page-ellipsis-${index}`}
                          className="px-1 text-sm text-muted-foreground"
                        >
                          ...
                        </span>
                      ) : (
                        <Button
                          key={`inventory-page-${item}`}
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

      {/* Product Modal */}
      <Dialog
        open={isProductModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            if (resumeProductModal || scanTarget === 'productForm') {
              setIsProductModalOpen(false);
              return;
            }
            closeProductModal();
            return;
          }
          setIsProductModalOpen(true);
        }}
      >
        <DialogContent className="w-[95vw] max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct
                ? t('inventory.editProduct', withArabicFallback('Edit Product', 'تعديل منتج'))
                : t('inventory.addProduct', withArabicFallback('Add Product', 'إضافة منتج'))}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {editingProduct
                ? t(
                    'inventory.editProductDialogDescription',
                    withArabicFallback('Update product details and images.', 'حدّث تفاصيل المنتج وصوره.')
                  )
                : t(
                    'inventory.addProductDialogDescription',
                    withArabicFallback('Create a new product with details and images.', 'أنشئ منتجًا جديدًا مع التفاصيل والصور.')
                  )}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleSubmit}
            className="space-y-10 py-1 [&_[data-slot=input]]:h-11 [&_[data-slot=input]]:w-full [&_[data-slot=input]]:text-base [&_[data-slot=input]]:md:text-base [&_[data-slot=input]]:font-normal [&_[data-slot=select-trigger]]:h-11 [&_[data-slot=select-trigger]]:w-full [&_[data-slot=select-trigger]]:text-base [&_[data-slot=select-trigger]]:md:text-base [&_[data-slot=select-trigger]]:font-normal [&_[data-slot=select-value]]:text-base [&_[data-slot=select-value]]:md:text-base [&_[data-slot=select-value]]:font-normal [&_[data-slot=label]]:text-sm [&_[data-slot=label]]:font-medium"
          >
            {/* Image Upload */}
            <section className="space-y-4 rounded-lg border bg-card/30 p-6">
              <Label>{t('inventory.productImages', withArabicFallback('Product Images', 'صور المنتج'))}</Label>
              <div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {uploadedImages.map((url, index) => (
                    <div key={index} className="relative">
                      <img 
                        src={url} 
                        alt={t('inventory.productName', withArabicFallback('Product', 'منتج'))}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <label className="flex items-center justify-center w-32 h-20 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:bg-muted transition-colors">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </section>

            <section className="space-y-6 rounded-lg border bg-card/30 p-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('inventory.productName', withArabicFallback('Product Name', 'اسم المنتج'))} *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label>{t('inventory.skuOptional', withArabicFallback('SKU (optional)', 'SKU (اختياري)'))}</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={t('inventory.whatIsSku', withArabicFallback('What is SKU?', 'ما هو SKU؟'))}
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6}>
                      {t(
                        'inventory.skuHelp',
                        withArabicFallback(
                          'SKU = Stock Keeping Unit, your internal product code to track items.',
                          'SKU = رمز تعريف المخزون، وهو كودك الداخلي لتتبع المنتجات.'
                        )
                      )}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('inventory.barcode', withArabicFallback('Barcode', 'الباركود'))}</Label>
                <div className="relative">
                  <Input
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="h-11 pr-24 text-base md:text-base font-normal"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-10 top-1/2 h-9 w-9 -translate-y-1/2"
                    onClick={() => void handleGenerateBarcode()}
                    disabled={isGeneratingBarcode}
                    aria-label={t('inventory.generateBarcode', withArabicFallback('Generate barcode', 'إنشاء باركود'))}
                    title={t('inventory.generateRandomBarcode', withArabicFallback('Generate random barcode', 'إنشاء باركود عشوائي'))}
                  >
                    <RefreshCw className={`h-4 w-4 ${isGeneratingBarcode ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2"
                    onClick={() => {
                      setScanTarget('productForm');
                      setResumeProductModal(true);
                      setIsProductModalOpen(false);
                      setIsScannerOpen(true);
                    }}
                  >
                    <ScanLine className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              {!isClothingRetailBusiness && (
                <div className="space-y-2">
                  <Label>{t('inventory.productType', withArabicFallback('Product Type', 'نوع المنتج'))} *</Label>
                  <Select
                    value={formData.measurementType}
                    onValueChange={(value) => {
                      const nextType = value as ProductMeasurementType;
                      const nextMeasurementOption = getMeasurementOption(nextType);
                      setFormData((prev) => {
                        const nextQuantity = isCountMeasurementType(nextType)
                          ? Math.round(prev.quantity)
                          : prev.quantity;
                        const nextMinQuantity = isCountMeasurementType(nextType)
                          ? Math.round(prev.minQuantity)
                          : (prev.minQuantity > 0
                              ? prev.minQuantity
                              : getDefaultMinQuantityForMeasurement(nextType));
                        return {
                          ...prev,
                          measurementType: nextType,
                          quantity: Math.max(0, nextQuantity),
                          minQuantity: Math.max(
                            isCountMeasurementType(nextType)
                              ? nextMeasurementOption.minPositive
                              : 0,
                            nextMinQuantity
                          ),
                        };
                      });
                    }}
                  >
                    <SelectTrigger className="h-11 w-full text-base font-normal text-muted-foreground">
                      <SelectValue className="text-base font-normal text-muted-foreground" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_MEASUREMENT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {getMeasurementTypeLabel(option.value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>{t('inventory.category', withArabicFallback('Category', 'الفئة'))} *</Label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                  list="categories"
                  className="h-11 text-base md:text-base font-normal"
                />
                <datalist id="categories">
                  {categories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
              {supportsExpirationDate && (
                <div className="space-y-2">
                  <Label>{t('inventory.expirationDate', 'Expiration Date')}</Label>
                  <Input
                    type="date"
                    value={formData.expirationDate}
                    onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                    className="h-11 text-base md:text-base font-normal text-muted-foreground"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('inventory.description', withArabicFallback('Description', 'الوصف'))}</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            </section>

            {supportsVariantProducts && (
              <div className="rounded-lg border bg-card/30 p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Label className="text-base">{t('inventory.variants', 'Variants')}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t(
                        'inventory.variantsHint',
                        'Add color groups and set quantity. Size is optional.'
                      )}
                    </p>
                  </div>
<div className="flex flex-wrap items-center gap-1 sm:gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsVariantPanelOpen((prev) => {
                          const next = !prev;
                          if (next && variantGroups.length === 0) {
                            setVariantGroups([createEmptyVariantGroup()]);
                          }
                          return next;
                        });
                      }}
                    >
                      {isVariantPanelOpen
                        ? t('inventory.hideVariants', 'Hide Variants')
                        : t('inventory.addVariance', 'Add Variance')}
                    </Button>
                    {isVariantPanelOpen && (
                      <Button type="button" size="sm" onClick={addVariantGroup}>
                        <Plus className="w-4 h-4 mr-1" />
                        {t('inventory.addColor', 'Add Color')}
                      </Button>
                    )}
                  </div>
                </div>

                {isVariantPanelOpen && (
                  <>
                    {isVariantEditorLoading ? (
                      <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
                        {t('inventory.loadingVariants', 'Loading existing variants...')}
                      </div>
                    ) : variantGroups.length === 0 ? (
                      <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
                        {t('inventory.noVariantGroups', 'No variant groups yet.')}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {variantGroups.map((group) => (
                          <div key={group.key} className="rounded-md border p-3 space-y-3">
                            <div className="flex items-end gap-2">
                              <div className="flex-1">
                                <Label className="text-xs">
                                  {t('inventory.colorRequired', 'Color *')}
                                </Label>
	                                <Input
	                                  list="saved-variant-colors"
	                                  value={group.color}
	                                  onChange={(event) =>
	                                    updateVariantGroupColor(group.key, event.target.value)
	                                  }
	                                  placeholder={t('inventory.colorPlaceholder', 'e.g. Black')}
	                                />
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeVariantGroup(group.key)}
                                aria-label={t('inventory.removeColorGroup', 'Remove color group')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>

	                            {!group.color.trim() ? (
	                              <p className="text-xs text-muted-foreground">
	                                {t(
                                      'inventory.colorFirst',
                                      'Set the color first, then set quantity.'
                                    )}
	                              </p>
	                            ) : (
	                              <div className="space-y-2">
	                                {group.rows.length === 0 ? (
	                                  <div className="space-y-2">
	                                    <p className="text-xs text-muted-foreground">
	                                      {t(
                                            'inventory.sizeOptionalForColor',
                                            'Size is optional for this color.'
                                          )}
	                                    </p>
	                                    <div className="grid gap-2 rounded-md border bg-muted/20 p-2 sm:grid-cols-3">
	                                      <div>
	                                        <Label className="text-xs">
                                          {t('inventory.sizeOptional', 'Size (optional)')}
                                        </Label>
	                                        <Input
	                                          list="saved-variant-sizes"
	                                          value={group.colorOnlyRow?.size || ''}
                                          onChange={(event) =>
	                                            updateVariantGroupColorOnlyRow(group.key, {
	                                              size: event.target.value,
	                                            })
	                                          }
	                                          placeholder={t(
                                                'inventory.sizePlaceholder',
                                                'S, M, L, 42...'
                                              )}
	                                        />
	                                      </div>
	                                      <div>
	                                        <Label className="text-xs">
                                          {t('inventory.barcode', 'Barcode')}
                                        </Label>
	                                        <Input
	                                          value={group.colorOnlyRow?.barcode || ''}
                                          onChange={(event) =>
                                            updateVariantGroupColorOnlyRow(group.key, {
                                              barcode: event.target.value,
                                            })
                                          }
                                          placeholder={t('inventory.optional', 'Optional')}
                                        />
	                                      </div>
	                                      <div>
	                                        <Label className="text-xs">
                                          {t('inventory.quantity', 'Qty')}
                                        </Label>
	                                        <Input
	                                          type="number"
                                          min="0"
                                          step="1"
                                          value={group.colorOnlyRow ? group.colorOnlyRow.quantity : ''}
                                          onChange={(event) =>
                                            updateVariantGroupColorOnlyQuantity(group.key, event.target.value)
                                          }
                                          placeholder="0"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                ) : group.rows.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">
                                    {t('inventory.noSizesForColor', 'No sizes yet for this color.')}
                                  </p>
                                ) : (
                                  group.rows.map((row) => (
	                                    <div
	                                      key={row.key}
	                                      className="grid gap-2 rounded-md border bg-muted/20 p-2 md:grid-cols-[1.1fr_1fr_120px_40px]"
	                                    >
	                                      <div>
	                                        <Label className="text-xs">
                                          {t('inventory.sizeOptional', 'Size (optional)')}
                                        </Label>
	                                        <Input
	                                          list="saved-variant-sizes"
	                                          value={row.size}
                                          onChange={(event) =>
                                            updateVariantSizeRow(group.key, row.key, {
                                              size: event.target.value,
                                            })
                                          }
                                          placeholder={t('inventory.sizePlaceholder', 'S, M, L, 42...')}
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-xs">{t('inventory.barcode', 'Barcode')}</Label>
                                        <Input
                                          value={row.barcode}
                                          onChange={(event) =>
                                            updateVariantSizeRow(group.key, row.key, {
                                              barcode: event.target.value,
                                            })
                                          }
                                          placeholder={t('inventory.optional', 'Optional')}
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-xs">{t('inventory.quantity', 'Qty')}</Label>
                                        <Input
                                          type="number"
                                          min="0"
                                          step="1"
                                          value={row.quantity}
                                          onChange={(event) =>
                                            updateVariantSizeRow(group.key, row.key, {
                                              quantity: Math.max(
                                                0,
                                                Math.round(Number(event.target.value) || 0)
                                              ),
                                            })
                                          }
                                        />
                                      </div>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="self-end"
                                        onClick={() => removeVariantSizeRow(group.key, row.key)}
                                        aria-label="Remove size"
                                      >
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  ))
                                )}
	                                {!isEcommerceBusiness && (
	                                  <Button
	                                    type="button"
	                                    variant="outline"
	                                    size="sm"
	                                    onClick={() => addVariantSizeRow(group.key)}
	                                  >
	                                    <Plus className="w-4 h-4 mr-1" />
	                                    Add Size
	                                  </Button>
	                                )}
	                              </div>
	                            )}
	                          </div>
	                        ))}
	                      </div>
	                    )}
	                    <datalist id="saved-variant-colors">
	                      {savedVariantColors.map((color) => (
	                        <option key={color} value={color} />
	                      ))}
	                    </datalist>
	                    <datalist id="saved-variant-sizes">
	                      {savedVariantSizes.map((size) => (
	                        <option key={size} value={size} />
                      ))}
                    </datalist>
                  </>
                )}
              </div>
            )}

            <div className="rounded-lg border bg-card/30 p-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                <Label>{formMeasurementOption.quantityLabel} *</Label>
                <Input
                  type="number"
                  min="0"
                  step={formMeasurementOption.step}
                  value={isVariantQuantityAuto ? variantQuantityTotal : formData.quantity}
                  onChange={(e) => {
                    if (isVariantQuantityAuto) return;
                    setFormData({
                      ...formData,
                      quantity: isCountMeasurementType(formData.measurementType)
                        ? Math.round(Number(e.target.value) || 0)
                        : (Number(e.target.value) || 0),
                    });
                  }}
                  disabled={isVariantQuantityAuto}
                  required
                />
                {isVariantQuantityAuto && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Auto-synced from variant quantities.
                  </p>
                )}
                </div>
                <div className="space-y-2">
                <Label>{formMeasurementOption.minQuantityLabel}</Label>
                <Input
                  type="number"
                  min="0"
                  step={formMeasurementOption.step}
                  value={formData.minQuantity}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      minQuantity: isCountMeasurementType(formData.measurementType)
                        ? Math.round(Number(e.target.value) || 0)
                        : (Number(e.target.value) || 0),
                    })
                  }
                />
                </div>
                <div className="space-y-2">
                <Label>
                  {isWholesaleBusiness
                    ? t('inventory.defaultPriceRequired', 'Default Price *')
                    : t('inventory.priceRequired', 'Price *')}
                </Label>
                <Input
                  type="number"
                  min="0"
                  step={isDzdCurrency ? '1' : '0.01'}
                  value={formData.price}
                  onKeyDown={blockNonIntegerPriceKeys}
                  onPaste={blockNonIntegerPricePaste}
                  onChange={(e) => {
                    const parsedValue = parseCurrencyInput(e.target.value);
                    if (parsedValue === null) return;
                    setFormData({
                      ...formData,
                      price: parsedValue,
                      prices: {
                        ...formData.prices,
                        default: parsedValue,
                      }
                    });
                  }}
                  required
                />
                </div>
                {isWholesaleBusiness &&
                  PRICING_TIERS.filter((tier) => tier !== 'default').map((tier) => (
                    <div key={`product-price-${tier}`} className="space-y-2">
                      <Label>{t(`inventory.${tier}Price`, `${PRICING_TIER_LABELS[tier]} Price`)}</Label>
                      <Input
                        type="number"
                        min="0"
                        step={isDzdCurrency ? '1' : '0.01'}
                        value={formData.prices[tier]}
                        onKeyDown={blockNonIntegerPriceKeys}
                        onPaste={blockNonIntegerPricePaste}
                        onChange={(e) => {
                          const parsedValue = parseCurrencyInput(e.target.value);
                          if (parsedValue === null) return;
                          setFormData({
                            ...formData,
                            prices: {
                              ...formData.prices,
                              [tier]: parsedValue,
                            }
                          });
                        }}
                      />
                    </div>
                  ))}
                <div className="space-y-2">
                <Label>{t('inventory.secondPrice', 'Second Price')}</Label>
                <Input
                  type="number"
                  min="0"
                  step={isDzdCurrency ? '1' : '0.01'}
                  value={formData.secondPrice ?? ''}
                  onKeyDown={blockNonIntegerPriceKeys}
                  onPaste={blockNonIntegerPricePaste}
                  onChange={(e) => {
                    const parsedValue = parseOptionalCurrencyInput(e.target.value);
                    if (typeof parsedValue === 'undefined') return;
                    setFormData({
                      ...formData,
                      secondPrice: parsedValue,
                    });
                  }}
                />
                </div>
                <div className="space-y-2">
                <Label>{t('inventory.soldPercentOff', 'Sold % Off')}</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.soldDiscountPercent}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      soldDiscountPercent: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)),
                    })
                  }
                />
                </div>
                {canSeeProductCost && (
                  <div className="space-y-2">
                    <Label>{t('inventory.cost', 'Cost')}</Label>
                    <Input
                      type="number"
                      min="0"
                      step={isDzdCurrency ? '1' : '0.01'}
                      value={formData.cost}
                      onKeyDown={blockNonIntegerPriceKeys}
                      onPaste={blockNonIntegerPricePaste}
                      onChange={(e) => {
                        const parsedValue = parseCurrencyInput(e.target.value);
                        if (parsedValue === null) return;
                        setFormData({ ...formData, cost: parsedValue });
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {productFormError && (
              <p className="text-sm text-destructive">{productFormError}</p>
            )}

            <DialogFooter className="border-t pt-6">
              <Button type="button" variant="outline" onClick={closeProductModal} disabled={isSavingProduct}>
                {t('common.cancel', withArabicFallback('Cancel', 'إلغاء'))}
              </Button>
              <Button type="submit" disabled={isSavingProduct} aria-busy={isSavingProduct}>
                {isSavingProduct
                  ? t('common.loading', withArabicFallback('Loading...', 'جاري التحميل...'))
                  : (editingProduct
                    ? t('inventory.saveChanges', withArabicFallback('Save Changes', 'حفظ التعديلات'))
                    : t('inventory.addProduct', withArabicFallback('Add Product', 'إضافة منتج')))}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Product Details Modal */}
      <Dialog
        open={isProductDetailsOpen}
        onOpenChange={(open) => {
          setIsProductDetailsOpen(open);
          if (!open) {
            setSelectedProduct(null);
            setSelectedProductVariants([]);
          }
        }}
      >
        <DialogContent className="w-[95vw] max-w-xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('inventory.productDetails', 'Product details')}</DialogTitle>
            <DialogDescription>
              {selectedProduct ? selectedProduct.name : t('inventory.productName', 'Product')}
            </DialogDescription>
          </DialogHeader>

          {selectedProduct && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                {selectedProduct.primaryImage ? (
                  <img
                    src={selectedProduct.primaryImage}
                    alt={selectedProduct.name}
                    className="h-16 w-16 rounded-lg object-cover border"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-lg border bg-muted flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-lg font-semibold break-words">{selectedProduct.name}</p>
                  <p className="text-sm text-muted-foreground font-mono">{selectedProduct.sku || '-'}</p>
                  {selectedProduct.barcode && (
                    <p className="text-sm text-muted-foreground">{selectedProduct.barcode}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">{t('inventory.category', 'Category')}</p>
                  <p className="font-medium">{selectedProduct.category || '-'}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">{t('inventory.stockStatus', 'Status')}</p>
                  <div className="mt-1">{getStockStatusBadge(selectedProduct)}</div>
                </div>
                {supportsExpirationDate && (
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">
                      {t('inventory.expirationDate', 'Expiration Date')}
                    </p>
                    <p className="font-medium">{formatDateLabel(selectedProduct.expirationDate)}</p>
                  </div>
                )}
                {!isClothingRetailBusiness && (
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">
                      {t('inventory.productType', 'Product Type')}
                    </p>
                    <p className="font-medium">{getMeasurementOption(selectedProduct.measurementType).label}</p>
                  </div>
                )}
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">{t('inventory.quantity', 'Qty')}</p>
                  <p className="font-medium">
                    {formatStockQuantityLabel(selectedProduct)}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">{t('inventory.minQuantity', 'Min Qty')}</p>
                  <p className="font-medium">
                    {formatQuantityWithUnit(selectedProduct.minQuantity, selectedProduct.measurementType)}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">{t('inventory.price', 'Price')}</p>
                  <p className="font-medium">{formatCurrency(selectedProduct.price)}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">
                    {t('inventory.secondPrice', 'Second Price')}
                  </p>
                  <p className="font-medium">
                    {getProductMinimumSalePrice(selectedProduct) === null
                      ? '-'
                      : formatCurrency(getProductMinimumSalePrice(selectedProduct) || 0)}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">
                    {t('inventory.soldPercentOff', 'Sold % Off')}
                  </p>
                  <p className="font-medium">{getProductSoldDiscountPercent(selectedProduct)}%</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">
                    {t('inventory.soldPrice', 'Sold Price')}
                  </p>
                  <p className="font-medium">{formatCurrency(getDiscountedUnitPrice(selectedProduct))}</p>
                </div>
                {canSeeProductCost && (
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">{t('inventory.cost', 'Cost')}</p>
                    <p className="font-medium">{formatCurrency(selectedProduct.cost)}</p>
                  </div>
                )}
              </div>

              {supportsVariantProducts && (
                <div className="rounded-md border p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {t('inventory.variantMatrix', 'Variant Matrix')}
                  </p>
                  {selectedProductVariants.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t('inventory.noVariantsForProduct', 'No variants created yet for this product.')}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {selectedProductVariants.map((variant) => (
                        <div
                          key={variant._id}
                          className="rounded-md border bg-muted/20 px-3 py-2"
                        >
                          <p className="text-sm font-medium">{variant.variantSku}</p>
                          <p className="text-xs text-muted-foreground">
                            {t('inventory.variantSize', 'Size')}: {variant.size || '-'} |{' '}
                            {t('inventory.variantColor', 'Color')}: {variant.color || '-'} |{' '}
                            {t('inventory.variantQty', 'Qty')}: {variant.quantity} |{' '}
                            {t('inventory.barcode', 'Barcode')}: {variant.barcode || '-'} |{' '}
                            {t('inventory.variantPriceAdj', 'Price adj')}: {formatCurrency(variant.priceAdjustment || 0)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selectedProduct.description && (
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">{t('inventory.description', 'Description')}</p>
                  <p className="text-sm break-words">{selectedProduct.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <p>
                  {t('inventory.createdAt', 'Created at')}: {' '}
                  {selectedProduct.createdAt
                    ? new Date(selectedProduct.createdAt).toLocaleString()
                    : '-'}
                </p>
                <p>
                  {t('inventory.updatedAt', 'Updated at')}: {' '}
                  {selectedProduct.updatedAt
                    ? new Date(selectedProduct.updatedAt).toLocaleString()
                    : '-'}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeProductDetailsModal}>
              {t('common.close', 'Close')}
            </Button>
            {canEdit() && selectedProduct && (
              <Button
                onClick={() => {
                  setIsProductDetailsOpen(false);
                  openProductModal(selectedProduct);
                }}
              >
                <Edit className="w-4 h-4 mr-2" />
                {t('common.edit', 'Edit')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Sale Modal */}
      <Dialog
        open={isSaleModalOpen}
        onOpenChange={(open) => {
          setIsSaleModalOpen(open);
          if (!open) {
            setSellingProduct(null);
            setSaleVariants([]);
            setSelectedSaleVariantId('');
            setSaleFormError('');
          }
        }}
      >
        <DialogContent className="w-[95vw] max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t('ecommerce.quickSell', 'Quick Sale')} - {sellingProduct?.name}
            </DialogTitle>
            <DialogDescription>
              {t('ecommerce.available', 'Available')}: {formatQuantityWithUnit(
                maxQuickSaleQuantity || 0,
                sellingProduct?.measurementType
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleQuickSale} className="space-y-4">
            {supportsVariantProducts && saleVariants.length > 0 && (
              <div>
                <Label>{t('inventory.variantRequired', 'Variant *')}</Label>
                <Select
                  value={selectedSaleVariantId}
                  onValueChange={(value) => {
                    setSelectedSaleVariantId(value);
                    const nextVariant = saleVariants.find(
                      (variant) => String(variant._id) === value
                    );
                    const maxAllowed = Math.min(
                      sellingProduct?.quantity || 0,
                      nextVariant ? Number(nextVariant.quantity) || 0 : (sellingProduct?.quantity || 0)
                    );
                    const minAllowed = Math.min(
                      maxAllowed,
                      getMeasurementOption(sellingProduct?.measurementType).minPositive
                    );
                    setSaleForm((prev) => ({
                      ...prev,
                      quantity: Math.max(minAllowed, Math.min(maxAllowed, prev.quantity)),
                    }));
                    setSaleFormError('');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a variant" />
                  </SelectTrigger>
                  <SelectContent>
                    {saleVariants.map((variant) => (
                      <SelectItem key={variant._id} value={String(variant._id)}>
                        {variant.variantSku} | {variant.size || '-'} | {variant.color || '-'} | Qty{' '}
                        {variant.quantity} | Barcode {variant.barcode || '-'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>
                {isCountMeasurementType(sellingProduct?.measurementType || 'count')
                  ? t('ecommerce.quantity', 'Quantity')
                  : `${t('ecommerce.quantity', 'Quantity')} (${sellingMeasurementOption.unitLabel})`}
              </Label>
              <Input
                type="number"
                min={minQuickSaleQuantity}
                step={sellingMeasurementOption.step}
                max={maxQuickSaleQuantity}
                value={saleForm.quantity}
                onChange={(e) => {
                  const parsedValue = Number(e.target.value);
                  const fallbackQuantity = minQuickSaleQuantity;
                  const safeQuantity = Number.isFinite(parsedValue) ? parsedValue : fallbackQuantity;
                  setSaleForm({
                    ...saleForm,
                    quantity: isCountMeasurementType(sellingProduct?.measurementType || 'count')
                      ? Math.round(safeQuantity)
                      : safeQuantity,
                  });
                }}
                required
              />
            </div>
            <div>
              <Label>{t('inventory.price', 'Price')}</Label>
              <Input
                type="number"
                min={minQuickSaleUnitPrice ?? 0}
                step={isDzdCurrency ? '1' : '0.01'}
                value={saleForm.unitPrice}
                onKeyDown={blockNonIntegerPriceKeys}
                onPaste={blockNonIntegerPricePaste}
                onChange={(e) => {
                  const parsedValue = parseCurrencyInput(e.target.value);
                  if (parsedValue === null) return;
                  setSaleForm({ ...saleForm, unitPrice: parsedValue });
                }}
                required
              />
              {minQuickSaleUnitPrice !== null && minQuickSaleUnitPrice > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Min: {formatCurrency(minQuickSaleUnitPrice)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t('clients.savedClients', 'Saved Clients')}</Label>
              <Select value={selectedSaleClientKey} onValueChange={handleSaleClientSelection}>
                <SelectTrigger>
                  <SelectValue placeholder={t('clients.selectClient', 'Select a saved client')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={MANUAL_CLIENT_SELECT_VALUE}>
                    {t('clients.manualEntry', 'Type manually')}
                  </SelectItem>
                  {selectableClients.map((client) => (
                    <SelectItem key={`sale-client-${client.clientKey}`} value={client.clientKey}>
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
                value={saleForm.customerName}
                onChange={(e) => {
                  const nextName = e.target.value;
                  setSaleForm({ ...saleForm, customerName: nextName });
                  const matchedClient = findSavedClientByName(nextName);
                  setSelectedSaleClientKey(
                    matchedClient?.clientKey || MANUAL_CLIENT_SELECT_VALUE
                  );
                }}
                placeholder={
                  isEcommerceBusiness
                    ? t('ecommerce.customerNamePlaceholder', 'Enter customer name')
                    : t('ecommerce.walkInCustomer', 'Walk-in Customer')
                }
                required={isEcommerceBusiness}
              />
            </div>
            {!isEcommerceBusiness && !isSupermarketBusiness && (
              <div>
                <Label>{t('ecommerce.orderType', 'Order Type')}</Label>
                <Select
                  value={saleOrderType}
                  onValueChange={(value) => setSaleOrderType(value as OrderType)}
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
            )}
            {(isEcommerceBusiness ? 'shipped' : (isSupermarketBusiness ? 'walk_in' : saleOrderType)) === 'shipped' && (
              <div className="rounded-md border p-3 space-y-3">
                <p className="text-sm font-medium">
                  {t('ecommerce.shippingInformation', 'Shipping Information')}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>{t('ecommerce.phone', 'Phone')}</Label>
                    <Input
                      value={saleShipping.phone}
                      onChange={(e) =>
                        setSaleShipping((prev) => ({ ...prev, phone: e.target.value }))
                      }
                      placeholder={t('ecommerce.phonePlaceholder', 'Recipient phone')}
                    />
                  </div>
                  <div>
                    <Label>{t('ecommerce.deliveryType', 'Delivery Type')}</Label>
                    <Select
                      value={saleShipping.mode}
                      onValueChange={(value) =>
                        setSaleShipping((prev) => ({
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
                  <div>
                    <Label>{t('ecommerce.carrier', 'Carrier')}</Label>
                    <Select
                      value={saleShipping.carrier}
                      onValueChange={(value) =>
                        setSaleShipping((prev) => ({
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
                  {saleShipping.mode === 'domestic' && (
                    <div className="sm:col-span-2">
                      <Label>{t('ecommerce.streetAddress', 'Street Address')}</Label>
                      <Input
                        value={saleShipping.street}
                        onChange={(e) =>
                          setSaleShipping((prev) => ({ ...prev, street: e.target.value }))
                        }
                        required={
                          (isEcommerceBusiness ? 'shipped' : (isSupermarketBusiness ? 'walk_in' : saleOrderType)) === 'shipped'
                        }
                      />
                    </div>
                  )}
                  <div>
                    <Label>{t('ecommerce.wilaya', 'Wilaya')}</Label>
                    <Select
                      value={saleShipping.wilaya}
                      onValueChange={(value) =>
                        setSaleShipping((prev) => ({
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
                  <div>
                    <Label>{t('ecommerce.daira', 'Daira')}</Label>
                    <Select
                      value={saleShipping.daira}
                      onValueChange={(value) =>
                        setSaleShipping((prev) => ({
                          ...prev,
                          daira: value,
                          commune: '',
                        }))
                      }
                      disabled={!saleShipping.wilaya}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t(
                            'ecommerce.dairaPlaceholder',
                            saleShipping.wilaya ? 'Select daira' : 'Select wilaya first'
                          )}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {saleDairaOptions.map((daira) => (
                          <SelectItem key={daira} value={daira}>
                            {daira}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('ecommerce.commune', 'Commune')}</Label>
                    <Select
                      value={saleShipping.commune}
                      onValueChange={(value) =>
                        setSaleShipping((prev) => ({ ...prev, commune: value }))
                      }
                      disabled={!saleShipping.daira}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t(
                            'ecommerce.communePlaceholder',
                            saleShipping.daira ? 'Select commune' : 'Select daira first'
                          )}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {saleCommuneOptions.map((commune) => (
                          <SelectItem key={commune} value={commune}>
                            {commune}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('ecommerce.trackingNumber', 'Tracking #')}</Label>
                    <Input
                      value={saleShipping.trackingNumber}
                      onChange={(e) =>
                        setSaleShipping((prev) => ({ ...prev, trackingNumber: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>{t('ecommerce.shippingFee', 'Shipping Fee')}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={saleShipping.shippingCost}
                      onChange={(e) =>
                        setSaleShipping((prev) => ({
                          ...prev,
                          shippingCost: e.target.value,
                        }))
                      }
                      required={
                        (isEcommerceBusiness ? 'shipped' : (isSupermarketBusiness ? 'walk_in' : saleOrderType)) === 'shipped'
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>{t('ecommerce.notes', 'Notes')}</Label>
                    <Input
                      value={saleShipping.notes}
                      onChange={(e) =>
                        setSaleShipping((prev) => ({ ...prev, notes: e.target.value }))
                      }
                      placeholder={t('ecommerce.shippingNotesPlaceholder', 'Shipping notes (optional)')}
                    />
                  </div>
                </div>
              </div>
            )}
            {saleFormError && (
              <p className="text-sm text-destructive">{saleFormError}</p>
            )}
            <div className="bg-muted rounded-lg p-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('ecommerce.total', 'Total')}</span>
                <span className="text-xl font-bold">
                  {formatCurrency(
                    saleForm.quantity * saleForm.unitPrice +
                      ((isEcommerceBusiness ? 'shipped' : (isSupermarketBusiness ? 'walk_in' : saleOrderType)) === 'shipped'
                        ? Number(saleShipping.shippingCost) || 0
                        : 0)
                  )}
                </span>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSaleModalOpen(false)}
                disabled={isRecordingQuickSale}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-[#001EF4] to-[#001EF4]"
                disabled={isRecordingQuickSale}
                aria-busy={isRecordingQuickSale}
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                {isRecordingQuickSale
                  ? t('common.loading', 'Loading...')
                  : t('inventory.completeSale', 'Complete Sale')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Sale Modal */}
      <Dialog
        open={isBulkSaleModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeBulkSaleModal();
          } else {
            setIsBulkSaleModalOpen(true);
          }
        }}
      >
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('inventory.bulkSellTitle', 'Bulk Sell Selected Products')}</DialogTitle>
            <DialogDescription>
              {t(
                'inventory.bulkSellDesc',
                'Create one sale from all selected in-stock products.'
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleBulkSale} className="flex flex-col gap-4">
            {bulkSaleItems.length === 0 ? (
              <div className="border rounded-md p-4 text-center text-sm text-muted-foreground">
                {t('inventory.noProductsSelectedForSale', 'No in-stock products selected')}
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/20 p-2">
                <div className="hidden sm:grid grid-cols-[minmax(0,1.4fr)_110px_140px_140px_40px] gap-3 px-2 py-1 text-xs font-medium text-muted-foreground">
                  <span>{t('inventory.productName', 'Product')}</span>
                  <span>{t('ecommerce.quantity', 'Quantity')}</span>
                  <span>{t('inventory.price', 'Price')}</span>
                  <span className={isRTL ? 'text-left' : 'text-right'}>{t('ecommerce.total', 'Total')}</span>
                  <span />
                </div>
                <div className="space-y-2 max-h-[42vh] overflow-y-auto pr-1">
                  {bulkSaleItems.map((item) => {
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
                        className="rounded-md border bg-background p-3 grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_110px_140px_140px_40px] sm:items-end"
                      >
                        <div className="min-w-0 space-y-2">
                          <div>
                            <p className="font-medium truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.sku || '-'} - {t('ecommerce.available', 'Available')}:{' '}
                              {formatQuantityWithUnit(maxAllowedQuantity, item.measurementType)}
                            </p>
                          </div>
                          {supportsVariantProducts && item.variants.length > 0 && (
                            <div className="space-y-1">
                              <Label className="text-xs">
                                {t('inventory.variant', 'Variant')}
                              </Label>
                              <Select
                                value={item.variantId || undefined}
                                onValueChange={(value) => {
                                  updateBulkSaleItemVariant(item.productId, value);
                                  setBulkSaleError('');
                                }}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Select variant" />
                                </SelectTrigger>
                                <SelectContent>
                                  {item.variants.map((variant) => (
                                    <SelectItem key={variant._id} value={String(variant._id)}>
                                      {variant.variantSku} | {variant.size || '-'} | {variant.color || '-'} | Qty{' '}
                                      {variant.quantity} | Barcode {variant.barcode || '-'}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs sm:sr-only">{t('ecommerce.quantity', 'Quantity')}</Label>
                          <Input
                            className="h-9"
                            type="number"
                            min={minAllowedQuantity}
                            step={getMeasurementOption(item.measurementType).step}
                            max={maxAllowedQuantity}
                            value={item.quantity}
                            onChange={(e) =>
                              updateBulkSaleItemQuantity(
                                item.productId,
                                Number(e.target.value) || getMeasurementOption(item.measurementType).minPositive
                              )
                            }
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs sm:sr-only">{t('inventory.price', 'Price')}</Label>
                          <Input
                            className="h-9"
                            type="number"
                            min={item.minimumUnitPrice ?? 0}
                            step={isDzdCurrency ? '1' : '0.01'}
                            value={item.unitPrice}
                            onKeyDown={blockNonIntegerPriceKeys}
                            onPaste={blockNonIntegerPricePaste}
                            onChange={(e) => {
                              const parsedValue = parseCurrencyInput(e.target.value);
                              if (parsedValue === null) return;
                              updateBulkSaleItemPrice(item.productId, parsedValue);
                            }}
                            required
                          />
                          {item.minimumUnitPrice !== null && item.minimumUnitPrice > 0 && (
                            <p className="text-[11px] text-muted-foreground">
                              Min: {formatCurrency(item.minimumUnitPrice)}
                            </p>
                          )}
                        </div>
                        <div className={isRTL ? 'text-left' : 'text-right'}>
                          <p className="text-xs text-muted-foreground sm:hidden">{t('ecommerce.total', 'Total')}</p>
                          <p className="font-semibold">{formatCurrency(item.quantity * item.unitPrice)}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 justify-self-end"
                          onClick={() => removeBulkSaleItem(item.productId)}
                          aria-label={t('ecommerce.removeItem', 'Remove item')}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {bulkSaleError && (
              <p className="text-sm text-destructive">{bulkSaleError}</p>
            )}

            <div className="space-y-2">
              <Label>{t('clients.savedClients', 'Saved Clients')}</Label>
              <Select value={selectedBulkClientKey} onValueChange={handleBulkClientSelection}>
                <SelectTrigger>
                  <SelectValue placeholder={t('clients.selectClient', 'Select a saved client')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={MANUAL_CLIENT_SELECT_VALUE}>
                    {t('clients.manualEntry', 'Type manually')}
                  </SelectItem>
                  {selectableClients.map((client) => (
                    <SelectItem key={`bulk-client-${client.clientKey}`} value={client.clientKey}>
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
                value={bulkSaleCustomerName}
                onChange={(e) => {
                  const nextName = e.target.value;
                  setBulkSaleCustomerName(nextName);
                  const matchedClient = findSavedClientByName(nextName);
                  setSelectedBulkClientKey(
                    matchedClient?.clientKey || MANUAL_CLIENT_SELECT_VALUE
                  );
                }}
                placeholder={
                  isEcommerceBusiness
                    ? t('ecommerce.customerNamePlaceholder', 'Enter customer name')
                    : t('ecommerce.walkInCustomer', 'Walk-in Customer')
                }
                required={isEcommerceBusiness}
              />
            </div>
            {!isEcommerceBusiness && !isSupermarketBusiness && (
              <div>
                <Label>{t('ecommerce.orderType', 'Order Type')}</Label>
                <Select
                  value={bulkSaleOrderType}
                  onValueChange={(value) => setBulkSaleOrderType(value as OrderType)}
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
            )}

            {(isEcommerceBusiness ? 'shipped' : (isSupermarketBusiness ? 'walk_in' : bulkSaleOrderType)) === 'shipped' && (
              <div className="rounded-md border p-3 space-y-3">
                <p className="text-sm font-medium">
                  {t('ecommerce.shippingInformation', 'Shipping Information')}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>{t('ecommerce.phone', 'Phone')}</Label>
                    <Input
                      value={bulkSaleShipping.phone}
                      onChange={(e) =>
                        setBulkSaleShipping((prev) => ({ ...prev, phone: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>{t('ecommerce.deliveryType', 'Delivery Type')}</Label>
                    <Select
                      value={bulkSaleShipping.mode}
                      onValueChange={(value) =>
                        setBulkSaleShipping((prev) => ({
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
                  <div>
                    <Label>{t('ecommerce.carrier', 'Carrier')}</Label>
                    <Select
                      value={bulkSaleShipping.carrier}
                      onValueChange={(value) =>
                        setBulkSaleShipping((prev) => ({
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
                  {bulkSaleShipping.mode === 'domestic' && (
                    <div className="sm:col-span-2">
                      <Label>{t('ecommerce.streetAddress', 'Street Address')}</Label>
                      <Input
                        value={bulkSaleShipping.street}
                        onChange={(e) =>
                          setBulkSaleShipping((prev) => ({ ...prev, street: e.target.value }))
                        }
                        required={
                          (isEcommerceBusiness ? 'shipped' : (isSupermarketBusiness ? 'walk_in' : bulkSaleOrderType)) === 'shipped'
                        }
                      />
                    </div>
                  )}
                  <div>
                    <Label>{t('ecommerce.wilaya', 'Wilaya')}</Label>
                    <Select
                      value={bulkSaleShipping.wilaya}
                      onValueChange={(value) =>
                        setBulkSaleShipping((prev) => ({
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
                  <div>
                    <Label>{t('ecommerce.daira', 'Daira')}</Label>
                    <Select
                      value={bulkSaleShipping.daira}
                      onValueChange={(value) =>
                        setBulkSaleShipping((prev) => ({
                          ...prev,
                          daira: value,
                          commune: '',
                        }))
                      }
                      disabled={!bulkSaleShipping.wilaya}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t(
                            'ecommerce.dairaPlaceholder',
                            bulkSaleShipping.wilaya ? 'Select daira' : 'Select wilaya first'
                          )}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {bulkSaleDairaOptions.map((daira) => (
                          <SelectItem key={daira} value={daira}>
                            {daira}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('ecommerce.commune', 'Commune')}</Label>
                    <Select
                      value={bulkSaleShipping.commune}
                      onValueChange={(value) =>
                        setBulkSaleShipping((prev) => ({ ...prev, commune: value }))
                      }
                      disabled={!bulkSaleShipping.daira}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t(
                            'ecommerce.communePlaceholder',
                            bulkSaleShipping.daira ? 'Select commune' : 'Select daira first'
                          )}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {bulkSaleCommuneOptions.map((commune) => (
                          <SelectItem key={commune} value={commune}>
                            {commune}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('ecommerce.trackingNumber', 'Tracking #')}</Label>
                    <Input
                      value={bulkSaleShipping.trackingNumber}
                      onChange={(e) =>
                        setBulkSaleShipping((prev) => ({
                          ...prev,
                          trackingNumber: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label>{t('ecommerce.shippingFee', 'Shipping Fee')}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={bulkSaleShipping.shippingCost}
                      onChange={(e) =>
                        setBulkSaleShipping((prev) => ({
                          ...prev,
                          shippingCost: e.target.value,
                        }))
                      }
                      required={
                        (isEcommerceBusiness ? 'shipped' : (isSupermarketBusiness ? 'walk_in' : bulkSaleOrderType)) === 'shipped'
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>{t('ecommerce.notes', 'Notes')}</Label>
                    <Input
                      value={bulkSaleShipping.notes}
                      onChange={(e) =>
                        setBulkSaleShipping((prev) => ({ ...prev, notes: e.target.value }))
                      }
                      placeholder={t('ecommerce.shippingNotesPlaceholder', 'Shipping notes (optional)')}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="bg-muted rounded-lg p-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('ecommerce.total', 'Total')}</span>
                <span className="text-xl font-bold">{formatCurrency(bulkSaleGrandTotal)}</span>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeBulkSaleModal}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="submit" disabled={bulkSaleItems.length === 0}>
                <ShoppingCart className="w-4 h-4 mr-2" />
                {t('inventory.completeSale', 'Complete Sale')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('inventory.deleteProductTitle', 'Delete Product')}</DialogTitle>
            <DialogDescription>
              {t(
                'inventory.deleteProductDesc',
                'Are you sure you want to delete "{{name}}"? This action cannot be undone.',
                { name: deletingProduct?.name || '' }
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t('common.delete', 'Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Modal */}
      <Dialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('inventory.bulkDeleteTitle', 'Delete Selected Products')}</DialogTitle>
            <DialogDescription>
              {t('inventory.bulkDeleteDesc', 'Are you sure you want to delete the selected products? This action cannot be undone.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkDeleteOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete}>
              {t('inventory.bulkDeleteConfirm', 'Delete Selected')} ({selectedProductIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Barcode Scanner */}
      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => {
          setIsScannerOpen(false);
          if (resumeProductModal) {
            setIsProductModalOpen(true);
            setResumeProductModal(false);
            setScanTarget('inventory');
          }
        }}
        onScan={handleScan}
        mode="callback"
      />

      {/* Scan Result Modal */}
      <Dialog open={isScanResultOpen} onOpenChange={setIsScanResultOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('inventory.scanResultTitle', 'Scan Result')}</DialogTitle>
            <DialogDescription>
              {scanResult?.product
                ? t('inventory.scanResultFoundDesc', 'Product found for the scanned barcode.')
                : t('inventory.scanResultNotFoundDesc', 'No product found for this barcode.')}
            </DialogDescription>
          </DialogHeader>

          {scanResult?.product ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {scanResult.product.primaryImage ? (
                  <img
                    src={scanResult.product.primaryImage}
                    alt={scanResult.product.name}
                    className="w-14 h-14 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-14 h-14 bg-muted rounded-lg flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="font-semibold">{scanResult.product.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('inventory.sku', 'SKU')}: {scanResult.product.sku || '-'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">{t('inventory.barcode', 'Barcode')}</p>
                  <p className="font-mono">{scanResult.barcode}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('inventory.category', 'Category')}</p>
                  <p>{scanResult.product.category}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('inventory.quantity', 'Quantity')}</p>
                  <p>{formatStockQuantityLabel(scanResult.product)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('inventory.price', 'Price')}</p>
                  <p>{formatCurrency(scanResult.product.price)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-md border border-red-200 bg-red-50 text-red-800 p-3 text-sm flex gap-2 items-start">
                <AlertTriangle className="w-4 h-4 mt-[2px]" />
                <div className="space-y-1">
                  <p className="font-medium">{t('inventory.productNotFoundTitle', 'Product not found')}</p>
                  <p className="text-red-900/80">
                    {t(
                      'inventory.productNotFoundDesc',
                      "We couldn't find a product with this barcode. You can retry scanning or create it now."
                    )}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('inventory.barcode', 'Barcode')}: <span className="font-mono">{scanResult?.barcode}</span>
              </p>
            </div>
          )}

          <DialogFooter>
            {scanResult?.product ? (
              <>
                <Button variant="outline" onClick={() => setIsScanResultOpen(false)}>
                  {t('common.close', 'Close')}
                </Button>
                {canEdit() && (
                  <Button
                    onClick={() => {
                      if (!scanResult?.product) return;
                      setIsScanResultOpen(false);
                      openProductModal(scanResult.product);
                    }}
                  >
                    {t('inventory.editProduct', 'Edit Product')}
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsScanResultOpen(false);
                    setScanTarget('inventory');
                    setIsScannerOpen(true);
                  }}
                >
                  {t('scanner.retry', 'Retry')}
                </Button>
                <Button
                  onClick={() => {
                    if (!scanResult?.barcode) return;
                    setIsScanResultOpen(false);
                    openProductModal(undefined, scanResult.barcode);
                  }}
                >
                  {t('scanner.createProduct', 'Create Product')}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Products Modal */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('inventory.importProducts', 'Import Products')}</DialogTitle>
            <DialogDescription>
              {isClothingRetailBusiness
                ? t(
                    'inventory.importDescClothing',
                    canSeeProductCost
                      ? 'Upload CSV, Excel, or JSON with product fields like Name, SKU(optional), Barcode, Category, Quantity, Min Quantity, Price, Second Price(optional), Sold % Off(optional), Cost.'
                      : 'Upload CSV, Excel, or JSON with product fields like Name, SKU(optional), Barcode, Category, Quantity, Min Quantity, Price, Second Price(optional), Sold % Off(optional).'
                  )
                : t(
                    'inventory.importDesc',
                    canSeeProductCost
                      ? 'Upload CSV, Excel, or JSON with product fields like Name, SKU(optional), Barcode, Category, Product Type(count/kg/meter), Quantity, Min Quantity, Price, Second Price(optional), Sold % Off(optional), Cost.'
                      : 'Upload CSV, Excel, or JSON with product fields like Name, SKU(optional), Barcode, Category, Product Type(count/kg/meter), Quantity, Min Quantity, Price, Second Price(optional), Sold % Off(optional).'
                  )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="products-import-file">{t('inventory.importFile', 'Upload file')}</Label>
              <Input
                id="products-import-file"
                type="file"
                accept=".csv,.json,.xls,.xlsx,text/csv,application/json,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleImportFile}
              />
              {importFileName ? (
                <p className="text-sm text-muted-foreground">
                  {t('inventory.fileSelected', 'Selected file')}: <span className="font-medium">{importFileName}</span>
                  {importRows.length > 1 ? ` (${importRows.length - 1} ${t('inventory.rows', 'rows')})` : ''}
                </p>
              ) : null}
            </div>
            {importResults && (
              <div className="bg-muted rounded-lg p-4 space-y-2 max-h-72 overflow-y-auto">
                <p className="text-muted-foreground">{t('inventory.totalRows', 'Total Rows')}: {importResults.totalRows}</p>
                <p className="text-green-600">{t('inventory.created', 'Created')}: {importResults.created}</p>
                <p className="text-blue-600">{t('inventory.updated', 'Updated')}: {importResults.updated}</p>
                <p className="text-emerald-600">{t('inventory.imported', 'Imported')}: {importResults.imported}</p>
                {importResults.skipped.length > 0 && (
                  <div className="mt-2">
                    <p className="text-orange-600">{t('inventory.skipped', 'Skipped')}: {importResults.skipped.length}</p>
                    <ul className="text-sm text-orange-500 mt-1">
                      {importResults.skipped.slice(0, 5).map((item, i) => (
                        <li key={i}>Row {item.row}: {item.reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {importResults.unmappedHeaders.length > 0 && (
                  <div className="mt-2">
                    <p className="text-amber-600">{t('inventory.unmapped', 'Unmapped Columns')}: {importResults.unmappedHeaders.length}</p>
                    <ul className="text-sm text-amber-500 mt-1">
                      {importResults.unmappedHeaders.slice(0, 5).map((item, i) => (
                        <li key={i}>{item.header}: {item.reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {importResults.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-red-600">{t('inventory.errors', 'Errors')}: {importResults.errors.length}</p>
                    <ul className="text-sm text-red-500 mt-1">
                      {importResults.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>{err.sku}: {err.error}</li>
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
                setIsImportModalOpen(false);
                setImportRows([]);
                setImportFileName('');
                setImportResults(null);
              }}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleImportProducts} disabled={importRows.length < 2 || isImportingProducts}>
              <FileUp className="w-4 h-4 mr-2" />
              {isImportingProducts
                ? t('inventory.importing', 'Importing...')
                : t('inventory.import', 'Import')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <StockTransferDialog
        product={transferProduct}
        open={transferProduct !== null}
        onClose={() => setTransferProduct(null)}
        onSuccess={() => {
          setTransferProduct(null);
          fetchProducts();
        }}
      />
    </div>
  );
};

export default InventoryPage;

