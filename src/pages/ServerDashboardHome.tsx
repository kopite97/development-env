import { useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { ApiDashboardWorkspace } from '../features/dashboard/ApiDashboardWorkspace';
import { HomeProjectFilter } from '../features/dashboard/HomeProjectFilter';
import { homeWidget } from '../features/dashboard/homeProject';
import { supportsProject } from '../features/dashboard/apiModel';
import type { DashboardStore } from '../features/dashboard/apiStore';
import type { DashboardMemory } from '../features/dashboard/draftMemory';
import type { DashboardProjectOptions } from '../features/dashboard/projectOptions';
import type { Widget } from '../features/dashboard/apiModel';
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
import {
  readCategoryFilter,
  readProjectFilter,
  selectionFilter,
  type CategoryFilter,
  type CategoryOption,
} from '../features/projects/categoryFilter';
import { CategoryFilterControl } from '../features/projects/CategoryFilterControl';
import { Button, Modal } from '../shared/ui/controls';
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
  categories: readonly CategoryOption[];
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
  const filter = readCategoryFilter(p.url.searchParams);
  const override =
    p.url.searchParams.has('category') || p.url.searchParams.has('scope') ? filter : undefined;
  const search = p.url.searchParams.get('q') ?? '';
  const rawProjectId = p.url.searchParams.get('projectId');
  let projectId: string | undefined;
  let invalidProject = false;
  try {
    projectId = readProjectFilter(p.url.searchParams);
  } catch {
    invalidProject = true;
  }
  const [editing, setEditing] = useState(!!p.memory.editor);
  const [detail, setDetail] = useState<{ title: string; body: string }>();
  const clearTasks = () => {
    for (const memory of Object.values(p.taskMemories)) memory.editor = undefined;
  };
  const filterNavigate = (category: CategoryFilter, query: string, push = false) => {
    const params = new URLSearchParams();
    if (push) params.set('category', category);
    else {
      if (rawProjectId) params.set('projectId', rawProjectId);
      if (override) params.set('category', override);
    }
    if (query) params.set('q', query);
    const navigate = push ? p.onNavigate : p.onFilterNavigate;
    navigate('/' + (params.size ? '?' + params : ''));
  };
  const reset = () => p.onFilterNavigate('/');
  const change = (action: () => void) => {
    if (confirmNavigation()) {
      clearTasks();
      action();
    }
  };
  const render = (configured: Widget) => {
    if (invalidProject && supportsProject(configured.type))
      return <p role="alert">올바른 프로젝트를 선택해 주세요.</p>;
    const w = homeWidget(
      configured,
      editing ? undefined : projectId,
      editing ? undefined : override,
    );
    if (w.selectionState === 'missingCategory')
      return <p role="alert">사용할 수 없는 개발 분야입니다. 위젯 설정에서 다시 선택해 주세요.</p>;
    const effective = selectionFilter(w.selection);
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
              filter={{ ...effective, query: '', projectStatus: 'all' }}
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
              category={effective.category}
              projectId={effective.projectId}
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
              category={effective.category}
              projectId={effective.projectId}
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
            <ApiLinks
              store={p.links}
              categories={p.categories}
              filter={{ ...effective, query: '' }}
            />
          </div>
        );
        break;
      case 'deploy':
        content = (
          <DeploymentStatus scope="all" onDetail={(title, body) => setDetail({ title, body })} />
        );
        break;
    }
    return (
      <div key={JSON.stringify([w.type, effective.category, effective.projectId, w.limit])}>
        {effective.projectId ? (
          <ProjectWidget projects={p.projects} id={effective.projectId} onNavigate={p.onNavigate}>
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
        categories={p.categories}
        filter={filter}
        query={search}
        onEditingChange={setEditing}
        onStartEditing={() => {
          clearTasks();
          reset();
        }}
        onReset={() => change(reset)}
        renderWidget={render}
        onNavigate={p.onNavigate}
        widgetHref={(configured) => {
          const widget = homeWidget(configured, projectId, override);
          const selected = selectionFilter(widget.selection);
          if (widget.type === 'deploy' || widget.type === 'milestone') return undefined;
          if (widget.type === 'overview' && selected.projectId)
            return !invalidProject && selected.projectId
              ? '/projects/' + selected.projectId
              : '/projects';
          const path = {
            overview: '/projects',
            board: '/tasks',
            journal: '/journals',
            links: '/library',
          }[widget.type];
          const params = new URLSearchParams();
          if (!invalidProject && selected.projectId) params.set('projectId', selected.projectId);
          if (selected.category) params.set('category', selected.category);
          return path + (params.size ? '?' + params : '');
        }}
        displaySelection={(widget) => homeWidget(widget, projectId, override).selection}
        scaffold={{
          title: '다시 만나 반가워요 👋',
          description: '만들고 있는 것들, 오늘의 할 일. 여기서 이어가세요.',
          filters: (
            <div className="section-toolbar home-toolbar classification-toolbar">
              <CategoryFilterControl
                value={filter}
                options={p.categories}
                disabled={editing}
                onChange={(category) => change(() => filterNavigate(category, search, true))}
              />
              <HomeProjectFilter
                options={p.options}
                value={projectId ?? rawProjectId ?? ''}
                invalid={invalidProject}
                disabled={editing}
                onChange={(id) =>
                  change(() => {
                    const params = new URLSearchParams(p.url.search);
                    params.delete('category');
                    params.delete('scope');
                    if (id) params.set('projectId', id);
                    else params.delete('projectId');
                    p.onNavigate('/' + (params.size ? '?' + params : ''));
                  })
                }
              />
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
              <Button disabled={editing || (!override && !projectId)} onClick={() => change(reset)}>
                저장된 위젯 설정 사용
              </Button>
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
