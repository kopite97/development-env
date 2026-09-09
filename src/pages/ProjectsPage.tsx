import { useWorkspace } from '../app/WorkspaceProvider';
import { PageScaffold } from '../layouts/PageScaffold';
import { ProjectOverview } from '../features/projects/ProjectOverview';
import { useTasks } from '../features/tasks/TasksProvider';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../components/ui';
import { useProjects } from '../features/projects/ProjectsProvider';
import { ProjectEditor } from '../features/projects/ProjectEditor';
import type { Project } from '../features/projects/model';
export function ProjectsPage() {
  const {
    filter,
    query,
    openProject,
    setFilter,
    setQuery,
    resetSearch,
    showArchivedProjects: archived,
    setShowArchivedProjects: setArchived,
  } = useWorkspace();
  const { tasks } = useTasks();
  const { projects, upsert, archive } = useProjects();
  const [editor, setEditor] = useState<Project | 'new' | null>(null);
  const list = projects.filter((p) => p.archived === archived);
  return (
    <PageScaffold
      actions={
        <Button variant="primary" onClick={() => setEditor('new')}>
          <Plus size={16} />
          프로젝트 추가
        </Button>
      }
    >
      <div className="content-panel">
        <div className="feature-actions">
          <Button variant={!archived ? 'primary' : 'secondary'} onClick={() => setArchived(false)}>
            현재 프로젝트
          </Button>
          <Button variant={archived ? 'primary' : 'secondary'} onClick={() => setArchived(true)}>
            보관된 프로젝트
          </Button>
        </div>
        <ProjectOverview
          projects={list}
          scope={filter}
          search={query}
          tasks={tasks}
          onOpen={openProject}
          archived={archived}
          onReset={resetSearch}
          emptyAction={
            <Button onClick={() => setEditor('new')}>
              <Plus size={16} />
              프로젝트 추가
            </Button>
          }
        />
      </div>
      {editor && (
        <ProjectEditor
          existing={editor === 'new' ? undefined : editor}
          onClose={() => setEditor(null)}
          onArchive={archive}
          onSave={(p) => {
            const success = upsert(p);
            if (success) {
              setFilter('all');
              setQuery('');
              setArchived(p.archived);
            }
            return success;
          }}
        />
      )}
    </PageScaffold>
  );
}
