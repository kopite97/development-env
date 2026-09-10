import type { Project } from '../projects/model';

export type Milestone = {
  id: string;
  projectId: string;
  title: string;
  dueDate: string;
  completed: boolean;
};

export function isDueDate(value: unknown): value is string {
  if (value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function isMilestones(value: unknown): value is Milestone[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item.id === 'string' &&
        item.id.length > 0 &&
        typeof item.projectId === 'string' &&
        item.projectId.length > 0 &&
        typeof item.title === 'string' &&
        item.title.trim().length > 0 &&
        isDueDate(item.dueDate) &&
        typeof item.completed === 'boolean',
    ) &&
    new Set(value.map((item) => item.id)).size === value.length
  );
}
export function legacyMilestones(projects: Project[]): Milestone[] {
  return projects
    .filter((project) => project.milestone.trim())
    .map((project) => ({
      id: `legacy-${project.id}`,
      projectId: project.id,
      title: project.milestone.trim(),
      dueDate: '',
      completed: false,
    }));
}
export function sortMilestones(items: Milestone[]) {
  return [...items].sort(
    (a, b) =>
      Number(a.completed) - Number(b.completed) ||
      (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99') ||
      a.id.localeCompare(b.id),
  );
}
export function todayDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
