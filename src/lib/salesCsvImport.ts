import { normalizeHeaders, parseCsv } from '@/lib/csvImport';

export type SaleImportCanonicalField =
  | 'orderNumber'
  | 'customerName'
  | 'customerEmail'
  | 'customerPhone'
  | 'orderType'
  | 'shippingMode'
  | 'shippingStreet'
  | 'shippingWilaya'
  | 'shippingDaira'
  | 'shippingCommune'
  | 'shippingCarrier'
  | 'trackingNumber'
  | 'shippingNotes'
  | 'shippingCost'
  | 'paymentMethod'
  | 'productId'
  | 'productSku'
  | 'productBarcode'
  | 'productName'
  | 'variantId'
  | 'variantSku'
  | 'quantity'
  | 'unitPrice';

export type SaleImportHeaderMappingResult = {
  mappedHeaders: Array<SaleImportCanonicalField | null>;
  headerIndexByField: Partial<Record<SaleImportCanonicalField, number>>;
  unmappedHeaders: { header: string; reason: string }[];
};

export type SaleImportRowIssue = { row: number; reason: string };

export type NormalizedSaleImportRow = {
  rowNumber: number;
  orderNumber?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  orderType?: 'walk_in' | 'shipped';
  shippingMode?: 'domestic' | 'stopdesk';
  shippingStreet?: string;
  shippingWilaya?: string;
  shippingDaira?: string;
  shippingCommune?: string;
  shippingCarrier?: string;
  trackingNumber?: string;
  shippingNotes?: string;
  shippingCost?: number;
  paymentMethod?: 'cash' | 'credit_card' | 'debit_card' | 'bank_transfer' | 'paypal' | 'stripe' | 'other';
  productId?: string;
  productSku?: string;
  productBarcode?: string;
  productName?: string;
  variantId?: string;
  variantSku?: string;
  quantity: number;
  unitPrice?: number;
};

const CANONICAL_FIELDS: SaleImportCanonicalField[] = [
  'orderNumber',
  'customerName',
  'customerEmail',
  'customerPhone',
  'orderType',
  'shippingMode',
  'shippingStreet',
  'shippingWilaya',
  'shippingDaira',
  'shippingCommune',
  'shippingCarrier',
  'trackingNumber',
  'shippingNotes',
  'shippingCost',
  'paymentMethod',
  'productId',
  'productSku',
  'productBarcode',
  'productName',
  'variantId',
  'variantSku',
  'quantity',
  'unitPrice',
];

