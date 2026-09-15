import { CancelledError, HttpError } from '../../shared/http/client';
import type { PrivateTransport } from '../../shared/http/transport';
import { Query } from '../../shared/http/query';
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
  private epoch = 0;
  private pending = new Set<string>();
  private lifetime = new AbortController();
  onInvalidate = () => {};
  constructor(readonly transport: PrivateTransport) {
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
  list(filter: ProjectFilter) {
    const key = JSON.stringify([filter.category, filter.status, filter.query, 20]);
    let query = this.lists.get(key);
    if (!query) {
      query = new Query<ProjectList>(async (signal) => ({
        ...(await this.page(filter, signal)),
        cursors: [],
      }));
      this.lists.set(key, query);
    }
    return query;
  }
  more(filter: ProjectFilter) {
    const query = this.list(filter),
      previous = query.getSnapshot().data;
    if (!previous?.nextCursor || query.getSnapshot().status === 'loading') return Promise.resolve();
    const cursor = previous.nextCursor;
    return query.load(async (signal) => {
      const next = await this.page(filter, signal, cursor);
      const cursors = [...previous.cursors, cursor];
      if (next.nextCursor && cursors.includes(next.nextCursor))
        throw new Error('The server repeated a cursor. Restart the list.');
      const items = new Map(previous.items.map((item) => [item.id, item]));
      for (const item of next.items) items.set(item.id, item);
      return { ...next, items: [...items.values()], cursors };
    });
  }
  detail(id: ServerProjectId) {
    let query = this.details.get(id);
    if (!query) {
      query = new Query<ApiProject>(async (signal) => {
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
      });
      this.details.set(id, query);
      const cached = this.entities.get(id);
      if (cached) query.seed(cached);
    }
    return query;
  }
  invalidate(notify = true) {
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
    this.lists.clear();
    this.details.clear();
  }
}
