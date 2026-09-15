import { afterEach, expect, it, vi } from 'vitest';
import { createHttpClient, Lifecycle } from './client';
import { freshTransport } from './freshTransport';
import { Query } from './query';

afterEach(() => vi.useRealTimers());
it('rejects old derived data, refreshes dependencies once, and never refetches on own unrelated mutations', async () => {
  vi.useFakeTimers();
  const lifecycle = new Lifecycle();
  let stamp = '9007199254740993';
  const transport = freshTransport({
    lifecycle,
    generation: 0,
    recoverSecurity: async () => {},
    request: createHttpClient({
      lifecycle,
      fetch: async () =>
        Response.json({ name: stamp }, { headers: { 'X-Workspace-Data-Revision': stamp } }),
    }),
  });
  const tasks = new Query((signal) =>
    transport.request<{ name: string }>('/api/v2/tasks?category=all', { signal }),
  );
  const projects = new Query((signal) =>
    transport.request('/api/v2/projects?category=all', { signal }),
  );
  await tasks.load();
  const original = tasks.getSnapshot().data;
  stamp = '9007199254740994';
  await projects.load();
  await vi.runAllTimersAsync();
  expect(tasks.getSnapshot().stale).toBe(true);
  stamp = '9007199254740993';
  await tasks.load();
  expect(tasks.getSnapshot().data).toBe(original);
  await vi.runAllTimersAsync();
  await tasks.load();
  await vi.runAllTimersAsync();
  expect(tasks.getSnapshot().status).toBe('error');
  stamp = '9007199254740994';
  await tasks.load();
  expect(tasks.getSnapshot().data?.name).toBe(stamp);
  stamp = '9007199254740995';
  await transport.request('/api/v1/project-categories', { method: 'POST', json: { name: 'New' } });
  await vi.runAllTimersAsync();
  expect(tasks.getSnapshot().stale).toBe(false);
  lifecycle.reset();
  await expect(transport.request('/api/v2/tasks')).rejects.toThrow('cancelled');
});
