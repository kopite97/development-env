import { CancelledError, HttpError } from '../../shared/http/client';
import type { PrivateTransport } from '../../shared/http/transport';
import { Query } from '../../shared/http/query';
import { QueryManager } from '../../shared/http/queryManager';
import {
  parseProject,
  parseCreatedProject,
  parseHistoricalCreatedProject,
  parseProjectPage,
  type ApiProject,
  type ProjectPage,
  type ServerProjectId,
} from './apiModel';
import type { CategoryFilter } from './categoryFilter';
import { parseCategoryCounts } from './categoryCounts';
export type ProjectFilter = {
  category: CategoryFilter;
  status: 'active' | 'archived' | 'all';
  query: string;
};
export const PROJECT_QUERY_POLICY = {
  freshForMs: 30_000,
  gcAfterMs: 5 * 60_000,
  revalidateOnFocus: true,
} as const;
export type ProjectList = ProjectPage & { cursors: string[] };
export class ProjectCreatedError extends Error {
  constructor(readonly id: ServerProjectId) {
    super('프로젝트 생성은 완료되었습니다. 최신 내용을 다시 불러와 주세요.');
  }
}
export class ProjectStore {
  readonly counts: Query<ReturnType<typeof parseCategoryCounts>>;
  readonly entities = new Map<ServerProjectId, ApiProject>();
  private lists = new Map<string, Query<ProjectList>>();
  private details = new Map<ServerProjectId, Query<ApiProject>>();
  private readonly queryManager: QueryManager;
  private readonly ownsQueryManager: boolean;
  private scrollPositions = new Map<string, number>();
  private epoch = 0;
  private pending = new Set<string>();
  private lifetime = new AbortController();
  onInvalidate = () => {};
  constructor(
    readonly transport: PrivateTransport,
    queryManager?: QueryManager,
  ) {
    this.queryManager = queryManager ?? new QueryManager();
    this.ownsQueryManager = !queryManager;
    this.counts = new Query((signal) =>
      transport.request('/api/v2/projects/category-counts', {
        signal,
        generation: transport.generation,
        expectedStatus: 200,
        parse: parseCategoryCounts,
      }),
    );
    transport.lifecycle.signal.addEventListener('abort', () => this.dispose(), { once: true });
  }
  adopt(project: ApiProject) {
    const previous = this.entities.get(project.id);
    const result = previous && previous.revision > project.revision ? previous : project;
    this.entities.set(project.id, result);
    return result;
  }
  private async page(
    filter: ProjectFilter,
    signal: AbortSignal,
    cursor?: string,
  ): Promise<ProjectPage> {
    const epoch = this.epoch;
    const params = new URLSearchParams({ ...filter, limit: '20' });
    if (cursor) params.set('cursor', cursor);
    const page = await this.transport.request('/api/v2/projects?' + params, {
      signal,
      generation: this.transport.generation,
      expectedStatus: 200,
      parse: parseProjectPage,
    });
    this.transport.lifecycle.assert(this.transport.generation);
    if (epoch !== this.epoch || signal.aborted) throw new CancelledError();
    return { ...page, items: page.items.map((item) => this.adopt(item)) };
  }
  filterKey(filter: ProjectFilter) {
    return JSON.stringify([filter.category, filter.status, filter.query, 20]);
  }

  rememberScroll(filter: ProjectFilter, position: number) {
    if (Number.isFinite(position) && position >= 0)
      this.scrollPositions.set(this.filterKey(filter), position);
  }

  clearScrollPosition(filter: ProjectFilter) {
    this.scrollPositions.delete(this.filterKey(filter));
  }

  scrollPosition(filter: ProjectFilter) {
    return this.scrollPositions.get(this.filterKey(filter));
  }

  private clearScroll() {
    this.scrollPositions.clear();
  }

  private pruneEntities() {
    const retained = new Set<ServerProjectId>();
    for (const query of [...this.lists.values(), ...this.details.values()]) {
      const data = query.getSnapshot().data;
      if (!data) continue;
      if ('items' in data) for (const item of data.items) retained.add(item.id);
      else retained.add(data.id);
    }
    for (const id of this.entities.keys()) if (!retained.has(id)) this.entities.delete(id);
  }

