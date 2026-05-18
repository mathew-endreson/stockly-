import type { BusinessType } from '@/types';

export type BusinessCapability =
  | 'core_inventory'
  | 'core_sales'
  | 'core_analytics'
  | 'core_invoices'
  | 'core_notes'
  | 'core_assistant'
  | 'core_backup'
  | 'ecommerce_shipping_pipeline'
  | 'clothing_variants'
  | 'clothing_returns'
  | 'supermarket_batch_expiry'
  | 'supermarket_promo_bundles';

const sharedCapabilities: BusinessCapability[] = [
  'core_inventory',
  'core_sales',
  'core_analytics',
  'core_invoices',
  'core_notes',
  'core_assistant',
  'core_backup'
];

export const BUSINESS_CAPABILITY_MATRIX: Record<BusinessType, BusinessCapability[]> = {
  standard: [...sharedCapabilities, 'ecommerce_shipping_pipeline'],
  ecommerce: [...sharedCapabilities, 'ecommerce_shipping_pipeline', 'clothing_variants'],
  clothing_retail: [...sharedCapabilities, 'ecommerce_shipping_pipeline', 'clothing_variants', 'clothing_returns'],
  supermarket: [...sharedCapabilities, 'ecommerce_shipping_pipeline', 'supermarket_batch_expiry', 'supermarket_promo_bundles'],
  wholesale_importer: [...sharedCapabilities, 'ecommerce_shipping_pipeline']
};

const envEnabled = (flagName: string, defaultValue = true): boolean => {
  const value = (import.meta.env as Record<string, string | undefined>)[flagName];
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1';
};

export const FEATURE_FLAGS: Partial<Record<BusinessCapability, boolean>> = {
  ecommerce_shipping_pipeline: envEnabled('VITE_FEATURE_ECOMMERCE_SHIPPING_PIPELINE', true),
  clothing_variants: envEnabled('VITE_FEATURE_CLOTHING_VARIANTS', true),
  clothing_returns: envEnabled('VITE_FEATURE_CLOTHING_RETURNS', true),
  supermarket_batch_expiry: envEnabled('VITE_FEATURE_SUPERMARKET_BATCH_EXPIRY', true),
  supermarket_promo_bundles: envEnabled('VITE_FEATURE_SUPERMARKET_PROMO_BUNDLES', true)
};

export const BUSINESS_TOOLKIT_META: Record<
  BusinessType,
  { title: string; subtitle: string; navLabel: string }
> = {
  standard: {
    title: 'Standard Operations',
    subtitle: 'Use the core workspace modules without niche-specific toolkits.',
    navLabel: 'Standard Ops'
  },
  ecommerce: {
    title: 'E-commerce Operations',
    subtitle: 'Track shipment stages, resolve delays, and keep order fulfillment healthy.',
    navLabel: 'E-commerce Ops'
  },
  clothing_retail: {
    title: 'Clothing / Retail Studio',
    subtitle: 'Manage size/color variants and process returns or exchanges quickly.',
    navLabel: 'Retail Studio'
  },
  supermarket: {
    title: 'Supermarket Fresh Ops',
    subtitle: 'Control expiry batches and run promotional bundles for fast turnover.',
    navLabel: 'Fresh Ops'
  },
  wholesale_importer: {
    title: 'Wholesale / Importer Ops',
    subtitle: 'Manage procurement workflows and supplier-facing operations for legacy wholesale workspaces.',
    navLabel: 'Wholesale Ops'
  }
};

export const getCapabilitiesForBusinessType = (
  businessType: BusinessType | null | undefined
): BusinessCapability[] => {
  if (!businessType) return [];
  return (BUSINESS_CAPABILITY_MATRIX[businessType] || []).filter((capability) => {
    if (!Object.prototype.hasOwnProperty.call(FEATURE_FLAGS, capability)) return true;
    return FEATURE_FLAGS[capability] !== false;
  });
};

export const hasBusinessCapability = (
  businessType: BusinessType | null | undefined,
  capability: BusinessCapability
): boolean => {
  return getCapabilitiesForBusinessType(businessType).includes(capability);
};
