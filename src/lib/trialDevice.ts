const TRIAL_DEVICE_STORAGE_KEY = 'stockly_trial_device_id';

const safeRandomId = () => {
  const cryptoAny = globalThis.crypto as unknown as { randomUUID?: () => string } | undefined;
  if (cryptoAny?.randomUUID) return cryptoAny.randomUUID();

  // Fallback: not cryptographically strong, but good enough as a stable client identifier.
  return `td_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
};

export const getOrCreateTrialDeviceId = (): string => {
  if (typeof window === 'undefined') return safeRandomId();

  try {
    const existing = window.localStorage.getItem(TRIAL_DEVICE_STORAGE_KEY);
    if (existing && typeof existing === 'string' && existing.length >= 8) return existing;
  } catch {
    // ignore
  }

  const created = safeRandomId();
  try {
    window.localStorage.setItem(TRIAL_DEVICE_STORAGE_KEY, created);
  } catch {
    // ignore
  }
  return created;
};

