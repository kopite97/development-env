import { describe, it, expect } from 'vitest';
import { initialTasks } from '../../data/demo';
import { initialProjects } from '../projects/model';
import { resolveTask, validTasks } from './model';
describe('legacy task compatibility', () => {
  it('preserves existing tasks while resolving renamed projects by original id', () => {
    const renamed = initialProjects.map((p) =>
      p.id === 'forest' ? { ...p, name: 'Renamed', scope: 'server' as const } : p,
    );
    const result = resolveTask(initialTasks[0], renamed);
    expect(result.projectId).toBe('forest');
    expect(result.project).toBe('Renamed');
    expect(result.scope).toBe('server');
    expect(result.status).toBe(initialTasks[0].status);
  });
  it('keeps unknown legacy references rather than discarding user data', () => {
    const task = { ...initialTasks[0], project: 'Unknown' };
    expect(resolveTask(task, initialProjects).project).toBe('Unknown');
    expect(validTasks([task])).toBe(true);
  });
  it('accepts legacy and trashed records but rejects corrupt optional fields', () => {
    expect(validTasks(initialTasks)).toBe(true);
    expect(validTasks([{ ...initialTasks[0], deletedAt: new Date().toISOString() }])).toBe(true);
    expect(validTasks([{ ...initialTasks[0], deletedAt: 42 }])).toBe(false);
  });
});
