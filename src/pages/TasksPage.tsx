import { useWorkspace } from '../app/WorkspaceProvider';
import { PageScaffold } from '../layouts/PageScaffold';
import { TaskBoard } from '../features/tasks/TaskBoard';
import { useTasks } from '../features/tasks/TasksProvider';
export function TasksPage() {
  const { filter, query } = useWorkspace();
  const { tasks, changeStatus } = useTasks();
  return (
    <PageScaffold>
      <div className="content-panel">
        <TaskBoard
          scope={filter}
          tasks={tasks.filter((t) =>
            `${t.title} ${t.project}`.toLowerCase().includes(query.toLowerCase()),
          )}
          onTaskChange={changeStatus}
        />
      </div>
    </PageScaffold>
  );
}
