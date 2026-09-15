import { test, expect } from '@playwright/test';
import { identity, overview, id } from '../projects/fixtures';
const task = (n: number, status = 'todo') => ({
  id: id(n),
  revision: 1,
  title: 'Task ' + n,
  projectId: id(99),
  projectName: 'Server Project',
  categoryId: null,
  status,
  priority: 'normal',
  tag: 'API',
  description: '',
  createdAt: '2026-09-13T00:00:00Z',
  updatedAt: '2026-09-13T00:00:00Z',
  deletedAt: null,
});
test('preserves shell, independent columns, failed later page, trash and independent stats', async ({
  page,
}) => {
  const excluded: string[] = [];
  await page.addInitScript(() => {
    for (const method of ['getItem', 'setItem', 'removeItem', 'clear'])
      Object.defineProperty(Storage.prototype, method, {
        value: () => {
          throw new Error('Storage authority forbidden');
        },
      });
  });
  await page.route('**/api/**', (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === '/api/v1/me') return route.fulfill({ json: identity });
    if (u.pathname === '/api/v1/project-categories')
      return route.fulfill({ json: { items: [], total: 0 } });
    if (u.pathname === '/api/v2/projects')
      return route.fulfill({ json: { items: [], total: 0, nextCursor: null } });
    if (u.pathname === '/api/v2/projects/category-counts')
      return route.fulfill({
        json: {
          items: [{ categoryId: null, active: 0, archived: 0 }],
          totals: { active: 0, archived: 0 },
        },
      });
    if (u.pathname === '/api/v2/overview') return route.fulfill({ json: overview() });
    excluded.push(u.pathname);
    return route.abort();
  });
  await page.route('**/api/v2/tasks/stats?*', (route) => {
    const p = new URL(route.request().url()).searchParams;
    expect(p.has('status') || p.has('deleted') || p.has('limit')).toBe(false);
    return route.fulfill({
      json: { counts: { todo: 23, doing: 25, done: 40 }, total: 88, asOf: '2026-09-13T00:00:00Z' },
    });
  });
  let fail = true;
  await page.route('**/api/v2/tasks?*', (route) => {
    const p = new URL(route.request().url()).searchParams;
    expect(p.get('projectStatus')).toBe('all');
    if (p.get('deleted') === 'true') {
      expect(p.get('query')).toBe('');
      return route.fulfill({
        json: {
          items: [{ ...task(90), deletedAt: '2026-09-13T00:00:00Z' }],
          total: 1,
          nextCursor: null,
        },
      });
    }
    if (p.has('cursor') && fail) {
      fail = false;
      return route.fulfill({ status: 500, json: { code: 'INTERNAL_ERROR', message: 'retry' } });
    }
    const status = p.get('status')!;
    const offset = status === 'todo' ? 0 : status === 'doing' ? 30 : 60;
    return route.fulfill({
      json: {
        items: p.has('cursor')
          ? [task(21, status)]
          : Array.from({ length: 20 }, (_, i) => task(offset + i + 1, status)),
        total: 23,
        nextCursor: p.has('cursor') ? null : 'next',
      },
    });
  });
  await page.goto('/tasks');
  await expect(page.locator('.task')).toHaveCount(60);
  await expect(page.locator('.sidebar')).toBeVisible();
  await expect(page.locator('.column-done .count')).toHaveText('40');
  await page.locator('.column-todo').getByRole('button', { name: '더 불러오기' }).click();
  await expect(page.locator('.column-todo [role=alert]')).toBeVisible();
  await expect(page.locator('.column-todo .task')).toHaveCount(20);
  await page.locator('.column-todo').getByRole('button', { name: '다시 시도' }).click();
  await expect(page.locator('.column-todo .task')).toHaveCount(21);
  await expect(page.locator('.column-doing .task')).toHaveCount(20);
  await page.getByRole('button', { name: /휴지통/ }).click();
  await expect(page.locator('.restore-row')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '메뉴 열기' }).click();
  await expect(page.getByRole('dialog', { name: '작업실 메뉴' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '메뉴 열기' })).toBeFocused();
  expect(excluded).toEqual([]);
});
