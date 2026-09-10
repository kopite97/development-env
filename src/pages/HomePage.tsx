import { DashboardWorkspace } from '../features/dashboard/DashboardWorkspace';
import { useJournals } from '../features/journal/JournalsProvider';
import { useTasks } from '../features/tasks/TasksProvider';
import { useProjects } from '../features/projects/ProjectsProvider';
import type { DetailHandler } from '../shared/types/ui';
import type { PagePresentation, SearchInputs, SearchActions } from './pageInputs';
import { renderProjectWidget } from './home/widgetRenderers';

export function HomePage({
  scaffold,
  filter,
  query,
  onReset,
  onFilterChange,
  onQueryChange,
  onNotify,
  onDetail,
  onProjectOpen,
}: PagePresentation &
  SearchInputs &
  SearchActions & {
    onNotify: (message: string) => void;
    onDetail: DetailHandler;
    onProjectOpen: (id: string) => void;
  }) {
  const { tasks } = useTasks();
  const { journals } = useJournals();
  const { projects } = useProjects();
  return (
    <DashboardWorkspace
      scaffold={scaffold}
      filter={filter}
      query={query}
      onReset={onReset}
      onNotify={onNotify}
      onStartEditing={() => {
        onFilterChange('all');
        onQueryChange('');
        onNotify('');
      }}
      renderWidget={(widget) =>
        renderProjectWidget({
          widget,
          tasks,
          journals,
          projects,
          onDetail,
          onProjectOpen,
        })
      }
    />
  );
}
