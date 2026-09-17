import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { expect } from '@playwright/test';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const defaultTypes = ['overview', 'board', 'deploy', 'links', 'journal', 'milestone'];

/** Real acceptance for the independent Widget v1 and Dashboard v3 contracts. */
export async function validateDashboard({ page, context, origin, sql, output }) {
  const contract = await (await context.request.get('http://127.0.0.1:18080/v3/api-docs')).json();
  const dashboard = contract.paths['/api/v3/dashboards/home'];
  const initialization = contract.paths['/api/v3/dashboards/home/initializations'];
  const widgets = contract.paths['/api/v1/widgets'];
  const widget = contract.paths['/api/v1/widgets/{id}'];
  const data = contract.paths['/api/v1/widgets/{id}/data'];
  const catalog = contract.paths['/api/v1/widget-types'];
  const projects = contract.paths['/api/v2/projects'];
  const tasks = contract.paths['/api/v2/tasks/{id}'];
  assert(dashboard?.get?.responses?.['200']);
  assert(dashboard?.put?.responses?.['200']);
  assert(initialization?.post?.responses?.['201']);
  assert(widgets?.get?.responses?.['200']);
  assert(widgets?.post?.responses?.['201']);
  assert(widget?.put?.responses?.['200']);
  assert(widget?.delete?.responses?.['200']);
  assert(data?.get?.responses?.['200']);
  assert(catalog?.get?.responses?.['200']);
  assert(projects?.get?.responses?.['200']);
  assert(tasks?.get?.responses?.['200']);
  assert(tasks?.patch?.responses?.['200']);
  fs.writeFileSync(
    path.join(output, 'dashboard-contract.json'),
    JSON.stringify(
      {
        paths: {
          '/api/v3/dashboards/home': dashboard,
          '/api/v3/dashboards/home/initializations': initialization,
          '/api/v1/widgets': widgets,
          '/api/v1/widgets/{id}': widget,
          '/api/v1/widgets/{id}/data': data,
          '/api/v1/widget-types': catalog,
          '/api/v2/projects': projects,
          '/api/v2/tasks/{id}': tasks,
        },
        schemas: Object.fromEntries(
          Object.entries(contract.components.schemas).filter(([name]) =>
            /(?:Widget|Placement|HomeLayout)/.test(name),
          ),
        ),
      },
      null,
      2,
    ),
  );

  const csrf = (await (await context.request.get(origin + '/api/v1/auth/csrf')).json()).csrfToken;
  const send = async (method, endpoint, body, status, key) => {
    const response = await context.request.fetch(origin + endpoint, {
      method,
      headers: {
        Origin: origin,
        'X-CSRF-Token': csrf,
        ...(key ? { 'Idempotency-Key': key } : {}),
      },
      ...(body === undefined ? {} : { data: body }),
    });
    assert.equal(response.status(), status, `${method} ${endpoint}: ${await response.text()}`);
    return response.status() === 204 ? undefined : response.json();
  };
  const getHome = () => send('GET', '/api/v3/dashboards/home', undefined, 200);
  const getWidget = (id) => send('GET', '/api/v1/widgets/' + id, undefined, 200);
  const layoutBody = (layoutRevision, placements) => ({
    schemaVersion: 3,
    layoutRevision,
    placements,
  });

  const initial = await getHome();
  assert.equal(initial.id, 'home');
  assert.equal(initial.schemaVersion, 3);
  assert.equal(initial.initialized, false);
  assert.equal(initial.layoutRevision, 0);
  assert.deepEqual(initial.placements, []);
  assert.deepEqual(initial.widgets, []);
  assert.equal((await getHome()).initialized, false);

  await page.goto(origin);
  await expect(page.getByRole('button', { name: '기본 위젯으로 시작' })).toBeVisible();
  await page.getByRole('button', { name: '기본 위젯으로 시작' }).click();
  await expect(page.locator('.dashboard-grid > .widget')).toHaveCount(6);

  let current = await getHome();
  assert.equal(current.initialized, true);
  assert.equal(current.layoutRevision, 1);
  assert.equal(current.widgets.length, 6);
  assert.deepEqual(current.widgets.map((item) => item.type).sort(), [...defaultTypes].sort());
  assert(current.widgets.every((item) => uuid.test(item.id) && item.revision >= 1));
  assert(current.placements.every((item) => uuid.test(item.id) && uuid.test(item.widgetId)));

  const definitions = await send('GET', '/api/v1/widget-types', undefined, 200);
  assert(defaultTypes.every((type) => definitions.some((definition) => definition.type === type)));
  for (const item of current.widgets) {
    const envelope = await send('GET', '/api/v1/widgets/' + item.id + '/data', undefined, 200);
    assert.equal(envelope.widgetId, item.id);
    assert.equal(envelope.type, item.type);
    assert.equal(envelope.configRevision, item.revision);
    if (item.type === 'deploy') assert.equal(envelope.availability, 'unavailable');
    else assert(['ready', 'empty', 'unavailable'].includes(envelope.availability));
  }

  const project = await send(
    'POST',
    '/api/v2/projects',
    { name: 'Dashboard acceptance project', stack: 'React' },
    201,
    'dashboard-acceptance-project-' + Date.now(),
  );
  const task = await send(
    'POST',
    '/api/v2/tasks',
    {
      title: 'Dashboard acceptance task',
      projectId: project.id,
      status: 'todo',
      priority: 'normal',
      tag: 'dashboard',
    },
    201,
    'dashboard-acceptance-task-' + Date.now(),
  );
  await page.reload();
  const overview = page.locator('.widget').filter({ hasText: '프로젝트 개요' });
  await expect(
    overview.getByRole('button', { name: 'Dashboard acceptance project' }),
  ).toBeVisible();
  const board = page.locator('.widget').filter({ hasText: '작업 보드' });
  await expect(board.getByText(task.title, { exact: true })).toBeVisible();
  const boardWidget = current.widgets.find((item) => item.type === 'board');
  assert(boardWidget);
  const beforeTaskLayout = (await getHome()).layoutRevision;
  await board.getByLabel(`${task.title} 상태`).selectOption('doing');
  await expect(board.locator('.column-doing').getByText(task.title, { exact: true })).toBeVisible();
  const changedTask = await send('GET', '/api/v2/tasks/' + task.id, undefined, 200);
  assert.equal(changedTask.status, 'doing');
  const refreshedBoard = (await getHome()).widgets.find((item) => item.id === boardWidget.id);
  assert.equal(refreshedBoard.revision, boardWidget.revision);
  assert.equal((await getHome()).layoutRevision, beforeTaskLayout);

  const first = current.widgets[0];
  const beforeLayout = current.layoutRevision;
  const updated = await send(
    'PUT',
    '/api/v1/widgets/' + first.id,
    {
      revision: first.revision,
      title: first.title + ' updated',
      configVersion: first.configVersion,
      config: { selection: first.config?.selection ?? { kind: 'all' } },
    },
    200,
  );
  assert.equal(updated.revision, first.revision + 1);
  current = await getHome();
  assert.equal(current.layoutRevision, beforeLayout);
  assert.equal(
    current.widgets.find((item) => item.id === first.id).title,
    first.title + ' updated',
  );

  const reordered = [...current.placements].reverse();
  const savedLayout = await send(
    'PUT',
    '/api/v3/dashboards/home',
    layoutBody(
      current.layoutRevision,
      reordered.map(({ widgetId, size }) => ({
        widgetId,
        size: size === 'medium' ? 'wide' : 'medium',
      })),
    ),
    200,
  );
  assert.equal(savedLayout.layoutRevision, current.layoutRevision + 1);
  assert.deepEqual(
    savedLayout.placements.map((item) => item.widgetId),
    reordered.map((item) => item.widgetId),
  );

  const created = await send(
    'POST',
    '/api/v1/widgets',
    {
      type: 'overview',
      title: 'Unplaced acceptance widget',
      configVersion: 1,
      config: { selection: { kind: 'all' } },
    },
    201,
    'dashboard-widget-' + Date.now(),
  );
  assert(uuid.test(created.id));
  current = await getHome();
  const placed = await send(
    'PUT',
    '/api/v3/dashboards/home',
    layoutBody(current.layoutRevision, [
      ...current.placements.map(({ widgetId, size }) => ({ widgetId, size })),
      { widgetId: created.id, size: 'small' },
    ]),
    200,
  );
  assert(placed.placements.some((item) => item.widgetId === created.id));
  await send(
    'DELETE',
    '/api/v1/widgets/' + created.id + '?revision=' + created.revision,
    undefined,
    409,
  );

  current = await getHome();
  const ownedIds = current.widgets.map((item) => item.id).filter((id) => id !== created.id);
  const empty = await send(
    'PUT',
    '/api/v3/dashboards/home',
    layoutBody(current.layoutRevision, []),
    200,
  );
  assert.equal(empty.initialized, true);
  assert.deepEqual(empty.placements, []);
  await send(
    'DELETE',
    '/api/v1/widgets/' + created.id + '?revision=' + created.revision,
    undefined,
    200,
  );
  for (const id of ownedIds) {
    const latest = await getWidget(id);
    await send('DELETE', '/api/v1/widgets/' + id + '?revision=' + latest.revision, undefined, 200);
  }

  sql(
    "delete from task_create_idempotency; delete from tasks where project_id='" +
      project.id +
      "'; delete from projects where id='" +
      project.id +
      "'",
  );

  await page.reload();
  await expect(page.getByText('표시할 위젯이 없어요')).toBeVisible();
  for (const [name, viewport] of [
    ['desktop', { width: 1440, height: 1000 }],
    ['mobile', { width: 390, height: 844 }],
    ['landscape', { width: 844, height: 390 }],
  ]) {
    await page.setViewportSize(viewport);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({
      path: path.join(output, 'dashboard-v3-' + name + '.png'),
      fullPage: true,
    });
  }
  fs.writeFileSync(
    path.join(output, 'dashboard-result.json'),
    JSON.stringify(
      {
        passed: true,
        contract: 'Widget v1 + Dashboard v3',
        initializedRevision: 1,
        independentWidgetRevision: updated.revision,
        layoutRevision: savedLayout.layoutRevision,
        unplacedCreateAndPlacedDeleteConflict: true,
        persistedEmptyLayout: true,
        taskWidgetStatusPersisted: true,
        overviewProjectRows: true,
        viewports: ['desktop', 'mobile', 'landscape'],
      },
      null,
      2,
    ),
  );
}
