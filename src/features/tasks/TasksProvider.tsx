import { createContext, useContext, type ReactNode } from 'react';
import { initialTasks, type Task } from '../../data/demo';
import { usePersistedState } from '../../hooks/usePersistedState';
const validTasks = (v: unknown): v is Task[] =>
  Array.isArray(v) &&
  v.every(
    (t) =>
      t &&
      typeof t.id === 'string' &&
      typeof t.title === 'string' &&
      typeof t.project === 'string' &&
      ['unity', 'server'].includes(t.scope) &&
      ['todo', 'doing', 'done'].includes(t.status) &&
      ['높음', '보통'].includes(t.priority) &&
      typeof t.tag === 'string',
  );
function useTasksStore() {
  const [tasks, save, error] = usePersistedState('devspace.tasks.v1', initialTasks, validTasks);
  const changeStatus = (id: string, status: Task['status']) =>
    save(tasks.map((t) => (t.id === id ? { ...t, status } : t)));
  return { tasks, changeStatus, error };
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
