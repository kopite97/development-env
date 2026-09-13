import { test, expect, setup, project, id, identity } from './fixtures';
test('same-account verification hides and restores draft; changed account discards it', async ({
  page,
}) => {
  await setup(page);
  let account = identity,
    unavailable = false;
  await page.route('**/api/v1/me', (route) =>
    unavailable ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ json: account }),
  );
  await page.route('**/api/v1/projects/' + id(1), (route) => route.fulfill({ json: project(1) }));
  await page.goto('/projects/' + id(1));
  await page.getByRole('button', { name: 'Edit Project', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Detached draft');
  unavailable = true;
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
  );
  await expect(page.getByRole('heading', { name: 'Connection problem' })).toBeVisible();
  await expect(page.getByLabel('Name', { exact: true })).toHaveCount(0);
  unavailable = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Detached draft');
  account = {
    ...identity,
    id: id(201),
    displayName: 'Bob',
    workspace: { ...identity.workspace, id: id(202) },
  };
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
  );
  await expect(page.getByRole('heading', { name: 'Bob', exact: true })).toBeVisible();
  await expect(page.getByLabel('Name', { exact: true })).toHaveCount(0);
});
for (const status of [200, 401, 403])
  test(`late old-account ${status} cannot navigate or retire the new account`, async ({ page }) => {
    await setup(page);
    let account = identity,
      release!: () => void;
    const pending = new Promise<void>((r) => {
      release = r;
    });
    let started = false;
    await page.route('**/api/v1/me', (route) => route.fulfill({ json: account }));
    await page.route('**/api/v1/projects?*', (route) =>
      route.fulfill({ json: { items: [], total: 0, nextCursor: null } }),
    );
    await page.route('**/api/v1/projects', async (route) => {
      started = true;
      await pending;
      await route.fulfill({
        status,
        json:
          status === 200
            ? project(1)
            : { code: status === 401 ? 'AUTH_REQUIRED' : 'ACCOUNT_DISABLED' },
      });
    });
    await page.goto('/projects');
    await page.getByRole('button', { name: 'Create Project', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill('Old intent');
    await page.getByLabel('Stack', { exact: true }).fill('Java');
    await page.getByRole('button', { name: 'Save Project' }).click();
    await expect.poll(() => started).toBeTruthy();
    account = {
      ...identity,
      id: id(201),
      displayName: 'Bob',
      workspace: { ...identity.workspace, id: id(202) },
    };
    await page.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
    );
    await expect(page.getByRole('heading', { name: 'Bob', exact: true })).toBeVisible();
    release();
    await page.waitForTimeout(150);
    await expect(page.getByRole('heading', { name: 'Bob', exact: true })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/projects');
    await expect(page.getByLabel('Name', { exact: true })).toHaveCount(0);
  });
test('dirty Back can be rejected and accepted; mobile form is keyboard accessible', async ({
  page,
}) => {
  await setup(page);
  await page.route('**/api/v1/projects?*', (route) =>
    route.fulfill({ json: { items: [project(1)], total: 1, nextCursor: null } }),
  );
  await page.route('**/api/v1/projects/' + id(1), (route) => route.fulfill({ json: project(1) }));
  await page.goto('/projects?q=Java');
  await page.getByRole('button', { name: 'Project 1', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Project', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Keep draft');
  page.once('dialog', (d) => d.dismiss());
  await page.goBack();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Keep draft');
  await expect(page).toHaveURL(new RegExp(id(1)));
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.getByLabel('Name', { exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Subtitle', { exact: true })).toBeFocused();
  page.once('dialog', (d) => d.accept());
  await page.goBack();
  await expect(page.getByLabel('Search Projects')).toHaveValue('Java');
  await page.goForward();
  await expect(page.getByRole('button', { name: 'Edit Project', exact: true })).toBeVisible();
  await expect(page.getByLabel('Name', { exact: true })).toHaveCount(0);
});
test('current mutation 401 clears private state immediately', async ({ page }) => {
  await setup(page);
  await page.route('**/api/v1/projects?*', (route) =>
    route.fulfill({ json: { items: [], total: 0, nextCursor: null } }),
  );
  await page.route('**/api/v1/projects', (route) =>
    route.fulfill({ status: 401, json: { code: 'AUTH_REQUIRED' } }),
  );
  await page.goto('/projects');
  await page.getByRole('button', { name: 'Create Project', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Private draft');
  await page.getByLabel('Stack', { exact: true }).fill('Java');
  await page.getByRole('button', { name: 'Save Project' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to your workspace' })).toBeVisible();
  await expect(page.getByLabel('Name', { exact: true })).toHaveCount(0);
});
