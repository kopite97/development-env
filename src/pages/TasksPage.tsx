import { useWorkspace } from '../app/WorkspaceProvider';
import { PageScaffold } from '../layouts/PageScaffold';
import { TaskManager } from '../features/tasks/TaskManager';
export function TasksPage() {
  const { filter, query, resetSearch } = useWorkspace();
  return (
    <PageScaffold>
      <div className="content-panel">
        <TaskManager scope={filter} search={query} onReset={resetSearch} />
      </div>
    </PageScaffold>
  );
}
