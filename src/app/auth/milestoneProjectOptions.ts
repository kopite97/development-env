import { Query } from '../../shared/http/query';
import { serverProjectId } from '../../features/projects/apiModel';
import type { ProjectStore } from '../../features/projects/apiStore';
import type { MilestoneProjectOption } from '../../features/milestones/apiModel';
import type {
  MilestoneProjectOptions,
  MilestoneProjectOptionsPage,
} from '../../features/milestones/projectOptions';

function option(project: { id: string; name: string; categoryId: string | null; status: string }) {
  return {
    id: project.id,
    name: project.name,
    categoryId: project.categoryId,
    archived: project.status === 'archived',
  } satisfies MilestoneProjectOption;
}

export function milestoneProjectOptions(projects: ProjectStore): MilestoneProjectOptions {
  const allFilter = { category: 'all', status: 'all', query: '' } as const;
  const allSource = projects.list(allFilter);
  const read = (source: typeof allSource): MilestoneProjectOptionsPage => {
    const state = source.getSnapshot();
    if (state.status !== 'ready' || !state.data)
      throw state.error ?? new Error('Project options unavailable');
    return { items: state.data.items.map(option), nextCursor: state.data.nextCursor };
  };
  const list = new Query(async () => {
    await allSource.load();
    return read(allSource);
  });
  const details = new Map<string, Query<MilestoneProjectOption>>();
  const more = (source: typeof allSource, target: Query<MilestoneProjectOptionsPage>) =>
    target.load(async () => {
      await projects.more(allFilter);
      return read(source);
    });
  return {
    list,
    more: () => more(allSource, list),
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
      for (const query of details.values()) query.invalidate(true);
    },
    dispose: () => {
      list.cancel();
      for (const query of details.values()) query.cancel();
      details.clear();
    },
  };
}
