import { useEffect, useRef, useState } from 'react';
import { ProjectStore } from '../../features/projects/apiStore';
import type { PrivateTransport } from '../../shared/http/transport';
import { ServerProjectsPage } from '../../pages/ServerProjectsPage';
import './projects.css';
import type { DraftMemory } from '../../features/projects/draftMemory';
import { OverviewStore } from '../../features/overview/apiStore';
import { OverviewSummary } from '../../features/overview/OverviewSummary';
import { TaskStore } from '../../features/tasks/apiStore';
import { ServerTasksPage } from '../../pages/ServerTasksPage';
import { TaskShell } from './TaskShell';
import { taskProjectOptions } from './taskProjectOptions';
import type { TaskMemory } from '../../features/tasks/draftMemory';
import { ServerTaskHome } from '../../pages/ServerTaskHome';
import { ApiTaskManager } from '../../features/tasks/ApiTaskManager';
import { JournalStore } from '../../features/journal/apiStore';
import type { JournalMemory } from '../../features/journal/draftMemory';
import { journalProjectOptions } from './journalProjectOptions';
import { ServerJournalsPage } from '../../pages/ServerJournalsPage';
import { ServerJournalHome } from '../../pages/ServerJournalHome';
import { ApiRecentJournals } from '../../features/journal/ApiRecentJournals';
export function PrivateWorkspace({
  transport,
  url,
  onNavigate,
  memory,
  avatar = '',
  taskMemory,
  journalMemory,
}: {
  transport: PrivateTransport;
  url: URL;
  onNavigate: (path: string, replace?: boolean) => void;
  memory: DraftMemory;
  avatar?: string;
  taskMemory: TaskMemory;
  journalMemory: JournalMemory;
}) {
  const [projects] = useState(() => new ProjectStore(transport));
  const [overview] = useState(() => new OverviewStore(transport));
  const [tasks] = useState(() => new TaskStore(transport));
  const [journals] = useState(() => new JournalStore(transport));
  const [options] = useState(() => taskProjectOptions(projects));
  const [journalOptions] = useState(() => journalProjectOptions(projects));
  tasks.onInvalidate = () => overview.invalidate();
  projects.onInvalidate = () => {
    options.invalidate();
    tasks.invalidate();
    journalOptions.invalidate();
    journals.invalidate();
  };
  const mounts = useRef(0);
  useEffect(() => {
    mounts.current++;
    return () => {
      mounts.current--;
      queueMicrotask(() => {
        if (!mounts.current) {
          projects.dispose();
          overview.dispose();
          tasks.dispose();
          options.dispose();
          journals.dispose();
          journalOptions.dispose();
        }
      });
    };
  }, [projects, overview, tasks, options, journals, journalOptions]);
  if (url.pathname === '/tasks')
    return (
      <TaskShell url={url} onNavigate={onNavigate} overview={overview} avatar={avatar}>
        <ServerTasksPage
          store={tasks}
          overview={overview}
          options={options}
          memory={taskMemory}
          url={url}
          onFilterNavigate={(path) => onNavigate(path, true)}
        />
      </TaskShell>
    );
  if (/^\/projects(?:\/[^/]+)?\/?$/.test(url.pathname))
    return (
      <ServerProjectsPage
        key={url.pathname + url.search}
        store={projects}
        overview={overview}
        url={url}
        onNavigate={onNavigate}
        memory={memory}
        renderTasks={(id) => (
          <section className="task-surface content-panel">
            <h2>태스크</h2>
            <ApiTaskManager
              store={tasks}
              options={options}
              memory={taskMemory}
              filter={{ scope: 'all', projectId: id, query: '', projectStatus: 'all' }}
            />
          </section>
        )}
        renderJournals={(id) => (
          <section className="journal-surface content-panel">
            <h2>개발 일지</h2>
            <ApiRecentJournals store={journals} projectId={id} limit={3} />
          </section>
        )}
      />
    );
  if (url.pathname === '/journals')
    return (
      <ServerJournalsPage
        store={journals}
        options={journalOptions}
        memory={journalMemory}
        url={url}
        onFilterNavigate={(path) => onNavigate(path, true)}
      />
    );
  if (url.pathname === '/')
    return (
      <>
        <OverviewSummary store={overview} filter={{ scope: 'all' }} />
        <ServerTaskHome store={tasks} options={options} memory={taskMemory} />
        <ServerJournalHome store={journals} />
      </>
    );
  return (
    <div className="auth-pending">
      <h3>
        {['/', '/tasks', '/journals', '/library'].includes(url.pathname)
          ? 'Feature integration pending'
          : 'Page not found'}
      </h3>
      <p>
        Your session is ready. This page will become available when its backend integration is
        complete.
      </p>
    </div>
  );
}
