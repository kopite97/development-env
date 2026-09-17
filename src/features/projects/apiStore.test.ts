import { expect, it } from 'vitest';
import { createHttpClient, Lifecycle } from '../../shared/http/client';
import { ProjectStore, ProjectCreatedError } from './apiStore';
import { parseProject, serverProjectId } from './apiModel';
const id = '00000000-0000-0000-0000-000000000001';
const dto = {
  id,
  revision: 1,
  createdAt: '2026-09-13T00:00:00Z',
  updatedAt: '2026-09-13T00:00:00Z',
  name: 'Server',
  subtitle: '',
  stack: 'Java',
  progress: 0,
  currentMilestone: '',
  repositoryUrl: '',
  status: 'active',
  categoryId: null,
};
it('reconciles legacy POST responses and exposes confirmed identity when current read fails', async () => {
  const { categoryId: _category, ...legacy } = dto;
  const lifecycle = new Lifecycle();
  let fail = false;
  const store = new ProjectStore({
    lifecycle,
    generation: 0,
    recoverSecurity: async () => {},
    request: createHttpClient({
      lifecycle,
      fetch: async (_url, init) =>
        init?.method === 'POST'
          ? Response.json(legacy, { status: 201 })
          : fail
            ? Response.json({}, { status: 500 })
            : Response.json({ ...dto, categoryId: id, revision: 2 }),
    }),
  });
  expect(await store.mutate(undefined, {}, 'key', '/api/v1/projects')).toMatchObject({
    categoryId: id,
    revision: 2,
  });
  fail = true;
  await expect(store.mutate(undefined, {}, 'key', '/api/v1/projects')).rejects.toBeInstanceOf(
    ProjectCreatedError,
  );
});
it('invalidates Project-dependent data after category-only patches', async () => {
  const lifecycle = new Lifecycle();
  const store = new ProjectStore({
    lifecycle,
    generation: 0,
    recoverSecurity: async () => {},
    request: createHttpClient({
      lifecycle,
      fetch: async () => Response.json({ ...dto, revision: 2 }),
    }),
  });
  let invalidations = 0;
  store.onInvalidate = () => {
    invalidations++;
  };
  await store.mutate(serverProjectId(id), { revision: 1, categoryId: null });
  expect(invalidations).toBe(1);
  await store.mutate(serverProjectId(id), { revision: 2, name: 'Renamed' });
  expect(invalidations).toBe(2);
});
it('deduplicates cursor rows, keeps higher revisions and stops only on null cursor', async () => {
  let calls = 0;
  const lifecycle = new Lifecycle();
  const store = new ProjectStore({
    lifecycle,
    generation: 0,
    recoverSecurity: async () => {},
    request: createHttpClient({
      lifecycle,
      fetch: async () =>
        Response.json({
          items: [{ ...dto, revision: ++calls === 1 ? 2 : 1 }],
          total: 5,
          nextCursor: calls === 1 ? 'next' : null,
        }),
    }),
  });
  const filter = { category: 'all', status: 'active', query: '' } as const;
  const query = store.list(filter);
  await Promise.all([query.load(), query.load()]);
  expect(calls).toBe(1);
  await store.more(filter);
  expect(query.getSnapshot().data?.items).toHaveLength(1);
  expect(query.getSnapshot().data?.items[0].revision).toBe(2);
  expect(query.getSnapshot().data?.nextCursor).toBeNull();
});
it('shares a Project list query and preserves scroll memory for a detail round trip', async () => {
  let calls = 0;
  const lifecycle = new Lifecycle();
  const store = new ProjectStore({
    lifecycle,
    generation: 0,
    recoverSecurity: async () => {},
    request: createHttpClient({
      lifecycle,
      fetch: async () => {
        calls++;
        return Response.json({ items: [dto], total: 1, nextCursor: null });
      },
    }),
  });
  const filter = { category: 'all', status: 'active', query: '' } as const;
  const first = store.list(filter);
  await first.load();
  const second = store.list(filter);
  await second.load();
  expect(second).toBe(first);
  expect(calls).toBe(1);
  store.rememberScroll(filter, 420);
  expect(store.scrollPosition(filter)).toBe(420);
  store.clearScrollPosition(filter);
  expect(store.scrollPosition(filter)).toBeUndefined();
  store.dispose();
});
it('pre-mutation and retired-generation reads cannot republish entities even when fetch ignores abort', async () => {
  let resolve!: (response: Response) => void;
  const lifecycle = new Lifecycle();
  const store = new ProjectStore({
    lifecycle,
    generation: 0,
    recoverSecurity: async () => {},
    request: createHttpClient({
      lifecycle,
      fetch: () =>
        new Promise((r) => {
          resolve = r;
        }),
    }),
  });
  const query = store.detail(serverProjectId(id)),
    work = query.load();
  await new Promise((r) => setTimeout(r, 0));
  store.invalidate();
  store.adopt(parseProject({ ...dto, revision: 3 }));
  resolve(Response.json(dto));
  await work;
  expect(store.entities.get(serverProjectId(id))?.revision).toBe(3);
  expect(query.getSnapshot().data).toBeUndefined();
  lifecycle.reset();
  expect(store.entities.size).toBe(0);
});
