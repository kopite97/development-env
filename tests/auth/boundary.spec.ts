import { test, expect } from '@playwright/test';
test('default entry never accesses prototype storage or business APIs', async ({ page }) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('request', (request) => {
    if (/\/api\//.test(request.url()) && !/\/api\/v1\/(me|auth\/)/.test(request.url()))
      requests.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    for (const name of [
      'projects',
      'tasks',
      'journals',
      'milestones',
      'links',
      'layout',
      'unrelated',
    ])
      localStorage.setItem('devspace.' + name + '.v1', 'sentinel-' + name);
    Storage.prototype.getItem = () => {
      throw new Error('Storage must not be read');
    };
    Storage.prototype.setItem = () => {
      throw new Error('Storage must not be written');
    };
    Storage.prototype.removeItem = () => {
      throw new Error('Storage must not be removed');
    };
    Storage.prototype.clear = () => {
      throw new Error('Storage must not be cleared');
    };
  });
  await page.route('**/api/v1/me', (route) =>
    route.fulfill({ status: 401, json: { code: 'AUTH_REQUIRED' } }),
  );
  await page.goto('/projects/example?scope=all&q=search');
  await expect(page.getByRole('heading', { name: 'Devspace', exact: true })).toBeVisible();
  await expect(page.locator('.widget')).toHaveCount(0);
  expect(await page.evaluate(() => Object.entries(localStorage).sort())).toEqual(
    ['projects', 'tasks', 'journals', 'milestones', 'links', 'layout', 'unrelated']
      .map((name) => ['devspace.' + name + '.v1', 'sentinel-' + name])
      .sort(),
  );
  expect(errors).toEqual([]);
  expect(requests).toEqual([]);
});
