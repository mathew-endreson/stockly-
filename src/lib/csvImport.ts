import { normalizeProductMeasurementType, isCountMeasurementType } from '@/constants/productMeasurements';

export type CanonicalField =
  | 'name'
  | 'sku'
  | 'barcode'
  | 'category'
  | 'measurementType'
  | 'quantity'
  | 'minQuantity'
  | 'price'
  | 'secondPrice'
  | 'soldDiscountPercent'
  | 'expirationDate'
  | 'cost';

export type HeaderMappingResult = {
  mappedHeaders: Array<CanonicalField | null>;
  headerIndexByField: Partial<Record<CanonicalField, number>>;
  unmappedHeaders: { header: string; reason: string }[];
};

export type ImportRowIssue = { row: number; reason: string };

export type NormalizedProduct = {
  name: string;
  quantity: number;
  sku?: string;
  barcode?: string;
  category?: string;
  measurementType?: 'count' | 'kg' | 'meter';
  minQuantity?: number;
  price?: number;
  secondPrice?: number;
  soldDiscountPercent?: number;
  expirationDate?: string;
  cost?: number;
};

// Example CSV inputs:
// Name,SKU,Barcode,Category,Quantity,Min Quantity,Price,Cost
// Smartphone,SKU-001,0123456789012,Electronics,120,10,299.99,180
// "Chaussure",REF-02,,Vêtements,1 200,5,79,50
// منتج,REF-03,باركود123,صنف,15,2,199,120
//
// Example response summary:
// {
//   totalRows: 3,
//   created: 2,
//   updated: 1,
//   imported: 3,
//   skipped: [{ row: 4, reason: "Missing required Name" }],
//   unmappedHeaders: [{ header: "color", reason: "low confidence match" }]
// }

const CANONICAL_FIELDS: CanonicalField[] = [
  'name',
  'sku',
  'barcode',
  'category',
  'measurementType',
  'quantity',
  'minQuantity',
  'price',
  'secondPrice',
  'soldDiscountPercent',
  'expirationDate',
  'cost',
];

const HEADER_SYNONYMS: Record<CanonicalField, string[]> = {
  name: [
    'name',
    'nom',
    'produit',
    'product',
    'item',
    'article',
    'article',
    'اسم',
    'nom du produit',
    'produit_name',
    'productname',
    'product_title',
    'nom_article',
    'اسم_المنتج',
    'item_name',
    'itemtitle',
  ],
  sku: [
    'sku',
    'ref',
    'reference',
    'référence',
    'sku_code',
    'id',
    'numero de reference',
    'numéro de référence',
    'code_produit',
    'product_id',
    'code_ref',
    'كود',
    'رقم_المنتج',
    'code_sku',
    'productref',
  ],
  barcode: [
    'codebarre',
    'barcode',
    'ean',
    'code_barre',
    'code',
    'باركود',
    'code_ean',
    'bar_code',
    'code_bar',
    'رقم_الباركود',
    'barcode_number',
    'product_barcode',
  ],
  category: [
    'categorie',
    'catégorie',
    'category',
    'cat',
    'type',
    'classe',
    'secteur',
    'تصنيف',
    'قسم',
    'category_name',
    'catégorie_produit',
    'product_type',
  ],
  measurementType: [
    'product type',
    'product_type',
    'measurement',
    'measurement_type',
    'measure',
    'uom',
    'unit',
    'unit_type',
    'stock_unit',
    'quantity_unit',
  ],
  quantity: [
    'quantité',
    'qty',
    'quantity',
    'stock',
    'qte',
    'qté',
    'عدد',
    'available',
    'stocks',
    'عدد_الوحدات',
    'quantite_disponible',
    'stock_amount',
    'product_quantity',
    'qty_available',
  ],
  minQuantity: [
    'seuil',
    'minq',
    'min quantity',
    'minimum',
    'min',
    'quantite_min',
    'الحد_الأدنى',
    'qté_min',
    'minimum_stock',
    'seuil_min',
    'min_qty',
  ],
  price: [
    'prix',
    'price',
    'unit price',
    'coût_unitaire',
    'prix_unitaire',
    'سعر',
    'price_per_unit',
    'priceusd',
    'prixht',
    'prix_ttc',
    'price_usd',
    'product_price',
    'prix_produit',
    'price_unit',
  ],
  secondPrice: [
    'second price',
    'secondprice',
    'minimum price',
    'minimum sell price',
    'min sell price',
    'floor price',
    'lowest price',
    'prix minimum',
    'prix_minimum',
    'prix plancher',
  ],
  soldDiscountPercent: [
    'sold % off',
    'sold%off',
    'sold_off_percent',
    'discount %',
    'discount%',
    'discount_percent',
    'discount rate',
    'sale discount',
    'promotion %',
  ],
  expirationDate: [
    'expiration date',
    'expiry date',
    'expires at',
    'expires_on',
    'expiration',
    'expiry',
    'exp date',
    'date expiration',
  ],
  cost: [
    'coût',
    'cost',
    'cost_price',
    'achat',
    'coste',
    'cost_usd',
    'تكلفة',
    'prix_achat',
    'coût_unitaire',
    'cost_unit',
    'product_cost',
    'prix_reel',
  ],
};

