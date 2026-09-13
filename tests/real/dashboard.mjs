import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export async function validateDashboard({ page, context, origin, sql, alice, output }) {
  const contract = await (await context.request.get('http://127.0.0.1:18080/v3/api-docs')).json();
  const endpoint = '/api/v1/dashboards/home';
  const operation = contract.paths[endpoint];
  assert(operation.get.responses['200']);
  assert(operation.put.responses['200']);
  assert(!(operation.put.parameters ?? []).some((p) => p.name === 'Idempotency-Key'));
  fs.writeFileSync(
    path.join(output, 'dashboard-contract.json'),
    JSON.stringify(
      {
        path: operation,
        schemas: Object.fromEntries(
          Object.entries(contract.components.schemas).filter(([k]) => /Dashboard/.test(k)),
        ),
      },
      null,
      2,
    ),
  );
  const token = (await (await context.request.get(origin + '/api/v1/auth/csrf')).json()).csrfToken;
  const send = async (method, p, data, status = 200, key) => {
    const response = await context.request.fetch(origin + p, {
      method,
      headers: {
        Origin: origin,
        'X-CSRF-Token': token,
        ...(key ? { 'Idempotency-Key': key } : {}),
      },
      ...(data === undefined ? {} : { data }),
    });
    assert.equal(response.status(), status, method + ' ' + p + ' ' + (await response.text()));
    return response.json();
  };
  const get = () => send('GET', endpoint);
  const body = (revision, widgets) => ({ schemaVersion: 1, revision, widgets });
  const before = sql(
    `select revision||':'||data_revision from workspaces where id='${alice.workspace.id}'`,
  );
  const initial = await get();
  assert.deepEqual(initial, await get());
  assert.equal(initial.revision, 0);
  assert.equal(sql('select count(*) from dashboards'), '0');
  assert.equal(
    sql(`select revision||':'||data_revision from workspaces where id='${alice.workspace.id}'`),
    before,
  );
  assert.deepEqual(
    initial.widgets.map((w) => [w.id, w.type, w.title, w.scope, w.size, Object.keys(w).length]),
    [
      ['home-overview', 'overview', '프로젝트 개요', 'all', 'wide', 5],
      ['home-board', 'board', '작업 보드', 'all', 'wide', 5],
      ['home-deploy', 'deploy', '운영', 'all', 'medium', 5],
      ['home-links', 'links', '바로가기', 'all', 'small', 5],
      ['home-journal', 'journal', '개발 일지', 'all', 'medium', 5],
      ['home-milestone', 'milestone', '마일스톤', 'all', 'medium', 5],
    ],
  );
  await page.goto(origin);
  await expect(page.locator('.widget')).toHaveCount(6);
  assert.equal(sql('select count(*) from dashboards'), '0');
  // Real concurrent first-save compare-and-swap; exactly one revision-zero winner.
  const concurrent = await Promise.all(
    [[], initial.widgets].map((w) =>
      context.request.put(origin + endpoint, {
        headers: { Origin: origin, 'X-CSRF-Token': token },
        data: body(0, w),
      }),
    ),
  );
  assert.deepEqual(concurrent.map((r) => r.status()).sort(), [200, 409]);
  assert.equal((await get()).revision, 1);
  const projects = [];
  for (let i = 0; i < 23; i++)
    projects.push(
      await send(
        'POST',
        '/api/v1/projects',
        {
          name: 'Dashboard project ' + i,
          scope: i % 2 ? 'server' : 'unity',
          stack: i % 2 ? 'Java' : 'C#',
        },
        201,
        crypto.randomUUID(),
      ),
    );
  const selected = projects[0];
  await send(
    'POST',
    '/api/v1/tasks',
    {
      title: 'Dashboard task',
      projectId: selected.id,
      status: 'todo',
      priority: 'normal',
      tag: '',
      description: 'Preserved task',
    },
    201,
    crypto.randomUUID(),
  );
  await send(
    'POST',
    '/api/v1/journals',
    {
      title: 'Dashboard journal',
      projectId: selected.id,
      body: '  Entire body\n\n  ',
      entryDate: '2024-02-29',
    },
    201,
    crypto.randomUUID(),
  );
  await send(
    'POST',
    '/api/v1/milestones',
    { title: 'Dashboard milestone', projectId: selected.id, dueDate: null, completed: false },
    201,
    crypto.randomUUID(),
  );
  await send(
    'POST',
    '/api/v1/links',
    {
      label: 'Dashboard link',
      description: 'Real collection',
      url: 'https://example.com',
      scope: 'all',
    },
    201,
    crypto.randomUUID(),
  );
  const archived = await send('PATCH', '/api/v1/projects/' + selected.id, {
    revision: selected.revision,
    status: 'archived',
  });
  const firstPage = await send('GET', '/api/v1/projects?scope=all&status=all&query=&limit=20');
  assert(!firstPage.items.some((p) => p.id === selected.id));
  assert(firstPage.nextCursor);
  const business = () =>
    ['projects', 'tasks', 'journals', 'milestones', 'links'].map((t) =>
      sql(`select coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'[]') from ${t} t`),
    );
  const snapshot = business();
  const configured = initial.widgets.map((w) =>
    ['overview', 'board', 'journal', 'milestone'].includes(w.type)
      ? { ...w, scope: 'unity', projectId: selected.id, limit: 1 }
      : w,
  );
  let saved = await send('PUT', endpoint, body(1, configured));
  assert.equal(saved.revision, 2);
  assert(saved.widgets.filter((w) => w.projectId).every((w) => w.scope === 'all'));
  await send('PUT', endpoint, body(1, configured), 409);
  assert.deepEqual(business(), snapshot);
  await send('PUT', endpoint, { ...body(saved.revision, []), unknown: true }, 400);
  await send('PUT', endpoint, body(saved.revision, [{ ...initial.widgets[0], limit: null }]), 400);
  await send('PUT', endpoint, body(saved.revision, [initial.widgets[0], initial.widgets[0]]), 400);
  await send('PUT', endpoint, body(saved.revision, [{ ...initial.widgets[3], limit: 1 }]), 400);
  await send(
    'PUT',
    endpoint,
    body(0, [{ ...initial.widgets[0], projectId: '00000000-0000-0000-0000-000000000099' }]),
    404,
  );
  await page.reload();
  await expect(
    page
      .locator('[data-widget-id="home-overview"]')
      .getByRole('button', { name: selected.name + ' 상세 보기' }),
  ).toBeVisible();
  await expect(page.locator('.task-title')).toHaveText('Dashboard task');
  await expect(page.locator('.journal-row')).toHaveCount(1);
  await expect(page.locator('.milestone')).toHaveCount(1);
  await expect(page.locator('.quick-links strong')).toHaveText('Dashboard link');
  await expect(page.getByText('실시간 연동 전 · 데모 데이터')).toBeVisible();
  // Widget editor independently resolves an archived Project outside the first options page.
  await page.getByRole('button', { name: '배치 편집', exact: true }).click();
  await page.getByRole('button', { name: '프로젝트 개요 설정', exact: true }).click();
  await expect(page.getByLabel('특정 프로젝트')).toHaveValue(selected.id);
  await expect(
    page.getByRole('option', { name: selected.name + ' (보관)', exact: true }),
  ).toHaveCount(1);
  await page.keyboard.press('Escape');
  // Single frontend reset template must equal actual virtual GET; resetting only changes the draft.
  await page.getByRole('button', { name: '기본 배치', exact: true }).click();
  await page.getByRole('button', { name: '기본 배치 적용' }).click();
  assert.deepEqual((await get()).widgets, saved.widgets);
  const request = page.waitForRequest((r) => r.url() === origin + endpoint && r.method() === 'PUT');
  await page.getByRole('button', { name: '배치 저장', exact: true }).click();
  assert.deepEqual((await request).postDataJSON(), body(2, initial.widgets));
  await expect(page.getByText('배치를 적용했습니다.')).toBeVisible();
  saved = await get();
  assert.equal(saved.revision, 3);
  assert.deepEqual(business(), snapshot);
  // Real other-tab revision conflict preserves local removal and requires explicit reconciliation.
  await page.getByRole('button', { name: '배치 편집', exact: true }).click();
  await page.getByRole('button', { name: '바로가기 제거', exact: true }).click();
  const other = await context.newPage();
  await other.goto(origin);
  await other.getByRole('button', { name: '배치 편집', exact: true }).click();
  await other.getByRole('button', { name: '운영 제거', exact: true }).click();
  await other.getByRole('button', { name: '배치 저장', exact: true }).click();
  await expect(other.getByText('배치를 적용했습니다.')).toBeVisible();
  await other.close();
  await page.getByRole('button', { name: '배치 저장', exact: true }).click();
  await expect(page.getByRole('region', { name: '배치 충돌 검토' })).toBeVisible();
  await expect(page.getByRole('button', { name: '내 초안 전체 다시 적용' })).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '내 초안 전체 다시 적용' }).click();
  await page.getByRole('button', { name: '배치 저장', exact: true }).click();
  await expect(page.getByText('배치를 적용했습니다.')).toBeVisible();
  saved = await get();
  assert.equal(saved.revision, 5);
  assert(!saved.widgets.some((w) => w.type === 'links'));
  assert(saved.widgets.some((w) => w.type === 'deploy'));
  assert.deepEqual(business(), snapshot);
  // Persisted empty and repeated equal saves are real revisions, never virtual defaults.
  saved = await send('PUT', endpoint, body(saved.revision, []));
  await page.reload();
  await expect(page.getByText('표시할 위젯이 없어요')).toBeVisible();
  assert.equal((await get()).revision, 6);
  saved = await send('PUT', endpoint, body(saved.revision, []));
  assert.equal(saved.revision, 7);
  saved = await send('PUT', endpoint, body(saved.revision, initial.widgets));
  await page.reload();
  await expect(page.locator('.widget')).toHaveCount(6);
  await expect(page.locator('.project-row')).toHaveCount(20);
  await page.getByRole('button', { name: '프로젝트 더 보기' }).click();
  await expect(page.locator('.project-row')).toHaveCount(22);
  for (const [name, width, height] of [
    ['desktop', 1440, 1000],
    ['mobile', 390, 844],
    ['landscape', 844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({
      path: path.join(output, 'dashboard-' + name + '.png'),
      fullPage: true,
    });
    await page.getByRole('button', { name: '배치 편집', exact: true }).click();
    await page.getByRole('button', { name: '프로젝트 개요 설정', exact: true }).click();
    await page.screenshot({
      path: path.join(output, 'dashboard-editor-' + name + '.png'),
      fullPage: true,
    });
    await page.keyboard.press('Escape');
    await page
      .locator('.heading-actions')
      .getByRole('button', { name: '취소', exact: true })
      .click();
  }
  assert.deepEqual(business(), snapshot);
  assert.equal(sql(`select revision from workspaces where id='${alice.workspace.id}'`), '1');
  assert.equal(archived.status, 'archived');
  fs.writeFileSync(
    path.join(output, 'dashboard-result.json'),
    JSON.stringify(
      {
        passed: true,
        virtualDefault: initial,
        firstSaveRace: [200, 409],
        finalRevision: saved.revision,
        archivedReference: selected.id,
        defaultResetMatchesRuntime: true,
        businessRowsUnchanged: true,
        legacyStoragePreserved: true,
        viewports: ['desktop', 'mobile', 'landscape'],
      },
      null,
      2,
    ),
  );
  // Only disposable harness-owned records, not the user's running backend/database.
  await page.goto(origin + '/projects');
  sql(
    `delete from dashboards where workspace_id='${alice.workspace.id}'; delete from links where workspace_id='${alice.workspace.id}'; delete from milestones where workspace_id='${alice.workspace.id}'; delete from journals where workspace_id='${alice.workspace.id}'; delete from tasks where workspace_id='${alice.workspace.id}'; delete from projects where workspace_id='${alice.workspace.id}'`,
  );
  console.log(
    'Dashboard real acceptance passed: defaults, first-save race, config, archived UUID, reset, two-tab review, empty, API widgets, pagination, responsive and database isolation.',
  );
}
