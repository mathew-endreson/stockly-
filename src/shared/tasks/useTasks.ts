import React from 'react';
import { taskService } from './taskService';
import type { CreateTaskInput, TaskRecord, UpdateTaskInput } from './taskTypes';

export const useTasks = () => {
  const [tasks, setTasks] = React.useState<TaskRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setTasks(await taskService.getTasks());
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : 'Failed to load tasks';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const createTask = React.useCallback(async (input: CreateTaskInput) => {
    const task = await taskService.createTask(input);
    setTasks((current) => [task, ...current]);
    return task;
  }, []);

  const updateTask = React.useCallback(
    async (id: string, input: UpdateTaskInput) => {
      const task = await taskService.updateTask(id, input);
      setTasks((current) => current.map((item) => (item.id === id ? task : item)));
      return task;
    },
    [],
  );

  const deleteTask = React.useCallback(async (id: string) => {
    await taskService.deleteTask(id);
    setTasks((current) => current.filter((item) => item.id !== id));
  }, []);

  return {
    tasks,
    isLoading,
    error,
    refresh,
    createTask,
    updateTask,
    deleteTask,
    syncNow: taskService.syncNow,
  };
};
