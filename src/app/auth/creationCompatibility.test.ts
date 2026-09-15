import { expect, it } from 'vitest';
import { createHttpClient, Lifecycle } from '../../shared/http/client';
import { ProjectStore } from '../../features/projects/apiStore';
import { TaskStore } from '../../features/tasks/apiStore';
import { JournalStore } from '../../features/journal/apiStore';
import { MilestoneStore } from '../../features/milestones/apiStore';
import { LinkStore } from '../../features/links/apiStore';
import type { PrivateTransport } from '../../shared/http/transport';

const id = '00000000-0000-0000-0000-000000000001';
const stamp = '2026-09-15T00:00:00Z';
const common = { id, revision: 3, createdAt: stamp, updatedAt: stamp, categoryId: null };
const fixtures = {
  projects: {
    ...common,
    name: 'Current',
    subtitle: '',
    stack: 'C#',
    progress: 0,
    currentMilestone: '',
    repositoryUrl: '',
    status: 'active',
  },
  tasks: {
    ...common,
    title: 'Current',
    projectId: id,
    projectName: 'Current Project',
    status: 'todo',
    priority: 'normal',
    tag: '',
    description: '',
    deletedAt: null,
  },
  journals: {
    ...common,
    title: 'Current',
    projectId: id,
    projectName: 'Current Project',
    body: 'Body',
    entryDate: '2026-09-15',
  },
  milestones: {
    ...common,
    title: 'Current',
    projectId: id,
    projectName: 'Current Project',
    dueDate: null,
    completed: false,
  },
  links: {
    ...common,
    label: 'Current',
    description: '',
    url: 'https://example.com',
    position: 0,
    projectId: null,
    projectName: null,
  },
};
function operation(resource: keyof typeof fixtures, transport: PrivateTransport, body: object) {
  const endpoint = `/api/v1/${resource}` as const;
  const options = { body, key: 'original-key' };
  switch (resource) {
    case 'projects': {
      const store = new ProjectStore(transport);
      return () => store.mutate(undefined, body, options.key, '/api/v1/projects');
    }
    case 'tasks': {
      const store = new TaskStore(transport);
      return () => store.mutate('create', { ...options, endpoint: '/api/v1/tasks' });
    }
    case 'journals': {
      const store = new JournalStore(transport);
      return () => store.mutate('create', { ...options, endpoint: '/api/v1/journals' });
    }
    case 'milestones': {
      const store = new MilestoneStore(transport);
      return () => store.mutate('create', { ...options, endpoint: '/api/v1/milestones' });
    }
    case 'links': {
      const store = new LinkStore(transport);
      return () => store.mutate('create', { ...options, endpoint: endpoint as '/api/v1/links' });
    }
  }
}
for (const resource of Object.keys(fixtures) as (keyof typeof fixtures)[]) {
  it(`${resource}: historical replay preserves original endpoint, body presence and key, then reads current v2 identity`, async () => {
    const lifecycle = new Lifecycle();
    const body = Object.freeze({
      name: '  Old intent  ',
      projectId: id.toUpperCase(),
      scope: 'unity',
    });
    const calls: { path: string; method?: string; body?: BodyInit | null; key: string | null }[] =
      [];
    const request = createHttpClient({
      lifecycle,
      fetch: async (path, init) => {
        calls.push({
          path: String(path),
          method: init?.method,
          body: init?.body,
          key: new Headers(init?.headers).get('Idempotency-Key'),
        });
        return init?.method === 'POST'
          ? Response.json(
              resource === 'links'
                ? { item: { id, scope: 'unity' }, collectionRevision: 1 }
                : { id, scope: 'unity' },
              { status: 201 },
            )
          : Response.json(fixtures[resource]);
      },
    });
    await operation(
      resource,
      { lifecycle, generation: 0, recoverSecurity: async () => {}, request },
      body,
    )();
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      path: `/api/v1/${resource}`,
      method: 'POST',
      body: JSON.stringify(body),
      key: 'original-key',
    });
    expect(calls[1].path).toBe(`/api/v2/${resource}/${id}`);
    expect(body).not.toHaveProperty('categoryId');
  });
  it(`${resource}: retired API never automatically changes version or creates a new intent`, async () => {
    const lifecycle = new Lifecycle();
    const calls: string[] = [];
    const request = createHttpClient({
      lifecycle,
      fetch: async (path) => {
        calls.push(String(path));
        return Response.json({ code: 'API_VERSION_RETIRED' }, { status: 410 });
      },
    });
    const run = operation(
      resource,
      { lifecycle, generation: 0, recoverSecurity: async () => {}, request },
      Object.freeze({ scope: 'server' }),
    );
    await expect(run()).rejects.toMatchObject({ code: 'API_VERSION_RETIRED', status: 410 });
    expect(calls).toEqual([`/api/v1/${resource}`]);
  });
}
