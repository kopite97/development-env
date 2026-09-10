import type { PagePresentation, SearchInputs } from './pageInputs';
import { PageScaffold } from '../shared/ui/PageScaffold';
import { TaskManager } from '../features/tasks/TaskManager';
export function TasksPage({
  scaffold,
  filter,
  query,
  onReset: resetSearch,
}: PagePresentation & SearchInputs) {
  return (
    <PageScaffold {...scaffold}>
      <div className="content-panel">
        <TaskManager scope={filter} search={query} onReset={resetSearch} />
      </div>
    </PageScaffold>
  );
}
