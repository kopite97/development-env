import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
export async function validateProjects({ page, context, origin, sql, alice, output, phase }) {
  const contract = await (await context.request.get('http://127.0.0.1:18080/v3/api-docs')).json();
  for (const [endpoint, verb, status] of [
    ['/api/v1/projects', 'get', '200'],
    ['/api/v1/projects', 'post', '201'],
    ['/api/v1/projects/{projectId}', 'get', '200'],
    ['/api/v1/projects/{projectId}', 'patch', '200'],
    ['/api/v1/overview', 'get', '200'],
  ]) {
    const operation =
      contract.paths[endpoint]?.[verb] ??
      (endpoint.includes('{projectId}')
        ? contract.paths[endpoint.replace('{projectId}', '{id}')]?.[verb]
        : undefined);
    assert(operation?.responses[status], `Missing ${verb} ${endpoint} response ${status}`);
  }
  fs.writeFileSync(
    path.join(output, 'project-overview-contract.json'),
    JSON.stringify(
      {
        paths: Object.fromEntries(
          Object.entries(contract.paths).filter(
            ([key]) => key.startsWith('/api/v1/projects') || key === '/api/v1/overview',
          ),
        ),
        schemas: Object.fromEntries(
          Object.entries(contract.components.schemas).filter(([key]) =>
            /Project|Overview/.test(key),
          ),
        ),
      },
      null,
      2,
    ),
  );
  const csrf = (await (await context.request.get(origin + '/api/v1/auth/csrf')).json()).csrfToken;
  const headers = { Origin: origin, 'X-CSRF-Token': csrf };
  const created = [];
  for (let i = 0; i < 23; i++) {
    const result = await context.request.post(origin + '/api/v1/projects', {
      headers: { ...headers, 'Idempotency-Key': 'read-fixture-' + i },
      data: { name: 'Acceptance ' + i, scope: i % 2 ? 'server' : 'unity', stack: 'literal %_ C#' },
    });
    assert.equal(result.status(), 201);
    created.push(await result.json());
  }
  const selected = created[0];
  assert.equal(
    (
      await context.request.patch(origin + '/api/v1/projects/' + selected.id, {
        headers,
        data: { revision: selected.revision, status: 'archived' },
      })
    ).status(),
    200,
  );
  await page.goto(origin + '/projects');
  await expect(page.locator('.project-row')).toHaveCount(20);
  await page.getByRole('button', { name: '프로젝트 더 보기', exact: true }).click();
  await expect(page.locator('.project-row')).toHaveCount(22);
  await page.goto(origin + '/projects/' + selected.id + '?q=missing');
  await expect(page.locator('.project-summary .badge').first()).toHaveText('보관됨');
  await expect(page.getByRole('heading', { name: selected.name, exact: true })).toBeVisible();
  await page.getByRole('button', { name: '프로젝트 목록' }).click();
  await expect(page.getByText('검색 조건에 맞는 프로젝트가 없어요')).toBeVisible();
  assert.equal(
    (
      await context.request.get(origin + '/api/v1/projects/00000000-0000-0000-0000-000000000099')
    ).status(),
    404,
  );
  const outsider = '00000000-0000-0000-0000-000000000901',
    outsiderWorkspace = '00000000-0000-0000-0000-000000000902',
    outsiderProject = '00000000-0000-0000-0000-000000000903';
  sql(
    `insert into users(id,display_name,created_at,updated_at) values('${outsider}','Isolated owner',now(),now()); insert into workspaces(id,owner_user_id,name,created_at,updated_at) values('${outsiderWorkspace}','${outsider}','Isolated workspace',now(),now()); insert into projects(id,workspace_id,name,scope,stack,created_at,updated_at) values('${outsiderProject}','${outsiderWorkspace}','Foreign Project','server','Java',now(),now())`,
  );
  assert.equal(
    (await context.request.get(origin + '/api/v1/projects/' + outsiderProject)).status(),
    404,
  );
  assert.equal(
    (await context.request.get(origin + '/api/v1/overview?projectId=' + outsiderProject)).status(),
    404,
  );
  await page.goto(origin + '/projects/' + outsiderProject);
  await expect(page.getByRole('alert')).toContainText(
    '프로젝트가 없거나 더 이상 접근할 수 없어요.',
  );
  sql(
    `delete from projects where id='${outsiderProject}'; delete from workspaces where id='${outsiderWorkspace}'; delete from users where id='${outsider}'`,
  );
  const foreign = await context.browser().newContext();
  assert.equal(
    (await foreign.request.get(origin + '/api/v1/projects/' + selected.id)).status(),
    401,
  );
  await foreign.close();
  assert.equal(sql('select count(*) from projects'), '23');
  assert.equal(
    sql(
      'select (select count(*) from tasks)+(select count(*) from journals)+(select count(*) from milestones)+(select count(*) from links)+(select count(*) from dashboards)',
    ),
    '0',
  );
  if (phase !== 'reads') {
    let first = true;
    const attempts = [];
    await page.route('**/api/v1/projects', async (route) => {
      attempts.push({
        key: route.request().headers()['idempotency-key'],
        body: route.request().postDataJSON(),
      });
      if (!first) return route.continue();
      first = false;
      const committed = await route.fetch();
      assert.equal(committed.status(), 201);
      await route.abort('failed');
    });
    await page.goto(origin + '/projects');
    await page.getByRole('button', { name: '프로젝트 추가', exact: true }).first().click();
    await page.getByLabel('프로젝트 이름', { exact: true }).fill('Real replay');
    await page.getByLabel('기술 스택', { exact: true }).fill('Java');
    await page.getByRole('button', { name: '프로젝트 저장', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Creation was not confirmed');
    assert.equal(sql("select count(*) from projects where name='Real replay'"), '1');
    await page.getByRole('button', { name: '생성 다시 시도' }).click();
    await expect(page.getByRole('heading', { name: 'Real replay', exact: true })).toBeVisible();
    assert.equal(attempts.length, 2);
    assert.deepEqual(attempts[0], attempts[1]);
    assert.equal(sql("select count(*) from projects where name='Real replay'"), '1');
    const newId = new URL(page.url()).pathname.split('/').at(-1);
    const reused = await context.request.post(origin + '/api/v1/projects', {
      headers: { ...headers, 'Idempotency-Key': attempts[0].key },
      data: { ...attempts[0].body, name: 'changed' },
    });
    assert.equal(reused.status(), 409);
    assert.equal((await reused.json()).code, 'IDEMPOTENCY_KEY_REUSED');
    await page.getByRole('button', { name: '프로젝트 편집', exact: true }).click();
    await page.getByLabel('프로젝트 목표 메모', { exact: true }).fill('Plain memo, no resource');
    assert.equal(
      (
        await context.request.patch(origin + '/api/v1/projects/' + newId, {
          headers,
          data: { revision: 1, subtitle: 'Other client' },
        })
      ).status(),
      200,
    );
    await page.getByRole('button', { name: '프로젝트 저장', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('changed elsewhere');
    await page.getByRole('button', { name: '내 변경 다시 적용' }).click();
    await expect(page.getByLabel('프로젝트 설명', { exact: true })).toHaveValue('Other client');
    await page.getByRole('button', { name: '프로젝트 저장', exact: true }).click();
    await expect(page.locator('.project-summary')).toContainText('Plain memo, no resource');
    const replay = await context.request.post(origin + '/api/v1/projects', {
      headers: { ...headers, 'Idempotency-Key': attempts[0].key },
      data: attempts[0].body,
    });
    assert.equal(replay.status(), 201);
    assert.equal((await replay.json()).revision, 1);
    assert.equal(
      (await (await context.request.get(origin + '/api/v1/projects/' + newId)).json()).revision,
      3,
    );
    page.on('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '프로젝트 편집', exact: true }).click();
    await page.getByRole('button', { name: '프로젝트 보관', exact: true }).click();
    await expect(page.locator('.project-summary .badge').first()).toHaveText('보관됨');
    assert.equal(sql('select count(*) from milestones'), '0');
    assert.equal(sql('select count(*) from projects'), '24');
    await page.unroute('**/api/v1/projects');
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({
      path: path.join(output, 'project-mutations-mobile.png'),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1280, height: 720 });
  }
  if (phase === 'overview' || phase === 'final') {
    const active = created[2];
    sql(
      `insert into tasks (id,workspace_id,project_id,title,status,priority,tag,revision,created_at,updated_at) values (gen_random_uuid(),'${alice.workspace.id}','${selected.id}','archived task','todo','normal','',1,now(),now()),(gen_random_uuid(),'${alice.workspace.id}','${active.id}','active task','doing','normal','',1,now(),now())`,
    );
    sql(
      `insert into tasks (id,workspace_id,project_id,title,status,created_at,updated_at,deleted_at) values (gen_random_uuid(),'${alice.workspace.id}','${active.id}','deleted task','done',now(),now(),now())`,
    );
    await page.goto(origin + '/projects?q=no-match');
    await expect(page.getByText('검색 조건에 맞는 프로젝트가 없어요')).toBeVisible();
    await expect(page.locator('.stats strong')).toHaveText(['22개', '1개', '0개']);
    await page.goto(origin + '/projects/' + selected.id + '?scope=server');
    await expect(
      page.getByRole('region', { name: '프로젝트 작업', exact: true }).locator('.panel-heading'),
    ).toContainText('전체 1개 · 진행 중 0개 · 완료 0개');
    const intersection = await context.request.get(
      origin + '/api/v1/overview?scope=server&projectId=' + selected.id,
    );
    assert.equal(intersection.status(), 200);
    const zero = await intersection.json();
    assert.equal(zero.projects.total, 0);
    assert.equal(zero.projects.archived, 0);
    assert.equal(zero.tasks.total, 0);
    assert.equal(
      (await context.request.get(origin + '/api/v1/overview?query=unsupported')).status(),
      400,
    );
    assert.equal(sql('select count(*) from tasks'), '3');
    await page.screenshot({ path: path.join(output, 'project-overview.png'), fullPage: true });
    sql("delete from tasks where workspace_id='" + alice.workspace.id + "'");
  }
  await page.screenshot({ path: path.join(output, 'project-reads.png'), fullPage: true });
  fs.writeFileSync(
    path.join(output, 'projects-result.json'),
    JSON.stringify(
      {
        phase,
        passed: true,
        seededProjects: 23,
        loadedActive: 22,
        archivedDetail: true,
        foreignDetailAndOverview: 404,
        replayRows: phase === 'reads' ? null : 1,
        mutationRevision: phase === 'reads' ? null : 4,
        taskSeedRows: ['overview', 'final'].includes(phase) ? 3 : 0,
        taskCounter: ['overview', 'final'].includes(phase) ? 2 : null,
        excludedResourceWrites: 0,
      },
      null,
      2,
    ),
  );
  // Explicit cleanup is limited to this runner's disposable workspace fixture rows.
  sql("delete from project_create_idempotency where workspace_id='" + alice.workspace.id + "'");
  sql("delete from projects where workspace_id='" + alice.workspace.id + "'");
}
