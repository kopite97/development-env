import { useWorkspace } from '../WorkspaceProvider';
import { TopbarView } from './TopbarView';
import type { ComponentProps } from 'react';
export function Topbar(props: Omit<ComponentProps<typeof TopbarView>, 'page' | 'projectId'>) {
  const { page, projectId } = useWorkspace();
  return <TopbarView {...props} page={page} projectId={projectId ?? undefined} />;
}
