import { ChevronRight, Home, Menu } from 'lucide-react';
import { useWorkspace } from '../app/WorkspaceProvider';
import { Button } from '../components/ui';
export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { page, projectId } = useWorkspace();
  return (
    <header className="topbar">
      <div className="breadcrumb">
        <Button variant="ghost" className="mobile-menu" aria-label="메뉴 열기" onClick={onMenu}>
          <Menu size={19} />
        </Button>
        <Home size={15} />
        <ChevronRight size={13} />
        <span>
          {page}
          {projectId ? ' / 상세' : ''}
        </span>
      </div>
      <div className="topbar-right">
        <span className="private-label">
          <span className="live-dot" />
          Personal workspace
        </span>
        <span className="topbar-divider" />
        <span className="avatar avatar-small">N</span>
      </div>
    </header>
  );
}
