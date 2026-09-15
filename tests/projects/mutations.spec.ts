import { test, expect, setup, project, id } from './fixtures';
test('lost creation retries exact key/body then verifies a newer detail; duplicate submit stays single-flight', async ({
  page,
}) => {
  await setup(page);
  const writes: { key: string | undefined; body: unknown }[] = [];
  await page.route('**/api/v2/projects?*', (route) =>
    route.fulfill({ json: { items: [], total: 0, nextCursor: null } }),
  );
  await page.route('**/api/v2/projects', async (route) => {
    writes.push({
      key: route.request().headers()['idempotency-key'],
      body: route.request().postDataJSON(),
    });
    await new Promise((r) => setTimeout(r, 100));
    if (writes.length === 1) return route.abort();
    return route.fulfill({ status: 201, json: project(1) });
  });
  await page.route('**/api/v2/projects/' + id(1), (route) =>
    route.fulfill({ json: { ...project(1), name: 'Already edited', revision: 3 } }),
  );
  await page.goto('/projects');
  await page.getByRole('button', { name: '프로젝트 추가', exact: true }).first().click();
  await page.getByLabel('프로젝트 이름', { exact: true }).fill(' New raw name ');
  await page.getByLabel('기술 스택', { exact: true }).fill('C#');
  await page.getByRole('button', { name: '프로젝트 저장', exact: true }).dblclick();
  await expect(page.getByRole('alert')).toContainText('Creation was not confirmed');
  expect(writes).toHaveLength(1);
  await expect(page.getByLabel('프로젝트 이름', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '생성 다시 시도' }).click();
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
  await page.route('**/api/v2/projects/' + id(1), (route) => {
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
  await page.getByRole('button', { name: '프로젝트 편집', exact: true }).click();
  await page.getByLabel('프로젝트 목표 메모', { exact: true }).fill('My memo');
  await page.getByRole('button', { name: '프로젝트 저장' }).click();
  await expect(page.getByRole('alert')).toContainText('changed elsewhere');
  expect(writes).toEqual([{ revision: 1, currentMilestone: 'My memo' }]);
  await page.getByRole('button', { name: '내 변경 다시 적용' }).click();
  await expect(page.getByLabel('프로젝트 설명', { exact: true })).toHaveValue(
    'Concurrent subtitle',
  );
  await page.getByRole('button', { name: '프로젝트 저장' }).click();
  await expect(page.locator('.project-summary')).toContainText('My memo');
  expect(writes[1]).toEqual({ revision: 2, currentMilestone: 'My memo' });
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '프로젝트 편집', exact: true }).click();
  await page.getByRole('button', { name: '프로젝트 보관', exact: true }).click();
  await expect(page.locator('.project-summary')).toContainText('보관됨');
  expect(writes[2]).toEqual({ revision: 3, status: 'archived' });
  await page.getByRole('button', { name: '프로젝트 편집', exact: true }).click();
  await page.getByRole('button', { name: '보관 해제' }).click();
  await expect(page.locator('.project-summary')).toContainText('진행 중');
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
  await page.route('**/api/v2/projects?*', (route) =>
    route.fulfill({ json: { items: [], total: 0, nextCursor: null } }),
  );
  await page.route('**/api/v2/projects', (route) => {
    writes++;
    return route.fulfill({ status: 403, json: { code: 'CSRF_INVALID' } });
  });
  await page.goto('/projects');
  await page.getByRole('button', { name: '프로젝트 추가', exact: true }).first().click();
  await page.getByLabel('프로젝트 이름', { exact: true }).fill('Retain me');
  await page.getByLabel('기술 스택', { exact: true }).fill('C#');
  await page.getByRole('button', { name: '프로젝트 저장' }).click();
  await expect(page.getByRole('button', { name: '생성 다시 시도' })).toBeVisible();
  expect(writes).toBe(1);
  expect(tokens).toBe(2);
  await page.getByRole('button', { name: '생성 다시 시도' }).click();
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
  await page.route('**/api/v2/projects/' + id(1), (route) => {
    if (route.request().method() === 'GET')
      return failRead ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ json: current });
    writes++;
    current = { ...current, ...route.request().postDataJSON(), revision: current.revision + 1 };
    if (writes === 1) return route.abort();
    failRead = true;
    return route.fulfill({ json: current });
  });
  await page.goto('/projects/' + id(1));
  await page.getByRole('button', { name: '프로젝트 편집', exact: true }).click();
  await page.getByLabel('프로젝트 이름', { exact: true }).fill('Unconfirmed');
  await page.getByRole('button', { name: '프로젝트 저장' }).click();
  await expect(page.getByRole('alert')).toContainText('Update was not confirmed');
  expect(writes).toBe(1);
  await page.getByRole('button', { name: '내 변경 다시 적용' }).click();
  await page.getByLabel('프로젝트 이름', { exact: true }).fill('Confirmed');
  await page.getByRole('button', { name: '프로젝트 저장' }).click();
  await expect(page.getByRole('heading', { name: 'Confirmed', exact: true })).toBeVisible();
  await expect(page.getByText('프로젝트를 저장했습니다.', { exact: true })).toBeVisible();
  await expect(page.getByText('프로젝트를 새로 불러오지 못했습니다.')).toBeVisible();
  expect(writes).toBe(2);
});
