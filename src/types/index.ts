export type BusinessType =
  | "standard"
  | "ecommerce"
  | "clothing_retail"
  | "supermarket"
  | "wholesale_importer";

export type NicheType =
  | "retail_shop"
  | "grocery"
  | "restaurant_cafe"
  | "pharmacy"
  | "clothing_store"
  | "beauty_salon"
  | "gym"
  | "school_training"
  | "startup_company"
  | "electronics_shop"
  | "electromechanical"
  | "cosmetics"
  | "electronics_toys"
  | "library"
  | "other";
export type ProductMeasurementType = "count" | "kg" | "meter";
export type PricingTier = "default" | "bronze" | "silver" | "gold";
export type SupplierTaxRegime = "tva" | "ifu" | "exempt";
export type InvoiceType =
  | "Pro-Forma"
  | "Standard"
  | "Credit Note"
  | "Recurring";
export type InvoiceStatus =
  | "Draft"
  | "Sent"
  | "Viewed"
  | "Partially Paid"
  | "Paid"
  | "Overdue"
  | "Cancelled";

export interface BusinessProfile {
  logoUrl?: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  nif: string;
  rc: string;
  nis: string;
  ai: string;
}

export interface ShopifyIntegrationStatus {
  id: string;
  shop: string;
  shopDomain: string;
  shopName?: string;
  shopId?: string;
  scopes?: string;
  grantedScopes?: string[];
  requiredScopes?: string[];
  missingScopes?: string[];
  isActive: boolean;
  active?: boolean;
  status: "pending" | "connected" | "error" | "uninstalled" | "disconnected";
  health?: "healthy" | "warning" | "disconnected";
  installedAt?: string | null;
  lastSyncedAt?: string | null;
  lastOrdersSyncAt?: string | null;
  lastCatalogSyncAt?: string | null;
  lastInventoryPushAt?: string | null;
  lastWebhookReceivedAt?: string | null;
  lastWebhookProcessedAt?: string | null;
  primaryLocationId?: string;
  primaryLocationName?: string;
  currency?: string;
  timezone?: string;
  syncOptions?: {
    autoImportOrders: boolean;
    failOnUnmappedItems: boolean;
    autoSyncStatusUpdates: boolean;
    allowManualInventoryPush: boolean;
  };
  webhookStatus?: {
    ordersCreate?: boolean;
    ordersUpdated?: boolean;
    refundsCreate?: boolean;
    appUninstalled?: boolean;
    verifiedAt?: string | null;
    lastRegistrationAt?: string | null;
  };
  lastError?: string;
  mappingSummary?: {
    total: number;
    mapped: number;
    unmapped: number;
  };
  eventSummary?: {
    pending: number;
    processing: number;
    processed: number;
    failed: number;
    skipped: number;
    duplicate: number;
  };
}

export interface ShopifyIntegrationSetupStatus {
  isAvailable: boolean;
  authMode: "authorization_code_grant";
  shopDomainHint: string;
  scopes: string;
  requiredScopes?: string[];
  apiVersion: string;
  // ❌ Removed: appConfigured, redirectUri, webhookUrl, warnings
  // These were infrastructure concerns leaking to users
}

export interface ShopifyProductMapping {
  id: string;
  shopifyProductId: string;
  shopifyVariantId: string;
  shopifyInventoryItemId?: string;
  shopifyLocationId?: string;
  shopifyProductTitle: string;
  shopifyVariantTitle?: string;
  shopifySku?: string;
  shopifyBarcode?: string;
  isMapped: boolean;
  mappingSource: "unmapped" | "sku" | "variant_sku" | "manual";
  stocklyProduct?: {
    id: string;
    name: string;
    sku?: string;
  } | null;
  stocklyVariant?: {
    id: string;
    sku?: string;
    size?: string;
    color?: string;
  } | null;
  updatedAt?: string;
  lastSeenAt?: string;
}

export interface ShopifyWebhookEvent {
  id: string;
  topic: string;
  source: "webhook" | "manual_sync" | "retry" | string;
  eventId?: string;
  webhookId?: string;
  resourceId?: string;
  orderNumber?: string;
  status: "pending" | "processing" | "processed" | "failed" | "skipped" | "duplicate";
  attempts: number;
  warnings?: string[];
  lastError?: string;
  receivedAt?: string | null;
  processedAt?: string | null;
  relatedSaleId?: string | null;
}

export type ShippingProviderKey =
  | "yalidine_express"
  | "zr_express"
  | "noest_express"
  | "world_express";

export interface ShippingProviderConnectionStatus {
  provider: ShippingProviderKey;
  label: string;
  isActive: boolean;
  accountName?: string;
  apiBaseUrl?: string;
  authId?: string;
  ordersEndpointPath?: string;
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
  lastConnectedAt?: string | null;
  lastDispatchedAt?: string | null;
}

export interface Integrations {
  shopify?: ShopifyIntegrationStatus | null;
  shippingProviders?: Partial<
    Record<ShippingProviderKey, ShippingProviderConnectionStatus | null>
  >;
}

