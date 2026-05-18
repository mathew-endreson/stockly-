import { localBackupService } from '@/shared/backup/localBackupService';
import { isDesktopRuntime } from '@/shared/platform/platform';
import { syncDesktopOfflineQueue } from '@/services/api';
import { syncTaskQueue } from './taskSyncQueue';

export const startDesktopSyncLifecycle = (): (() => void) => {
  if (!isDesktopRuntime()) return () => undefined;

  const sync = () => {
    void syncTaskQueue();
    void syncDesktopOfflineQueue();
  };

  const backup = () => {
    void localBackupService.runDailyBackupIfDue();
  };

  window.addEventListener('online', sync);
  sync();
  backup();

  const syncInterval = window.setInterval(sync, 60_000);
  const backupInterval = window.setInterval(backup, 60 * 60_000);

  return () => {
    window.removeEventListener('online', sync);
    window.clearInterval(syncInterval);
    window.clearInterval(backupInterval);
  };
};
