import { Query } from '../../shared/http/query';
import { serverProjectId } from '../../features/projects/apiModel';
import type { ProjectStore } from '../../features/projects/apiStore';
import type { JournalProjectOption } from '../../features/journal/apiModel';
import type {
  JournalProjectOptions,
  JournalProjectOptionsPage,
} from '../../features/journal/projectOptions';

function option(project: { id: string; name: string; scope: 'unity' | 'server'; status: string }) {
  return {
    id: project.id,
    name: project.name,
    scope: project.scope,
    archived: project.status === 'archived',
  } satisfies JournalProjectOption;
}

export function journalProjectOptions(projects: ProjectStore): JournalProjectOptions {
  const allFilter = { scope: 'all', status: 'all', query: '' } as const;
  const activeFilter = { scope: 'all', status: 'active', query: '' } as const;
  const allSource = projects.list(allFilter);
  const activeSource = projects.list(activeFilter);
  const read = (source: typeof allSource): JournalProjectOptionsPage => {
    const state = source.getSnapshot();
    if (state.status !== 'ready' || !state.data)
      throw state.error ?? new Error('Project options unavailable');
    return { items: state.data.items.map(option), nextCursor: state.data.nextCursor };
  };
  const list = new Query(async () => {
    await allSource.load();
    return read(allSource);
  });
  const activeList = new Query(async () => {
    await activeSource.load();
    return read(activeSource);
  });
  const details = new Map<string, Query<JournalProjectOption>>();
  const more = (source: typeof allSource, target: Query<JournalProjectOptionsPage>) =>
    target.load(async () => {
      await projects.more(source === allSource ? allFilter : activeFilter);
      return read(source);
    });
  return {
    list,
    more: () => more(allSource, list),
    activeList,
    moreActive: () => more(activeSource, activeList),
    detail: (id) => {
      let query = details.get(id);
      if (!query) {
        query = new Query(async () => {
          const source = projects.detail(serverProjectId(id));
          await source.load();
          const state = source.getSnapshot();
          if (state.status !== 'ready' || !state.data)
            throw state.error ?? new Error('Project detail unavailable');
          return option(state.data);
        });
        details.set(id, query);
      }
      return query;
    },
    invalidate: () => {
      list.invalidate(true);
      activeList.invalidate(true);
      for (const query of details.values()) query.invalidate(true);
    },
    dispose: () => {
      list.cancel();
      activeList.cancel();
      for (const query of details.values()) query.cancel();
      details.clear();
    },
  };
}
