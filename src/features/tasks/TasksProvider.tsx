import { createContext, useContext, type ReactNode } from 'react';
import { initialTasks } from './fixtures';
import { type Task } from './model';
import { usePersistedState } from '../../shared/hooks/usePersistedState';
import { useProjects } from '../projects/ProjectsProvider';
import { resolveTask, validTasks } from './model';
function useTasksStore() {
  const [stored, save, error] = usePersistedState('devspace.tasks.v1', initialTasks, validTasks);
  const { projects } = useProjects();
  const all = stored.map((t) => resolveTask(t, projects));
  const tasks = all.filter((t) => !t.deletedAt);
  const changeStatus = (id: string, status: Task['status']) =>
    save(all.map((t) => (t.id === id ? { ...t, status } : t)));
  const upsert = (task: Task) =>
    save(
      all.some((t) => t.id === task.id)
        ? all.map((t) => (t.id === task.id ? task : t))
        : [task, ...all],
    );
  const remove = (id: string) =>
    save(all.map((t) => (t.id === id ? { ...t, deletedAt: new Date().toISOString() } : t)));
  const restore = (id: string) =>
    save(all.map((t) => (t.id === id ? { ...t, deletedAt: null } : t)));
  return {
    tasks,
    deletedTasks: all.filter((t) => !!t.deletedAt),
    changeStatus,
    upsert,
    remove,
    restore,
    error,
  };
}
const Context = createContext<ReturnType<typeof useTasksStore> | null>(null);
export function TasksProvider({ children }: { children: ReactNode }) {
  const store = useTasksStore();
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useTasks() {
  const value = useContext(Context);
  if (!value) throw Error('TasksProvider is required');
  return value;
}
