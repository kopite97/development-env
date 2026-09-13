import { useEffect, useState } from 'react';
import { Gamepad2, Search } from 'lucide-react';
import { PageScaffold } from '../shared/ui/PageScaffold';
import { Badge } from '../shared/ui/controls';
import { useQuery } from '../shared/http/query';
import type { OverviewStore } from '../features/overview/apiStore';
import type { TaskStore } from '../features/tasks/apiStore';
import { ApiTaskManager } from '../features/tasks/ApiTaskManager';
import type { TaskProjectOptions } from '../features/tasks/projectOptions';
import type { TaskMemory } from '../features/tasks/draftMemory';
import { scopes, type Scope } from '../features/projects/scope';
import { confirmNavigation } from '../shared/lib/navigationGuard';

export function ServerTasksPage({
  store,
  overview,
  options,
  memory,
  url,
  onFilterNavigate,
}: {
  store: TaskStore;
  overview: OverviewStore;
  options: TaskProjectOptions;
  memory: TaskMemory;
  url: URL;
  onFilterNavigate: (path: string) => void;
}) {
  const scope: Scope =
    url.searchParams.get('scope') === 'unity'
      ? 'unity'
      : url.searchParams.get('scope') === 'server'
        ? 'server'
        : 'all';
  const query = url.searchParams.get('q') ?? '';
  const [search, setSearch] = useState(query);
  const navigateFilter = (nextScope: Scope, nextQuery: string) => {
    const params = new URLSearchParams();
    if (nextScope !== 'all') params.set('scope', nextScope);
    if (nextQuery) params.set('q', nextQuery);
    onFilterNavigate('/tasks' + (params.size ? '?' + params : ''));
  };
  useEffect(() => setSearch(query), [query]);
  const changeFilter = (action: () => void) => {
    if (confirmNavigation()) {
      memory.editor = undefined;
      action();
    }
  };
  useEffect(() => {
    if (search === query) return;
    const timer = setTimeout(() => navigateFilter(scope, search), 250);
    return () => clearTimeout(timer);
  }, [search, query, scope, onFilterNavigate]);
  const counters = useQuery(overview.query({ scope: 'all' }));
  return (
    <PageScaffold
      title="작업 보드"
      description="프로젝트의 흐름을 정리하고 다음 작업을 준비하세요."
      overview={
        <div className="welcome-strip">
          <div className="welcome-icon">
            <Gamepad2 size={23} />
          </div>
          <div>
            <strong>오늘도, 아이디어를 현실로.</strong>
            <span>
              현재 프로젝트 <b>{counters.data ? counters.data.projects.total : '—'}개</b>와 함께
              개발을 이어가 보세요.
            </span>
          </div>
          <Badge tone="purple">개인 작업실</Badge>
        </div>
      }
      filters={
        <div className="section-toolbar">
          <div className="tabs">
            {Object.entries(scopes).map(([key, label]) => (
              <button
                key={key}
                className={scope === key ? 'selected' : ''}
                onClick={() => changeFilter(() => navigateFilter(key as Scope, search))}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="search">
            <Search size={15} />
            <input
              aria-label="현재 화면 검색"
              placeholder="항목 검색"
              value={search}
              onChange={(event) => changeFilter(() => setSearch(event.target.value))}
            />
          </label>
        </div>
      }
    >
      <div className="content-panel">
        <ApiTaskManager
          store={store}
          options={options}
          memory={memory}
          onReset={() =>
            changeFilter(() => {
              setSearch('');
              navigateFilter('all', '');
            })
          }
          filter={{ scope, query, projectStatus: 'all' }}
        />
      </div>
    </PageScaffold>
  );
}
