import type { ShippingCarrier } from '@/types';

export const SHIPPING_CARRIER_OPTIONS: ReadonlyArray<{
  value: ShippingCarrier;
  label: string;
}> = [
  { value: 'yassir', label: 'Yassir' },
  { value: 'yalidine_express', label: 'Yalidine Express' },
  { value: 'zr_express', label: 'ZR Express' },
  { value: 'dhd_livraison', label: 'DHD Livraison' },
  { value: 'noest_express', label: 'NOEST Express' },
  { value: 'world_express', label: 'World Express' },
  { value: 'ups', label: 'UPS' },
  { value: 'dhl', label: 'DHL' },
  { value: 'anderson', label: 'Anderson' },
  { value: 'nord_et_ouest', label: 'Nord et Ouest' },
];

const SHIPPING_CARRIER_LABELS: Record<string, string> = {
  yassir: 'Yassir',
  yalidine_express: 'Yalidine Express',
  zr_express: 'ZR Express',
  dhd_livraison: 'DHD Livraison',
  noest_express: 'NOEST Express',
  world_express: 'World Express',
  ups: 'UPS',
  dhl: 'DHL',
  anderson: 'Anderson',
  nord_et_ouest: 'NOEST Express',
  // Legacy carriers.
  fedex: 'FedEx',
  usps: 'USPS',
  local: 'Local',
  other: 'Other',
};

export const formatShippingCarrier = (carrier?: string) => {
  if (!carrier) return '';
  const normalized = carrier.trim().toLowerCase();
  if (!normalized) return '';
  if (SHIPPING_CARRIER_LABELS[normalized]) return SHIPPING_CARRIER_LABELS[normalized];

  return normalized
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};
