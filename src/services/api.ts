import axios from "axios";
import Cookies from "js-cookie";
import type { AxiosRequestConfig, AxiosResponse } from "axios";
import { isDesktopRuntime, isOnline } from "@/shared/platform/platform";
import {
  buildOfflineSuccess,
  applyOfflineProductStock,
  createOfflineProduct,
  createOfflineQuickSale,
  createOfflineSale,
  deleteOfflineProduct,
  deleteOfflineSale,
  enqueueOfflineWrite,
  findOfflineProductByBarcode,
  getOfflineCategories,
  getOfflineProduct,
  getOfflineProductsPage,
  getOfflineSale,
  getOfflineSalesPage,
  isDesktopOffline,
  isDesktopOnline,
  markOfflineProductSynced,
  markOfflineProductWriteSynced,
  markOfflineSaleSynced,
  markOfflineSaleWriteSynced,
  markOfflineWriteFailed,
  readOfflineQueue,
  rememberOfflineIdMapping,
  resolveOfflineId,
  seedOfflineProductsFromRemote,
  seedOfflineSalesFromRemote,
  updateOfflineProduct,
  updateOfflineProductStock,
  updateOfflineSaleStatus,
  writeOfflineQueue,
} from "@/shared/offline/desktopOfflineStore";
import type {
  User,
  AccessibleStock,
  Product,
  Sale,
  Notification,
  AIInsight,
  AIInsightFilters,
  AIInsightStatus,
  Analytics,
  SalesAnalytics,
  BranchPerformanceAnalytics,
  LoginCredentials,
  RegisterData,
  SubUserRegisterData,
  ApiResponse,
  AccountBalance,
  AccountBalanceTransaction,
  PaginatedResponse,
  ProductFilters,
  SaleFilters,
  InvitationData,
  TeamNote,
  TeamMemberDetails,
  TeamSurveillanceData,
  ClientsOverviewData,
  ClientRecord,
  DistributorRecord,
  DistributorsOverviewData,
  WorkspaceActivityItem,
  TeamDetailsRangeKey,
  QuickSaleData,
  CreateSaleData,
  ActionItem,
  StockHealthScore,
  ProductStockPrediction,
  Invoice,
  Payment,
  InvoiceStats,
  InvoiceCustomer,
  InvoiceFilters,
  BusinessType,
  NicheType,
  BusinessHighlights,
  SupplierTaxRegime,
  ClothingVariant,
  ClothingReturnRecord,
  ClothingReturnStatus,
  SupermarketBatch,
  SupermarketPromotion,
  BusinessProfile,
  ShopifyIntegrationStatus,
  ShopifyIntegrationSetupStatus,
  ShopifyProductMapping,
  ShopifyWebhookEvent,
  ShippingProviderConnectionStatus,
  ShippingProviderDispatchResult,
  ShippingProviderKey,
  ClientWholesaleSummary,
  PurchaseOrder,
  PurchaseOrderStatus,
  SupplierPurchase,
  SupplierPurchaseStatus,
  Expense,
  ExpenseAnalytics,
  ExpenseFilters,
  ExpensePayrollSummary,
  ExpensePayrollWorker,
} from "@/types";

export type AssistantChatMessage = {
  role: "user" | "assistant";
  content: string;
  senderName?: string;
};

export type AssistantAnalyzePayload = {
  fileName: string;
  mimeType: string;
  contentBase64: string;
  question?: string;
  language?: "en" | "ar" | "fr";
};

export type AdminOverview = {
  totals: {
    users: number;
    subscribedUsers: number;
    newUsersToday: number;
    onlineNow: number;
    visits: number;
    visitsToday: number;
    uniqueVisitors: number;
  };
  subscriptions: {
    byPlan: Array<{ plan: string; count: number }>;
    byStatus: Array<{ status: string; count: number }>;
  };
  visitsByDay: Array<{ date: string; visits: number; uniqueVisitors: number }>;
};

export type AdminUserRecord = {
  id: string;
  name: string;
  email: string;
  role: string;
  businessType?: string | null;
  isSubscribed: boolean;
  subscription: User["subscription"];
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string | null;
  lastActiveAt?: string;
  subUsersCount: number;
  platformAdmin: boolean;
};

export type PlatformAdminRecord = {
  id: string;
  email: string;
  name: string;
  isOwner: boolean;
  createdByEmail?: string;
  createdAt?: string;
};

type SupplierPurchaseCreatePayload = Partial<SupplierPurchase> & {
  clientName?: string;
  email?: string;
  phone?: string;
  clientKey?: string;
  nif?: string;
  rc?: string;
  nis?: string;
  ai?: string;
};

const defaultApiHost =
  typeof window !== "undefined" ? window.location.hostname : "localhost";
const defaultApiBase = `http://${defaultApiHost}:5000/api`;
const apiFromEnv = import.meta.env.VITE_API_URL;
const apiFromProtocol =
  typeof window !== "undefined" && window.location.protocol === "https:"
    ? "/api"
    : undefined;
const API_URL = apiFromEnv || apiFromProtocol || defaultApiBase;
const DESKTOP_API_CACHE_PREFIX = "stockly:desktop-api-cache:";
const CURRENT_STOCK_STORAGE_KEY = "currentStockId";
const DESKTOP_AUTH_USER_STORAGE_KEY = "stockly:desktop-auth-user";

// Prevent accidental duplicate non-idempotent requests while the first one is in-flight.
// This mainly protects against "spam-click" on action buttons that trigger POST/PUT/PATCH/DELETE.
const inflightRequests = new Map<string, Promise<AxiosResponse>>();

const stableStringify = (value: unknown): string => {
  const seen = new WeakSet<object>();

  const normalize = (input: unknown): unknown => {
    if (input === null || typeof input !== "object") return input;

    const obj = input as Record<string, unknown>;
    if (seen.has(obj)) return "[Circular]";
    seen.add(obj);

    if (Array.isArray(input)) return input.map((item) => normalize(item));
    if (input instanceof Date) return input.toISOString();

    const keys = Object.keys(obj).sort();
    const out: Record<string, unknown> = {};
    keys.forEach((key) => {
      out[key] = normalize(obj[key]);
    });
    return out;
  };

  try {
    return JSON.stringify(normalize(value));
  } catch {
    return String(value);
  }
};

const buildDedupeKey = (config: AxiosRequestConfig): string | null => {
  const method = String(config.method || "get").toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS")
    return null;

  const baseUrl = String(config.baseURL || "");
  const url = String(config.url || "");
  const paramsKey = config.params ? stableStringify(config.params) : "";
  const dataKey =
    typeof config.data === "undefined" ? "" : stableStringify(config.data);

  return `${method} ${baseUrl}${url} ${paramsKey} ${dataKey}`;
};

const buildDesktopCacheKey = (config: AxiosRequestConfig): string | null => {
  const method = String(config.method || "get").toUpperCase();
  if (method !== "GET") return null;
  if (config.responseType === "blob" || config.responseType === "arraybuffer")
    return null;

  const stockId =
    typeof localStorage === "undefined"
      ? "default"
      : localStorage.getItem(CURRENT_STOCK_STORAGE_KEY) || "default";
  const baseUrl = String(config.baseURL || "");
  const url = String(config.url || "");
  const paramsKey = config.params ? stableStringify(config.params) : "";

  return `${DESKTOP_API_CACHE_PREFIX}${stockId}:${baseUrl}${url}:${paramsKey}`;
};

const cacheDesktopGetResponse = (response: AxiosResponse) => {
  if (!isDesktopRuntime() || typeof localStorage === "undefined") return;
  const key = buildDesktopCacheKey(response.config);
  if (!key) return;

  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        data: response.data,
        cachedAt: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.warn("Unable to cache desktop API response:", error);
  }
};

const getCachedDesktopResponse = (
  config: AxiosRequestConfig,
): AxiosResponse | null => {
  if (!isDesktopRuntime() || typeof localStorage === "undefined") return null;
  const key = buildDesktopCacheKey(config);
  if (!key) return null;

  try {
    const rawValue = localStorage.getItem(key);
    if (!rawValue) return null;
    const cached = JSON.parse(rawValue) as { data?: unknown };
    if (typeof cached.data === "undefined") return null;

    return {
      data: cached.data,
      status: 200,
      statusText: "OK",
      headers: {},
      config: config as AxiosResponse["config"],
      request: null,
    };
  } catch (error) {
    console.warn("Unable to read cached desktop API response:", error);
    return null;
  }
};

const notifyDesktopConnectivity = (online: boolean) => {
  if (!isDesktopRuntime() || typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("stockly:desktop-connectivity", {
      detail: { online },
    }),
  );
};

const safeParseRequestData = (data: unknown): unknown => {
  if (typeof data !== "string") return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
};

