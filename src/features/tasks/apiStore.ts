import { CancelledError, HttpError } from '../../shared/http/client';
import { Query } from '../../shared/http/query';
import type { PrivateTransport } from '../../shared/http/transport';
import { uuid } from '../../shared/http/validation';
import {
  parseTask,
  parseTaskPage,
  parseTaskStats,
  type ApiTask,
  type TaskPage,
  type TaskStats,
} from './apiModel';
import type { TaskStatus } from './presentation';

export type TaskFilter = {
  scope: 'all' | 'unity' | 'server';
  projectId?: string;
  projectStatus: 'all' | 'active' | 'archived';
  query: string;
};
export type TaskListFilter = TaskFilter & { status?: TaskStatus; deleted: boolean; limit: number };
export type TaskList = TaskPage & { cursors: string[] };
export function taskParams(filter: TaskFilter | TaskListFilter) {
  const params = new URLSearchParams({
    scope: filter.scope,
    projectStatus: filter.projectStatus,
    query: filter.query,
  });
  if (filter.projectId) params.set('projectId', uuid(filter.projectId));
  if ('deleted' in filter) {
    if (!Number.isInteger(filter.limit) || filter.limit < 1 || filter.limit > 100)
      throw new Error('Invalid Task limit');
    params.set('deleted', String(filter.deleted));
    params.set('limit', String(filter.limit));
    if (filter.status) params.set('status', filter.status);
  }
  return params;
}
export class TaskStore {
  readonly entities = new Map<string, ApiTask>();
  private lists = new Map<string, Query<TaskList>>();
  private details = new Map<string, Query<ApiTask>>();
  private statistics = new Map<string, Query<TaskStats>>();
  private epoch = 0;
  private readSequence = 0;
  private entityOrder = new Map<string, number>();
  private disposed = false;
  private lifetime = new AbortController();
  private pending = new Set<string>();
  onInvalidate = () => {};
  constructor(readonly transport: PrivateTransport) {
    transport.lifecycle.signal.addEventListener('abort', () => this.dispose(), { once: true });
  }
  private prune() {
    const trim = <T>(map: Map<string, Query<T>>) => {
      const inactive = [...map.entries()].filter(([, query]) => !query.observed);
      for (const [key, query] of inactive.slice(0, Math.max(0, inactive.length - 32))) {
        query.cancel();
        map.delete(key);
      }
    };
    trim(this.lists);
    trim(this.details);
    trim(this.statistics);
    const retained = new Set([...this.details.keys(), ...this.pending]);
    for (const query of this.lists.values())
      for (const task of query.getSnapshot().data?.items ?? []) retained.add(task.id);
    for (const id of this.entities.keys())
      if (!retained.has(id)) {
        this.entities.delete(id);
        this.entityOrder.delete(id);
      }
  }
  private assert(epoch: number, signal: AbortSignal) {
    this.transport.lifecycle.assert(this.transport.generation);
    if (this.disposed || signal.aborted || epoch !== this.epoch) throw new CancelledError();
  }
  /** Equal revisions may contain newer derived Project names/scope. */
  adopt(task: ApiTask, order: number) {
    const previous = this.entities.get(task.id);
    if (
      previous &&
      (previous.revision > task.revision ||
        (previous.revision === task.revision && (this.entityOrder.get(task.id) ?? 0) > order))
    )
      return previous;
    this.entities.set(task.id, task);
    this.entityOrder.set(task.id, order);
    return task;
  }
  private async page(
    filter: TaskListFilter,
    signal: AbortSignal,
    cursor?: string,
  ): Promise<TaskPage> {
    const epoch = this.epoch,
      order = ++this.readSequence;
    const params = taskParams(filter);
    if (cursor) params.set('cursor', cursor);
    const page = await this.transport.request('/api/v1/tasks?' + params, {
      signal,
      generation: this.transport.generation,
      expectedStatus: 200,
      parse: parseTaskPage,
    });
    this.assert(epoch, signal);
    return { ...page, items: page.items.map((task) => this.adopt(task, order)) };
  }
  list(filter: TaskListFilter) {
    this.prune();
    const key = taskParams(filter).toString();
    let query = this.lists.get(key);
    if (!query) {
      const captured = { ...filter };
      query = new Query<TaskList>(async (signal) => ({
        ...(await this.page(captured, signal)),
        cursors: [],
      }));
      this.lists.set(key, query);
    }
    return query;
  }
  more(filter: TaskListFilter) {
    const query = this.list(filter),
      previous = query.getSnapshot().data;
    if (!previous?.nextCursor || query.getSnapshot().status === 'loading') return Promise.resolve();
    const cursor = previous.nextCursor;
    return query.load(async (signal) => {
      const next = await this.page(filter, signal, cursor);
      const cursors = [...previous.cursors, cursor];
      if (next.nextCursor && cursors.includes(next.nextCursor))
        throw new Error('서버가 같은 커서를 반환했습니다. 목록을 새로고침해 주세요.');
      const items = new Map(
        previous.items.map((task) => [task.id, this.entities.get(task.id) ?? task]),
      );
      for (const task of next.items) items.set(task.id, task);
      return { ...next, items: [...items.values()], cursors };
    });
  }
  detail(id: string) {
    this.prune();
    uuid(id);
    let query = this.details.get(id);
    if (!query) {
      query = new Query<ApiTask>(async (signal) => {
        const epoch = this.epoch,
          order = ++this.readSequence;
        const task = await this.transport.request('/api/v1/tasks/' + id, {
          signal,
          generation: this.transport.generation,
          expectedStatus: 200,
          parse: parseTask,
        });
        this.assert(epoch, signal);
        if (task.id !== id) throw new Error('Task identity mismatch');
        return this.adopt(task, order);
      });
      this.details.set(id, query);
    }
    return query;
  }
  stats(filter: TaskFilter) {
    this.prune();
    // Deliberately serialize only stats-supported parameters, even if passed a list filter.
    const captured = {
      scope: filter.scope,
      projectId: filter.projectId,
      projectStatus: filter.projectStatus,
      query: filter.query,
    };
    const key = taskParams(captured).toString();
    let query = this.statistics.get(key);
    if (!query) {
      query = new Query<TaskStats>(async (signal) => {
        const epoch = this.epoch;
        const result = await this.transport.request('/api/v1/tasks/stats?' + key, {
          signal,
          generation: this.transport.generation,
          expectedStatus: 200,
          parse: parseTaskStats,
        });
        this.assert(epoch, signal);
        return result;
      });
      this.statistics.set(key, query);
    }
    return query;
  }
  invalidate() {
    this.epoch++;
    for (const query of this.lists.values()) query.invalidate(true);
    for (const query of this.details.values()) query.invalidate();
    for (const query of this.statistics.values()) query.invalidate();
    this.onInvalidate();
  }
  async mutate(
    operation: 'create' | 'patch' | 'delete' | 'restore',
    options: { id?: string; body?: unknown; revision?: number; key?: string },
  ) {
    const target = options.id ?? 'create';
    if (this.pending.has(target)) throw new Error('Task operation already pending');
    if (operation !== 'create') uuid(options.id);
    this.pending.add(target);
    try {
      let path = '/api/v1/tasks' + (options.id ? '/' + options.id : '');
      if (operation === 'delete') path += '?revision=' + options.revision;
      if (operation === 'restore') path += '/restore';
      const task = await this.transport.request(path, {
        method: operation === 'delete' ? 'DELETE' : operation === 'patch' ? 'PATCH' : 'POST',
        json: operation === 'delete' ? undefined : options.body,
        headers: operation === 'create' ? { 'Idempotency-Key': options.key ?? '' } : undefined,
        generation: this.transport.generation,
        signal: this.lifetime.signal,
        expectedStatus: operation === 'create' ? 201 : 200,
        parse: parseTask,
      });
      this.transport.lifecycle.assert(this.transport.generation);
      if (this.disposed) throw new CancelledError();
      if (options.id && options.id !== task.id)
        throw new HttpError(200, 'PROTOCOL_ERROR', 'Task identity mismatch');
      this.invalidate();
      // POST can be an old snapshot. Reconcile before presenting its entity.
      if (operation === 'create') {
        const detail = this.detail(task.id);
        detail.invalidate();
        await detail.load();
        this.transport.lifecycle.assert(this.transport.generation);
        if (this.disposed) throw new CancelledError();
        return {
          task: detail.getSnapshot().data ?? task,
          reconciled: detail.getSnapshot().status === 'ready',
        };
      }
      const saved = this.adopt(task, ++this.readSequence);
      this.detail(saved.id).seed(saved);
      return { task: saved, reconciled: true };
    } catch (error) {
      if (this.disposed || this.transport.generation !== this.transport.lifecycle.generation)
        throw new CancelledError();
      if (
        error instanceof HttpError &&
        (error.status === 409 ||
          error.status === 0 ||
          error.status >= 500 ||
          error.code === 'PROTOCOL_ERROR')
      )
        this.invalidate();
      throw error;
    } finally {
      this.pending.delete(target);
    }
  }
  dispose() {
    this.lifetime.abort();
    this.disposed = true;
    this.epoch++;
    for (const query of [
      ...this.lists.values(),
      ...this.details.values(),
      ...this.statistics.values(),
    ])
      query.cancel();
    this.entities.clear();
    this.entityOrder.clear();
    this.lists.clear();
    this.details.clear();
    this.statistics.clear();
  }
}
