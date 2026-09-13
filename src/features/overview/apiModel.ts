import { count, object, oneOf, timestamp, uuid } from '../../shared/http/validation';
export type OverviewFilter = { scope: 'all' | 'unity' | 'server'; projectId?: string };
const projectCounts = (value: unknown) => {
  const row = object(value);
  return { total: count(row.total), archived: count(row.archived) };
};
export function parseOverview(value: unknown, filter: OverviewFilter) {
  const row = object(value),
    projects = object(row.projects),
    byScope = object(projects.byScope),
    tasks = object(row.tasks);
  const scope = oneOf(row.scope, ['all', 'unity', 'server']);
  const projectId = row.projectId === null ? null : uuid(row.projectId);
  if (scope !== filter.scope || projectId !== (filter.projectId ?? null))
    throw new Error('Overview filter mismatch');
  return {
    scope,
    projectId,
    projects: {
      ...projectCounts(projects),
      byScope: { unity: projectCounts(byScope.unity), server: projectCounts(byScope.server) },
    },
    tasks: {
      todo: count(tasks.todo),
      doing: count(tasks.doing),
      done: count(tasks.done),
      total: count(tasks.total),
    },
    asOf: timestamp(row.asOf),
  };
}
export type Overview = ReturnType<typeof parseOverview>;
