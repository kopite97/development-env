import { test, expect, setup, project, id } from './fixtures';
test('page boundaries never determine direct archived detail and filters survive Back', async ({
  page,
}) => {
  await setup(page);
  const requests: URL[] = [];
  await page.route('**/api/v1/projects?*', (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    return route.fulfill({
      json: {
        items: url.searchParams.has('cursor')
          ? [project(21)]
          : Array.from({ length: 20 }, (_, i) => project(i + 1)),
        total: 21,
        nextCursor: url.searchParams.has('cursor') ? null : 'opaque+/=',
      },
    });
  });
  await page.route('**/api/v1/projects/' + id(21), (route) =>
    route.fulfill({ json: { ...project(21), status: 'archived' } }),
  );
  await page.goto('/projects?scope=unity&q=C%23');
  await expect(page.getByText('21 matching Projects · 20 loaded rows')).toBeVisible();
  await page.getByRole('button', { name: 'Load more', exact: true }).click();
  await expect(page.getByText('21 matching Projects · 21 loaded rows')).toBeVisible();
  expect(requests.at(-1)?.searchParams.get('cursor')).toBe('opaque+/=');
  expect(requests.every((r) => r.searchParams.get('limit') === '20')).toBeTruthy();
  await page.getByRole('button', { name: 'Project 21', exact: true }).click();
  await expect(page.getByText('Archived Project · unity')).toBeVisible();
  await page.getByRole('button', { name: 'Back to Projects' }).click();
  await expect(page.getByLabel('Search Projects')).toHaveValue('C#');
  await page.goto('/projects/' + id(21) + '?q=not-in-search');
  await expect(page.getByRole('heading', { name: 'Project 21', exact: true })).toBeVisible();
});
test('later page failure retains rows; invalid cursor restarts without loops', async ({ page }) => {
  await setup(page);
  let calls = 0;
  await page.route('**/api/v1/projects?*', (route) => {
    calls++;
    return route.request().url().includes('cursor=')
      ? route.fulfill({ status: 400, json: { code: 'INVALID_CURSOR' } })
      : route.fulfill({ json: { items: [project(1)], total: 99, nextCursor: 'next' } });
  });
  await page.goto('/projects');
  await page.getByRole('button', { name: 'Load more', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Projects could not be loaded');
  await expect(page.getByRole('button', { name: 'Project 1', exact: true })).toBeVisible();
  expect(calls).toBe(2);
  await page.getByRole('button', { name: 'Restart list' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(calls).toBe(3);
});
test('rapid search cannot publish the old response; literal query goes to server', async ({
  page,
}) => {
  await setup(page);
  await page.route('**/api/v1/projects?*', async (route) => {
    const q = new URL(route.request().url()).searchParams.get('query');
    if (!q) await new Promise((r) => setTimeout(r, 700));
    await route.fulfill({ json: { items: [project(q ? 2 : 1)], total: 1, nextCursor: null } });
  });
  await page.goto('/projects');
  await page.getByLabel('Search Projects').fill('%_ literal');
  await expect(page.getByRole('button', { name: 'Project 2', exact: true })).toBeVisible();
  await page.waitForTimeout(800);
  await expect(page.getByRole('button', { name: 'Project 1', exact: true })).toHaveCount(0);
});
test('malformed and missing detail do not fall back to local fixtures', async ({ page }) => {
  await setup(page);
  await page.goto('/projects/forest');
  await expect(page.getByRole('alert')).toContainText('Invalid Project address');
  await page.route('**/api/v1/projects/' + id(99), (route) =>
    route.fulfill({ status: 404, json: { code: 'RESOURCE_NOT_FOUND' } }),
  );
  await page.goto('/projects/' + id(99));
  await expect(page.getByRole('alert')).toContainText('Project not found');
});
