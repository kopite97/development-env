import { describe, it, expect } from 'vitest';
import { Lifecycle, createHttpClient } from '../../shared/http/client';
import { LinkStore, fullLinks } from './apiStore';
const id = (n: number) => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');
const dto = (n = 1, position = n - 1) => ({
  id: id(n),
  position,
  revision: 1,
  createdAt: '2026-09-14T00:00:00Z',
  updatedAt: '2026-09-14T00:00:00Z',
  label: 'Link ' + n,
  description: '',
  url: 'https://example.com/' + n,
  projectId: null,
  projectName: null,
  categoryId: null,
});
const collection = (items = [dto()], collectionRevision = 1) => ({
  items,
  total: items.length,
  nextCursor: null,
  collectionRevision,
});
function make(fetcher: typeof fetch) {
  const lifecycle = new Lifecycle();
  return new LinkStore({
    lifecycle,
    generation: 0,
    recoverSecurity: async () => {},
    request: createHttpClient({ lifecycle, fetch: fetcher, getCsrfToken: async () => 'csrf' }),
  });
}
describe('Link collection authority', () => {
  it('uses exact server filters and independent detail, never pagination', async () => {
    const paths: string[] = [];
    const store = make(async (p) => {
      paths.push(String(p));
      return Response.json(String(p).includes('?') ? collection([]) : dto());
    });
    await store.list({ category: 'uncategorized', query: ' %_! ' }).load();
    await store.detail(id(1)).load();
    expect(paths[0]).toContain('category=uncategorized&query=+%25_%21+');
    expect(paths.join()).not.toContain('limit');
    expect(store.detail(id(1)).getSnapshot().data?.id).toBe(id(1));
  });
  it('requires a confirmed full snapshot and complete permutation; installs returned authority', async () => {
    const bodies: unknown[] = [];
    const store = make(async (_p, o) => {
      if (o?.method === 'PUT') {
        bodies.push(JSON.parse(String(o.body)));
        return Response.json(
          collection(
            [
              { ...dto(2, 0), revision: 2 },
              { ...dto(1, 1), revision: 2 },
            ],
            3,
          ),
        );
      }
      return Response.json(collection([dto(), dto(2)], 2));
    });
    const q = store.list(fullLinks);
    await q.load();
    const base = q.getSnapshot().data!;
    await expect(store.mutate('order', { collection: base, ids: [id(1)] })).rejects.toThrow();
    await store.mutate('order', { collection: base, ids: [id(2), id(1)] });
    expect(bodies).toEqual([{ collectionRevision: 2, ids: [id(2), id(1)] }]);
    expect(q.getSnapshot().data?.items.map((x) => [x.id, x.position, x.revision])).toEqual([
      [id(2), 0, 2],
      [id(1), 1, 2],
    ]);
  });
  it('rejects stale snapshot pairing and preserves confirmed order on conflict', async () => {
    const store = make(async (_p, o) =>
      o?.method === 'PUT'
        ? Response.json({ code: 'REVISION_CONFLICT' }, { status: 409 })
        : Response.json(collection()),
    );
    const q = store.list(fullLinks);
    await q.load();
    const base = q.getSnapshot().data!;
    await expect(
      store.mutate('order', { collection: { ...base }, ids: [id(1)] }),
    ).rejects.toThrow();
    await expect(store.mutate('order', { collection: base, ids: [id(1)] })).rejects.toThrow();
    expect(q.getSnapshot().stale).toBe(true);
    expect(q.getSnapshot().data).toEqual(base);
  });
  it('serializes mutations and retires old reads even when abort is ignored', async () => {
    let finish!: (r: Response) => void;
    const store = make(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const q = store.list(fullLinks);
    const work = q.load();
    await new Promise((r) => setTimeout(r, 0));
    store.invalidate();
    finish(Response.json(collection()));
    await work;
    expect(q.getSnapshot().data).toBeUndefined();
    const mutation = store.mutate('delete', { id: id(1), revision: 1 });
    await new Promise((r) => setTimeout(r, 0));
    await expect(store.mutate('delete', { id: id(2), revision: 1 })).rejects.toThrow('처리 중');
    store.dispose();
    finish(Response.json({ deletedId: id(1), collectionRevision: 2 }));
    await expect(mutation).rejects.toThrow();
  });
  it('validates deletion acknowledgment, removes deleted rows, and leaves position gaps', async () => {
    let wrong = true;
    const store = make(async (p, o) => {
      if (o?.method === 'DELETE') {
        expect(String(p)).toContain('?revision=1');
        expect(o.body).toBeUndefined();
        return Response.json({ deletedId: wrong ? id(3) : id(1), collectionRevision: 3 });
      }
      return Response.json(collection([dto(), dto(2, 4)], 2));
    });
    const q = store.list(fullLinks);
    await q.load();
    await expect(store.mutate('delete', { id: id(1), revision: 1 })).rejects.toThrow();
    expect(q.getSnapshot().data?.items).toHaveLength(2);
    wrong = false;
    await store.mutate('delete', { id: id(1), revision: 1 });
    expect(q.getSnapshot().data?.items.map((l) => l.position)).toEqual([4]);
  });
  it('reconciles old POST replay without resurrecting deleted resources', async () => {
    const store = make(async (p, o) =>
      o?.method === 'POST'
        ? Response.json({ item: dto(), collectionRevision: 1 }, { status: 201 })
        : String(p).includes('?')
          ? Response.json(collection([], 4))
          : Response.json({ code: 'RESOURCE_NOT_FOUND' }, { status: 404 }),
    );
    const result = await store.mutate('create', {
      key: 'same-key',
      body: { label: 'Link', url: 'https://example.com' },
    });
    expect(result).toEqual({ confirmedId: id(1), reconciled: false });
    expect(store.list(fullLinks).getSnapshot().data?.items).toEqual([]);
  });
  it('accepts server no-op and empty reorder revisions, and rejects wrong response order', async () => {
    let wrong = false;
    const store = make(async (_p, o) =>
      Response.json(
        collection(o?.method === 'PUT' && wrong ? [dto()] : [], o?.method === 'PUT' ? 2 : 1),
      ),
    );
    const q = store.list(fullLinks);
    await q.load();
    await store.mutate('order', { collection: q.getSnapshot().data, ids: [] });
    expect(q.getSnapshot().data?.collectionRevision).toBe(2);
    wrong = true;
    await expect(
      store.mutate('order', { collection: q.getSnapshot().data, ids: [] }),
    ).rejects.toThrow();
  });
  it('retains rows after failed refresh and rejects older global snapshot', async () => {
    let revision = 3;
    const store = make(async () => Response.json(collection([dto()], revision)));
    const q = store.list(fullLinks);
    await q.load();
    revision = 2;
    q.invalidate();
    await q.load();
    expect(q.getSnapshot().status).toBe('error');
    expect(q.getSnapshot().data?.collectionRevision).toBe(3);
  });
});
