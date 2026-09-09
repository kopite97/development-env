import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Scope } from '../data/demo';
import { useDashboard } from '../features/dashboard/DashboardProvider';
import type { DetailHandler } from '../types/ui';
import type { PageId } from './navigation';
function useWorkspaceState() {
  const [page, setPage] = useState<PageId>('나의 홈');
  const [filter, setFilter] = useState<Scope>('all');
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState('');
  const [detail, setDetail] = useState<{ title: string; body: string } | null>(null);
  const { editing } = useDashboard();
  const navigate = (next: PageId) => {
    if (editing) {
      setToast('배치 편집을 저장하거나 취소한 뒤 이동해 주세요.');
      return false;
    }
    setPage(next);
    setQuery('');
    return true;
  };
  const onDetail: DetailHandler = (title, body) => setDetail({ title, body });
  return {
    page,
    filter,
    setFilter,
    query,
    setQuery,
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
