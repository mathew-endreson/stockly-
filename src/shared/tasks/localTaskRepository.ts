import { invokeTauri } from '@/shared/platform/tauri';
import type {
  CreateTaskInput,
  SyncQueueItem,
  TaskRecord,
  UpdateTaskInput,
} from './taskTypes';

export const localTaskRepository = {
  init: async (): Promise<void> => {
    await invokeTauri<void>('db_init');
  },

  getTasks: async (): Promise<TaskRecord[]> =>
    invokeTauri<TaskRecord[]>('db_get_tasks'),

  getTask: async (id: string): Promise<TaskRecord | null> =>
    invokeTauri<TaskRecord | null>('db_get_task', { id }),

  createTask: async (input: CreateTaskInput): Promise<TaskRecord> =>
    invokeTauri<TaskRecord>('db_create_task', { input }),

  updateTask: async (
    id: string,
    input: UpdateTaskInput,
  ): Promise<TaskRecord> =>
    invokeTauri<TaskRecord>('db_update_task', { id, input }),

  deleteTask: async (id: string): Promise<TaskRecord> =>
    invokeTauri<TaskRecord>('db_delete_task', { id }),

  listSyncQueue: async (): Promise<SyncQueueItem[]> =>
    invokeTauri<SyncQueueItem[]>('db_list_sync_queue'),

  markSyncActionSynced: async (
    actionId: string,
    remoteTask?: TaskRecord,
  ): Promise<void> =>
    invokeTauri<void>('db_mark_sync_action_synced', {
      actionId,
      remoteTask: remoteTask || null,
    }),

  markSyncActionFailed: async (
    actionId: string,
    error: string,
  ): Promise<void> =>
    invokeTauri<void>('db_mark_sync_action_failed', { actionId, error }),
};
