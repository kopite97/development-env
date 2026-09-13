import { ProjectDetailView, ProjectListView } from '../features/projects/ProjectReads';
import type { ProjectStore, ProjectFilter } from '../features/projects/apiStore';
import { useState } from 'react';
import type { DraftMemory } from '../features/projects/draftMemory';
import { ApiProjectEditor } from '../features/projects/ApiProjectEditor';
import { ProjectActions } from '../features/projects/ProjectActions';
import type { OverviewStore } from '../features/overview/apiStore';
import { OverviewSummary } from '../features/overview/OverviewSummary';
import type { ReactNode } from 'react';
export function ServerProjectsPage({
  store,
  overview,
  url,
  onNavigate,
  memory,
  renderTasks,
  renderJournals,
}: {
  store: ProjectStore;
  overview: OverviewStore;
  url: URL;
  onNavigate: (path: string) => void;
  memory: DraftMemory;
  renderTasks?: (id: string) => ReactNode;
  renderJournals?: (id: string) => ReactNode;
}) {
  const [creating, setCreating] = useState(memory.editor?.target === 'create');
  const params = url.searchParams;
  const scope = params.get('scope');
  const filter: ProjectFilter = {
    scope: scope === 'unity' || scope === 'server' ? scope : 'all',
    status: params.get('archived') === 'true' ? 'archived' : 'active',
    query: params.get('q') ?? '',
  };
  const id = url.pathname.match(/^\/projects\/([^/]+)\/?$/)?.[1];
  const handleFilter = (next: ProjectFilter) => {
    const query = new URLSearchParams();
    if (next.scope !== 'all') query.set('scope', next.scope);
    if (next.query) query.set('q', next.query);
    if (next.status === 'archived') query.set('archived', 'true');
    onNavigate('/projects' + (query.size ? '?' + query : ''));
  };
  const handleSaved = (saved: { id: string }) => {
    memory.editor = undefined;
    setCreating(false);
    onNavigate('/projects/' + saved.id + url.search);
  };
  return (
    <>
      {id ? (
        <>
          <button onClick={() => onNavigate('/projects' + url.search)}>Back to Projects</button>
          <ProjectDetailView key={id} store={store} id={id}>
            {(project, verified) => (
              <>
                <OverviewSummary
                  store={overview}
                  filter={{ scope: 'all', projectId: project.id }}
                />
                <ProjectActions
                  store={store}
                  project={project}
                  verified={verified}
                  memory={memory}
                  onSaved={() => {}}
                />
                {verified && renderTasks?.(project.id)}
                {verified && renderJournals?.(project.id)}
              </>
            )}
          </ProjectDetailView>
        </>
      ) : (
        <>
          <OverviewSummary store={overview} filter={{ scope: filter.scope }} />
          {creating && (
            <ApiProjectEditor
              store={store}
              memory={memory}
              onClose={() => setCreating(false)}
              onSaved={handleSaved}
            />
          )}
          <ProjectListView
            store={store}
            filter={filter}
            onFilter={handleFilter}
            onSelect={(selected) => onNavigate('/projects/' + selected + url.search)}
            onCreate={creating ? undefined : () => setCreating(true)}
          />
        </>
      )}
    </>
  );
}