const createOfflineId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const getCachedDesktopUser = (): Partial<User> | null => {
  if (typeof localStorage === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(DESKTOP_AUTH_USER_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
};

const getConfigPath = (config: AxiosRequestConfig) => {
  const rawUrl = String(config.url || "/");
  try {
    return new URL(rawUrl, "https://stockly.local").pathname;
  } catch {
    return rawUrl.split("?")[0] || "/";
  }
};

const getPathParts = (path: string) =>
  path.split("/").map((part) => decodeURIComponent(part)).filter(Boolean);

const getPathId = (parts: string[], index: number, fallbackPrefix: string) =>
  parts[index] || createOfflineId(fallbackPrefix);

const buildOfflineEntity = (
  config: AxiosRequestConfig,
  fallbackPrefix: string,
): Record<string, unknown> => {
  const path = getConfigPath(config);
  const parts = getPathParts(path);
  const payload = safeParseRequestData(config.data);
  const objectPayload =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  const id = getPathId(parts, 1, fallbackPrefix);
  const timestamp = new Date().toISOString();

  return {
    _id: id,
    id,
    ...objectPayload,
    createdAt: objectPayload.createdAt || timestamp,
    updatedAt: timestamp,
    __offline: {
      status: String(config.method || "post").toLowerCase() === "delete" ? "deleted" : "updated",
      queuedAt: timestamp,
    },
  };
};

const buildExpenseOfflineData = (config: AxiosRequestConfig) => {
  const expense = buildOfflineEntity(config, "expense");
  const amount = Number(expense.amount || 0);
  const initialPaidAmount = Number(expense.initialPaidAmount || 0);
  return {
    expense: {
      status: expense.status || (initialPaidAmount >= amount && amount > 0 ? "paid" : "unpaid"),
      paidAmount: initialPaidAmount,
      remainingAmount: Math.max(0, amount - initialPaidAmount),
      payments: [],
      reimbursements: [],
      ...expense,
    },
  };
};

const buildInvoiceOfflineData = (config: AxiosRequestConfig) => ({
  invoice: {
    status: "draft",
    total: 0,
    ...buildOfflineEntity(config, "invoice"),
  },
});

const buildGenericOfflineMutationData = (config: AxiosRequestConfig): Record<string, unknown> => {
  const path = getConfigPath(config);
  const parts = getPathParts(path);
  const method = String(config.method || "get").toLowerCase();

  if (method === "delete") return {};
  if (parts[0] === "expenses") {
    if (parts.includes("recurring")) return { generated: 0 };
    return buildExpenseOfflineData(config);
  }
  if (parts[0] === "invoices") return buildInvoiceOfflineData(config);
  if (parts[0] === "clients") {
    const profile = buildOfflineEntity(config, "client");
    return {
      profile: {
        clientKey: profile.clientKey || profile.id,
        name: profile.name || "Offline client",
        debt: {
          isMarked: Boolean(profile.isInDebt),
          amount: Number(profile.amount || 0),
          note: String(profile.note || ""),
          markedAt: profile.isInDebt ? new Date().toISOString() : null,
          clearedAt: profile.isInDebt ? null : new Date().toISOString(),
        },
        ...profile,
      },
    };
  }
  if (parts[0] === "distributors") {
    if (parts.includes("purchases")) {
      return { purchase: buildOfflineEntity(config, "purchase") };
    }
    return { distributor: buildOfflineEntity(config, "distributor") };
  }
  if (parts[0] === "purchases") return { purchase: buildOfflineEntity(config, "purchase") };
  if (parts[0] === "business") {
    if (parts.includes("variants")) return { variant: buildOfflineEntity(config, "variant") };
    if (parts.includes("returns")) return { returnItem: buildOfflineEntity(config, "return") };
    if (parts.includes("batches")) return { batch: buildOfflineEntity(config, "batch") };
    if (parts.includes("promotions")) return { promotion: buildOfflineEntity(config, "promotion") };
    if (parts.includes("purchase-orders")) return { purchaseOrder: buildOfflineEntity(config, "purchase_order") };
  }
  if (parts[0] === "notes") return { note: buildOfflineEntity(config, "note") };
  if (parts[0] === "auth") {
    const payload = safeParseRequestData(config.data);
    const settingsPayload =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {};
    const cachedUser = getCachedDesktopUser();
    if (parts.includes("business-type")) {
      return {
        user: {
          ...cachedUser,
          businessType: settingsPayload.businessType || cachedUser?.businessType || null,
          businessTypeUpdatedAt: new Date().toISOString(),
        },
      };
    }
    if (parts.includes("onboarding")) {
      return {
        onboarding: {
          ...(cachedUser?.onboarding || {}),
          ...settingsPayload,
        },
      };
    }
    const settingsOnly = Object.fromEntries(
      Object.entries(settingsPayload).filter(
        ([key]) => !["profile", "businessProfile"].includes(key),
      ),
    );
    return {
      profile: {
        name: cachedUser?.name || "",
        email: cachedUser?.email || "",
        profileImageUrl: cachedUser?.profileImageUrl || "",
        ...((settingsPayload.profile as Record<string, unknown> | undefined) || {}),
      },
      settings: {
        ...(cachedUser?.settings || {}),
        ...settingsOnly,
      },
      businessProfile: {
        ...(cachedUser?.businessProfile || {}),
        ...((settingsPayload.businessProfile as Record<string, unknown> | undefined) || {}),
      },
    };
  }
  if (parts[0] === "backup") {
    if (parts.includes("settings")) {
      return {
        enabled: true,
        frequency: "daily",
        lastRun: null,
        nextRun: null,
      };
    }
    return {
      fileName: "offline-backup-pending.json",
      lastRun: new Date().toISOString(),
      nextRun: "",
    };
  }
  if (parts[0] === "notifications") return { notification: buildOfflineEntity(config, "notification") };

  return {
    queued: true,
    offlineId: createOfflineId("offline"),
  };
};

const buildGenericOfflineGetData = (config: AxiosRequestConfig): unknown | null => {
  const path = getConfigPath(config);
  const parts = getPathParts(path);

  if (parts[0] === "expenses") {
    if (parts.includes("analytics")) return {};
    if (parts.includes("payroll")) {
      return {
        summary: { totalPayroll: 0, paidPayroll: 0, pendingPayroll: 0, workersCount: 0 },
        workers: [],
      };
    }
    if (parts[1]) return { expense: buildOfflineEntity(config, "expense") };
    return {
      expenses: [],
      pagination: { page: 1, limit: 20, total: 0, pages: 1 },
      summary: { totalAmount: 0, paidAmount: 0, remainingAmount: 0, pendingReimbursements: 0 },
    };
  }
  if (parts[0] === "invoices") {
    if (parts.includes("stats")) {
      return { totalInvoiced: 0, totalPaid: 0, totalOutstanding: 0, count: 0 };
    }
    if (parts.includes("customers")) return [];
    if (parts[1]) return { invoice: buildOfflineEntity(config, "invoice") };
    return {
      invoices: [],
      pagination: { page: 1, limit: 20, total: 0, pages: 1 },
      summary: { totalInvoiced: 0, totalPaid: 0, totalOutstanding: 0, count: 0 },
    };
  }
  if (parts[0] === "clients") {
    if (parts.includes("wholesale")) return {};
    if (parts.includes("purchases")) return { purchases: [] };
    return {
      clients: [],
      summary: { totalClients: 0, totalRevenue: 0, totalDebt: 0, clientsInDebt: 0 },
    };
  }
  if (parts[0] === "distributors") {
    if (parts.includes("summary")) return {};
    if (parts.includes("purchases")) return { purchases: [] };
    return {
      distributors: [],
      summary: { totalDistributors: 0, totalOutstanding: 0, totalPurchases: 0 },
    };
  }
  if (parts[0] === "purchases") return { purchase: buildOfflineEntity(config, "purchase") };
  if (parts[0] === "business") {
    if (parts.includes("capabilities")) return { businessType: "retail", capabilities: [] };
    if (parts.includes("highlights")) return {};
    if (parts.includes("pipeline")) {
      return {
        summary: { confirmed: 0, processing: 0, shipping: 0, delivered: 0 },
        oldestOpenOrders: [],
      };
    }
    if (parts.includes("variants")) return { variants: [] };
    if (parts.includes("returns")) return { returns: [] };
    if (parts.includes("batches")) return { batches: [] };
    if (parts.includes("promotions")) return { promotions: [] };
    if (parts.includes("purchase-orders")) return { purchaseOrders: [] };
  }
  if (parts[0] === "notes") return { notes: [] };
  if (parts[0] === "action-center") {
    if (parts.includes("stock-health")) return {};
    if (parts.includes("today-priorities")) return { priorities: [], count: 0 };
    return { actions: [] };
  }
  if (parts[0] === "ai") return { insights: [] };
  if (parts[0] === "backup") {
    if (parts.includes("settings")) {
      return {
        enabled: false,
        frequency: "daily",
        lastRun: null,
        nextRun: null,
      };
    }
    if (parts.includes("list")) return { backups: [] };
  }

  return null;
};

const buildOfflineAxiosResponse = (
  config: AxiosRequestConfig,
  data: unknown,
): AxiosResponse => ({
  data: {
    success: true,
    message: "Offline mode: saved locally and queued for sync.",
    data: data || {},
  },
  status: 202,
  statusText: "Accepted",
  headers: {},
  config: config as AxiosResponse["config"],
  request: null,
});

const isDesktopGenericOfflineEligible = (
  config: AxiosRequestConfig,
  error?: unknown,
) => {
  if (!isDesktopRuntime()) return false;
  if (axios.isAxiosError(error) && error.response) return false;
  const path = getConfigPath(config);
  const method = String(config.method || "get").toLowerCase();
  if (["head", "options"].includes(method)) return false;
  if (config.responseType === "blob" || config.responseType === "arraybuffer") return false;
  if (
    path.startsWith("/products") ||
    path.startsWith("/sales") ||
    path.startsWith("/admin") ||
    path.startsWith("/chargily") ||
    path.startsWith("/integrations") ||
    path.startsWith("/assistant")
  ) {
    return false;
  }
  if (
    path.startsWith("/auth/login") ||
    path.startsWith("/auth/register") ||
    path.startsWith("/auth/logout") ||
    path.startsWith("/auth/me") ||
    path.startsWith("/auth/change-password") ||
    path.startsWith("/auth/request-email-change") ||
    path.startsWith("/auth/confirm-email-change") ||
    path.startsWith("/auth/switch-stock") ||
    path.startsWith("/auth/accessible-stocks")
  ) {
    return false;
  }
  return !isOnline() || Boolean(error);
};

// Create axios instance
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Dedupe non-idempotent requests while in-flight.
const rawRequest = apiClient.request.bind(apiClient);
apiClient.request = ((config: AxiosRequestConfig) => {
  const key = buildDedupeKey(config);
  if (!key) {
    return rawRequest(config);
  }

  const existing = inflightRequests.get(key);
  if (existing) {
    return existing;
  }

  const requestPromise = rawRequest(config) as Promise<AxiosResponse>;
  inflightRequests.set(key, requestPromise);

  requestPromise.finally(() => {
    inflightRequests.delete(key);
  });

  return requestPromise;
}) as typeof apiClient.request;

// Add token to requests
apiClient.interceptors.request.use((config) => {
  const token = Cookies.get("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
apiClient.interceptors.response.use(
  (response) => {
    notifyDesktopConnectivity(true);
    cacheDesktopGetResponse(response);
    if (isDesktopOnline()) {
      void syncDesktopOfflineQueue();
    }
    return response;
  },
  (error) => {
    if (isDesktopRuntime() && !error.response) {
      notifyDesktopConnectivity(false);
    }
    if (error.response?.status === 401) {
      Cookies.remove("token");
      window.location.href = "/login";
    }
    if (
      isDesktopRuntime() &&
      (!isOnline() || !error.response) &&
      error.config
    ) {
      const cachedResponse = getCachedDesktopResponse(error.config);
      if (cachedResponse) return Promise.resolve(cachedResponse);
    }
    if (error.config && isDesktopGenericOfflineEligible(error.config, error)) {
      const method = String(error.config.method || "get").toLowerCase();
      if (method === "get") {
        const data = buildGenericOfflineGetData(error.config);
        if (data) return Promise.resolve(buildOfflineAxiosResponse(error.config, data));
      } else {
        enqueueOfflineWrite({
          method: method as "post" | "put" | "patch" | "delete",
          url: String(error.config.url || "/"),
          data: safeParseRequestData(error.config.data),
          entity: "api",
          action: `generic:${method}:${getConfigPath(error.config)}`,
        });
        return Promise.resolve(
          buildOfflineAxiosResponse(
            error.config,
            buildGenericOfflineMutationData(error.config),
          ),
        );
      }
    }
    return Promise.reject(error);
  },
);

let desktopOfflineSyncPromise: Promise<void> | null = null;

const remapOfflineIds = (value: unknown): unknown => {
  if (typeof value === "string") return resolveOfflineId(value);
  if (Array.isArray(value)) return value.map((item) => remapOfflineIds(item));
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      remapOfflineIds(item),
    ]),
  );
};

const remapOfflineUrl = (url: string) => {
  return url
    .split("/")
    .map((part) => (part ? resolveOfflineId(part) : part))
    .join("/");
};

const removeOfflineWrite = (writeId: string) => {
  writeOfflineQueue(readOfflineQueue().filter((item) => item.id !== writeId));
};

const toErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || error.message;
  }
  if (error instanceof Error) return error.message;
  return "Sync failed";
};

const shouldFallbackToDesktopOffline = (error?: unknown) =>
  isDesktopRuntime() &&
  (!isOnline() || (Boolean(error) && axios.isAxiosError(error) && !error.response));

