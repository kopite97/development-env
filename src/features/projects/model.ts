import { projects as demoProjects } from './fixtures';
import { type Scope } from './scope';
export type Project = {
  id: string;
  name: string;
  subtitle: string;
  scope: Exclude<Scope, 'all'>;
  stack: string;
  progress: number;
  color: string;
  milestone: string;
  repositoryUrl: string;
  archived: boolean;
};
// Old task records identify seeded projects by their original names.
export function legacyProjectId(name: string) {
  return demoProjects.find((project) => project.name === name)?.id;
}
export function isProjects(value: unknown): value is Project[] {
  return (
    Array.isArray(value) &&
    value.every(
      (p) =>
        p &&
        typeof p.id === 'string' &&
        !!p.id &&
        typeof p.name === 'string' &&
        !!p.name.trim() &&
        typeof p.subtitle === 'string' &&
        ['unity', 'server'].includes(p.scope) &&
        typeof p.stack === 'string' &&
        Number.isFinite(p.progress) &&
        p.progress >= 0 &&
        p.progress <= 100 &&
        typeof p.color === 'string' &&
        typeof p.milestone === 'string' &&
        typeof p.repositoryUrl === 'string' &&
        typeof p.archived === 'boolean',
    ) &&
    new Set(value.map((p) => p.id)).size === value.length
  );
}
