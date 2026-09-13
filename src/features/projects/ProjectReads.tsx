import { useEffect, useState } from 'react';
import { HttpError } from '../../shared/http/client';
import { useQuery } from '../../shared/http/query';
import { presentation, serverProjectId, type ApiProject } from './apiModel';
import type { ProjectFilter, ProjectStore } from './apiStore';

export function ProjectListView({
  store,
  filter,
  onFilter,
  onSelect,
  onCreate,
}: {
  store: ProjectStore;
  filter: ProjectFilter;
  onFilter: (filter: ProjectFilter) => void;
  onSelect: (id: string) => void;
  onCreate?: () => void;
}) {
  const [search, setSearch] = useState(filter.query);
  useEffect(() => setSearch(filter.query), [filter.query]);
  useEffect(() => {
    if (search === filter.query) return;
    const timer = setTimeout(() => onFilter({ ...filter, query: search }), 250);
    return () => clearTimeout(timer);
  }, [search, filter, onFilter]);
  const query = store.list(filter),
    state = useQuery(query);
  useEffect(() => () => query.invalidate(true), [query]);
  return (
    <section aria-labelledby="projects-title">
      <h3 id="projects-title">Projects</h3>
      <div className="project-toolbar">
        <label>
          Scope
          <select
            value={filter.scope}
            onChange={(event) =>
              onFilter({ ...filter, scope: event.target.value as ProjectFilter['scope'] })
            }
          >
            <option value="all">All scopes</option>
            <option value="unity">Unity</option>
            <option value="server">Server</option>
          </select>
        </label>
        <label>
          Search Projects
          <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" />
        </label>
        {onCreate && <button onClick={onCreate}>Create Project</button>}
      </div>
      <div aria-label="Project status" className="project-toolbar">
        {(['active', 'archived'] as const).map((status) => (
          <button
            key={status}
            aria-pressed={filter.status === status}
            onClick={() => onFilter({ ...filter, status })}
          >
            {status === 'active' ? 'Active' : 'Archived'}
          </button>
        ))}
      </div>
      {state.status === 'loading' && (
        <p role="status">{state.data ? 'Loading more Projects…' : 'Loading Projects…'}</p>
      )}
      {state.status === 'error' && (
        <div role="alert">
          <p>
            Projects could not be loaded.
            {state.error instanceof HttpError && state.error.requestId
              ? ` Request ID: ${state.error.requestId}`
              : ''}
          </p>
          {state.data?.nextCursor &&
            !(state.error instanceof HttpError && state.error.code === 'INVALID_CURSOR') && (
              <button onClick={() => void store.more(filter)}>Retry Load more</button>
            )}
          <button onClick={() => query.invalidate(true)}>Restart list</button>
        </div>
      )}
      {state.data && (
        <>
          <p>
            {state.data.total} matching Projects · {state.data.items.length} loaded rows
          </p>
          {!state.data.items.length && (
            <p>{filter.query ? 'No Projects match this search.' : 'No Projects in this view.'}</p>
          )}
          <ul className="server-project-list">
            {state.data.items.map((project) => (
              <li key={project.id} className={'project-color-' + presentation(project).color}>
                <button className="project-link" onClick={() => onSelect(project.id)}>
                  {project.name}
                </button>
                <p>
                  {project.stack} · {project.scope} · {project.progress}%
                </p>
                <p>{project.subtitle}</p>
              </li>
            ))}
          </ul>
          {state.data.nextCursor && (
            <button disabled={state.status === 'loading'} onClick={() => void store.more(filter)}>
              Load more
            </button>
          )}
        </>
      )}
      <button disabled={state.status === 'loading'} onClick={() => query.invalidate(true)}>
        Refresh Projects
      </button>
    </section>
  );
}
export function ProjectDetailView({
  store,
  id,
  children,
}: {
  store: ProjectStore;
  id: string;
  children?: (project: ApiProject, verified: boolean) => React.ReactNode;
}) {
  try {
    serverProjectId(id);
  } catch {
    return <p role="alert">Invalid Project address. Select a server Project from Projects.</p>;
  }
  return <VerifiedDetail store={store} id={id} children={children} />;
}
function VerifiedDetail({
  store,
  id,
  children,
}: {
  store: ProjectStore;
  id: string;
  children?: (project: ApiProject, verified: boolean) => React.ReactNode;
}) {
  const query = store.detail(serverProjectId(id)),
    state = useQuery(query);
  useEffect(() => () => query.invalidate(), [query]);
  const missing = state.error instanceof HttpError && state.error.status === 404;
  return (
    <section>
      {state.status === 'loading' && <p role="status">Loading Project…</p>}
      {state.status === 'error' && (
        <div role="alert">
          <p>
            {missing
              ? 'Project not found or unavailable to this account.'
              : 'Project could not be refreshed.'}
          </p>
          <button onClick={() => void query.load()}>Retry Project</button>
        </div>
      )}
      {state.data && !missing && (
        <>
          <h3>{state.data.name}</h3>
          <p>
            {state.data.status === 'archived' ? 'Archived Project' : 'Active Project'} ·{' '}
            {state.data.scope}
          </p>
          <p>{state.data.subtitle}</p>
          <p>
            {state.data.stack} · Progress: {state.data.progress}%
          </p>
          <p>Current milestone memo: {state.data.currentMilestone || 'None'}</p>
          <p>Repository: {state.data.repositoryUrl || 'None'}</p>
          <p className="project-audit">
            Project ID: {state.data.id}
            <br />
            Revision: {state.data.revision}
            <br />
            Created: {state.data.createdAt}
            <br />
            Updated: {state.data.updatedAt}
          </p>
          {children?.(state.data, state.status === 'ready' && !state.stale)}
          <p>Task, Journal, Milestone and Link integration pending.</p>
        </>
      )}
      <button disabled={state.status === 'loading'} onClick={() => query.invalidate()}>
        Refresh Project
      </button>
    </section>
  );
}
