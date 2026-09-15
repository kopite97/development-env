import { test, expect, setup, identity, dashboard, id } from './fixtures';
import type { Page } from '@playwright/test';
import { task } from '../tasks/fixtures';

async function focusAfterCooldown(page: Page) {
  await page.evaluate(() => {
    const now = Date.now();
    Date.now = () => now + 31_000;
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

test('focus verifies in background without remounting the Home shell, refetching widgets or losing scroll/drafts', async ({
  page,
}) => {
  await setup(page);
  let checks = 0;
  let release!: () => void;
  await page.route('**/api/v1/me', async (route) => {
    checks++;
    if (checks > 1)
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    await route.fulfill({ json: identity });
  });
  const reads: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/') && !r.url().endsWith('/me')) reads.push(r.url());
  });
  await page.goto('/?category=all');
  await expect(page.locator('.project-row')).toHaveCount(2);
  await page.waitForLoadState('networkidle');
  const shell = await page.locator('.app-shell').elementHandle();
  const count = reads.length;
  await page.evaluate(() => window.scrollTo(0, 400));
  const scroll = await page.evaluate(() => window.scrollY);
  await focusAfterCooldown(page);
  await expect.poll(() => checks).toBe(2);
  expect(await shell!.evaluate((node) => node.isConnected)).toBe(true);
  await expect(page.getByText('Checking your session…')).toHaveCount(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
  release();
  await page.waitForLoadState('networkidle');
  expect(reads).toHaveLength(count);
  expect(await shell!.evaluate((node) => node.isConnected)).toBe(true);
  await page.getByRole('button', { name: '태스크 추가', exact: true }).click();
  await page.getByLabel('태스크 제목', { exact: true }).fill('돌아와도 유지할 초안');
  const editor = await page.getByRole('dialog').elementHandle();
  await focusAfterCooldown(page);
  await expect.poll(() => checks).toBe(3);
  release();
  await page.waitForLoadState('networkidle');
  expect(await editor!.evaluate((node) => node.isConnected)).toBe(true);
  await expect(page.getByLabel('태스크 제목', { exact: true })).toHaveValue('돌아와도 유지할 초안');
  await expect(page).toHaveURL(/category=all/);
});

test('offline focus keeps the draft, prevents saving, and retry restores the same editor', async ({
  page,
}) => {
  await setup(page);
  let fail = false;
  let writes = 0;
  await page.route('**/api/v1/me', (route) =>
    route.fulfill(fail ? { status: 503, json: {} } : { json: identity }),
  );
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().endsWith('/tasks')) writes++;
  });
  await page.goto('/');
  await page.getByRole('button', { name: '태스크 추가', exact: true }).click();
  await page.getByLabel('태스크 제목', { exact: true }).fill('오프라인 초안');
  await page
    .getByLabel('프로젝트', { exact: true })
    .selectOption('00000000-0000-0000-0000-000000000001');
  const editor = await page.getByRole('dialog').elementHandle();
  fail = true;
  await focusAfterCooldown(page);
  await expect(page.locator('.session-check-notice')).toBeAttached();
  await page.getByRole('dialog').getByRole('button', { name: '태스크 저장', exact: true }).click();
  await expect(page.getByLabel('태스크 제목', { exact: true })).toHaveValue('오프라인 초안');
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  expect(writes).toBe(0);
  fail = false;
  expect(await editor!.evaluate((node) => node.isConnected)).toBe(true);
  await expect(page.getByLabel('태스크 제목', { exact: true })).toHaveValue('오프라인 초안');
  const saved = { ...task(), categoryId: null, title: '오프라인 초안' };
  await page.route('**/api/v2/tasks', (route) => route.fulfill({ status: 201, json: saved }));
  await page.route('**/api/v2/tasks/' + saved.id, (route) => route.fulfill({ json: saved }));
  await page.getByRole('dialog').getByRole('button', { name: '태스크 저장', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.session-check-notice')).toHaveCount(0);
  expect(writes).toBe(1);
});

for (const status of [401, 403])
  test(`background authentication rejection ${status} removes the old workspace`, async ({
    page,
  }) => {
    await setup(page);
    let expired = false;
    await page.route('**/api/v1/me', (route) =>
      route.fulfill(
        expired
          ? { status, json: { code: status === 403 ? 'ACCOUNT_DISABLED' : 'UNAUTHENTICATED' } }
          : { json: identity },
      ),
    );
    await page.goto('/');
    await expect(page.locator('.app-shell')).toBeVisible();
    expired = true;
    await focusAfterCooldown(page);
    await expect(page.locator('.app-shell')).toHaveCount(0);
  });

test('a changed account detected by focus retires the old DOM and unsaved editor', async ({
  page,
}) => {
  await setup(page);
  let current = identity;
  await page.route('**/api/v1/me', (route) => route.fulfill({ json: current }));
  await page.goto('/');
  await page.getByRole('button', { name: '태스크 추가', exact: true }).click();
  await page.getByLabel('태스크 제목', { exact: true }).fill('이전 계정 초안');
  const old = await page.locator('.app-shell').elementHandle();
  current = { ...identity, id: id(999), displayName: 'Bob' };
  await focusAfterCooldown(page);
  await expect(page.locator('.authenticated-workspace')).toHaveAttribute(
    'aria-label',
    'Bob · Workspace',
  );
  expect(await old!.evaluate((node) => node.isConnected)).toBe(false);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a blocked Dashboard save retains the editable draft without a false revision conflict', async ({
  page,
}) => {
  await setup(page);
  let fail = false;
  let current = dashboard();
  let writes = 0;
  await page.route('**/api/v1/me', (route) =>
    route.fulfill(fail ? { status: 503, json: {} } : { json: identity }),
  );
  await page.route('**/api/v2/dashboards/home', (route) => {
    if (route.request().method() === 'PUT') {
      writes++;
      const body = route.request().postDataJSON();
      current = {
        ...body,
        widgets: body.widgets.map((widget: object) => ({ ...widget, selectionState: 'valid' })),
        id: 'home',
        revision: writes,
      };
    }
    return route.fulfill({ json: current });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '배치 편집', exact: true }).click();
  await page.getByRole('button', { name: '바로가기 제거', exact: true }).click();
  fail = true;
  await focusAfterCooldown(page);
  await expect(page.locator('.session-check-notice')).toBeVisible();
  await page.getByRole('button', { name: '배치 저장', exact: true }).click();
  await expect(
    page
      .locator('.dashboard-surface > .notice, .dashboard-surface .notice')
      .filter({ hasText: '세션을 확인하지 못했습니다' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '배치 저장', exact: true })).toBeEnabled();
  await expect(page.getByRole('region', { name: '배치 충돌 검토' })).toHaveCount(0);
  expect(writes).toBe(0);
  await expect(page.locator('.dashboard-grid > .widget')).toHaveCount(5);
  fail = false;
  await page.getByRole('button', { name: '배치 저장', exact: true }).click();
  await expect(page.getByText('배치를 적용했습니다.')).toBeVisible();
  expect(writes).toBe(1);
  await expect(page.locator('.dashboard-grid > .widget')).toHaveCount(5);
});

for (const [name, width, height] of [
  ['desktop', 1440, 1000],
  ['mobile', 390, 844],
  ['landscape', 844, 390],
] as const)
  test(`connection notice retains the layout and supports retry: ${name}`, async ({ page }) => {
    await setup(page);
    await page.setViewportSize({ width, height });
    let fail = false;
    await page.route('**/api/v1/me', (route) =>
      route.fulfill(fail ? { status: 503, json: {} } : { json: identity }),
    );
    await page.goto('/');
    await expect(page.locator('.app-shell')).toBeVisible();
    const shell = await page.locator('.app-shell').elementHandle();
    fail = true;
    await focusAfterCooldown(page);
    await expect(page.getByRole('button', { name: '세션 다시 확인' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `.auth-validation/session-check-${name}.png` });
    fail = false;
    await page.getByRole('button', { name: '세션 다시 확인' }).click();
    await expect(page.locator('.session-check-notice')).toHaveCount(0);
    expect(await shell!.evaluate((node) => node.isConnected)).toBe(true);
  });
