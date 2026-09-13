import { test, expect } from '@playwright/test';
import { identity, overview, id, project } from '../projects/fixtures';
test('async editor retains failed draft, waits before closing and writes only changed fields', async ({
  page,
}) => {
  let task = {
    id: id(50),
    revision: 1,
    title: 'Original',
    projectId: id(1),
    projectName: 'Project 1',
    scope: 'unity',
    status: 'todo',
    priority: 'normal',
    tag: '',
    description: '',
    createdAt: '2026-09-13T00:00:00Z',
    updatedAt: '2026-09-13T00:00:00Z',
    deletedAt: null,
  };
  let fail = true;
  const writes: Record<string, unknown>[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url()),
      p = url.searchParams;
    if (url.pathname === '/api/v1/me') return route.fulfill({ json: identity });
    if (url.pathname === '/api/v1/auth/csrf') return route.fulfill({ json: { csrfToken: 'test' } });
    if (url.pathname === '/api/v1/overview') return route.fulfill({ json: overview() });
    if (url.pathname === '/api/v1/projects')
      return route.fulfill({ json: { items: [project(1)], total: 1, nextCursor: null } });
    if (url.pathname === '/api/v1/projects/' + id(1)) return route.fulfill({ json: project(1) });
    if (url.pathname === '/api/v1/tasks/stats')
      return route.fulfill({
        json: { counts: { todo: 1, doing: 0, done: 0 }, total: 1, asOf: task.createdAt },
      });
    if (url.pathname === '/api/v1/tasks')
      return route.fulfill({
        json: {
          items: p.get('deleted') === 'false' && p.get('status') === task.status ? [task] : [],
          total: p.get('deleted') === 'false' && p.get('status') === task.status ? 1 : 0,
          nextCursor: null,
        },
      });
    if (url.pathname === '/api/v1/tasks/' + task.id) {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON();
        writes.push(body);
        if (fail) {
          fail = false;
          return route.fulfill({
            status: 400,
            json: { code: 'VALIDATION_ERROR', message: 'Retain draft' },
          });
        }
        await new Promise((r) => setTimeout(r, 300));
        task = { ...task, ...body, revision: task.revision + 1 };
      }
      return route.fulfill({ json: task });
    }
    throw new Error('Unexpected API: ' + url.pathname);
  });
  await page.goto('/tasks');
  await page.getByRole('button', { name: 'Original', exact: true }).click();
  const modal = page.getByRole('dialog', { name: '태스크 편집' });
  await expect(modal.getByLabel('태스크 제목')).toBeFocused();
  await modal.getByLabel('태스크 제목').fill('Changed');
  await modal.getByRole('button', { name: '태스크 저장' }).click();
  await expect(modal.getByRole('alert')).toBeVisible();
  await expect(modal.getByLabel('태스크 제목')).toHaveValue('Changed');
  await modal.getByRole('button', { name: '태스크 저장' }).click();
  await expect(modal.getByRole('button', { name: '저장 중…' })).toBeDisabled();
  await expect(modal).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Changed', exact: true })).toBeVisible();
  expect(writes).toEqual([
    { revision: 1, title: 'Changed' },
    { revision: 1, title: 'Changed' },
  ]);
});
