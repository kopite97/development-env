import { useWorkspace } from '../WorkspaceProvider';
import { SidebarView } from './SidebarView';
import { useDashboard } from '../../features/dashboard/DashboardProvider';
import { useProjects } from '../../features/projects/ProjectsProvider';
import type { Ref } from 'react';
export function Sidebar({
  mobileNav,
  onNavigate,
  menuRef,
}: {
  mobileNav: boolean;
  onNavigate: () => void;
  menuRef: Ref<HTMLElement>;
}) {
  const { page, navigate: go, setFilter, onDetail } = useWorkspace();
  const { editing } = useDashboard();
  const { activeProjects } = useProjects();
  const navigate = (label: import('../navigation').PageId) => {
    if (go(label)) onNavigate();
  };
  return (
    <SidebarView
      mobileNav={mobileNav}
      onNavigate={onNavigate}
      menuRef={menuRef}
      page={page}
      navigate={navigate}
      editing={editing}
      setFilter={setFilter}
      counts={{
        all: activeProjects.length,
        unity: activeProjects.filter((p) => p.scope === 'unity').length,
        server: activeProjects.filter((p) => p.scope === 'server').length,
      }}
      onProfile={() => {
        onNavigate();
        onDetail(
          '개인 작업실 안내',
          '배치와 작업 상태는 이 브라우저에 저장됩니다.\n프로젝트·개발 일지·배포 정보는 예시 데이터입니다.\n\n현재는 로그인이나 서버 동기화 없이 사용하는 로컬 프로토타입입니다.',
        );
      }}
    />
  );
}
