export type RuntimePlatform = 'web' | 'desktop';

declare global {
  interface Window {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  }
}

export const isDesktopRuntime = (): boolean =>
  typeof window !== 'undefined' &&
  (Boolean(window.__TAURI__) || Boolean(window.__TAURI_INTERNALS__));

export const getRuntimePlatform = (): RuntimePlatform =>
  isDesktopRuntime() ? 'desktop' : 'web';

export const isOnline = (): boolean =>
  typeof navigator === 'undefined' ? true : navigator.onLine;

export const canUseDesktopFeatures = (): boolean => isDesktopRuntime();

export const shouldUseLocalData = (): boolean => {
  if (!isDesktopRuntime()) return false;
  const forcedMode =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('stockly:data-mode')
      : null;
  return forcedMode === 'local' || !isOnline();
};
