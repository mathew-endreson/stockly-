import {
  isDesktopRuntime,
  isOnline,
  shouldUseLocalData,
} from '@/shared/platform/platform';
import { syncTaskQueue } from '@/shared/sync/taskSyncQueue';
import { localTaskRepository } from './localTaskRepository';
import { remoteTaskRepository } from './remoteTaskRepository';
import type {
  CreateTaskInput,
  SyncQueueItem,
  TaskRecord,
  UpdateTaskInput,
} from './taskTypes';

const syncSoon = () => {
  if (!isDesktopRuntime() || !isOnline()) return;
  void syncTaskQueue();
};

export const taskService = {
  getTasks: async (): Promise<TaskRecord[]> => {
    if (isDesktopRuntime()) {
      if (isOnline()) {
        await syncTaskQueue();
      }
      return localTaskRepository.getTasks();
    }

    return remoteTaskRepository.getTasks();
  },

  createTask: async (input: CreateTaskInput): Promise<TaskRecord> => {
    if (shouldUseLocalData() || isDesktopRuntime()) {
      const task = await localTaskRepository.createTask(input);
      syncSoon();
      return task;
    }

    return remoteTaskRepository.createTask(input);
  },

  updateTask: async (
    id: string,
    input: UpdateTaskInput,
  ): Promise<TaskRecord> => {
    if (shouldUseLocalData() || isDesktopRuntime()) {
      const task = await localTaskRepository.updateTask(id, input);
      syncSoon();
      return task;
    }

    return remoteTaskRepository.updateTask(id, input);
  },

  deleteTask: async (id: string): Promise<void> => {
    if (shouldUseLocalData() || isDesktopRuntime()) {
      await localTaskRepository.deleteTask(id);
      syncSoon();
      return;
    }

    await remoteTaskRepository.deleteTask(id);
  },

  syncNow: async (): Promise<SyncQueueItem[]> => syncTaskQueue(),

  getSyncQueue: async (): Promise<SyncQueueItem[]> => {
    if (!isDesktopRuntime()) return [];
    return localTaskRepository.listSyncQueue();
  },
};
