import { PageScaffold, type PageScaffoldProps } from '../../shared/ui/PageScaffold';
import { ProjectOverview } from './ProjectOverview';
import type { Scope } from './scope';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../shared/ui/controls';
import { useProjects } from './ProjectsProvider';
import { ProjectEditor } from './ProjectEditor';
import type { Project } from './model';

export type ProjectsWorkspaceProps = {
  scaffold: Omit<PageScaffoldProps, 'children' | 'actions'>;
  filter: Scope;
  query: string;
  onReset: () => void;
  onFilterChange: (scope: Scope) => void;
  onQueryChange: (query: string) => void;
  onProjectOpen: (id: string) => void;
  isArchived: boolean;
  onArchivedChange: (archived: boolean) => void;
  tasks: { scope: Exclude<Scope, 'all'>; status: 'todo' | 'doing' | 'done' }[];
};

export function ProjectsWorkspace({
  tasks,
  scaffold,
  filter,
  query,
  onProjectOpen: openProject,
  onFilterChange: setFilter,
  onQueryChange: setQuery,
  onReset: resetSearch,
  isArchived: archived,
  onArchivedChange: setArchived,
}: ProjectsWorkspaceProps) {
  const { projects, upsert, archive } = useProjects();
  const [editor, setEditor] = useState<Project | 'new' | null>(null);
  const list = projects.filter((p) => p.archived === archived);
  return (
    <PageScaffold
      {...scaffold}
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
