import { test, expect, setup, project, journal, id, dashboard, defaults } from './fixtures';
import type { Page } from '@playwright/test';

const a = id(801),
  b = id(802);
async function categorySetup(page: Page) {
  await setup(page);
  const categories = [
    {
      id: a,
      name: '클라이언트',
      revision: 1,
      createdAt: '2026-09-15T00:00:00Z',
      updatedAt: '2026-09-15T00:00:00Z',
    },
    {
      id: b,
      name: '플랫폼',
      revision: 1,
      createdAt: '2026-09-15T00:00:00Z',
      updatedAt: '2026-09-15T00:00:00Z',
    },
  ];
  const projects = [
    { ...project(1), categoryId: a },
    { ...project(2), categoryId: b },
    { ...project(3), categoryId: null },
  ];
  const requests: URL[] = [];
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  let revision = 1;
  const select = (url: URL) =>
    projects.filter(
      (p) =>
        (!url.searchParams.get('projectId') || p.id === url.searchParams.get('projectId')) &&
        (!url.searchParams.get('category') ||
          url.searchParams.get('category') === 'all' ||
          (url.searchParams.get('category') === 'uncategorized'
            ? p.categoryId === null
            : p.categoryId === url.searchParams.get('category'))),
    );
  await page.route('**/api/v1/project-categories', async (route) =>
    route.fulfill({
      json: { items: categories, total: categories.length },
      headers: { 'X-Workspace-Data-Revision': String(revision) },
    }),
  );
  await page.route('**/api/v2/**', async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname;
    requests.push(url);
    expect(url.searchParams.has('scope')).toBe(false);
    const headers = { 'X-Workspace-Data-Revision': String(revision) };
    const rows = select(url);
    if (route.request().method() !== 'GET') {
      const body = route.request().postDataJSON();
      writes.push({ path, body });
      expect(body).not.toHaveProperty('scope');
      if (path.startsWith('/api/v2/projects/')) {
        const p = projects.find((item) => path.endsWith(item.id))!;
        Object.assign(p, body, { revision: p.revision + 1 });
        revision++;
        return route.fulfill({
          json: p,
          headers: { 'X-Workspace-Data-Revision': String(revision) },
        });
      }
      if (path === '/api/v2/dashboards/home')
        return route.fulfill({ json: dashboard(Number(body.revision) + 1, body.widgets) });
      return route.fulfill({ status: 500, json: { code: 'TEST_FAILURE' } });
    }
    if (path === '/api/v2/projects/category-counts')
      return route.fulfill({
        headers,
        json: {
          items: [
            ...categories.map((c) => ({
              categoryId: c.id,
              active: projects.filter((p) => p.categoryId === c.id && p.status === 'active').length,
              archived: projects.filter((p) => p.categoryId === c.id && p.status === 'archived')
                .length,
            })),
            { categoryId: null, active: 1, archived: 0 },
          ],
          totals: {
            active: projects.filter((p) => p.status === 'active').length,
            archived: projects.filter((p) => p.status === 'archived').length,
          },
        },
      });
    if (path.startsWith('/api/v2/projects/'))
      return route.fulfill({ headers, json: projects.find((p) => path.endsWith(p.id)) });
    if (path === '/api/v2/projects')
      return route.fulfill({
        headers,
        json: { items: rows, total: rows.length, nextCursor: null },
      });
    if (path === '/api/v2/dashboards/home') return route.fulfill({ headers, json: dashboard() });
    if (path === '/api/v2/overview')
      return route.fulfill({
        headers,
        json: {
          category: url.searchParams.get('category') ?? 'all',
          projectId: url.searchParams.get('projectId'),
          projects: {
            total: rows.length,
            archived: 0,
            byCategory: rows.map((p) => ({ categoryId: p.categoryId, total: 1, archived: 0 })),
          },
          tasks: { todo: rows.length, doing: 0, done: 0, total: rows.length },
          asOf: '2026-09-15T00:00:00Z',
        },
      });
    if (path === '/api/v2/tasks/stats')
      return route.fulfill({
        headers,
        json: {
          counts: { todo: rows.length, doing: 0, done: 0 },
          total: rows.length,
          asOf: '2026-09-15T00:00:00Z',
        },
      });
    if (path === '/api/v2/tasks') {
      const items =
        url.searchParams.get('status') && url.searchParams.get('status') !== 'todo'
          ? []
          : rows.map((p) => ({
              id: id(100 + Number(p.id.slice(-3))),
              title: 'Task ' + p.name,
              projectId: p.id,
              projectName: p.name,
              categoryId: p.categoryId,
              revision: 1,
              status: 'todo',
              priority: 'normal',
              description: '',
              tag: '',
              deletedAt: null,
              createdAt: p.createdAt,
              updatedAt: p.updatedAt,
            }));
      return route.fulfill({ headers, json: { items, total: items.length, nextCursor: null } });
    }
    if (path === '/api/v2/journals')
      return route.fulfill({
        headers,
        json: {
          items: rows.map((p, index) =>
            journal(index + 1, {
              title: 'Journal ' + p.name,
              projectId: p.id,
              projectName: p.name,
              categoryId: p.categoryId,
            }),
          ),
          total: rows.length,
          nextCursor: null,
        },
      });
    if (path === '/api/v2/milestones')
      return route.fulfill({
        headers,
        json: {
          items: rows.map((p, index) => ({
            id: id(400 + index),
            revision: 1,
            title: 'Milestone ' + p.name,
            projectId: p.id,
            projectName: p.name,
            categoryId: p.categoryId,
            dueDate: null,
            completed: false,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
          })),
          total: rows.length,
          nextCursor: null,
        },
      });
    if (path === '/api/v2/links')
      return route.fulfill({
        headers,
        json: {
          items: rows.map((p, index) => ({
            id: id(500 + index),
            revision: 1,
            position: index,
            label: 'Link ' + p.name,
            description: '',
            url: 'https://example.com/' + index,
            projectId: p.id,
            projectName: p.name,
            categoryId: p.categoryId,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
          })),
          total: rows.length,
          nextCursor: null,
          collectionRevision: 1,
        },
      });
    return route.fulfill({ status: 404, json: { code: 'RESOURCE_NOT_FOUND' } });
  });
  return { categories, projects, requests, writes, changed: () => revision++ };
}

