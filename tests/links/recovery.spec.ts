import { test, expect, setup, identity, id } from './fixtures';
test('same identity recovery retains Link draft and account change discards it', async ({
  page,
}) => {
  await setup(page);
  let account = identity;
  let failed = false;
  await page.route('**/api/v1/me', (r) =>
    failed ? r.fulfill({ status: 503, json: {} }) : r.fulfill({ json: account }),
  );
  await page.goto('/library');
  await page.getByRole('button', { name: '링크 추가', exact: true }).first().click();
  await page.getByLabel('링크 이름').fill('보존');
  failed = true;
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
  );
  await expect(page.getByRole('heading', { name: 'Connection problem' })).toBeVisible();
  failed = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByLabel('링크 이름')).toHaveValue('보존');
  account = {
    ...identity,
    id: id(201),
    displayName: 'Bob',
    workspace: { ...identity.workspace, id: id(202) },
  };
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
  );
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: '링크 추가', exact: true }).first().click();
  await expect(page.getByLabel('링크 이름')).toHaveValue('');
});
for (const status of [201, 401, 403])
  test('late Link mutation ' + status + ' cannot change next session', async ({ page }) => {
    await setup(page);
    let account = identity;
    let started = false;
    let release!: () => void;
    const pending = new Promise<void>((r) => (release = r));
    await page.route('**/api/v1/me', (r) => r.fulfill({ json: account }));
    await page.route('**/api/v2/links', async (r) => {
      started = true;
      await pending;
      await r.fulfill({
        status,
        json:
          status === 201
            ? {
                item: {
                  id: id(301),
                  label: 'Old',
                  description: '',
                  url: 'https://example.com',
                  scope: 'all',
                  revision: 1,
                  position: 0,
                  createdAt: '2026-09-14T00:00:00Z',
                  updatedAt: '2026-09-14T00:00:00Z',
                },
                collectionRevision: 1,
              }
            : { code: status === 401 ? 'AUTH_REQUIRED' : 'ACCOUNT_DISABLED' },
      });
    });
    await page.goto('/library');
    await page.getByRole('button', { name: '링크 추가', exact: true }).first().click();
    await page.getByLabel('링크 이름').fill('Old');
    await page.getByLabel('URL', { exact: true }).fill('https://example.com');
    await page.getByRole('button', { name: '링크 저장' }).click();
    await expect.poll(() => started).toBe(true);
    account = {
      ...identity,
      id: id(201),
      displayName: 'Bob',
      workspace: { ...identity.workspace, id: id(202) },
    };
    await page.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
    );
    await expect(page.getByRole('dialog')).toHaveCount(0);
    release();
    await page.waitForTimeout(150);
    await expect(page.getByRole('heading', { name: '자료실', exact: true })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Old' })).toHaveCount(0);
  });
test('CSRF recovery keeps exact Link intent without automatic replay', async ({ page }) => {
  await setup(page);
  const writes: unknown[] = [];
  await page.route('**/api/v2/links', (r) => {
    writes.push({
      key: r.request().headers()['idempotency-key'],
      body: r.request().postDataJSON(),
    });
    return r.fulfill({ status: 403, json: { code: 'CSRF_INVALID' } });
  });
  await page.goto('/library');
  await page.getByRole('button', { name: '링크 추가', exact: true }).first().click();
  await page.getByLabel('링크 이름').fill('보안 초안');
  await page.getByLabel('URL', { exact: true }).fill('https://example.com');
  await page.getByRole('button', { name: '링크 저장' }).click();
  await expect(page.getByRole('button', { name: '동일 요청 다시 시도' })).toBeEnabled();
  expect(writes).toHaveLength(1);
  await page.getByRole('button', { name: '동일 요청 다시 시도' }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[0]).toEqual(writes[1]);
});
test('lower server quota allows correcting draft without inventing collection capacity', async ({
  page,
}) => {
  await setup(page);
  await page.route('**/api/v2/links', (r) =>
    r.fulfill({
      status: 429,
      json: {
        code: 'QUOTA_EXCEEDED',
        message: '링크 한도에 도달했습니다. 기존 링크를 삭제해 주세요.',
      },
    }),
  );
  await page.goto('/library');
  await page.getByRole('button', { name: '링크 추가', exact: true }).first().click();
  await page.getByLabel('링크 이름').fill('quota');
  await page.getByLabel('URL', { exact: true }).fill('https://example.com');
  await page.getByRole('button', { name: '링크 저장' }).click();
  await expect(page.getByRole('alert')).toContainText('한도');
  await expect(page.getByLabel('링크 이름')).toBeEnabled();
  await expect(page.getByLabel('링크 이름')).toHaveValue('quota');
});
test('a slow old filter response cannot overwrite newer scope results', async ({ page }) => {
  await setup(page);
  let started = false;
  let release!: () => void;
  const pending = new Promise<void>((r) => (release = r));
  await page.route('**/api/v2/links?*', async (r) => {
    const p = new URL(r.request().url()).searchParams;
    if (p.get('query') === 'old') {
      started = true;
      await pending;
    }
    await r.fulfill({ json: { items: [], total: 0, nextCursor: null, collectionRevision: 0 } });
  });
  await page.goto('/library');
  await page.getByLabel('현재 화면 검색').fill('old');
  await expect.poll(() => started).toBe(true);
  await page.getByLabel('현재 화면 검색').fill('new');
  await expect(page).toHaveURL(/q=new/);
  release();
  await expect(page.getByRole('status')).toHaveText('검색 결과 0개');
  await expect(page.getByLabel('현재 화면 검색')).toHaveValue('new');
});
