import { setup, test, expect } from './fixtures';

test('미초기화 Home은 조회만 수행하고 명시적인 시작 선택을 보여준다', async ({ page }) => {
  const state = await setup(page, { initialized: false });
  await page.goto('/');
  await expect(page.getByRole('button', { name: '기본 위젯으로 시작' })).toBeVisible();
  await expect(page.getByRole('button', { name: '빈 홈으로 시작' })).toBeVisible();
  expect(state.writes).toEqual([]);
});

test('기본 초기화는 Dashboard v3와 Widget data를 사용해 6개 위젯을 표시한다', async ({ page }) => {
  const state = await setup(page, { initialized: false });
  await page.goto('/');
  await page.getByRole('button', { name: '기본 위젯으로 시작' }).click();
  await expect(page.locator('.dashboard-grid > .widget')).toHaveCount(6);
  await expect(page.getByText('서버 Widget 연결', { exact: true })).toBeVisible();
  expect(state.writes[0]).toMatchObject({
    path: '/api/v3/dashboards/home/initializations',
    method: 'POST',
    body: { schemaVersion: 3, layoutRevision: 0 },
  });
  expect(state.writes.some((write) => write.path === '/api/v2/dashboards/home')).toBe(false);
});

test('빈 배치 초기화 후에는 서버가 저장한 빈 Home을 유지한다', async ({ page }) => {
  const state = await setup(page, { initialized: false });
  await page.goto('/');
  await page.getByRole('button', { name: '빈 홈으로 시작' }).click();
  await expect(page.getByText('표시할 위젯이 없어요')).toBeVisible();
  await page.reload();
  await expect(page.getByText('표시할 위젯이 없어요')).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({
    path: '/api/v3/dashboards/home',
    method: 'PUT',
    body: { schemaVersion: 3, layoutRevision: 0, placements: [] },
  });
});

test('배치 편집은 Widget 설정 PUT과 Dashboard 배치 PUT을 분리한다', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/');
  await page.getByRole('button', { name: '배치 편집' }).click();
  await page.getByRole('button', { name: '프로젝트 개요 뒤로 이동' }).click();
  await page.getByRole('button', { name: '프로젝트 개요 설정' }).click();
  await page.getByLabel('위젯 제목').fill('개요 수정');
  await page.getByRole('button', { name: '설정 적용' }).click();
  await page.getByRole('button', { name: '배치 저장' }).click();
  await expect(page.getByText('배치를 적용했습니다.')).toBeVisible();
  expect(state.writes.some((write) => write.path.startsWith('/api/v1/widgets/'))).toBe(true);
  expect(state.writes.some((write) => write.path === '/api/v3/dashboards/home')).toBe(true);
  expect(
    state.writes.find((write) => write.path.startsWith('/api/v1/widgets/'))?.body,
  ).toMatchObject({
    title: '개요 수정',
    revision: 1,
    configVersion: 1,
  });
});

test('Task 위젯은 상태 드롭다운과 드래그를 Task PATCH로 저장한다', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/');
  const board = page.locator('.widget').filter({ hasText: '작업 보드' });
  const task = board.locator('[data-task-id="00000000-0000-0000-0000-000000000300"]');
  await board.getByLabel('서버 Widget 연결 상태').selectOption('doing');
  await expect(
    board.locator('.column-doing [data-task-id="00000000-0000-0000-0000-000000000300"]'),
  ).toBeVisible();
  expect(
    state.writes.find((write) => write.path.endsWith('/00000000-0000-0000-0000-000000000300')),
  ).toMatchObject({
    method: 'PATCH',
    body: { revision: 1, status: 'doing' },
  });
  await task.dragTo(board.locator('.column-done'));
  await expect(
    board.locator('.column-done [data-task-id="00000000-0000-0000-0000-000000000300"]'),
  ).toBeVisible();
  expect(
    state.writes.filter((write) => write.path.endsWith('/00000000-0000-0000-0000-000000000300')),
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ method: 'PATCH', body: { revision: 1, status: 'doing' } }),
      expect.objectContaining({ method: 'PATCH', body: { revision: 2, status: 'done' } }),
    ]),
  );
  expect(state.writes.some((write) => write.path.startsWith('/api/v1/widgets/'))).toBe(false);
  expect(state.writes.some((write) => write.path === '/api/v3/dashboards/home')).toBe(false);
});

test('프로젝트 개요 위젯은 프로젝트 행을 바로 표시하고 상세로 이동한다', async ({ page }) => {
  await setup(page);
  await page.goto('/');
  const overview = page.locator('.widget').filter({ hasText: '프로젝트 개요' });
  await expect(overview.getByRole('button', { name: /Project 1/ })).toBeVisible();
  await expect(page.getByRole('button', { name: '프로젝트 확인' })).toHaveCount(0);
  await overview.getByRole('button', { name: /Project 1/ }).click();
  await expect(page).toHaveURL(/\/projects\/00000000-0000-0000-0000-000000000001$/);
});

test.describe('responsive Dashboard v3 shell', () => {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    test(`${viewport.width}x${viewport.height} has no horizontal overflow`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await setup(page);
      await page.goto('/');
      await expect(page.locator('.dashboard-grid > .widget')).toHaveCount(6);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    });
  }
});
