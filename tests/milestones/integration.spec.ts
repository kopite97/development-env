import { test, expect, setup, project, id } from './fixtures';
const milestone = (n = 1, extra: Record<string, unknown> = {}) => ({
  id: id(300 + n),
  revision: 1,
  createdAt: '2026-09-13T00:00:00Z',
  updatedAt: '2026-09-13T00:00:00Z',
  title: '목표 ' + n,
  projectId: id(1),
  projectName: 'Project 1',
  scope: 'unity',
  dueDate: null,
  completed: false,
  ...extra,
});
test('Project rename and scope mutation refresh equal-revision Milestone presentation', async ({
  page,
}) => {
  await setup(page);
  let owner = project(1);
  let reads = 0;
  await page.route('**/api/v1/projects/' + id(1), (r) => {
    if (r.request().method() === 'PATCH')
      owner = { ...owner, ...r.request().postDataJSON(), revision: owner.revision + 1 };
    return r.fulfill({ json: owner });
  });
  await page.route('**/api/v1/projects?*', (r) =>
    r.fulfill({ json: { items: [owner], total: 1, nextCursor: null } }),
  );
  await page.route('**/api/v1/milestones?*', (r) => {
    reads++;
    return r.fulfill({
      json: {
        items: [milestone(1, { projectName: owner.name, scope: owner.scope })],
        total: 1,
        nextCursor: null,
      },
    });
  });
  await page.goto('/projects/' + id(1));
  await expect(page.locator('.milestone small')).toHaveText('Project 1');
  await page.getByRole('button', { name: 'Edit Project', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Renamed Project');
  await page.getByLabel('Project scope').selectOption('server');
  await page.getByRole('button', { name: 'Save Project', exact: true }).click();
  await expect(page.locator('.milestone small')).toHaveText('Renamed Project');
  expect(reads).toBeGreaterThan(1);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Archive Project', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unarchive Project', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '마일스톤 추가', exact: true })).toBeEnabled();
});
test('server status, cursor retry and detail outside loaded Project options', async ({ page }) => {
  await setup(page);
  const requests: string[] = [];
  let fail = true;
  await page.route('**/api/v1/projects?*', (r) =>
    r.fulfill({ json: { items: [project(2)], total: 2, nextCursor: 'more-projects' } }),
  );
  await page.route('**/api/v1/milestones?*', (r) => {
    const u = new URL(r.request().url());
    requests.push(u.search);
    if (u.searchParams.has('cursor') && fail) {
      fail = false;
      return r.fulfill({ status: 500, json: { code: 'INTERNAL_ERROR' } });
    }
    return r.fulfill({
      json: {
        items: u.searchParams.has('cursor') ? [milestone(2)] : [milestone()],
        total: 2,
        nextCursor: u.searchParams.has('cursor') ? null : 'next',
      },
    });
  });
  await page.route('**/api/v1/milestones/' + id(301), (r) => r.fulfill({ json: milestone() }));
  await page.goto('/projects/' + id(1));
  const region = page.getByRole('region', { name: '프로젝트 마일스톤' });
  await expect(region.locator('.milestone')).toHaveCount(1);
  await region.getByRole('button', { name: '더 보기', exact: true }).click();
  await expect(region.getByRole('alert')).toBeVisible();
  await expect(region.locator('.milestone')).toHaveCount(1);
  await region.getByRole('button', { name: '다음 페이지 다시 시도' }).click();
  await expect(region.locator('.milestone')).toHaveCount(2);
  await region.getByRole('button', { name: '목표 1 수정' }).click();
  await expect(page.getByLabel('프로젝트', { exact: true })).toHaveValue(id(1));
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await region.getByLabel('마일스톤 상태 필터').selectOption('done');
  expect(requests[0]).toContain('projectId=' + id(1));
  await expect.poll(() => requests.at(-1)).toContain('status=done');
  expect(requests.at(-1)).not.toContain('cursor');
});
test('archived Project creation freezes idempotency and keeps draft through failed reconciliation', async ({
  page,
}) => {
  await setup(page);
  await page.route('**/api/v1/projects/*', (r) => r.fulfill({ json: project(1, 'archived') }));
  await page.route('**/api/v1/projects?*', (r) =>
    r.fulfill({ json: { items: [project(1, 'archived')], total: 1, nextCursor: null } }),
  );
  const writes: { key: string; body: unknown }[] = [];
  let reconcile = false;
  await page.route('**/api/v1/milestones', (r) => {
    writes.push({
      key: r.request().headers()['idempotency-key'],
      body: r.request().postDataJSON(),
    });
    if (writes.length === 1) return r.abort('failed');
    return r.fulfill({ status: 201, json: milestone(1, { title: '보관 목표' }) });
  });
  await page.route('**/api/v1/milestones/' + id(301), (r) =>
    reconcile
      ? r.fulfill({ json: milestone(1, { title: '보관 목표' }) })
      : r.fulfill({ status: 500, json: { code: 'INTERNAL_ERROR' } }),
  );
  await page.goto('/projects/' + id(1));
  await page.getByRole('button', { name: '마일스톤 추가', exact: true }).click();
  await page.getByLabel('목표 제목').fill('보관 목표');
  await expect(page.getByLabel('프로젝트', { exact: true })).toHaveValue(id(1));
  await page.getByRole('button', { name: '마일스톤 저장' }).click();
  await expect(page.getByRole('button', { name: '동일 요청 다시 시도' })).toBeEnabled();
  await page.getByRole('button', { name: '동일 요청 다시 시도' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('현재 상태');
  await expect(page.getByLabel('목표 제목')).toHaveValue('보관 목표');
  expect(writes).toHaveLength(2);
  expect(writes[0]).toEqual(writes[1]);
  expect(writes[0].body).toEqual({
    title: '보관 목표',
    projectId: id(1),
    dueDate: null,
    completed: false,
  });
  reconcile = true;
  await page.getByRole('button', { name: '최신 상태 다시 확인' }).click();
  await page.getByRole('button', { name: '확인 후 닫기' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('dirty update conflict, archived reassignment, nullable date and permanent delete', async ({
  page,
}) => {
  await setup(page);
  let row = milestone(1, { dueDate: '2024-02-29' });
  let conflict = true;
  let deleted = false;
  const patches: unknown[] = [];
  await page.route('**/api/v1/projects?*', (r) =>
    r.fulfill({
      json: { items: [project(1), project(2, 'archived')], total: 2, nextCursor: null },
    }),
  );
  await page.route('**/api/v1/projects/*', (r) =>
    r.fulfill({ json: project(Number(r.request().url().slice(-1)), 'archived') }),
  );
  await page.route('**/api/v1/milestones?*', (r) =>
    r.fulfill({ json: { items: deleted ? [] : [row], total: deleted ? 0 : 1, nextCursor: null } }),
  );
  await page.route(/\/api\/v1\/milestones\/[0-9a-f-]+(?:\?.*)?$/, (r) => {
    const method = r.request().method();
    if (method === 'GET') return r.fulfill({ json: row });
    if (method === 'DELETE') {
      expect(new URL(r.request().url()).searchParams.get('revision')).toBe(String(row.revision));
      expect(r.request().postData()).toBeNull();
      deleted = true;
      return r.fulfill({ json: { deletedId: row.id } });
    }
    const body = r.request().postDataJSON();
    patches.push(body);
    if (conflict) {
      conflict = false;
      row = { ...row, revision: 2, title: 'Concurrent' };
      return r.fulfill({ status: 409, json: { code: 'REVISION_CONFLICT' } });
    }
    row = { ...row, ...body, revision: row.revision + 1 };
    return r.fulfill({ json: row });
  });
  await page.goto('/projects/' + id(1));
  await page.getByRole('button', { name: '목표 1 수정' }).click();
  await page.getByLabel('목표 제목').fill('내 변경');
  await page.getByLabel('목표 기한 (선택)').fill('');
  await page.getByLabel('프로젝트', { exact: true }).selectOption(id(2));
  await page.getByRole('button', { name: '마일스톤 저장' }).click();
  await expect(page.getByLabel('목표 제목')).toHaveValue('내 변경');
  await page.getByRole('button', { name: '내 변경 다시 적용' }).click();
  await page.getByRole('button', { name: '마일스톤 저장' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(patches[1]).toEqual({ revision: 2, title: '내 변경', dueDate: null, projectId: id(2) });
  await page.getByRole('button', { name: '내 변경 수정' }).click();
  await page.getByRole('button', { name: '영구 삭제', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '마일스톤 영구 삭제' })).toContainText(
    '복원할 수 없습니다',
  );
  await page.getByRole('button', { name: '영구 삭제 확인' }).click();
  await expect(page.locator('.milestone')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('complete and reopen use boolean PATCH and restore filter focus', async ({ page }) => {
  await setup(page);
  let row = milestone();
  const writes: unknown[] = [];
  await page.route('**/api/v1/milestones?*', (r) => {
    const status = new URL(r.request().url()).searchParams.get('status');
    const visible = status === 'all' || row.completed === (status === 'done');
    return r.fulfill({
      json: { items: visible ? [row] : [], total: visible ? 1 : 0, nextCursor: null },
    });
  });
  await page.route('**/api/v1/milestones/' + row.id, (r) => {
    if (r.request().method() === 'PATCH') {
      const body = r.request().postDataJSON();
      writes.push(body);
      row = { ...row, ...body, revision: row.revision + 1 };
    }
    return r.fulfill({ json: row });
  });
  await page.goto('/projects/' + id(1));
  await page.getByRole('button', { name: '목표 1 완료', exact: true }).click();
  await expect(page.locator('.milestone')).toHaveCount(0);
  await expect(page.getByLabel('마일스톤 상태 필터')).toBeFocused();
  await page.getByLabel('마일스톤 상태 필터').selectOption('done');
  await page.getByRole('button', { name: '목표 1 재개' }).click();
  await expect(page.locator('.milestone')).toHaveCount(0);
  expect(writes).toEqual([
    { revision: 1, completed: true },
    { revision: 2, completed: false },
  ]);
});
test('Home preserves bounded unity/open/two presentation and only navigates for management', async ({
  page,
}) => {
  await setup(page);
  const requests: string[] = [];
  await page.route('**/api/v1/milestones?*', (r) => {
    requests.push(r.request().url());
    return r.fulfill({
      json: { items: [milestone(1), milestone(2)], total: 3, nextCursor: 'more' },
    });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '다가오는 마일스톤', exact: true })).toHaveCSS(
    'font-size',
    '13px',
  );
  await expect(page.locator('.milestone')).toHaveCount(2);
  expect(requests[0]).toContain('scope=unity');
  expect(requests[0]).toContain('status=open');
  expect(requests[0]).toContain('limit=2');
  await expect(page.locator('.milestones')).toContainText('3개 중 2개 표시');
  await expect(page.getByRole('button', { name: '마일스톤 추가', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '목표 1 완료' })).toHaveCount(0);
  await page.getByRole('button', { name: '목표 1 프로젝트 열기' }).click();
  await expect(page).toHaveURL('/projects/' + id(1));
  await expect(page.getByRole('region', { name: '프로젝트 마일스톤' })).toBeVisible();
});
test('responsive editor preserves keyboard and unsaved navigation', async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/projects/' + id(1));
  await page.getByRole('button', { name: '마일스톤 추가', exact: true }).click();
  await expect(page.getByLabel('목표 제목')).toBeFocused();
  await page.getByLabel('목표 제목').fill('모바일 목표');
  page.once('dialog', (d) => d.dismiss());
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.getByRole('dialog').evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
  await page.screenshot({ path: '.auth-validation/milestone-api-mobile-editor.png' });
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