for (const [path, resource, selector] of [
  ['/tasks', 'tasks', '.task'],
  ['/journals', 'journals', '.document-row'],
  ['/library', 'links', '.quick-links strong'],
] as const) {
  test(
    path + ' keeps URL-driven Project intersections through navigation and refresh',
    async ({ page }) => {
      const state = await categorySetup(page);
      await page.goto(path + '?category=' + a + '&projectId=' + id(1));
      await expect(page.locator(selector)).toHaveCount(1);
      await page.getByLabel('개발 분야 필터', { exact: true }).selectOption(b);
      await expect(page.locator(selector)).toHaveCount(0);
      await expect(page).toHaveURL(new RegExp('projectId=' + id(1)));
      expect(
        state.requests.some(
          (url) =>
            url.pathname === '/api/v2/' + resource &&
            url.searchParams.get('category') === b &&
            url.searchParams.get('projectId') === id(1),
        ),
      ).toBe(true);
      await page.goBack();
      await expect(page.locator(selector)).toHaveCount(1);
      await page.reload();
      await expect(page.locator(selector)).toHaveCount(1);
      const projectSelect = page.getByRole('combobox', {
        name: path === '/journals' ? '일지 프로젝트 필터' : '프로젝트 필터',
        exact: true,
      });
      await projectSelect.selectOption(id(2));
      await expect(page.locator(selector)).toHaveCount(0);
      await page.getByLabel('개발 분야 필터', { exact: true }).selectOption('all');
      await expect(page.locator(selector)).toHaveCount(1);
      await expect(page.locator(selector)).toContainText('Project 2');
      expect(state.writes).toEqual([]);
    },
  );
}

