import type {
  ApiResponse,
  CreateSaleData,
  PaginatedResponse,
  Product,
  ProductFilters,
  QuickSaleData,
  Sale,
  SaleFilters,
} from '@/types';
import { isDesktopRuntime, isOnline } from '@/shared/platform/platform';

type OfflineStatus = 'created' | 'updated' | 'deleted' | 'synced';

export type OfflineProduct = Product & {
  __offline?: {
    status: OfflineStatus;
    queuedAt: string;
  };
};

export type OfflineSale = Sale & {
  __offline?: {
    status: OfflineStatus;
    queuedAt: string;
  };
};

export type OfflineWrite = {
  id: string;
  method: 'post' | 'put' | 'patch' | 'delete';
  url: string;
  data?: unknown;
  entity: 'product' | 'sale' | 'api';
  action: string;
  localId?: string;
  createdAt: string;
  attempts: number;
  lastError?: string;
};

const CURRENT_STOCK_STORAGE_KEY = 'currentStockId';
const DESKTOP_AUTH_USER_STORAGE_KEY = 'stockly:desktop-auth-user';
const PRODUCT_STORE_PREFIX = 'stockly:desktop-products:';
const SALE_STORE_PREFIX = 'stockly:desktop-sales:';
const QUEUE_STORE_PREFIX = 'stockly:desktop-write-queue:';
const ID_MAP_PREFIX = 'stockly:desktop-id-map:';

export const isDesktopOffline = () => isDesktopRuntime() && !isOnline();
export const isDesktopOnline = () => isDesktopRuntime() && isOnline();

const nowIso = () => new Date().toISOString();

