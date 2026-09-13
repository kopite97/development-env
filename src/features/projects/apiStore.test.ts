import { expect, it } from 'vitest';
import { createHttpClient, Lifecycle } from '../../shared/http/client';
import { ProjectStore } from './apiStore';
import { parseProject, serverProjectId } from './apiModel';
const id = '00000000-0000-0000-0000-000000000001';
const dto = {
  id,
  revision: 1,
  createdAt: '2026-09-13T00:00:00Z',
  updatedAt: '2026-09-13T00:00:00Z',
  name: 'Server',
  subtitle: '',
  scope: 'server',
  stack: 'Java',
  progress: 0,
  currentMilestone: '',
  repositoryUrl: '',
  status: 'active',
  colorToken: 'server',
};
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
  const filter = { scope: 'all', status: 'active', query: '' } as const;
  const query = store.list(filter);
  await Promise.all([query.load(), query.load()]);
  expect(calls).toBe(1);
  await store.more(filter);
  expect(query.getSnapshot().data?.items).toHaveLength(1);
  expect(query.getSnapshot().data?.items[0].revision).toBe(2);
  expect(query.getSnapshot().data?.nextCursor).toBeNull();
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
