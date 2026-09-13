import { DashboardStore } from '../../features/dashboard/apiStore';
import { dashboardProjectOptions } from './dashboardProjectOptions';
import type { HomeMemory } from './dashboardHandoff';
import { ServerDashboardHome } from '../../pages/ServerDashboardHome';
import { LinkStore } from '../../features/links/apiStore';
import type { LinkMemory } from '../../features/links/draftMemory';
import { ServerLinksPage } from '../../pages/ServerLinksPage';
import { useEffect, useRef, useState } from 'react';
import { ProjectStore } from '../../features/projects/apiStore';
import type { PrivateTransport } from '../../shared/http/transport';
import { ServerProjectsPage } from '../../pages/ServerProjectsPage';
import './projects.css';
import type { DraftMemory } from '../../features/projects/draftMemory';
import { OverviewStore } from '../../features/overview/apiStore';
import { TaskStore } from '../../features/tasks/apiStore';
import { ServerTasksPage } from '../../pages/ServerTasksPage';
import { TaskShell } from './TaskShell';
import { taskProjectOptions } from './taskProjectOptions';
import type { TaskMemory } from '../../features/tasks/draftMemory';
import { ApiTaskManager } from '../../features/tasks/ApiTaskManager';
import { JournalStore } from '../../features/journal/apiStore';
import type { JournalMemory } from '../../features/journal/draftMemory';
import { journalProjectOptions } from './journalProjectOptions';
import { ServerJournalsPage } from '../../pages/ServerJournalsPage';
import { ApiRecentJournals } from '../../features/journal/ApiRecentJournals';
import { MilestoneStore } from '../../features/milestones/apiStore';
import { ApiMilestoneList } from '../../features/milestones/ApiMilestoneList';
import type { MilestoneMemory } from '../../features/milestones/draftMemory';
import { milestoneProjectOptions } from './milestoneProjectOptions';
export function PrivateWorkspace({
  transport,
  url,
  onNavigate,
  memory,
  avatar = '',
  taskMemory,
  journalMemory,
  milestoneMemory,
  linkMemory,
  dashboardMemory,
}: {
  transport: PrivateTransport;
  url: URL;
  onNavigate: (path: string, replace?: boolean) => void;
  memory: DraftMemory;
  avatar?: string;
  taskMemory: TaskMemory;
  journalMemory: JournalMemory;
  milestoneMemory: MilestoneMemory;
  linkMemory: LinkMemory;
  dashboardMemory: HomeMemory;
}) {
  const [dashboard] = useState(() => new DashboardStore(transport));
  const [links] = useState(() => new LinkStore(transport));
  const [projects] = useState(() => new ProjectStore(transport));
  const [overview] = useState(() => new OverviewStore(transport));
  const [tasks] = useState(() => new TaskStore(transport));
  const [journals] = useState(() => new JournalStore(transport));
  const [milestones] = useState(() => new MilestoneStore(transport));
  const [milestoneOptions] = useState(() => milestoneProjectOptions(projects));
  const [options] = useState(() => taskProjectOptions(projects));
  const [journalOptions] = useState(() => journalProjectOptions(projects));
  const [dashboardOptions] = useState(() => dashboardProjectOptions(projects));
  tasks.onInvalidate = () => overview.invalidate();
  dashboard.onSaved = () => {
    overview.invalidate();
    tasks.invalidate();
    journals.invalidate();
    milestones.invalidate();
    links.invalidate();
  };
  projects.onInvalidate = () => {
    overview.invalidate();
    dashboard.invalidate();
    dashboardOptions.invalidate();
    options.invalidate();
    tasks.invalidate();
    journalOptions.invalidate();
    journals.invalidate();
    milestoneOptions.invalidate();
    milestones.invalidate();
  };
  const mounts = useRef(0);
  useEffect(() => {
    mounts.current++;
    return () => {
      mounts.current--;
      queueMicrotask(() => {
        if (!mounts.current) {
          dashboard.dispose();
          dashboardOptions.dispose();
          links.dispose();
          projects.dispose();
          overview.dispose();
          tasks.dispose();
          options.dispose();
          journals.dispose();
          journalOptions.dispose();
          milestones.dispose();
          milestoneOptions.dispose();
        }
      });
    };
  }, [
    dashboard,
    dashboardOptions,
    links,
    projects,
    overview,
    tasks,
    options,
    journals,
    journalOptions,
    milestones,
    milestoneOptions,
  ]);
  if (url.pathname === '/library')
    return (
      <TaskShell
        page="자료실"
        url={url}
        onNavigate={onNavigate}
        overview={overview}
        avatar={avatar}
      >
        <div className="link-surface">
          <ServerLinksPage
            store={links}
            overview={overview}
            memory={linkMemory}
            url={url}
            onFilterNavigate={(path) => onNavigate(path, true)}
          />
        </div>
      </TaskShell>
    );
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
        renderMilestones={(id) => (
          <section className="content-panel milestone-surface" aria-label="프로젝트 마일스톤">
            <div className="panel-heading">
              <h2>마일스톤</h2>
              <p>목표와 기한을 관리하세요.</p>
            </div>
            <ApiMilestoneList
              store={milestones}
              options={milestoneOptions}
              memory={milestoneMemory}
              projectId={id}
              onNavigate={onNavigate}
            />
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
      <TaskShell
        page="나의 홈"
        url={url}
        onNavigate={onNavigate}
        overview={overview}
        avatar={avatar}
      >
        <ServerDashboardHome
          store={dashboard}
          options={dashboardOptions}
          memory={dashboardMemory}
          taskMemories={dashboardMemory.tasks}
          onFilterNavigate={(path) => onNavigate(path, true)}
          projects={projects}
          overview={overview}
          tasks={tasks}
          taskOptions={options}
          journals={journals}
          milestones={milestones}
          milestoneOptions={milestoneOptions}
          links={links}
          url={url}
          onNavigate={onNavigate}
        />
      </TaskShell>
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
