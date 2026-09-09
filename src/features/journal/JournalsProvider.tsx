import { createContext, useContext, type ReactNode } from 'react';
import { usePersistedState } from '../../hooks/usePersistedState';
import { initialJournals, isJournals, type JournalEntry } from './model';
import { useProjects } from '../projects/ProjectsProvider';
function useJournalsStore() {
  const [stored, save, error] = usePersistedState(
    'devspace.journals.v1',
    initialJournals,
    isJournals,
  );
  const { projects } = useProjects();
  const journals = stored.map((j) => {
    const p = projects.find((p) => p.id === j.projectId);
    return p ? { ...j, project: p.name, scope: p.scope } : j;
  });
  const add = (entry: JournalEntry) =>
    save([entry, ...journals].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
  return { journals, add, error };
}
const Context = createContext<ReturnType<typeof useJournalsStore> | null>(null);
export function JournalsProvider({ children }: { children: ReactNode }) {
  const store = useJournalsStore();
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useJournals() {
  const value = useContext(Context);
  if (!value) throw Error('JournalsProvider is required');
  return value;
}
