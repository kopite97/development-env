import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Scope } from '../data/demo';
import { useDashboard } from '../features/dashboard/DashboardProvider';
import { confirmNavigation } from '../hooks/navigationGuard';
import type { DetailHandler } from '../types/ui';
import type { PageId } from './navigation';
import { pagePaths, projectPath } from './routes';
import { useBrowserNavigation } from './useBrowserNavigation';
function useWorkspaceState() {
  const [toast, setToast] = useState('');
  const [detail, setDetail] = useState<{ title: string; body: string } | null>(null);
  const { editing } = useDashboard();
  const { location, entryKey, update } = useBrowserNavigation(() => {
    if (editing) {
      setToast('배치 편집을 저장하거나 취소한 뒤 이동해 주세요.');
      return false;
    }
    return confirmNavigation();
  });
  useEffect(() => {
    setDetail(null);
    setToast('');
  }, [entryKey]);
  const navigate = (page: PageId) =>
    update(
      (current) => ({
        ...current,
        pathname: pagePaths[page],
        page,
        projectId: null,
        notFound: false,
        query: '',
      }),
      true,
    );
  const onDetail: DetailHandler = (title, body) => setDetail({ title, body });
  return {
    ...location,
    entryKey,
    setShowArchivedProjects: (showArchivedProjects: boolean) =>
      update((current) => ({ ...current, showArchivedProjects })),
    openProject: (id: string) =>
      update(
        (current) => ({
          ...current,
          pathname: projectPath(id),
          page: '프로젝트',
          projectId: id,
          notFound: false,
          query: current.page === '프로젝트' ? current.query : '',
          showArchivedProjects: current.page === '프로젝트' && current.showArchivedProjects,
        }),
        true,
      ),
    closeProject: () =>
      update(
        (current) => ({
          ...current,
          pathname: pagePaths['프로젝트'],
          projectId: null,
          notFound: false,
        }),
        true,
      ),
    setFilter: (filter: Scope) => update((current) => ({ ...current, filter })),
    setQuery: (query: string) => update((current) => ({ ...current, query })),
    resetSearch: () => update((current) => ({ ...current, query: '', filter: 'all' })),
    toast,
    setToast,
    detail,
    onDetail,
    closeDetail: () => setDetail(null),
    navigate,
  };
}
const Context = createContext<ReturnType<typeof useWorkspaceState> | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const store = useWorkspaceState();
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw Error('WorkspaceProvider is required');
  return value;
}
