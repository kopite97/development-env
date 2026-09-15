import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export async function validateCategories({ page, context, origin, sql, alice, output }) {
  const contract = await (await context.request.get('http://127.0.0.1:18080/v3/api-docs')).json();
  const live = await (await context.request.get('http://127.0.0.1:8080/v3/api-docs')).json();
  for (const endpoint of [
    '/api/v1/project-categories',
    '/api/v1/project-categories/{id}',
    '/api/v1/projects',
    '/api/v1/projects/{id}',
  ])
    assert.deepEqual(contract.paths[endpoint], live.paths[endpoint]);
  for (const name of [
    'CategoryResponse',
    'CategoryListResponse',
    'CreateCategoryRequest',
    'RenameCategoryRequest',
    'ProjectResponse',
    'LegacyProjectResponse',
    'CreateProjectRequest',
    'UpdateProjectRequest',
  ])
    assert.deepEqual(contract.components.schemas[name], live.components.schemas[name]);
  const csrf = (await (await context.request.get(origin + '/api/v1/auth/csrf')).json()).csrfToken;
  const headers = { Origin: origin, 'X-CSRF-Token': csrf };
  const categories = origin + '/api/v1/project-categories',
    projects = origin + '/api/v1/projects';
  const post = (url, data, key) =>
    context.request.post(url, { headers: { ...headers, 'Idempotency-Key': key }, data });
  const patch = (url, data) => context.request.patch(url, { headers, data });
  const remove = (category) =>
    context.request.delete(categories + '/' + category.id + '?revision=' + category.revision, {
      headers,
    });
  const json = async (response, status) => {
    assert.equal(response.status(), status);
    return response.json();
  };
  assert.deepEqual(await json(await context.request.get(categories), 200), { items: [], total: 0 });
  const raw = { name: '  e\u0301  ' };
  const initial = await json(await post(categories, raw, 'category-original'), 201);
  assert.equal(initial.name, 'é');
  assert.equal(
    (await json(await post(categories, { name: 'é' }, 'category-conflict'), 409)).code,
    'CATEGORY_NAME_CONFLICT',
  );
  assert.equal(
    (await json(await post(categories, { name: 'é' }, 'category-original'), 409)).code,
    'IDEMPOTENCY_KEY_REUSED',
  );
  let category = await json(
    await patch(categories + '/' + initial.id, { revision: 1, name: '사용자 분야' }),
    200,
  );
  assert.equal(category.revision, 2);
  assert.equal(
    (await json(await patch(categories + '/' + initial.id, { revision: 1, name: 'stale' }), 409))
      .code,
    'REVISION_CONFLICT',
  );
  category = await json(
    await patch(categories + '/' + category.id, { revision: 2, name: category.name }),
    200,
  );
  assert.equal(category.revision, 3);
  assert.deepEqual(await json(await post(categories, raw, 'category-original'), 201), initial);
  let project = await json(
    await post(
      projects,
      { name: 'Category acceptance', scope: 'server', stack: 'Java', categoryId: category.id },
      'category-project',
    ),
    201,
  );
  const uncategorized = await json(
    await post(
      projects,
      { name: 'Omitted', scope: 'unity', stack: 'C#' },
      'category-legacy-project',
    ),
    201,
  );
  assert.equal(uncategorized.categoryId, null);
  const explicit = await json(
    await post(
      projects,
      { name: 'Null', scope: 'unity', stack: 'C#', categoryId: null },
      'category-null-project',
    ),
    201,
  );
  assert.equal(explicit.categoryId, null);
  assert.equal((await json(await remove(category), 409)).code, 'CATEGORY_IN_USE');
  project = await json(
    await patch(projects + '/' + project.id, { revision: project.revision, status: 'archived' }),
    200,
  );
  assert.equal(project.categoryId, category.id);
  assert.equal((await json(await remove(category), 409)).code, 'CATEGORY_IN_USE');
  await page.goto(origin + '/projects/' + project.id);
  await expect(page.locator('.project-summary')).toContainText(category.name);
  const beforeRevision = project.revision;
  category = await json(
    await patch(categories + '/' + category.id, { revision: category.revision, name: '새 분야' }),
    200,
  );
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.project-summary')).toContainText('새 분야');
  assert.equal(
    (await json(await context.request.get(projects + '/' + project.id), 200)).revision,
    beforeRevision,
  );
  await page.getByRole('button', { name: '프로젝트 편집', exact: true }).click();
  await page.getByLabel('개발 분야', { exact: true }).selectOption('');
  await page.getByRole('button', { name: '프로젝트 저장', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  project = await json(await context.request.get(projects + '/' + project.id), 200);
  assert.equal(project.categoryId, null);
  assert.equal(project.scope, 'server');
  assert.equal(project.status, 'archived');
  project = await json(
    await patch(projects + '/' + project.id, {
      revision: project.revision,
      categoryId: category.id,
    }),
    200,
  );
  assert.equal(project.categoryId, category.id);
  project = await json(
    await patch(projects + '/' + project.id, { revision: project.revision, categoryId: null }),
    200,
  );
  const missing = '00000000-0000-0000-0000-000000000099';
  assert.equal(
    (
      await post(
        projects,
        { name: 'Missing', scope: 'unity', stack: 'C#', categoryId: missing },
        'category-missing',
      )
    ).status(),
    404,
  );
  const foreignWorkspace = '00000000-0000-0000-0000-000000000902',
    foreignUser = '00000000-0000-0000-0000-000000000901';
  sql(
    `insert into users(id,display_name,created_at,updated_at) values('${foreignUser}','Foreign',now(),now()); insert into workspaces(id,owner_user_id,name,created_at,updated_at) values('${foreignWorkspace}','${foreignUser}','Foreign',now(),now()); insert into project_categories(id,workspace_id,name,created_at,updated_at) values('${missing}','${foreignWorkspace}','Foreign',now(),now())`,
  );
  assert.equal((await context.request.get(categories + '/' + missing)).status(), 404);
  assert.equal(
    (
      await patch(projects + '/' + project.id, { revision: project.revision, categoryId: missing })
    ).status(),
    404,
  );
  await json(await remove(category), 200);
  assert.equal((await remove(category)).status(), 404);
  assert.deepEqual(await json(await post(categories, raw, 'category-original'), 201), initial);
  assert.equal((await json(await context.request.get(categories), 200)).total, 0);
  // Reproduce a pre-deployment snapshot only inside this disposable database.
  sql(
    `update project_create_idempotency set response_body=(response_body::jsonb - 'categoryId')::text where key='category-legacy-project' and workspace_id='${alice.workspace.id}'`,
  );
  const replay = await json(
    await post(
      projects,
      { name: 'Omitted', scope: 'unity', stack: 'C#' },
      'category-legacy-project',
    ),
    201,
  );
  assert(!Object.hasOwn(replay, 'categoryId'));
  assert.equal(
    (await json(await context.request.get(projects + '/' + uncategorized.id), 200)).categoryId,
    null,
  );
  await page.goto(origin + '/projects');
  await page.getByRole('button', { name: '카테고리 관리', exact: true }).click();
  await page.getByLabel('카테고리 이름', { exact: true }).fill('UI category');
  await page.getByRole('button', { name: '카테고리 추가', exact: true }).click();
  await expect(page.locator('.category-list')).toContainText('UI category');
  await page.getByRole('button', { name: 'UI category 이름 변경', exact: true }).click();
  await page.getByLabel('새 카테고리 이름', { exact: true }).fill('UI renamed');
  await page.getByRole('button', { name: '이름 저장', exact: true }).click();
  await expect(page.locator('.category-list')).toContainText('UI renamed');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'UI renamed 삭제', exact: true }).click();
  await expect(page.locator('.category-list')).not.toContainText('UI renamed');
  await page.getByRole('button', { name: '닫기', exact: true }).last().click();
  for (let index = 0; index < 100; index++)
    await json(await post(categories, { name: 'Quota ' + index }, 'category-quota-' + index), 201);
  assert.equal(
    (await json(await post(categories, { name: 'Overflow' }, 'category-overflow'), 429)).code,
    'QUOTA_EXCEEDED',
  );
  assert.equal((await json(await context.request.get(categories), 200)).total, 100);
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(origin + '/projects/' + project.id);
    await expect(page.locator('.project-summary')).toBeVisible();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({
      path: path.join(output, 'category-detail-' + viewport.width + '.png'),
      fullPage: true,
    });
  }
  await page.goto(origin + '/projects');
  sql(
    `delete from project_create_idempotency; delete from project_category_create_idempotency; delete from projects; delete from project_categories; delete from workspaces where id='${foreignWorkspace}'; delete from users where id='${foreignUser}'`,
  );
  fs.writeFileSync(
    path.join(output, 'category-result.json'),
    JSON.stringify(
      {
        passed: true,
        contractMatches8080: true,
        crud: true,
        revision: true,
        quota: true,
        archived: true,
        scopeUnchanged: true,
        historicalReplay: true,
      },
      null,
      2,
    ),
  );
  console.log(
    'Category real acceptance passed: CRUD, revision, quota, active/archived relations, scope isolation and legacy replay.',
  );
}