const FUZZY_THRESHOLD = 0.72;
const AMBIGUITY_GAP = 0.04;

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

const countDelimiterOutsideQuotes = (line: string, delimiter: string) => {
  let inQuotes = false;
  let count = 0;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      const nextChar = line[i + 1];
      if (inQuotes && nextChar === '"') {
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      count += 1;
    }
  }

  return count;
};

const detectCsvDelimiter = (text: string) => {
  const candidates = [',', ';', '\t', '|'];
  const sampleLines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5);

  if (sampleLines.length === 0) return ',';

  let bestDelimiter = ',';
  let bestScore = -1;

  candidates.forEach((delimiter) => {
    const score = sampleLines.reduce(
      (sum, line) => sum + countDelimiterOutsideQuotes(line, delimiter),
      0
    );
    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = delimiter;
    }
  });

  return bestScore > 0 ? bestDelimiter : ',';
};

export const mapHeadersToCanonical = (headers: string[]): HeaderMappingResult => {
  const mappedHeaders: Array<CanonicalField | null> = new Array(headers.length).fill(null);
  const headerIndexByField: Partial<Record<CanonicalField, number>> = {};
  const unmappedHeaders: { header: string; reason: string }[] = [];
  const fieldScores: Partial<Record<CanonicalField, { index: number; score: number }>> = {};

  headers.forEach((header, index) => {
    const normalizedHeader = normalizeHeaderKey(header);
    if (!normalizedHeader) {
      unmappedHeaders.push({ header, reason: 'empty header' });
      return;
    }

    let bestField: CanonicalField | null = null;
    let bestScore = 0;
    let secondScore = 0;
    let exactMatch = false;

    for (const field of CANONICAL_FIELDS) {
      const variants = [field, ...HEADER_SYNONYMS[field]];
      for (const variant of variants) {
        const normalizedVariant = normalizeHeaderKey(variant);
        if (normalizedHeader === normalizedVariant) {
          bestField = field;
          bestScore = 1;
          secondScore = 0;
          exactMatch = true;
          break;
        }
        const score = similarityScore(normalizedHeader, normalizedVariant);
        if (score > bestScore) {
          secondScore = bestScore;
          bestScore = score;
          bestField = field;
        } else if (score > secondScore) {
          secondScore = score;
        }
      }
      if (exactMatch) break;
    }

    if (!bestField || bestScore < FUZZY_THRESHOLD || (!exactMatch && bestScore - secondScore < AMBIGUITY_GAP)) {
      const reason = bestScore < FUZZY_THRESHOLD ? 'low confidence match' : 'ambiguous match';
      unmappedHeaders.push({ header, reason });
      return;
    }

    const existing = fieldScores[bestField];
    if (existing) {
      if (bestScore > existing.score + 0.02) {
        mappedHeaders[existing.index] = null;
        unmappedHeaders.push({ header: headers[existing.index], reason: `duplicate mapping for ${bestField}` });
        mappedHeaders[index] = bestField;
        headerIndexByField[bestField] = index;
        fieldScores[bestField] = { index, score: bestScore };
      } else {
        unmappedHeaders.push({ header, reason: `duplicate mapping for ${bestField}` });
      }
      return;
    }

    mappedHeaders[index] = bestField;
    headerIndexByField[bestField] = index;
    fieldScores[bestField] = { index, score: bestScore };
  });

  return { mappedHeaders, headerIndexByField, unmappedHeaders };
};

