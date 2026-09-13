import { defaultLayout as savedHomeFixture } from '../../src/features/dashboard/model';
import { test as base, expect, type Page } from '@playwright/test';
export const id = (n: number) => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');
export const project = (n: number) => ({
  id: id(n),
  revision: 1,
  createdAt: '2026-09-13T00:00:00Z',
  updatedAt: '2026-09-13T00:00:00Z',
  name: 'Project ' + n,
  subtitle: '',
  scope: 'unity',
  stack: 'C#',
  progress: 12.5,
  currentMilestone: 'memo',
  repositoryUrl: '',
  status: 'active',
  colorToken: 'unity',
});
export const identity = {
  id: id(101),
  displayName: 'Alice',
  workspace: { id: id(102), name: 'Workspace', revision: 1 },
};
export const overview = (scope = 'all', projectId: string | null = null) => ({
  scope,
  projectId,
  projects: {
    total: 24,
    archived: 2,
    byScope: { unity: { total: 24, archived: 2 }, server: { total: 0, archived: 0 } },
  },
  tasks: { todo: 5, doing: 2, done: 3, total: 10 },
  asOf: '2026-09-13T00:00:00Z',
});
export async function setup(page: Page) {
  await page.route('**/api/v1/me', (route) => route.fulfill({ json: identity }));
  await page.route('**/api/v1/auth/csrf', (route) =>
    route.fulfill({ json: { csrfToken: 'test-token' } }),
  );
  await page.route('**/api/v1/overview?*', (route) => {
    const p = new URL(route.request().url()).searchParams;
    return route.fulfill({ json: overview(p.get('scope') ?? 'all', p.get('projectId')) });
  });
}
export const test = base.extend<{ isolation: void }>({
  isolation: [
    async ({ context }, use) => {
      const excluded: string[] = [],
        errors: string[] = [];
      context.on('request', (r) => {
        const p = new URL(r.url()).pathname;
        if (
          p.startsWith('/api/') &&
          !/^\/api\/v1\/(me$|auth\/|projects(?:\/|$)|tasks(?:\/|$)|journals(?:\/|$)|milestones(?:\/|$)|links(?:\/|$)|dashboards\/home$|overview$)/.test(
            p,
          )
        )
          excluded.push(p);
      });
      context.on('page', (page) => page.on('pageerror', (e) => errors.push(e.message)));
      await context.addInitScript(() => {
        if (location.origin !== 'http://127.0.0.1:4178') return;
        for (const name of [
          'projects',
          'tasks',
          'journals',
          'milestones',
          'links',
          'layout',
          'unrelated',
        ])
          if (!Object.hasOwn(localStorage, 'devspace.' + name + '.v1'))
            localStorage.setItem('devspace.' + name + '.v1', '{preserve-' + name);
        for (const key of ['getItem', 'setItem', 'removeItem', 'clear'] as const)
          Storage.prototype[key] = () => {
            throw new Error('Business storage access');
          };
      });
      await context.route('**/api/v1/tasks?*', (route) =>
        route.fulfill({ json: { items: [], total: 0, nextCursor: null } }),
      );
      await context.route('**/api/v1/tasks/stats?*', (route) =>
        route.fulfill({
          json: { counts: { todo: 0, doing: 0, done: 0 }, total: 0, asOf: '2026-09-13T00:00:00Z' },
        }),
      );
      await context.route('**/api/v1/links?*', (route) =>
        route.fulfill({ json: { items: [], total: 0, nextCursor: null, collectionRevision: 0 } }),
      );
      await context.route('**/api/v1/milestones?*', (route) =>
        route.fulfill({ json: { items: [], total: 0, nextCursor: null } }),
      );
      await context.route('**/api/v1/journals?*', (route) =>
        route.fulfill({ json: { items: [], total: 0, nextCursor: null } }),
      );
      await context.route('**/api/v1/dashboards/home', (route) =>
        route.fulfill({
          json: { id: 'home', schemaVersion: 1, revision: 1, widgets: savedHomeFixture },
        }),
      );
      await use();
      expect(excluded).toEqual([]);
      expect(errors).toEqual([]);
      for (const page of context.pages())
        if (page.url().startsWith('http://127.0.0.1:4178'))
          expect(await page.evaluate(() => Object.entries(localStorage).sort())).toEqual(
            ['projects', 'tasks', 'journals', 'milestones', 'links', 'layout', 'unrelated']
              .map((name) => ['devspace.' + name + '.v1', '{preserve-' + name])
              .sort(),
          );
    },
    { auto: true },
  ],
});
export { expect };
