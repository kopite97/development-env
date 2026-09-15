import { expect, it } from 'vitest';
import { createHttpClient, Lifecycle } from '../../shared/http/client';
import { TaskStore, taskParams } from './apiStore';
const dto = {
  id: '10000000-0000-0000-0000-000000000001',
  projectId: '20000000-0000-0000-0000-000000000001',
  revision: 1,
  createdAt: '2026-09-13T00:00:00Z',
  updatedAt: '2026-09-13T00:00:00Z',
  title: 'Task',
  projectName: 'Project',
  categoryId: null,
  description: '',
  status: 'todo',
  priority: 'normal',
  tag: '',
  deletedAt: null,
};
const filter = {
  category: 'all',
  projectStatus: 'all',
  query: '%_',
  deleted: false,
  limit: 20,
  status: 'todo',
} as const;
function storeWith(fetch: typeof globalThis.fetch) {
  const lifecycle = new Lifecycle();
  return new TaskStore({
    lifecycle,
    generation: 0,
    recoverSecurity: async () => {},
    request: createHttpClient({ lifecycle, fetch }),
  });
}
it('binds cursor chains and deduplicates rows without losing total or higher revisions', async () => {
  const urls: string[] = [];
  const store = storeWith(async (input) => {
    urls.push(String(input));
    return Response.json({
      items: [{ ...dto, revision: urls.length === 1 ? 2 : 1 }],
      total: 50,
      nextCursor: urls.length === 1 ? 'opaque+/=' : null,
    });
  });
  const query = store.list(filter);
  await Promise.all([query.load(), query.load()]);
  await store.more(filter);
  expect(urls).toHaveLength(2);
  expect(new URL(urls[1], 'http://test').searchParams.get('cursor')).toBe('opaque+/=');
  expect(query.getSnapshot().data).toMatchObject({ total: 50, nextCursor: null });
  expect(query.getSnapshot().data?.items).toHaveLength(1);
  expect(query.getSnapshot().data?.items[0].revision).toBe(2);
  expect(taskParams({ ...filter, status: undefined, deleted: true }).get('status')).toBeNull();
});
it('stats omits list-only arguments and has independent totals', async () => {
  let url = '';
  const store = storeWith(async (input) => {
    url = String(input);
    return Response.json({
      counts: { todo: 30, doing: 10, done: 0 },
      total: 40,
      asOf: dto.createdAt,
    });
  });
  const query = store.stats(filter);
  await query.load();
  const params = new URL(url, 'http://test').searchParams;
  for (const key of ['status', 'deleted', 'limit', 'cursor']) expect(params.has(key)).toBe(false);
  expect(query.getSnapshot().data?.total).toBe(40);
});
it('rejects repeated cursors while retaining the previous page for recovery', async () => {
  const store = storeWith(async () =>
    Response.json({ items: [dto], total: 50, nextCursor: 'same' }),
  );
  const query = store.list(filter);
  await query.load();
  await store.more(filter);
  expect(query.getSnapshot().status).toBe('error');
  expect(query.getSnapshot().data?.items).toHaveLength(1);
});
it('rejects pre-invalidation reads even when transport ignores cancellation', async () => {
  let resolve!: (value: Response) => void;
  const store = storeWith(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const query = store.detail(dto.id),
    work = query.load();
  await new Promise((r) => setTimeout(r, 0));
  store.invalidate();
  resolve(Response.json(dto));
  await work;
  expect(store.entities.size).toBe(0);
  expect(query.getSnapshot().data).toBeUndefined();
});
it('accepts newer derived Project fields at equal revision', async () => {
  let name = 'Before';
  const store = storeWith(async () => Response.json({ ...dto, projectName: name }));
  const query = store.detail(dto.id);
  await query.load();
  name = 'Renamed';
  store.invalidate();
  await query.load();
  expect(store.entities.get(dto.id)?.projectName).toBe('Renamed');
});
it('serializes soft delete revision in URL and restore revision in JSON without creation key', async () => {
  const requests: { url: string; options?: RequestInit }[] = [];
  const store = storeWith(async (input, options) => {
    requests.push({ url: String(input), options });
    if (String(input).endsWith('/auth/csrf')) return Response.json({ csrfToken: 'test' });
    return Response.json({ ...dto, revision: 2 });
  });
  await store.mutate('delete', { id: dto.id, revision: 1 });
  await store.mutate('restore', { id: dto.id, body: { revision: 2 } });
  const mutations = requests.filter(
    (r) => r.options?.method !== 'GET' && !r.url.endsWith('/auth/csrf'),
  );
  expect(mutations[0].url).toContain('?revision=1');
  expect(mutations[0].options?.body).toBeUndefined();
  expect(mutations[1].url).toContain('/restore');
  expect(mutations[1].options?.body).toBe('{"revision":2}');
  for (const request of mutations)
    expect(new Headers(request.options?.headers).has('Idempotency-Key')).toBe(false);
});
it('reconciles an original creation replay instead of resurrecting a deleted entity', async () => {
  const store = storeWith(async (input, options) => {
    if (String(input).endsWith('/auth/csrf')) return Response.json({ csrfToken: 'test' });
    return options?.method === 'POST'
      ? Response.json(dto, { status: 201 })
      : Response.json({ ...dto, revision: 3, projectName: 'Renamed', deletedAt: dto.createdAt });
  });
  const result = await store.mutate('create', {
    body: { title: 'Task', projectId: dto.projectId },
    key: 'same-key',
  });
  expect(result.task?.deletedAt).toBe(dto.createdAt);
  expect(result.task?.projectName).toBe('Renamed');
  expect(store.entities.get(dto.id)?.revision).toBe(3);
});
