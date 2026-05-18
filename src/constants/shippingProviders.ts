import type { ShippingProviderKey } from "@/types";

export const SHIPPING_PROVIDER_OPTIONS: ReadonlyArray<{
  value: ShippingProviderKey;
  label: string;
  description: string;
}> = [
  {
    value: "yalidine_express",
    label: "Yalidine",
    description: "Connect your Yalidine API ID, token, and sender wilaya, then create parcels from Stockly orders."
  },
  {
    value: "zr_express",
    label: "ZR Express",
    description: "Connect your ZR Express API key and token, then send orders to the Procolis API."
  },
  {
    value: "noest_express",
    label: "NOEST Express",
    description: "Connect your NOEST api_token and user_guid, then send and validate ecommerce orders directly from Stockly."
  },
  {
    value: "world_express",
    label: "World Express",
    description: "Connect your Ecotrack API token, then create and ship World Express orders directly from Stockly."
  }
];

export const getShippingProviderLabel = (
  provider?: string | null
): string => {
  const normalized = String(provider || "").trim().toLowerCase();
  if (!normalized) return "";

  return (
    SHIPPING_PROVIDER_OPTIONS.find((option) => option.value === normalized)?.label ||
    normalized.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
  );
};
