import { expect, test } from './fixtures';
const alice = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Alice',
  workspace: { id: '22222222-2222-4222-8222-222222222222', name: 'Alice workspace', revision: 1 },
};
const bob = {
  id: '33333333-3333-4333-8333-333333333333',
  displayName: 'Bob',
  workspace: { id: '44444444-4444-4444-8444-444444444444', name: 'Bob workspace', revision: 1 },
};

test('checking gates private content; StrictMode, deep links, reload and account revalidation', async ({
  page,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  let identity = alice;
  await page.route('**/api/v1/me', async (route) => {
    calls++;
    await pending;
    await route.fulfill({ json: identity });
  });
  await page.goto('/projects/example?category=uncategorized&q=work&archived=true');
  await expect(page.getByRole('status')).toHaveText('Checking your session…');
  await expect(page.getByText('Alice', { exact: true })).toHaveCount(0);
  release();
  await expect(
    page.getByRole('region', { name: 'Alice · Alice workspace', exact: true }),
  ).toBeVisible();
  expect(calls).toBe(1);
  await expect(
    page.getByText('잘못된 프로젝트 주소입니다. 목록에서 프로젝트를 선택해 주세요.'),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('region', { name: 'Alice · Alice workspace', exact: true }),
  ).toBeVisible();
  expect(calls).toBe(2);
  identity = bob;
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
  );
  await expect(
    page.getByRole('region', { name: 'Bob · Bob workspace', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Alice · Alice workspace', exact: true }),
  ).toHaveCount(0);
  await page
    .locator('.sidebar nav')
    .getByRole('button', { name: '작업 보드', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: '작업 보드', exact: true })).toBeVisible();
  await page.goBack();
  await expect(
    page.getByText('잘못된 프로젝트 주소입니다. 목록에서 프로젝트를 선택해 주세요.'),
  ).toBeVisible();
});
for (const scenario of [
  { status: 401, body: { code: 'AUTH_REQUIRED' }, heading: 'Sign in to your workspace' },
  { status: 403, body: { code: 'ACCOUNT_DISABLED' }, heading: 'Account disabled' },
  { status: 403, body: { code: 'UNKNOWN' }, heading: 'Connection problem' },
  { status: 503, body: { requestId: 'req-safe' }, heading: 'Connection problem' },
  { status: 200, body: { invalid: true }, heading: 'Connection problem' },
])
  test('bootstrap ' + scenario.status + ' ' + JSON.stringify(scenario.body), async ({ page }) => {
    await page.route('**/api/v1/me', (route) =>
      route.fulfill({ status: scenario.status, json: scenario.body }),
    );
    await page.goto('/');
    await expect(page.getByRole('heading', { name: scenario.heading })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Workspace' })).toHaveCount(0);
  });
test('HTML success is a retryable protocol error, never a demo fallback', async ({ page }) => {
  let succeeds = false;
  await page.route('**/api/v1/me', (route) =>
    route.fulfill(
      succeeds ? { json: alice } : { contentType: 'text/html', body: '<html>SPA</html>' },
    ),
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Connection problem' })).toBeVisible();
  succeeds = true;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Alice · Alice workspace', exact: true }),
  ).toBeVisible();
});
test('login is explicit navigation with safe intent and fixed consumed failure notice', async ({
  page,
}) => {
  await page.route('**/api/v1/me', (route) => route.fulfill({ status: 401, body: '' }));
  await page.route('**/api/v1/auth/login?**', (route) =>
    route.fulfill({ contentType: 'text/html', body: 'Backend login entry' }),
  );
  await page.goto(
    '/projects/example?q=two+words&scope=server&archived=true&authError=login_failed',
  );
  await expect(page.getByRole('alert')).toHaveText('Google sign-in failed. Please try again.');
  expect(page.url()).not.toContain('authError');
  expect(page.url()).toContain('archived=true');
  const request = page.waitForRequest('**/api/v1/auth/login?**');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  expect(new URL((await request).url()).searchParams.get('returnTo')).toBe(
    '/projects/example?scope=server&q=two+words&archived=true',
  );
});
test('unknown routes and long names fit mobile with visible keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/v1/me', (route) =>
    route.fulfill({ json: { ...alice, displayName: 'Long'.repeat(80) } }),
  );
  await page.goto('/missing');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '메뉴 열기' })).toBeFocused();
  await page.screenshot({ path: 'test-results/auth-mobile.png', fullPage: true });
});
