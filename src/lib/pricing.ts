import type { BusinessType, PricingTier, Product } from '@/types';

export const PRICING_TIERS: PricingTier[] = ['default', 'bronze', 'silver', 'gold'];

export const PRICING_TIER_LABELS: Record<PricingTier, string> = {
  default: 'Default',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold'
};

export const normalizePricingTier = (value: string | null | undefined): PricingTier => {
  const normalized = String(value || '').trim().toLowerCase() as PricingTier;
  return PRICING_TIERS.includes(normalized) ? normalized : 'default';
};

export const isWholesaleBusinessType = (_businessType: BusinessType | null | undefined): boolean =>
  false;

export const getNormalizedProductPrices = (product: Partial<Product> | null | undefined): Record<PricingTier, number> => {
  const defaultPrice = Number(product?.price || 0);
  return {
    default: Number(product?.prices?.default ?? defaultPrice ?? 0),
    bronze: Number(product?.prices?.bronze ?? product?.prices?.default ?? defaultPrice ?? 0),
    silver: Number(product?.prices?.silver ?? product?.prices?.default ?? defaultPrice ?? 0),
    gold: Number(product?.prices?.gold ?? product?.prices?.default ?? defaultPrice ?? 0)
  };
};

export const getPriceForTier = (
  product: Partial<Product> | null | undefined,
  pricingTier: PricingTier | null | undefined
): number => {
  const normalizedTier = normalizePricingTier(pricingTier);
  const prices = getNormalizedProductPrices(product);
  return Number(prices[normalizedTier] ?? prices.default ?? 0);
};
