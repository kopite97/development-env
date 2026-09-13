import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export async function validateMilestones({ page, context, origin, sql, alice, output, phase }) {
  const contract = await (await context.request.get('http://127.0.0.1:18080/v3/api-docs')).json();
  const paths = Object.fromEntries(
    Object.entries(contract.paths).filter(([p]) => p.startsWith('/api/v1/milestones')),
  );
  for (const [p, m, status] of [
    ['/api/v1/milestones', 'get', '200'],
    ['/api/v1/milestones', 'post', '201'],
    ['/api/v1/milestones/{id}', 'get', '200'],
    ['/api/v1/milestones/{id}', 'patch', '200'],
    ['/api/v1/milestones/{id}', 'delete', '200'],
  ])
    assert(paths[p][m].responses[status]);
  assert(
    paths['/api/v1/milestones'].post.parameters.some(
      (p) => p.name === 'Idempotency-Key' && p.required,
    ),
  );
  assert(
    paths['/api/v1/milestones/{id}'].delete.parameters.some(
      (p) => p.name === 'revision' && p.in === 'query' && p.required,
    ),
  );
  fs.writeFileSync(
    path.join(output, 'milestone-contract.json'),
    JSON.stringify(
      {
        paths,
        schemas: Object.fromEntries(
          Object.entries(contract.components.schemas).filter(([k]) => k.includes('Milestone')),
        ),
      },
      null,
      2,
    ),
  );
  const token = (await (await context.request.get(origin + '/api/v1/auth/csrf')).json()).csrfToken;
  const headers = { Origin: origin, 'X-CSRF-Token': token };
  const send = async (method, p, data, status = 200, key) => {
    const response = await context.request.fetch(origin + p, {
      method,
      headers: { ...headers, ...(key ? { 'Idempotency-Key': key } : {}) },
      ...(data === undefined ? {} : { data }),
    });
    assert.equal(response.status(), status, method + ' ' + p + ' ' + (await response.text()));
    return response.json();
  };
  const p = await send(
    'POST',
    '/api/v1/projects',
    { name: 'Milestone acceptance', scope: 'unity', stack: 'C#' },
    201,
    crypto.randomUUID(),
  );
  const target = await send(
    'POST',
    '/api/v1/projects',
    { name: 'Archived destination', scope: 'server', stack: 'Java' },
    201,
    crypto.randomUUID(),
  );
  await send('PATCH', '/api/v1/projects/' + p.id, { revision: p.revision, status: 'archived' });
  await send('PATCH', '/api/v1/projects/' + target.id, {
    revision: target.revision,
    status: 'archived',
  });
  const rows = [];
  for (let i = 0; i < 25; i++)
    rows.push(
      await send(
        'POST',
        '/api/v1/milestones',
        {
          title: 'Milestone ' + i,
          projectId: p.id,
          dueDate: i < 22 ? '2024-02-' + String(i + 1).padStart(2, '0') : null,
          completed: false,
        },
        201,
        crypto.randomUUID(),
      ),
    );
  const base = '/api/v1/milestones?scope=all&projectStatus=all&status=open&limit=20';
  const first = await send('GET', base);
  assert.equal(first.total, 25);
  assert.equal(first.items.length, 20);
  assert(first.nextCursor);
  const second = await send('GET', base + '&cursor=' + encodeURIComponent(first.nextCursor));
  assert.equal(second.items.length, 5);
  assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.items, ...second.items].map((x) => x.id)).size, 25);
  assert(second.items.slice(-3).every((x) => x.dueDate === null));
  await send(
    'GET',
    base.replace('status=open', 'status=done') + '&cursor=' + encodeURIComponent(first.nextCursor),
    undefined,
    400,
  );
  assert.equal(
    (await send('GET', base.replace('projectStatus=all', 'projectStatus=archived'))).total,
    25,
  );
  assert.equal((await send('GET', '/api/v1/milestones?projectStatus=active')).total, 0);
  assert.equal((await send('GET', '/api/v1/milestones/' + rows[24].id)).id, rows[24].id);
  const changed = await send('PATCH', '/api/v1/milestones/' + rows[0].id, {
    revision: 1,
    projectId: target.id,
    completed: true,
    dueDate: null,
  });
  assert.equal(changed.projectId, target.id);
  assert.equal(changed.scope, 'server');
  assert.equal(changed.completed, true);
  assert.equal(changed.dueDate, null);
  const conflict = await send(
    'PATCH',
    '/api/v1/milestones/' + rows[0].id,
    { revision: 1, title: 'stale' },
    409,
  );
  assert.equal(conflict.code, 'REVISION_CONFLICT');
  const reopened = await send('PATCH', '/api/v1/milestones/' + changed.id, {
    revision: changed.revision,
    completed: false,
  });
  assert.equal(reopened.dueDate, null);
  const same = await send('PATCH', '/api/v1/milestones/' + changed.id, {
    revision: reopened.revision,
  });
  assert.equal(same.revision, reopened.revision + 1);
  const key = crypto.randomUUID(),
    body = { title: 'Replay milestone', projectId: p.id, dueDate: null, completed: false };
  const replay = await send('POST', '/api/v1/milestones', body, 201, key);
  await send('POST', '/api/v1/milestones', { title: body.title, projectId: p.id }, 409, key);
  const deletion = await send(
    'DELETE',
    '/api/v1/milestones/' + replay.id + '?revision=' + replay.revision,
  );
  assert.deepEqual(deletion, { deletedId: replay.id });
  await send('GET', '/api/v1/milestones/' + replay.id, undefined, 404);
  assert.deepEqual(await send('POST', '/api/v1/milestones', body, 201, key), replay);
  const writes = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/v1/milestones') && r.method() !== 'GET')
      writes.push(r);
  });
  await page.goto(origin + '/');
  await expect(page.getByRole('heading', { name: '다가오는 마일스톤', exact: true })).toHaveCSS(
    'font-size',
    '13px',
  );
  await expect(page.locator('.milestone')).toHaveCount(2);
  await expect(page.getByRole('button', { name: '마일스톤 추가', exact: true })).toHaveCount(0);
  assert.equal(writes.length, 0);
  await page
    .locator('.widget')
    .filter({ has: page.locator('.milestones') })
    .screenshot({ path: path.join(output, 'milestone-home.png') });
  await page.getByRole('button', { name: 'Milestone 1 프로젝트 열기' }).click();
  await expect(page).toHaveURL(origin + '/projects/' + p.id);
  const region = page.getByRole('region', { name: '프로젝트 마일스톤' });
  await expect(region.locator('.milestone')).toHaveCount(20);
  await region.getByRole('button', { name: '더 보기', exact: true }).click();
  await expect(region.locator('.milestone')).toHaveCount(24);
  await region.getByRole('button', { name: '마일스톤 추가', exact: true }).click();
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await region.getByRole('button', { name: '마일스톤 추가', exact: true }).click();
  await page.getByLabel('목표 제목').fill('UI archived creation');
  await page.getByLabel('목표 기한 (선택)').fill('2024-02-29');
  await page.getByRole('button', { name: '마일스톤 저장' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const created = (
    await send('GET', '/api/v1/milestones?projectId=' + p.id + '&limit=100')
  ).items.find((x) => x.title === 'UI archived creation');
  assert(created);
  assert.equal(created.dueDate, '2024-02-29');
  await region.getByRole('button', { name: '더 보기', exact: true }).click();
  await region.getByRole('button', { name: 'UI archived creation 수정' }).click();
  await page.getByLabel('목표 기한 (선택)').fill('');
  await page.getByRole('button', { name: '마일스톤 저장' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  assert.equal((await send('GET', '/api/v1/milestones/' + created.id)).dueDate, null);
  await region.getByRole('button', { name: '더 보기', exact: true }).click();
  await region.getByRole('button', { name: 'UI archived creation 완료' }).click();
  await expect(page.getByLabel('마일스톤 상태 필터')).toBeFocused();
  await page.getByLabel('마일스톤 상태 필터').selectOption('done');
  await region.getByRole('button', { name: 'UI archived creation 재개' }).click();
  await expect(region.locator('.milestone')).toHaveCount(0);
  await page.getByLabel('마일스톤 상태 필터').selectOption('open');
  await region.getByRole('button', { name: '더 보기', exact: true }).click();
  await region.getByRole('button', { name: 'UI archived creation 수정' }).click();

  for (const [name, width, height] of [
    ['desktop', 1280, 900],
    ['mobile', 390, 844],
    ['landscape', 844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    await page
      .getByRole('dialog')
      .screenshot({ path: path.join(output, 'milestone-editor-' + name + '.png') });
    assert(await page.getByRole('dialog').evaluate((e) => e.scrollWidth <= e.clientWidth));
  }
  await page.getByRole('button', { name: '영구 삭제', exact: true }).click();
  await page.getByRole('button', { name: '영구 삭제 확인' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await send('GET', '/api/v1/milestones/' + created.id, undefined, 404);
  for (const [name, width, height] of [
    ['desktop', 1280, 900],
    ['mobile', 390, 844],
    ['landscape', 844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({
      path: path.join(output, 'milestone-' + name + '.png'),
      fullPage: true,
    });
  }
  assert.equal(
    sql("select count(*) from milestones where workspace_id='" + alice.workspace.id + "'"),
    '25',
  );
  fs.writeFileSync(
    path.join(output, 'milestones-result.json'),
    JSON.stringify(
      {
        passed: true,
        phase,
        pageCounts: [20, 5],
        archivedCreationAndReassignment: true,
        nullDateAndCompletion: true,
        idempotentReplayAfterDelete: true,
        permanentDelete: true,
        realUiCrud: true,
        homeReadOnly: true,
      },
      null,
      2,
    ),
  );
  sql("delete from milestone_create_idempotency where workspace_id='" + alice.workspace.id + "'");
  sql("delete from milestones where workspace_id='" + alice.workspace.id + "'");
  sql("delete from project_create_idempotency where workspace_id='" + alice.workspace.id + "'");
  sql("delete from projects where workspace_id='" + alice.workspace.id + "'");
  console.log('Milestone real ' + phase + ' acceptance passed.');
}