  private queryDefinition<T>(
    key: string,
    contract: string,
    fetcher: (signal: AbortSignal) => Promise<T>,
    onRefresh?: (reason: 'expired' | 'forced' | 'initial') => void,
    onEvict?: () => void,
  ) {
    return {
      key,
      contract,
      policy: PROJECT_QUERY_POLICY,
      fetcher,
      onRefresh,
      onEvict: () => {
        onEvict?.();
        this.pruneEntities();
      },
    };
  }
  list(filter: ProjectFilter) {
    const key = this.filterKey(filter);
    let query = this.lists.get(key);
    if (!query) {
      const created = this.queryManager.get<ProjectList>(
        this.queryDefinition(
          'projects:list:' + key,
          'project-list-v2',
          async (signal) => ({
            ...(await this.page(filter, signal)),
            cursors: [],
          }),
          (reason) => {
            if (reason !== 'initial') this.scrollPositions.delete(key);
          },
          () => this.scrollPositions.delete(key),
        ),
      );
      query = created;
      this.lists.set(key, query);
    }
    return query;
  }
  more(filter: ProjectFilter) {
    const query = this.list(filter),
      previous = query.getSnapshot().data;
    if (!previous?.nextCursor || query.getSnapshot().status === 'loading') return Promise.resolve();
    const cursor = previous.nextCursor;
    return query.load(
      async (signal) => {
        const next = await this.page(filter, signal, cursor);
        const cursors = [...previous.cursors, cursor];
        if (next.nextCursor && cursors.includes(next.nextCursor))
          throw new Error('The server repeated a cursor. Restart the list.');
        const items = new Map(previous.items.map((item) => [item.id, item]));
        for (const item of next.items) items.set(item.id, item);
        return { ...next, items: [...items.values()], cursors };
      },
      { force: true, reason: 'page' },
    );
  }
  detail(id: ServerProjectId) {
    let query = this.details.get(id);
    if (!query) {
      const created = this.queryManager.get<ApiProject>(
        this.queryDefinition('projects:detail:' + id, 'project-detail-v2', async (signal) => {
          const epoch = this.epoch;
          const project = await this.transport.request('/api/v2/projects/' + id, {
            signal,
            generation: this.transport.generation,
            expectedStatus: 200,
            parse: parseProject,
          });
          this.transport.lifecycle.assert(this.transport.generation);
          if (epoch !== this.epoch || signal.aborted) throw new CancelledError();
          if (project.id !== id) throw new Error('Project identity mismatch');
          return this.adopt(project);
        }),
      );
      query = created;
      this.details.set(id, query);
      const cached = this.entities.get(id);
      if (cached) query.seed(cached);
    }
    return query;
  }
  invalidate(notify = true) {
    this.clearScroll();
    this.counts.invalidate();
    this.epoch++;
    for (const query of this.lists.values()) query.invalidate(true);
    for (const query of this.details.values()) query.invalidate();
    if (notify) this.onInvalidate();
  }
  async mutate(
    target: ServerProjectId | undefined,
    body: unknown,
    key?: string,
    endpoint: '/api/v1/projects' | '/api/v2/projects' = '/api/v2/projects',
  ) {
    const operation = target ?? 'create';
    if (this.pending.has(operation)) throw new Error('A Project operation is already pending.');
    this.pending.add(operation);
    try {
      const project = await this.transport.request(
        (target ? '/api/v2/projects' : endpoint) + (target ? '/' + target : ''),
        {
          method: target ? 'PATCH' : 'POST',
          json: body,
          headers: key ? { 'Idempotency-Key': key } : undefined,
          generation: this.transport.generation,
          signal: this.lifetime.signal,
          expectedStatus: target ? 200 : 201,
          parse: target
            ? parseProject
            : endpoint === '/api/v1/projects'
              ? parseHistoricalCreatedProject
              : parseCreatedProject,
        },
      );
      this.transport.lifecycle.assert(this.transport.generation);
      if (target && project.id !== target)
        throw new HttpError(200, 'PROTOCOL_ERROR', 'Project identity mismatch');
      this.invalidate();
      if (!target) {
        const query = this.detail(project.id);
        await query.load();
        this.transport.lifecycle.assert(this.transport.generation);
        const state = query.getSnapshot();
        if (state.status !== 'ready' || !state.data) throw new ProjectCreatedError(project.id);
        return state.data;
      }
      const saved = this.adopt(parseProject(project));
      this.detail(saved.id).seed(saved);
      return saved;
    } catch (error) {
      if (this.transport.generation !== this.transport.lifecycle.generation)
        throw new CancelledError();
      if (
        error instanceof HttpError &&
        (error.code === 'REVISION_CONFLICT' ||
          error.status === 0 ||
          error.status >= 500 ||
          error.code === 'PROTOCOL_ERROR')
      )
        this.invalidate();
      throw error;
    } finally {
      this.pending.delete(operation);
    }
  }
  dispose() {
    this.counts.cancel();
    this.lifetime.abort();
    this.epoch++;
    for (const query of [...this.lists.values(), ...this.details.values()]) query.cancel();
    this.entities.clear();
    this.scrollPositions.clear();
    this.lists.clear();
    this.details.clear();
    if (this.ownsQueryManager) this.queryManager.dispose();
  }
}
