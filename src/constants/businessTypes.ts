import type { TFunction } from 'i18next';
import type { BusinessType } from '@/types';

const LEGACY_WHOLESALE_BUSINESS_TYPE = 'wholesale_importer';

export const BUSINESS_TYPE_OPTIONS: Array<{
  value: BusinessType;
  label: string;
  description: string;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    value: 'standard',
    label: 'Standard',
    description:
      'Balanced default workspace with core inventory, sales, analytics, invoices, notes, assistant, and backup.',
    labelKey: 'settings.businessTypes.standard',
    descriptionKey: 'settings.businessTypes.standardDesc'
  },
  {
    value: 'ecommerce',
    label: 'E-commerce',
    description: 'Best for online-first stores, fulfillment workflows, and digital order operations.',
    labelKey: 'settings.businessTypes.ecommerce',
    descriptionKey: 'settings.businessTypes.ecommerceDesc'
  },
  {
    value: 'clothing_retail',
    label: 'Clothing / Retail',
    description: 'Built for general retail catalogs, variants, point-of-sale, and in-store inventory control.',
    labelKey: 'settings.businessTypes.clothingRetail',
    descriptionKey: 'settings.businessTypes.clothingRetailDesc'
  },
  {
    value: 'supermarket',
    label: 'Supermarket',
    description: 'Optimized for high-volume shelf stock, frequent replenishment, and fast-moving products.',
    labelKey: 'settings.businessTypes.supermarket',
    descriptionKey: 'settings.businessTypes.supermarketDesc'
  }
];

export const normalizeSelectableBusinessType = (
  businessType: BusinessType | null | undefined
): Exclude<BusinessType, 'wholesale_importer'> | null => {
  if (!businessType || businessType === LEGACY_WHOLESALE_BUSINESS_TYPE) {
    return businessType === LEGACY_WHOLESALE_BUSINESS_TYPE ? 'standard' : null;
  }

  return businessType as Exclude<BusinessType, 'wholesale_importer'>;
};

export const getBusinessTypeLabel = (
  businessType: BusinessType | null | undefined,
  t?: TFunction
): string => {
  const normalizedBusinessType = normalizeSelectableBusinessType(businessType);
  if (!normalizedBusinessType) {
    return t ? t('settings.businessTypes.notSelected', 'Not selected') : 'Not selected';
  }
  const option = BUSINESS_TYPE_OPTIONS.find((item) => item.value === normalizedBusinessType);
  if (!option) return normalizedBusinessType;
  return t ? t(option.labelKey, option.label) : option.label;
};

export const getBusinessTypeDescription = (
  businessType: BusinessType | null | undefined,
  t?: TFunction
): string => {
  const normalizedBusinessType = normalizeSelectableBusinessType(businessType);
  if (!normalizedBusinessType) return '';
  const option = BUSINESS_TYPE_OPTIONS.find((item) => item.value === normalizedBusinessType);
  if (!option) return '';
  return t ? t(option.descriptionKey, option.description) : option.description;
};