export const syncDesktopOfflineQueue = async (): Promise<void> => {
  if (!isDesktopOnline()) return;
  if (desktopOfflineSyncPromise) return desktopOfflineSyncPromise;

  desktopOfflineSyncPromise = (async () => {
    const queue = readOfflineQueue();
    if (queue.length === 0) return;

    let syncedAny = false;
    for (const item of queue) {
      try {
        const response = await apiClient.request({
          method: item.method,
          url: remapOfflineUrl(item.url),
          data: remapOfflineIds(item.data),
        });
        const payload = response.data?.data || {};
        if (item.localId && item.entity === "product" && payload.product?._id) {
          markOfflineProductSynced(item.localId, payload.product);
        } else if (item.localId && item.entity === "product") {
          markOfflineProductWriteSynced(item.localId, item.action);
        }
        if (item.localId && item.entity === "sale" && payload.sale?._id) {
          markOfflineSaleSynced(item.localId, payload.sale);
        } else if (item.localId && item.entity === "sale") {
          markOfflineSaleWriteSynced(item.localId, item.action);
        }
        if (item.localId && payload._id) {
          rememberOfflineIdMapping(item.localId, payload._id);
        }
        removeOfflineWrite(item.id);
        syncedAny = true;
      } catch (error) {
        markOfflineWriteFailed(item.id, toErrorMessage(error));
        break;
      }
    }

    if (syncedAny) {
      window.dispatchEvent(new CustomEvent("stockly:offline-sync-complete"));
      window.dispatchEvent(new CustomEvent("stockly:analytics-refresh"));
    }
  })().finally(() => {
    desktopOfflineSyncPromise = null;
  });

  return desktopOfflineSyncPromise;
};

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    void syncDesktopOfflineQueue();
  });
}

// Platform Admin API
export const adminAPI = {
  trackVisit: async (payload: {
    visitorId: string;
    path: string;
    referrer?: string;
  }): Promise<ApiResponse<Record<string, never>>> => {
    const response = await apiClient.post("/admin/visits", payload);
    return response.data;
  },

  getOverview: async (): Promise<ApiResponse<AdminOverview>> => {
    const response = await apiClient.get("/admin/overview");
    return response.data;
  },

  getUsers: async (params?: {
    search?: string;
    page?: number;
    limit?: number;
    status?: string;
    plan?: string;
  }): Promise<
    ApiResponse<{
      users: AdminUserRecord[];
      pagination: { page: number; limit: number; total: number; pages: number };
    }>
  > => {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.status && params.status !== "all") query.set("status", params.status);
    if (params?.plan && params.plan !== "all") query.set("plan", params.plan);
    if (typeof params?.page === "number") query.set("page", String(params.page));
    if (typeof params?.limit === "number") query.set("limit", String(params.limit));
    const response = await apiClient.get(`/admin/users${query.toString() ? `?${query.toString()}` : ""}`);
    return response.data;
  },

  updateUserSubscription: async (
    userId: string,
    payload: {
      plan: User["subscription"]["plan"];
      status: User["subscription"]["status"];
      startDate?: string | null;
      endDate?: string | null;
    },
  ): Promise<ApiResponse<{ user: AdminUserRecord }>> => {
    const response = await apiClient.put(
      `/admin/users/${userId}/subscription`,
      payload,
    );
    return response.data;
  },

  getAdmins: async (): Promise<ApiResponse<{ admins: PlatformAdminRecord[] }>> => {
    const response = await apiClient.get("/admin/admins");
    return response.data;
  },

  addAdmin: async (payload: {
    email: string;
    name?: string;
  }): Promise<ApiResponse<{ admin: PlatformAdminRecord }>> => {
    const response = await apiClient.post("/admin/admins", payload);
    return response.data;
  },

  removeAdmin: async (email: string): Promise<ApiResponse<Record<string, never>>> => {
    const response = await apiClient.delete(`/admin/admins/${encodeURIComponent(email)}`);
    return response.data;
  },
};

// Auth API
export const authAPI = {
  login: async (
    credentials: LoginCredentials,
  ): Promise<ApiResponse<{ token: string; user: User }>> => {
    const response = await apiClient.post("/auth/login", credentials);
    return response.data;
  },

  logout: async (): Promise<ApiResponse<Record<string, never>>> => {
    const response = await apiClient.post("/auth/logout");
    return response.data;
  },

  register: async (
    data: RegisterData,
  ): Promise<ApiResponse<{ token: string; user: User }>> => {
    const response = await apiClient.post("/auth/register", data);
    return response.data;
  },

  forgotPassword: async (
    email: string,
  ): Promise<ApiResponse<Record<string, never>>> => {
    const response = await apiClient.post("/auth/forgot-password", { email });
    return response.data;
  },

  resetPassword: async (payload: {
    token: string;
    password: string;
  }): Promise<ApiResponse<Record<string, never>>> => {
    const response = await apiClient.post("/auth/reset-password", payload);
    return response.data;
  },

  changePassword: async (payload: {
    currentPassword: string;
    newPassword: string;
  }): Promise<ApiResponse<Record<string, never>>> => {
    const response = await apiClient.put("/auth/change-password", payload);
    return response.data;
  },

  registerSubUser: async (
    data: SubUserRegisterData,
  ): Promise<ApiResponse<{ token: string; user: User }>> => {
    const response = await apiClient.post("/auth/register-subuser", data);
    return response.data;
  },

  verifyInvitation: async (
    token: string,
  ): Promise<ApiResponse<InvitationData>> => {
    const response = await apiClient.get(`/auth/verify-invitation/${token}`);
    return response.data;
  },

  getMe: async (): Promise<ApiResponse<{ user: User }>> => {
    const response = await apiClient.get("/auth/me");
    return response.data;
  },

  getBalance: async (): Promise<ApiResponse<{ balance: AccountBalance }>> => {
    const response = await apiClient.get("/auth/balance");
    return response.data;
  },

  getBalanceHistory: async (
    limit = 60,
  ): Promise<
    ApiResponse<{
      balance: AccountBalance;
      transactions: AccountBalanceTransaction[];
    }>
  > => {
    const response = await apiClient.get("/auth/balance/history", {
      params: { limit },
    });
    return response.data;
  },

  createBalanceTransaction: async (payload: {
    direction: "credit" | "debit";
    amount: number;
    note?: string;
  }): Promise<
    ApiResponse<{
      balance: AccountBalance;
      transaction: AccountBalanceTransaction | null;
    }>
  > => {
    const response = await apiClient.post("/auth/balance/transaction", payload);
    return response.data;
  },

  getActivityHistory: async (
    limit = 60,
  ): Promise<ApiResponse<{ activity: WorkspaceActivityItem[] }>> => {
    const response = await apiClient.get("/auth/activity-history", {
      params: { limit },
    });
    return response.data;
  },

  getTeamSurveillance: async (params?: {
    range?: TeamDetailsRangeKey | string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    includeInactive?: boolean;
  }): Promise<ApiResponse<TeamSurveillanceData>> => {
    const queryParams = new URLSearchParams();
    if (params?.range) queryParams.append("range", params.range);
    if (params?.startDate) queryParams.append("startDate", params.startDate);
    if (params?.endDate) queryParams.append("endDate", params.endDate);
    if (typeof params?.limit === "number")
      queryParams.append("limit", String(params.limit));
    if (typeof params?.includeInactive === "boolean") {
      queryParams.append("includeInactive", String(params.includeInactive));
    }
    const query = queryParams.toString();
    const response = await apiClient.get(
      `/auth/surveillance${query ? `?${query}` : ""}`,
    );
    return response.data;
  },

  updateSettings: async (
    settings: Partial<User["settings"]> & {
      profile?: Partial<Pick<User, "name" | "email" | "profileImageUrl">>;
      businessProfile?: Partial<BusinessProfile>;
    },
  ): Promise<
    ApiResponse<{
      profile: Pick<User, "name" | "email" | "profileImageUrl">;
      settings: User["settings"];
      businessProfile: BusinessProfile;
    }>
  > => {
    const response = await apiClient.put("/auth/settings", settings);
    return response.data;
  },

  requestEmailChangeCode: async (
    newEmail: string,
  ): Promise<ApiResponse<{ maskedEmail: string }>> => {
    const response = await apiClient.post("/auth/request-email-change", {
      newEmail,
    });
    return response.data;
  },

  confirmEmailChange: async (
    code: string,
  ): Promise<ApiResponse<{ email: string }>> => {
    const response = await apiClient.post("/auth/confirm-email-change", {
      code,
    });
    return response.data;
  },

  updateSubscription: async (
    plan: string,
  ): Promise<
    ApiResponse<{ isSubscribed: boolean; subscription: User["subscription"] }>
  > => {
    const response = await apiClient.put("/auth/subscription", {
      plan,
      status: "active",
    });
    return response.data;
  },

  updateBilling: async (
    billing: Partial<User["billing"]>,
  ): Promise<ApiResponse<{ billing: User["billing"] }>> => {
    const response = await apiClient.put("/auth/billing", billing);
    return response.data;
  },

  updateBusinessType: async (payload: {
    businessType: BusinessType;
    confirmReset?: boolean;
  }): Promise<
    ApiResponse<{
      user: Pick<
        User,
        | "id"
        | "businessType"
        | "ownBusinessType"
        | "businessTypeSelectedAt"
        | "businessTypeUpdatedAt"
        | "ownBusinessTypeSelectedAt"
        | "ownBusinessTypeUpdatedAt"
      >;
      resetSummary?: {
        products: number;
        sales: number;
        invoices: number;
        teamNotes: number;
        notifications: number;
        clothingVariants?: number;
        clothingReturns?: number;
        supermarketBatches?: number;
        supermarketPromotions?: number;
      };
    }>
  > => {
    const response = await apiClient.put("/auth/business-type", payload);
    return response.data;
  },

  // Invitation-based sub-user management
  inviteSubUser: async (invitation: {
    name: string;
    email: string;
    role: string;
  }): Promise<
    ApiResponse<{
      invitation: {
        email: string;
        name: string;
        role: string;
        token: string;
        expiresAt: string;
      };
      invitationLink: string;
      subUsers: User["subUsers"];
      invitations: User["invitations"];
    }>
  > => {
    const response = await apiClient.post("/auth/subusers/invite", invitation);
    return response.data;
  },

  updateSubUserPermissions: async (
    subUserId: string,
    data: { role?: string; permissions?: Partial<User["permissions"]> },
  ): Promise<ApiResponse<{ subUser: User["subUsers"][0] }>> => {
    const response = await apiClient.put(
      `/auth/subusers/${subUserId}/permissions`,
      data,
    );
    return response.data;
  },

  getSubUserDetails: async (
    subUserId: string,
    params?: {
      range?: TeamDetailsRangeKey | string;
      startDate?: string;
      endDate?: string;
      limit?: number;
    },
  ): Promise<ApiResponse<TeamMemberDetails>> => {
    const queryParams = new URLSearchParams();
    if (params?.range) queryParams.append("range", params.range);
    if (params?.startDate) queryParams.append("startDate", params.startDate);
    if (params?.endDate) queryParams.append("endDate", params.endDate);
    if (typeof params?.limit === "number")
      queryParams.append("limit", String(params.limit));
    const query = queryParams.toString();
    const response = await apiClient.get(
      `/auth/subusers/${subUserId}/details${query ? `?${query}` : ""}`,
    );
    return response.data;
  },

  removeSubUser: async (
    subUserId: string,
  ): Promise<ApiResponse<{ subUsers: User["subUsers"] }>> => {
    const response = await apiClient.delete(`/auth/subusers/${subUserId}`);
    return response.data;
  },

  cancelInvitation: async (
    token: string,
  ): Promise<ApiResponse<{ invitations: User["invitations"] }>> => {
    const response = await apiClient.delete(`/auth/invitations/${token}`);
    return response.data;
  },

  // Stock switching
  switchStock: async (
    stockId: string,
  ): Promise<ApiResponse<{ token: string; user: User }>> => {
    const response = await apiClient.post("/auth/switch-stock", { stockId });
    return response.data;
  },

  getAccessibleStocks: async (): Promise<
    ApiResponse<{ stocks: User["accessibleStocks"] }>
  > => {
    const response = await apiClient.get("/auth/accessible-stocks");
    return response.data;
  },

  createOwnedStock: async (
    name: string,
    selectedNiche?: string,
  ): Promise<ApiResponse<{ stock: AccessibleStock }>> => {
    const body: Record<string, string> = { name };
    if (selectedNiche) body.selectedNiche = selectedNiche;
    const response = await apiClient.post("/auth/owned-stocks", body);
    return response.data;
  },

  requestBranchDeleteCode: async (
    stockId: string,
  ): Promise<ApiResponse<{ maskedEmail: string }>> => {
    const response = await apiClient.post(
      `/auth/owned-stocks/${stockId}/delete-code`,
    );
    return response.data;
  },

  deleteBranchStock: async (
    stockId: string,
    code: string,
  ): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.delete(
      `/auth/owned-stocks/${stockId}`,
      { data: { code } },
    );
    return response.data;
  },

  // Onboarding
  updateOnboarding: async (
    progress: Partial<User["onboarding"]>,
  ): Promise<ApiResponse<{ onboarding: User["onboarding"] }>> => {
    const response = await apiClient.put("/auth/onboarding", progress);
    return response.data;
  },

  // Accept/Decline invitation
  respondToInvitation: async (
    token: string,
    accept: boolean,
  ): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.post("/auth/respond-invitation", {
      token,
      accept,
    });
    return response.data;
  },

  // Leave team
  leaveTeam: async (
    stockId: string,
  ): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.post("/auth/leave-team", { stockId });
    return response.data;
  },
};

