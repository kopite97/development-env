import { NotFoundPage } from '../pages/NotFoundPage';
import { ProjectDetailPage } from '../pages/ProjectDetailPage';
import type { ComponentType } from 'react';
import { HomePage } from '../pages/HomePage';
import { JournalsPage } from '../pages/JournalsPage';
import { LibraryPage } from '../pages/LibraryPage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { TasksPage } from '../pages/TasksPage';
import { useWorkspace } from './WorkspaceProvider';
import type { PageId } from './navigation';
const pages: Record<PageId, ComponentType> = {
  '나의 홈': HomePage,
  프로젝트: ProjectsPage,
  '작업 보드': TasksPage,
  '개발 일지': JournalsPage,
  자료실: LibraryPage,
};
export function PageRouter() {
  const { page, projectId, notFound, entryKey } = useWorkspace();
  if (notFound) return <NotFoundPage />;
  if (page === '프로젝트' && projectId)
    return <ProjectDetailPage key={entryKey} projectId={projectId} />;
  const Page = pages[page];
  return <Page key={entryKey} />;
}