export const parseCsv = (text: string) => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = '';
  let inQuotes = false;

  const pushValue = () => {
    currentRow.push(currentValue);
    currentValue = '';
  };

  const pushRow = () => {
    if (currentRow.length === 1 && currentRow[0] === '' && rows.length === 0) {
      currentRow = [];
      return;
    }
    rows.push(currentRow);
    currentRow = [];
  };

  const sanitized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const delimiter = detectCsvDelimiter(sanitized);
  for (let i = 0; i < sanitized.length; i += 1) {
    const char = sanitized[i];
    if (char === '"') {
      const nextChar = sanitized[i + 1];
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      pushValue();
      continue;
    }

    if (!inQuotes && char === '\n') {
      pushValue();
      pushRow();
      continue;
    }

    currentValue += char;
  }

  pushValue();
  if (currentRow.length > 0) {
    pushRow();
  }

  return rows;
};

// Assumption: if a single separator is present and followed by 3 digits, treat it as a thousands separator.
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

const normalizeDateValue = (value: string | undefined | null) => {
  const normalized = normalizeTextValue(value);
  if (!normalized) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
};

export const normalizeRowToProduct = (
  values: string[],
  headerIndexByField: Partial<Record<CanonicalField, number>>
) => {
  const issues: string[] = [];

  const getValue = (field: CanonicalField) => {
    const index = headerIndexByField[field];
    if (index === undefined) return '';
    return values[index] ?? '';
  };

  const name = normalizeTextValue(getValue('name'));
  if (!name) {
    issues.push('Missing required Name');
  }

  const measurementType = normalizeProductMeasurementType(
    normalizeTextValue(getValue('measurementType')) || 'count'
  );

  const quantityValue = normalizeNonNegativeNumber(getValue('quantity'));
  const quantity = quantityValue === null ? 1 : quantityValue;

  const sku = normalizeTextValue(getValue('sku'));
  const barcode = normalizeTextValue(getValue('barcode'));
  const category = normalizeTextValue(getValue('category')) || 'Uncategorized';
  const minQuantityValue = normalizeNonNegativeNumber(getValue('minQuantity'));
  const minQuantity = minQuantityValue === null ? 0 : minQuantityValue;
  const price = normalizeNumber(getValue('price'));
  const secondPrice = normalizeNonNegativeNumber(getValue('secondPrice'));
  const soldDiscountPercent = normalizeNonNegativeNumber(getValue('soldDiscountPercent'));
  const rawExpirationDate = normalizeTextValue(getValue('expirationDate'));
  const expirationDate = normalizeDateValue(rawExpirationDate);
  const cost = normalizeNumber(getValue('cost'));

  if (isCountMeasurementType(measurementType)) {
    if (!Number.isInteger(quantity)) {
      issues.push('Quantity must be a whole number for count type');
    }
    if (!Number.isInteger(minQuantity)) {
      issues.push('Min Quantity must be a whole number for count type');
    }
  }
  if (soldDiscountPercent !== null && soldDiscountPercent > 100) {
    issues.push('Sold discount percent must be between 0 and 100');
  }
  if (secondPrice !== null && price !== null && secondPrice >= price) {
    issues.push('Second price must be lower than Price');
  }
  if (rawExpirationDate && !expirationDate) {
    issues.push('Expiration Date must be a valid date');
  }

  const product: NormalizedProduct = {
    name,
    quantity,
    measurementType,
  };

  if (sku) product.sku = sku;
  if (barcode) product.barcode = barcode;
  if (category) product.category = category;
  if (minQuantity !== null) product.minQuantity = minQuantity;
  if (price !== null) product.price = price;
  if (secondPrice !== null) product.secondPrice = secondPrice;
  if (soldDiscountPercent !== null) product.soldDiscountPercent = Math.min(100, soldDiscountPercent);
  if (expirationDate) product.expirationDate = expirationDate;
  if (cost !== null) product.cost = cost;

  return { product, issues };
};

export const isRowEmpty = (values: string[]) =>
  values.every((value) => normalizeTextValue(value) === '');

export const normalizeHeaders = (headers: string[]) =>
  headers.map((header) =>
    header
      .replace(/^\uFEFF/, '')
      .trim()
      .replace(/^"|"$/g, '')
  );
