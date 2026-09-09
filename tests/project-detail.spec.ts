import { test, expect } from '@playwright/test';
test('project clicks open a page with only related data and preserve list filters', async ({
  page,
}) => {
  await page.goto('/');
  const row = page.locator('.project-row').first();
  const name = await row.locator('strong').innerText();
  await row.click();
  await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const id = await page.locator('.project-summary .badge').first().innerText();
  expect(id).toBe('진행 중');
  await expect(page.locator('.task').first()).toContainText(name);
  await expect(page.getByLabel('현재 화면 검색')).toHaveCount(0);
  await page.getByRole('button', { name: '프로젝트 목록', exact: true }).click();
  await page.getByRole('button', { name: 'Unity 개발', exact: true }).click();
  await page.getByLabel('현재 화면 검색').fill(name);
  await page.locator('.project-row').first().click();
  await page.getByRole('button', { name: '프로젝트 목록', exact: true }).click();
  await expect(page.getByLabel('현재 화면 검색')).toHaveValue(name);
  await expect(page.getByRole('button', { name: 'Unity 개발', exact: true })).toHaveClass(
    'selected',
  );
});
test('detail edit failure and discard keep data, then saved changes appear on page and home', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('.project-row').first().click();
  const originalName = await page.locator('h1').innerText();
  await page.getByRole('button', { name: '프로젝트 편집', exact: true }).click();
  await page.getByLabel('프로젝트 이름').fill('상세에서 수정한 프로젝트');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as any).restore = () => {
      Storage.prototype.setItem = original;
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === 'devspace.projects.v1') throw Error('full');
      original.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: '프로젝트 저장' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('저장하지 못했습니다');
  await expect(page.locator('h1')).toHaveText(originalName);
  page.once('dialog', (d) => d.dismiss());
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('프로젝트 이름')).toHaveValue('상세에서 수정한 프로젝트');
  await page.evaluate(() => (window as any).restore());
  await page.getByRole('button', { name: '프로젝트 저장' }).click();
  await expect(page.locator('h1')).toHaveText('상세에서 수정한 프로젝트');
  await expect(page.locator('.task').first()).toContainText('상세에서 수정한 프로젝트');
  await page.reload();
  await expect(page.locator('h1')).toHaveText('상세에서 수정한 프로젝트');
});
test('layout edit guards project navigation and a new project has empty related sections on mobile', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '배치 편집', exact: true }).click();
  await page.locator('.project-row').first().click();
  await expect(page.getByRole('status')).toContainText('배치 편집을 저장하거나 취소');
  await expect(page.locator('.project-detail')).toHaveCount(0);
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await page
    .locator('nav')
    .getByRole('button', { name: /^프로젝트/ })
    .click();
  await page.getByRole('button', { name: '프로젝트 추가', exact: true }).click();
  const name = '긴프로젝트이름'.repeat(10);
  await page.getByLabel('프로젝트 이름').fill(name);
  await page.getByLabel('기술 스택').fill('TypeScript'.repeat(15));
  await page.getByRole('button', { name: '프로젝트 저장' }).click();
  await page.locator('.project-row').filter({ hasText: name }).click();
  await page.setViewportSize({ width: 320, height: 640 });
  await expect(page.getByText('연결된 작업이 없어요')).toBeVisible();
  await expect(page.getByText('연결된 개발 일지가 없어요')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '프로젝트 편집', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