// Niche API
export const nicheAPI = {
  completeOnboarding: async (payload: {
    businessName: string;
    answers?: Record<string, unknown>;
    selectedNiche?: NicheType;
  }): Promise<ApiResponse<{ user: User }>> => {
    const response = await apiClient.post("/niche/complete", payload);
    return response.data;
  },

  getStatus: async (): Promise<
    ApiResponse<{
      selectedNiche: NicheType | null;
      nicheOnboardingCompleted: boolean;
      businessName: string | null;
      stockName: string | null;
      nicheResetRequestedAt: string | null;
    }>
  > => {
    const response = await apiClient.get("/niche/status");
    return response.data;
  },

  resetNiche: async (): Promise<ApiResponse<null>> => {
    const response = await apiClient.post("/niche/reset");
    return response.data;
  },

  completeBranchOnboarding: async (
    stockId: string,
    payload: {
      businessName: string;
      answers?: Record<string, unknown>;
      selectedNiche?: NicheType;
    },
  ): Promise<
    ApiResponse<{
      stockId: string;
      stockName: string;
      selectedNiche: string;
      businessType: string;
    }>
  > => {
    const response = await apiClient.post(
      `/niche/branch/${stockId}/complete`,
      payload,
    );
    return response.data;
  },
};

// Notifications API
export const notificationsAPI = {
  getNotifications: async (
    page = 1,
    limit = 20,
  ): Promise<ApiResponse<PaginatedResponse<Notification>>> => {
    const response = await apiClient.get(
      `/notifications?page=${page}&limit=${limit}`,
    );
    return response.data;
  },

  markAsRead: async (
    notificationId: string,
  ): Promise<ApiResponse<{ notification: Notification }>> => {
    const response = await apiClient.put(
      `/notifications/${notificationId}/read`,
    );
    return response.data;
  },

  markAllAsRead: async (): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.put("/notifications/read-all");
    return response.data;
  },

  deleteNotification: async (
    notificationId: string,
  ): Promise<ApiResponse<{ message?: string }>> => {
    const response = await apiClient.delete(`/notifications/${notificationId}`);
    return response.data;
  },

  getUnreadCount: async (): Promise<ApiResponse<{ count: number }>> => {
    const response = await apiClient.get("/notifications/unread-count");
    return response.data;
  },
};

// Products API
export const productsAPI = {
  getProducts: async (
    filters?: ProductFilters,
  ): Promise<ApiResponse<PaginatedResponse<Product>>> => {
    if (isDesktopOffline()) {
      return getOfflineProductsPage(filters);
    }

    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    try {
      const response = await apiClient.get(`/products?${params.toString()}`);
      seedOfflineProductsFromRemote(response.data.data.products || []);
      return response.data;
    } catch (error) {
      if (shouldFallbackToDesktopOffline(error)) {
        return getOfflineProductsPage(filters);
      }
      throw error;
    }
  },

  getProduct: async (
    id: string,
  ): Promise<ApiResponse<{ product: Product }>> => {
    if (isDesktopOffline()) {
      const product = getOfflineProduct(id);
      if (product) return buildOfflineSuccess({ product });
    }

    try {
      const response = await apiClient.get(`/products/${id}`);
      return response.data;
    } catch (error) {
      if (shouldFallbackToDesktopOffline(error)) {
        const product = getOfflineProduct(id);
        if (product) return buildOfflineSuccess({ product });
      }
      throw error;
    }
  },

  getProductByBarcode: async (
    barcode: string,
  ): Promise<ApiResponse<{ product: Product }>> => {
    if (isDesktopOffline()) {
      const product = findOfflineProductByBarcode(barcode);
      if (product) return buildOfflineSuccess({ product });
    }

    try {
      const response = await apiClient.get(`/products/barcode/${barcode}`);
      return response.data;
    } catch (error) {
      if (shouldFallbackToDesktopOffline(error)) {
        const product = findOfflineProductByBarcode(barcode);
        if (product) return buildOfflineSuccess({ product });
      }
      throw error;
    }
  },

  getStockPrediction: async (
    id: string,
    lookbackDays = 60,
  ): Promise<ApiResponse<ProductStockPrediction>> => {
    const response = await apiClient.get(
      `/products/${id}/stock-prediction?lookbackDays=${lookbackDays}`,
    );
    return response.data;
  },

  createProduct: async (
    product: Partial<Product>,
  ): Promise<ApiResponse<{ product: Product }>> => {
    if (isDesktopOffline()) {
      return buildOfflineSuccess({ product: createOfflineProduct(product) });
    }

    try {
      const response = await apiClient.post("/products", product);
      if (response.data.data.product) {
        seedOfflineProductsFromRemote([response.data.data.product]);
      }
      return response.data;
    } catch (error) {
      if (shouldFallbackToDesktopOffline(error)) {
        return buildOfflineSuccess({ product: createOfflineProduct(product) });
      }
      throw error;
    }
  },

  updateProduct: async (
    id: string,
    product: Partial<Product>,
  ): Promise<ApiResponse<{ product: Product }>> => {
    if (isDesktopOffline()) {
      return buildOfflineSuccess({ product: updateOfflineProduct(id, product) });
    }

    try {
      const response = await apiClient.put(`/products/${id}`, product);
      if (response.data.data.product) {
        seedOfflineProductsFromRemote([response.data.data.product]);
      }
      return response.data;
    } catch (error) {
      if (shouldFallbackToDesktopOffline(error)) {
        return buildOfflineSuccess({ product: updateOfflineProduct(id, product) });
      }
      throw error;
    }
  },

  deleteProduct: async (
    id: string,
  ): Promise<ApiResponse<{ message?: string }>> => {
    if (isDesktopOffline()) {
      deleteOfflineProduct(id);
      return buildOfflineSuccess({ message: "Product queued for deletion" });
    }

    try {
      const response = await apiClient.delete(`/products/${id}`);
      return response.data;
    } catch (error) {
      if (shouldFallbackToDesktopOffline(error)) {
        deleteOfflineProduct(id);
        return buildOfflineSuccess({ message: "Product queued for deletion" });
      }
      throw error;
    }
  },

  updateStock: async (
    id: string,
    quantity: number,
    operation: "set" | "add" | "subtract" = "set",
  ): Promise<ApiResponse<{ product: Partial<Product> }>> => {
    if (isDesktopOffline()) {
      const product = updateOfflineProductStock(id, quantity, operation);
      if (product) return buildOfflineSuccess({ product });
    }

    try {
      const response = await apiClient.patch(`/products/${id}/stock`, {
        quantity,
        operation,
      });
      return response.data;
    } catch (error) {
      if (shouldFallbackToDesktopOffline(error)) {
        const product = updateOfflineProductStock(id, quantity, operation);
        if (product) return buildOfflineSuccess({ product });
      }
      throw error;
    }
  },

  recordSale: async (
    id: string,
    quantity: number,
    price?: number,
  ): Promise<ApiResponse<{ product: Partial<Product> }>> => {
    if (isDesktopOffline()) {
      const product = applyOfflineProductStock(id, quantity, "subtract");
      if (product) {
        enqueueOfflineWrite({
          method: "post",
          url: `/products/${id}/sale`,
          data: { quantity, price },
          entity: "product",
          action: "recordSale",
          localId: id,
        });
        return buildOfflineSuccess({ product });
      }
    }

    try {
      const response = await apiClient.post(`/products/${id}/sale`, {
        quantity,
        price,
      });
      return response.data;
    } catch (error) {
      if (shouldFallbackToDesktopOffline(error)) {
        const product = applyOfflineProductStock(id, quantity, "subtract");
        if (product) {
          enqueueOfflineWrite({
            method: "post",
            url: `/products/${id}/sale`,
            data: { quantity, price },
            entity: "product",
            action: "recordSale",
            localId: id,
          });
          return buildOfflineSuccess({ product });
        }
      }
      throw error;
    }
  },

  getCategories: async (): Promise<ApiResponse<{ categories: string[] }>> => {
    if (isDesktopOffline()) {
      return getOfflineCategories();
    }

    try {
      const response = await apiClient.get("/products/categories/all");
      return response.data;
    } catch (error) {
      if (shouldFallbackToDesktopOffline(error)) {
        return getOfflineCategories();
      }
      throw error;
    }
  },

  getAnalytics: async (
    params?: Record<string, string | number>,
  ): Promise<ApiResponse<Analytics>> => {
    const query = params
      ? `?${new URLSearchParams(
          Object.entries(params).map(([key, value]) => [key, String(value)]),
        ).toString()}`
      : "";
    const response = await apiClient.get(
      `/products/analytics/overview${query}`,
    );
    return response.data;
  },
  recalculateAnalytics: async (): Promise<
    ApiResponse<{ updated: number; reset: number }>
  > => {
    const response = await apiClient.post("/products/analytics/recalculate");
    return response.data;
  },

  // Export products
  exportProducts: async (format: "csv" | "excel" = "csv"): Promise<Blob> => {
    const response = await apiClient.get(`/products/export?format=${format}`, {
      responseType: "blob",
    });
    return response.data;
  },

  // Import products
  importProducts: async (
    products: Partial<Product>[],
  ): Promise<
    ApiResponse<{
      created: number;
      updated: number;
      errors: { sku: string; error: string }[];
    }>
  > => {
    if (isDesktopOffline()) {
      products.forEach((product) => createOfflineProduct(product));
      return buildOfflineSuccess({
        created: products.length,
        updated: 0,
        errors: [],
      });
    }

    try {
      const response = await apiClient.post("/products/import", { products });
      return response.data;
    } catch (error) {
      if (shouldFallbackToDesktopOffline(error)) {
        products.forEach((product) => createOfflineProduct(product));
        return buildOfflineSuccess({
          created: products.length,
          updated: 0,
          errors: [],
        });
      }
      throw error;
    }
  },

  // Get dead stock items
  getDeadStock: async (
    days = 60,
  ): Promise<ApiResponse<{ products: Product[]; totalValue: number }>> => {
    const response = await apiClient.get(`/products/dead-stock?days=${days}`);
    return response.data;
  },

  // Get fast selling products
  getFastSelling: async (
    days = 7,
  ): Promise<ApiResponse<{ products: Product[] }>> => {
    const response = await apiClient.get(`/products/fast-selling?days=${days}`);
    return response.data;
  },
};

