import { test, expect, setup, project, id } from './fixtures';
test('lost creation retries exact key/body then verifies a newer detail; duplicate submit stays single-flight', async ({
  page,
}) => {
  await setup(page);
  const writes: { key: string | undefined; body: unknown }[] = [];
  await page.route('**/api/v1/projects?*', (route) =>
    route.fulfill({ json: { items: [], total: 0, nextCursor: null } }),
  );
  await page.route('**/api/v1/projects', async (route) => {
    writes.push({
      key: route.request().headers()['idempotency-key'],
      body: route.request().postDataJSON(),
    });
    await new Promise((r) => setTimeout(r, 100));
    if (writes.length === 1) return route.abort();
    return route.fulfill({ status: 201, json: project(1) });
  });
  await page.route('**/api/v1/projects/' + id(1), (route) =>
    route.fulfill({ json: { ...project(1), name: 'Already edited', revision: 3 } }),
  );
  await page.goto('/projects');
  await page.getByRole('button', { name: 'Create Project', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill(' New raw name ');
  await page.getByLabel('Stack', { exact: true }).fill('C#');
  await page.getByRole('button', { name: 'Save Project', exact: true }).dblclick();
  await expect(page.getByRole('alert')).toContainText('Creation was not confirmed');
  expect(writes).toHaveLength(1);
  await expect(page.getByLabel('Name', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Retry creation' }).click();
  await expect(page.getByRole('heading', { name: 'Already edited' })).toBeVisible();
  expect(writes).toHaveLength(2);
  expect(writes[0]).toEqual(writes[1]);
  expect(writes[0].key).toBeTruthy();
  expect(writes[0].body).not.toHaveProperty('id');
  expect(writes[0].body).not.toHaveProperty('milestone');
});
test('revision conflict preserves draft; explicit review rebases dirty fields, archive keeps detail', async ({
  page,
}) => {
  await setup(page);
  let current = project(1),
    writes: Record<string, unknown>[] = [];
  await page.route('**/api/v1/projects/' + id(1), (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: current });
    const body = route.request().postDataJSON();
    writes.push(body);
    if (writes.length === 1) {
      current = { ...current, revision: 2, subtitle: 'Concurrent subtitle' };
      return route.fulfill({ status: 409, json: { code: 'REVISION_CONFLICT' } });
    }
    current = { ...current, ...body, revision: current.revision + 1 };
    return route.fulfill({ json: current });
  });
  await page.goto('/projects/' + id(1));
  await page.getByRole('button', { name: 'Edit Project', exact: true }).click();
  await page.getByLabel('Current milestone memo', { exact: true }).fill('My memo');
  await page.getByRole('button', { name: 'Save Project' }).click();
  await expect(page.getByRole('alert')).toContainText('changed elsewhere');
  expect(writes).toEqual([{ revision: 1, currentMilestone: 'My memo' }]);
  await page.getByRole('button', { name: 'Review reapplication' }).click();
  await expect(page.getByLabel('Subtitle', { exact: true })).toHaveValue('Concurrent subtitle');
  await page.getByRole('button', { name: 'Save Project' }).click();
  await expect(page.getByText('Current milestone memo: My memo')).toBeVisible();
  expect(writes[1]).toEqual({ revision: 2, currentMilestone: 'My memo' });
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Archive Project', exact: true }).click();
  await expect(page.getByText('Archived Project · unity')).toBeVisible();
  expect(writes[2]).toEqual({ revision: 3, status: 'archived' });
  await page.getByRole('button', { name: 'Unarchive Project' }).click();
  await expect(page.getByText('Active Project · unity')).toBeVisible();
});
test('CSRF recovery retains immutable intent only for same identity and never replays automatically', async ({
  page,
}) => {
  await setup(page);
  let writes = 0,
    tokens = 0;
  await page.route('**/api/v1/auth/csrf', (route) => {
    tokens++;
    return route.fulfill({ json: { csrfToken: 'token-' + tokens } });
  });
  await page.route('**/api/v1/projects?*', (route) =>
    route.fulfill({ json: { items: [], total: 0, nextCursor: null } }),
  );
  await page.route('**/api/v1/projects', (route) => {
    writes++;
    return route.fulfill({ status: 403, json: { code: 'CSRF_INVALID' } });
  });
  await page.goto('/projects');
  await page.getByRole('button', { name: 'Create Project', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Retain me');
  await page.getByLabel('Stack', { exact: true }).fill('C#');
  await page.getByRole('button', { name: 'Save Project' }).click();
  await expect(page.getByRole('button', { name: 'Retry creation' })).toBeVisible();
  expect(writes).toBe(1);
  expect(tokens).toBe(2);
  await page.getByRole('button', { name: 'Retry creation' }).click();
  await expect(page.getByRole('alert')).toContainText('failed again');
  expect(writes).toBe(2);
  expect(tokens).toBe(2);
});
test('ambiguous PATCH reconciles without replay; confirmed save survives a failed refresh', async ({
  page,
}) => {
  await setup(page);
  let current = project(1),
    writes = 0,
    failRead = false;
  await page.route('**/api/v1/projects/' + id(1), (route) => {
    if (route.request().method() === 'GET')
      return failRead ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ json: current });
    writes++;
    current = { ...current, ...route.request().postDataJSON(), revision: current.revision + 1 };
    if (writes === 1) return route.abort();
    failRead = true;
    return route.fulfill({ json: current });
  });
  await page.goto('/projects/' + id(1));
  await page.getByRole('button', { name: 'Edit Project', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Unconfirmed');
  await page.getByRole('button', { name: 'Save Project' }).click();
  await expect(page.getByRole('alert')).toContainText('Update was not confirmed');
  expect(writes).toBe(1);
  await page.getByRole('button', { name: 'Review reapplication' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Confirmed');
  await page.getByRole('button', { name: 'Save Project' }).click();
  await expect(page.getByRole('heading', { name: 'Confirmed', exact: true })).toBeVisible();
  await expect(page.getByText('Project saved.', { exact: true })).toBeVisible();
  await expect(page.getByText('Project could not be refreshed.')).toBeVisible();
  expect(writes).toBe(2);
});
