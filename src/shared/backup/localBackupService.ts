import { isDesktopRuntime } from '@/shared/platform/platform';
import { invokeTauri } from '@/shared/platform/tauri';

export interface LocalBackupResult {
  fileName: string;
  filePath: string;
  backupDir: string;
  createdAt: string;
  keptBackups: string[];
}

export interface LocalBackupSettings {
  backupDir?: string | null;
  lastBackupAt?: string | null;
  nextBackupAt?: string | null;
}

const LAST_AUTO_BACKUP_KEY = 'stockly:last-auto-backup-date';

const todayKey = () => new Date().toISOString().slice(0, 10);

const selectBackupDirectory = async (): Promise<string | null> => {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({
    directory: true,
    multiple: false,
    title: 'Choose Stockly backup folder',
  });
  return typeof selected === 'string' ? selected : null;
};

export const localBackupService = {
  getSettings: async (): Promise<LocalBackupSettings> => {
    if (!isDesktopRuntime()) return {};
    return invokeTauri<LocalBackupSettings>('db_get_backup_settings');
  },

  backupNow: async (options?: {
    chooseDirectory?: boolean;
    reason?: 'manual' | 'auto';
  }): Promise<LocalBackupResult | null> => {
    if (!isDesktopRuntime()) return null;

    const backupDir = options?.chooseDirectory ? await selectBackupDirectory() : null;
    if (options?.chooseDirectory && !backupDir) return null;

    return invokeTauri<LocalBackupResult>('db_backup_now', {
      backupDir,
      reason: options?.reason || 'manual',
    });
  },

  runDailyBackupIfDue: async (): Promise<LocalBackupResult | null> => {
    if (!isDesktopRuntime()) return null;

    const key = todayKey();
    if (localStorage.getItem(LAST_AUTO_BACKUP_KEY) === key) return null;

    const result = await localBackupService.backupNow({ reason: 'auto' });
    if (result) {
      localStorage.setItem(LAST_AUTO_BACKUP_KEY, key);
    }
    return result;
  },
};
