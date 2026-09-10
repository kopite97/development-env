export type JournalEntry = {
  id: string;
  title: string;
  projectId: string;
  project: string;
  scope: 'unity' | 'server';
  body: string;
  createdAt: string;
};
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

export function localDate(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function selectJournals(
  entries: JournalEntry[],
  options: {
    scope: 'all' | 'unity' | 'server';
    query: string;
    projectId: string;
    from: string;
    to: string;
    order: string;
  },
) {
  return entries
    .filter((entry) => {
      const day = localDate(entry.createdAt);
      return (
        (options.scope === 'all' || entry.scope === options.scope) &&
        (!options.projectId || entry.projectId === options.projectId) &&
        (!options.from || day >= options.from) &&
        (!options.to || day <= options.to) &&
        `${entry.title} ${entry.project} ${entry.body}`
          .toLowerCase()
          .includes(options.query.toLowerCase())
      );
    })
    .sort(
      (a, b) =>
        (Date.parse(b.createdAt) - Date.parse(a.createdAt)) * (options.order === 'oldest' ? -1 : 1),
    );
}
