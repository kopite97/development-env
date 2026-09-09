import { test, expect } from '@playwright/test';
test('links validate, edit, reorder, filter, persist and delete', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '자료실', exact: true }).click();
  await page.getByRole('button', { name: '링크 추가', exact: true }).click();
  await page.getByLabel('링크 이름').fill('테스트 링크');
  await page.getByLabel('URL', { exact: true }).fill('javascript:alert(1)');
  await page.getByRole('button', { name: '링크 저장' }).click();
  await expect(page.getByRole('alert')).toContainText('http');
  await page.getByLabel('URL', { exact: true }).fill('https://example.com/test');
  await page.getByLabel('표시 범위').selectOption('unity');
  await page.getByRole('button', { name: '링크 저장' }).click();
  await page.getByRole('button', { name: '테스트 링크 위로', exact: true }).click();
  await expect(page.locator('.quick-links strong').nth(3)).toHaveText('테스트 링크');
  await page.getByRole('button', { name: '테스트 링크 편집', exact: true }).click();
  await page.getByLabel('링크 이름').fill('수정 링크');
  await page.getByRole('button', { name: '링크 저장' }).click();
  await page.getByRole('button', { name: '서버 · 웹 개발', exact: true }).click();
  await expect(page.getByRole('link', { name: '수정 링크' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'GitHub' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: '수정 링크' })).toHaveCount(0);
  await page.getByRole('button', { name: '전체 프로젝트', exact: true }).click();
  await expect(page.getByRole('link', { name: '수정 링크' })).toBeVisible();
  await page.getByRole('button', { name: '자료실', exact: true }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '수정 링크 삭제', exact: true }).click();
  await expect(page.getByRole('link', { name: '수정 링크' })).toHaveCount(0);
});
test('link save failure and cancelled discard retain draft; failed deletion and reorder retain data', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '자료실', exact: true }).click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as any).restoreStorage = () => {
      Storage.prototype.setItem = original;
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === 'devspace.links.v1') throw new DOMException('Full', 'QuotaExceededError');
      original.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'GitHub 아래로', exact: true }).click();
  await expect(page.locator('.quick-links strong').first()).toHaveText('GitHub');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'GitHub 삭제', exact: true }).click();
  await expect(page.getByRole('link', { name: 'GitHub' })).toBeVisible();
  await page.getByRole('button', { name: '링크 추가', exact: true }).click();
  await page.getByLabel('링크 이름').fill('보호할 링크');
  await page.getByLabel('URL', { exact: true }).fill('https://example.com');
  await page.getByRole('button', { name: '링크 저장' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('저장하지 못했습니다');
  page.once('dialog', (d) => d.dismiss());
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('링크 이름')).toHaveValue('보호할 링크');
  await page.evaluate(() => (window as any).restoreStorage());
  await page.getByRole('button', { name: '링크 저장' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('link', { name: '보호할 링크' })).toHaveCount(1);
});
test('empty saved links stay empty after reload', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('devspace.links.v1', '[]'));
  await page.reload();
  await page.getByRole('button', { name: '자료실', exact: true }).click();
  await expect(page.getByText('등록된 링크가 없어요')).toBeVisible();
  await expect(page.locator('.quick-links a')).toHaveCount(0);
});
test('mobile boards keep readable columns and touch status controls without page overflow', async ({
  page,
}) => {
  for (const width of [320, 390, 844]) {
    await page.setViewportSize({ width, height: 600 });
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const board = page.locator('.kanban').first();
    expect(
      await board
        .locator('.kanban-column')
        .first()
        .evaluate((e) => e.getBoundingClientRect().width),
    ).toBeGreaterThanOrEqual(240);
    expect(
      await board
        .locator('select')
        .first()
        .evaluate((e) => e.getBoundingClientRect().height),
    ).toBeGreaterThanOrEqual(44);
    await board.getByLabel('인벤토리 UI 구현 상태').selectOption('done');
    await expect(board.locator('.column-done')).toContainText('인벤토리 UI 구현');
    await page.evaluate(() => localStorage.removeItem('devspace.tasks.v1'));
  }
});
