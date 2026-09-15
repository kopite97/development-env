import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export async function validateCategoryOnly({ page, context, origin, output }) {
  const csrf = (await (await context.request.get(origin + '/api/v1/auth/csrf')).json()).csrfToken;
  const headers = { Origin: origin, 'X-CSRF-Token': csrf };
  const evidence = [];
  const json = async (response, status = 200) => {
    assert.equal(response.status(), status, await response.text());
    const stamp = response.headers()['x-workspace-data-revision'];
    if (stamp !== undefined) assert.match(stamp, /^(0|[1-9]\d*)$/);
    evidence.push({ url: new URL(response.url()).pathname, status, stamp });
    return response.json();
  };
  const get = (url) => context.request.get(origin + url);
  const post = (url, body, key = crypto.randomUUID()) =>
    context.request.post(origin + url, {
      headers: { ...headers, 'Idempotency-Key': key },
      data: body,
    });
  const patch = (url, body) => context.request.patch(origin + url, { headers, data: body });
  const remove = (url, revision) =>
    context.request.delete(origin + url + '?revision=' + revision, { headers });
  const cats = '/api/v1/project-categories';
  const a = await json(await post(cats, { name: '클라이언트' }), 201);
  const b = await json(await post(cats, { name: '플랫폼' }), 201);
  assert.equal(
    (await json(await post(cats, { name: a.name }), 409)).code,
    'CATEGORY_NAME_CONFLICT',
  );
  const raw = { name: 'Category Project A', stack: 'TypeScript', categoryId: a.id };
  const key = crypto.randomUUID();
  let p = await json(await post('/api/v2/projects', raw, key), 201);
  const original = { ...p };
  const q = await json(
    await post('/api/v2/projects', { name: 'Category Project B', stack: 'Java', categoryId: b.id }),
    201,
  );
  const uncategorized = await json(
    await post('/api/v2/projects', { name: 'Uncategorized Project', stack: 'Go' }),
    201,
  );
  assert.equal(uncategorized.categoryId, null);
  for (const row of [p, q, uncategorized]) {
    assert(!Object.hasOwn(row, 'scope'));
    assert(!Object.hasOwn(row, 'colorToken'));
  }
  const task = await json(
    await post('/api/v2/tasks', { projectId: p.id, title: 'Category Task' }),
    201,
  );
  const journal = await json(
    await post('/api/v2/journals', {
      projectId: p.id,
      title: 'Category Journal',
      body: 'Real backend body',
      entryDate: '2026-09-15',
    }),
    201,
  );
  const milestone = await json(
    await post('/api/v2/milestones', { projectId: p.id, title: 'Category Milestone' }),
    201,
  );
  const linkResponse = await json(
    await post('/api/v2/links', {
      projectId: p.id,
      label: 'Category Link',
      url: 'https://example.com/category',
    }),
    201,
  );
  const unlinked = await json(
    await post('/api/v2/links', {
      label: 'Unlinked reference',
      url: 'https://example.com/unlinked',
    }),
    201,
  );
  assert.equal(unlinked.item.projectId, null);
  assert.equal(unlinked.item.categoryId, null);
  const link = linkResponse.item;
  for (const row of [task, journal, milestone, link]) assert.equal(row.categoryId, a.id);
  assert.equal(journal.entryDate, '2026-09-15');
  for (const resource of ['projects', 'tasks', 'journals', 'milestones', 'links']) {
    const rows = await json(await get('/api/v2/' + resource + '?category=' + a.id));
    assert(rows.items.length > 0);
    assert(rows.items.every((row) => row.categoryId === a.id));
    assert.equal((await get('/api/v2/' + resource + '?scope=unity')).status(), 400);
  }
  const mismatch = await json(await get('/api/v2/tasks?category=' + b.id + '&projectId=' + p.id));
  assert.equal(mismatch.total, 0);
  assert.equal(
    (await json(await remove(cats + '/' + a.id, a.revision), 409)).code,
    'CATEGORY_IN_USE',
  );
  await page.goto(origin + '/?category=' + a.id);
  await expect(page.locator('.project-row')).toHaveCount(1);
  for (const title of ['Category Task', 'Category Journal', 'Category Milestone', 'Category Link'])
    await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
  await page.getByLabel('개발 분야 필터', { exact: true }).selectOption(b.id);
  await expect(page.locator('.project-row')).toContainText(q.name);
  await expect(page.getByText('Category Task', { exact: true })).toHaveCount(0);
  await page.goBack();
  await expect(page.getByText('Category Task', { exact: true })).toBeVisible();
  const collectionBefore = await json(await get('/api/v2/links'));
  p = await json(
    await patch('/api/v2/projects/' + p.id, { revision: p.revision, categoryId: b.id }),
  );
  for (const [resource, row] of [
    ['tasks', task],
    ['journals', journal],
    ['milestones', milestone],
    ['links', link],
  ]) {
    const current = await json(await get('/api/v2/' + resource + '/' + row.id));
    assert.equal(current.categoryId, b.id);
    assert.equal(current.revision, row.revision);
  }
  assert.equal(
    (await json(await get('/api/v2/links'))).collectionRevision,
    collectionBefore.collectionRevision,
  );
  const renamed = await json(
    await patch(cats + '/' + b.id, { revision: b.revision, name: '플랫폼 새 이름' }),
  );
  assert.equal((await json(await get('/api/v2/projects/' + p.id))).revision, p.revision);
  const replay = await post('/api/v2/projects', raw, key);
  assert.equal(replay.headers()['x-workspace-data-revision'], undefined);
  assert.deepEqual(await json(replay, 201), original);
  assert.equal(
    (await json(await post('/api/v2/projects', { ...raw, categoryId: b.id }, key), 409)).code,
    'IDEMPOTENCY_KEY_REUSED',
  );
  const home = await json(await get('/api/v2/dashboards/home'));
  assert.equal(home.schemaVersion, 2);
  const widgets = ['overview', 'board', 'journal', 'milestone', 'links'].map((type) => ({
    id: 'category-' + type,
    type,
    title: type,
    size: 'medium',
    selection: { kind: 'category', categoryId: a.id },
  }));
  const saved = await json(
    await context.request.put(origin + '/api/v2/dashboards/home', {
      headers,
      data: { schemaVersion: 2, revision: home.revision, widgets },
    }),
  );
  await json(await remove(cats + '/' + a.id, a.revision));
  const missing = await json(await get('/api/v2/dashboards/home'));
  assert.equal(missing.revision, saved.revision);
  assert(missing.widgets.every((w) => w.selectionState === 'missingCategory'));
  const clean = missing.widgets.map(({ selectionState, ...w }) => w);
  const retained = await json(
    await context.request.put(origin + '/api/v2/dashboards/home', {
      headers,
      data: { schemaVersion: 2, revision: missing.revision, widgets: clean },
    }),
  );
  assert.equal(retained.revision, missing.revision + 1);
  await page.goto(origin + '/');
  await expect(page.getByRole('alert').first()).toContainText('사용할 수 없는 개발 분야');
  await page.getByLabel('개발 분야 필터', { exact: true }).selectOption(b.id);
  await expect(page.getByText('Category Task', { exact: true })).toBeVisible();
  assert.equal((await json(await get('/api/v2/dashboards/home'))).revision, retained.revision);
  p = await json(
    await patch('/api/v2/projects/' + p.id, {
      revision: p.revision,
      status: 'archived',
      categoryId: null,
    }),
  );
  assert.equal(p.categoryId, null);
  assert.equal(
    (
      await json(
        await post('/api/v2/journals', {
          title: 'Forbidden',
          body: 'Body',
          entryDate: '2026-09-15',
          projectId: p.id,
        }),
        409,
      )
    ).code,
    'PROJECT_ARCHIVED',
  );
  await page.goto(origin + '/projects/' + p.id);
  await expect(
    page
      .getByRole('region', { name: '프로젝트 최근 일지' })
      .getByRole('button', { name: '일지 작성' }),
  ).toHaveCount(0);
  await expect(page.getByRole('region', { name: '프로젝트 기본 정보' })).toContainText('미분류');
  for (const size of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    for (const route of [
      '/?category=' + b.id,
      '/projects',
      '/projects/' + p.id,
      '/tasks',
      '/journals',
      '/library',
    ]) {
      await page.goto(origin + route);
      await expect(page.locator('.page-heading')).toBeVisible();
      await page.waitForLoadState('networkidle');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({
        path: path.join(
          output,
          `category-only-${size.width}-${route.split('?')[0].replaceAll('/', '_')}.png`,
        ),
        fullPage: true,
      });
      await page.reload();
      await expect(page.locator('.page-heading')).toBeVisible();
    }
  }
  assert.equal(renamed.name, '플랫폼 새 이름');
  fs.writeFileSync(
    path.join(output, 'category-only-evidence.json'),
    JSON.stringify(evidence, null, 2),
  );
  console.log(
    'Category-only real contract, filters, metadata, replay, archived relations, missing Dashboard references and responsive routes passed.',
  );
}
