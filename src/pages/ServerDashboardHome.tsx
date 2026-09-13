import { useState, type ReactNode } from 'react';
import { Gamepad2, Search } from 'lucide-react';
import { ApiDashboardWorkspace } from '../features/dashboard/ApiDashboardWorkspace';
import type { DashboardStore } from '../features/dashboard/apiStore';
import type { DashboardMemory } from '../features/dashboard/draftMemory';
import type { DashboardProjectOptions } from '../features/dashboard/projectOptions';
import type { Widget } from '../features/dashboard/model';
import type { ProjectStore } from '../features/projects/apiStore';
import { serverProjectId } from '../features/projects/apiModel';
import type { OverviewStore } from '../features/overview/apiStore';
import type { TaskStore } from '../features/tasks/apiStore';
import type { TaskMemory } from '../features/tasks/draftMemory';
import type { TaskProjectOptions } from '../features/tasks/projectOptions';
import { ApiTaskManager } from '../features/tasks/ApiTaskManager';
import type { JournalStore } from '../features/journal/apiStore';
import { ApiRecentJournals } from '../features/journal/ApiRecentJournals';
import type { MilestoneStore } from '../features/milestones/apiStore';
import type { MilestoneProjectOptions } from '../features/milestones/projectOptions';
import { ApiMilestoneList } from '../features/milestones/ApiMilestoneList';
import type { LinkStore } from '../features/links/apiStore';
import { ApiLinks } from '../features/links/ApiLinks';
import { DeploymentStatus } from '../features/operations/DeploymentStatus';
import { scopes, type Scope } from '../features/projects/scope';
import { Badge, Button, Modal } from '../shared/ui/controls';
import { useQuery } from '../shared/http/query';
import { confirmNavigation } from '../shared/lib/navigationGuard';
import { ServerProjectOverview } from './ServerProjectOverview';

