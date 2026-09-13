import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export async function validateJournals({ page, context, origin, sql, alice, output, phase }) {
  const contractResponse = await context.request.get('http://127.0.0.1:18080/v3/api-docs');
  assert.equal(contractResponse.status(), 200);
  const contract = await contractResponse.json();
  const paths = Object.fromEntries(
    Object.entries(contract.paths).filter(([key]) => key.startsWith('/api/v1/journals')),
  );
  for (const [endpoint, verb, status] of [
    ['/api/v1/journals', 'get', '200'],
    ['/api/v1/journals', 'post', '201'],
    ['/api/v1/journals/{id}', 'get', '200'],
    ['/api/v1/journals/{id}', 'patch', '200'],
    ['/api/v1/journals/{id}', 'delete', '200'],
  ])
    assert(paths[endpoint]?.[verb]?.responses?.[status], `Missing ${verb} ${endpoint} ${status}`);
  fs.writeFileSync(
    path.join(output, 'journal-contract.json'),
    JSON.stringify(
      {
        paths,
        schemas: Object.fromEntries(
          Object.entries(contract.components.schemas).filter(([key]) => /Journal/.test(key)),
        ),
      },
      null,
      2,
    ),
  );

  const csrf = (await (await context.request.get(origin + '/api/v1/auth/csrf')).json()).csrfToken;
  const headers = { Origin: origin, 'X-CSRF-Token': csrf };
  const projectResponse = await context.request.post(origin + '/api/v1/projects', {
    headers: { ...headers, 'Idempotency-Key': 'journal-project-' + Date.now() },
    data: { name: 'Journal acceptance project', scope: 'unity', stack: 'C#' },
  });
  assert.equal(projectResponse.status(), 201);
  const project = await projectResponse.json();
  const journals = [];
  for (let i = 0; i < 25; i++) {
    const response = await context.request.post(origin + '/api/v1/journals', {
      headers: { ...headers, 'Idempotency-Key': 'journal-seed-' + i },
      data: {
        title: i === 2 ? 'Search title marker' : 'Journal acceptance ' + i,
        projectId: project.id,
        body: i === 3 ? 'Search body marker\n  preserved  ' : 'Journal body ' + i,
        entryDate: `2026-09-${String(1 + (i % 25)).padStart(2, '0')}`,
      },
    });
    assert.equal(response.status(), 201);
    journals.push(await response.json());
  }

  const firstPage = await context.request.get(
    origin + '/api/v1/journals?scope=all&projectStatus=all&sort=newest&limit=20',
  );
  assert.equal(firstPage.status(), 200);
  const firstJson = await firstPage.json();
  assert.equal(firstJson.total, 25);
  assert.equal(firstJson.items.length, 20);
  assert(firstJson.nextCursor);
  const secondPage = await context.request.get(
    origin +
      '/api/v1/journals?scope=all&projectStatus=all&sort=newest&limit=20&cursor=' +
      encodeURIComponent(firstJson.nextCursor),
  );
  assert.equal(secondPage.status(), 200);
  const secondJson = await secondPage.json();
  assert.equal(secondJson.items.length, 5);
  assert.equal(new Set([...firstJson.items, ...secondJson.items].map((item) => item.id)).size, 25);
  const searchBody = await context.request.get(
    origin + '/api/v1/journals?query=Search%20body%20marker&sort=newest&limit=20',
  );
  assert.equal(searchBody.status(), 200);
  assert.equal((await searchBody.json()).items.length, 1);
  const searchProject = await context.request.get(
    origin + '/api/v1/journals?query=Journal%20acceptance%20project&sort=newest&limit=20',
  );
  assert.equal((await searchProject.json()).total, 25);
  const dateRange = await context.request.get(
    origin + '/api/v1/journals?from=2026-09-03&to=2026-09-03&sort=oldest&limit=20',
  );
  assert.equal((await dateRange.json()).items.length, 1);

  const target = journals[0];
  const conflict = await context.request.patch(origin + '/api/v1/journals/' + target.id, {
    headers,
    data: { revision: target.revision, body: 'First concurrent update' },
  });
  assert.equal(conflict.status(), 200);
  const latest = await conflict.json();
  const stale = await context.request.patch(origin + '/api/v1/journals/' + target.id, {
    headers,
    data: { revision: target.revision, body: 'Stale update' },
  });
  assert.equal(stale.status(), 409);
  assert.equal((await stale.json()).code, 'REVISION_CONFLICT');
  const sameProjectArchive = await context.request.patch(
    origin + '/api/v1/projects/' + project.id,
    {
      headers,
      data: { revision: project.revision, status: 'archived' },
    },
  );
  assert.equal(sameProjectArchive.status(), 200);
  const retained = await context.request.patch(origin + '/api/v1/journals/' + target.id, {
    headers,
    data: { revision: latest.revision, title: 'Retained archived relation' },
  });
  assert.equal(retained.status(), 200);
  const rejectedCreate = await context.request.post(origin + '/api/v1/journals', {
    headers: { ...headers, 'Idempotency-Key': 'archived-journal-create' },
    data: {
      title: 'Rejected archived',
      projectId: project.id,
      body: 'body',
      entryDate: '2026-09-13',
    },
  });
  assert.equal(rejectedCreate.status(), 409);
  assert.equal((await rejectedCreate.json()).code, 'PROJECT_ARCHIVED');

  const replayBody = {
    title: 'Journal replay',
    projectId: project.id,
    body: 'Replay body',
    entryDate: '2026-09-13',
  };
  // Use a new active Project for creation/replay after the relation-retention check.
  const activeResponse = await context.request.post(origin + '/api/v1/projects', {
    headers: { ...headers, 'Idempotency-Key': 'journal-active-project' },
    data: { name: 'Journal active target', scope: 'server', stack: 'Java' },
  });
  assert.equal(activeResponse.status(), 201);
  const active = await activeResponse.json();
  replayBody.projectId = active.id;
  const replayKey = 'journal-replay-key';
  const replayCreate = await context.request.post(origin + '/api/v1/journals', {
    headers: { ...headers, 'Idempotency-Key': replayKey },
    data: replayBody,
  });
  assert.equal(replayCreate.status(), 201);
  const replay = await replayCreate.json();
  const deleted = await context.request.delete(
    origin + '/api/v1/journals/' + replay.id + '?revision=' + replay.revision,
    { headers },
  );
  assert.equal(deleted.status(), 200);
  assert.deepEqual(await deleted.json(), { deletedId: replay.id });
  assert.equal((await context.request.get(origin + '/api/v1/journals/' + replay.id)).status(), 404);
  const replayed = await context.request.post(origin + '/api/v1/journals', {
    headers: { ...headers, 'Idempotency-Key': replayKey },
    data: replayBody,
  });
  assert.equal(replayed.status(), 201);
  assert.equal((await replayed.json()).id, replay.id);
  const changedReplay = await context.request.post(origin + '/api/v1/journals', {
    headers: { ...headers, 'Idempotency-Key': replayKey },
    data: { ...replayBody, title: 'Changed replay' },
  });
  assert.equal(changedReplay.status(), 409);

  const uiRequests = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/v1/journals') uiRequests.push(url);
  });
  await page.goto(origin + '/journals');
  await expect(page.locator('.document-row')).toHaveCount(20);
  await page.getByRole('button', { name: /불러오기/ }).click();
  await expect(page.locator('.document-row')).toHaveCount(25);
  await page.goto(origin + '/');
  await expect(page.locator('.journal-home-surface .journal-row')).toHaveCount(3);
  const homeRequest = uiRequests.find((request) => request.searchParams.get('limit') === '3');
  assert(homeRequest);
  assert.equal(homeRequest.searchParams.get('sort'), 'newest');
  await page.goto(origin + '/projects/' + project.id);
  await expect(page.locator('.journal-surface .journal-row')).toHaveCount(3);
  assert(uiRequests.some((request) => request.searchParams.get('projectId') === project.id));
  await page.goto(origin + '/journals');
  await page.getByRole('button', { name: /불러오기/ }).click();
  await expect(page.locator('.document-row')).toHaveCount(25);
  const editRow = page
    .getByText('Retained archived relation', { exact: true })
    .locator('xpath=../../..');
  await editRow.locator('.feature-actions button').first().click();
  const editor = page.getByRole('dialog');
  await editor.locator('input').first().fill('Journal UI edit');
  await editor.locator('textarea').fill('UI edit preserves the archived relation');
  await editor.locator('button[type="submit"]').click();
  await expect(editor).toHaveCount(0);
  const edited = await (await context.request.get(origin + '/api/v1/journals/' + target.id)).json();
  assert.equal(edited.title, 'Journal UI edit');
  await page.getByRole('button', { name: /불러오기/ }).click();
  await expect(page.locator('.document-row')).toHaveCount(25);
  const deleteCandidate = page
    .getByText('Journal acceptance 1', { exact: true })
    .locator('xpath=../../..');
  await deleteCandidate.locator('.feature-actions button').nth(1).click();
  await page.getByRole('dialog').locator('.button-danger').click();
  await expect(page.getByText('Journal acceptance 1', { exact: true })).toHaveCount(0);
  assert.equal(
    (await context.request.get(origin + '/api/v1/journals/' + journals[1].id)).status(),
    404,
  );
  for (const [name, width, height] of [
    ['desktop', 1280, 900],
    ['mobile', 390, 844],
    ['landscape', 844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(output, `journal-${name}.png`), fullPage: true });
  }

  assert.equal(
    sql("select count(*) from journals where workspace_id='" + alice.workspace.id + "'"),
    '24',
  );
  fs.writeFileSync(
    path.join(output, 'journals-result.json'),
    JSON.stringify(
      {
        phase,
        passed: true,
        seededJournals: 25,
        pageCounts: [20, 5],
        searchAcrossBodyAndProjectName: true,
        inclusiveDateFilter: true,
        archivedRelationRetained: true,
        replayAfterDelete: true,
        permanentDelete: true,
        excludedWrites: 0,
      },
      null,
      2,
    ),
  );
  sql("delete from journal_create_idempotency where workspace_id='" + alice.workspace.id + "'");
  sql("delete from journals where workspace_id='" + alice.workspace.id + "'");
  sql("delete from project_create_idempotency where workspace_id='" + alice.workspace.id + "'");
  sql("delete from projects where workspace_id='" + alice.workspace.id + "'");
}
