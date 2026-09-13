import { CancelledError, HttpError } from '../../shared/http/client';
import { Query } from '../../shared/http/query';
import type { PrivateTransport } from '../../shared/http/transport';
import { uuid } from '../../shared/http/validation';
import {
  parseDeletedMilestone,
  revision,
  parseMilestone,
  parseMilestonePage,
  type ApiMilestone,
  type MilestonePage,
} from './apiModel';

export type MilestoneFilter = {
  scope: 'unity' | 'server' | 'all';
  projectId?: string;
  projectStatus: 'all' | 'active' | 'archived';
  status: 'open' | 'done' | 'all';
  limit: number;
};
export type MilestoneList = MilestonePage & { cursors: string[] };

export function milestoneParams(filter: MilestoneFilter) {
  if (!Number.isInteger(filter.limit) || filter.limit < 1 || filter.limit > 100)
    throw new Error('Invalid Milestone limit');
  const params = new URLSearchParams({
    scope: filter.scope,
    projectStatus: filter.projectStatus,
    status: filter.status,
    limit: String(filter.limit),
  });
  if (filter.projectId) params.set('projectId', uuid(filter.projectId));
  if (
    !['all', 'unity', 'server'].includes(filter.scope) ||
    !['all', 'active', 'archived'].includes(filter.projectStatus) ||
    !['open', 'done', 'all'].includes(filter.status)
  )
    throw new Error('Invalid Milestone filter');
  return params;
}

export class MilestoneStore {
  readonly entities = new Map<string, ApiMilestone>();
  private lists = new Map<string, Query<MilestoneList>>();
  private details = new Map<string, Query<ApiMilestone>>();
  private epoch = 0;
  private disposed = false;
  private lifetime = new AbortController();
  private pending = new Set<string>();
  onInvalidate = () => {};

  constructor(readonly transport: PrivateTransport) {
    transport.lifecycle.signal.addEventListener('abort', () => this.dispose(), { once: true });
  }

  private assert(epoch: number, signal: AbortSignal) {
    this.transport.lifecycle.assert(this.transport.generation);
    if (this.disposed || signal.aborted || epoch !== this.epoch) throw new CancelledError();
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
    const retained = new Set(this.details.keys());
    for (const query of this.lists.values())
      for (const milestone of query.getSnapshot().data?.items ?? []) retained.add(milestone.id);
    for (const id of this.entities.keys()) if (!retained.has(id)) this.entities.delete(id);
  }

  private adopt(milestone: ApiMilestone) {
    const previous = this.entities.get(milestone.id);
    if (previous && previous.revision > milestone.revision) return previous;
    this.entities.set(milestone.id, milestone);
    return milestone;
  }

  private async page(filter: MilestoneFilter, signal: AbortSignal, cursor?: string) {
    const epoch = this.epoch;
    const params = milestoneParams(filter);
    if (cursor) params.set('cursor', cursor);
    const page = await this.transport.request('/api/v1/milestones?' + params, {
      signal,
      generation: this.transport.generation,
      expectedStatus: 200,
      parse: parseMilestonePage,
    });
    this.assert(epoch, signal);
    return { ...page, items: page.items.map((milestone) => this.adopt(milestone)) };
  }

  list(filter: MilestoneFilter) {
    this.prune();
    const key = milestoneParams(filter).toString();
    let query = this.lists.get(key);
    if (!query) {
      const captured = { ...filter };
      query = new Query<MilestoneList>(async (signal) => ({
        ...(await this.page(captured, signal)),
        cursors: [],
      }));
      this.lists.set(key, query);
    }
    return query;
  }

  more(filter: MilestoneFilter) {
    const query = this.list(filter);
    const previous = query.getSnapshot().data;
    if (!previous?.nextCursor || !['ready', 'error'].includes(query.getSnapshot().status))
      return Promise.resolve();
    const cursor = previous.nextCursor;
    return query.load(async (signal) => {
      const next = await this.page(filter, signal, cursor);
      const cursors = [...previous.cursors, cursor];
      if (next.nextCursor && cursors.includes(next.nextCursor))
        throw new Error('서버가 같은 커서를 반환했습니다. 목록을 새로고침해 주세요.');
      const items = new Map(
        previous.items.map((item) => [item.id, this.entities.get(item.id) ?? item]),
      );
      for (const item of next.items) items.set(item.id, item);
      return { ...next, items: [...items.values()], cursors };
    });
  }

