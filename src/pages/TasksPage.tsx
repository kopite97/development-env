import { useWorkspace } from '../app/WorkspaceProvider';
import { PageScaffold } from '../layouts/PageScaffold';
import { TaskManager } from '../features/tasks/TaskManager';
export function TasksPage() {
  const { filter, query } = useWorkspace();
  return (
    <PageScaffold>
      <div className="content-panel">
        <TaskManager scope={filter} search={query} />
      </div>
    </PageScaffold>
  );
}
