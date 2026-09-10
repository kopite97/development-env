import { createContext, useContext, type ReactNode } from 'react';
import { usePersistedState } from '../../shared/hooks/usePersistedState';
import { useProjects } from '../projects/ProjectsProvider';
import { isMilestones, legacyMilestones, type Milestone } from './model';

function useMilestonesStore() {
  const { projects } = useProjects();
  const [milestones, save, error] = usePersistedState(
    'devspace.milestones.v1',
    legacyMilestones(projects),
    isMilestones,
  );
  const upsert = (item: Milestone) =>
    save(
      milestones.some((m) => m.id === item.id)
        ? milestones.map((m) => (m.id === item.id ? item : m))
        : [...milestones, item],
    );
  return { milestones, upsert, error };
}
const Context = createContext<ReturnType<typeof useMilestonesStore> | null>(null);
export function MilestonesProvider({ children }: { children: ReactNode }) {
  const store = useMilestonesStore();
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useMilestones() {
  const store = useContext(Context);
  if (!store) throw Error('MilestonesProvider is required');
  return store;
}
