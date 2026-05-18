import { isDesktopRuntime, isOnline } from '@/shared/platform/platform';
import { localTaskRepository } from '@/shared/tasks/localTaskRepository';
import { remoteTaskRepository } from '@/shared/tasks/remoteTaskRepository';
import type { QueuedTaskPayload, SyncQueueItem, TaskRecord } from '@/shared/tasks/taskTypes';

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Sync failed';
};

const parsePayload = (item: SyncQueueItem): QueuedTaskPayload => {
  try {
    return JSON.parse(item.payload) as QueuedTaskPayload;
  } catch {
    return {
      id: item.entityLocalId,
      updatedAt: item.updatedAt,
    };
  }
};

const resolveRemoteTarget = async (
  item: SyncQueueItem,
  payload: QueuedTaskPayload,
): Promise<TaskRecord | null> =>
  localTaskRepository.getTask(payload.id || item.entityLocalId);

const syncTaskAction = async (item: SyncQueueItem): Promise<void> => {
  const payload = parsePayload(item);
  const localTask = await resolveRemoteTarget(item, payload);
  const remoteId = payload.remoteId || localTask?.remoteId || undefined;

  if (item.operation === 'create') {
    const source = localTask || {
      id: payload.id,
      title: payload.title || '',
      description: payload.description || '',
      completed: Boolean(payload.completed),
      updatedAt: payload.updatedAt,
    };
    const remoteTask = await remoteTaskRepository.createTask({
      title: source.title,
      description: source.description,
      completed: source.completed,
      clientId: source.id,
      updatedAt: source.updatedAt,
    });
    await localTaskRepository.markSyncActionSynced(item.id, {
      ...remoteTask,
      id: source.id,
      remoteId: remoteTask.remoteId,
    });
    return;
  }

  if (item.operation === 'update') {
    if (!localTask) {
      await localTaskRepository.markSyncActionSynced(item.id);
      return;
    }

    const remoteTask = remoteId
      ? await remoteTaskRepository.updateTask(remoteId, {
          title: localTask.title,
          description: localTask.description,
          completed: localTask.completed,
          clientId: localTask.id,
          updatedAt: localTask.updatedAt,
        })
      : await remoteTaskRepository.createTask({
          title: localTask.title,
          description: localTask.description,
          completed: localTask.completed,
          clientId: localTask.id,
          updatedAt: localTask.updatedAt,
        });

    await localTaskRepository.markSyncActionSynced(item.id, {
      ...remoteTask,
      id: localTask.id,
      remoteId: remoteTask.remoteId,
    });
    return;
  }

  if (item.operation === 'delete') {
    if (remoteId) {
      await remoteTaskRepository.deleteTask(remoteId, {
        updatedAt: payload.updatedAt,
      });
    }
    await localTaskRepository.markSyncActionSynced(item.id);
  }
};

export const syncTaskQueue = async (): Promise<SyncQueueItem[]> => {
  if (!isDesktopRuntime() || !isOnline()) return [];

  const queue = await localTaskRepository.listSyncQueue();
  for (const item of queue) {
    try {
      await syncTaskAction(item);
    } catch (error) {
      await localTaskRepository.markSyncActionFailed(item.id, toErrorMessage(error));
    }
  }

  return localTaskRepository.listSyncQueue();
};
