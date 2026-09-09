import { test, expect } from '@playwright/test';
test('menu and project routes survive direct visits, reload, back and forward', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .locator('nav')
    .getByRole('button', { name: /^프로젝트/ })
    .click();
  await expect(page).toHaveURL(/\/projects$/);
  await page.getByRole('button', { name: 'Unity 개발', exact: true }).click();
  await page.getByLabel('현재 화면 검색').fill('Forest');
  const listUrl = page.url();
  await page.locator('.project-row').first().click();
  await expect(page).toHaveURL(/\/projects\/forest\?/);
  const detailUrl = page.url();
  const name = await page.locator('h1').innerText();
  await page.reload();
  await expect(page.locator('h1')).toHaveText(name);
  await page.goBack();
  await expect(page).toHaveURL(listUrl);
  await expect(page.getByLabel('현재 화면 검색')).toHaveValue('Forest');
  await page.goForward();
  await expect(page).toHaveURL(detailUrl);
  await expect(page.locator('h1')).toHaveText(name);
  await page.getByRole('button', { name: '프로젝트 목록', exact: true }).click();
  await expect(page).toHaveURL(listUrl);
  for (const [path, heading] of [
    ['/tasks', '작업 보드'],
    ['/journals', '개발 일지'],
    ['/library', '자료실'],
    ['/projects', '프로젝트'],
  ]) {
    await page.goto(path);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
  }
});
test('invalid routes and missing projects offer recovery', async ({ page }) => {
  await page.goto('/not-a-page');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('페이지를 찾을 수 없어요');
  await page.getByRole('button', { name: '홈으로 이동' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/projects/missing');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('프로젝트를 찾을 수 없어요');
  await page.getByRole('button', { name: '프로젝트 목록', exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
});
test('layout edit rejects back and restores history without losing forward entries', async ({
  page,
}) => {
  await page.goto('/projects');
  await page.getByRole('button', { name: '나의 홈', exact: true }).click();
  await page.getByRole('button', { name: '배치 편집', exact: true }).click();
  await page.getByRole('button', { name: '빠른 링크 제거', exact: true }).click();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: '배치 저장', exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('배치 편집을 저장하거나 취소');
  await expect(page.locator('.widget')).toHaveCount(5);
  await page.getByRole('button', { name: '배치 저장', exact: true }).click();
  await page.goBack();
  await expect(page).toHaveURL(/\/projects$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.widget')).toHaveCount(5);
});
test('failed link draft survives rejected back; confirmed navigation discards and forward reopens clean page', async ({
  page,
}) => {
  await page.goto('/projects');
  await page.getByRole('button', { name: '자료실', exact: true }).click();
  await page.getByRole('button', { name: '링크 추가', exact: true }).click();
  await page.getByLabel('링크 이름').fill('보호할 초안');
  await page.getByLabel('URL', { exact: true }).fill('https://example.com');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'devspace.links.v1') throw Error('full');
      original.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: '링크 저장', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('저장하지 못했습니다');
  page.once('dialog', (d) => d.dismiss());
  await page.goBack();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByLabel('링크 이름')).toHaveValue('보호할 초안');
  page.once('dialog', (d) => d.accept());
  await page.goBack();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goForward();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('same page menu clicks do not add history; filters replace the current entry', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '작업 보드', exact: true }).click();
  const length = await page.evaluate(() => history.length);
  await page.getByRole('button', { name: '작업 보드', exact: true }).click();
  await page.getByLabel('현재 화면 검색').fill('API');
  expect(await page.evaluate(() => history.length)).toBe(length);
  await page.reload();
  await expect(page.getByLabel('현재 화면 검색')).toHaveValue('API');
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
});
