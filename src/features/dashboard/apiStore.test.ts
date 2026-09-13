import { describe, it, expect, vi } from 'vitest';
import { Lifecycle, createHttpClient } from '../../shared/http/client';
import { DashboardStore } from './apiStore';
import { serverDefaultWidgets, saveBody } from './apiModel';
const dto = (revision = 0, widgets = serverDefaultWidgets()) => ({
  id: 'home',
  schemaVersion: 1,
  revision,
  widgets,
});
function make(fetcher: typeof fetch) {
  const lifecycle = new Lifecycle();
  return new DashboardStore({
    lifecycle,
    generation: 0,
    recoverSecurity: async () => {},
    request: createHttpClient({ lifecycle, fetch: fetcher, getCsrfToken: async () => 'csrf' }),
  });
}
describe('Dashboard server authority', () => {
  it('GET has no query or implicit save and first explicit PUT omits response fields and idempotency', async () => {
    const calls: { path: string; options?: RequestInit }[] = [];
    const store = make(async (p, o) => {
      calls.push({ path: String(p), options: o });
      return Response.json(dto(o?.method === 'PUT' ? 1 : 0));
    });
    const saved = vi.fn();
    store.onSaved = saved;
    await store.home.load();
    await store.home.load();
    expect(calls).toHaveLength(2);
    await store.save(saveBody(0, serverDefaultWidgets()));
    expect(calls.map((c) => c.path)).toEqual(Array(3).fill('/api/v1/dashboards/home'));
    expect(JSON.parse(String(calls[2].options?.body))).toEqual(saveBody(0, serverDefaultWidgets()));
    expect(new Headers(calls[2].options?.headers).get('Idempotency-Key')).toBeNull();
    expect(store.home.getSnapshot().data?.revision).toBe(1);
    expect(saved).toHaveBeenCalledTimes(1);
  });
  it('does not replay conflicts or network failures and retains confirmed configuration as stale', async () => {
    for (const failure of [Response.json({ code: 'REVISION_CONFLICT' }, { status: 409 }), null]) {
      let writes = 0;
      const store = make(async (_p, o) => {
        if (o?.method === 'PUT') {
          writes++;
          if (failure) return failure;
          throw new TypeError('lost');
        }
        return Response.json(dto(4));
      });
      await store.home.load();
      await expect(store.save(saveBody(4, []))).rejects.toThrow();
      expect(writes).toBe(1);
      expect(store.home.getSnapshot().data?.revision).toBe(4);
      expect(store.home.getSnapshot().stale).toBe(true);
    }
  });
  it('rejects malformed, mismatched and nonadvancing acknowledgments', async () => {
    for (const result of [dto(2), dto(3, []), { ...dto(3), id: 'other' }]) {
      const store = make(async () => Response.json(result));
      await expect(store.save(saveBody(2, serverDefaultWidgets()))).rejects.toThrow();
      expect(store.home.getSnapshot().data).toBeUndefined();
    }
  });
  it('retires in-flight reads after a save even if fetch ignores cancellation', async () => {
    let finish!: (r: Response) => void;
    const store = make(async (_p, o) =>
      o?.method === 'PUT'
        ? Response.json(dto(1, []))
        : new Promise((resolve) => {
            finish = resolve;
          }),
    );
    const read = store.home.load();
    await new Promise((r) => setTimeout(r, 0));
    await store.save(saveBody(0, []));
    finish(Response.json(dto()));
    await read;
    expect(store.home.getSnapshot().data).toEqual(dto(1, []));
  });
  it('blocks overlapping saves and never publishes a disposed session acknowledgment', async () => {
    let finish!: (r: Response) => void;
    const store = make(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const write = store.save(saveBody(0, []));
    await new Promise((r) => setTimeout(r, 0));
    await expect(store.save(saveBody(0, []))).rejects.toThrow();
    store.dispose();
    finish(Response.json(dto(1, [])));
    await expect(write).rejects.toThrow();
    expect(store.home.getSnapshot().data).toBeUndefined();
  });
  it('rejects a lower revision read after confirmed authority', async () => {
    let response = dto(5);
    const store = make(async () => Response.json(response));
    await store.home.load();
    response = dto(4);
    store.invalidate();
    await store.home.load();
    expect(store.home.getSnapshot().status).toBe('error');
    expect(store.home.getSnapshot().data?.revision).toBe(5);
  });
});
