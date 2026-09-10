import {
  ProjectsWorkspace,
  type ProjectsWorkspaceProps,
} from '../features/projects/ProjectsWorkspace';
import { useTasks } from '../features/tasks/TasksProvider';

export function ProjectsPage(props: Omit<ProjectsWorkspaceProps, 'tasks'>) {
  const { tasks } = useTasks();
  return <ProjectsWorkspace {...props} tasks={tasks} />;
}
