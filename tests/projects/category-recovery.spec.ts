import { test, expect, setup, project, id, identity } from './fixtures';
const category = {
  id: id(90),
  name: 'Category',
  revision: 1,
  createdAt: '2026-09-14T00:00:00Z',
  updatedAt: '2026-09-14T00:00:00Z',
};
test('Project creation uses selected Category UUID without deriving scope', async ({ page }) => {
  await setup(page);
  await page.route('**/api/v1/project-categories', (r) =>
    r.fulfill({ json: { items: [category], total: 1 } }),
  );
  await page.route('**/api/v2/projects?*', (r) =>
    r.fulfill({ json: { items: [], total: 0, nextCursor: null } }),
  );
  let body: Record<string, unknown> = {};
  await page.route('**/api/v2/projects', (r) => {
    body = r.request().postDataJSON();
    return r.fulfill({ status: 201, json: { ...project(1), ...body } });
  });
  await page.route('**/api/v2/projects/' + id(1), (r) =>
    r.fulfill({ json: { ...project(1), ...body } }),
  );
  await page.goto('/projects');
  await page.getByRole('button', { name: '프로젝트 추가', exact: true }).first().click();
  await page.getByLabel('프로젝트 이름', { exact: true }).fill('Selected');
  await page.getByLabel('기술 스택', { exact: true }).fill('C#');
  await page.getByLabel('개발 분야', { exact: true }).selectOption(category.id);
  await page.getByRole('button', { name: '프로젝트 저장', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Selected', exact: true })).toBeVisible();
  expect(body).toMatchObject({ categoryId: category.id });
  expect(body).not.toHaveProperty('scope');
});
test('Category CSRF recovery retains exact intent and account change clears management draft', async ({
  page,
}) => {
  await setup(page);
  let account = identity;
  await page.route('**/api/v1/me', (r) => r.fulfill({ json: account }));
  await page.route('**/api/v2/projects?*', (r) =>
    r.fulfill({ json: { items: [], total: 0, nextCursor: null } }),
  );
  const writes: { key?: string; body: unknown }[] = [];
  await page.route('**/api/v1/project-categories', (r) => {
    if (r.request().method() === 'POST') {
      writes.push({
        key: r.request().headers()['idempotency-key'],
        body: r.request().postDataJSON(),
      });
      return r.fulfill({ status: 403, json: { code: 'CSRF_INVALID' } });
    }
    return r.fulfill({ json: { items: [], total: 0 } });
  });
  await page.goto('/projects');
  await page.getByRole('button', { name: '카테고리 관리', exact: true }).click();
  await page.getByLabel('카테고리 이름', { exact: true }).fill(' Raw draft ');
  await page.getByRole('button', { name: '카테고리 추가', exact: true }).click();
  await expect(page.getByRole('button', { name: '생성 다시 시도', exact: true })).toBeVisible();
  expect(writes).toHaveLength(1);
  await page.getByRole('button', { name: '생성 다시 시도', exact: true }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[0]).toEqual(writes[1]);
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
  await page.getByRole('button', { name: '카테고리 관리', exact: true }).click();
  await expect(page.getByLabel('카테고리 이름', { exact: true })).toHaveValue('');
});
test('confirmed Category create with failed refresh cannot be posted twice', async ({ page }) => {
  await setup(page);
  await page.route('**/api/v2/projects?*', (r) =>
    r.fulfill({ json: { items: [], total: 0, nextCursor: null } }),
  );
  let writes = 0,
    failed = false;
  await page.route('**/api/v1/project-categories', (r) => {
    if (r.request().method() === 'POST') {
      writes++;
      failed = true;
      return r.fulfill({ status: 201, json: category });
    }
    return failed
      ? r.fulfill({ status: 503, json: {} })
      : r.fulfill({ json: { items: [], total: 0 } });
  });
  await page.goto('/projects');
  await page.getByRole('button', { name: '카테고리 관리', exact: true }).click();
  await page.getByLabel('카테고리 이름', { exact: true }).fill('Category');
  await page.getByRole('button', { name: '카테고리 추가', exact: true }).click();
  await expect(
    page.getByText('저장은 완료되었지만 목록을 갱신하지 못했습니다. 목록만 다시 불러와 주세요.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '생성 다시 시도', exact: true })).toBeDisabled();
  failed = false;
  await page.getByRole('button', { name: '목록 다시 확인', exact: true }).click();
  await expect(page.getByLabel('카테고리 이름', { exact: true })).toHaveValue('');
  expect(writes).toBe(1);
});