// Sales API
export const salesAPI = {
  getSales: async (
    filters?: SaleFilters,
  ): Promise<ApiResponse<PaginatedResponse<Sale>>> => {
    if (isDesktopOffline()) {
      return getOfflineSalesPage(filters);
    }

    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    try {
      const response = await apiClient.get(`/sales?${params.toString()}`);
      seedOfflineSalesFromRemote(response.data.data.sales || []);
      return response.data;
    } catch (error) {
      if (shouldFallbackToDesktopOffline(error)) {
        return getOfflineSalesPage(filters);
      }
      throw error;
    }
  },

  getSale: async (id: string): Promise<ApiResponse<{ sale: Sale }>> => {
    if (isDesktopOffline()) {
      const sale = getOfflineSale(id);
      if (sale) return buildOfflineSuccess({ sale });
    }

    try {
      const response = await apiClient.get(`/sales/${id}`);
      return response.data;
    } catch (error) {
      if (shouldFallbackToDesktopOffline(error)) {
        const sale = getOfflineSale(id);
        if (sale) return buildOfflineSuccess({ sale });
      }
      throw error;
    }
  },

  createSale: async (
    saleData: CreateSaleData,
  ): Promise<ApiResponse<{ sale: Sale }>> => {
    if (isDesktopOffline()) {
      return buildOfflineSuccess({ sale: createOfflineSale(saleData) });
    }

    try {
      const response = await apiClient.post("/sales", saleData);
      if (response.data.data.sale) {
        seedOfflineSalesFromRemote([response.data.data.sale]);
      }
      return response.data;
    } catch (error) {
      if (shouldFallbackToDesktopOffline(error)) {
        return buildOfflineSuccess({ sale: createOfflineSale(saleData) });
      }
      throw error;
    }
  },

  quickSale: async (
    data: QuickSaleData,
  ): Promise<ApiResponse<{ sale: Sale; remainingStock: number }>> => {
    if (isDesktopOffline()) {
      return buildOfflineSuccess(createOfflineQuickSale(data));
    }

    try {
      const response = await apiClient.post("/sales/quick", data);
      if (response.data.data.sale) {
        seedOfflineSalesFromRemote([response.data.data.sale]);
      }
      return response.data;
    } catch (error) {
      if (shouldFallbackToDesktopOffline(error)) {
        return buildOfflineSuccess(createOfflineQuickSale(data));
      }
      throw error;
    }
  },

  updateSaleStatus: async (
    id: string,
    data: {
      status?: string;
      paymentStatus?: string;
      shipping?: Partial<Sale["shipping"]>;
    },
  ): Promise<ApiResponse<{ sale: Sale }>> => {
    if (isDesktopOffline()) {
      const sale = updateOfflineSaleStatus(id, data);
      if (sale) return buildOfflineSuccess({ sale });
    }

    try {
      const response = await apiClient.put(`/sales/${id}/status`, data);
      if (response.data.data.sale) {
        seedOfflineSalesFromRemote([response.data.data.sale]);
      }
      return response.data;
    } catch (error) {
      if (shouldFallbackToDesktopOffline(error)) {
        const sale = updateOfflineSaleStatus(id, data);
        if (sale) return buildOfflineSuccess({ sale });
      }
      throw error;
    }
  },

  deleteSale: async (
    id: string,
  ): Promise<ApiResponse<{ message?: string }>> => {
    if (isDesktopOffline()) {
      deleteOfflineSale(id);
      return buildOfflineSuccess({ message: "Sale queued for deletion" });
    }

    try {
      const response = await apiClient.delete(`/sales/${id}`);
      return response.data;
    } catch (error) {
      if (shouldFallbackToDesktopOffline(error)) {
        deleteOfflineSale(id);
        return buildOfflineSuccess({ message: "Sale queued for deletion" });
      }
      throw error;
    }
  },

  getAnalytics: async (
    startDate?: string,
    endDate?: string,
  ): Promise<ApiResponse<SalesAnalytics>> => {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    const response = await apiClient.get(
      `/sales/analytics/overview?${params.toString()}`,
    );
    return response.data;
  },

  getBranchPerformance: async (
    startDate?: string,
    endDate?: string,
  ): Promise<ApiResponse<BranchPerformanceAnalytics>> => {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    const query = params.toString();
    const response = await apiClient.get(
      `/sales/analytics/branches${query ? `?${query}` : ""}`,
    );
    return response.data;
  },

  // Get pending shipments
  getPendingShipments: async (): Promise<ApiResponse<{ sales: Sale[] }>> => {
    const response = await apiClient.get("/sales/pending-shipments");
    return response.data;
  },

  // Export sales
  exportSales: async (
    format: "csv" | "excel" = "csv",
    startDate?: string,
    endDate?: string,
  ): Promise<Blob> => {
    const params = new URLSearchParams();
    params.append("format", format);
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    const response = await apiClient.get(`/sales/export?${params.toString()}`, {
      responseType: "blob",
    });
    return response.data;
  },

  // Send WhatsApp notification
  sendWhatsAppNotification: async (
    saleId: string,
  ): Promise<ApiResponse<{ message: string; whatsappSent: boolean }>> => {
    const response = await apiClient.post(`/sales/${saleId}/whatsapp`);
    return response.data;
  },

  // Stock transfers
  transferStock: async (payload: {
    destinationStockId: string;
    items: Array<{ productId: string; quantity: number }>;
  }): Promise<ApiResponse<{ transfer: Sale; transferredItems: number }>> => {
    const response = await apiClient.post("/sales/transfer", payload);
    return response.data;
  },

  getTransfers: async (page = 1, limit = 20): Promise<ApiResponse<{
    transfers: Sale[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }>> => {
    const response = await apiClient.get(`/sales/transfers?page=${page}&limit=${limit}`);
    return response.data;
  },
};

export const expensesAPI = {
  getExpenses: async (filters?: ExpenseFilters): Promise<
    ApiResponse<{
      expenses: Expense[];
      pagination: { page: number; limit: number; total: number; pages: number };
      summary: {
        totalAmount: number;
        paidAmount: number;
        remainingAmount: number;
        pendingReimbursements: number;
      };
    }>
  > => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString();
    const response = await apiClient.get(`/expenses${query ? `?${query}` : ""}`);
    return response.data;
  },

  getExpense: async (id: string): Promise<ApiResponse<{ expense: Expense }>> => {
    const response = await apiClient.get(`/expenses/${id}`);
    return response.data;
  },

  createExpense: async (
    payload: Partial<Expense> & { initialPaidAmount?: number; initialPaymentNote?: string },
  ): Promise<ApiResponse<{ expense: Expense }>> => {
    const response = await apiClient.post("/expenses", payload);
    return response.data;
  },

  updateExpense: async (
    id: string,
    payload: Partial<Expense>,
  ): Promise<ApiResponse<{ expense: Expense }>> => {
    const response = await apiClient.put(`/expenses/${id}`, payload);
    return response.data;
  },

  approveExpense: async (
    id: string,
  ): Promise<ApiResponse<{ expense: Expense }>> => {
    const response = await apiClient.post(`/expenses/${id}/approve`);
    return response.data;
  },

  recordPayment: async (
    id: string,
    payload: {
      amount: number;
      paidAt?: string;
      paymentMethod?: Expense["paymentMethod"];
      note?: string;
      referenceNumber?: string;
    },
  ): Promise<ApiResponse<{ expense: Expense }>> => {
    const response = await apiClient.post(`/expenses/${id}/payments`, payload);
    return response.data;
  },

  recordReimbursement: async (
    id: string,
    payload: {
      amount: number;
      reimbursedAt?: string;
      paymentMethod?: Expense["paymentMethod"];
      note?: string;
      referenceNumber?: string;
    },
  ): Promise<ApiResponse<{ expense: Expense }>> => {
    const response = await apiClient.post(
      `/expenses/${id}/reimbursements`,
      payload,
    );
    return response.data;
  },

  cancelExpense: async (
    id: string,
  ): Promise<ApiResponse<{ expense: Expense }>> => {
    const response = await apiClient.post(`/expenses/${id}/cancel`);
    return response.data;
  },

  deleteExpense: async (
    id: string,
  ): Promise<ApiResponse<Record<string, never>>> => {
    const response = await apiClient.delete(`/expenses/${id}`);
    return response.data;
  },

  generateRecurring: async (): Promise<ApiResponse<{ generated: number }>> => {
    const response = await apiClient.post("/expenses/recurring/generate");
    return response.data;
  },

  getAnalytics: async (params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<ExpenseAnalytics>> => {
    const query = new URLSearchParams();
    if (params?.startDate) query.append("startDate", params.startDate);
    if (params?.endDate) query.append("endDate", params.endDate);
    const search = query.toString();
    const response = await apiClient.get(
      `/expenses/analytics/overview${search ? `?${search}` : ""}`,
    );
    return response.data;
  },

  getPayrollWorkers: async (params?: {
    startDate?: string;
    endDate?: string;
    includeInactive?: boolean;
  }): Promise<
    ApiResponse<{
      summary: ExpensePayrollSummary;
      workers: ExpensePayrollWorker[];
    }>
  > => {
    const query = new URLSearchParams();
    if (params?.startDate) query.append("startDate", params.startDate);
    if (params?.endDate) query.append("endDate", params.endDate);
    if (typeof params?.includeInactive === "boolean") {
      query.append("includeInactive", String(params.includeInactive));
    }
    const search = query.toString();
    const response = await apiClient.get(
      `/expenses/payroll/workers${search ? `?${search}` : ""}`,
    );
    return response.data;
  },

  exportExpenses: async (): Promise<Blob> => {
    const response = await apiClient.get("/expenses/export", {
      responseType: "blob",
    });
    return response.data;
  },
};

// Invoices API
export const invoicesAPI = {
  getInvoices: async (
    filters?: InvoiceFilters,
  ): Promise<
    ApiResponse<{
      invoices: Invoice[];
      pagination: { page: number; limit: number; total: number; pages: number };
      summary: {
        totalInvoiced: number;
        totalPaid: number;
        totalOutstanding: number;
        count: number;
      };
    }>
  > => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString();
    const response = await apiClient.get(
      `/invoices${query ? `?${query}` : ""}`,
    );
    return response.data;
  },

  getInvoice: async (
    id: string,
  ): Promise<ApiResponse<{ invoice: Invoice }>> => {
    const response = await apiClient.get(`/invoices/${id}`);
    return response.data;
  },

  createInvoice: async (
    invoiceData: Partial<Invoice>,
  ): Promise<ApiResponse<{ invoice: Invoice }>> => {
    const response = await apiClient.post("/invoices", invoiceData);
    return response.data;
  },

  createFromOrder: async (
    orderId: string,
    payload?: { dueDate?: string },
  ): Promise<ApiResponse<{ invoice: Invoice }>> => {
    const response = await apiClient.post(
      `/invoices/from-order/${orderId}`,
      payload || {},
    );
    return response.data;
  },

  updateInvoice: async (
    id: string,
    invoiceData: Partial<Invoice>,
  ): Promise<ApiResponse<{ invoice: Invoice }>> => {
    const response = await apiClient.put(`/invoices/${id}`, invoiceData);
    return response.data;
  },

  deleteInvoice: async (
    id: string,
  ): Promise<ApiResponse<Record<string, never>>> => {
    const response = await apiClient.delete(`/invoices/${id}`);
    return response.data;
  },

  sendInvoice: async (
    id: string,
    payload?: { dueDate?: string },
  ): Promise<ApiResponse<{ invoice: Invoice }>> => {
    const response = await apiClient.post(
      `/invoices/${id}/send`,
      payload || {},
    );
    return response.data;
  },

  recordPayment: async (
    id: string,
    paymentData: Partial<Payment>,
  ): Promise<ApiResponse<{ invoice: Invoice }>> => {
    const response = await apiClient.post(
      `/invoices/${id}/payments`,
      paymentData,
    );
    return response.data;
  },

  cancelInvoice: async (
    id: string,
    reason?: string,
  ): Promise<ApiResponse<{ invoice: Invoice; creditNote?: Invoice }>> => {
    const response = await apiClient.post(`/invoices/${id}/cancel`, { reason });
    return response.data;
  },

  duplicateInvoice: async (
    id: string,
  ): Promise<ApiResponse<{ invoice: Invoice }>> => {
    const response = await apiClient.post(`/invoices/${id}/duplicate`);
    return response.data;
  },

  generatePDF: async (id: string): Promise<Blob> => {
    const response = await apiClient.get(`/invoices/${id}/pdf`, {
      responseType: "blob",
    });
    return response.data;
  },

  getStats: async (): Promise<ApiResponse<InvoiceStats>> => {
    const response = await apiClient.get("/invoices/stats");
    return response.data;
  },

  getCustomers: async (
    search?: string,
  ): Promise<ApiResponse<InvoiceCustomer[]>> => {
    const params = search ? `?search=${encodeURIComponent(search)}` : "";
    const response = await apiClient.get(`/invoices/customers${params}`);
    return response.data;
  },
};

