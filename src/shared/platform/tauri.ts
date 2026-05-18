import { isDesktopRuntime } from './platform';

type TauriCore = typeof import('@tauri-apps/api/core');

let corePromise: Promise<TauriCore> | null = null;

const loadCore = async (): Promise<TauriCore> => {
  if (!isDesktopRuntime()) {
    throw new Error('Tauri APIs are only available in the desktop runtime.');
  }
  corePromise ||= import('@tauri-apps/api/core');
  return corePromise;
};

export const invokeTauri = async <T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> => {
  const { invoke } = await loadCore();
  return invoke<T>(command, args);
};
