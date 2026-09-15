import { test, expect, setup, project, id } from './fixtures';
const category = {
  id: id(90),
  name: '사용자 분야',
  revision: 1,
  createdAt: '2026-09-14T00:00:00Z',
  updatedAt: '2026-09-14T00:00:00Z',
};
test('rename freshness is independent of Project revision and unavailable selection is never replaced', async ({
  page,
}) => {
  await setup(page);
  let items = [category];
  const current = { ...project(1), categoryId: category.id };
  await page.route('**/api/v1/project-categories', (r) =>
    r.fulfill({ json: { items, total: items.length } }),
  );
  await page.route('**/api/v2/projects/' + id(1), (r) => r.fulfill({ json: current }));
  await page.goto('/projects/' + id(1));
  await expect(page.locator('.project-summary')).toContainText(category.name);
  items = [{ ...category, name: '외부 변경', revision: 2 }];
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.project-summary')).toContainText('외부 변경');
  expect(current.revision).toBe(1);
  await page.getByRole('button', { name: '프로젝트 편집', exact: true }).click();
  items = [];
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByLabel('개발 분야', { exact: true })).toHaveValue(category.id);
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('사용할 수 없어요');
});
test('confirmed v2 Project creation retries only its read after refresh failure', async ({
  page,
}) => {
  await setup(page);
  let writes = 0,
    fail = true;
  await page.route('**/api/v2/projects?*', (r) =>
    r.fulfill({ json: { items: [], total: 0, nextCursor: null } }),
  );
  await page.route('**/api/v2/projects', (r) => {
    writes++;
    return r.fulfill({ status: 201, json: project(1) });
  });
  await page.route('**/api/v2/projects/' + id(1), (r) =>
    fail ? r.fulfill({ status: 503, json: {} }) : r.fulfill({ json: project(1) }),
  );
  await page.goto('/projects');
  await page.getByRole('button', { name: '프로젝트 추가', exact: true }).first().click();
  await page.getByLabel('프로젝트 이름', { exact: true }).fill('Legacy');
  await page.getByLabel('기술 스택', { exact: true }).fill('C#');
  await page.getByRole('button', { name: '프로젝트 저장', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('생성은 완료');
  fail = false;
  await page.getByRole('button', { name: '최신 프로젝트 불러오기', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Project 1', exact: true })).toBeVisible();
  expect(writes).toBe(1);
});
test('Category revision conflict requires refreshed revision and explicit retry', async ({
  page,
}) => {
  await setup(page);
  let current = { ...category },
    writes = 0;
  await page.route('**/api/v2/projects?*', (r) =>
    r.fulfill({ json: { items: [], total: 0, nextCursor: null } }),
  );
  await page.route('**/api/v1/project-categories', (r) =>
    r.fulfill({ json: { items: [current], total: 1 } }),
  );
  await page.route('**/api/v1/project-categories/' + category.id, (r) => {
    if (r.request().method() === 'GET') return r.fulfill({ json: current });
    writes++;
    if (writes === 1) {
      current = { ...current, name: '외부 이름', revision: 2 };
      return r.fulfill({ status: 409, json: { code: 'REVISION_CONFLICT' } });
    }
    expect(r.request().postDataJSON()).toEqual({ name: '내 이름', revision: 2 });
    current = { ...current, name: '내 이름', revision: 3 };
    return r.fulfill({ json: current });
  });
  await page.goto('/projects');
  await page.getByRole('button', { name: '카테고리 관리', exact: true }).click();
  await page.getByRole('button', { name: category.name + ' 이름 변경', exact: true }).click();
  await page.getByLabel('새 카테고리 이름', { exact: true }).fill('내 이름');
  await page.getByRole('button', { name: '이름 저장', exact: true }).click();
  await expect(page.getByRole('button', { name: '이름 저장', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '목록 다시 확인', exact: true }).click();
  await expect(page.getByLabel('새 카테고리 이름', { exact: true })).toHaveValue('내 이름');
  expect(writes).toBe(1);
  await page.getByRole('button', { name: '이름 저장', exact: true }).click();
  await expect(page.locator('.category-list')).toContainText('내 이름');
});
test('management preserves Project draft and selection, supports CRUD and clear in-use errors', async ({
  page,
}) => {
  await setup(page);
  let items = [category];
  let failCreate = true;
  const writes: { body: unknown; key?: string }[] = [];
  await page.route('**/api/v2/projects?*', (r) =>
    r.fulfill({ json: { items: [], total: 0, nextCursor: null } }),
  );
  await page.route('**/api/v1/project-categories', (r) => {
    if (r.request().method() === 'POST') {
      writes.push({
        body: r.request().postDataJSON(),
        key: r.request().headers()['idempotency-key'],
      });
      if (failCreate) {
        failCreate = false;
        return r.fulfill({ status: 503, json: { code: 'INTERNAL_ERROR' } });
      }
      const created = { ...category, id: id(91), ...r.request().postDataJSON() };
      items.push(created);
      return r.fulfill({ status: 201, json: created });
    }
    return r.fulfill({ json: { items, total: items.length } });
  });
  await page.route('**/api/v1/project-categories/*', (r) => {
    const selected = new URL(r.request().url()).pathname.split('/').pop();
    const row = items.find((item) => item.id === selected)!;
    if (r.request().method() === 'DELETE') {
      expect(new URL(r.request().url()).searchParams.get('revision')).toBe(String(row.revision));
      if (selected === category.id)
        return r.fulfill({ status: 409, json: { code: 'CATEGORY_IN_USE' } });
      items = items.filter((item) => item.id !== selected);
      return r.fulfill({ json: { deletedId: selected } });
    }
    Object.assign(row, r.request().postDataJSON(), { revision: row.revision + 1 });
    return r.fulfill({ json: row });
  });
  await page.goto('/projects');
  await page.getByRole('button', { name: '프로젝트 추가', exact: true }).first().click();
  await page.getByLabel('프로젝트 이름', { exact: true }).fill('Preserved draft');
  await page.getByLabel('개발 분야', { exact: true }).selectOption(category.id);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '카테고리 관리', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.getByLabel('카테고리 이름', { exact: true }).fill('새 분야');
  await page.getByRole('button', { name: '카테고리 추가', exact: true }).click();
  await expect(page.getByLabel('카테고리 이름', { exact: true })).toHaveValue('새 분야');
  await page.getByRole('button', { name: '생성 다시 시도', exact: true }).click();
  await expect(page.locator('.category-list')).toContainText('새 분야');
  expect(writes[0]).toEqual(writes[1]);
  await page.getByRole('button', { name: '새 분야 이름 변경', exact: true }).click();
  await page.getByLabel('새 카테고리 이름', { exact: true }).fill('바꾼 분야');
  await page.getByRole('button', { name: '이름 저장', exact: true }).click();
  await expect(page.locator('.category-list')).toContainText('바꾼 분야');
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '사용자 분야 삭제', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('보관된 프로젝트');
  await expect(page.locator('.category-list')).toContainText('사용자 분야');
  await page.getByRole('button', { name: '요청 취소', exact: true }).click();
  await page.getByRole('button', { name: '바꾼 분야 삭제', exact: true }).click();
  await expect(page.locator('.category-list')).not.toContainText('바꾼 분야');
  await page.getByRole('button', { name: '닫기', exact: true }).last().click();
  await expect(page.getByLabel('프로젝트 이름', { exact: true })).toHaveValue('Preserved draft');
  await expect(page.getByLabel('개발 분야', { exact: true })).toHaveValue(category.id);
  await expect(page.getByLabel('개발 분야', { exact: true })).toBeFocused();
});
for (const code of ['CATEGORY_NAME_CONFLICT', 'QUOTA_EXCEEDED'])
  test('category ' + code + ' keeps editable draft without resubmitting', async ({ page }) => {
    await setup(page);
    await page.route('**/api/v2/projects?*', (r) =>
      r.fulfill({ json: { items: [], total: 0, nextCursor: null } }),
    );
    let writes = 0;
    await page.route('**/api/v1/project-categories', (r) => {
      if (r.request().method() === 'POST') {
        writes++;
        return r.fulfill({ status: code === 'QUOTA_EXCEEDED' ? 429 : 409, json: { code } });
      }
      return r.fulfill({ json: { items: [], total: 0 } });
    });
    await page.goto('/projects');
    await page.getByRole('button', { name: '카테고리 관리', exact: true }).click();
    await page.getByLabel('카테고리 이름', { exact: true }).fill('Keep me');
    await page.getByRole('button', { name: '카테고리 추가', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(
      code === 'QUOTA_EXCEEDED' ? '100개' : '같은 이름',
    );
    await expect(page.getByLabel('카테고리 이름', { exact: true })).toBeEnabled();
    await expect(page.getByLabel('카테고리 이름', { exact: true })).toHaveValue('Keep me');
    expect(writes).toBe(1);
  });
test('Category selection sends UUID independently of scope and archived Projects can clear it', async ({
  page,
}) => {
  await setup(page);
  await page.route('**/api/v1/project-categories', (r) =>
    r.fulfill({ json: { items: [category], total: 1 } }),
  );
  let current = { ...project(1), categoryId: null as string | null, status: 'archived' };
  const writes: Record<string, unknown>[] = [];
  await page.route('**/api/v2/projects/' + id(1), (r) => {
    if (r.request().method() === 'PATCH') {
      const body = r.request().postDataJSON();
      writes.push(body);
      current = { ...current, ...body, revision: current.revision + 1 };
    }
    return r.fulfill({ json: current });
  });
  await page.goto('/projects/' + id(1));
  await page.getByRole('button', { name: '프로젝트 편집', exact: true }).click();
  await page.getByLabel('개발 분야', { exact: true }).selectOption(category.id);
  await expect(page.getByLabel('호환 범위')).toHaveCount(0);
  await page.getByRole('button', { name: '프로젝트 저장', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(writes).toEqual([{ revision: 1, categoryId: category.id }]);
  await page.getByRole('button', { name: '프로젝트 편집', exact: true }).click();
  await page.getByLabel('개발 분야', { exact: true }).selectOption('');
  await page.getByRole('button', { name: '프로젝트 저장', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(writes[1]).toEqual({ revision: 2, categoryId: null });
});
