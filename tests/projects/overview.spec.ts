import { test, expect, setup, project, id, overview } from './fixtures';
test('Overview is independent of pages, search and list failure; mutations invalidate counters', async ({
  page,
}) => {
  await setup(page);
  let queries: URL[] = [],
    archived = false;
  await page.route('**/api/v1/overview?*', (route) => {
    const url = new URL(route.request().url());
    queries.push(url);
    const data = overview(url.searchParams.get('scope')!, url.searchParams.get('projectId'));
    data.projects.archived = archived ? 3 : 2;
    return route.fulfill({ json: data });
  });
  await page.route('**/api/v1/projects?*', (route) =>
    route.request().url().includes('query=fail')
      ? route.fulfill({ status: 503, json: {} })
      : route.fulfill({ json: { items: [project(1)], total: 99, nextCursor: null } }),
  );
  await page.route('**/api/v1/projects/' + id(1), (route) => {
    if (route.request().method() === 'PATCH') archived = true;
    return route.fulfill({
      json: { ...project(1), revision: archived ? 2 : 1, status: archived ? 'archived' : 'active' },
    });
  });
  await page.goto('/projects');
  await expect(page.getByText('99 matching Projects · 1 loaded rows')).toBeVisible();
  const counters = page.getByRole('region', { name: 'Overview counters' });
  await expect(counters.locator('dd').first()).toHaveText('24');
  await page.getByLabel('Search Projects').fill('fail');
  await expect(page.getByText('Projects could not be loaded.')).toBeVisible();
  await expect(counters.locator('dd').first()).toHaveText('24');
  expect(queries).toHaveLength(1);
  await page.goto('/projects/' + id(1) + '?scope=server&q=fail&archived=true');
  await expect(page.getByRole('heading', { name: 'Project counters' })).toBeVisible();
  expect(queries.at(-1)?.searchParams.get('scope')).toBe('all');
  expect([...queries.at(-1)!.searchParams.keys()].sort()).toEqual(['projectId', 'scope']);
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Archive Project', exact: true }).click();
  await expect(counters.locator('dd').nth(1)).toHaveText('3');
});
test('failed counters never become zero, while valid zero snapshots remain usable', async ({
  page,
}) => {
  await setup(page);
  let fail = true;
  await page.route('**/api/v1/overview?*', (route) => {
    const data = overview();
    data.projects = {
      total: 0,
      archived: 0,
      byScope: { unity: { total: 0, archived: 0 }, server: { total: 0, archived: 0 } },
    };
    data.tasks = { total: 0, todo: 0, doing: 0, done: 0 };
    return fail ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ json: data });
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Counters unavailable');
  await expect(page.locator('dd')).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Refresh counters' }).click();
  await expect(page.locator('dd')).toHaveText(['0', '0', '0', '0', '0', '0']);
});
