import { describe, expect, it } from 'vitest';
import { isJournals, localDate, selectJournals, type JournalEntry } from './model';

const entries: JournalEntry[] = [1, 2, 3].map((day) => ({
  id: String(day),
  title: `일지 ${day}`,
  body: '본문 검색',
  projectId: day === 3 ? 'b' : 'a',
  project: '프로젝트',
  scope: 'unity',
  createdAt: new Date(2026, 8, day, 23, 59).toISOString(),
}));
const options = {
  scope: 'all' as const,
  query: '',
  projectId: '',
  from: '',
  to: '',
  order: 'newest',
};
describe('journal queries', () => {
  it('combines inclusive local dates, project, scope and body search', () => {
    expect(localDate(entries[0].createdAt)).toBe('2026-09-01');
    expect(
      selectJournals(entries, {
        ...options,
        from: '2026-09-01',
        to: '2026-09-02',
        projectId: 'a',
        query: '본문',
      }).map((j) => j.id),
    ).toEqual(['2', '1']);
    expect(selectJournals(entries, { ...options, scope: 'server' })).toEqual([]);
    expect(selectJournals(entries, { ...options, from: '2026-09-03', to: '2026-09-01' })).toEqual(
      [],
    );
  });
  it('sorts without mutating stored entries and accepts empty saved journals', () => {
    expect(selectJournals(entries, options).map((j) => j.id)).toEqual(['3', '2', '1']);
    expect(selectJournals(entries, { ...options, order: 'oldest' }).map((j) => j.id)).toEqual([
      '1',
      '2',
      '3',
    ]);
    expect(entries[0].id).toBe('1');
    expect(isJournals([])).toBe(true);
  });
});