const HEADER_SYNONYMS: Record<SaleImportCanonicalField, string[]> = {
  orderNumber: [
    'order',
    'order_number',
    'order_no',
    'order_id',
    'order_reference',
    'reference',
    'sale_number',
    'sale_reference',
    'transaction_id',
    'commande',
    'numero_commande',
    'order_ref',
  ],
  customerName: [
    'customer',
    'customer_name',
    'customer_full_name',
    'buyer',
    'buyer_name',
    'client',
    'client_name',
    'receiver_name',
    'recipient_name',
    'consignee',
    'contact_name',
    'nom_client',
  ],
  customerEmail: [
    'email',
    'customer_email',
    'buyer_email',
    'client_email',
    'contact_email',
    'mail',
  ],
  customerPhone: [
    'phone',
    'phone_number',
    'customer_phone',
    'buyer_phone',
    'client_phone',
    'mobile',
    'telephone',
    'tel',
    'whatsapp',
    'contact_phone',
  ],
  orderType: [
    'type',
    'order_type',
    'sale_type',
    'delivery_type',
    'order_kind',
    'fulfillment_type',
    'mode_livraison',
    'type_commande',
  ],
  shippingMode: [
    'shipping_mode',
    'delivery_mode',
    'shipping_type',
    'fulfillment_mode',
    'shipment_mode',
    'mode_shipping',
    'mode_livraison',
  ],
  shippingStreet: [
    'street',
    'address',
    'street_address',
    'shipping_address',
    'shipping_street',
    'address_line',
    'line1',
    'adresse',
    'adresse_livraison',
  ],
  shippingWilaya: [
    'wilaya',
    'state',
    'province',
    'region',
    'governorate',
    'shipping_wilaya',
    'shipping_state',
  ],
  shippingDaira: ['daira', 'district', 'shipping_daira', 'shipping_district'],
  shippingCommune: ['commune', 'city', 'town', 'municipality', 'shipping_commune', 'shipping_city'],
  shippingCarrier: [
    'carrier',
    'shipping_carrier',
    'delivery_company',
    'courier',
    'transporteur',
    'shipping_company',
    'delivery_service',
  ],
  trackingNumber: [
    'tracking',
    'tracking_number',
    'tracking_no',
    'tracking_code',
    'tracking_id',
    'awb',
    'waybill',
  ],
  shippingNotes: ['shipping_notes', 'delivery_notes', 'notes', 'order_notes', 'remark', 'remarks', 'comment'],
  shippingCost: [
    'shipping',
    'shipping_fee',
    'delivery_fee',
    'shipping_cost',
    'delivery_cost',
    'shipping_price',
    'freight',
  ],
  paymentMethod: [
    'payment',
    'payment_method',
    'payment_type',
    'payment_mode',
    'method',
    'mode_paiement',
    'paiement',
  ],
  productId: ['product_id', 'item_id', 'article_id', 'id_product', 'product_uuid'],
  productSku: [
    'sku',
    'product_sku',
    'item_sku',
    'reference_sku',
    'ref',
    'reference',
    'product_ref',
    'code_produit',
    'code_article',
  ],
  productBarcode: [
    'barcode',
    'bar_code',
    'ean',
    'upc',
    'gtin',
    'codebarre',
    'code_barre',
    'product_barcode',
  ],
  productName: [
    'product',
    'product_name',
    'item',
    'item_name',
    'name',
    'article',
    'designation',
    'title',
    'nom_produit',
    'libelle',
  ],
  variantId: ['variant_id', 'size_color_id', 'variation_id', 'option_id'],
  variantSku: ['variant_sku', 'variant', 'variant_ref', 'variation_sku', 'option_sku'],
  quantity: ['qty', 'count', 'quantity_sold', 'quantity', 'qte', 'quantite', 'qnt', 'units', 'pieces'],
  unitPrice: ['price', 'unit_price', 'selling_price', 'sale_price', 'unit_amount', 'prix_vente', 'prix_unitaire'],
};

const FUZZY_THRESHOLD = 0.66;
const AMBIGUITY_GAP = 0.03;
const PROFILE_INFERENCE_THRESHOLD = 0.82;
const PROFILE_SUPPORT_THRESHOLD = 0.62;
const PROFILE_SAMPLE_LIMIT = 300;

const ARABIC_DIGITS: Record<string, string> = {
  '\u0660': '0',
  '\u0661': '1',
  '\u0662': '2',
  '\u0663': '3',
  '\u0664': '4',
  '\u0665': '5',
  '\u0666': '6',
  '\u0667': '7',
  '\u0668': '8',
  '\u0669': '9',
  '\u066B': '.',
  '\u066C': ',',
};

const mapArabicDigits = (value: string) =>
  value
    .split('')
    .map((char) => (ARABIC_DIGITS[char] ? ARABIC_DIGITS[char] : char))
    .join('');

const normalizeHeaderKey = (value: string) => {
  const stripped = value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return stripped.replace(/[^a-z0-9\u0600-\u06FF]+/g, '');
};

const normalizeTextValue = (value: string | undefined | null) => {
  if (value === null || value === undefined) return '';
  return value
    .toString()
    .trim()
    .replace(/[\s\u00A0\u2007\u202F]+/g, ' ');
};

const normalizeTokenKey = (value: string | undefined | null) =>
  normalizeTextValue(mapArabicDigits(value || ''))
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '_')
    .replace(/^_+|_+$/g, '');

const tokenizeHeader = (value: string) => {
  const normalized = normalizeTextValue(mapArabicDigits(value))
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([0-9])([a-zA-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])([0-9])/g, '$1 $2')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, ' ')
    .trim();

  if (!normalized) return [] as string[];
  return normalized.split(/\s+/).filter((token) => token.length > 1);
};

const normalizeCamelCaseField = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2');