test('external Category membership changes refresh cached equal-revision child queries and Project options', async ({
  page,
}) => {
  const state = await categorySetup(page);
  await page.goto('/?category=' + a);
  await expect(page.getByText('Task Project 1', { exact: true })).toBeVisible();
  state.projects[0].categoryId = b;
  state.projects[0].name = '외부 변경 프로젝트';
  state.changed();
  await page.locator('.project-row').click();
  await expect(
    page.getByRole('heading', { name: '외부 변경 프로젝트', exact: true }),
  ).toBeVisible();
  await page.locator('.sidebar nav').getByRole('button', { name: '나의 홈' }).click();
  await page.getByLabel('개발 분야 필터', { exact: true }).selectOption(b);
  await expect(page.getByText('Task 외부 변경 프로젝트', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Home 프로젝트').locator(`option[value="${id(1)}"]`)).toHaveText(
    '외부 변경 프로젝트',
  );
  const count = state.requests.length;
  await page.waitForTimeout(300);
  expect(state.requests.length).toBe(count);
});

test('Home Category changes real widget reads/content and restores URL history without PUT', async ({
  page,
}) => {
  const state = await categorySetup(page);
  await page.goto('/');
  await expect(page.locator('.project-row')).toHaveCount(3);
  const select = page.getByLabel('개발 분야 필터', { exact: true });
  for (const [category, name] of [
    [a, 'Project 1'],
    [b, 'Project 2'],
    ['uncategorized', 'Project 3'],
  ] as const) {
    await select.selectOption(category);
    await expect(page.locator('.project-row')).toHaveCount(1);
    await expect(page.locator('.project-row')).toContainText(name);
    for (const prefix of ['Task', 'Journal', 'Milestone', 'Link'])
      await expect(page.getByText(prefix + ' ' + name, { exact: true }).first()).toBeVisible();
    for (const resource of ['overview', 'tasks', 'journals', 'milestones', 'links'])
      expect(
        state.requests.some(
          (url) =>
            url.pathname === '/api/v2/' + resource && url.searchParams.get('category') === category,
        ),
      ).toBe(true);
  }
  await page.goBack();
  await expect(select).toHaveValue(b);
  await expect(page.locator('.project-row')).toContainText('Project 2');
  await page.goForward();
  await expect(select).toHaveValue('uncategorized');
  await page.reload();
  await expect(page.locator('.project-row')).toContainText('Project 3');
  await select.selectOption('all');
  await expect(page.locator('.project-row')).toHaveCount(3);
  expect(state.writes).toEqual([]);
});

for (const [path, text] of [
  ['/projects', 'Project 1'],
  ['/tasks', 'Task Project 1'],
  ['/journals', 'Journal Project 1'],
  ['/library', 'Link Project 1'],
] as const) {
  test(
    path + ' restores Category on direct load/refresh and uses the authenticated shell',
    async ({ page }) => {
      await categorySetup(page);
      await page.goto(path + '?category=' + a);
      await expect(page.locator('.app-shell')).toHaveCount(1);
      await expect(page.getByLabel('개발 분야 필터', { exact: true })).toHaveValue(a);
      await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
      await page.reload();
      await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
      await expect(page.getByText('호환 범위', { exact: true })).toHaveCount(0);
    },
  );
}

test('Project editor changes only categoryId and keeps detail presentation and sections', async ({
  page,
}) => {
  const state = await categorySetup(page);
  await page.goto('/projects/' + id(1));
  await expect(page.getByRole('heading', { name: 'Project 1', exact: true })).toBeVisible();
  await expect(page.getByText('클라이언트', { exact: true }).last()).toBeVisible();
  await page.getByRole('button', { name: '프로젝트 편집', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('호환 범위', { exact: true })).toHaveCount(0);
  await page.getByLabel('개발 분야', { exact: true }).selectOption(b);
  await page.getByRole('button', { name: '프로젝트 저장', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.writes[0].body).toEqual({ revision: 1, categoryId: b });
  await expect(page.getByRole('region', { name: '프로젝트 기본 정보' })).toContainText('플랫폼');
  await expect(page.getByRole('heading', { name: '최근 개발 일지', exact: true })).toBeVisible();
});

test('missing Category stays unavailable, while a Home override does not repair saved selection', async ({
  page,
}) => {
  const state = await categorySetup(page);
  const widgets = [
    {
      ...defaults[3],
      selection: { kind: 'category', categoryId: id(999) },
      selectionState: 'missingCategory',
    },
  ];
  await page.route('**/api/v2/dashboards/home', (route) =>
    route.fulfill({ json: { id: 'home', revision: 4, schemaVersion: 2, widgets } }),
  );
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('사용할 수 없는 개발 분야');
  await page.getByLabel('개발 분야 필터', { exact: true }).selectOption(a);
  await expect(page.getByText('Link Project 1', { exact: true })).toBeVisible();
  expect(state.writes).toEqual([]);
});

test('old scope links require explicit recovery and do not issue broadened feature reads', async ({
  page,
}) => {
  const state = await categorySetup(page);
  await page.goto('/?scope=unity');
  await expect(page.getByRole('alert')).toContainText('이전 개발 범위 링크');
  expect(
    state.requests.some((url) => /\/(tasks|journals|links|overview)$/.test(url.pathname)),
  ).toBe(false);
  await page.getByRole('button', { name: '전체 프로젝트 보기' }).click();
  await expect(page.locator('.project-row')).toHaveCount(3);
});

for (const size of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`responsive Category shell ${size.width}x${size.height}`, async ({ page }, info) => {
    const state = await categorySetup(page);
    state.categories[0].name = '매우 긴 개발 분야 이름을 사용하는 프로젝트 분류';
    for (let index = 2; index < 100; index++)
      state.categories.push({
        ...state.categories[0],
        id: id(900 + index),
        name: `추가 개발 분야 ${index}`,
      });
    await page.setViewportSize(size);
    for (const path of [
      '/',
      '/projects',
      '/projects/' + id(1),
      '/tasks',
      '/journals',
      '/library',
    ]) {
      await page.goto(path);
      await expect(page.locator('.page-heading')).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: info.outputPath(path.replaceAll('/', '_') + '.png'),
        fullPage: true,
      });
    }
    if (size.width < 768) await page.getByRole('button', { name: '메뉴 열기' }).click();
    await page.locator('.sidebar .profile').scrollIntoViewIfNeeded();
    await expect(page.locator('.sidebar .profile')).toBeInViewport();
    await page.locator('.sidebar').getByRole('button', { name: '추가 개발 분야 99' }).click();
    await expect(page).toHaveURL(new RegExp('category=' + id(999)));
    await expect(page.getByLabel('개발 분야 필터', { exact: true })).toHaveValue(id(999));
  });
}