// Clients API
export const clientsAPI = {
  getClients: async (params?: {
    range?: TeamDetailsRangeKey | string;
    startDate?: string;
    endDate?: string;
    search?: string;
    inDebtOnly?: boolean;
    sortBy?:
      | "spent"
      | "debt"
      | "orders"
      | "recent"
      | "returnRate"
      | "name"
      | string;
    sortDirection?: "asc" | "desc";
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<ClientsOverviewData>> => {
    const queryParams = new URLSearchParams();
    if (params?.range) queryParams.append("range", params.range);
    if (params?.startDate) queryParams.append("startDate", params.startDate);
    if (params?.endDate) queryParams.append("endDate", params.endDate);
    if (params?.search) queryParams.append("search", params.search);
    if (typeof params?.inDebtOnly === "boolean")
      queryParams.append("inDebtOnly", String(params.inDebtOnly));
    if (params?.sortBy) queryParams.append("sortBy", params.sortBy);
    if (params?.sortDirection)
      queryParams.append("sortDirection", params.sortDirection);
    if (typeof params?.page === "number")
      queryParams.append("page", String(params.page));
    if (typeof params?.limit === "number")
      queryParams.append("limit", String(params.limit));
    const query = queryParams.toString();
    const response = await apiClient.get(`/clients${query ? `?${query}` : ""}`);
    return response.data;
  },

  upsertClient: async (payload: {
    name: string;
    email?: string;
    phone?: string;
    pricingTier?: ClientRecord["pricingTier"];
    notes?: string;
  }): Promise<
    ApiResponse<{
      profile: Pick<
        ClientRecord,
        | "id"
        | "clientKey"
        | "name"
        | "email"
        | "phone"
        | "pricingTier"
        | "notes"
      > & {
        debt?: Record<string, unknown>;
      };
    }>
  > => {
    const response = await apiClient.post("/clients", payload);
    return response.data;
  },

  updateClientDebt: async (
    clientKey: string,
    payload: {
      isInDebt: boolean;
      amount?: number;
      note?: string;
      name?: string;
      email?: string;
      phone?: string;
      pricingTier?: ClientRecord["pricingTier"];
    },
  ): Promise<
    ApiResponse<{
      profile: Pick<
        ClientRecord,
        | "id"
        | "clientKey"
        | "name"
        | "email"
        | "phone"
        | "pricingTier"
        | "notes"
      > & {
        debt: {
          isMarked: boolean;
          amount: number;
          note: string;
          markedAt: string | null;
          clearedAt: string | null;
        };
      };
    }>
  > => {
    const response = await apiClient.patch(
      `/clients/${encodeURIComponent(clientKey)}/debt`,
      payload,
    );
    return response.data;
  },

  deleteClient: async (
    clientKey: string,
    payload?: { name?: string; email?: string; phone?: string },
  ): Promise<ApiResponse<Record<string, never>>> => {
    const response = await apiClient.delete(
      `/clients/${encodeURIComponent(clientKey)}`,
      {
        data: payload,
      },
    );
    return response.data;
  },

  getWholesale: async (
    clientId: string,
  ): Promise<ApiResponse<ClientWholesaleSummary>> => {
    const response = await apiClient.get(
      `/clients/${encodeURIComponent(clientId)}/wholesale`,
    );
    return response.data;
  },

  updateWholesale: async (
    clientId: string,
    payload: Partial<{
      clientKey: string;
      clientName: string;
      name: string;
      email: string;
      phone: string;
      isWholesaler: boolean;
      supplierCode: string;
      paymentTerms: string;
      defaultCurrency: string;
      supplierTaxRegime: SupplierTaxRegime;
      defaultPurchaseTaxRate: number;
      nif: string;
      rc: string;
      nis: string;
      ai: string;
      notes: string;
    }>,
  ): Promise<ApiResponse<ClientWholesaleSummary>> => {
    const response = await apiClient.patch(
      `/clients/${encodeURIComponent(clientId)}/wholesale`,
      payload,
    );
    return response.data;
  },

  getPurchases: async (
    clientId: string,
    params?: {
      status?: SupplierPurchaseStatus;
      limit?: number;
    },
  ): Promise<ApiResponse<{ purchases: SupplierPurchase[] }>> => {
    const query = new URLSearchParams();
    if (params?.status) query.append("status", params.status);
    if (typeof params?.limit === "number")
      query.append("limit", String(params.limit));
    const search = query.toString();
    const response = await apiClient.get(
      `/clients/${encodeURIComponent(clientId)}/purchases${search ? `?${search}` : ""}`,
    );
    return response.data;
  },

  createPurchase: async (
    clientId: string,
    payload: SupplierPurchaseCreatePayload,
  ): Promise<ApiResponse<{ purchase: SupplierPurchase }>> => {
    const response = await apiClient.post(
      `/clients/${encodeURIComponent(clientId)}/purchases`,
      payload,
    );
    return response.data;
  },
};

export const distributorsAPI = {
  getDistributors: async (
    search?: string,
  ): Promise<ApiResponse<DistributorsOverviewData>> => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    const query = params.toString();
    const response = await apiClient.get(
      `/distributors${query ? `?${query}` : ""}`,
    );
    return response.data;
  },

  createDistributor: async (
    payload: Partial<DistributorRecord> & {
      name: string;
    },
  ): Promise<ApiResponse<{ distributor: DistributorRecord }>> => {
    const response = await apiClient.post("/distributors", payload);
    return response.data;
  },

  updateDistributor: async (
    distributorId: string,
    payload: Partial<DistributorRecord> & {
      name: string;
    },
  ): Promise<ApiResponse<{ distributor: DistributorRecord }>> => {
    const response = await apiClient.put(
      `/distributors/${encodeURIComponent(distributorId)}`,
      payload,
    );
    return response.data;
  },

  deleteDistributor: async (
    distributorId: string,
  ): Promise<ApiResponse<Record<string, never>>> => {
    const response = await apiClient.delete(
      `/distributors/${encodeURIComponent(distributorId)}`,
    );
    return response.data;
  },

  getWholesale: async (
    distributorId: string,
  ): Promise<ApiResponse<ClientWholesaleSummary>> => {
    const response = await apiClient.get(
      `/distributors/${encodeURIComponent(distributorId)}/summary`,
    );
    return response.data;
  },

  updateWholesale: async (
    distributorId: string,
    payload: Partial<{
      clientKey: string;
      clientName: string;
      name: string;
      email: string;
      phone: string;
      isWholesaler: boolean;
      supplierCode: string;
      paymentTerms: string;
      defaultCurrency: string;
      supplierTaxRegime: SupplierTaxRegime;
      defaultPurchaseTaxRate: number;
      nif: string;
      rc: string;
      nis: string;
      ai: string;
      notes: string;
    }>,
  ): Promise<ApiResponse<ClientWholesaleSummary>> => {
    const response = await apiClient.patch(
      `/distributors/${encodeURIComponent(distributorId)}/settings`,
      payload,
    );
    return response.data;
  },

  getPurchases: async (
    distributorId: string,
    params?: {
      status?: SupplierPurchaseStatus;
      limit?: number;
    },
  ): Promise<ApiResponse<{ purchases: SupplierPurchase[] }>> => {
    const query = new URLSearchParams();
    if (params?.status) query.append("status", params.status);
    if (typeof params?.limit === "number")
      query.append("limit", String(params.limit));
    const search = query.toString();
    const response = await apiClient.get(
      `/distributors/${encodeURIComponent(distributorId)}/purchases${search ? `?${search}` : ""}`,
    );
    return response.data;
  },

  createPurchase: async (
    distributorId: string,
    payload: SupplierPurchaseCreatePayload,
  ): Promise<ApiResponse<{ purchase: SupplierPurchase }>> => {
    const response = await apiClient.post(
      `/distributors/${encodeURIComponent(distributorId)}/purchases`,
      payload,
    );
    return response.data;
  },
};

export const supplierPurchasesAPI = {
  getPurchase: async (
    purchaseId: string,
  ): Promise<ApiResponse<{ purchase: SupplierPurchase }>> => {
    const response = await apiClient.get(`/purchases/${purchaseId}`);
    return response.data;
  },

  updatePurchase: async (
    purchaseId: string,
    payload: Partial<SupplierPurchase>,
  ): Promise<ApiResponse<{ purchase: SupplierPurchase }>> => {
    const response = await apiClient.put(`/purchases/${purchaseId}`, payload);
    return response.data;
  },

  recordPayment: async (
    purchaseId: string,
    payload: {
      amount: number;
      date?: string;
      method?: string;
      scope?: "balance" | "external";
      notes?: string;
    },
  ): Promise<ApiResponse<{ purchase: SupplierPurchase }>> => {
    const response = await apiClient.post(
      `/purchases/${purchaseId}/payments`,
      payload,
    );
    return response.data;
  },

  receivePurchase: async (
    purchaseId: string,
    payload?: {
      items?: Array<{
        product: string;
        receivedQuantity?: number;
        quantityReceived?: number;
        additionalQuantity?: number;
      }>;
    },
  ): Promise<ApiResponse<{ purchase: SupplierPurchase }>> => {
    const response = await apiClient.post(
      `/purchases/${purchaseId}/receive`,
      payload || {},
    );
    return response.data;
  },
};

// Action Center API
export const actionCenterAPI = {
  getActionItems: async (): Promise<ApiResponse<{ actions: ActionItem[] }>> => {
    const response = await apiClient.get("/action-center/items");
    return response.data;
  },

  getStockHealth: async (): Promise<ApiResponse<StockHealthScore>> => {
    const response = await apiClient.get("/action-center/stock-health");
    return response.data;
  },

  getTodayPriorities: async (): Promise<
    ApiResponse<{ priorities: ActionItem[]; count: number }>
  > => {
    const response = await apiClient.get("/action-center/today-priorities");
    return response.data;
  },
};

// AI Insights API
export const aiInsightsAPI = {
  getInsights: async (
    filters?: AIInsightFilters,
  ): Promise<ApiResponse<{ insights: AIInsight[] }>> => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          params.append(key, String(value));
        }
      });
    }

    const query = params.toString();
    const response = await apiClient.get(
      `/ai/insights${query ? `?${query}` : ""}`,
    );
    return response.data;
  },

  updateInsightStatus: async (
    insightId: string,
    status: AIInsightStatus,
  ): Promise<ApiResponse<{ insight: AIInsight }>> => {
    const response = await apiClient.patch(`/ai/insights/${insightId}/status`, {
      status,
    });
    return response.data;
  },
};

