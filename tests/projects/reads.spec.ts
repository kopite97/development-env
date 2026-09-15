import { test, expect, setup, project, id } from './fixtures';
test('page boundaries never determine direct archived detail and filters survive Back', async ({
  page,
}) => {
  await setup(page);
  const requests: URL[] = [];
  await page.route('**/api/v2/projects?*', (route) => {
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
  await page.route('**/api/v2/projects/' + id(21), (route) =>
    route.fulfill({ json: { ...project(21), status: 'archived' } }),
  );
  await page.goto('/projects?category=uncategorized&q=C%23');
  await expect(page.locator('.project-row')).toHaveCount(20);
  await expect(page.getByRole('status')).toHaveText('검색 결과 21개');
  await page.getByRole('button', { name: '프로젝트 더 보기', exact: true }).click();
  await expect(page.locator('.project-row')).toHaveCount(21);
  expect(requests.at(-1)?.searchParams.get('cursor')).toBe('opaque+/=');
  expect(requests.every((r) => r.searchParams.get('limit') === '20')).toBeTruthy();
  await page.getByRole('button', { name: /^Project 21\s/ }).click();
  await expect(page.locator('.project-summary')).toContainText('보관됨');
  await page.getByRole('button', { name: '프로젝트 목록' }).click();
  await expect(page.getByLabel('현재 화면 검색')).toHaveValue('C#');
  await page.goto('/projects/' + id(21) + '?q=not-in-search');
  await expect(page.getByRole('heading', { name: 'Project 21', exact: true })).toBeVisible();
});
test('later page failure retains rows; invalid cursor restarts without loops', async ({ page }) => {
  await setup(page);
  let calls = 0;
  await page.route('**/api/v2/projects?*', (route) => {
    calls++;
    return route.request().url().includes('cursor=')
      ? route.fulfill({ status: 400, json: { code: 'INVALID_CURSOR' } })
      : route.fulfill({ json: { items: [project(1)], total: 99, nextCursor: 'next' } });
  });
  await page.goto('/projects');
  await page.getByRole('button', { name: '프로젝트 더 보기', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('프로젝트를 불러오지 못했습니다');
  await expect(page.getByRole('button', { name: /^Project 1\s/ })).toBeVisible();
  expect(calls).toBe(2);
  await page.getByRole('button', { name: '목록 다시 불러오기' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(calls).toBe(3);
});
test('rapid search cannot publish the old response; literal query goes to server', async ({
  page,
}) => {
  await setup(page);
  await page.route('**/api/v2/projects?*', async (route) => {
    const q = new URL(route.request().url()).searchParams.get('query');
    if (!q) await new Promise((r) => setTimeout(r, 700));
    await route.fulfill({ json: { items: [project(q ? 2 : 1)], total: 1, nextCursor: null } });
  });
  await page.goto('/projects');
  await page.getByLabel('현재 화면 검색').fill('%_ literal');
  await expect(page.getByRole('button', { name: /^Project 2\s/ })).toBeVisible();
  await page.waitForTimeout(800);
  await expect(page.getByRole('button', { name: /^Project 1\s/ })).toHaveCount(0);
});
test('malformed and missing detail do not fall back to local fixtures', async ({ page }) => {
  await setup(page);
  await page.goto('/projects/forest');
  await expect(page.getByRole('alert')).toContainText('잘못된 프로젝트 주소');
  await page.route('**/api/v2/projects/' + id(99), (route) =>
    route.fulfill({ status: 404, json: { code: 'RESOURCE_NOT_FOUND' } }),
  );
  await page.goto('/projects/' + id(99));
  await expect(page.getByRole('alert')).toContainText('프로젝트가 없거나 더 이상 접근할 수 없어요');
});
