import type { ProjectStore } from '../../features/projects/apiStore';
import { serverProjectId } from '../../features/projects/apiModel';
import type { TaskProjectOptions } from '../../features/tasks/projectOptions';
import { Query } from '../../shared/http/query';
import type { TaskProjectOption } from '../../features/tasks/presentation';

export function taskProjectOptions(
  projects: ProjectStore,
): TaskProjectOptions & { invalidate: () => void; dispose: () => void } {
  const filter = { category: 'all', status: 'active', query: '' } as const;
  const source = projects.list(filter);
  const map = (p: { id: string; name: string; status: string }): TaskProjectOption => ({
    id: p.id,
    name: p.name,
    archived: p.status === 'archived',
  });
  const read = () => {
    const state = source.getSnapshot();
    if (state.status !== 'ready' || !state.data)
      throw state.error ?? new Error('Project options unavailable');
    return { items: state.data.items.map(map), nextCursor: state.data.nextCursor };
  };
  const list = new Query(async () => {
    await source.load();
    return read();
  });
  const details = new Map<string, Query<TaskProjectOption>>();
  return {
    list,
    more: () =>
      list.load(async () => {
        await projects.more(filter);
        return read();
      }),
    detail: (id) => {
      let query = details.get(id);
      if (!query) {
        query = new Query(async () => {
          const source = projects.detail(serverProjectId(id));
          await source.load();
          const state = source.getSnapshot();
          if (state.status !== 'ready' || !state.data)
            throw state.error ?? new Error('Project detail unavailable');
          return map(state.data);
        });
        details.set(id, query);
      }
      return query;
    },
    invalidate: () => {
      list.invalidate(true);
      for (const query of details.values()) query.invalidate(true);
    },
    dispose: () => {
      list.cancel();
      for (const query of details.values()) query.cancel();
      details.clear();
    },
  };
}