const createLocalId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const getCachedUser = (): { id?: string } | null => {
  if (typeof localStorage === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(DESKTOP_AUTH_USER_STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
};

export const getDesktopStockKey = () => {
  if (typeof localStorage === 'undefined') return 'default';
  return (
    localStorage.getItem(CURRENT_STOCK_STORAGE_KEY) ||
    getCachedUser()?.id ||
    'default'
  );
};

const readJson = <T,>(key: string, fallback: T): T => {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const rawValue = localStorage.getItem(key);
    return rawValue ? (JSON.parse(rawValue) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
};

const productStoreKey = () => `${PRODUCT_STORE_PREFIX}${getDesktopStockKey()}`;
const saleStoreKey = () => `${SALE_STORE_PREFIX}${getDesktopStockKey()}`;
const queueStoreKey = () => `${QUEUE_STORE_PREFIX}${getDesktopStockKey()}`;
const idMapKey = () => `${ID_MAP_PREFIX}${getDesktopStockKey()}`;

export const readOfflineProducts = (): OfflineProduct[] =>
  readJson<OfflineProduct[]>(productStoreKey(), []);

export const writeOfflineProducts = (products: OfflineProduct[]) => {
  writeJson(productStoreKey(), products);
};

export const readOfflineSales = (): OfflineSale[] =>
  readJson<OfflineSale[]>(saleStoreKey(), []);

export const writeOfflineSales = (sales: OfflineSale[]) => {
  writeJson(saleStoreKey(), sales);
};

export const readOfflineQueue = (): OfflineWrite[] =>
  readJson<OfflineWrite[]>(queueStoreKey(), []);

export const writeOfflineQueue = (queue: OfflineWrite[]) => {
  writeJson(queueStoreKey(), queue);
};

export const readOfflineIdMap = (): Record<string, string> =>
  readJson<Record<string, string>>(idMapKey(), {});

export const rememberOfflineIdMapping = (localId: string, remoteId: string) => {
  const map = readOfflineIdMap();
  map[localId] = remoteId;
  writeJson(idMapKey(), map);
};

export const resolveOfflineId = (id: string) => readOfflineIdMap()[id] || id;

export const enqueueOfflineWrite = (
  write: Omit<OfflineWrite, 'id' | 'createdAt' | 'attempts'>,
) => {
  const queue = readOfflineQueue();
  queue.push({
    ...write,
    id: createLocalId('write'),
    createdAt: nowIso(),
    attempts: 0,
  });
  writeOfflineQueue(queue);
};

export const markOfflineWriteFailed = (writeId: string, error: string) => {
  writeOfflineQueue(
    readOfflineQueue().map((item) =>
      item.id === writeId
        ? {
            ...item,
            attempts: item.attempts + 1,
            lastError: error,
          }
        : item,
    ),
  );
};

const removeQueuedWritesForLocalId = (localId: string) => {
  writeOfflineQueue(
    readOfflineQueue().filter((item) => String(item.localId) !== String(localId)),
  );
};

const productStockStatus = (product: Pick<Product, 'quantity' | 'minQuantity'>) => {
  if (Number(product.quantity) <= 0) return 'out_of_stock';
  if (Number(product.quantity) <= Number(product.minQuantity || 0)) return 'low_stock';
  return 'in_stock';
};

const normalizeProduct = (
  input: Partial<Product>,
  existing?: OfflineProduct,
): OfflineProduct => {
  const timestamp = nowIso();
  const quantity = Number(input.quantity ?? existing?.quantity ?? 0);
  const minQuantity = Number(input.minQuantity ?? existing?.minQuantity ?? 1);
  const price = Number(input.price ?? existing?.price ?? 0);
  const cost = Number(input.cost ?? existing?.cost ?? 0);
  const images = input.images ?? existing?.images ?? [];
  const product = {
    ...existing,
    ...input,
    _id: String(input._id || existing?._id || createLocalId('product')),
    user: String(input.user || existing?.user || getCachedUser()?.id || ''),
    name: String(input.name || existing?.name || 'Untitled product'),
    sku: String(input.sku ?? existing?.sku ?? '').trim().toUpperCase(),
    barcode: input.barcode ?? existing?.barcode,
    description: input.description ?? existing?.description ?? '',
    category: String(input.category || existing?.category || 'Uncategorized'),
    measurementType: input.measurementType ?? existing?.measurementType ?? 'count',
    quantity,
    minQuantity,
    price,
    prices: input.prices ?? existing?.prices ?? { default: price },
    secondPrice: input.secondPrice ?? existing?.secondPrice ?? null,
    soldDiscountPercent:
      input.soldDiscountPercent ?? existing?.soldDiscountPercent ?? 0,
    expirationDate: input.expirationDate ?? existing?.expirationDate ?? null,
    cost,
    images,
    primaryImage:
      input.primaryImage ||
      existing?.primaryImage ||
      images.find((image) => image.isPrimary)?.url ||
      images[0]?.url,
    salesCount: Number(input.salesCount ?? existing?.salesCount ?? 0),
    revenue: Number(input.revenue ?? existing?.revenue ?? 0),
    isActive: input.isActive ?? existing?.isActive ?? true,
    isListed: input.isListed ?? existing?.isListed ?? false,
    location: input.location ?? existing?.location,
    tags: input.tags ?? existing?.tags ?? [],
    weight: input.weight ?? existing?.weight ?? 0,
    dimensions: input.dimensions ?? existing?.dimensions,
    createdAt: existing?.createdAt || input.createdAt || timestamp,
    updatedAt: timestamp,
  } as OfflineProduct;

  product.stockStatus = productStockStatus(product);
  product.totalValue = Number((quantity * cost).toFixed(2));
  return product;
};

const upsertOfflineProduct = (product: OfflineProduct) => {
  const products = readOfflineProducts();
  const index = products.findIndex((item) => String(item._id) === String(product._id));
  if (index >= 0) {
    products[index] = product;
  } else {
    products.unshift(product);
  }
  writeOfflineProducts(products);
};

export const seedOfflineProductsFromRemote = (products: Product[]) => {
  if (!isDesktopRuntime()) return;
  const localProducts = readOfflineProducts();
  const pendingProducts = localProducts.filter(
    (product) => product.__offline && product.__offline.status !== 'synced',
  );
  const pendingIds = new Set(pendingProducts.map((product) => String(product._id)));
  const remoteIds = new Set(products.map((product) => String(product._id)));
  const existingSynced = localProducts.filter(
    (product) => !product.__offline && !remoteIds.has(String(product._id)),
  );
  const merged = [
    ...pendingProducts,
    ...products
      .map((product) => normalizeProduct(product))
      .filter((product) => !pendingIds.has(String(product._id))),
    ...existingSynced,
  ];
  writeOfflineProducts(merged);
};

export const markOfflineProductSynced = (localId: string, remote: Product) => {
  rememberOfflineIdMapping(localId, remote._id);
  const products = readOfflineProducts()
    .filter((product) => String(product._id) !== String(localId))
    .map((product) =>
      String(product._id) === String(remote._id)
        ? normalizeProduct(remote)
        : product,
    );
  products.unshift(normalizeProduct(remote));
  writeOfflineProducts(dedupeById(products));
};

export const markOfflineProductWriteSynced = (localId: string, action?: string) => {
  if (action === 'deleteProduct') {
    writeOfflineProducts(
      readOfflineProducts().filter((product) => String(product._id) !== String(localId)),
    );
    return;
  }
  writeOfflineProducts(
    readOfflineProducts().map((product) =>
      String(product._id) === String(localId)
        ? ({ ...product, __offline: undefined } as OfflineProduct)
        : product,
    ),
  );
};

export const getOfflineProduct = (id: string) =>
  readOfflineProducts().find((product) => String(product._id) === String(id)) || null;

export const findOfflineProductByBarcode = (barcode: string) =>
  readOfflineProducts().find(
    (product) =>
      product.__offline?.status !== 'deleted' &&
      String(product.barcode || '').trim() === String(barcode || '').trim(),
  ) || null;

export const createOfflineProduct = (input: Partial<Product>) => {
  const product = normalizeProduct(input);
  product.__offline = { status: 'created', queuedAt: nowIso() };
  upsertOfflineProduct(product);
  enqueueOfflineWrite({
    method: 'post',
    url: '/products',
    data: input,
    entity: 'product',
    action: 'createProduct',
    localId: product._id,
  });
  return product;
};

export const updateOfflineProduct = (id: string, input: Partial<Product>) => {
  const existing = getOfflineProduct(id) || normalizeProduct({ _id: id, ...input });
  const product = normalizeProduct(input, existing);
  product.__offline = {
    status: existing.__offline?.status === 'created' ? 'created' : 'updated',
    queuedAt: nowIso(),
  };
  upsertOfflineProduct(product);
  enqueueOfflineWrite({
    method: 'put',
    url: `/products/${id}`,
    data: input,
    entity: 'product',
    action: 'updateProduct',
    localId: id,
  });
  return product;
};

export const deleteOfflineProduct = (id: string) => {
  const products = readOfflineProducts();
  const target = products.find((product) => String(product._id) === String(id));
  if (target?.__offline?.status === 'created') {
    writeOfflineProducts(products.filter((product) => String(product._id) !== String(id)));
    removeQueuedWritesForLocalId(id);
  } else {
    writeOfflineProducts(
      products.map((product) =>
        String(product._id) === String(id)
          ? {
              ...product,
              isActive: false,
              __offline: { status: 'deleted', queuedAt: nowIso() },
            }
          : product,
      ),
    );
    enqueueOfflineWrite({
      method: 'delete',
      url: `/products/${id}`,
      entity: 'product',
      action: 'deleteProduct',
      localId: id,
    });
  }
};

export const applyOfflineProductStock = (
  id: string,
  quantity: number,
  operation: 'set' | 'add' | 'subtract' = 'set',
) => {
  const existing = getOfflineProduct(id);
  if (!existing) return null;
  const currentQuantity = Number(existing.quantity || 0);
  const nextQuantity =
    operation === 'add'
      ? currentQuantity + quantity
      : operation === 'subtract'
        ? Math.max(0, currentQuantity - quantity)
        : Math.max(0, quantity);
  const product = normalizeProduct({ quantity: nextQuantity }, existing);
  product.__offline = {
    status: existing.__offline?.status === 'created' ? 'created' : 'updated',
    queuedAt: nowIso(),
  };
  upsertOfflineProduct(product);
  return product;
};

export const updateOfflineProductStock = (
  id: string,
  quantity: number,
  operation: 'set' | 'add' | 'subtract' = 'set',
) => {
  const product = applyOfflineProductStock(id, quantity, operation);
  if (!product) return null;
  enqueueOfflineWrite({
    method: 'patch',
    url: `/products/${id}/stock`,
    data: { quantity, operation },
    entity: 'product',
    action: 'updateStock',
    localId: id,
  });
  return product;
};

const dedupeById = <T extends { _id: string }>(items: T[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const id = String(item._id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const sortProducts = (products: OfflineProduct[], sort = '-createdAt') => {
  const descending = sort.startsWith('-');
  const field = descending ? sort.slice(1) : sort;
  return [...products].sort((left, right) => {
    const a = left[field as keyof Product];
    const b = right[field as keyof Product];
    const result =
      typeof a === 'number' && typeof b === 'number'
        ? a - b
        : String(a || '').localeCompare(String(b || ''));
    return descending ? -result : result;
  });
};

export const getOfflineProductsPage = (
  filters?: ProductFilters,
): ApiResponse<PaginatedResponse<Product>> => {
  const search = String(filters?.search || '').trim().toLowerCase();
  const category = filters?.category && filters.category !== 'all' ? filters.category : '';
  const stockStatus = filters?.stockStatus;
  const page = Number(filters?.page || 1);
  const limit = Number(filters?.limit || 20);
  const products = sortProducts(
    readOfflineProducts().filter((product) => {
      if (product.__offline?.status === 'deleted' || !product.isActive) return false;
      if (category && product.category !== category) return false;
      if (stockStatus && productStockStatus(product) !== stockStatus) return false;
      if (search) {
        const haystack = [
          product.name,
          product.sku,
          product.barcode,
          product.category,
          product.description,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    }),
    filters?.sort,
  );
  const start = (page - 1) * limit;
  const paged = products.slice(start, start + limit);
  return {
    success: true,
    data: {
      products: paged,
      pagination: {
        page,
        limit,
        total: products.length,
        pages: Math.max(1, Math.ceil(products.length / limit)),
      },
    },
  };
};

export const getOfflineCategories = (): ApiResponse<{ categories: string[] }> => ({
  success: true,
  data: {
    categories: Array.from(
      new Set(
        readOfflineProducts()
          .filter((product) => product.__offline?.status !== 'deleted')
          .map((product) => product.category)
          .filter(Boolean),
      ),
    ).sort(),
  },
});

export const seedOfflineSalesFromRemote = (sales: Sale[]) => {
  if (!isDesktopRuntime()) return;
  const localSales = readOfflineSales();
  const pendingSales = localSales.filter(
    (sale) => sale.__offline && sale.__offline.status !== 'synced',
  );
  const pendingIds = new Set(pendingSales.map((sale) => String(sale._id)));
  const remoteIds = new Set(sales.map((sale) => String(sale._id)));
  const existingSynced = localSales.filter(
    (sale) => !sale.__offline && !remoteIds.has(String(sale._id)),
  );
  writeOfflineSales([
    ...pendingSales,
    ...sales.filter((sale) => !pendingIds.has(String(sale._id))),
    ...existingSynced,
  ]);
};

export const getOfflineSale = (id: string) =>
  readOfflineSales().find((sale) => String(sale._id) === String(id)) || null;

const getSaleItemProductId = (product: unknown) => {
  if (typeof product === 'string' || typeof product === 'number') {
    return String(product);
  }
  if (product && typeof product === 'object') {
    const value = product as { _id?: unknown; id?: unknown };
    return String(value._id || value.id || '');
  }
  return '';
};

const isSameProductReference = (candidate: unknown, productId: string) => {
  const value = String(candidate || '');
  if (!value) return false;
  const resolvedProductId = resolveOfflineId(productId);
  return value === productId || resolveOfflineId(value) === resolvedProductId;
};

const hasPendingProductWrite = (queue: OfflineWrite[], productId: string) =>
  queue.some((item) => {
    if (item.entity !== 'product') return false;
    if (isSameProductReference(item.localId, productId)) return true;
    return item.url.split('/').some((part) => isSameProductReference(part, productId));
  });

const clearSyncedSaleStockDeltas = (sale: Sale | OfflineSale | null) => {
  if (!sale) return;

  const saleProductIds = new Set(
    sale.items
      .map((item) => getSaleItemProductId(item.product))
      .filter(Boolean)
      .map((productId) => resolveOfflineId(productId)),
  );
  if (saleProductIds.size === 0) return;

  const queue = readOfflineQueue();
  writeOfflineProducts(
    readOfflineProducts().map((product) => {
      const productId = String(product._id);
      if (!saleProductIds.has(resolveOfflineId(productId))) return product;
      if (product.__offline?.status !== 'updated') return product;
      if (hasPendingProductWrite(queue, productId)) return product;
      return { ...product, __offline: undefined } as OfflineProduct;
    }),
  );
};

export const markOfflineSaleSynced = (localId: string, remote: Sale) => {
  rememberOfflineIdMapping(localId, remote._id);
  const localSale = getOfflineSale(localId);
  writeOfflineSales(
    dedupeById([
      remote,
      ...readOfflineSales().filter((sale) => String(sale._id) !== String(localId)),
    ] as OfflineSale[]),
  );
  clearSyncedSaleStockDeltas(localSale || remote);
};

export const markOfflineSaleWriteSynced = (localId: string, action?: string) => {
  if (action === 'deleteSale') {
    writeOfflineSales(
      readOfflineSales().filter((sale) => String(sale._id) !== String(localId)),
    );
    return;
  }
  writeOfflineSales(
    readOfflineSales().map((sale) =>
      String(sale._id) === String(localId)
        ? ({ ...sale, __offline: undefined } as OfflineSale)
        : sale,
    ),
  );
};

const getProductPrice = (product: Product | null, unitPrice?: number) =>
  Number(unitPrice ?? product?.price ?? 0);

const normalizeSaleItems = (items: CreateSaleData['items']) =>
  items.map((item) => {
    const product = getOfflineProduct(item.productId);
    const quantity = Number(item.quantity || 0);
    const unitPrice = getProductPrice(product, item.unitPrice);
    return {
      product: item.productId,
      name: product?.name || 'Offline product',
      sku: product?.sku || '',
      variantId: item.variantId,
      quantity,
      unitPrice,
      unitCost: product?.cost || 0,
      totalPrice: Number((quantity * unitPrice).toFixed(2)),
      image: product?.primaryImage || product?.images?.[0]?.url,
    };
  });

const applySaleStockDelta = (items: Array<{ product: string | Product; quantity: number }>) => {
  const products = readOfflineProducts();
  const nextProducts = products.map((product) => {
    const soldQuantity = items
      .filter((item) => String(item.product) === String(product._id))
      .reduce((total, item) => total + Number(item.quantity || 0), 0);
    if (soldQuantity <= 0) return product;
    const updatedProduct = normalizeProduct(
      { quantity: Math.max(0, Number(product.quantity || 0) - soldQuantity) },
      product,
    );
    updatedProduct.__offline = {
      status: product.__offline?.status === 'created' ? 'created' : 'updated',
      queuedAt: nowIso(),
    };
    return updatedProduct;
  });
  writeOfflineProducts(nextProducts);
};

export const createOfflineSale = (input: CreateSaleData) => {
  const timestamp = nowIso();
  const items = normalizeSaleItems(input.items);
  applySaleStockDelta(items);
  const subtotal = items.reduce((total, item) => total + item.totalPrice, 0);
  const tax = Number(input.tax || 0);
  const discount = Number(input.discount || 0);
  const shippingCost = Number(input.shippingCost || 0);
  const total = Number((subtotal + tax + shippingCost - discount).toFixed(2));
  const sale = {
    _id: createLocalId('sale'),
    user: String(getCachedUser()?.id || ''),
    orderNumber: `OFF-${Date.now()}`,
    items,
    customer: input.customer,
    shipping: {
      status: input.orderType === 'shipped' ? 'processing' : 'pending',
      carrier: 'local',
      ...input.shipping,
      shippingCost,
    },
    orderType: input.orderType || 'walk_in',
    status: input.orderType === 'shipped' ? 'processing' : 'confirmed',
    paymentStatus: 'paid',
    paymentMethod: input.paymentMethod || 'cash',
    subtotal,
    tax,
    discount,
    shippingCost,
    total,
    notes: input.notes,
    source: 'manual',
    createdAt: timestamp,
    updatedAt: timestamp,
    __offline: { status: 'created', queuedAt: timestamp },
  } as OfflineSale;

  writeOfflineSales([sale, ...readOfflineSales()]);
  enqueueOfflineWrite({
    method: 'post',
    url: '/sales',
    data: input,
    entity: 'sale',
    action: 'createSale',
    localId: sale._id,
  });
  return sale;
};

export const createOfflineQuickSale = (input: QuickSaleData) => {
  const sale = createOfflineSale({
    items: [
      {
        productId: input.productId,
        variantId: input.variantId,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
      },
    ],
    customer: input.customer || { name: 'Walk-in Customer' },
    orderType: input.orderType || 'walk_in',
    shipping: input.shipping,
    shippingCost: input.shippingCost,
    paymentMethod: input.paymentMethod || 'cash',
  });
  return {
    sale,
    remainingStock:
      getOfflineProduct(input.productId)?.quantity ?? Math.max(0, input.quantity),
  };
};

export const updateOfflineSaleStatus = (
  id: string,
  data: {
    status?: string;
    paymentStatus?: string;
    shipping?: Partial<Sale['shipping']>;
  },
) => {
  let updatedSale: OfflineSale | null = null;
  writeOfflineSales(
    readOfflineSales().map((sale) => {
      if (String(sale._id) !== String(id)) return sale;
      updatedSale = {
        ...sale,
        status: (data.status as Sale['status']) || sale.status,
        paymentStatus:
          (data.paymentStatus as Sale['paymentStatus']) || sale.paymentStatus,
        shipping: { ...sale.shipping, ...data.shipping },
        updatedAt: nowIso(),
        __offline: {
          status: sale.__offline?.status === 'created' ? 'created' : 'updated',
          queuedAt: nowIso(),
        },
      };
      return updatedSale;
    }),
  );
  enqueueOfflineWrite({
    method: 'put',
    url: `/sales/${id}/status`,
    data,
    entity: 'sale',
    action: 'updateSaleStatus',
    localId: id,
  });
  return updatedSale;
};

export const deleteOfflineSale = (id: string) => {
  const target = getOfflineSale(id);
  writeOfflineSales(readOfflineSales().filter((sale) => String(sale._id) !== String(id)));
  if (target?.__offline?.status === 'created') {
    removeQueuedWritesForLocalId(id);
  } else {
    enqueueOfflineWrite({
      method: 'delete',
      url: `/sales/${id}`,
      entity: 'sale',
      action: 'deleteSale',
      localId: id,
    });
  }
};

const sortSales = (sales: OfflineSale[], sort = '-createdAt') => {
  const descending = sort.startsWith('-');
  const field = descending ? sort.slice(1) : sort;
  return [...sales].sort((left, right) => {
    const result = String(left[field as keyof Sale] || '').localeCompare(
      String(right[field as keyof Sale] || ''),
    );
    return descending ? -result : result;
  });
};

export const getOfflineSalesPage = (
  filters?: SaleFilters,
): ApiResponse<PaginatedResponse<Sale>> => {
  const search = String(filters?.search || '').trim().toLowerCase();
  const page = Number(filters?.page || 1);
  const limit = Number(filters?.limit || 20);
  const sales = sortSales(
    readOfflineSales().filter((sale) => {
      if (filters?.status && sale.status !== filters.status) return false;
      if (filters?.paymentStatus && sale.paymentStatus !== filters.paymentStatus)
        return false;
      if (search) {
        const haystack = [
          sale.orderNumber,
          sale.customer?.name,
          sale.customer?.email,
          sale.customer?.phone,
          ...sale.items.map((item) => item.name),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    }),
    filters?.sort,
  );
  const start = (page - 1) * limit;
  return {
    success: true,
    data: {
      sales: sales.slice(start, start + limit),
      pagination: {
        page,
        limit,
        total: sales.length,
        pages: Math.max(1, Math.ceil(sales.length / limit)),
      },
    },
  };
};

export const buildOfflineSuccess = <T,>(data: T): ApiResponse<T> => ({
  success: true,
  message: 'Saved offline. It will sync when internet is available.',
  data,
});
