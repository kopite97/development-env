import { test, expect } from '@playwright/test';

test('project totals stay independent of search and follow scope', async ({ page }) => {
  await page.goto('/');
  await page
    .locator('nav')
    .getByRole('button', { name: /^프로젝트/ })
    .click();
  const stats = page.locator('.stats');
  const before = await stats.innerText();
  await page.getByLabel('현재 화면 검색').fill('no-match-98765');
  await expect(stats).toHaveText(before, { useInnerText: true });
  await expect(page.getByText('검색 결과 0개', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '검색·필터 초기화' }).click();
  await expect(page.locator('.project-row')).toHaveCount(4);
  await page.locator('.tabs').getByRole('button', { name: 'Unity 개발', exact: true }).click();
  await expect(stats.locator('strong').first()).toHaveText('2개');
  await expect(page.locator('.project-row')).toHaveCount(2);
  await page.getByRole('button', { name: '보관된 프로젝트', exact: true }).click();
  await expect(stats.locator('strong').first()).toHaveText('0개');
  await expect(stats).toContainText('보관된 프로젝트');
});

test('every page offers a search reset and existing creation actions', async ({ page }) => {
  await page.goto('/');
  for (const [name, selector, action] of [
    ['나의 홈', '.widget', '위젯 추가'],
    ['프로젝트', '.project-row', '프로젝트 추가'],
    ['작업 보드', '.task', '태스크 추가'],
    ['개발 일지', '.document-row', '일지 작성'],
    ['자료실', '.quick-links a', ''],
  ]) {
    await page
      .locator('nav')
      .getByRole('button', { name: new RegExp(`^${name}`) })
      .click();
    await page.getByLabel('현재 화면 검색').fill('no-match-98765');
    const empty = page.locator('.empty-state').last();
    await expect(empty).toBeVisible();
    if (action) {
      await empty.getByRole('button', { name: action, exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      if (name === '나의 홈') {
        await page.getByRole('button', { name: '취소', exact: true }).click();
        await page.getByLabel('현재 화면 검색').fill('no-match-98765');
      }
    }
    await page.getByRole('button', { name: '검색·필터 초기화' }).click();
    await expect(page.getByLabel('현재 화면 검색')).toHaveValue('');
    await expect(page.locator(selector).first()).toBeVisible();
  }
});
