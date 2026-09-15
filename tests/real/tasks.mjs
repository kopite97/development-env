import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export async function validateTasks({ page, context, origin, sql, alice, output, phase }) {
  const contract = await (await context.request.get('http://127.0.0.1:18080/v3/api-docs')).json();
  const paths = Object.fromEntries(
    Object.entries(contract.paths).filter(([key]) => key.startsWith('/api/v1/tasks')),
  );
  assert(paths['/api/v1/tasks'].get.responses['200']);
  assert(paths['/api/v1/tasks'].post.responses['201']);
  fs.writeFileSync(
    path.join(output, 'task-contract.json'),
    JSON.stringify(
      {
        paths,
        schemas: Object.fromEntries(
          Object.entries(contract.components.schemas).filter(([key]) => /Task/.test(key)),
        ),
      },
      null,
      2,
    ),
  );
  const csrf = (await (await context.request.get(origin + '/api/v1/auth/csrf')).json()).csrfToken;
  const headers = { Origin: origin, 'X-CSRF-Token': csrf };
  const result = await context.request.post(origin + '/api/v1/projects', {
    headers: { ...headers, 'Idempotency-Key': 'task-project' },
    data: { name: 'Task acceptance', scope: 'unity', stack: 'C#' },
  });
  assert.equal(result.status(), 201);
  const project = await result.json();
  const tasks = [];
  for (const status of ['todo', 'doing', 'done'])
    for (let i = 0; i < 23; i++) {
      const response = await context.request.post(origin + '/api/v1/tasks', {
        headers: { ...headers, 'Idempotency-Key': `task-${status}-${i}` },
        data: {
          title: `${status} task ${i}`,
          projectId: project.id,
          status,
          priority: i % 2 ? 'high' : 'normal',
          tag: 'API',
        },
      });
      assert.equal(response.status(), 201);
      tasks.push(await response.json());
    }
  const removed = tasks.at(-1);
  assert.equal(
    (
      await context.request.delete(
        origin + `/api/v1/tasks/${removed.id}?revision=${removed.revision}`,
        { headers },
      )
    ).status(),
    200,
  );
  assert.equal(
    (
      await context.request.patch(origin + '/api/v1/projects/' + project.id, {
        headers,
        data: { revision: project.revision, status: 'archived' },
      })
    ).status(),
    200,
  );
  await page.goto(origin + '/tasks');
  await expect(page.locator('.task')).toHaveCount(60);
  await expect(page.locator('.welcome-strip b')).toHaveText('0개');
  await expect(page.locator('.sidebar .nav-count').first()).toHaveText('0');
  await expect(page.locator('.column-todo .count')).toHaveText('23');
  await expect(page.locator('.column-done .count')).toHaveText('22');
  await page.locator('.column-todo').getByRole('button', { name: '더 불러오기' }).click();
  await expect(page.locator('.column-todo .task')).toHaveCount(23);
  await expect(page.locator('.column-doing .task')).toHaveCount(20);
  await page.getByRole('button', { name: /휴지통/ }).click();
  await expect(page.locator('.restore-row')).toHaveCount(1);
  await page.screenshot({ path: path.join(output, 'task-trash.png'), fullPage: true });
  await page.keyboard.press('Escape');
  for (const [name, width, height] of [
    ['desktop', 1280, 900],
    ['mobile', 390, 844],
    ['landscape', 844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(output, `task-${name}.png`), fullPage: true });
  }
  const stats = await (
    await context.request.get(origin + '/api/v1/tasks/stats?projectId=' + project.id)
  ).json();
  assert.equal(stats.total, 68);
  if (phase !== 'reads') {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator('.column-todo .task-title').first().click();
    const editor = page.getByRole('dialog', { name: '태스크 편집', exact: true });
    await expect(editor.getByLabel('프로젝트')).toHaveValue(project.id);
    await expect(editor.getByLabel('프로젝트').locator('option:checked')).toContainText('보관됨');
    await editor.getByLabel('태스크 제목').fill('Archived relation edit');
    await editor.getByRole('button', { name: '태스크 저장' }).click();
    await expect(editor).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Archived relation edit', exact: true }),
    ).toBeVisible();
    const target = tasks.filter((t) => t.status === 'todo').at(-1);
    const latest = await (await context.request.get(origin + '/api/v1/tasks/' + target.id)).json();
    await page.getByRole('button', { name: 'Archived relation edit', exact: true }).click();
    await editor.getByLabel('태스크 제목').fill('Retained conflict draft');
    assert.equal(
      (
        await context.request.patch(origin + '/api/v1/tasks/' + target.id, {
          headers,
          data: { revision: latest.revision, tag: 'concurrent' },
        })
      ).status(),
      200,
    );
    await editor.getByRole('button', { name: '태스크 저장' }).click();
    await expect(editor.getByText('다른 곳에서 변경되었습니다.', { exact: false })).toBeVisible();
    await expect(editor.getByLabel('태스크 제목')).toHaveValue('Retained conflict draft');
    await editor.getByRole('button', { name: '내 변경 다시 적용' }).click();
    await editor.getByRole('button', { name: '태스크 저장' }).click();
    await expect(editor).toHaveCount(0);
    const after = await (await context.request.get(origin + '/api/v1/tasks/' + target.id)).json();
    assert.equal(after.tag, 'concurrent');
    await page.getByRole('button', { name: /휴지통/ }).click();
    await page.getByRole('button', { name: removed.title + ' 복구' }).click();
    await expect(page.getByRole('heading', { name: '휴지통이 비어 있어요' })).toBeVisible();
    await page.keyboard.press('Escape');
    assert.equal(
      (
        await context.request.patch(origin + '/api/v1/projects/' + project.id, {
          headers,
          data: { revision: 2, status: 'active' },
        })
      ).status(),
      200,
    );
    await page.reload();
    await page.getByRole('button', { name: '태스크 추가', exact: true }).first().click();
    const create = page.getByRole('dialog', { name: '태스크 추가', exact: true });
    await create.getByLabel('태스크 제목').fill('Dropped Task response');
    await create.getByLabel('프로젝트').selectOption(project.id);
    const requests = [];
    let drop = true;
    await page.route('**/api/v1/tasks', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      requests.push({
        key: route.request().headers()['idempotency-key'],
        body: route.request().postData(),
      });
      const response = await route.fetch();
      assert.equal(response.status(), 201);
      if (drop) {
        drop = false;
        return route.abort('failed');
      }
      return route.fulfill({ response });
    });
    await create.getByRole('button', { name: '태스크 저장' }).click();
    await expect(create.getByRole('alert')).toBeVisible();
    await expect(create.getByLabel('태스크 제목')).toHaveValue('Dropped Task response');
    await create.getByRole('button', { name: '태스크 저장' }).click();
    await expect(create).toHaveCount(0);
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[0], requests[1]);
    assert.equal(sql("select count(*) from tasks where title='Dropped Task response'"), '1');
    await page.unroute('**/api/v1/tasks');
    await page.getByRole('button', { name: 'Dropped Task response', exact: true }).click();
    await expect(editor).toBeVisible();
    await expect(page.getByText('불러오는 중…', { exact: true })).toHaveCount(0);
    await page.screenshot({ path: path.join(output, 'task-editor.png') });
    if (page.listenerCount('dialog') === 0) page.once('dialog', (d) => d.accept());
    await editor.getByRole('button', { name: '태스크 삭제' }).click();
    await expect(editor).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Dropped Task response', exact: true }),
    ).toHaveCount(0);
    const replay = await context.request.post(origin + '/api/v1/tasks', {
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Idempotency-Key': requests[0].key,
      },
      data: requests[0].body,
    });
    assert.equal(replay.status(), 201);
    const original = await replay.json();
    assert.equal(original.revision, 1);
    assert.equal(original.deletedAt, null);
    const deletedNow = await (
      await context.request.get(origin + '/api/v1/tasks/' + original.id)
    ).json();
    assert(deletedNow.deletedAt);
    assert.equal(sql("select count(*) from tasks where title='Dropped Task response'"), '1');
    const reuse = await context.request.post(origin + '/api/v1/tasks', {
      headers: { ...headers, 'Idempotency-Key': requests[0].key },
      data: { ...JSON.parse(requests[0].body), title: 'Different intent' },
    });
    assert.equal(reuse.status(), 409);
    assert.equal((await reuse.json()).code, 'IDEMPOTENCY_KEY_REUSED');
  }
  assert.equal((await context.request.get(origin + '/api/v1/tasks/' + removed.id)).status(), 200);
  assert.equal(
    (
      await context.request.get(
        origin + '/api/v1/tasks?projectId=00000000-0000-0000-0000-000000009999',
      )
    ).status(),
    404,
  );
  assert.equal(
    sql(
      'select (select count(*) from journals)+(select count(*) from milestones)+(select count(*) from links)+(select count(*) from dashboards)',
    ),
    '0',
  );
  fs.writeFileSync(
    path.join(output, 'tasks-result.json'),
    JSON.stringify(
      {
        phase,
        passed: true,
        seededTasks: 69,
        liveTotal: 68,
        archivedRelation: true,
        independentColumns: true,
        excludedWrites: 0,
      },
      null,
      2,
    ),
  );
  await page.goto(origin + '/');
  if (['surfaces', 'final'].includes(phase)) {
    await expect(page.locator('.task')).toHaveCount(20);
    await expect(page.locator('.task-surface .widget-header h2')).toHaveText('작업 보드');
    const listResponse = await context.request.get(origin + '/api/v1/tasks?scope=unity&limit=1');
    assert.equal((await listResponse.json()).items.length, 1);
    await page.screenshot({ path: path.join(output, 'task-home.png'), fullPage: true });
    await page.goto(origin + '/projects/' + project.id);
    await expect(page.locator('.task')).toHaveCount(60);
    await expect(page.locator('.task-surface')).toBeVisible();
    await page.screenshot({ path: path.join(output, 'task-project.png'), fullPage: true });
    const currentProject = await (
      await context.request.get(origin + '/api/v1/projects/' + project.id)
    ).json();
    await page.getByRole('button', { name: '프로젝트 편집', exact: true }).click();
    await page.getByLabel('프로젝트 이름', { exact: true }).fill('Task renamed project');
    await page.getByRole('button', { name: '프로젝트 저장', exact: true }).click();
    await expect(page.locator('.task small').first()).toHaveText('Task renamed project');
    assert(currentProject.revision >= 1);
    await page.goto(origin + '/');
    await expect(page.locator('.task')).toHaveCount(20);
  }
  sql("delete from task_create_idempotency where workspace_id='" + alice.workspace.id + "'");
  sql("delete from tasks where workspace_id='" + alice.workspace.id + "'");
  sql("delete from project_create_idempotency where workspace_id='" + alice.workspace.id + "'");
  sql("delete from projects where workspace_id='" + alice.workspace.id + "'");
}
