import { Gamepad2, Search, X } from 'lucide-react';
import { useWorkspace } from '../WorkspaceProvider';
import { scopes, type Scope } from '../../features/projects/scope';
import { useDashboard } from '../../features/dashboard/DashboardProvider';
import { useJournals } from '../../features/journal/JournalsProvider';
import { useTasks } from '../../features/tasks/TasksProvider';
import { Badge, Button } from '../../shared/ui/controls';
import type { PageScaffoldProps } from '../../shared/ui/PageScaffold';
import { useProjects } from '../../features/projects/ProjectsProvider';

export function usePageScaffold(): Omit<PageScaffoldProps, 'children' | 'actions'> {
  const { page, filter, setFilter, query, setQuery, toast, setToast } = useWorkspace();
  const { editing, error: layoutError } = useDashboard();
  const { error: taskError } = useTasks();
  const { error: journalError } = useJournals();
  const { activeProjects, error: projectError } = useProjects();
  const error = layoutError || taskError || journalError || projectError;
  return {
    title: page === '나의 홈' ? '다시 만나 반가워요 👋' : page,
    description:
      page === '나의 홈'
        ? '만들고 있는 것들, 오늘의 할 일. 여기서 이어가세요.'
        : '프로젝트의 흐름을 정리하고 다음 작업을 준비하세요.',
    overview: (
      <div className="welcome-strip">
        <div className="welcome-icon">
          <Gamepad2 size={23} />
        </div>
        <div>
          <strong>오늘도, 아이디어를 현실로.</strong>
          <span>
            현재 프로젝트 <b>{activeProjects.length}개</b>와 함께 개발을 이어가 보세요.
          </span>
        </div>
        <Badge tone="purple">로컬 작업실</Badge>
      </div>
    ),
    feedback: (
      <>
        {error && (
          <div className="notice" role="alert">
            {error}
          </div>
        )}
        {toast && (
          <div className="notice" role="status">
            {toast}
            <Button variant="ghost" aria-label="알림 닫기" onClick={() => setToast('')}>
              <X size={14} />
            </Button>
          </div>
        )}
      </>
    ),
    filters: (
      <div className="section-toolbar">
        <div className="tabs">
          {Object.entries(scopes).map(([key, label]) => (
            <button
              key={key}
              disabled={editing}
              className={filter === key ? 'selected' : ''}
              onClick={() => setFilter(key as Scope)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={15} />
          <input
            aria-label="현재 화면 검색"
            placeholder={page === '나의 홈' ? '위젯 검색' : '항목 검색'}
            value={query}
            disabled={editing}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
    ),
  };
}