// Business Toolkit API
export const businessAPI = {
  getCapabilities: async (): Promise<
    ApiResponse<{ businessType: BusinessType; capabilities: string[] }>
  > => {
    const response = await apiClient.get("/business/capabilities");
    return response.data;
  },

  getHighlights: async (): Promise<ApiResponse<BusinessHighlights>> => {
    const response = await apiClient.get("/business/highlights");
    return response.data;
  },

  getEcommercePipeline: async (): Promise<
    ApiResponse<{
      summary: {
        confirmed: number;
        processing: number;
        shipping: number;
        delivered: number;
      };
      oldestOpenOrders: Array<{
        _id: string;
        orderNumber: string;
        status: string;
        createdAt: string;
        customer?: { name?: string };
        shipping?: { status?: string };
      }>;
    }>
  > => {
    const response = await apiClient.get("/business/ecommerce/pipeline");
    return response.data;
  },

  getClothingVariants: async (
    productId?: string,
  ): Promise<ApiResponse<{ variants: ClothingVariant[] }>> => {
    const params = productId
      ? `?productId=${encodeURIComponent(productId)}`
      : "";
    const response = await apiClient.get(
      `/business/clothing/variants${params}`,
    );
    return response.data;
  },

  createClothingVariant: async (payload: {
    productId: string;
    variantSku: string;
    barcode?: string;
    size?: string;
    color?: string;
    quantity?: number;
    priceAdjustment?: number;
  }): Promise<ApiResponse<{ variant: ClothingVariant }>> => {
    const response = await apiClient.post(
      "/business/clothing/variants",
      payload,
    );
    return response.data;
  },

  updateClothingVariant: async (
    variantId: string,
    payload: Partial<{
      variantSku: string;
      barcode: string;
      size: string;
      color: string;
      quantity: number;
      priceAdjustment: number;
    }>,
  ): Promise<ApiResponse<{ variant: ClothingVariant }>> => {
    const response = await apiClient.put(
      `/business/clothing/variants/${variantId}`,
      payload,
    );
    return response.data;
  },

  deleteClothingVariant: async (
    variantId: string,
  ): Promise<ApiResponse<Record<string, never>>> => {
    const response = await apiClient.delete(
      `/business/clothing/variants/${variantId}`,
    );
    return response.data;
  },

  getClothingReturns: async (
    status?: ClothingReturnStatus,
  ): Promise<ApiResponse<{ returns: ClothingReturnRecord[] }>> => {
    const params = status ? `?status=${encodeURIComponent(status)}` : "";
    const response = await apiClient.get(`/business/clothing/returns${params}`);
    return response.data;
  },

  createClothingReturn: async (payload: {
    saleId: string;
    reason?:
      | "wrong_size"
      | "damaged_item"
      | "wrong_item"
      | "quality_issue"
      | "other";
    refundAmount?: number;
    notes?: string;
    items?: Array<{
      product?: string;
      name: string;
      sku: string;
      quantity: number;
      condition?: "new" | "opened" | "damaged" | "used";
    }>;
  }): Promise<ApiResponse<{ returnItem: ClothingReturnRecord }>> => {
    const response = await apiClient.post(
      "/business/clothing/returns",
      payload,
    );
    return response.data;
  },

  updateClothingReturnStatus: async (
    returnId: string,
    payload: {
      status: ClothingReturnStatus;
      notes?: string;
      refundAmount?: number;
    },
  ): Promise<ApiResponse<{ returnItem: ClothingReturnRecord }>> => {
    const response = await apiClient.put(
      `/business/clothing/returns/${returnId}/status`,
      payload,
    );
    return response.data;
  },

  getSupermarketBatches: async (
    expiringInDays?: number,
  ): Promise<ApiResponse<{ batches: SupermarketBatch[] }>> => {
    const params = expiringInDays ? `?expiringInDays=${expiringInDays}` : "";
    const response = await apiClient.get(
      `/business/supermarket/batches${params}`,
    );
    return response.data;
  },

  createSupermarketBatch: async (payload: {
    productId: string;
    batchCode: string;
    quantity: number;
    expiresAt: string;
    receivedAt?: string;
    costPerUnit?: number;
    notes?: string;
  }): Promise<ApiResponse<{ batch: SupermarketBatch }>> => {
    const response = await apiClient.post(
      "/business/supermarket/batches",
      payload,
    );
    return response.data;
  },

  updateSupermarketBatch: async (
    batchId: string,
    payload: Partial<{
      batchCode: string;
      quantity: number;
      expiresAt: string;
      receivedAt: string;
      costPerUnit: number;
      notes: string;
    }>,
  ): Promise<ApiResponse<{ batch: SupermarketBatch }>> => {
    const response = await apiClient.put(
      `/business/supermarket/batches/${batchId}`,
      payload,
    );
    return response.data;
  },

  deleteSupermarketBatch: async (
    batchId: string,
  ): Promise<ApiResponse<Record<string, never>>> => {
    const response = await apiClient.delete(
      `/business/supermarket/batches/${batchId}`,
    );
    return response.data;
  },

  getSupermarketPromotions: async (
    includeInactive = false,
  ): Promise<ApiResponse<{ promotions: SupermarketPromotion[] }>> => {
    const params = includeInactive ? "?includeInactive=true" : "";
    const response = await apiClient.get(
      `/business/supermarket/promotions${params}`,
    );
    return response.data;
  },

  createSupermarketPromotion: async (payload: {
    name: string;
    description?: string;
    productIds?: string[];
    bundleItems?: Array<{
      productId: string;
      quantity: number;
    }>;
    bundlePrice?: number;
    startsAt: string;
    endsAt: string;
    isActive?: boolean;
  }): Promise<ApiResponse<{ promotion: SupermarketPromotion }>> => {
    const response = await apiClient.post(
      "/business/supermarket/promotions",
      payload,
    );
    return response.data;
  },

  updateSupermarketPromotion: async (
    promotionId: string,
    payload: Partial<{
      name: string;
      description: string;
      productIds: string[];
      bundleItems: Array<{
        productId: string;
        quantity: number;
      }>;
      bundlePrice: number;
      startsAt: string;
      endsAt: string;
      isActive: boolean;
    }>,
  ): Promise<ApiResponse<{ promotion: SupermarketPromotion }>> => {
    const response = await apiClient.put(
      `/business/supermarket/promotions/${promotionId}`,
      payload,
    );
    return response.data;
  },

  deleteSupermarketPromotion: async (
    promotionId: string,
  ): Promise<ApiResponse<Record<string, never>>> => {
    const response = await apiClient.delete(
      `/business/supermarket/promotions/${promotionId}`,
    );
    return response.data;
  },

  getPurchaseOrders: async (params?: {
    status?: PurchaseOrderStatus;
    search?: string;
    limit?: number;
  }): Promise<ApiResponse<{ purchaseOrders: PurchaseOrder[] }>> => {
    const query = new URLSearchParams();
    if (params?.status) query.append("status", params.status);
    if (params?.search) query.append("search", params.search);
    if (typeof params?.limit === "number")
      query.append("limit", String(params.limit));
    const search = query.toString();
    const response = await apiClient.get(
      `/business/wholesale/purchase-orders${search ? `?${search}` : ""}`,
    );
    return response.data;
  },

  getPurchaseOrder: async (
    purchaseOrderId: string,
  ): Promise<ApiResponse<{ purchaseOrder: PurchaseOrder }>> => {
    const response = await apiClient.get(
      `/business/wholesale/purchase-orders/${purchaseOrderId}`,
    );
    return response.data;
  },

  createPurchaseOrder: async (
    payload: Partial<PurchaseOrder>,
  ): Promise<ApiResponse<{ purchaseOrder: PurchaseOrder }>> => {
    const response = await apiClient.post(
      "/business/wholesale/purchase-orders",
      payload,
    );
    return response.data;
  },

  updatePurchaseOrder: async (
    purchaseOrderId: string,
    payload: Partial<PurchaseOrder>,
  ): Promise<ApiResponse<{ purchaseOrder: PurchaseOrder }>> => {
    const response = await apiClient.put(
      `/business/wholesale/purchase-orders/${purchaseOrderId}`,
      payload,
    );
    return response.data;
  },

  updatePurchaseOrderStatus: async (
    purchaseOrderId: string,
    status: PurchaseOrderStatus,
  ): Promise<ApiResponse<{ purchaseOrder: PurchaseOrder }>> => {
    const response = await apiClient.put(
      `/business/wholesale/purchase-orders/${purchaseOrderId}/status`,
      { status },
    );
    return response.data;
  },

  deletePurchaseOrder: async (
    purchaseOrderId: string,
  ): Promise<ApiResponse<Record<string, never>>> => {
    const response = await apiClient.delete(
      `/business/wholesale/purchase-orders/${purchaseOrderId}`,
    );
    return response.data;
  },
};

