import { test as base, expect, type Page } from '@playwright/test';

export const id = (n: number) => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');
export const project = (n: number, status: 'active' | 'archived' = 'active') => ({
  id: id(n),
  revision: 1,
  createdAt: '2026-09-13T00:00:00Z',
  updatedAt: '2026-09-13T00:00:00Z',
  name: 'Project ' + n,
  subtitle: '',
  scope: n % 2 ? 'unity' : 'server',
  stack: n % 2 ? 'C#' : 'Java',
  progress: 0,
  currentMilestone: '',
  repositoryUrl: '',
  status,
  categoryId: null,

  colorToken: n % 2 ? 'unity' : 'server',
});
export const journal = (n: number, overrides: Record<string, unknown> = {}) => ({
  id: id(200 + n),
  revision: 1,
  createdAt: '2026-09-13T10:00:00Z',
  updatedAt: '2026-09-13T10:00:00Z',
  title: 'Journal ' + n,
  projectId: id(1),
  projectName: 'Project 1',
  categoryId: null,
  body: 'Body ' + n,
  entryDate: '2026-09-' + String(10 + n).padStart(2, '0'),
  ...overrides,
});
export const identity = {
  id: id(101),
  displayName: 'Alice',
  workspace: { id: id(102), name: 'Workspace', revision: 1 },
};

export const defaults = [
  {
    id: 'home-overview',
    type: 'overview',
    title: '프로젝트 개요',
    selection: { kind: 'all' },
    size: 'wide',
  },
  { id: 'home-board', type: 'board', title: '작업 보드', selection: { kind: 'all' }, size: 'wide' },
  { id: 'home-deploy', type: 'deploy', title: '운영', selection: { kind: 'all' }, size: 'medium' },
  { id: 'home-links', type: 'links', title: '바로가기', selection: { kind: 'all' }, size: 'small' },
  {
    id: 'home-journal',
    type: 'journal',
    title: '개발 일지',
    selection: { kind: 'all' },
    size: 'medium',
  },
  {
    id: 'home-milestone',
    type: 'milestone',
    title: '마일스톤',
    selection: { kind: 'all' },
    size: 'medium',
  },
];
export const dashboard = (revision = 0, widgets = defaults) => ({
  id: 'home',
  schemaVersion: 2,
  revision,
  widgets: widgets.map((widget) => ({ ...widget, selectionState: 'valid' })),
});
export async function setup(page: Page) {
  await page.route('**/api/v2/dashboards/home', (route) => route.fulfill({ json: dashboard() }));
  await page.route('**/api/v1/me', (route) => route.fulfill({ json: identity }));
  await page.route('**/api/v1/project-categories', (route) =>
    route.fulfill({ json: { items: [], total: 0 } }),
  );
  await page.route('**/api/v1/auth/csrf', (route) =>
    route.fulfill({ json: { csrfToken: 'test-token' } }),
  );
  await page.route('**/api/v2/overview?*', (route) =>
    route.fulfill({
      json: {
        category: new URL(route.request().url()).searchParams.get('category') ?? 'all',
        projectId: new URL(route.request().url()).searchParams.get('projectId'),
        projects: {
          total: 2,
          archived: 1,
          byCategory: [{ categoryId: null, total: 2, archived: 1 }],
        },
        tasks: { todo: 0, doing: 0, done: 0, total: 0 },
        asOf: '2026-09-13T00:00:00Z',
      },
    }),
  );
  await page.route('**/api/v2/projects?*', (route) =>
    route.fulfill({ json: { items: [project(1), project(2)], total: 2, nextCursor: null } }),
  );
  await page.route('**/api/v2/projects/*', (route) => route.fulfill({ json: project(1) }));
  await page.route('**/api/v2/projects/category-counts', (route) =>
    route.fulfill({
      json: {
        items: [{ categoryId: null, active: 2, archived: 1 }],
        totals: { active: 2, archived: 1 },
      },
    }),
  );
  await page.route('**/api/v2/tasks?*', (route) =>
    route.fulfill({ json: { items: [], total: 0, nextCursor: null } }),
  );
  await page.route('**/api/v2/tasks/stats?*', (route) =>
    route.fulfill({
      json: { counts: { todo: 0, doing: 0, done: 0 }, total: 0, asOf: '2026-09-13T00:00:00Z' },
    }),
  );
  await page.route('**/api/v2/links?*', (route) =>
    route.fulfill({ json: { items: [], total: 0, nextCursor: null, collectionRevision: 0 } }),
  );
  await page.route('**/api/v2/milestones?*', (route) =>
    route.fulfill({ json: { items: [], total: 0, nextCursor: null } }),
  );
  await page.route('**/api/v2/journals?*', (route) =>
    route.fulfill({ json: { items: [], total: 0, nextCursor: null } }),
  );
}

export const test = base.extend<{ isolation: void }>({
  isolation: [
    async ({ context, page }, use) => {
      const excluded: string[] = [];
      const errors: string[] = [];
      const sentinels = [
        'projects',
        'tasks',
        'journals',
        'milestones',
        'links',
        'layout',
        'unrelated',
      ].map((name) => ['devspace.' + name + '.v1', '{preserve-' + name] as const);
      const observe = (target: Page) =>
        target.on('pageerror', (error) => errors.push(error.message));
      observe(page);
      context.on('page', observe);
      context.on('request', (request) => {
        const pathname = new URL(request.url()).pathname;
        if (
          pathname.startsWith('/api/') &&
          !/^\/api\/(?:v1\/(?:me$|auth\/|project-categories(?:\/|$))|v2\/(?:projects(?:\/|$)|tasks(?:\/|$)|journals(?:\/|$)|milestones(?:\/|$)|links(?:\/|$)|dashboards\/home$|overview$))/.test(
            pathname,
          )
        )
          excluded.push(pathname);
      });
      await context.addInitScript((values) => {
        if (location.origin !== 'http://127.0.0.1:4183') return;
        for (const [key, value] of values)
          if (!Object.hasOwn(localStorage, key)) localStorage.setItem(key, value);
        for (const key of ['getItem', 'setItem', 'removeItem', 'clear'] as const)
          Storage.prototype[key] = () => {
            throw new Error('Business storage access');
          };
      }, sentinels);
      await use();
      expect(excluded).toEqual([]);
      expect(errors).toEqual([]);
      for (const target of context.pages())
        if (target.url().startsWith('http://127.0.0.1:4183'))
          expect(await target.evaluate(() => Object.entries(localStorage).sort())).toEqual(
            sentinels.map(([key, value]) => [key, value]).sort(),
          );
    },
    { auto: true },
  ],
});
export { expect };
