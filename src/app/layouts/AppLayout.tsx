import { Code2 } from 'lucide-react';
import { type ReactNode } from 'react';
import { useWorkspace } from '../WorkspaceProvider';
import { Button, Modal } from '../../shared/ui/controls';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useMobileNavigation } from './useMobileNavigation';
export function AppLayout({ children }: { children: ReactNode }) {
  const { detail, closeDetail, entryKey } = useWorkspace();
  const menu = useMobileNavigation(entryKey);
  return (
    <div className="app-shell">
      <Sidebar mobileNav={menu.isOpen} menuRef={menu.menuRef} onNavigate={menu.close} />
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
        <Topbar onMenu={menu.open} menuOpen={menu.isOpen} menuRef={menu.triggerRef} />
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
        <Modal title={detail.title} onClose={closeDetail} returnFocusRef={menu.triggerRef}>
          <p className="detail-body">{detail.body}</p>
          <div className="modal-actions">
            <Button onClick={closeDetail}>닫기</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
