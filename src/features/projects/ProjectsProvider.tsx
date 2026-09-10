import { createContext, useContext, type ReactNode } from 'react';
import { usePersistedState } from '../../shared/hooks/usePersistedState';
import { isProjects, type Project } from './model';
import { initialProjects } from './fixtures';
function useProjectsStore() {
  const [projects, save, error] = usePersistedState(
    'devspace.projects.v1',
    initialProjects,
    isProjects,
  );
  const upsert = (project: Project) =>
    save(
      projects.some((p) => p.id === project.id)
        ? projects.map((p) => (p.id === project.id ? project : p))
        : [project, ...projects],
    );
  const archive = (id: string, archived: boolean) =>
    save(projects.map((p) => (p.id === id ? { ...p, archived } : p)));
  return { projects, activeProjects: projects.filter((p) => !p.archived), upsert, archive, error };
}
const Context = createContext<ReturnType<typeof useProjectsStore> | null>(null);
export function ProjectsProvider({ children }: { children: ReactNode }) {
  const store = useProjectsStore();
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useProjects() {
  const value = useContext(Context);
  if (!value) throw Error('ProjectsProvider is required');
  return value;
}
