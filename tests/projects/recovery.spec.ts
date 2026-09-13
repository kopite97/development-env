import { test, expect, setup, project } from './fixtures';
test('confirmed filter navigation discards a creation draft', async ({ page }) => {
  await setup(page);
  await page.route('**/api/v1/projects?*', (route) =>
    route.fulfill({ json: { items: [], total: 0, nextCursor: null } }),
  );
  await page.goto('/projects');
  await page.getByRole('button', { name: 'Create Project', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Discard on filter');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('combobox', { name: 'Scope', exact: true }).selectOption('server');
  await expect(page.getByLabel('Name', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Create Project', exact: true }).click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('');
});
test('malformed first page is a protocol error; later network failure retries the same cursor', async ({
  page,
}) => {
  await setup(page);
  let first = true,
    later = true;
  const cursors: string[] = [];
  await page.route('**/api/v1/projects?*', (route) => {
    const cursor = new URL(route.request().url()).searchParams.get('cursor');
    if (first) {
      first = false;
      return route.fulfill({
        json: { items: [{ ...project(1), id: 'forest' }], total: 1, nextCursor: null },
      });
    }
    if (!cursor)
      return route.fulfill({ json: { items: [project(1)], total: 2, nextCursor: 'same-cursor' } });
    cursors.push(cursor);
    if (later) {
      later = false;
      return route.abort();
    }
    return route.fulfill({ json: { items: [project(2)], total: 2, nextCursor: null } });
  });
  await page.goto('/projects');
  await expect(page.getByText('Projects could not be loaded.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Project 1', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Restart list' }).click();
  await page.getByRole('button', { name: 'Load more', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Project 1', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retry Load more' }).click();
  await expect(page.getByText('2 matching Projects · 2 loaded rows')).toBeVisible();
  expect(cursors).toEqual(['same-cursor', 'same-cursor']);
});
test('server memo validation permits correction; key reuse never triggers an automatic new creation', async ({
  page,
}) => {
  await setup(page);
  let calls = 0;
  await page.route('**/api/v1/projects?*', (route) =>
    route.fulfill({ json: { items: [], total: 0, nextCursor: null } }),
  );
  await page.route('**/api/v1/projects', (route) => {
    calls++;
    return calls === 1
      ? route.fulfill({
          status: 400,
          json: {
            code: 'VALIDATION_ERROR',
            fieldErrors: { currentMilestone: 'Memo rejected by server' },
          },
        })
      : route.fulfill({ status: 409, json: { code: 'IDEMPOTENCY_KEY_REUSED' } });
  });
  await page.goto('/projects');
  await page.getByRole('button', { name: 'Create Project', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Test');
  await page.getByLabel('Stack', { exact: true }).fill('Java');
  await page.getByRole('button', { name: 'Save Project' }).click();
  await expect(page.getByText('Memo rejected by server')).toBeVisible();
  await expect(page.getByLabel('Current milestone memo', { exact: false })).toBeEnabled();
  await page.getByLabel('Current milestone memo', { exact: false }).fill('Corrected');
  await page.getByRole('button', { name: 'Save Project' }).click();
  await expect(page.getByText(/creation key belongs to different data/)).toBeVisible();
  expect(calls).toBe(2);
});