// Integrations API
export const integrationsAPI = {
  getShopifyStatus: async (): Promise<
    ApiResponse<{
      shopify: ShopifyIntegrationStatus | null;
      setup: ShopifyIntegrationSetupStatus;
      recentEvents?: ShopifyWebhookEvent[];
    }>
  > => {
    const response = await apiClient.get("/integrations/shopify/status");
    return response.data;
  },
  connectShopify: async (payload: {
    shop: string;
  }): Promise<ApiResponse<{ authUrl: string }>> => {
    const response = await apiClient.post("/integrations/shopify/connect", payload);
    return response.data;
  },
  disconnectShopify: async (): Promise<
    ApiResponse<{ shopify: ShopifyIntegrationStatus | null }>
  > => {
    const response = await apiClient.post("/integrations/shopify/disconnect");
    return response.data;
  },
  testShopifyConnection: async (): Promise<
    ApiResponse<{
      shopName?: string;
      shopDomain: string;
      currency?: string;
      timezone?: string;
      primaryLocationId?: string;
      primaryLocationName?: string;
      grantedScopes?: string[];
      missingScopes?: string[];
      testedAt?: string | null;
    }>
  > => {
    const response = await apiClient.post("/integrations/shopify/test");
    return response.data;
  },
  updateShopifySettings: async (payload: {
    syncOptions: {
      autoImportOrders?: boolean;
      failOnUnmappedItems?: boolean;
      autoSyncStatusUpdates?: boolean;
      allowManualInventoryPush?: boolean;
    };
  }): Promise<
    ApiResponse<{
      syncOptions: ShopifyIntegrationStatus["syncOptions"];
    }>
  > => {
    const response = await apiClient.put("/integrations/shopify/settings", payload);
    return response.data;
  },
  syncShopifyOrders: async (payload?: {
    since?: string;
    limit?: number;
  }): Promise<
    ApiResponse<{
      imported: number;
      updated: number;
      skipped: number;
      failed?: number;
      failures?: Array<{
        orderId: string;
        orderNumber: string;
        error: string;
      }>;
      lastSyncedAt: string | null;
    }>
  > => {
    const response = await apiClient.post("/integrations/shopify/sync", payload || {});
    return response.data;
  },
  syncShopifyCatalog: async (): Promise<
    ApiResponse<{
      products: number;
      variants: number;
      autoMapped: number;
      unmapped: number;
      lastCatalogSyncAt: string | null;
    }>
  > => {
    const response = await apiClient.post("/integrations/shopify/catalog/sync");
    return response.data;
  },
  autoMapShopifyMappings: async (): Promise<
    ApiResponse<{
      updatedCount: number;
      mappedCount: number;
      unmappedCount: number;
    }>
  > => {
    const response = await apiClient.post("/integrations/shopify/mappings/auto-map");
    return response.data;
  },
  getShopifyMappings: async (params?: {
    search?: string;
    status?: "mapped" | "unmapped";
    page?: number;
    limit?: number;
  }): Promise<
    ApiResponse<{
      mappings: ShopifyProductMapping[];
      summary: {
        total: number;
        mapped: number;
        unmapped: number;
      };
      pagination?: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>
  > => {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.status) query.set("status", params.status);
    if (typeof params?.page === "number") query.set("page", String(params.page));
    if (typeof params?.limit === "number") query.set("limit", String(params.limit));
    const response = await apiClient.get(`/integrations/shopify/mappings${query.toString() ? `?${query.toString()}` : ""}`);
    return response.data;
  },
  updateShopifyMapping: async (
    mappingId: string,
    payload: {
      stocklySku?: string;
      stocklyVariantSku?: string;
    }
  ): Promise<ApiResponse<{ mapping: ShopifyProductMapping }>> => {
    const response = await apiClient.put(`/integrations/shopify/mappings/${mappingId}`, payload);
    return response.data;
  },
  getShopifyEvents: async (params?: {
    status?: ShopifyWebhookEvent["status"];
    page?: number;
    limit?: number;
  }): Promise<
    ApiResponse<{
      events: ShopifyWebhookEvent[];
      summary: ShopifyIntegrationStatus["eventSummary"];
      pagination?: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>
  > => {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (typeof params?.page === "number") query.set("page", String(params.page));
    if (typeof params?.limit === "number") query.set("limit", String(params.limit));
    const response = await apiClient.get(`/integrations/shopify/events${query.toString() ? `?${query.toString()}` : ""}`);
    return response.data;
  },
  retryShopifyEvent: async (
    eventId: string
  ): Promise<ApiResponse<{ event: ShopifyWebhookEvent }>> => {
    const response = await apiClient.post(`/integrations/shopify/events/${eventId}/retry`);
    return response.data;
  },
  pushShopifyInventory: async (): Promise<
    ApiResponse<{
      pushed: number;
      failed: number;
      failures: Array<{
        mappingId: string;
        sku: string;
        error: string;
      }>;
      lastInventoryPushAt: string | null;
    }>
  > => {
    const response = await apiClient.post("/integrations/shopify/inventory/push");
    return response.data;
  },
  getShippingProviders: async (): Promise<
    ApiResponse<{ providers: ShippingProviderConnectionStatus[] }>
  > => {
    const response = await apiClient.get("/integrations/shipping/providers");
    return response.data;
  },
  connectShippingProvider: async (
    provider: ShippingProviderKey,
    payload: {
      accountName?: string;
      apiBaseUrl?: string;
      authId?: string;
      ordersEndpointPath?: string;
      apiToken?: string;
      tokenHeaderName?: string;
      tokenPrefix?: string;
      customHeaders?: Record<string, string>;
      defaultPayload?: Record<string, unknown>;
      senderName?: string;
      senderPhone?: string;
      senderAddress?: string;
      senderCity?: string;
      fromWilayaName?: string;
      defaultStopdeskId?: number | null;
      defaultProductList?: string;
      defaultLength?: number;
      defaultWidth?: number;
      defaultHeight?: number;
      defaultWeight?: number;
      doInsurance?: boolean;
      freeshipping?: boolean;
      economic?: boolean;
      hasExchange?: boolean;
      notes?: string;
    }
  ): Promise<ApiResponse<{ provider: ShippingProviderConnectionStatus }>> => {
    const response = await apiClient.post(
      `/integrations/shipping/${provider}/connect`,
      payload
    );
    return response.data;
  },
  disconnectShippingProvider: async (
    provider: ShippingProviderKey
  ): Promise<ApiResponse<{ provider: ShippingProviderConnectionStatus }>> => {
    const response = await apiClient.post(
      `/integrations/shipping/${provider}/disconnect`
    );
    return response.data;
  },
  dispatchOrdersToShippingProvider: async (
    provider: ShippingProviderKey,
    payload: {
      saleIds: string[];
    }
  ): Promise<
    ApiResponse<{
      provider: ShippingProviderConnectionStatus;
      dispatched: number;
      failed: number;
      results: ShippingProviderDispatchResult[];
    }>
  > => {
    const response = await apiClient.post(
      `/integrations/shipping/${provider}/dispatch`,
      payload
    );
    return response.data;
  },
};

// Team Notes API
export const teamNotesAPI = {
  getNotes: async (): Promise<ApiResponse<{ notes: TeamNote[] }>> => {
    const response = await apiClient.get("/notes");
    return response.data;
  },
  createNote: async (
    content: string,
  ): Promise<ApiResponse<{ note: TeamNote }>> => {
    const response = await apiClient.post("/notes", { content });
    return response.data;
  },
  completeNote: async (
    noteId: string,
  ): Promise<ApiResponse<{ note: TeamNote }>> => {
    const response = await apiClient.patch(`/notes/${noteId}/complete`);
    return response.data;
  },
};

// AI Assistant API
export const assistantAPI = {
  chat: async (payload: {
    messages: AssistantChatMessage[];
    language?: "en" | "ar" | "fr";
    allowWrite?: boolean;
    concise?: boolean;
    maxOutputTokens?: number;
    context?: {
      page?: string;
      url?: string;
      title?: string;
      detailLevel?: "low" | "medium" | "high";
      concise?: boolean;
      maxOutputTokens?: number;
      snippets?: string[];
      documents?: Array<{
        title?: string;
        content?: string;
        text?: string;
        description?: string;
      }>;
      extraContext?: string[];
    };
  }): Promise<
    ApiResponse<{
      reply: string;
      usedTools: string[];
      model: string;
      writeEnabled: boolean;
    }>
  > => {
    const response = await apiClient.post("/assistant/chat", payload);
    return response.data;
  },

  getSharedChat: async (): Promise<
    ApiResponse<{ messages: AssistantChatMessage[] }>
  > => {
    const response = await apiClient.get("/assistant/shared");
    return response.data;
  },

  saveSharedChat: async (
    messages: AssistantChatMessage[],
  ): Promise<ApiResponse<{ messages: AssistantChatMessage[] }>> => {
    const response = await apiClient.put("/assistant/shared", { messages });
    return response.data;
  },

  clearSharedChat: async (): Promise<
    ApiResponse<{ messages: AssistantChatMessage[] }>
  > => {
    const response = await apiClient.delete("/assistant/shared");
    return response.data;
  },

  getUsage: async (): Promise<
    ApiResponse<{
      plan: string;
      ai: {
        enabled: boolean;
        dailyWords: number | null;
        dailyFiles: number | null;
        wordsUsed: number;
        filesUsed: number;
        wordsRemaining: number | null;
        filesRemaining: number | null;
      };
    }>
  > => {
    const response = await apiClient.get("/assistant/usage");
    return response.data;
  },

  analyze: async (
    payload: AssistantAnalyzePayload,
  ): Promise<
    ApiResponse<{
      reply: string;
      usedTools: string[];
      model: string;
      writeEnabled: boolean;
      file?: { name: string; mimeType: string; size: number };
    }>
  > => {
    const response = await apiClient.post("/assistant/analyze", payload);
    return response.data;
  },
};

// WhatsApp API
export const whatsappAPI = {
  sendOrderUpdate: async (
    saleId: string,
    template: string,
  ): Promise<ApiResponse<{ message: string; sent: boolean }>> => {
    const response = await apiClient.post("/whatsapp/send-order-update", {
      saleId,
      template,
    });
    return response.data;
  },

  getTemplates: async (): Promise<
    ApiResponse<{ templates: { id: string; name: string; content: string }[] }>
  > => {
    const response = await apiClient.get("/whatsapp/templates");
    return response.data;
  },
};

// Chargily checkout API (subscription payments)
export const chargilyAPI = {
  createCheckout: async (payload: {
    planId: string;
    billingPeriod?: "monthly" | "yearly";
    email?: string;
    phoneNumber?: string;
    firstName?: string;
    name?: string;
  }): Promise<
    ApiResponse<{ checkoutId: string; checkoutUrl: string; paymentUrl: string }>
  > => {
    const response = await apiClient.post("/chargily/checkout", payload);
    return response.data;
  },

  verifyTransaction: async (payload: {
    checkoutId: string;
    planId: string;
    billingPeriod?: "monthly" | "yearly";
  }): Promise<
    ApiResponse<{
      isSubscribed: boolean;
      subscription: User["subscription"];
      checkout: unknown;
    }>
  > => {
    const response = await apiClient.post("/chargily/verify", payload);
    return response.data;
  },
};

// Backup API
export const backupAPI = {
  getSettings: async (): Promise<
    ApiResponse<{
      enabled: boolean;
      frequency: "daily" | "weekly" | "monthly";
      lastRun: string | null;
      nextRun: string | null;
    }>
  > => {
    const response = await apiClient.get("/backup/settings");
    return response.data;
  },
  updateSettings: async (payload: {
    enabled?: boolean;
    frequency?: "daily" | "weekly" | "monthly";
  }): Promise<
    ApiResponse<{
      enabled: boolean;
      frequency: "daily" | "weekly" | "monthly";
      lastRun: string | null;
      nextRun: string | null;
    }>
  > => {
    const response = await apiClient.put("/backup/settings", payload);
    return response.data;
  },
  runNow: async (): Promise<
    ApiResponse<{ fileName: string; lastRun: string; nextRun: string }>
  > => {
    const response = await apiClient.post("/backup/run");
    return response.data;
  },
  listBackups: async (): Promise<
    ApiResponse<{ backups: { fileName: string; createdAt: string }[] }>
  > => {
    const response = await apiClient.get("/backup/list");
    return response.data;
  },
  downloadBackup: async (fileName: string): Promise<Blob> => {
    const response = await apiClient.get(
      `/backup/download/${encodeURIComponent(fileName)}`,
      {
        responseType: "blob",
      },
    );
    return response.data as Blob;
  },
  restoreBackup: async (
    fileName: string,
  ): Promise<ApiResponse<{ products: number; sales: number }>> => {
    const response = await apiClient.post("/backup/restore", { fileName });
    return response.data;
  },
  restoreBackupFromLocal: async (
    backupContent: unknown,
    fileName?: string,
  ): Promise<ApiResponse<{ products: number; sales: number }>> => {
    const response = await apiClient.post("/backup/restore-local", {
      backupContent,
      fileName,
    });
    return response.data;
  },
};

export const contactAPI = {
  sendMessage: async (payload: {
    fullName: string;
    email: string;
    message: string;
  }): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.post("/contact", payload);
    return response.data;
  },
};

// Subscription Plans API
export const subscriptionAPI = {
  getPlans: async (): Promise<
    ApiResponse<{
      plans: {
        id: string;
        name: string;
        price: number;
        interval: string;
        features: string[];
        limits: Record<string, unknown>;
      }[];
    }>
  > => {
    const response = await apiClient.get("/subscription/plans");
    return response.data;
  },

  getCurrentUsage: async (): Promise<
    ApiResponse<{
      products: { used: number; limit: number };
      teamMembers: { used: number; limit: number };
      exports: { used: number; limit: number };
    }>
  > => {
    const response = await apiClient.get("/subscription/usage");
    return response.data;
  },

  checkFeatureAccess: async (
    feature: string,
  ): Promise<ApiResponse<{ hasAccess: boolean; requiredPlan?: string }>> => {
    const response = await apiClient.get(
      `/subscription/check-feature?feature=${feature}`,
    );
    return response.data;
  },
};

export default apiClient;
