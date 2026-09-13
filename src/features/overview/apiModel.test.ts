import { describe, expect, it } from 'vitest';
import { parseOverview } from './apiModel';
describe('Overview boundary', () => {
  const counts = { total: 0, archived: 1 };
  const overview = {
    scope: 'all',
    projectId: null,
    projects: { ...counts, byScope: { unity: counts, server: { total: 0, archived: 0 } } },
    tasks: { todo: 1, doing: 0, done: 0, total: 1 },
    asOf: '2026-09-13T01:00:00Z',
  };
  it('keeps active/archived and task counts independent', () => {
    expect(parseOverview(overview, { scope: 'all' }).tasks.total).toBe(1);
  });
  it('requires complete zero buckets and matching filters', () => {
    expect(() => parseOverview({ ...overview, tasks: { total: 0 } }, { scope: 'all' })).toThrow();
    expect(() => parseOverview(overview, { scope: 'server' })).toThrow();
  });
});
