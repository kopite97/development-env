import { describe, expect, it } from 'vitest';
import { parseOverview } from './apiModel';
describe('Overview boundary', () => {
  const counts = { total: 0, archived: 1 };
  const overview = {
    category: 'all',
    projectId: null,
    projects: { ...counts, byCategory: [{ categoryId: null, ...counts }] },
    tasks: { todo: 1, doing: 0, done: 0, total: 1 },
    asOf: '2026-09-13T01:00:00Z',
  };
  it('keeps active/archived and task counts independent', () => {
    expect(parseOverview(overview, { category: 'all' }).tasks.total).toBe(1);
  });
  it('requires complete zero buckets and matching filters', () => {
    expect(() =>
      parseOverview({ ...overview, tasks: { total: 0 } }, { category: 'all' }),
    ).toThrow();
    expect(() => parseOverview(overview, { category: 'uncategorized' })).toThrow();
  });
});
