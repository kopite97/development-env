import { useWorkspace } from '../app/WorkspaceProvider';
import { PageScaffold } from '../layouts/PageScaffold';
import { ProjectOverview } from '../features/projects/ProjectOverview';
import { useTasks } from '../features/tasks/TasksProvider';
export function ProjectsPage() {
  const { filter, query, onDetail } = useWorkspace();
  const { tasks } = useTasks();
  return (
    <PageScaffold>
      <div className="content-panel">
        <ProjectOverview scope={filter} search={query} tasks={tasks} onDetail={onDetail} />
      </div>
    </PageScaffold>
  );
}
