import { parseCategoryFilter, type CategoryFilter } from '../projects/categoryFilter';
import { CancelledError, HttpError } from '../../shared/http/client';
import { Query } from '../../shared/http/query';
import type { PrivateTransport } from '../../shared/http/transport';
import { object, uuid } from '../../shared/http/validation';
import {
  parseDeletedJournal,
  journalDate,
  parseJournal,
  parseJournalPage,
  type ApiJournal,
  type JournalPage,
  type JournalProjectStatus,
  type JournalSort,
} from './apiModel';

export type JournalFilter = {
  category: CategoryFilter;
  projectId?: string;
  projectStatus: JournalProjectStatus;
  query: string;
  from?: string;
  to?: string;
  sort: JournalSort;
  limit: number;
};
export type JournalList = JournalPage & { cursors: string[] };

export function journalParams(filter: JournalFilter) {
  if (!Number.isInteger(filter.limit) || filter.limit < 1 || filter.limit > 100)
    throw new Error('Invalid Journal limit');
  const params = new URLSearchParams({
    category: parseCategoryFilter(filter.category),
    projectStatus: filter.projectStatus,
    query: filter.query,
    sort: filter.sort,
    limit: String(filter.limit),
  });
  if (filter.projectId) params.set('projectId', uuid(filter.projectId));
  if (filter.from) params.set('from', journalDate(filter.from));
  if (filter.to) params.set('to', journalDate(filter.to));
  return params;
}

export class JournalStore {
  readonly entities = new Map<string, ApiJournal>();
  private lists = new Map<string, Query<JournalList>>();
  private details = new Map<string, Query<ApiJournal>>();
  private epoch = 0;
  private readSequence = 0;
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
      for (const journal of query.getSnapshot().data?.items ?? []) retained.add(journal.id);
    for (const id of this.entities.keys()) if (!retained.has(id)) this.entities.delete(id);
  }

  private adopt(journal: ApiJournal) {
    const previous = this.entities.get(journal.id);
    if (previous && previous.revision > journal.revision) return previous;
    this.entities.set(journal.id, journal);
    return journal;
  }

  private async page(filter: JournalFilter, signal: AbortSignal, cursor?: string) {
    const epoch = this.epoch;
    const params = journalParams(filter);
    if (cursor) params.set('cursor', cursor);
    const page = await this.transport.request('/api/v2/journals?' + params, {
      signal,
      generation: this.transport.generation,
      expectedStatus: 200,
      parse: parseJournalPage,
    });
    this.assert(epoch, signal);
    return { ...page, items: page.items.map((journal) => this.adopt(journal)) };
  }

  list(filter: JournalFilter) {
    this.prune();
    const key = journalParams(filter).toString();
    let query = this.lists.get(key);
    if (!query) {
      const captured = { ...filter };
      query = new Query<JournalList>(async (signal) => ({
        ...(await this.page(captured, signal)),
        cursors: [],
      }));
      this.lists.set(key, query);
    }
    return query;
  }

  more(filter: JournalFilter) {
    const query = this.list(filter);
    const previous = query.getSnapshot().data;
    if (!previous?.nextCursor || query.getSnapshot().status === 'loading') return Promise.resolve();
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
      query = new Query<ApiJournal>(async (signal) => {
        const epoch = this.epoch;
        const journal = await this.transport.request('/api/v2/journals/' + id, {
          signal,
          generation: this.transport.generation,
          expectedStatus: 200,
          parse: parseJournal,
        });
        this.assert(epoch, signal);
        if (journal.id !== id) throw new Error('Journal identity mismatch');
        return this.adopt(journal);
      });
      this.details.set(id, query);
      const cached = this.entities.get(id);
      if (cached) query.seed(cached);
    }
    return query;
  }

  invalidate() {
    this.epoch++;
    for (const query of this.lists.values()) query.invalidate(true);
    for (const query of this.details.values()) query.invalidate();
    this.onInvalidate();
  }

  async mutate(
    operation: 'create' | 'patch' | 'delete',
    options: {
      endpoint?: '/api/v1/journals' | '/api/v2/journals';
      id?: string;
      body?: unknown;
      revision?: number;
      key?: string;
    },
  ) {
    const target = options.id ?? 'create';
    if (this.pending.has(target)) throw new Error('Journal operation already pending');
    if (operation === 'create' && !options.key)
      throw new Error('Journal creation requires an idempotency key');
    if (operation !== 'create') uuid(options.id);
    this.pending.add(target);
    try {
      if (operation === 'create' && options.endpoint === '/api/v1/journals') {
        const legacy = await this.transport.request('/api/v1/journals', {
          method: 'POST',
          json: options.body,
          headers: { 'Idempotency-Key': options.key ?? '' },
          generation: this.transport.generation,
          signal: this.lifetime.signal,
          expectedStatus: 201,
          parse: (value) => ({ id: uuid(object(value).id) }),
        });
        this.transport.lifecycle.assert(this.transport.generation);
        this.invalidate();
        const detail = this.detail(legacy.id);
        await detail.load();
        this.transport.lifecycle.assert(this.transport.generation);
        const state = detail.getSnapshot();
        return {
          journal: state.data,
          confirmedId: legacy.id,
          reconciled: state.status === 'ready',
        };
      }
      let path = '/api/v2/journals' + (options.id ? '/' + options.id : '');
      if (operation === 'delete') path += '?revision=' + options.revision;
      if (operation === 'delete') {
        const deleted = await this.transport.request(
          '/api/v2/journals/' + options.id + '?revision=' + options.revision,
          {
            method: 'DELETE',
            generation: this.transport.generation,
            signal: this.lifetime.signal,
            expectedStatus: 200,
            parse: parseDeletedJournal,
          },
        );
        this.transport.lifecycle.assert(this.transport.generation);
        if (options.id !== deleted.deletedId)
          throw new HttpError(200, 'PROTOCOL_ERROR', 'Journal identity mismatch');
        this.invalidate();
        this.entities.delete(deleted.deletedId);
        this.details.get(deleted.deletedId)?.invalidate(true);
        return { deletedId: deleted.deletedId };
      }
      const journal = await this.transport.request<ApiJournal>(path, {
        method: operation === 'patch' ? 'PATCH' : 'POST',
        json: options.body,
        headers: operation === 'create' ? { 'Idempotency-Key': options.key ?? '' } : undefined,
        generation: this.transport.generation,
        signal: this.lifetime.signal,
        expectedStatus: operation === 'create' ? 201 : 200,
        parse: parseJournal,
      });
      this.transport.lifecycle.assert(this.transport.generation);
      if (options.id && options.id !== journal.id)
        throw new HttpError(200, 'PROTOCOL_ERROR', 'Journal identity mismatch');
      this.invalidate();
      if (operation === 'create') {
        const detail = this.detail(journal.id);
        detail.invalidate();
        await detail.load();
        this.transport.lifecycle.assert(this.transport.generation);
        const state = detail.getSnapshot();
        return { journal: state.data, reconciled: state.status === 'ready' };
      }
      const saved = this.adopt(journal);
      this.detail(saved.id).seed(saved);
      return { journal: saved, reconciled: true };
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
