import apiClient from '@/services/api';
import type { CreateTaskInput, TaskRecord, UpdateTaskInput } from './taskTypes';

type RemoteTask = {
  _id: string;
  clientId?: string;
  title: string;
  description?: string;
  completed?: boolean;
  completedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type TaskResponse = {
  success: boolean;
  data: { task: RemoteTask };
};

type TasksResponse = {
  success: boolean;
  data: { tasks: RemoteTask[] };
};

const mapRemoteTask = (task: RemoteTask): TaskRecord => ({
  id: task.clientId || task._id,
  remoteId: task._id,
  title: task.title,
  description: task.description || '',
  completed: Boolean(task.completed),
  syncStatus: 'synced',
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
  deletedAt: task.deletedAt || null,
  lastSyncedAt: new Date().toISOString(),
});

export const remoteTaskRepository = {
  getTasks: async (): Promise<TaskRecord[]> => {
    const response = await apiClient.get<TasksResponse>('/tasks');
    return response.data.data.tasks.map(mapRemoteTask);
  },

  createTask: async (
    input: CreateTaskInput & {
      clientId?: string;
      updatedAt?: string;
      completed?: boolean;
    },
  ): Promise<TaskRecord> => {
    const response = await apiClient.post<TaskResponse>('/tasks', {
      title: input.title,
      description: input.description || '',
      completed: input.completed,
      clientId: input.clientId,
      clientUpdatedAt: input.updatedAt,
    });
    return mapRemoteTask(response.data.data.task);
  },

  updateTask: async (
    id: string,
    input: UpdateTaskInput & { clientId?: string; updatedAt?: string },
  ): Promise<TaskRecord> => {
    const response = await apiClient.put<TaskResponse>(`/tasks/${id}`, {
      ...input,
      clientUpdatedAt: input.updatedAt,
    });
    return mapRemoteTask(response.data.data.task);
  },

  deleteTask: async (
    id: string,
    input?: { updatedAt?: string },
  ): Promise<TaskRecord> => {
    const response = await apiClient.delete<TaskResponse>(`/tasks/${id}`, {
      data: { clientUpdatedAt: input?.updatedAt },
    });
    return mapRemoteTask(response.data.data.task);
  },
};
