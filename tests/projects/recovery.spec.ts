import { test, expect, setup, project } from './fixtures';
test('confirmed filter navigation discards a creation draft', async ({ page }) => {
  await setup(page);
  await page.route('**/api/v2/projects?*', (route) =>
    route.fulfill({ json: { items: [], total: 0, nextCursor: null } }),
  );
  await page.goto('/projects');
  await page.getByRole('button', { name: '프로젝트 추가', exact: true }).first().click();
  await page.getByLabel('프로젝트 이름', { exact: true }).fill('Discard on filter');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await page.getByLabel('개발 분야 필터', { exact: true }).selectOption('uncategorized');
  await expect(page.getByLabel('프로젝트 이름', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '프로젝트 추가', exact: true }).first().click();
  await expect(page.getByLabel('프로젝트 이름', { exact: true })).toHaveValue('');
});
test('malformed first page is a protocol error; later network failure retries the same cursor', async ({
  page,
}) => {
  await setup(page);
  let first = true,
    later = true;
  const cursors: string[] = [];
  await page.route('**/api/v2/projects?*', (route) => {
    const cursor = new URL(route.request().url()).searchParams.get('cursor');
    if (first) {
      first = false;
      return route.fulfill({
        json: { items: [{ ...project(1), id: 'forest' }], total: 1, nextCursor: null },
      });
    }
    if (!cursor)
      return route.fulfill({ json: { items: [project(1)], total: 2, nextCursor: 'same-cursor' } });
    cursors.push(cursor);
    if (later) {
      later = false;
      return route.abort();
    }
    return route.fulfill({ json: { items: [project(2)], total: 2, nextCursor: null } });
  });
  await page.goto('/projects');
  await expect(page.getByText('프로젝트를 불러오지 못했습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Project 1\s/ })).toHaveCount(0);
  await page.getByRole('button', { name: '목록 다시 불러오기' }).click();
  await page.getByRole('button', { name: '프로젝트 더 보기', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Project 1\s/ })).toBeVisible();
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.locator('.project-row')).toHaveCount(2);
  expect(cursors).toEqual(['same-cursor', 'same-cursor']);
});
test('server memo validation permits correction; key reuse never triggers an automatic new creation', async ({
  page,
}) => {
  await setup(page);
  let calls = 0;
  await page.route('**/api/v2/projects?*', (route) =>
    route.fulfill({ json: { items: [], total: 0, nextCursor: null } }),
  );
  await page.route('**/api/v2/projects', (route) => {
    calls++;
    return calls === 1
      ? route.fulfill({
          status: 400,
          json: {
            code: 'VALIDATION_ERROR',
            fieldErrors: { currentMilestone: 'Memo rejected by server' },
          },
        })
      : route.fulfill({ status: 409, json: { code: 'IDEMPOTENCY_KEY_REUSED' } });
  });
  await page.goto('/projects');
  await page.getByRole('button', { name: '프로젝트 추가', exact: true }).first().click();
  await page.getByLabel('프로젝트 이름', { exact: true }).fill('Test');
  await page.getByLabel('기술 스택', { exact: true }).fill('Java');
  await page.getByRole('button', { name: '프로젝트 저장' }).click();
  await expect(page.getByText('Memo rejected by server')).toBeVisible();
  await expect(page.getByLabel('프로젝트 목표 메모', { exact: false })).toBeEnabled();
  await page.getByLabel('프로젝트 목표 메모', { exact: false }).fill('Corrected');
  await page.getByRole('button', { name: '프로젝트 저장' }).click();
  await expect(page.getByText(/creation key belongs to different data/)).toBeVisible();
  expect(calls).toBe(2);
});
