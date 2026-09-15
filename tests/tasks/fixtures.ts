import { savedHomeFixture } from '../api-fixtures';
import { test as base, expect, type Page } from '@playwright/test';
import { id, identity, overview, project } from '../projects/fixtures';
export { id, identity, project };
export const task = (n = 50) => ({
  id: id(n),
  revision: 1,
  title: 'Task ' + n,
  projectId: id(1),
  projectName: 'Project 1',
  categoryId: null,
  status: 'todo',
  priority: 'normal',
  tag: '',
  description: '',
  createdAt: '2026-09-13T00:00:00Z',
  updatedAt: '2026-09-13T00:00:00Z',
  deletedAt: null as string | null,
});
export async function setup(page: Page) {
  const state = {
    identity,
    tasks: [task()],
    writes: [] as { method: string; body: Record<string, unknown>; key?: string }[],
    requests: [] as URL[],
  };
  await page.route('**/api/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      p = url.searchParams;
    state.requests.push(url);
    if (url.pathname === '/api/v2/dashboards/home')
      return route.fulfill({
        json: { id: 'home', schemaVersion: 2, revision: 1, widgets: savedHomeFixture },
      });
    if (url.pathname === '/api/v1/me') return route.fulfill({ json: state.identity });
    if (url.pathname === '/api/v1/project-categories')
      return route.fulfill({ json: { items: [], total: 0 } });
    if (url.pathname === '/api/v1/auth/csrf') return route.fulfill({ json: { csrfToken: 'test' } });
    if (url.pathname === '/api/v2/overview')
      return route.fulfill({ json: overview(p.get('category') ?? 'all', p.get('projectId')) });
    if (url.pathname === '/api/v2/projects')
      return route.fulfill({ json: { items: [project(1)], total: 1, nextCursor: null } });
    if (url.pathname === '/api/v2/projects/category-counts')
      return route.fulfill({
        json: {
          items: [{ categoryId: null, active: 1, archived: 0 }],
          totals: { active: 1, archived: 0 },
        },
      });
    if (url.pathname.startsWith('/api/v2/projects/')) return route.fulfill({ json: project(1) });
    if (url.pathname === '/api/v2/links')
      return route.fulfill({
        json: { items: [], total: 0, nextCursor: null, collectionRevision: 0 },
      });
    if (url.pathname === '/api/v2/journals' || url.pathname === '/api/v2/milestones')
      return route.fulfill({ json: { items: [], total: 0, nextCursor: null } });
    const rows = state.tasks.filter(
      (t) =>
        (!p.get('category') ||
          p.get('category') === 'all' ||
          (p.get('category') === 'uncategorized'
            ? t.categoryId === null
            : t.categoryId === p.get('category'))) &&
        (!p.get('projectId') || t.projectId === p.get('projectId')) &&
        (!p.get('query') ||
          t.title.includes(p.get('query')!) ||
          t.projectName.includes(p.get('query')!)),
    );
    if (url.pathname === '/api/v2/tasks/stats') {
      const live = rows.filter((t) => !t.deletedAt);
      return route.fulfill({
        json: {
          counts: Object.fromEntries(
            ['todo', 'doing', 'done'].map((status) => [
              status,
              live.filter((t) => t.status === status).length,
            ]),
          ),
          total: live.length,
          asOf: task().createdAt,
        },
      });
    }
    if (url.pathname === '/api/v2/tasks' && req.method() === 'GET') {
      const items = rows.filter(
        (t) =>
          Boolean(t.deletedAt) === (p.get('deleted') === 'true') &&
          (!p.get('status') || t.status === p.get('status')),
      );
      return route.fulfill({
        json: {
          items: items.slice(0, Number(p.get('limit') ?? 20)),
          total: items.length,
          nextCursor: null,
        },
      });
    }
    if (url.pathname.startsWith('/api/v2/tasks')) {
      const row = state.tasks.find((t) => url.pathname.split('/')[4] === t.id);
      if (req.method() === 'GET')
        return route.fulfill({
          status: row ? 200 : 404,
          json: row ?? { code: 'RESOURCE_NOT_FOUND' },
        });
      const body = req.postData() ? req.postDataJSON() : {};
      state.writes.push({ method: req.method(), body, key: req.headers()['idempotency-key'] });
      if (url.pathname === '/api/v2/tasks') {
        const created = { ...task(51), ...body };
        state.tasks.push(created);
        return route.fulfill({ status: 201, json: created });
      }
      if (!row) return route.fulfill({ status: 404, json: { code: 'RESOURCE_NOT_FOUND' } });
      Object.assign(row, body, { revision: row.revision + 1 });
      if (req.method() === 'DELETE') row.deletedAt = row.createdAt;
      if (url.pathname.endsWith('/restore')) row.deletedAt = null;
      return route.fulfill({ json: row });
    }
    throw new Error('Unexpected API ' + url.pathname);
  });
  return state;
}
const keys = ['projects', 'tasks', 'journals', 'milestones', 'links', 'layout', 'unrelated'];
export const test = base.extend<{ isolation: void }>({
  isolation: [
    async ({ context }, use) => {
      const errors: string[] = [],
        excluded: string[] = [];
      context.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)));
      context.on('request', (request) => {
        const p = new URL(request.url()).pathname;
        if (
          p.startsWith('/api/') &&
          !/^\/api\/(?:v1\/(?:me$|auth\/|project-categories(?:\/|$))|v2\/(?:projects(?:\/|$)|tasks(?:\/|$)|journals(?:\/|$)|milestones(?:\/|$)|links(?:\/|$)|dashboards\/home$|overview$))/.test(
            p,
          )
        )
          excluded.push(p);
      });
      await context.addInitScript((keys) => {
        if (location.origin !== 'http://127.0.0.1:4179') return;
        for (const key of keys)
          if (!Object.hasOwn(localStorage, 'devspace.' + key + '.v1'))
            localStorage.setItem(
              'devspace.' + key + '.v1',
              key === 'tasks'
                ? '[{"id":"00000000-0000-0000-0000-000000000050","projectId":"00000000-0000-0000-0000-000000000001","title":"Never import"}]'
                : '{preserve',
            );
        for (const method of ['getItem', 'setItem', 'removeItem', 'clear'])
          Object.defineProperty(Storage.prototype, method, {
            value: () => {
              throw new Error('Storage authority forbidden');
            },
          });
      }, keys);
      await context.route('**/api/v2/dashboards/home', (route) =>
        route.fulfill({
          json: { id: 'home', schemaVersion: 2, revision: 1, widgets: savedHomeFixture },
        }),
      );
      await context.route('**/api/v2/projects/category-counts', (route) =>
        route.fulfill({
          json: {
            items: [{ categoryId: null, active: 0, archived: 0 }],
            totals: { active: 0, archived: 0 },
          },
        }),
      );
      await use();
      expect(errors).toEqual([]);
      expect(excluded).toEqual([]);
      for (const page of context.pages())
        if (page.url().startsWith('http://127.0.0.1:4179')) {
          const values = await page.evaluate(() =>
            Object.fromEntries(Object.entries(localStorage)),
          );
          expect(Object.keys(values)).toHaveLength(keys.length);
          expect(values['devspace.tasks.v1']).toContain('Never import');
          for (const key of keys.filter((k) => k !== 'tasks'))
            expect(values['devspace.' + key + '.v1']).toBe('{preserve');
        }
    },
    { auto: true },
  ],
});
export { expect };
