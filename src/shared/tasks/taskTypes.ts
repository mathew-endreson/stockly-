export type TaskSyncStatus = 'synced' | 'pending' | 'failed';
export type SyncOperation = 'create' | 'update' | 'delete';

export interface TaskRecord {
  id: string;
  remoteId?: string | null;
  title: string;
  description: string;
  completed: boolean;
  syncStatus: TaskSyncStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  lastSyncedAt?: string | null;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  completed?: boolean;
}

export interface SyncQueueItem {
  id: string;
  entity: 'task';
  entityLocalId: string;
  operation: SyncOperation;
  payload: string;
  status: TaskSyncStatus;
  attempts: number;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QueuedTaskPayload {
  id: string;
  remoteId?: string | null;
  title?: string;
  description?: string;
  completed?: boolean;
  updatedAt: string;
}
