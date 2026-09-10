import { Code2, Settings2, Sparkles } from 'lucide-react';
import { navigationItems as navItems } from '../navigation';
import { useWorkspace } from '../WorkspaceProvider';
import { Badge } from '../../shared/ui/controls';
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
    <aside
      ref={menuRef}
      id="workspace-navigation"
      role={mobileNav ? 'dialog' : undefined}
      aria-modal={mobileNav || undefined}
      aria-label="작업실 메뉴"
      className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}
    >
      {mobileNav && (
        <button className="button sidebar-close" onClick={onNavigate}>
          메뉴 닫기
        </button>
      )}
      <a
        className="brand"
        href="#"
        onClick={(e) => {
          e.preventDefault();
          navigate('나의 홈');
        }}
      >
        <span className="brand-mark">
          <Code2 size={22} />
        </span>
        devspace<span className="brand-dot">.</span>
      </a>
      <div className="workspace-switch">
        <span className="avatar">N</span>
        <span>
          <strong>나의 작업실</strong>
          <small>Personal workspace</small>
        </span>
        <Badge>개인</Badge>
      </div>
      <div className="nav-label">WORKSPACE</div>
      <nav>
        {navItems.map((item) => (
          <button
            className={`nav-item ${page === item.label ? 'active' : ''}`}
            key={item.label}
            aria-current={page === item.label ? 'page' : undefined}
            onClick={() => navigate(item.label)}
          >
            <item.icon size={18} />
            {item.label}
            {item.label === '프로젝트' && (
              <span className="nav-count">{activeProjects.length}</span>
            )}
          </button>
        ))}
      </nav>
      <div className="nav-label area-label">DEVELOPMENT</div>
      <button
        className="nav-item"
        onClick={() => {
          navigate('프로젝트');
          if (!editing) setFilter('unity');
        }}
      >
        <span className="area-dot unity-dot" />
        Unity 개발
        <span className="nav-count">
          {activeProjects.filter((p) => p.scope === 'unity').length}
        </span>
      </button>
      <button
        className="nav-item"
        onClick={() => {
          navigate('프로젝트');
          if (!editing) setFilter('server');
        }}
      >
        <span className="area-dot server-dot" />
        서버 · 웹 개발
        <span className="nav-count">
          {activeProjects.filter((p) => p.scope === 'server').length}
        </span>
      </button>
      <div className="sidebar-bottom">
        <div className="workspace-note">
          <Sparkles size={18} />
          <strong>작은 기록, 더 나은 개발</strong>
          <p>
            아이디어부터 배포까지,
            <br />
            나만의 속도로 쌓아가세요.
          </p>
        </div>
        <button
          className="profile"
          onClick={() => {
            onNavigate();
            onDetail(
              '개인 작업실 안내',
              '배치와 작업 상태는 이 브라우저에 저장됩니다.\n프로젝트·개발 일지·배포 정보는 예시 데이터입니다.\n\n현재는 로그인이나 서버 동기화 없이 사용하는 로컬 프로토타입입니다.',
            );
          }}
        >
          <span className="avatar">N</span>
          <span>
            <strong>My workspace</strong>
            <small>개인 개발 공간</small>
          </span>
          <Settings2 size={16} />
        </button>
      </div>
    </aside>
  );
}