export interface AccountBalanceTransaction {
  direction: "credit" | "debit";
  amount: number;
  balanceAfter: number;
  sourceType?: string;
  sourceId?: string;
  note?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
}

export interface AccountBalance {
  current: number;
  totalCredited: number;
  totalDebited: number;
  transactions?: AccountBalanceTransaction[];
  updatedAt?: string | null;
}

// User Types
export interface User {
  id: string;
  name: string;
  email: string;
  isPlatformAdmin?: boolean;
  profileImageUrl?: string;
  role: "admin" | "manager" | "staff" | "subuser";
  isSubscribed: boolean;
  subscription: {
    plan: "basic" | "premium" | "pro" | "enterprise";
    status: "active" | "inactive" | "cancelled" | "expired";
    startDate?: string;
    endDate?: string;
  };
  ownIsSubscribed?: boolean;
  ownSubscription?: {
    plan: "basic" | "premium" | "pro" | "enterprise";
    status: "active" | "inactive" | "cancelled" | "expired";
    startDate?: string;
    endDate?: string;
  };
  businessType: BusinessType | null;
  businessTypeSelectedAt?: string | null;
  businessTypeUpdatedAt?: string | null;
  ownBusinessType?: BusinessType | null;
  ownBusinessTypeSelectedAt?: string | null;
  ownBusinessTypeUpdatedAt?: string | null;
  selectedNiche?: NicheType | null;
  nicheOnboardingCompleted?: boolean;
  nicheResetRequestedAt?: string | null;
  nicheQuestionnaireAnswers?: Record<string, string | string[]> | null;
  businessProfile?: BusinessProfile;
  integrations?: Integrations;
  // For sub-users
  parentId?: string;
  parentName?: string;
  permissions?: {
    canView: boolean;
    canViewAnalytics: boolean;
    canViewBalance: boolean;
    canViewProductCost: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canManageUsers: boolean;
    canManageSales: boolean;
    canManageEcommerce: boolean;
    canViewExpenses: boolean;
    canManageExpenses: boolean;
    canApproveExpenses: boolean;
    canViewSensitiveExpenses: boolean;
    canManageReimbursements: boolean;
  };
  billing?: {
    address?: string;
    city?: string;
    country?: string;
    zipCode?: string;
    paymentMethod?: string;
    lastPayment?: string;
    nextPayment?: string;
  };
  balance?: number;
  accountBalance?: AccountBalance;
  settings: {
    language: "en" | "ar" | "fr";
    theme: "light" | "dark";
    currency: string;
    notifications: {
      email: boolean;
      lowStock: boolean;
      sales: boolean;
    };
  };
  subUsers: SubUserRef[];
  invitations: Invitation[];
  // For stock switching - stocks user has access to
  accessibleStocks?: AccessibleStock[];
  // Onboarding progress
  onboarding?: OnboardingProgress;
  createdAt: string;
}

export interface AccessibleStock {
  stockId: string;
  stockName: string;
  ownerName: string;
  ownerEmail: string;
  role: "viewer" | "seller" | "editor" | "manager";
  permissions: Permissions;
  isOwnedStock?: boolean;
  isBranchStock?: boolean;
  branchMode?: "shared" | "independent";
  mainStockId?: string;
  joinedAt: string;
}

export interface Permissions {
  canView: boolean;
  canViewAnalytics: boolean;
  canViewBalance: boolean;
  canViewProductCost: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageUsers: boolean;
  canManageSales: boolean;
  canManageEcommerce: boolean;
  canViewExpenses: boolean;
  canManageExpenses: boolean;
  canApproveExpenses: boolean;
  canViewSensitiveExpenses: boolean;
  canManageReimbursements: boolean;
}

export interface OnboardingProgress {
  addedFirstProduct: boolean;
  scannedFirstBarcode: boolean;
  recordedFirstSale: boolean;
  invitedFirstMember: boolean;
  completedAt?: string;
}

export interface SubUserRef {
  userId: string;
  name: string;
  email: string;
  role: "viewer" | "seller" | "editor" | "manager";
  permissions: Permissions;
  addedAt: string;
  isActive: boolean;
  lastLoginAt?: string | null;
}

export type TeamDetailsRangeKey =
  | "day"
  | "3days"
  | "7days"
  | "30days"
  | "month"
  | "custom";

export interface TeamMemberActivityItem {
  id: string;
  action: string;
  entityType:
    | "product"
    | "sale"
    | "invoice"
    | "inventory"
    | "team"
    | "system"
    | string;
  description: string;
  quantity: number;
  amount: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  synthetic?: boolean;
}

export interface WorkspaceActivityItem {
  id: string;
  action: string;
  entityType:
    | "product"
    | "sale"
    | "invoice"
    | "inventory"
    | "team"
    | "system"
    | string;
  description: string;
  quantity: number;
  amount: number;
  metadata?: Record<string, unknown> & {
    actorId?: string;
    actorName?: string;
    sourceType?: string;
    direction?: "credit" | "debit" | string;
  };
  createdAt: string;
}

