import { test, expect, setup, task } from './fixtures';
test('repeated revision conflicts and failed reconciliation preserve the draft until explicit review', async ({
  page,
}) => {
  await setup(page);
  let conflicts = 0,
    detailCalls = 0;
  await page.route('**/api/v1/tasks/' + task().id, (route) => {
    if (route.request().method() === 'PATCH') {
      conflicts++;
      return route.fulfill({
        status: 409,
        json: { code: 'REVISION_CONFLICT', message: 'conflict' },
      });
    }
    detailCalls++;
    if (detailCalls === 2) return route.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } });
    return route.fulfill({ json: { ...task(), revision: detailCalls, tag: 'External' } });
  });
  await page.goto('/tasks');
  await page.getByRole('button', { name: 'Task 50', exact: true }).click();
  await page.getByLabel('태스크 제목').fill('Keep conflict draft');
  await page.getByRole('button', { name: '태스크 저장' }).click();
  await expect(page.getByRole('alert')).toContainText('최신 태스크를 확인하지 못했습니다');
  await expect(page.getByLabel('태스크 제목')).toHaveValue('Keep conflict draft');
  await expect(page.getByRole('button', { name: '태스크 저장' })).toBeDisabled();
  await page.getByRole('button', { name: '최신 상태 다시 확인' }).click();
  await page.getByRole('button', { name: '내 변경 다시 적용' }).click();
  await page.getByRole('button', { name: '태스크 저장' }).click();
  await expect(page.getByRole('button', { name: '내 변경 다시 적용' })).toBeVisible();
  expect(conflicts).toBe(2);
  await expect(page.getByLabel('태스크 제목')).toHaveValue('Keep conflict draft');
});
for (const code of ['RESOURCE_DELETED', 'INVALID_RESOURCE_STATE', 'PROJECT_ARCHIVED'])
  test(`${code} remains distinct and preserves editor inputs`, async ({ page }) => {
    await setup(page);
    await page.route('**/api/v1/tasks/' + task().id, (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({ status: 409, json: { code, message: code } })
        : route.fulfill({
            json: { ...task(), deletedAt: code === 'RESOURCE_DELETED' ? task().createdAt : null },
          }),
    );
    // First detail is live; the server changes state only after opening the editor.
    let opened = false;
    await page.route('**/api/v1/tasks/' + task().id, (route) => {
      if (!opened && route.request().method() === 'GET') {
        opened = true;
        return route.fulfill({ json: task() });
      }
      return route.fallback();
    });
    await page.goto('/tasks');
    await page.getByRole('button', { name: 'Task 50', exact: true }).click();
    await page.getByLabel('태스크 제목').fill('Preserved');
    await page.getByRole('button', { name: '태스크 저장' }).click();
    await expect(page.getByRole('alert')).toContainText(
      code === 'PROJECT_ARCHIVED'
        ? '대상 프로젝트가 보관'
        : code === 'RESOURCE_DELETED'
          ? '휴지통'
          : '이미 변경',
    );
    await expect(page.getByLabel('태스크 제목')).toHaveValue('Preserved');
  });
for (const [status, code, text] of [
  [401, 'AUTH_REQUIRED', 'Sign in to your workspace'],
  [403, 'ACCOUNT_DISABLED', 'Account disabled'],
  [403, 'FORBIDDEN', 'FORBIDDEN'],
] as const)
  test(`current Task ${code} uses the proper auth boundary`, async ({ page }) => {
    await setup(page);
    await page.goto('/tasks');
    await page.getByRole('button', { name: 'Task 50', exact: true }).click();
    await page.route('**/api/v1/tasks/' + task().id, (route) =>
      route.fulfill({ status, json: { code, message: code } }),
    );
    await page.getByLabel('태스크 제목').fill('Private draft');
    await page.getByRole('button', { name: '태스크 저장' }).click();
    if (code === 'FORBIDDEN') {
      await expect(page.getByRole('alert')).toContainText('The request could not be completed.');
      await expect(page.getByLabel('태스크 제목')).toHaveValue('Private draft');
      await expect(page.getByRole('heading', { name: '작업 보드', exact: true })).toBeVisible();
    } else {
      await expect(page.getByRole('heading', { name: text, exact: true })).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
  });
test('confirmed save closes even if subsequent list refresh fails', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/tasks');
  await page.getByRole('button', { name: 'Task 50', exact: true }).click();
  await page.getByLabel('태스크 제목').fill('Confirmed');
  await page.route('**/api/v1/tasks?*', (route) =>
    route.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } }),
  );
  await page.getByRole('button', { name: '태스크 저장' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('alert').first()).toContainText('불러오지 못했습니다');
  expect(state.tasks[0].title).toBe('Confirmed');
});
test('stats failure does not hide a successful column or fabricate zero counts', async ({
  page,
}) => {
  await setup(page);
  await page.route('**/api/v1/tasks/stats?*', (route) =>
    route.fulfill({ json: { counts: { todo: 0 }, total: 0, asOf: task().createdAt } }),
  );
  await page.goto('/tasks');
  await expect(page.locator('.task')).toHaveCount(1);
  await expect(page.locator('.column-todo .count')).toHaveText('—');
  await expect(page.getByRole('alert')).toContainText('불러오지 못했습니다');
});
test('native drag and keyboard select send status-only writes; trash failures remain visible in its modal', async ({
  page,
}) => {
  const state = await setup(page);
  state.tasks.push({ ...task(51), deletedAt: task().createdAt });
  await page.goto('/tasks');
  const data = await page.evaluateHandle(() => new DataTransfer());
  await page.locator('.task').dispatchEvent('dragstart', { dataTransfer: data });
  await page.locator('.column-doing').dispatchEvent('dragover', { dataTransfer: data });
  await page.locator('.column-doing').dispatchEvent('drop', { dataTransfer: data });
  await expect(page.getByLabel('Task 50 상태')).toHaveValue('doing');
  expect(state.writes[0].body).toEqual({ revision: 1, status: 'doing' });
  await page.getByRole('button', { name: /휴지통/ }).click();
  await page.route('**/api/v1/tasks/*/restore', (route) =>
    route.fulfill({ status: 409, json: { code: 'INVALID_RESOURCE_STATE' } }),
  );
  await page.getByRole('button', { name: 'Task 51 복구' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('INVALID_RESOURCE_STATE');
});