const HEADER_FIELD_KEYWORDS: Record<SaleImportCanonicalField, string[]> = {
  orderNumber: ['order', 'commande', 'reference', 'transaction', 'sale', 'number', 'numero', 'id'],
  customerName: ['customer', 'client', 'buyer', 'receiver', 'recipient', 'name', 'nom'],
  customerEmail: ['email', 'mail'],
  customerPhone: ['phone', 'mobile', 'telephone', 'tel', 'whatsapp', 'contact'],
  orderType: ['order', 'type', 'delivery', 'shipping', 'fulfillment', 'livraison', 'commande'],
  shippingMode: ['shipping', 'delivery', 'mode', 'fulfillment', 'shipment', 'livraison'],
  shippingStreet: ['street', 'address', 'line', 'adresse'],
  shippingWilaya: ['wilaya', 'state', 'province', 'region', 'governorate'],
  shippingDaira: ['daira', 'district'],
  shippingCommune: ['commune', 'city', 'town', 'municipality'],
  shippingCarrier: ['carrier', 'courier', 'delivery', 'shipping', 'transporteur'],
  trackingNumber: ['tracking', 'awb', 'waybill', 'shipment'],
  shippingNotes: ['notes', 'remark', 'comment', 'delivery', 'shipping'],
  shippingCost: ['shipping', 'delivery', 'fee', 'cost', 'price', 'freight'],
  paymentMethod: ['payment', 'method', 'mode', 'paiement'],
  productId: ['product', 'item', 'article', 'id', 'uuid'],
  productSku: ['sku', 'reference', 'ref', 'code', 'product', 'item', 'article'],
  productBarcode: ['barcode', 'ean', 'upc', 'gtin', 'codebarre'],
  productName: ['product', 'item', 'article', 'name', 'title', 'designation', 'nom'],
  variantId: ['variant', 'variation', 'option', 'id'],
  variantSku: ['variant', 'variation', 'option', 'sku', 'ref', 'code'],
  quantity: ['qty', 'quantity', 'qte', 'quantite', 'count', 'units', 'pieces'],
  unitPrice: ['price', 'unit', 'selling', 'sale', 'amount', 'prix', 'tarif'],
};

const tokenMatches = (token: string, keyword: string) =>
  token === keyword || token.includes(keyword) || keyword.includes(token);

