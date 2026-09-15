import { test, expect, setup, identity, id } from './fixtures';
test('unchanged preselected creation closes without a discard prompt', async ({ page }) => {
  await setup(page);
  const prompts: string[] = [];
  page.on('dialog', async (dialog) => {
    prompts.push(dialog.message());
    await dialog.dismiss();
  });
  await page.goto('/projects/' + id(1));
  await page.getByRole('button', { name: '마일스톤 추가', exact: true }).click();
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(prompts).toEqual([]);
});
test('same identity revalidation preserves drafts and changed identity clears them', async ({
  page,
}) => {
  await setup(page);
  let account = identity;
  let unavailable = false;
  await page.route('**/api/v1/me', (r) =>
    unavailable ? r.fulfill({ status: 503, json: {} }) : r.fulfill({ json: account }),
  );
  await page.goto('/projects/' + id(1));
  await page.getByRole('button', { name: '마일스톤 추가', exact: true }).click();
  await page.getByLabel('목표 제목').fill('보존할 초안');
  unavailable = true;
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
  );
  await expect(page.getByRole('heading', { name: 'Connection problem' })).toBeVisible();
  unavailable = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByLabel('목표 제목')).toHaveValue('보존할 초안');
  account = {
    ...identity,
    id: id(201),
    displayName: 'Bob',
    workspace: { ...identity.workspace, id: id(202) },
  };
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
  );
  await expect(page.locator('.sidebar .profile strong')).toHaveText('Bob');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
for (const status of [201, 401, 403])
  test('late old-account mutation ' + status + ' cannot affect next identity', async ({ page }) => {
    await setup(page);
    let account = identity;
    let started = false;
    let release!: () => void;
    const pending = new Promise<void>((r) => (release = r));
    await page.route('**/api/v1/me', (r) => r.fulfill({ json: account }));
    await page.route('**/api/v2/milestones', async (r) => {
      started = true;
      await pending;
      await r.fulfill({
        status,
        json:
          status === 201
            ? {
                id: id(301),
                revision: 1,
                createdAt: '2026-09-13T00:00:00Z',
                updatedAt: '2026-09-13T00:00:00Z',
                title: 'Old',
                projectId: id(1),
                projectName: 'Project',
                categoryId: null,
                dueDate: null,
                completed: false,
              }
            : { code: status === 401 ? 'AUTH_REQUIRED' : 'ACCOUNT_DISABLED' },
      });
    });
    await page.goto('/projects/' + id(1));
    await page.getByRole('button', { name: '마일스톤 추가', exact: true }).click();
    await page.getByLabel('목표 제목').fill('Old');
    await page.getByRole('button', { name: '마일스톤 저장' }).click();
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
    await expect(page.locator('.sidebar .profile strong')).toHaveText('Bob');
    release();
    await page.waitForTimeout(150);
    await expect(page.locator('.sidebar .profile strong')).toHaveText('Bob');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
test('CSRF rejection never replays creation and preserves exact explicit retry intent', async ({
  page,
}) => {
  await setup(page);
  const writes: { key: string; body: unknown }[] = [];
  await page.route('**/api/v2/milestones', (r) => {
    writes.push({
      key: r.request().headers()['idempotency-key'],
      body: r.request().postDataJSON(),
    });
    return r.fulfill({ status: 403, json: { code: 'CSRF_INVALID' } });
  });
  await page.goto('/projects/' + id(1));
  await page.getByRole('button', { name: '마일스톤 추가', exact: true }).click();
  await page.getByLabel('목표 제목').fill('보안 초안');
  await page.getByRole('button', { name: '마일스톤 저장' }).click();
  await expect(page.getByRole('button', { name: '동일 요청 다시 시도' })).toBeEnabled();
  expect(writes).toHaveLength(1);
  await page.getByRole('button', { name: '동일 요청 다시 시도' }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[0]).toEqual(writes[1]);
  await expect(page.getByLabel('목표 제목')).toHaveValue('보안 초안');
});
