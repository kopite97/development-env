import { expect, it } from 'vitest';
import { createHttpClient, Lifecycle } from '../../shared/http/client';
import { CategoryStore } from './categoryStore';
import { categoryIntent, parseCategory } from './categoryModel';
const row = parseCategory({
  id: '00000000-0000-0000-0000-000000000001',
  name: '개발',
  revision: 1,
  createdAt: '2026-09-14T00:00:00Z',
  updatedAt: '2026-09-14T00:00:00Z',
});
function setup(fetcher: typeof fetch) {
  const lifecycle = new Lifecycle();
  return new CategoryStore({
    lifecycle,
    generation: 0,
    recoverSecurity: async () => {},
    request: createHttpClient({ lifecycle, fetch: fetcher }),
  });
}
it('blocks duplicate creates and rejects a late mutation from a retired session', async () => {
  let release!: (response: Response) => void;
  const store = setup(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const intent = categoryIntent('Pending');
  const first = store.create(intent);
  const cancelled = expect(first).rejects.toThrow('cancelled');
  await new Promise((resolve) => setTimeout(resolve, 0));
  await expect(store.create(intent)).rejects.toThrow('이미 저장 중');
  store.transport.lifecycle.reset();
  release(Response.json(row, { status: 201 }));
  await cancelled;
  expect(store.list.getSnapshot().data).toBeUndefined();
});
it('reconciles historical create snapshots against the current full list, including deletion', async () => {
  let items = [{ ...row, name: 'renamed', revision: 2 }];
  const store = setup(async (_url, init) =>
    init?.method === 'POST'
      ? Response.json(row, { status: 201 })
      : Response.json({ items, total: items.length }),
  );
  const intent = categoryIntent(row.name);
  expect(await store.create(intent)).toBe(true);
  expect(store.list.getSnapshot().data?.items[0].name).toBe('renamed');
  items = [];
  await store.create(intent);
  expect(store.list.getSnapshot().data?.items).toEqual([]);
});
it('distinguishes confirmed writes from refresh errors and retains typed server rejection', async () => {
  const store = setup(async (_url, init) =>
    init?.method === 'POST'
      ? Response.json(row, { status: 201 })
      : Response.json({ code: 'INTERNAL_ERROR' }, { status: 500 }),
  );
  expect(await store.create(categoryIntent('name'))).toBe(false);
  const rejected = setup(async () => Response.json({ code: 'CATEGORY_IN_USE' }, { status: 409 }));
  await expect(rejected.delete(row)).rejects.toMatchObject({ code: 'CATEGORY_IN_USE' });
});
it('pre-delete reads and retired sessions cannot restore removed categories', async () => {
  let resolve!: (r: Response) => void;
  let reads = 0;
  const store = setup(async (_url, init) => {
    if (init?.method === 'DELETE') return Response.json({ deletedId: row.id });
    if (++reads === 1)
      return new Promise((r) => {
        resolve = r;
      });
    return Response.json({ items: [], total: 0 });
  });
  const read = store.list.load();
  await new Promise((r) => setTimeout(r, 0));
  await store.delete(row);
  resolve(Response.json({ items: [row], total: 1 }));
  await read;
  expect(store.list.getSnapshot().data?.items).toEqual([]);
  store.transport.lifecycle.reset();
  expect(store.list.getSnapshot().data).toBeUndefined();
  await expect(store.create(categoryIntent('new'))).rejects.toThrow('cancelled');
});
