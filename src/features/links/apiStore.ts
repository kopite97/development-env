import { CancelledError, HttpError } from '../../shared/http/client';
import { Query } from '../../shared/http/query';
import type { PrivateTransport } from '../../shared/http/transport';
import { oneOf, uuid } from '../../shared/http/validation';
import {
  parseCollection,
  parseDeletion,
  parseLink,
  parseMutation,
  revision,
  type ApiLink,
  type LinkCollection,
} from './apiModel';

export type LinkFilter = { scope: 'all' | 'unity' | 'server'; query: string };
export const fullLinks: LinkFilter = { scope: 'all', query: '' };
export class LinkStore {
  private lists = new Map<string, Query<LinkCollection>>();
  private details = new Map<string, Query<ApiLink>>();
  private epoch = 0;
  private lifetime = new AbortController();
  private pending = false;
  private watermark = 0;
  constructor(readonly transport: PrivateTransport) {
    transport.lifecycle.signal.addEventListener('abort', () => this.dispose(), { once: true });
  }
  private assert(epoch = this.epoch) {
    this.transport.lifecycle.assert(this.transport.generation);
    if (this.lifetime.signal.aborted || epoch !== this.epoch) throw new CancelledError();
  }
  private prune<T>(map: Map<string, Query<T>>) {
    const inactive = [...map].filter(([, q]) => !q.observed);
    for (const [key, q] of inactive.slice(0, Math.max(0, inactive.length - 32))) {
      q.cancel();
      map.delete(key);
    }
  }
  list(filter: LinkFilter) {
    oneOf(filter.scope, ['all', 'unity', 'server']);
    const params = new URLSearchParams({ scope: filter.scope, query: filter.query });
    const key = params.toString();
    this.prune(this.lists);
    let q = this.lists.get(key);
    if (!q) {
      q = new Query<LinkCollection>(async (signal) => {
        const epoch = this.epoch;
        const data = await this.transport.request('/api/v1/links?' + key, {
          signal,
          generation: this.transport.generation,
          expectedStatus: 200,
          parse: parseCollection,
        });
        this.assert(epoch);
        if (data.collectionRevision < this.watermark)
          throw new Error('이전 링크 목록입니다. 새로고침해 주세요.');
        this.watermark = data.collectionRevision;
        return data;
      });
      this.lists.set(key, q);
    }
    return q;
  }
  detail(id: string) {
    uuid(id);
    this.prune(this.details);
    let q = this.details.get(id);
    if (!q) {
      q = new Query<ApiLink>(async (signal) => {
        const epoch = this.epoch;
        const data = await this.transport.request('/api/v1/links/' + id, {
          signal,
          generation: this.transport.generation,
          expectedStatus: 200,
          parse: parseLink,
        });
        this.assert(epoch);
        if (data.id !== id) throw new Error('Link identity mismatch');
        return data;
      });
      this.details.set(id, q);
    }
    return q;
  }
  invalidate(deletedId?: string) {
    this.epoch++;
    for (const q of this.lists.values()) {
      q.invalidate();
      const data = q.getSnapshot().data;
      if (data && deletedId) {
        const items = data.items.filter((l) => l.id !== deletedId);
        q.seed({ ...data, items, total: items.length });
      }
    }
    for (const [id, q] of this.details) q.invalidate(id === deletedId);
  }
  async mutate(
    operation: 'create' | 'patch' | 'delete' | 'order',
    options: {
      id?: string;
      revision?: number;
      body?: unknown;
      key?: string;
      ids?: string[];
      collection?: LinkCollection;
    },
  ) {
    this.assert();
    if (this.pending) throw new Error('링크 변경을 처리 중입니다.');
    if (operation === 'patch' || operation === 'delete') uuid(options.id);
    if (operation === 'create' && !options.key) throw new Error('Idempotency-Key required');
    if (operation === 'delete') revision(options.revision);
    if (operation === 'order') {
      const state = this.list(fullLinks).getSnapshot();
      const ids = options.ids;
      if (
        state.status !== 'ready' ||
        state.stale ||
        !state.data ||
        state.data !== options.collection ||
        state.data.collectionRevision < this.watermark ||
        !ids ||
        ids.length !== state.data.items.length ||
        new Set(ids).size !== ids.length ||
        ids.some((id) => !state.data!.items.some((l) => l.id === id))
      )
        throw new Error('전체 링크를 새로고침한 뒤 순서를 변경해 주세요.');
    }
    this.pending = true;
    const capturedRevision = this.watermark;
    const common = {
      generation: this.transport.generation,
      signal: this.lifetime.signal,
      expectedStatus: 200,
    };
    try {
      if (operation === 'order') {
        const data = await this.transport.request('/api/v1/links/order', {
          ...common,
          method: 'PUT',
          json: { collectionRevision: options.collection!.collectionRevision, ids: options.ids },
          parse: parseCollection,
        });
        this.assert();
        if (
          data.collectionRevision <= options.collection!.collectionRevision ||
          data.items.length !== options.ids!.length ||
          data.items.some((l, i) => l.id !== options.ids![i] || l.position !== i)
        )
          throw new HttpError(200, 'PROTOCOL_ERROR', 'Link order mismatch');
        this.watermark = Math.max(this.watermark, data.collectionRevision);
        this.invalidate();
        await this.list(fullLinks).load(async () => data);
        this.assert();
        return { reconciled: true };
      }
      if (operation === 'delete') {
        const data = await this.transport.request(
          '/api/v1/links/' + options.id + '?revision=' + options.revision,
          { ...common, method: 'DELETE', parse: parseDeletion },
        );
        this.assert();
        if (data.deletedId !== options.id || data.collectionRevision <= capturedRevision)
          throw new HttpError(200, 'PROTOCOL_ERROR', 'Link deletion mismatch');
        this.watermark = Math.max(this.watermark, data.collectionRevision);
        this.invalidate(data.deletedId);
        return { reconciled: true };
      }
      const data = await this.transport.request(
        '/api/v1/links' + (options.id ? '/' + options.id : ''),
        {
          ...common,
          expectedStatus: operation === 'create' ? 201 : 200,
          method: operation === 'create' ? 'POST' : 'PATCH',
          json: options.body,
          headers: operation === 'create' ? { 'Idempotency-Key': options.key! } : undefined,
          parse: parseMutation,
        },
      );
      this.assert();
      if (
        !data.collectionRevision ||
        (operation === 'patch' && data.collectionRevision <= capturedRevision) ||
        (options.id &&
          (data.item.id !== options.id ||
            data.item.revision <= revision((options.body as { revision?: unknown }).revision)))
      )
        throw new HttpError(200, 'PROTOCOL_ERROR', 'Link mutation mismatch');
      this.watermark = Math.max(this.watermark, data.collectionRevision);
      this.invalidate();
      if (operation === 'create') {
        const detail = this.detail(data.item.id);
        const collection = this.list(fullLinks);
        await Promise.all([detail.load(), collection.load()]);
        this.assert();
        const s = detail.getSnapshot();
        const c = collection.getSnapshot();
        return {
          confirmedId: data.item.id,
          reconciled:
            s.status === 'ready' &&
            c.status === 'ready' &&
            c.data!.items.some((l) => l.id === data.item.id),
        };
      }
      return { reconciled: true };
    } catch (error) {
      this.assert();
      this.invalidate();
      throw error;
    } finally {
      this.pending = false;
    }
  }
  dispose() {
    this.lifetime.abort();
    this.epoch++;
    for (const q of [...this.lists.values(), ...this.details.values()]) q.cancel();
    this.lists.clear();
    this.details.clear();
  }
}
