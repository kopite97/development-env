import { describe, expect, it } from 'vitest';
import { createHttpClient, Lifecycle } from '../../shared/http/client';
import { JournalStore } from './apiStore';
import { parseJournal } from './apiModel';

const id = '00000000-0000-0000-0000-000000000009';
const projectId = '00000000-0000-0000-0000-000000000001';
const dto = (overrides: Record<string, unknown> = {}) => ({
  id,
  revision: 1,
  createdAt: '2026-09-13T00:00:00Z',
  updatedAt: '2026-09-13T00:00:00Z',
  title: 'Journal',
  projectId,
  projectName: 'Project',
  scope: 'unity',
  body: 'body',
  entryDate: '2026-09-13',
  ...overrides,
});

function storeWith(fetcher: typeof fetch) {
  const lifecycle = new Lifecycle();
  return new JournalStore({
    lifecycle,
    generation: 0,
    recoverSecurity: async () => {},
    request: createHttpClient({
      lifecycle,
      fetch: fetcher,
      getCsrfToken: async () => 'csrf-test',
    }),
  });
}

const filter = {
  scope: 'all' as const,
  projectStatus: 'all' as const,
  query: 'body term',
  projectId,
  from: '2026-09-01',
  to: '2026-09-30',
  sort: 'oldest' as const,
  limit: 2,
};

describe('Journal store', () => {
  it('sends server filters and deduplicates cursor pages', async () => {
    const requests: string[] = [];
    let page = 0;
    const first = dto({ revision: 2 });
    const second = dto({ id: '00000000-0000-0000-0000-000000000010', title: 'Second' });
    const store = storeWith(async (input) => {
      const path = String(input);
      requests.push(path);
      page++;
      return Response.json(
        page === 1
          ? { items: [first], total: 2, nextCursor: 'cursor-1' }
          : { items: [dto({ revision: 1 }), second], total: 2, nextCursor: null },
      );
    });
    const query = store.list(filter);
    await Promise.all([query.load(), query.load()]);
    const params = new URL('http://test' + requests[0]).searchParams;
    expect(params.get('scope')).toBe('all');
    expect(params.get('projectId')).toBe(projectId);
    expect(params.get('projectStatus')).toBe('all');
    expect(params.get('query')).toBe('body term');
    expect(params.get('from')).toBe('2026-09-01');
    expect(params.get('to')).toBe('2026-09-30');
    expect(params.get('sort')).toBe('oldest');
    expect(params.get('limit')).toBe('2');
    expect(page).toBe(1);
    await store.more(filter);
    expect(requests[1]).toContain('cursor=cursor-1');
    expect(query.getSnapshot().data?.items.map((item) => item.id)).toEqual([id, second.id]);
    expect(query.getSnapshot().data?.items[0].revision).toBe(2);
    expect(query.getSnapshot().data?.nextCursor).toBeNull();
  });

  it('does not publish a response that loses a newer invalidation epoch', async () => {
    let resolve!: (response: Response) => void;
    const store = storeWith(
      () =>
        new Promise((complete) => {
          resolve = complete;
        }),
    );
    const query = store.list({
      scope: 'all',
      projectStatus: 'all',
      query: '',
      sort: 'newest',
      limit: 20,
    });
    const work = query.load();
    await new Promise((complete) => setTimeout(complete, 0));
    store.invalidate();
    resolve(Response.json({ items: [dto()], total: 1, nextCursor: null }));
    await work;
    expect(query.getSnapshot().data).toBeUndefined();
    expect(store.entities.size).toBe(0);
  });

  it('sends idempotent create and verifies the returned resource through direct detail', async () => {
    const calls: { method: string; path: string; headers: Headers; body: unknown }[] = [];
    const store = storeWith(async (input, init) => {
      const path = String(input);
      calls.push({
        method: init?.method ?? 'GET',
        path,
        headers: new Headers(init?.headers),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      return Response.json(dto({ title: 'Saved', revision: 3 }), {
        status: path.includes('?') || init?.method === 'GET' ? 200 : 201,
      });
    });
    const body = { title: 'Saved', projectId, body: 'exact\nbody  ', entryDate: '2026-09-13' };
    const result = await store.mutate('create', { body, key: 'journal-key-1' });
    const post = calls.find((call) => call.method === 'POST')!;
    expect(post.headers.get('Idempotency-Key')).toBe('journal-key-1');
    expect(post.headers.get('X-CSRF-Token')).toBe('csrf-test');
    expect(post.body).toEqual(body);
    expect(result.journal?.title).toBe('Saved');
    expect(calls.some((call) => call.method === 'GET' && call.path.endsWith('/' + id))).toBe(true);
  });

  it('requires the server deletedId and invalidates the entity only after a confirmed delete', async () => {
    const calls: { method: string; path: string; headers: Headers }[] = [];
    const store = storeWith(async (input, init) => {
      calls.push({
        method: init?.method ?? 'GET',
        path: String(input),
        headers: new Headers(init?.headers),
      });
      if (init?.method === 'DELETE') return Response.json({ deletedId: id });
      return Response.json(dto());
    });
    store.detail(id).seed(parseJournal(dto()));
    const result = await store.mutate('delete', { id, revision: 1 });
    expect(result.deletedId).toBe(id);
    expect(calls[0].path).toContain('/api/v1/journals/' + id + '?revision=1');
    expect(calls[0].headers.get('X-CSRF-Token')).toBe('csrf-test');
    expect(store.entities.has(id)).toBe(false);
  });
});
