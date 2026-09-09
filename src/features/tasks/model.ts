import { projects as demoProjects, type Task } from '../../data/demo';
import type { Project } from '../projects/model';
export const validTasks = (v: unknown): v is Task[] =>
  Array.isArray(v) &&
  v.every(
    (t) =>
      t &&
      typeof t.id === 'string' &&
      typeof t.title === 'string' &&
      typeof t.project === 'string' &&
      ['unity', 'server'].includes(t.scope) &&
      ['todo', 'doing', 'done'].includes(t.status) &&
      ['높음', '보통'].includes(t.priority) &&
      typeof t.tag === 'string' &&
      (t.projectId === undefined || typeof t.projectId === 'string') &&
      (t.description === undefined || typeof t.description === 'string') &&
      (t.deletedAt === undefined ||
        t.deletedAt === null ||
        (typeof t.deletedAt === 'string' && Number.isFinite(Date.parse(t.deletedAt)))),
  ) &&
  new Set(v.map((t) => t.id)).size === v.length;
export function resolveTask(task: Task, projects: Project[]): Task {
  const projectId =
    task.projectId ??
    demoProjects.find((p) => p.name === task.project)?.id ??
    projects.find((p) => p.name === task.project)?.id;
  const project = projects.find((p) => p.id === projectId);
  return {
    ...task,
    projectId,
    project: project?.name ?? task.project,
    scope: project?.scope ?? task.scope,
  };
}