export interface TeamMemberDetails {
  member: {
    userId: string;
    name: string;
    email: string;
    role: "viewer" | "seller" | "editor" | "manager";
    isActive: boolean;
    addedAt: string;
    permissions: Permissions;
  };
  range: {
    key: TeamDetailsRangeKey | string;
    startDate: string | null;
    endDate: string | null;
  };
  stats: {
    sales: {
      totalOrders: number;
      totalRevenue: number;
      totalItemsSold: number;
    };
    invoices: {
      totalInvoices: number;
      totalInvoiced: number;
      totalCollected: number;
      totalOutstanding: number;
    };
    products: {
      added: number;
      deleted: number;
    };
    totals: {
      totalRevenue: number;
      totalSoldQuantity: number;
      totalOrders: number;
      totalInvoices: number;
      totalProductsAdded: number;
      totalProductsDeleted: number;
      totalActions: number;
    };
    actionBreakdown: Record<string, number>;
  };
  activity: TeamMemberActivityItem[];
}

export interface TeamSurveillanceActionItem {
  action: string;
  count: number;
}

export interface TeamSurveillanceSessionEvent {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: "viewer" | "seller" | "editor" | "manager" | string;
  action: string;
  description: string;
  createdAt: string | null;
  metadata?: Record<string, unknown>;
}

export interface TeamSurveillanceMember {
  userId: string;
  name: string;
  email: string;
  role: "viewer" | "seller" | "editor" | "manager" | string;
  isActive: boolean;
  addedAt: string | null;
  permissions: Permissions;
  stats: {
    totalActions: number;
    loginCount: number;
    logoutCount: number;
    lastActionAt: string | null;
    lastLoginAt: string | null;
    lastLogoutAt: string | null;
    currentlyOnline: boolean;
    actionBreakdown: TeamSurveillanceActionItem[];
  };
  recentSessionEvents: TeamSurveillanceSessionEvent[];
}

export interface TeamSurveillanceData {
  range: {
    key: TeamDetailsRangeKey | string;
    startDate: string | null;
    endDate: string | null;
  };
  summary: {
    totalMembers: number;
    activeMembers: number;
    onlineNow: number;
    loginsToday: number;
    logoutsToday: number;
    totalActions: number;
    topActiveMembers: Array<{
      userId: string;
      name: string;
      totalActions: number;
      lastActionAt: string | null;
    }>;
  };
  members: TeamSurveillanceMember[];
  sessionEvents: TeamSurveillanceSessionEvent[];
}

export interface ClientTopProduct {
  name: string;
  quantity: number;
  spent: number;
}

export interface ClientDebtStatus {
  isMarked: boolean;
  hasDebt: boolean;
  manualAmount: number;
  invoiceOutstanding: number;
  totalDebt: number;
  note: string;
  markedAt: string | null;
}

export interface ClientMetrics {
  totalOrders: number;
  purchasedOrders: number;
  totalSpent: number;
  totalItemsPurchased: number;
  reversedOrders: number;
  totalInvoices: number;
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  overdueInvoices: number;
  totalReturns: number;
  totalReturnedItems: number;
  totalRefundAmount: number;
  returnRate: number;
  lastPurchaseAt: string | null;
  topProducts: ClientTopProduct[];
}

export interface ClientRecord {
  id: string;
  profileId: string | null;
  clientKey: string;
  name: string;
  email: string;
  phone: string;
  isWholesaler?: boolean;
  supplierCode?: string;
  paymentTerms?: string;
  defaultCurrency?: string;
  supplierTaxRegime?: SupplierTaxRegime;
  defaultPurchaseTaxRate?: number;
  nif?: string;
  rc?: string;
  nis?: string;
  ai?: string;
  pricingTier: PricingTier;
  notes: string;
  tags?: string[];
  addedManually: boolean;
  debt: ClientDebtStatus;
  metrics: ClientMetrics;
}

export interface ClientAnalyticsSummary {
  totalClients: number;
  debtClients: number;
  totalSpent: number;
  totalDebt: number;
  averageReturnRate: number;
  topSpenders: Array<{
    clientKey: string;
    name: string;
    totalSpent: number;
  }>;
  topDebtors: Array<{
    clientKey: string;
    name: string;
    totalDebt: number;
  }>;
}

export interface ClientsOverviewData {
  range: {
    key: TeamDetailsRangeKey | string;
    startDate: string | null;
    endDate: string | null;
  };
  summary: ClientAnalyticsSummary;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  clients: ClientRecord[];
}

