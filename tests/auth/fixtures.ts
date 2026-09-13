import { test as base, expect } from '@playwright/test';
const sentinels = Object.fromEntries(
  ['projects', 'tasks', 'journals', 'milestones', 'links', 'layout', 'unrelated'].map(
    (name, index) => [
      'devspace.' + name + '.v1',
      index % 2 ? '{broken-preserve' : '[{"id":"user-edit","title":"Keep"}]',
    ],
  ),
);
export const test = base.extend<{ authIsolation: void }>({
  authIsolation: [
    async ({ context }, use) => {
      const excluded: string[] = [];
      context.on('request', (request) => {
        const path = new URL(request.url()).pathname;
        if (
          path.startsWith('/api/') &&
          !/^\/api\/v1\/(me$|auth\/|projects(?:\/|$)|tasks(?:\/|$)|overview$)/.test(path)
        )
          excluded.push(path);
      });
      await context.addInitScript((sentinels) => {
        if (!Object.hasOwn(localStorage, 'devspace.unrelated.v1'))
          for (const [key, value] of Object.entries(sentinels)) localStorage.setItem(key, value);
        Storage.prototype.getItem = () => {
          throw new Error('Auth must not read browser storage');
        };
        Storage.prototype.setItem = () => {
          throw new Error('Auth must not write browser storage');
        };
        Storage.prototype.removeItem = () => {
          throw new Error('Auth must not remove browser storage');
        };
        Storage.prototype.clear = () => {
          throw new Error('Auth must not clear browser storage');
        };
      }, sentinels);
      await context.route('**/api/v1/overview?*', (route) => {
        const p = new URL(route.request().url()).searchParams;
        return route.fulfill({
          json: {
            scope: p.get('scope') ?? 'all',
            projectId: p.get('projectId'),
            projects: {
              total: 0,
              archived: 0,
              byScope: { unity: { total: 0, archived: 0 }, server: { total: 0, archived: 0 } },
            },
            tasks: { todo: 0, doing: 0, done: 0, total: 0 },
            asOf: '2026-09-13T00:00:00Z',
          },
        });
      });
      await context.route('**/api/v1/projects?*', (route) =>
        route.fulfill({ json: { items: [], total: 0, nextCursor: null } }),
      );
      await context.route('**/api/v1/tasks?*', (route) =>
        route.fulfill({ json: { items: [], total: 0, nextCursor: null } }),
      );
      await context.route('**/api/v1/tasks/stats?*', (route) =>
        route.fulfill({
          json: { counts: { todo: 0, doing: 0, done: 0 }, total: 0, asOf: '2026-09-13T00:00:00Z' },
        }),
      );
      await use();
      expect(excluded).toEqual([]);
      for (const page of context.pages())
        if (page.url().startsWith('http://127.0.0.1:4176'))
          expect(
            await page.evaluate(() => Object.fromEntries(Object.entries(localStorage))),
          ).toEqual(sentinels);
    },
    { auto: true },
  ],
});
export { expect };
