import { useState, type ReactNode } from 'react';
import { Code2 } from 'lucide-react';
import { SidebarView } from '../layouts/SidebarView';
import { TopbarView } from '../layouts/TopbarView';
import { useMobileNavigation } from '../layouts/useMobileNavigation';
import { Modal, Button } from '../../shared/ui/controls';
import type { OverviewStore } from '../../features/overview/apiStore';
import { useQuery } from '../../shared/http/query';
import type { PageId } from '../navigation';

const paths: Record<PageId, string> = {
  '나의 홈': '/',
  프로젝트: '/projects',
  '작업 보드': '/tasks',
  '개발 일지': '/journals',
  자료실: '/library',
};
export function TaskShell({
  url,
  onNavigate,
  overview,
  children,
  avatar,
  page = '작업 보드',
}: {
  url: URL;
  onNavigate: (path: string) => void;
  overview: OverviewStore;
  children: ReactNode;
  avatar: string;
  page?: PageId;
}) {
  const menu = useMobileNavigation(url.pathname + url.search);
  const [profile, setProfile] = useState(false);
  const state = useQuery(overview.query({ scope: 'all' }));
  const projects = state.data?.projects;
  return (
    <div className="app-shell">
      <SidebarView
        mobileNav={menu.isOpen}
        menuRef={menu.menuRef}
        onNavigate={menu.close}
        page={page}
        avatar={avatar}
        navigate={(page) => {
          onNavigate(paths[page]);
          menu.close();
        }}
        setFilter={(scope) =>
          onNavigate(
            (page === '나의 홈' ? '/' : page === '자료실' ? '/library' : '/projects') +
              '?scope=' +
              scope,
          )
        }
        counts={{
          all: projects ? projects.total : '—',
          unity: projects ? projects.byScope.unity.total : '—',
          server: projects ? projects.byScope.server.total : '—',
        }}
        onProfile={() => {
          menu.close();
          setProfile(true);
        }}
      />
      {menu.isOpen && (
        <button
          aria-label="메뉴 닫기"
          tabIndex={-1}
          aria-hidden="true"
          className="nav-overlay"
          onClick={menu.close}
        />
      )}
      <div className="main-shell" inert={menu.isOpen}>
        <TopbarView
          page={page}
          avatar={avatar}
          onMenu={menu.open}
          menuOpen={menu.isOpen}
          menuRef={menu.triggerRef}
        />
        <main>
          {children}
          <footer className="page-footer">
            <span>
              <Code2 size={14} />
              Built for your next idea.
            </span>
            <span>Devspace · 나만의 개발 작업실</span>
          </footer>
        </main>
      </div>
      {profile && (
        <Modal
          title="개인 작업실 안내"
          onClose={() => setProfile(false)}
          returnFocusRef={menu.triggerRef}
        >
          <p className="detail-body">
            홈 배치와 프로젝트, 작업, 일지, 마일스톤, 링크는 로그인한 작업실의 서버 데이터입니다.
            운영 위젯은 예시 화면입니다.
          </p>
          <div className="modal-actions">
            <Button onClick={() => setProfile(false)}>닫기</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