export interface DistributorRecord {
  id: string;
  profileId: string;
  clientKey: string;
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
  totalPurchases: number;
  totalPurchasedAmount: number;
  totalPaid: number;
  balanceDue: number;
  lastPurchaseAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface DistributorsOverviewData {
  summary: {
    totalDistributors: number;
    totalPurchasedAmount: number;
    totalPaid: number;
    balanceDue: number;
  };
  distributors: DistributorRecord[];
}

export interface Invitation {
  _id: string;
  email: string;
  name: string;
  role: "viewer" | "seller" | "editor" | "manager";
  token: string;
  expiresAt: string;
  createdAt: string;
  invitedBy?: string;
  stockName?: string;
}

// Notification Types
export interface Notification {
  _id: string;
  user: string;
  type: "invitation" | "system" | "alert" | "sale" | "stock" | "team";
  title: string;
  message: string;
  data?: {
    invitationToken?: string;
    stockId?: string;
    stockName?: string;
    invitedBy?: string;
    saleId?: string;
    productId?: string;
    actionLink?: string;
    tipId?: string;
    role?: "viewer" | "seller" | "editor" | "manager" | string;
    extra?: {
      role?: "viewer" | "seller" | "editor" | "manager" | string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  isRead: boolean;
  createdAt: string;
}

export type AIInsightType =
  | "PROFIT_MARGIN_WARNING"
  | "CLIENT_CHURN_RISK"
  | "UPSELL_OPPORTUNITY"
  | "SLOW_MOVING_STOCK"
  | (string & {});

export type AIInsightStatus = "new" | "seen" | "archived";

export interface AIInsight {
  _id: string;
  stockId: string;
  entityId?: string | null;
  entityType?: string;
  type: AIInsightType;
  data?: Record<string, unknown>;
  recommendation: string;
  status: AIInsightStatus;
  createdAt: string;
}

export interface AIInsightFilters {
  status?: AIInsightStatus;
  entityId?: string;
  entityType?: string;
  limit?: number;
}

// Team Notes
export interface TeamNote {
  _id: string;
  user: string;
  author: string;
  authorName: string;
  content: string;
  completed?: boolean;
  completedAt?: string | null;
  completedBy?: string | null;
  completedByName?: string;
  createdAt: string;
}

// Product Types
export interface Product {
  _id: string;
  user: string;
  name: string;
  sku: string;
  measurementType?: ProductMeasurementType;
  barcode?: string;
  description?: string;
  category: string;
  quantity: number;
  minQuantity: number;
  price: number;
  prices?: Record<PricingTier, number>;
  secondPrice?: number | null;
  soldDiscountPercent?: number;
  expirationDate?: string | null;
  cost: number;
  images: ProductImage[];
  primaryImage?: string;
  salesCount: number;
  revenue: number;
  // Profit analytics
  totalProfit?: number;
  profitMargin?: number;
  lastSoldAt?: string;
  daysInStock?: number;
  supplier?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  isActive: boolean;
  isListed: boolean;
  location?: {
    warehouse?: string;
    shelf?: string;
    bin?: string;
  };
  tags?: string[];
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  createdAt: string;
  updatedAt: string;
  stockStatus?: "in_stock" | "low_stock" | "out_of_stock" | "expired";
  totalValue?: number;
}

export interface ProductImage {
  url: string;
  alt: string;
  isPrimary?: boolean;
}

// Business Type Toolkit Types
export interface BusinessHighlightCard {
  id: string;
  title: string;
  value: number;
  description: string;
  tone: "info" | "success" | "warning" | "danger";
}

export interface BusinessHighlights {
  businessType: BusinessType;
  cards: BusinessHighlightCard[];
}

export type SupplierPurchaseStatus =
  | "Draft"
  | "Ordered"
  | "Partially Received"
  | "Received"
  | "Cancelled";

export interface SupplierPurchaseItem {
  product:
    | string
    | Pick<
        Product,
        "_id" | "name" | "sku" | "price" | "prices" | "cost" | "quantity"
      >;
  name: string;
  sku: string;
  quantity: number;
  receivedQuantity: number;
  unitCost: number;
  totalCost: number;
}

export interface SupplierPurchaseCost {
  name: string;
  amount: number;
}

export interface SupplierPurchasePayment {
  amount: number;
  date: string;
  method: string;
  scope?: "balance" | "external";
  notes?: string;
}

export interface SupplierSnapshot {
  name: string;
  supplierCode: string;
  paymentTerms: string;
  defaultCurrency: string;
  taxRegime: SupplierTaxRegime;
  defaultPurchaseTaxRate: number;
  nif: string;
  rc: string;
  nis: string;
  ai: string;
}

export interface SupplierPurchase {
  _id: string;
  user: string;
  client:
    | string
    | Pick<
        ClientRecord,
        | "id"
        | "profileId"
        | "clientKey"
        | "name"
        | "email"
        | "phone"
        | "pricingTier"
        | "notes"
        | "isWholesaler"
        | "supplierCode"
        | "paymentTerms"
        | "defaultCurrency"
        | "supplierTaxRegime"
        | "defaultPurchaseTaxRate"
        | "nif"
        | "rc"
        | "nis"
        | "ai"
      >;
  purchaseNumber: string;
  status: SupplierPurchaseStatus;
  items: SupplierPurchaseItem[];
  associatedCosts: SupplierPurchaseCost[];
  supplierInvoiceNumber?: string;
  supplierInvoiceDate?: string | null;
  taxRegime: SupplierTaxRegime;
  taxRate: number;
  taxAmount: number;
  subtotal: number;
  extraCostsTotal: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  payments: SupplierPurchasePayment[];
  supplierSnapshot?: SupplierSnapshot;
  landedCostPerItem?: Record<string, number>;
  expectedDate?: string | null;
  receivedAt?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientWholesaleSummary {
  profile: Pick<
    ClientRecord,
    | "id"
    | "profileId"
    | "clientKey"
    | "name"
    | "email"
    | "phone"
    | "pricingTier"
    | "notes"
    | "isWholesaler"
    | "supplierCode"
    | "paymentTerms"
    | "defaultCurrency"
    | "supplierTaxRegime"
    | "defaultPurchaseTaxRate"
    | "nif"
    | "rc"
    | "nis"
    | "ai"
  >;
  summary: {
    totalPurchases: number;
    totalPurchasedAmount: number;
    totalPaid: number;
    balanceDue: number;
    lastPurchaseAt: string | null;
  };
  latestPurchases: SupplierPurchase[];
}

export type PurchaseOrderStatus =
  | "Draft"
  | "Sent"
  | "Confirmed"
  | "In Transit"
  | "At Customs"
  | "Received";

export interface PurchaseOrderItem {
  product:
    | string
    | Pick<
        Product,
        "_id" | "name" | "sku" | "price" | "prices" | "cost" | "quantity"
      >;
  name: string;
  sku: string;
  quantity: number;
  costPerItem: number;
}

export interface PurchaseOrderCost {
  name: string;
  amount: number;
}

export interface PurchaseOrder {
  _id: string;
  user: string;
  createdBy?: string;
  supplier: string;
  referenceNumber?: string;
  status: PurchaseOrderStatus;
  items: PurchaseOrderItem[];
  associatedCosts: PurchaseOrderCost[];
  landedCostPerItem: Record<string, number>;
  notes?: string;
  receivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClothingVariant {
  _id: string;
  user: string;
  product: string | Pick<Product, "_id" | "name" | "sku">;
  variantSku: string;
  barcode?: string;
  size?: string;
  color?: string;
  quantity: number;
  priceAdjustment: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ClothingReturnReason =
  | "wrong_size"
  | "damaged_item"
  | "wrong_item"
  | "quality_issue"
  | "other";

export type ClothingReturnStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "completed";

export interface ClothingReturnRecord {
  _id: string;
  user: string;
  sale: string;
  orderNumber: string;
  customerName: string;
  reason: ClothingReturnReason;
  status: ClothingReturnStatus;
  refundAmount: number;
  notes: string;
  items: Array<{
    product?: string;
    name: string;
    sku: string;
    quantity: number;
    condition: "new" | "opened" | "damaged" | "used";
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface SupermarketBatch {
  _id: string;
  user: string;
  product: string | Pick<Product, "_id" | "name" | "sku">;
  batchCode: string;
  quantity: number;
  expiresAt: string;
  receivedAt: string;
  costPerUnit: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupermarketPromotion {
  _id: string;
  user: string;
  name: string;
  description: string;
  // Legacy field kept for backward compatibility with older promotions.
  productIds?: Array<string | Pick<Product, "_id" | "name" | "sku" | "price">>;
  bundleItems?: Array<{
    product: string | Pick<Product, "_id" | "name" | "sku" | "price">;
    quantity: number;
  }>;
  bundlePrice: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Sale/Order Types
export interface Sale {
  _id: string;
  user: string;
  createdBy?: string;
  orderNumber: string;
  items: SaleItem[];
  customer: Customer;
  shipping: Shipping;
  orderType?: "walk_in" | "shipped";
  status:
    | "confirmed"
    | "processing"
    | "shipping"
    | "delivered"
    | "cancelled"
    | "reversed";
  paymentStatus: "pending" | "paid" | "partial" | "refunded" | "failed";
  paymentMethod:
    | "cash"
    | "credit_card"
    | "debit_card"
    | "bank_transfer"
    | "paypal"
    | "stripe"
    | "other";
  subtotal: number;
  tax: number;
  discount: number;
  shippingCost: number;
  total: number;
  // Profit tracking
  totalCost?: number;
  profit?: number;
  profitMargin?: number;
  notes?: string;
  tags?: string[];
  source?: "manual" | "shopify";
  externalSource?: string;
  externalId?: string;
  externalNumber?: string;
  externalUrl?: string;
  // WhatsApp integration
  whatsappSent?: boolean;
  whatsappSentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaleItem {
  product: string | Product;
  name: string;
  sku: string;
  variantId?: string;
  variantSku?: string;
  variantSize?: string;
  variantColor?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unitCost?: number;
  image?: string;
}

export interface Customer {
  name: string;
  clientKey?: string;
  pricingTier?: PricingTier;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
}

export type KnownShippingCarrier =
  | "yassir"
  | "yalidine_express"
  | "zr_express"
  | "dhd_livraison"
  | "noest_express"
  | "world_express"
  | "ups"
  | "dhl"
  | "anderson"
  | "nord_et_ouest"
  // Legacy carriers kept for backward compatibility with existing data.
  | "fedex"
  | "usps"
  | "local"
  | "other";

export type ShippingCarrier = KnownShippingCarrier | (string & {});

export interface Shipping {
  mode?: "domestic" | "stopdesk";
  carrier?: ShippingCarrier;
  trackingNumber?: string;
  status?:
    | "pending"
    | "processing"
    | "shipped"
    | "delivered"
    | "cancelled"
    | "returned";
  shippingDate?: string;
  deliveryDate?: string;
  shippingCost?: number;
  notes?: string;
  dispatch?: {
    provider?: ShippingProviderKey | (string & {});
    externalId?: string;
    externalReference?: string;
    status?: string;
    labelUrl?: string;
    dispatchedAt?: string | null;
    lastResponseAt?: string | null;
    lastError?: string;
  };
}

export interface ShippingProviderDispatchResult {
  saleId: string;
  orderNumber: string;
  success: boolean;
  message: string;
  trackingNumber?: string;
  externalId?: string;
  reference?: string;
  status?: string;
}

// Analytics Types
export interface Analytics {
  overview: {
    totalProducts: number;
    productsWithBarcodes: number;
    totalStockValue: number;
    totalCostValue: number;
    totalQuantity: number;
    totalSales: number;
    totalRevenue: number;
    totalProfit: number;
    grossProfitMargin: number;
  };
  trends?: {
    period: "day" | "week" | "month";
    windowDays: number;
    totalProducts: {
      percent: number;
      direction: "up" | "down";
      current: number;
      previous: number;
    };
    totalStockValue: {
      percent: number;
      direction: "up" | "down";
      current: number;
      previous: number;
    };
    totalSales: {
      percent: number;
      direction: "up" | "down";
      current: number;
      previous: number;
    };
    totalRevenue: {
      percent: number;
      direction: "up" | "down";
      current: number;
      previous: number;
    };
  };
  categoryDistribution: {
    _id: string;
    count: number;
    value: number;
  }[];
  bestsellers: {
    _id: string;
    name: string;
    salesCount: number;
    revenue: number;
    profit: number;
    price: number;
    images?: ProductImage[];
  }[];
  bestsellersByCategory?: {
    _id: string;
    name: string;
    salesCount: number;
    revenue: number;
    profit: number;
    productCount: number;
  }[];
  lowStock: {
    _id: string;
    name: string;
    quantity: number;
    minQuantity: number;
    sku: string;
    images?: ProductImage[];
  }[];
  // Profit analytics
  profitAnalytics?: {
    todayProfit: number;
    weekProfit: number;
    monthProfit: number;
    mostProfitableProduct?: {
      _id: string;
      name: string;
      profit: number;
      profitMargin: number;
    };
    productsSellingAtLoss: number;
  };
  // Action center data
  actionCenter?: {
    lowStockCount: number;
    pendingShipments: number;
    fastSellingProducts: number;
    deadStockValue: number;
    deadStockItems: number;
    reorderSuggestions: ReorderSuggestion[];
  };
  // Stock health
  stockHealth?: StockHealthScore;
}

export interface ReorderSuggestion {
  productId: string;
  name: string;
  sku: string;
  currentQuantity: number;
  minQuantity: number;
  suggestedOrder: number;
  daysUntilStockout: number;
  avgDailySales: number;
}

export interface StockHealthScore {
  score: number;
  maxScore: number;
  factors: {
    dataCompleteness: number;
    lowStockIssues: number;
    deadStockImpact: number;
    salesActivity: number;
  };
  suggestions: string[];
}

export type PredictionConfidence = "low" | "medium" | "high";

export interface StockPredictionDataQuality {
  totalUnitsSold: number;
  daysWithSales: number;
  totalDaysAnalyzed: number;
  fallbackApplied: boolean;
  fallbackReason: string | null;
}

export interface StockPrediction {
  analysisWindowDays: number;
  currentStock: number;
  averageDailyConsumption: number;
  estimatedDaysRemaining: number | null;
  estimatedRunOutDate: string | null;
  suggestedReorderQuantity: number;
  confidence: PredictionConfidence;
  recommendation: string;
  dataQuality: StockPredictionDataQuality;
}

export interface ProductStockPrediction {
  productId: string;
  productName: string;
  prediction: StockPrediction;
}

export interface SalesAnalytics {
  overview: {
    totalSales: number;
    totalRevenue: number;
    totalItems: number;
    averageOrderValue: number;
    totalProfit: number;
    profitMargin: number;
  };
  statusBreakdown: {
    _id: string;
    count: number;
    revenue: number;
  }[];
  dailySales: {
    _id: {
      year: number;
      month: number;
      day: number;
    };
    sales: number;
    revenue: number;
    profit: number;
  }[];
  geographicDistribution: {
    wilaya: string;
    orders: number;
    itemsSold: number;
    revenue: number;
  }[];
}

export interface BranchPerformanceStock {
  stockId: string;
  stockName: string;
  isMainStock: boolean;
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
}

export interface BranchPerformanceAnalytics {
  mainStockId: string;
  stocks: BranchPerformanceStock[];
  totals: {
    totalOrders: number;
    totalRevenue: number;
  };
  range?: {
    startDate: string | null;
    endDate: string | null;
  };
}

export type ExpenseCategory =
  | "utilities"
  | "taxes_fees"
  | "payroll"
  | "rent"
  | "transport"
  | "maintenance"
  | "subscriptions"
  | "inventory_related"
  | "other";

export type ExpenseUtilityType =
  | "electricity"
  | "gas"
  | "water"
  | "internet"
  | "other";

export type ExpensePaymentSource =
  | "store_funds"
  | "outside_store_funds";

export type ExpensePaymentMethod =
  | "cash"
  | "bank"
  | "ccp"
  | "card"
  | "transfer"
  | "other";

export type ExpenseStatus =
  | "draft"
  | "unpaid"
  | "partially_paid"
  | "paid"
  | "cancelled";

export type ExpenseReimbursementStatus =
  | "not_needed"
  | "pending"
  | "partially_reimbursed"
  | "reimbursed";

export type ExpenseCostNature = "fixed" | "variable";

export interface ExpenseAttachment {
  url: string;
  name?: string;
  mimeType?: string;
  size?: number;
  uploadedAt?: string;
}

export interface ExpensePaymentRecord {
  _id?: string;
  amount: number;
  paymentSource: ExpensePaymentSource;
  paymentMethod: ExpensePaymentMethod;
  paidAt?: string;
  note?: string;
  referenceNumber?: string;
  recordedBy?: string | null;
  recordedByName?: string;
}

export interface ExpenseReimbursementRecord {
  _id?: string;
  amount: number;
  paymentMethod: ExpensePaymentMethod;
  reimbursedAt?: string;
  note?: string;
  referenceNumber?: string;
  recordedBy?: string | null;
  recordedByName?: string;
}

export interface ExpenseRecurringConfig {
  isTemplate: boolean;
  enabled: boolean;
  frequency: "weekly" | "monthly" | "quarterly" | "yearly";
  interval: number;
  dayOfMonth?: number | null;
  startDate?: string | null;
  nextOccurrenceDate?: string | null;
  lastGeneratedAt?: string | null;
  pausedAt?: string | null;
}

export interface Expense {
  _id: string;
  user: string;
  expenseNumber: string;
  title: string;
  description?: string;
  category: ExpenseCategory;
  utilityType?: ExpenseUtilityType;
  costNature: ExpenseCostNature;
  amount: number;
  currency: string;
  paymentSource: ExpensePaymentSource;
  paymentMethod: ExpensePaymentMethod;
  expenseDate: string;
  dueDate?: string | null;
  paidDate?: string | null;
  status: ExpenseStatus;
  paidAmount: number;
  remainingAmount: number;
  affectsStoreBalance?: boolean;
  reimbursementStatus: ExpenseReimbursementStatus;
  reimbursedAmount: number;
  reimbursedAt?: string | null;
  reimbursementEligibleAmount?: number;
  paidByUser?: string | null;
  paidByName?: string;
  vendor?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  referenceNumber?: string;
  attachments?: ExpenseAttachment[];
  recurring?: ExpenseRecurringConfig;
  payments?: ExpensePaymentRecord[];
  reimbursements?: ExpenseReimbursementRecord[];
  notes?: string;
  isSensitive?: boolean;
  isOverdue?: boolean;
  branchContext?: {
    stockId?: string | null;
    stockName?: string;
    branchMode?: "shared" | "independent";
  };
  approval?: {
    isApproved?: boolean;
    approvedAt?: string | null;
    approvedBy?: string | null;
    approvedByName?: string;
  };
  balanceImpact?: {
    directExpenseApplied: number;
    reimbursementApplied: number;
    totalApplied: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface ExpenseFilters {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
  status?: ExpenseStatus | string;
  category?: ExpenseCategory | string;
  excludeCategory?: ExpenseCategory | string;
  paymentSource?: ExpensePaymentSource | string;
  reimbursementStatus?: ExpenseReimbursementStatus | string;
  startDate?: string;
  endDate?: string;
  dueState?: "overdue" | "due_soon" | string;
  templatesOnly?: boolean;
}

export interface ExpensePayrollWorker {
  workerKey: string;
  userId?: string | null;
  name: string;
  email?: string;
  role?: string;
  isActive: boolean;
  isTeamMember: boolean;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  pendingReimbursements: number;
  expenseCount: number;
  paidCount: number;
  unpaidCount: number;
  partiallyPaidCount: number;
  lastExpenseDate?: string | null;
  lastPaidAt?: string | null;
  latestExpenseId?: string | null;
  latestExpenseNumber?: string;
  latestExpenseTitle?: string;
  latestExpenseStatus?: string;
}

export interface ExpensePayrollSummary {
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  pendingReimbursements: number;
  expenseCount: number;
  workersCount: number;
}

export interface ExpenseAnalytics {
  overview: {
    totalAmount: number;
    totalPaid: number;
    totalRemaining: number;
    totalCount: number;
    paidCount: number;
    unpaidCount: number;
    partiallyPaidCount: number;
    overdueCount: number;
    dueSoonCount: number;
    payrollTotal: number;
    utilitiesTotal: number;
    fixedTotal: number;
    variableTotal: number;
    pendingReimbursements: number;
    grossProfit: number;
    netAfterExpenses: number;
  };
  byCategory: Array<{
    category: ExpenseCategory | string;
    count: number;
    totalAmount: number;
    paidAmount: number;
  }>;
  monthlyTrend: Array<{
    year: number;
    month: number;
    totalAmount: number;
    paidAmount: number;
  }>;
  dueSoon: Expense[];
  pendingReimbursementsList: Expense[];
  recurring: {
    activeTemplates: number;
    upcomingObligations: number;
  };
  branchComparison: Array<{
    stockId: string;
    stockName: string;
    isMainStock: boolean;
    totalAmount: number;
    paidAmount: number;
    pendingReimbursements: number;
    count: number;
  }>;
}

// Action Center Types
export interface ActionItem {
  id: string;
  type:
    | "low_stock"
    | "pending_shipment"
    | "fast_selling"
    | "dead_stock"
    | "reorder"
    | "selling_at_loss"
    | "expiring_soon";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  productId?: string;
  productName?: string;
  saleId?: string;
  value?: number;
  actionLabel: string;
  actionLink: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  products?: T[];
  sales?: T[];
  notifications?: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Auth Types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData extends LoginCredentials {
  name: string;
  plan?: string;
  trialDeviceId?: string;
}

export interface SubUserRegisterData extends LoginCredentials {
  name: string;
  invitationToken: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Theme Types
export interface ThemeState {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

// Language Types
export interface LanguageState {
  language: "en" | "ar";
  setLanguage: (lang: "en" | "ar") => void;
  isRTL: boolean;
}

// Filter Types
export interface ProductFilters {
  page?: number;
  limit?: number;
  sort?: string;
  category?: string;
  search?: string;
  stockStatus?: "in_stock" | "low_stock" | "out_of_stock" | "expired";
  minPrice?: number;
  maxPrice?: number;
}

export interface SaleFilters {
  page?: number;
  limit?: number;
  sort?: string;
  status?: string;
  paymentStatus?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

// Invitation Types
export interface InvitationData {
  email: string;
  name: string;
  role: string;
  invitedBy: string;
  stockName?: string;
}

// Subscription Plans
export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  interval: "month" | "year";
  features: string[];
  limits: {
    products: number;
    teamMembers: number;
    exports: number;
    analytics: "basic" | "advanced" | "full";
  };
}

// Barcode Scan Result
export interface ScanResult {
  barcode: string;
  product?: Product;
}

// Quick Sale Data
export interface QuickSaleData {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice?: number;
  orderType?: "walk_in" | "shipped";
  customer?: {
    name: string;
    clientKey?: string;
    pricingTier?: PricingTier;
    email?: string;
    phone?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
  };
  shipping?: Partial<Shipping>;
  shippingCost?: number;
  paymentMethod?: Sale["paymentMethod"];
}

export interface CreateSaleItemData {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice?: number;
}

export interface CreateSaleData {
  items: CreateSaleItemData[];
  orderType?: "walk_in" | "shipped";
  customer: {
    name: string;
    clientKey?: string;
    pricingTier?: PricingTier;
    email?: string;
    phone?: string;
    whatsapp?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
  };
  shipping?: Partial<Shipping>;
  paymentMethod?: Sale["paymentMethod"];
  tax?: number;
  discount?: number;
  shippingCost?: number;
  notes?: string;
}

// Invoice Types
export interface Invoice {
  _id: string;
  invoiceNumber: string;
  user: string;
  createdBy?: string;
  type: InvoiceType;
  referenceInvoiceId?: string | null;
  sourceSaleId?: string | null;
  customer: InvoiceCustomer;
  items: InvoiceItem[];
  subtotal: number;
  discount: {
    type: "fixed" | "percentage";
    value: number;
  };
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  shipping: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  currency: string;
  status: InvoiceStatus;
  payments: Payment[];
  issueDate: string;
  dueDate: string;
  notes: string;
  terms: string;
  footer: string;
  issuerSnapshot?: BusinessProfile;
  template: "modern" | "classic" | "minimal" | "professional";
  color: string;
  sentAt?: string;
  viewedAt?: string;
  paidAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceCustomer {
  name: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  taxId?: string;
}

export interface InvoiceItem {
  product?: string | Product;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  total: number;
}

export interface Payment {
  _id?: string;
  amount: number;
  method:
    | "from_balance"
    | "external_payment"
    | "cash"
    | "card"
    | "bank_transfer"
    | "check"
    | "online"
    | "other";
  date: string;
  notes: string;
  reference: string;
}

export interface InvoiceStats {
  byStatus: {
    _id: string;
    count: number;
    total: number;
    amountPaid: number;
    balanceDue: number;
  }[];
  overdueCount: number;
  monthlyRevenue: {
    _id: {
      year: number;
      month: number;
    };
    revenue: number;
  }[];
}

export interface InvoiceFilters {
  page?: number;
  limit?: number;
  status?: string;
  customer?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}
