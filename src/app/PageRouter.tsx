import { NotFoundPage } from '../pages/NotFoundPage';
import { ProjectDetailPage } from '../pages/ProjectDetailPage';
import { HomePage } from '../pages/HomePage';
import { JournalsPage } from '../pages/JournalsPage';
import { LibraryPage } from '../pages/LibraryPage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { TasksPage } from '../pages/TasksPage';
import { useWorkspace } from './WorkspaceProvider';
import { usePageScaffold } from './layouts/usePageScaffold';
export function PageRouter() {
  const workspace = useWorkspace();
  const { page, projectId, notFound, entryKey } = workspace;
  const scaffold = usePageScaffold();
  const presentation = { scaffold };
  const search = {
    filter: workspace.filter,
    query: workspace.query,
    onReset: workspace.resetSearch,
  };
  const searchActions = { onFilterChange: workspace.setFilter, onQueryChange: workspace.setQuery };
  if (notFound)
    return <NotFoundPage {...presentation} onHome={() => workspace.navigate('나의 홈')} />;
  if (page === '프로젝트' && projectId) {
    return (
      <ProjectDetailPage
        key={entryKey}
        {...presentation}
        projectId={projectId}
        onBack={workspace.closeProject}
        onDetail={workspace.onDetail}
        onArchivedChange={workspace.setShowArchivedProjects}
      />
    );
  }
  switch (page) {
    case '나의 홈':
      return (
        <HomePage
          key={entryKey}
          {...presentation}
          {...search}
          {...searchActions}
          onNotify={workspace.setToast}
          onDetail={workspace.onDetail}
          onProjectOpen={workspace.openProject}
        />
      );
    case '프로젝트':
      return (
        <ProjectsPage
          key={entryKey}
          {...presentation}
          {...search}
          {...searchActions}
          onProjectOpen={workspace.openProject}
          isArchived={workspace.showArchivedProjects}
          onArchivedChange={workspace.setShowArchivedProjects}
        />
      );
    case '작업 보드':
      return <TasksPage key={entryKey} {...presentation} {...search} />;
    case '개발 일지':
      return (
        <JournalsPage
          key={entryKey}
          {...presentation}
          {...search}
          {...searchActions}
          onDetail={workspace.onDetail}
          onNotify={workspace.setToast}
        />
      );
    case '자료실':
      return <LibraryPage key={entryKey} {...presentation} {...search} />;
  }
}
