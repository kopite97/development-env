import { describe, it, expect } from 'vitest';
import { Lifecycle, createHttpClient } from '../../shared/http/client';
import { MilestoneStore, milestoneParams } from './apiStore';
const id = '00000000-0000-0000-0000-000000000010';
const dto = (changes: Record<string, unknown> = {}) => ({
  id,
  revision: 1,
  createdAt: '2026-09-13T00:00:00Z',
  updatedAt: '2026-09-13T00:00:00Z',
  title: '목표',
  projectId: '00000000-0000-0000-0000-000000000001',
  projectName: '프로젝트',
  categoryId: null,
  dueDate: null,
  completed: false,
  ...changes,
});
const filter = { category: 'all', projectStatus: 'all', status: 'open', limit: 2 } as const;
function make(fetcher: typeof fetch) {
  const lifecycle = new Lifecycle();
  return new MilestoneStore({
    lifecycle,
    generation: 0,
    recoverSecurity: async () => {},
    request: createHttpClient({ lifecycle, fetch: fetcher, getCsrfToken: async () => 'csrf' }),
  });
}
describe('Milestone reads and mutations', () => {
  it('retires cursor chains but retains confirmed rows after invalidation', async () => {
    let calls = 0;
    const store = make(async () => {
      calls++;
      return Response.json({ items: [dto()], total: 2, nextCursor: 'old-chain' });
    });
    const q = store.list(filter);
    await q.load();
    store.invalidate();
    await store.more(filter);
    expect(calls).toBe(1);
    expect(q.getSnapshot().data?.items).toHaveLength(1);
    expect(q.getSnapshot().data?.nextCursor).toBeNull();
  });
  it('binds only implemented parameters and keeps detail independent of exhausted lists', async () => {
    const paths: string[] = [];
    const store = make(async (path) => {
      paths.push(String(path));
      return Response.json(
        String(path).includes('?') ? { items: [], total: 0, nextCursor: null } : dto(),
      );
    });
    await store.list(filter).load();
    await store.detail(id).load();
    expect(store.detail(id).getSnapshot().data?.id).toBe(id);
    expect(paths[0]).toContain('status=open');
    expect(paths[0]).not.toContain('sort');
    expect(milestoneParams({ ...filter, status: 'done' }).toString()).not.toBe(
      milestoneParams(filter).toString(),
    );
  });
  it('preserves rows after later-page failure and retries exact cursor without duplicate rows', async () => {
    let calls = 0;
    const store = make(async (path) => {
      calls++;
      if (calls === 2) return Response.json({ code: 'INTERNAL_ERROR' }, { status: 500 });
      expect(String(path).includes('cursor=next')).toBe(calls > 1);
      return Response.json(
        calls === 1
          ? { items: [dto()], total: 2, nextCursor: 'next' }
          : { items: [dto(), dto({ id: id.replace('010', '011') })], total: 2, nextCursor: null },
      );
    });
    const q = store.list(filter);
    await q.load();
    await store.more(filter);
    expect(q.getSnapshot().status).toBe('error');
    expect(q.getSnapshot().data?.items.length).toBe(1);
    await store.more(filter);
    expect(q.getSnapshot().data?.items.length).toBe(2);
  });
  it('suppresses an abort-ignoring read after mutation invalidation and disposal', async () => {
    let finish!: (r: Response) => void;
    const store = make(() => new Promise((resolve) => (finish = resolve)));
    const q = store.list(filter);
    const work = q.load();
    await new Promise((r) => setTimeout(r, 0));
    store.invalidate();
    finish(Response.json({ items: [dto()], total: 1, nextCursor: null }));
    await work;
    expect(store.entities.size).toBe(0);
    expect(q.getSnapshot().data).toBeUndefined();
    store.dispose();
  });
  it('uses query revision for DELETE and refuses mismatched deletion acknowledgment', async () => {
    let path = '';
    let body: unknown;
    const store = make(async (p, o) => {
      path = String(p);
      body = o?.body;
      return Response.json({ deletedId: id.replace('010', '011') });
    });
    await expect(store.mutate('delete', { id, revision: 7 })).rejects.toThrow();
    expect(path).toBe('/api/v2/milestones/' + id + '?revision=7');
    expect(body).toBeUndefined();
  });
  it('requires advancing returned revision and keeps equal revision Project presentation fresh', async () => {
    let rename = false;
    const store = make(async (_p, o) =>
      Response.json(dto({ projectName: rename ? 'Renamed' : 'Old', revision: 1 })),
    );
    await store.detail(id).load();
    rename = true;
    store.invalidate();
    await store.detail(id).load();
    expect(store.entities.get(id)?.projectName).toBe('Renamed');
    await expect(
      store.mutate('patch', { id, body: { revision: 1, completed: true } }),
    ).rejects.toThrow();
  });
  it('does not resurrect an original creation snapshot after deleted replay', async () => {
    const store = make(async (_p, o) =>
      o?.method === 'POST'
        ? Response.json(dto(), { status: 201 })
        : Response.json({ code: 'RESOURCE_NOT_FOUND' }, { status: 404 }),
    );
    const result = await store.mutate('create', {
      key: 'same-key',
      body: { title: '목표', projectId: dto().projectId, dueDate: null, completed: false },
    });
    expect(result).toMatchObject({ confirmedId: id, reconciled: false });
    expect(store.entities.size).toBe(0);
  });
  it('blocks stale mutation publication when session generation changes', async () => {
    let finish!: (r: Response) => void;
    const store = make(() => new Promise((resolve) => (finish = resolve)));
    const work = store.mutate('patch', { id, body: { revision: 1, completed: true } });
    await new Promise((r) => setTimeout(r, 0));
    store.dispose();
    finish(Response.json(dto({ revision: 2 })));
    await expect(work).rejects.toThrow();
    expect(store.entities.size).toBe(0);
  });
});