const levenshtein = (a: string, b: string) => {
  if (a === b) return 0;
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  const matrix = Array.from({ length: aLen + 1 }, () => new Array(bLen + 1).fill(0));
  for (let i = 0; i <= aLen; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= bLen; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= aLen; i += 1) {
    for (let j = 1; j <= bLen; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[aLen][bLen];
};

const similarityScore = (input: string, candidate: string) => {
  if (!input || !candidate) return 0;
  if (input === candidate) return 1;
  if (input.includes(candidate) || candidate.includes(input)) return 0.92;

  const maxLen = Math.max(input.length, candidate.length);
  const distance = levenshtein(input, candidate);
  return 1 - distance / maxLen;
};

const normalizeNumber = (value: string | undefined | null) => {
  if (value === null || value === undefined) return null;
  const trimmed = normalizeTextValue(value);
  if (!trimmed) return null;

  const raw = mapArabicDigits(trimmed)
    .replace(/[\s\u00A0\u2007\u202F]/g, '')
    .replace(/[^0-9,.-]/g, '');

  if (!raw || raw === '-' || raw === '.' || raw === ',') return null;

  const hasDot = raw.includes('.');
  const hasComma = raw.includes(',');
  let normalized = raw;

  if (hasDot && hasComma) {
    const lastDot = raw.lastIndexOf('.');
    const lastComma = raw.lastIndexOf(',');
    const decimalSeparator = lastDot > lastComma ? '.' : ',';
    const parts = raw.split(decimalSeparator);
    const fractional = parts.pop() || '';
    const integer = parts.join(decimalSeparator).replace(/[.,]/g, '');
    normalized = `${integer}.${fractional}`;
  } else if (hasDot || hasComma) {
    const separator = hasDot ? '.' : ',';
    const parts = raw.split(separator);
    if (parts.length === 2) {
      const [left, right] = parts;
      if (right.length === 3 && left.length <= 3) {
        normalized = `${left}${right}`;
      } else {
        normalized = `${left}.${right}`;
      }
    } else {
      normalized = raw.replace(/[.,]/g, '');
    }
  } else {
    normalized = raw;
  }

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
};

const normalizeNonNegativeNumber = (value: string | undefined | null) => {
  const numeric = normalizeNumber(value);
  if (numeric === null) return null;
  return Math.max(0, numeric);
};

const normalizeOrderType = (
  value: string | undefined | null
): 'walk_in' | 'shipped' | undefined => {
  const normalized = normalizeTokenKey(value);
  if (!normalized) return undefined;
  if (
    ['walk_in', 'walkin', 'in_store', 'instore', 'pickup', 'magasin', 'sur_place'].includes(
      normalized
    )
  ) {
    return 'walk_in';
  }
  if (
    ['shipped', 'shipping', 'delivery', 'delivered', 'shipment', 'expedition', 'livraison'].includes(
      normalized
    )
  ) {
    return 'shipped';
  }
  return undefined;
};

const normalizePaymentMethod = (
  value: string | undefined | null
):
  | 'cash'
  | 'credit_card'
  | 'debit_card'
  | 'bank_transfer'
  | 'paypal'
  | 'stripe'
  | 'other'
  | undefined => {
  const normalized = normalizeTokenKey(value);
  if (!normalized) return undefined;
  if (['cash', 'cash_payment', 'cod', 'especes'].includes(normalized)) return 'cash';
  if (
    ['credit_card', 'credit', 'visa', 'mastercard', 'carte_credit', 'carte_bancaire'].includes(
      normalized
    )
  )
    return 'credit_card';
  if (['debit_card', 'debit', 'carte_debit'].includes(normalized)) return 'debit_card';
  if (['bank_transfer', 'bank', 'wire', 'virement', 'transfer'].includes(normalized))
    return 'bank_transfer';
  if (['paypal'].includes(normalized)) return 'paypal';
  if (['stripe'].includes(normalized)) return 'stripe';
  return 'other';
};

const normalizeShippingMode = (
  value: string | undefined | null
): 'domestic' | 'stopdesk' | undefined => {
  const normalized = normalizeTokenKey(value);
  if (!normalized) return undefined;
  if (
    ['stopdesk', 'stop_desk', 'desk_pickup', 'pickup_desk', 'point_relais', 'pickup_point'].includes(
      normalized
    )
  ) {
    return 'stopdesk';
  }
  if (
    ['domestic', 'home', 'door', 'door_delivery', 'home_delivery', 'livraison_domicile'].includes(
      normalized
    )
  ) {
    return 'domestic';
  }
  return undefined;
};

const isLikelyObjectId = (value: string) => /^[a-f0-9]{24}$/i.test(value);
const isLikelyBarcode = (value: string) => /^\d{8,18}$/.test(value);
const isLikelyEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isLikelyPhone = (value: string) => /^\+?[0-9()\-\s]{7,20}$/.test(value);
const isLikelySku = (value: string) => {
  const trimmed = value.trim();
  if (!/^[a-z0-9._\-/]{2,40}$/i.test(trimmed)) return false;
  const hasLetter = /[a-z]/i.test(trimmed);
  const hasDigit = /[0-9]/.test(trimmed);
  const hasSeparator = /[-_.\/]/.test(trimmed);
  const isUpperToken = /^[A-Z0-9._\-/]+$/.test(trimmed);
  if (!hasLetter) return false;
  return hasDigit || hasSeparator || isUpperToken;
};

type ColumnProfile = {
  nonEmpty: number;
  numeric: number;
  integer: number;
  email: number;
  phone: number;
  objectId: number;
  barcode: number;
  orderType: number;
  paymentMethod: number;
  shippingMode: number;
  skuLike: number;
  textual: number;
  multiWordText: number;
};

const buildColumnProfile = (rows: string[][], index: number): ColumnProfile => {
  const profile: ColumnProfile = {
    nonEmpty: 0,
    numeric: 0,
    integer: 0,
    email: 0,
    phone: 0,
    objectId: 0,
    barcode: 0,
    orderType: 0,
    paymentMethod: 0,
    shippingMode: 0,
    skuLike: 0,
    textual: 0,
    multiWordText: 0,
  };

  rows.forEach((row) => {
    const raw = row[index] ?? '';
    const normalizedText = normalizeTextValue(raw);
    if (!normalizedText) return;
    profile.nonEmpty += 1;

    const normalizedToken = normalizeTokenKey(normalizedText);
    const normalizedNumber = normalizeNumber(normalizedText);
    if (normalizedNumber !== null) {
      profile.numeric += 1;
      if (Number.isInteger(normalizedNumber)) {
        profile.integer += 1;
      }
    }
    if (isLikelyEmail(normalizedText)) profile.email += 1;
    if (isLikelyPhone(normalizedText)) profile.phone += 1;
    if (isLikelyObjectId(normalizedText)) profile.objectId += 1;
    if (isLikelyBarcode(normalizedText)) profile.barcode += 1;
    if (normalizeOrderType(normalizedToken)) profile.orderType += 1;
    const parsedPaymentMethod = normalizePaymentMethod(normalizedToken);
    if (parsedPaymentMethod && parsedPaymentMethod !== 'other') {
      profile.paymentMethod += 1;
    }
    if (normalizeShippingMode(normalizedToken)) profile.shippingMode += 1;
    if (isLikelySku(normalizedText)) profile.skuLike += 1;
    if (/[a-z\u0600-\u06FF]/i.test(normalizedText)) {
      profile.textual += 1;
      if (/\s/.test(normalizedText.trim())) {
        profile.multiWordText += 1;
      }
    }
  });

  return profile;
};

const profileRatio = (value: number, total: number) => (total > 0 ? value / total : 0);

const getProfileScore = (field: SaleImportCanonicalField, profile: ColumnProfile) => {
  const total = profile.nonEmpty;
  if (total === 0) return 0;

  const numericRatio = profileRatio(profile.numeric, total);
  const integerRatio = profileRatio(profile.integer, total);
  const emailRatio = profileRatio(profile.email, total);
  const phoneRatio = profileRatio(profile.phone, total);
  const objectIdRatio = profileRatio(profile.objectId, total);
  const barcodeRatio = profileRatio(profile.barcode, total);
  const orderTypeRatio = profileRatio(profile.orderType, total);
  const paymentMethodRatio = profileRatio(profile.paymentMethod, total);
  const shippingModeRatio = profileRatio(profile.shippingMode, total);
  const skuRatio = profileRatio(profile.skuLike, total);
  const textualRatio = profileRatio(profile.textual, total);
  const multiWordRatio = profileRatio(profile.multiWordText, total);

  switch (field) {
    case 'customerEmail':
      return emailRatio;
    case 'customerPhone':
      return phoneRatio;
    case 'orderType':
      return orderTypeRatio;
    case 'paymentMethod':
      return paymentMethodRatio;
    case 'shippingMode':
      return shippingModeRatio;
    case 'productId':
      return objectIdRatio;
    case 'productBarcode':
      return barcodeRatio;
    case 'quantity':
      if (numericRatio < 0.65) return 0;
      return Math.min(1, integerRatio * 0.75 + numericRatio * 0.25);
    case 'unitPrice':
    case 'shippingCost':
      if (numericRatio < 0.65) return 0;
      return Math.min(1, numericRatio * 0.85 + (1 - integerRatio) * 0.15);
    case 'productSku':
      return Math.min(1, skuRatio * 0.8 + (1 - multiWordRatio) * 0.2);
    case 'productName':
      return Math.min(1, textualRatio * 0.7 + multiWordRatio * 0.3);
    case 'customerName':
      return Math.min(1, textualRatio * 0.8 + multiWordRatio * 0.2);
    default:
      return 0;
  }
};

const getKeywordScore = (field: SaleImportCanonicalField, headerTokens: string[]) => {
  if (!headerTokens.length) return 0;
  const hasKeyword = (...keywords: string[]) =>
    keywords.some((keyword) => headerTokens.some((token) => tokenMatches(token, keyword)));

  if (field === 'customerPhone' && hasKeyword('phone', 'mobile', 'tel', 'telephone', 'whatsapp')) {
    return 0.96;
  }
  if (field === 'customerEmail' && hasKeyword('email', 'mail')) {
    return 0.96;
  }
  if (
    field === 'shippingCost' &&
    hasKeyword('shipping', 'delivery', 'freight', 'livraison') &&
    hasKeyword('cost', 'fee', 'price', 'amount', 'charge', 'frais')
  ) {
    return 0.96;
  }
  if (field === 'quantity' && hasKeyword('qty', 'quantity', 'qte', 'quantite', 'count', 'units', 'pieces')) {
    return 0.96;
  }
  if (field === 'productSku' && hasKeyword('sku', 'ref', 'reference')) {
    return 0.95;
  }
  if (field === 'productBarcode' && hasKeyword('barcode', 'ean', 'upc', 'gtin', 'codebarre')) {
    return 0.95;
  }

  const keywords = HEADER_FIELD_KEYWORDS[field] || [];
  if (!keywords.length) return 0;

  const matches = keywords.reduce((count, keyword) => {
    return count + (headerTokens.some((token) => tokenMatches(token, keyword)) ? 1 : 0);
  }, 0);

  if (matches === 0) return 0;
  return Math.min(0.96, 0.55 + matches * 0.14);
};

const tokenOverlapScore = (headerTokens: string[], variantTokens: string[]) => {
  if (!headerTokens.length || !variantTokens.length) return 0;

  const overlap = variantTokens.reduce((count, token) => {
    return count + (headerTokens.some((headerToken) => tokenMatches(headerToken, token)) ? 1 : 0);
  }, 0);

  if (overlap === 0) return 0;
  const variantCoverage = overlap / variantTokens.length;
  const headerCoverage = overlap / headerTokens.length;

  if (variantCoverage === 1) {
    return Math.min(0.98, 0.9 + Math.min(0.08, (variantTokens.length - 1) * 0.02));
  }

  return variantCoverage * 0.75 + headerCoverage * 0.25;
};

export const mapSaleHeadersToCanonical = (
  headers: string[],
  dataRows: string[][] = []
): SaleImportHeaderMappingResult => {
  const mappedHeaders: Array<SaleImportCanonicalField | null> = new Array(headers.length).fill(null);
  const headerIndexByField: Partial<Record<SaleImportCanonicalField, number>> = {};
  const fieldScores: Partial<Record<SaleImportCanonicalField, { index: number; score: number }>> = {};
  const unmappedReasonsByIndex = new Map<number, string>();
  const sampledRows = dataRows.slice(0, PROFILE_SAMPLE_LIMIT);
  const columnProfiles = headers.map((_, index) => buildColumnProfile(sampledRows, index));
  const headerTokensByIndex = headers.map((header) => tokenizeHeader(header));
  const fieldScoreByHeaderIndex: Array<Partial<Record<SaleImportCanonicalField, number>>> = headers.map(
    () => ({})
  );

  const setFieldMapping = (index: number, field: SaleImportCanonicalField, score: number) => {
    const existing = fieldScores[field];
    if (existing) {
      if (score > existing.score + 0.02) {
        mappedHeaders[existing.index] = null;
        unmappedReasonsByIndex.set(existing.index, `duplicate mapping for ${field}`);
      } else {
        unmappedReasonsByIndex.set(index, `duplicate mapping for ${field}`);
        return false;
      }
    }

    mappedHeaders[index] = field;
    headerIndexByField[field] = index;
    fieldScores[field] = { index, score };
    unmappedReasonsByIndex.delete(index);
    return true;
  };

  headers.forEach((header, index) => {
    const normalizedHeader = normalizeHeaderKey(header);
    if (!normalizedHeader) {
      unmappedReasonsByIndex.set(index, 'empty header');
      return;
    }

    const headerTokens = headerTokensByIndex[index];
    const profile = columnProfiles[index];
    let bestField: SaleImportCanonicalField | null = null;
    let bestScore = 0;
    let secondScore = 0;
    let exactMatch = false;

    for (const field of CANONICAL_FIELDS) {
      const variants = [field, normalizeCamelCaseField(field), ...HEADER_SYNONYMS[field]];
      let lexicalScore = 0;

      for (const variant of variants) {
        const normalizedVariant = normalizeHeaderKey(variant);
        if (normalizedHeader === normalizedVariant) {
          lexicalScore = 1;
          exactMatch = true;
          break;
        }

        const variantTokens = tokenizeHeader(variant);
        const score = Math.max(
          similarityScore(normalizedHeader, normalizedVariant),
          tokenOverlapScore(headerTokens, variantTokens)
        );
        lexicalScore = Math.max(lexicalScore, score);
      }

      const keywordScore = getKeywordScore(field, headerTokens);
      const profileScore = getProfileScore(field, profile);

      let fieldScore = Math.max(lexicalScore, keywordScore);
      if (profileScore >= PROFILE_INFERENCE_THRESHOLD) {
        fieldScore = Math.max(fieldScore, profileScore);
      } else if (profileScore >= PROFILE_SUPPORT_THRESHOLD && fieldScore >= 0.45) {
        fieldScore = Math.max(fieldScore, Math.min(0.9, fieldScore * 0.7 + profileScore * 0.3));
      }
      if (profileScore < PROFILE_SUPPORT_THRESHOLD && keywordScore < 0.55 && lexicalScore < 0.72) {
        fieldScore = Math.min(fieldScore, 0.65);
      }
      if (field === 'orderNumber' && keywordScore < 0.55 && lexicalScore < 0.82) {
        fieldScore = Math.min(fieldScore, 0.6);
      }

      const hasShippingContext = headerTokens.some((token) =>
        ['shipping', 'delivery', 'freight', 'livraison'].some((keyword) => tokenMatches(token, keyword))
      );
      const hasAmountContext = headerTokens.some((token) =>
        ['cost', 'fee', 'price', 'amount', 'charge', 'frais'].some((keyword) =>
          tokenMatches(token, keyword)
        )
      );
      const looksLikeShippingCostHeader = hasShippingContext && hasAmountContext;
      if (looksLikeShippingCostHeader && field === 'quantity') {
        fieldScore = Math.min(fieldScore, 0.79);
      }
      if (looksLikeShippingCostHeader && field === 'shippingCost') {
        fieldScore = Math.max(fieldScore, 0.97);
      }
      if (looksLikeShippingCostHeader && field === 'unitPrice') {
        fieldScore = Math.min(fieldScore, 0.9);
      }

      fieldScoreByHeaderIndex[index][field] = fieldScore;

      if (fieldScore > bestScore) {
        secondScore = bestScore;
        bestScore = fieldScore;
        bestField = field;
      } else if (fieldScore > secondScore) {
        secondScore = fieldScore;
      }

      if (exactMatch) break;
    }

    if (
      !bestField ||
      bestScore < FUZZY_THRESHOLD ||
      (!exactMatch && bestScore < 0.95 && bestScore - secondScore < AMBIGUITY_GAP)
    ) {
      const reason = bestScore < FUZZY_THRESHOLD ? 'low confidence match' : 'ambiguous match';
      unmappedReasonsByIndex.set(index, reason);
      return;
    }

    setFieldMapping(index, bestField, bestScore);
  });

  const getUnmappedIndexes = () =>
    mappedHeaders.reduce((acc, field, index) => {
      if (field === null) acc.push(index);
      return acc;
    }, [] as number[]);

  const inferFieldIfMissing = (
    field: SaleImportCanonicalField,
    threshold: number,
    mode: 'combined' | 'profile' = 'combined'
  ) => {
    if (typeof headerIndexByField[field] !== 'undefined') return;

    let bestIndex = -1;
    let bestScore = 0;
    for (const index of getUnmappedIndexes()) {
      const combinedScore = fieldScoreByHeaderIndex[index][field] || 0;
      const profileScore = getProfileScore(field, columnProfiles[index]);
      const score = mode === 'profile' ? profileScore : Math.max(combinedScore, profileScore);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    if (bestIndex < 0 || bestScore < threshold) return;
    setFieldMapping(bestIndex, field, bestScore);
  };

  inferFieldIfMissing('quantity', 0.78, 'combined');

  const hasProductIdentifier =
    typeof headerIndexByField.productId !== 'undefined' ||
    typeof headerIndexByField.productSku !== 'undefined' ||
    typeof headerIndexByField.productBarcode !== 'undefined' ||
    typeof headerIndexByField.productName !== 'undefined';

  if (!hasProductIdentifier) {
    inferFieldIfMissing('productId', 0.84, 'profile');
    inferFieldIfMissing('productBarcode', 0.82, 'profile');
    inferFieldIfMissing('productSku', 0.74, 'profile');
    inferFieldIfMissing('productName', 0.7, 'combined');
  }

  const unmappedHeaders = headers
    .map((header, index) => {
      if (mappedHeaders[index] !== null) return null;
      return { header, reason: unmappedReasonsByIndex.get(index) || 'unmapped column' };
    })
    .filter((entry): entry is { header: string; reason: string } => entry !== null);

  return { mappedHeaders, headerIndexByField, unmappedHeaders };
};

export const parseSaleImportCsv = (text: string) => {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { headers: [] as string[], dataRows: [] as string[][] };
  }

  return {
    headers: normalizeHeaders(rows[0]),
    dataRows: rows.slice(1),
  };
};

export const isSaleImportRowEmpty = (values: string[]) =>
  values.every((value) => normalizeTextValue(value) === '');

export const normalizeSaleImportRow = (
  values: string[],
  headerIndexByField: Partial<Record<SaleImportCanonicalField, number>>,
  rowNumber: number
): { row: NormalizedSaleImportRow; issues: string[] } => {
  const issues: string[] = [];

  const getValue = (field: SaleImportCanonicalField) => {
    const index = headerIndexByField[field];
    if (index === undefined) return '';
    return values[index] ?? '';
  };

  const quantityValue = normalizeNonNegativeNumber(getValue('quantity'));
  if (quantityValue === null || quantityValue <= 0) {
    issues.push('Missing or invalid quantity');
  }

  const productId = normalizeTextValue(getValue('productId'));
  const productSku = normalizeTextValue(getValue('productSku'));
  const productBarcode = normalizeTextValue(getValue('productBarcode'));
  const productName = normalizeTextValue(getValue('productName'));
  if (!productId && !productSku && !productBarcode && !productName) {
    issues.push('Missing product identifier (product id, sku, barcode, or product name)');
  }

  const unitPriceValue = normalizeNonNegativeNumber(getValue('unitPrice'));
  const shippingCostValue = normalizeNonNegativeNumber(getValue('shippingCost'));

  const row: NormalizedSaleImportRow = {
    rowNumber,
    orderNumber: normalizeTextValue(getValue('orderNumber')) || undefined,
    customerName: normalizeTextValue(getValue('customerName')) || undefined,
    customerEmail: normalizeTextValue(getValue('customerEmail')) || undefined,
    customerPhone: normalizeTextValue(getValue('customerPhone')) || undefined,
    orderType: normalizeOrderType(getValue('orderType')),
    shippingMode: normalizeShippingMode(getValue('shippingMode')),
    shippingStreet: normalizeTextValue(getValue('shippingStreet')) || undefined,
    shippingWilaya: normalizeTextValue(getValue('shippingWilaya')) || undefined,
    shippingDaira: normalizeTextValue(getValue('shippingDaira')) || undefined,
    shippingCommune: normalizeTextValue(getValue('shippingCommune')) || undefined,
    shippingCarrier: normalizeTextValue(getValue('shippingCarrier')) || undefined,
    trackingNumber: normalizeTextValue(getValue('trackingNumber')) || undefined,
    shippingNotes: normalizeTextValue(getValue('shippingNotes')) || undefined,
    shippingCost: shippingCostValue === null ? undefined : shippingCostValue,
    paymentMethod: normalizePaymentMethod(getValue('paymentMethod')),
    productId: productId || undefined,
    productSku: productSku || undefined,
    productBarcode: productBarcode || undefined,
    productName: productName || undefined,
    variantId: normalizeTextValue(getValue('variantId')) || undefined,
    variantSku: normalizeTextValue(getValue('variantSku')) || undefined,
    quantity: quantityValue || 0,
    unitPrice: unitPriceValue === null ? undefined : unitPriceValue,
  };

  return { row, issues };
};
