import { journal, projects } from '../../data/demo';
export type JournalEntry = {
  id: string;
  title: string;
  projectId: string;
  project: string;
  scope: 'unity' | 'server';
  body: string;
  createdAt: string;
};
export const initialJournals: JournalEntry[] = journal.map((entry, index) => ({
  ...entry,
  id: `demo-journal-${index}`,
  projectId: projects.find((p) => p.name === entry.project)!.id,
  scope: entry.scope as JournalEntry['scope'],
  createdAt: `2026-${entry.date.replace('.', '-')}T00:00:00Z`,
}));
export function isJournals(value: unknown): value is JournalEntry[] {
  return (
    Array.isArray(value) &&
    value.every(
      (j) =>
        j &&
        typeof j.id === 'string' &&
        typeof j.title === 'string' &&
        typeof j.body === 'string' &&
        typeof j.projectId === 'string' &&
        typeof j.project === 'string' &&
        ['unity', 'server'].includes(j.scope) &&
        typeof j.createdAt === 'string' &&
        Number.isFinite(Date.parse(j.createdAt)),
    ) &&
    new Set(value.map((j) => j.id)).size === value.length
  );
}
export const journalDate = (entry: JournalEntry) =>
  new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(entry.createdAt),
  );
