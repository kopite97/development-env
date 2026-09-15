import type { ReactNode } from 'react';
import { AppLayout } from '../../src/app/layouts/AppLayout';
import { Sidebar } from '../../src/app/layouts/Sidebar';
import { Topbar } from '../../src/app/layouts/Topbar';
import { useWorkspace } from '../../src/app/WorkspaceProvider';

export function LegacyLayout({ children }: { children: ReactNode }) {
  const { detail, closeDetail, entryKey } = useWorkspace();
  return (
    <AppLayout
      entryKey={entryKey}
      detail={detail}
      closeDetail={closeDetail}
      renderSidebar={(menu) => (
        <Sidebar mobileNav={menu.isOpen} menuRef={menu.menuRef} onNavigate={menu.close} />
      )}
      renderTopbar={(menu) => (
        <Topbar onMenu={menu.open} menuOpen={menu.isOpen} menuRef={menu.triggerRef} />
      )}
    >
      {children}
    </AppLayout>
  );
}