function ProjectWidget({
  projects,
  id,
  onNavigate,
  children,
}: {
  projects: ProjectStore;
  id: string;
  onNavigate: (path: string) => void;
  children: ReactNode;
}) {
  const query = projects.detail(serverProjectId(id));
  const state = useQuery(query);
  return (
    <>
      {state.data && (
        <Button onClick={() => onNavigate('/projects/' + id)}>{state.data.name} 상세 보기</Button>
      )}
      {state.status === 'error' ? (
        <p role="alert">
          선택한 프로젝트를 확인하지 못했습니다.{' '}
          <Button onClick={() => query.invalidate()}>다시 확인</Button>
        </p>
      ) : state.data ? (
        children
      ) : (
        <p role="status">프로젝트를 불러오는 중…</p>
      )}
    </>
  );
}
type Props = {
  store: DashboardStore;
  memory: DashboardMemory;
  taskMemories: Record<string, TaskMemory>;
  options: DashboardProjectOptions;
  projects: ProjectStore;
  overview: OverviewStore;
  tasks: TaskStore;
  taskOptions: TaskProjectOptions;
  journals: JournalStore;
  milestones: MilestoneStore;
  milestoneOptions: MilestoneProjectOptions;
  links: LinkStore;
  url: URL;
  onNavigate: (path: string) => void;
  onFilterNavigate: (path: string) => void;
};
export function ServerDashboardHome(p: Props) {
  const filter: Scope =
    p.url.searchParams.get('scope') === 'unity'
      ? 'unity'
      : p.url.searchParams.get('scope') === 'server'
        ? 'server'
        : 'all';
  const search = p.url.searchParams.get('q') ?? '';
  const [editing, setEditing] = useState(!!p.memory.editor);
  const [detail, setDetail] = useState<{ title: string; body: string }>();
  const counts = useQuery(p.overview.query({ scope: 'all' }));
  const clearTasks = () => {
    for (const memory of Object.values(p.taskMemories)) memory.editor = undefined;
  };
  const filterNavigate = (scope: Scope, query: string) => {
    const params = new URLSearchParams();
    if (scope !== 'all') params.set('scope', scope);
    if (query) params.set('q', query);
    p.onFilterNavigate('/' + (params.size ? '?' + params : ''));
  };
  const reset = () => filterNavigate('all', '');
  const change = (action: () => void) => {
    if (confirmNavigation()) {
      clearTasks();
      action();
    }
  };
  const render = (w: Widget) => {
    let content: ReactNode;
    switch (w.type) {
      case 'overview':
        content = (
          <ServerProjectOverview
            projects={p.projects}
            overview={p.overview}
            widget={w}
            onNavigate={p.onNavigate}
          />
        );
        break;
      case 'board':
        content = (
          <div className="task-surface">
            <ApiTaskManager
              store={p.tasks}
              options={p.taskOptions}
              memory={p.taskMemories[w.id] ?? (p.taskMemories[w.id] = {})}
              filter={{ scope: w.scope, projectId: w.projectId, query: '', projectStatus: 'all' }}
              limit={w.limit ?? 20}
            />
          </div>
        );
        break;
      case 'journal':
        content = (
          <div className="journal-surface">
            <ApiRecentJournals
              store={p.journals}
              scope={w.scope}
              projectId={w.projectId}
              limit={w.limit ?? 3}
            />
          </div>
        );
        break;
      case 'milestone':
        content = (
          <div className="milestone-surface">
            <ApiMilestoneList
              store={p.milestones}
              options={p.milestoneOptions}
              memory={{}}
              scope={w.scope}
              projectId={w.projectId}
              limit={w.limit ?? 2}
              readOnly
              onNavigate={p.onNavigate}
            />
          </div>
        );
        break;
      case 'links':
        content = (
          <div className="link-surface">
            <ApiLinks store={p.links} filter={{ scope: w.scope, query: '' }} />
          </div>
        );
        break;
      case 'deploy':
        content = (
          <DeploymentStatus
            scope={w.scope}
            onDetail={(title, body) => setDetail({ title, body })}
          />
        );
        break;
    }
    return (
      <div key={JSON.stringify([w.type, w.scope, w.projectId, w.limit])}>
        {w.projectId ? (
          <ProjectWidget projects={p.projects} id={w.projectId} onNavigate={p.onNavigate}>
            {content}
          </ProjectWidget>
        ) : (
          content
        )}
      </div>
    );
  };
  return (
    <>
      <ApiDashboardWorkspace
        store={p.store}
        memory={p.memory}
        options={p.options}
        filter={filter}
        query={search}
        onEditingChange={setEditing}
        onStartEditing={() => {
          clearTasks();
          reset();
        }}
        onReset={() => change(reset)}
        renderWidget={render}
        scaffold={{
          title: '다시 만나 반가워요 👋',
          description: '만들고 있는 것들, 오늘의 할 일. 여기서 이어가세요.',
          overview: (
            <div className="welcome-strip">
              <div className="welcome-icon">
                <Gamepad2 size={23} />
              </div>
              <div>
                <strong>오늘도, 아이디어를 현실로.</strong>
                <span>
                  현재 프로젝트 <b>{counts.data?.projects.total ?? '—'}개</b>와 함께 개발을 이어가
                  보세요.
                </span>
              </div>
              <Badge tone="purple">개인 작업실</Badge>
            </div>
          ),
          filters: (
            <div className="section-toolbar">
              <div className="tabs">
                {Object.entries(scopes).map(([key, label]) => (
                  <button
                    key={key}
                    disabled={editing}
                    className={filter === key ? 'selected' : ''}
                    onClick={() => change(() => filterNavigate(key as Scope, search))}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="search">
                <Search size={15} />
                <input
                  aria-label="현재 화면 검색"
                  placeholder="위젯 검색"
                  disabled={editing}
                  value={search}
                  onChange={(event) => change(() => filterNavigate(filter, event.target.value))}
                />
              </label>
            </div>
          ),
        }}
      />
      {detail && (
        <Modal title={detail.title} onClose={() => setDetail(undefined)}>
          <p className="detail-body">{detail.body}</p>
          <div className="modal-actions">
            <Button onClick={() => setDetail(undefined)}>닫기</Button>
          </div>
        </Modal>
      )}
    </>
  );
}
