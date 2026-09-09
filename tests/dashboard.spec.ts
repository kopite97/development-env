import { test, expect } from '@playwright/test';
test('edit, cancel, replace, reorder and persist widgets', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.widget')).toHaveCount(6);
  await page.getByRole('button', { name: '배치 편집', exact: true }).click();
  await page.getByRole('button', { name: '빠른 링크 제거', exact: true }).click();
  await expect(page.locator('.widget')).toHaveCount(5);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.locator('.widget')).toHaveCount(6);
  await page.getByRole('button', { name: '배치 편집', exact: true }).click();
  await page.getByRole('button', { name: '프로젝트 한눈에 보기 뒤로 이동', exact: true }).click();
  await expect(page.locator('.widget').first()).toContainText('운영 · 배포 현황');
  await page.getByRole('button', { name: '빠른 링크 설정', exact: true }).click();
  await page.getByRole('button', { name: /최근 개발 일지 개발 과정/ }).click();
  await page.getByLabel('위젯 제목').fill('서버 기록');
  await page.getByLabel('표시할 프로젝트 범위').selectOption('server');
  await page.getByRole('button', { name: '설정 적용' }).click();
  await page.getByRole('button', { name: '배치 저장' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: '서버 기록' })).toBeVisible();
  await expect(page.locator('.widget').first()).toContainText('운영 · 배포 현황');
  await page.getByRole('button', { name: '위젯 추가', exact: true }).click();
  await page.getByLabel('위젯 제목').fill('추가 현황');
  await page.getByRole('dialog').getByRole('button', { name: '위젯 추가', exact: true }).click();
  await page.getByRole('button', { name: '배치 저장' }).click();
  await page.reload();
  await expect(page.locator('.widget')).toHaveCount(7);
  expect(errors).toEqual([]);
});
test('task changes persist and filters/search work', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('인벤토리 UI 구현 상태').selectOption('done');
  await page.reload();
  await expect(page.locator('.column-done')).toContainText('인벤토리 UI 구현');
  await page.getByRole('button', { name: '서버 · 웹 개발', exact: true }).click();
  await expect(page.getByRole('heading', { name: '운영 · 배포 현황' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '프로젝트 한눈에 보기' })).toHaveCount(0);
  await page.getByLabel('현재 화면 검색').fill('없는위젯');
  await expect(page.getByText('표시할 위젯이 없어요')).toBeVisible();
});
test('desktop and mobile fit the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/');
  await page.screenshot({ path: 'test-results/home-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: '메뉴 열기' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: 'test-results/home-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: '메뉴 열기' }).click();
  await page.getByRole('button', { name: '개발 일지', exact: true }).click();
  await expect(page.getByRole('heading', { name: '개발 일지', exact: true })).toBeVisible();
});
