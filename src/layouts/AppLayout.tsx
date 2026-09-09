import { Code2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useWorkspace } from '../app/WorkspaceProvider';
import { Button, Modal } from '../components/ui';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
export function AppLayout({ children }: { children: ReactNode }) {
  const [mobileNav, setMobileNav] = useState(false);
  const { detail, closeDetail } = useWorkspace();
  return (
    <div className="app-shell">
      <Sidebar mobileNav={mobileNav} onNavigate={() => setMobileNav(false)} />
      {mobileNav && (
        <button
          aria-label="메뉴 닫기"
          className="nav-overlay"
          onClick={() => setMobileNav(false)}
        />
      )}
      <div className="main-shell">
        <Topbar onMenu={() => setMobileNav(true)} />
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
      {detail && (
        <Modal title={detail.title} onClose={closeDetail}>
          <p className="detail-body">{detail.body}</p>
          <div className="modal-actions">
            <Button onClick={closeDetail}>닫기</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