  detail(id: string) {
    uuid(id);
    this.prune();
    let query = this.details.get(id);
    if (!query) {
      query = new Query<ApiMilestone>(async (signal) => {
        const epoch = this.epoch;
        const milestone = await this.transport.request('/api/v1/milestones/' + id, {
          signal,
          generation: this.transport.generation,
          expectedStatus: 200,
          parse: parseMilestone,
        });
        this.assert(epoch, signal);
        if (milestone.id !== id) throw new Error('Milestone identity mismatch');
        return this.adopt(milestone);
      });
      this.details.set(id, query);
      const cached = this.entities.get(id);
      if (cached) query.seed(cached);
    }
    return query;
  }

  invalidate(deletedId?: string) {
    this.epoch++;
    for (const query of this.lists.values()) {
      const data = query.getSnapshot().data;
      if (data)
        query.seed({
          ...data,
          items: data.items.filter((item) => item.id !== deletedId),
          nextCursor: null,
          cursors: [],
        });
      query.invalidate();
    }
    for (const query of this.details.values()) query.invalidate();
    this.onInvalidate();
  }

  async mutate(
    operation: 'create' | 'patch' | 'delete',
    options: { id?: string; body?: unknown; revision?: number; key?: string },
  ) {
    const target = options.id ?? 'create';
    if (this.pending.has(target)) throw new Error('Milestone operation already pending');
    if (operation === 'create' && !options.key)
      throw new Error('Milestone creation requires an idempotency key');
    if (operation !== 'create') uuid(options.id);
    if (operation === 'delete') revision(options.revision);
    this.pending.add(target);
    try {
      let path = '/api/v1/milestones' + (options.id ? '/' + options.id : '');
      if (operation === 'delete') path += '?revision=' + options.revision;
      if (operation === 'delete') {
        const deleted = await this.transport.request(
          '/api/v1/milestones/' + options.id + '?revision=' + options.revision,
          {
            method: 'DELETE',
            generation: this.transport.generation,
            signal: this.lifetime.signal,
            expectedStatus: 200,
            parse: parseDeletedMilestone,
          },
        );
        this.transport.lifecycle.assert(this.transport.generation);
        if (options.id !== deleted.deletedId)
          throw new HttpError(200, 'PROTOCOL_ERROR', 'Milestone identity mismatch');
        this.invalidate(deleted.deletedId);
        this.entities.delete(deleted.deletedId);
        this.details.get(deleted.deletedId)?.invalidate(true);
        return { deletedId: deleted.deletedId };
      }
      const milestone = await this.transport.request<ApiMilestone>(path, {
        method: operation === 'patch' ? 'PATCH' : 'POST',
        json: options.body,
        headers: operation === 'create' ? { 'Idempotency-Key': options.key ?? '' } : undefined,
        generation: this.transport.generation,
        signal: this.lifetime.signal,
        expectedStatus: operation === 'create' ? 201 : 200,
        parse: parseMilestone,
      });
      this.transport.lifecycle.assert(this.transport.generation);
      if (options.id && options.id !== milestone.id)
        throw new HttpError(200, 'PROTOCOL_ERROR', 'Milestone identity mismatch');
      if (
        operation === 'patch' &&
        milestone.revision <= revision((options.body as { revision?: unknown })?.revision)
      )
        throw new HttpError(200, 'PROTOCOL_ERROR', 'Milestone revision did not advance');
      this.invalidate();
      if (operation === 'create') {
        const detail = this.detail(milestone.id);
        detail.invalidate(true);
        await detail.load();
        this.transport.lifecycle.assert(this.transport.generation);
        const state = detail.getSnapshot();
        return {
          milestone: state.status === 'ready' ? state.data : undefined,
          confirmedId: milestone.id,
          reconciled: state.status === 'ready',
        };
      }
      const saved = this.adopt(milestone);
      this.detail(saved.id).seed(saved);
      return { milestone: saved, reconciled: true };
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
    for (const query of [...this.lists.values(), ...this.details.values()]) query.cancel();
    this.entities.clear();
    this.lists.clear();
    this.details.clear();
  }
}
