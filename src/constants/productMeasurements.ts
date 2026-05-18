import type { ProductMeasurementType } from '@/types';
import { i18n } from '@/context/LanguageContext';

type MeasurementOption = {
  value: ProductMeasurementType;
  label: string;
  description: string;
  quantityLabel: string;
  minQuantityLabel: string;
  unitLabel: string;
  step: number;
  minPositive: number;
};

export const PRODUCT_MEASUREMENT_OPTIONS: MeasurementOption[] = [
  {
    value: 'count',
    label: 'Count (numbers)',
    description: 'Track stock by pieces (1, 2, 3...).',
    quantityLabel: 'Quantity',
    minQuantityLabel: 'Min Qty',
    unitLabel: 'units',
    step: 1,
    minPositive: 1
  },
  {
    value: 'kg',
    label: 'Weight (kg)',
    description: 'Track stock by weight in kilograms.',
    quantityLabel: 'Quantity (kg)',
    minQuantityLabel: 'Min Qty (kg)',
    unitLabel: 'kg',
    step: 0.001,
    minPositive: 0.001
  },
  {
    value: 'meter',
    label: 'Length (meters)',
    description: 'Track stock by length in meters.',
    quantityLabel: 'Quantity (m)',
    minQuantityLabel: 'Min Qty (m)',
    unitLabel: 'm',
    step: 0.001,
    minPositive: 0.001
  }
];

const MEASUREMENT_TYPE_ALIASES: Record<string, ProductMeasurementType> = {
  count: 'count',
  number: 'count',
  numbers: 'count',
  unit: 'count',
  units: 'count',
  piece: 'count',
  pieces: 'count',
  qty: 'count',
  quantity: 'count',
  kg: 'kg',
  kgs: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  kilo: 'kg',
  meter: 'meter',
  meters: 'meter',
  metre: 'meter',
  metres: 'meter',
  m: 'meter'
};

export const normalizeProductMeasurementType = (
  value: string | null | undefined,
  fallback: ProductMeasurementType = 'count'
): ProductMeasurementType => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return MEASUREMENT_TYPE_ALIASES[normalized] || fallback;
};

export const isCountMeasurementType = (value: ProductMeasurementType | null | undefined): boolean =>
  normalizeProductMeasurementType(value || 'count') === 'count';

export const getMeasurementOption = (
  value: ProductMeasurementType | null | undefined
): MeasurementOption => {
  const normalized = normalizeProductMeasurementType(value || 'count');
  return PRODUCT_MEASUREMENT_OPTIONS.find((option) => option.value === normalized) || PRODUCT_MEASUREMENT_OPTIONS[0];
};

export const getDefaultMinQuantityForMeasurement = (
  _value: ProductMeasurementType | null | undefined
): number => {
  void _value;
  return 1;
};

export const formatQuantityForDisplay = (
  quantity: number,
  measurementType: ProductMeasurementType | null | undefined
): string => {
  if (!Number.isFinite(quantity)) return '0';
  if (isCountMeasurementType(measurementType || 'count')) {
    return String(Math.round(quantity));
  }
  return quantity.toFixed(3).replace(/\.?0+$/, '');
};

export const formatQuantityWithUnit = (
  quantity: number,
  measurementType: ProductMeasurementType | null | undefined
): string => {
  const option = getMeasurementOption(measurementType);
  const normalizedType = normalizeProductMeasurementType(measurementType || option.value);
  const language = String(i18n.language || 'en').toLowerCase();

  let localizedUnitLabel = option.unitLabel;
  if (language.startsWith('ar')) {
    if (normalizedType === 'kg') localizedUnitLabel = 'كغ';
    else if (normalizedType === 'meter') localizedUnitLabel = 'متر';
    else localizedUnitLabel = 'وحدات';
  } else if (language.startsWith('fr')) {
    if (normalizedType === 'kg') localizedUnitLabel = 'kg';
    else if (normalizedType === 'meter') localizedUnitLabel = 'm';
    else localizedUnitLabel = 'unités';
  }

  return `${formatQuantityForDisplay(quantity, measurementType)} ${localizedUnitLabel}`;
};
