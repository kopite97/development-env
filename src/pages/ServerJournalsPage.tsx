import type { Scope } from '../features/projects/scope';
import type { JournalStore } from '../features/journal/apiStore';
import type { JournalMemory } from '../features/journal/draftMemory';
import type { JournalProjectOptions } from '../features/journal/projectOptions';
import { ApiJournalWorkspace } from '../features/journal/ApiJournalWorkspace';

export function ServerJournalsPage({
  store,
  options,
  memory,
  url,
  onFilterNavigate,
}: {
  store: JournalStore;
  options: JournalProjectOptions;
  memory: JournalMemory;
  url: URL;
  onFilterNavigate: (path: string) => void;
}) {
  const scope: Scope =
    url.searchParams.get('scope') === 'unity'
      ? 'unity'
      : url.searchParams.get('scope') === 'server'
        ? 'server'
        : 'all';
  const query = url.searchParams.get('q') ?? '';
  return (
    <ApiJournalWorkspace
      key={url.pathname + url.search}
      store={store}
      options={options}
      memory={memory}
      scope={scope}
      queryText={query}
      onFilterNavigate={(nextScope, nextQuery) => {
        const params = new URLSearchParams();
        if (nextScope !== 'all') params.set('scope', nextScope);
        if (nextQuery) params.set('q', nextQuery);
        onFilterNavigate('/journals' + (params.size ? '?' + params : ''));
      }}
    />
  );
}
