import { test, expect, setup, project, id, overview } from './fixtures';
test('Overview is independent of pages, search and list failure; mutations invalidate counters', async ({
  page,
}) => {
  await setup(page);
  let queries: URL[] = [],
    archived = false;
  await page.route('**/api/v2/overview?*', (route) => {
    const url = new URL(route.request().url());
    queries.push(url);
    const data = overview(url.searchParams.get('category')!, url.searchParams.get('projectId'));
    data.projects.archived = archived ? 3 : 2;
    return route.fulfill({ json: data });
  });
  await page.route('**/api/v2/projects?*', (route) =>
    route.request().url().includes('query=fail')
      ? route.fulfill({ status: 503, json: {} })
      : route.fulfill({ json: { items: [project(1)], total: 99, nextCursor: null } }),
  );
  await page.route('**/api/v2/projects/' + id(1), (route) => {
    if (route.request().method() === 'PATCH') archived = true;
    return route.fulfill({
      json: { ...project(1), revision: archived ? 2 : 1, status: archived ? 'archived' : 'active' },
    });
  });
  await page.goto('/projects');
  await expect(page.locator('.project-row')).toHaveCount(1);
  const counters = page.locator('.stats strong');
  await expect(counters.first()).toHaveText('24개');
  await page.getByLabel('현재 화면 검색').fill('fail');
  await expect(page.getByText('프로젝트를 불러오지 못했습니다.')).toBeVisible();
  await expect(counters.first()).toHaveText('24개');
  expect(queries).toHaveLength(1);
  await page.goto('/projects/' + id(1) + '?category=uncategorized&q=fail&archived=true');
  await expect(
    page.getByRole('region', { name: '프로젝트 작업', exact: true }).locator('.panel-heading'),
  ).toContainText('전체 10개');
  expect(queries.at(-1)?.searchParams.get('category')).toBe('all');
  expect([...queries.at(-1)!.searchParams.keys()].sort()).toEqual(['category', 'projectId']);
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '프로젝트 편집', exact: true }).click();
  await page.getByRole('button', { name: '프로젝트 보관', exact: true }).click();
  await expect(page.locator('.project-summary')).toContainText('보관됨');
  await page.getByRole('button', { name: '프로젝트 목록' }).click();
  await expect(counters.first()).toHaveText('3개');
});
test('failed counters never become zero, while valid zero snapshots remain usable', async ({
  page,
}) => {
  await setup(page);
  let fail = true;
  await page.route('**/api/v2/projects?*', (route) =>
    route.fulfill({ json: { items: [], total: 0, nextCursor: null } }),
  );
  await page.route('**/api/v2/overview?*', (route) => {
    const data = overview(new URL(route.request().url()).searchParams.get('category') ?? 'all');
    data.projects = {
      total: 0,
      archived: 0,
      byCategory: [{ categoryId: null, total: 0, archived: 0 }],
    };
    data.tasks = { total: 0, todo: 0, doing: 0, done: 0 };
    return fail ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ json: data });
  });
  await page.goto('/');
  const home = page.locator('[data-widget-id="overview"]');
  await expect(home.getByText('집계를 불러오지 못했습니다.', { exact: false })).toBeVisible();
  await expect(home.locator('.stats strong')).toHaveText(['—개', '—개', '—개']);
  fail = false;
  await home.getByRole('button', { name: '집계 다시 시도' }).click();
  await expect(home.locator('.stats strong')).toHaveText(['0개', '0개', '0개']);
});
