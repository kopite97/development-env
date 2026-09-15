import { CancelledError } from '../../shared/http/client';
import { Query } from '../../shared/http/query';
import type { PrivateTransport } from '../../shared/http/transport';
import { object } from '../../shared/http/validation';
import {
  categoryId,
  categoryRetry,
  parseCategories,
  parseCategory,
  type Category,
  type CategoryId,
  type CategoryIntent,
} from './categoryModel';

export class CategoryStore {
  onChanged: (kind: 'create' | 'rename' | 'delete') => void = () => {};
  private lifetime = new AbortController();
  private epoch = 0;
  private pending = new Set<string>();
  readonly list: Query<ReturnType<typeof parseCategories>>;
  constructor(readonly transport: PrivateTransport) {
    this.list = new Query(async (signal) => {
      const epoch = this.epoch;
      const result = await transport.request('/api/v1/project-categories', {
        signal,
        generation: transport.generation,
        expectedStatus: 200,
        parse: parseCategories,
      });
      this.assert();
      if (epoch !== this.epoch || signal.aborted) throw new CancelledError();
      return result;
    });
    transport.lifecycle.signal.addEventListener('abort', () => this.dispose(), { once: true });
  }
  private assert() {
    this.transport.lifecycle.assert(this.transport.generation);
    if (this.lifetime.signal.aborted) throw new CancelledError();
  }
  async read(id: CategoryId) {
    const epoch = this.epoch;
    const result = await this.transport.request('/api/v1/project-categories/' + id, {
      signal: this.lifetime.signal,
      generation: this.transport.generation,
      expectedStatus: 200,
      parse: parseCategory,
    });
    this.assert();
    if (epoch !== this.epoch) throw new CancelledError();
    if (result.id !== id) throw new Error('Category identity mismatch');
    return result;
  }
  refresh() {
    return this.list.load();
  }
  private async mutate(operation: string, request: () => Promise<unknown>, kind: 'create' | 'rename' | 'delete') {
    this.assert();
    if (this.pending.has(operation)) throw new Error('이미 저장 중입니다.');
    this.pending.add(operation);
    try {
      await request();
      this.assert();
      // Mutation snapshots can be historical creation replays. Only current reads publish names.
      this.epoch++;
      this.list.invalidate(true);
      this.onChanged(kind);
      await this.list.load();
      this.assert();
      return this.list.getSnapshot().status === 'ready';
    } finally {
      this.pending.delete(operation);
    }
  }
  create(intent: CategoryIntent) {
    const body = categoryRetry(intent);
    return this.mutate('create', () =>
      this.transport.request('/api/v1/project-categories', {
        method: 'POST',
        json: body,
        headers: { 'Idempotency-Key': intent.key },
        generation: this.transport.generation,
        signal: this.lifetime.signal,
        expectedStatus: 201,
        parse: parseCategory,
      }),
    'create');
  }
  rename(category: Category, name: string) {
    return this.mutate(category.id, () =>
      this.transport.request('/api/v1/project-categories/' + category.id, {
        method: 'PATCH',
        json: { revision: category.revision, name },
        generation: this.transport.generation,
        signal: this.lifetime.signal,
        expectedStatus: 200,
        parse: (value) => {
          const result = parseCategory(value);
          if (result.id !== category.id || result.revision <= category.revision)
            throw new Error('Invalid rename');
          return result;
        },
      }),
    'rename');
  }
  delete(category: Category) {
    return this.mutate(category.id, () =>
      this.transport.request(
        '/api/v1/project-categories/' + category.id + '?revision=' + category.revision,
        {
          method: 'DELETE',
          generation: this.transport.generation,
          signal: this.lifetime.signal,
          expectedStatus: 200,
          parse: (value) => {
            const id = categoryId(object(value).deletedId);
            if (id !== category.id) throw new Error('Category identity mismatch');
            return id;
          },
        },
      ),
    'delete');
  }
  dispose() {
    this.lifetime.abort();
    this.epoch++;
    this.list.invalidate(true);
    this.list.cancel();
  }
}
