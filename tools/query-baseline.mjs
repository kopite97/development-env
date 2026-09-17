// Query-cache baseline: real local API, production browser measurements.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium, expect } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = JSON.parse(
  fs.readFileSync(path.join(root, '.auth-validation/query-baseline/environment.json')),
);
assert.equal(env.origin, 'http://127.0.0.1:4175');
assert.equal(env.api, 'http://127.0.0.1:18080');
assert.equal(env.production, true);
process.kill(env.ownerPid, 0);
const origin = env.origin;
const pilot = process.argv.includes('--pilot');
const plan0022 = process.argv.includes('--plan0022');
const output = path.join(
  root,
  pilot
    ? '.auth-validation/query-baseline/pilot'
    : plan0022
      ? 'docs/reviews/plan0022-project-query-cache'
      : 'docs/reviews/plan0021-query-baseline',
);
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const options = {
  viewport: { width: 1440, height: 1000 },
  locale: 'ko-KR',
  timezoneId: 'Asia/Seoul',
};
const setup = await browser.newContext(options);
const page = await setup.newPage();
page.on('dialog', (dialog) => dialog.accept());
const records = [],
  checks = [],
  samples = [];
const ids = new Map();
const cursors = new Map();
const identify = (id, label) => {
  ids.set(id, label);
  return id;
};
function safeUrl(raw) {
  const url = new URL(raw);
  let result = url.pathname;
  for (const [id, label] of ids) result = result.replaceAll(id, label);
  const query = new URLSearchParams();
  for (const [key, value] of [...url.searchParams].sort()) {
    if (key === 'cursor' && !cursors.has(value)) cursors.set(value, `cursor-${cursors.size + 1}`);
    query.append(key, key === 'cursor' ? cursors.get(value) : (ids.get(value) ?? value));
  }
  return result + (query.size ? '?' + query : '');
}
const round = (value) => Math.round(value * 100) / 100;
try {
  await page.goto(origin);
  await page.getByRole('button', { name: 'Google로 계속하기' }).click();
  await page.getByRole('link', { name: 'alice', exact: true }).click();
  await expect(page.locator('.sidebar .profile strong')).toHaveText('Alice Example');
  const contractResponse = await setup.request.get(env.api + '/v3/api-docs');
  assert.equal(contractResponse.status(), 200);
  const contract = await contractResponse.json();
  // Save static API metadata only, never runtime response bodies or credentials.
  fs.writeFileSync(
    path.join(output, 'openapi-contract.json'),
    JSON.stringify(contract, null, 2) + '\n',
  );
  const csrf = (await (await setup.request.get(origin + '/api/v1/auth/csrf')).json()).csrfToken;
  const headers = { Origin: origin, 'X-CSRF-Token': csrf };
  async function get(route) {
    const response = await setup.request.get(origin + route);
    assert.equal(response.status(), 200, route);
    return response.json();
  }
  async function create(route, data, key = crypto.randomUUID()) {
    const response = await setup.request.post(origin + route, {
      data,
      headers: { ...headers, 'Idempotency-Key': key },
    });
    assert.equal(response.status(), 201, `${route}: ${response.status()}`);
    return response.json();
  }
  const home = await get('/api/v3/dashboards/home');
  if (!home.initialized) {
    const initialized = await setup.request.post(
      origin + '/api/v3/dashboards/home/initializations',
      {
        data: { schemaVersion: 3, layoutRevision: 0 },
        headers: { ...headers, 'Idempotency-Key': 'plan0022-dashboard-init' },
      },
    );
    assert.equal(initialized.status(), 201);
  }
  let projects = (await get('/api/v2/projects?category=all&status=active&limit=100')).items;
  if (!projects.length) {
    const categories = [];
    for (let n = 1; n <= 3; n++)
      categories.push(
        await create('/api/v1/project-categories', { name: `Baseline Category ${n}` }),
      );
    for (let n = 1; n <= 25; n++)
      projects.push(
        await create('/api/v2/projects', {
          name: `Baseline Project ${String(n).padStart(2, '0')}`,
          stack: 'TypeScript',
          categoryId: categories[(n - 1) % 3].id,
        }),
      );
    const projectId = projects[0].id;
    for (let n = 1; n <= 30; n++)
      await create('/api/v2/tasks', {
        projectId,
        title: `Baseline Task ${String(n).padStart(2, '0')}`,
        status: ['todo', 'doing', 'done'][(n - 1) % 3],
      });
    for (let n = 1; n <= 3; n++)
      await create('/api/v2/journals', {
        projectId,
        title: `Baseline Journal ${n}`,
        body: 'Synthetic baseline content.',
        entryDate: '2026-09-16',
      });
  }
  assert.equal(projects.length, 25, 'Only the dedicated fixture may be measured');
  for (const project of projects) {
    assert.match(project.name, /^Baseline Project \d{2}$/);
    identify(project.id, project.name.replaceAll(' ', '-').toLowerCase());
  }
  for (const [i, category] of (await get('/api/v1/project-categories')).items.entries())
    identify(category.id, `category-${i + 1}`);
  const target = projects.find((project) => project.name === 'Baseline Project 01');
  assert(target);
  const linkBody = { label: 'Baseline Link', url: 'https://example.com', projectId: target.id };
  const linkHeaders = { ...headers, 'Idempotency-Key': 'plan0021-baseline-link' };
  const createdLink = await setup.request.post(origin + '/api/v2/links', {
    data: linkBody,
    headers: linkHeaders,
  });
  const replayedLink = await setup.request.post(origin + '/api/v2/links', {
    data: linkBody,
    headers: linkHeaders,
  });
  assert.equal(createdLink.status(), 201);
  assert.equal(replayedLink.status(), 201);
  assert.deepEqual(await replayedLink.json(), await createdLink.json());
  assert.equal(replayedLink.headers()['x-workspace-data-revision'], undefined);
  checks.push({
    name: 'creationReplay',
    status: 201,
    identicalBody: true,
    revisionHeaderOmitted: true,
  });
  // Contract probes mutate only one synthetic project, before browser samples.
  const before = await get('/api/v2/projects/' + target.id);
  const patchBody = { revision: before.revision, subtitle: 'Baseline contract probe' };
  const patch = await setup.request.patch(origin + '/api/v2/projects/' + target.id, {
    data: patchBody,
    headers,
  });
  assert.equal(patch.status(), 200);
  const conflict = await setup.request.patch(origin + '/api/v2/projects/' + target.id, {
    data: patchBody,
    headers,
  });
  assert.equal(conflict.status(), 409);
  const invalidCursor = await setup.request.get(origin + '/api/v2/projects?cursor=invalid');
  assert.equal(invalidCursor.status(), 400);
  const anonymous = await browser.newContext(options);
  const unauthorized = await anonymous.request.get(origin + '/api/v2/projects');
  assert.equal(unauthorized.status(), 401);
  await anonymous.close();
  const forbidden = await setup.request.patch(origin + '/api/v2/projects/' + target.id, {
    data: patchBody,
    headers: { Origin: origin },
  });
  assert.equal(forbidden.status(), 403);
  for (const [name, response] of [
    ['patch', patch],
    ['conflict', conflict],
    ['invalidCursor', invalidCursor],
    ['unauthorized', unauthorized],
    ['csrfMissing', forbidden],
  ]) {
    checks.push({
      name,
      status: response.status(),
      revision: response.headers()['x-workspace-data-revision'] ?? null,
      code:
        response.status() >= 400 && name !== 'unauthorized' ? (await response.json()).code : null,
    });
  }
  const list = await setup.request.get(
    origin + '/api/v2/projects?category=all&status=active&limit=20',
  );
  const listBody = await list.json();
  assert.equal(listBody.items.length, 20);
  assert(listBody.nextCursor);
  assert.equal(
    (
      await get(
        '/api/v2/projects?category=all&status=active&limit=20&cursor=' +
          encodeURIComponent(listBody.nextCursor),
      )
    ).items.length,
    5,
  );
  checks.push({
    name: 'pagination',
    first: 20,
    next: 5,
    revision: list.headers()['x-workspace-data-revision'],
    cacheControl: list.headers()['cache-control'],
  });
  const overview = await get('/api/v2/overview?category=all');
  const taskStats = await get('/api/v2/tasks/stats?category=all&projectStatus=all');
  assert.equal(overview.projects.total, 25);
  assert.equal(overview.tasks.total, 30);
  checks.push({ name: 'overviewAndStats', overview: overview.tasks, stats: taskStats });
  const storageState = await setup.storageState(); // In memory only.
  await setup.close();
  const repeats = pilot ? 1 : 11; // First full pass warms the server and is excluded.
  for (let iteration = 0; iteration < repeats; iteration++) {
    const context = await browser.newContext({ ...options, storageState });
    const tab = await context.newPage();
    tab.on('dialog', (dialog) => dialog.accept());
    const inflight = new Set(),
      pending = new Set(),
      requests = new Map();
    let active,
      lastChange = Date.now();
    tab.on('pageerror', (error) => {
      throw new Error('Browser application error: ' + error.name);
    });
    const relevant = (request) => new URL(request.url()).pathname.startsWith('/api/');
    tab.on('request', (request) => {
      if (!relevant(request)) return;
      inflight.add(request);
      lastChange = Date.now();
      const record = {
        iteration,
        scenario: active?.scenario ?? 'outside',
        method: request.method(),
        path: safeUrl(request.url()),
        startMs: round(Date.now() - (active?.start ?? Date.now())),
      };
      requests.set(request, record);
      if (active) active.requests.push(record);
    });
    const finish = (request, failed) => {
      if (!relevant(request)) return;
      const job = (async () => {
        const record = requests.get(request);
        if (!record) return;
        const timing = request.timing();
        record.durationMs = round(timing.responseEnd);
        record.ttfbMs =
          timing.responseStart < 0 || timing.requestStart < 0
            ? null
            : round(timing.responseStart - timing.requestStart);
        record.failed = failed;
        if (failed) record.failure = request.failure()?.errorText ?? 'unknown';
        else {
          const response = await request.response();
          record.status = response.status();
          const responseHeaders = response.headers();
          record.revision = responseHeaders['x-workspace-data-revision'] ?? null;
          const size = await request.sizes();
          record.bodyBytes = size.responseBodySize;
          record.headerBytes = size.responseHeadersSize;
        }
      })().finally(() => {
        inflight.delete(request);
        pending.delete(job);
        lastChange = Date.now();
      });
      pending.add(job);
    };
    tab.on('requestfinished', (request) => finish(request, false));
    tab.on('requestfailed', (request) => finish(request, true));
    async function quiet() {
      const end = Date.now() + 15000;
      while (inflight.size || Date.now() - lastChange < 200) {
        assert(Date.now() < end, 'API settlement timeout');
        await tab.waitForTimeout(25);
      }
      await Promise.all([...pending]);
    }
    async function measure(scenario, action, ready) {
      await quiet();
      active = { iteration, scenario, start: Date.now(), requests: [] };
      await action();
      await ready();
      await tab.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      active.visibleMs = round(Date.now() - active.start);
      await quiet();
      const alerts = await tab.getByRole('alert').allTextContents();
      assert(
        alerts.every(
          (value) =>
            value === '프로젝트를 저장했습니다.' ||
            (plan0022 && value.includes('(NOT_CONFIGURED)')),
        ),
        scenario + ' has an unexpected alert',
      );
      const lastEnd = Math.max(
        0,
        ...active.requests.filter((r) => !r.failed).map((r) => r.startMs + r.durationMs),
      );
      const groups = new Map();
      for (const r of active.requests) {
        const key = r.method + ' ' + r.path;
        groups.set(key, (groups.get(key) ?? 0) + 1);
      }
      const sample = {
        iteration,
        scenario,
        visibleMs: active.visibleMs,
        lastApiEndMs: round(lastEnd),
        afterLastApiMs: round(active.visibleMs - lastEnd),
        apiCount: active.requests.length,
        failed: active.requests.filter((r) => r.failed).length,
        httpErrors: active.requests.filter((r) => r.status >= 400).length,
        repeatedSignatures: [...groups.values()].reduce(
          (sum, count) => sum + Math.max(0, count - 1),
          0,
        ),
        responseBytes: active.requests.reduce(
          (sum, r) => sum + (r.bodyBytes ?? 0) + (r.headerBytes ?? 0),
          0,
        ),
      };
      if (iteration > 0 || pilot) {
        samples.push(sample);
        records.push(...active.requests);
      }
      active = undefined;
      return sample;
    }
    const nav = (name) =>
      tab.locator('.sidebar nav').getByRole('button', { name, exact: false }).click();
    const projectsReady = (count = 20) => expect(tab.locator('.project-row')).toHaveCount(count);
    const homeReady = async () => {
      await expect(tab.locator('.sidebar .profile strong')).toHaveText('Alice Example');
      await expect(tab.getByText('Baseline Journal 3', { exact: true }).first()).toBeVisible();
      await expect(tab.getByText('Baseline Task 30', { exact: true }).first()).toBeVisible();
      await expect(tab.getByRole('status').filter({ hasText: /불러오/ })).toHaveCount(0);
    };
    const detailReady = async () => {
      await expect(tab.getByRole('heading', { name: target.name, exact: true })).toBeVisible();
      await expect(tab.getByRole('button', { name: '프로젝트 편집', exact: true })).toBeEnabled();
    };
    await measure('home-first', () => tab.goto(origin), homeReady);
    await measure(
      'projects-first',
      () => nav(/^프로젝트/),
      () => projectsReady(),
    );
    await measure(
      'projects-next-page',
      () => tab.getByRole('button', { name: '프로젝트 더 보기', exact: true }).click(),
      () => projectsReady(25),
    );
    await tab.locator('.project-row').filter({ hasText: target.name }).scrollIntoViewIfNeeded();
    const scrollBefore = await tab.evaluate(() => window.scrollY);
    await measure(
      'project-detail-first',
      () => tab.locator('.project-row').filter({ hasText: target.name }).click(),
      detailReady,
    );
    const returned = await measure(
      'projects-return',
      () => tab.getByRole('button', { name: '프로젝트 목록', exact: true }).click(),
      () => projectsReady(25),
    );
    returned.rows = await tab.locator('.project-row').count();
    returned.scrollBefore = scrollBefore;
    returned.scrollAfter = await tab.evaluate(() => window.scrollY);
    await measure(
      'project-editor-first',
      () => tab.getByRole('button', { name: '프로젝트 추가', exact: true }).click(),
      () =>
        expect(
          tab.getByRole('dialog').getByLabel('개발 분야', { exact: true }).locator('option'),
        ).toHaveCount(4),
    );
    await tab.getByRole('dialog').getByRole('button', { name: '취소', exact: true }).click();
    await measure(
      'project-editor-reopen',
      () => tab.getByRole('button', { name: '프로젝트 추가', exact: true }).click(),
      () => expect(tab.getByRole('dialog')).toBeVisible(),
    );
    await tab.getByRole('dialog').getByRole('button', { name: '취소', exact: true }).click();
    await nav(/^나의 홈/);
    await homeReady();
    await quiet();
    await measure(
      'tasks-first',
      () => nav(/^작업 보드/),
      () => expect(tab.getByText('Baseline Task 30', { exact: true })).toBeVisible(),
    );
    await measure(
      'task-editor-first',
      () => tab.getByRole('button', { name: '태스크 추가', exact: true }).click(),
      () =>
        expect(tab.getByRole('dialog').locator('select').first().locator('option')).toHaveCount(
          plan0022 ? 26 : 21,
        ),
    );
    await tab.getByRole('dialog').getByRole('button', { name: '취소', exact: true }).click();
    await measure(
      'task-editor-reopen',
      () => tab.getByRole('button', { name: '태스크 추가', exact: true }).click(),
      () => expect(tab.getByRole('dialog')).toBeVisible(),
    );
    await tab.getByRole('dialog').getByRole('button', { name: '취소', exact: true }).click();
    await measure('home-return', () => nav(/^나의 홈/), homeReady);
    await measure(
      'tasks-return',
      () => nav(/^작업 보드/),
      () => expect(tab.getByText('Baseline Task 30', { exact: true })).toBeVisible(),
    );
    await measure(
      'journals-first',
      () => nav(/^개발 일지/),
      () => expect(tab.getByText('Baseline Journal 3', { exact: true })).toBeVisible(),
    );
    await measure(
      'journal-editor-first',
      () => tab.getByRole('button', { name: '일지 작성', exact: true }).click(),
      () =>
        expect(
          tab.getByRole('dialog').getByLabel('프로젝트', { exact: true }).locator('option'),
        ).toHaveCount(plan0022 ? 26 : 21),
    );
    await tab.getByRole('dialog').getByRole('button', { name: 'Cancel edit', exact: true }).click();
    await measure(
      'journal-editor-reopen',
      () => tab.getByRole('button', { name: '일지 작성', exact: true }).click(),
      () => expect(tab.getByRole('dialog')).toBeVisible(),
    );
    await tab.getByRole('dialog').getByRole('button', { name: 'Cancel edit', exact: true }).click();
    await nav(/^프로젝트/);
    await projectsReady(plan0022 ? 25 : 20);
    await quiet();
    if (!plan0022) {
      await tab.getByRole('button', { name: '프로젝트 더 보기', exact: true }).click();
      await projectsReady(25);
    }
    await quiet();
    await measure(
      'project-detail-return',
      () => tab.locator('.project-row').filter({ hasText: target.name }).click(),
      detailReady,
    );
    await tab.getByRole('button', { name: '프로젝트 편집', exact: true }).click();
    await tab
      .getByRole('dialog')
      .getByLabel('프로젝트 설명', { exact: true })
      .fill(`Baseline edit ${iteration}`);
    await measure(
      'project-save',
      () => tab.getByRole('button', { name: '프로젝트 저장', exact: true }).click(),
      async () => {
        await expect(tab.getByRole('dialog')).toHaveCount(0);
        await expect(tab.locator('.project-description')).toHaveText(`Baseline edit ${iteration}`);
      },
    );
    await measure(
      'projects-after-save',
      () => tab.getByRole('button', { name: '프로젝트 목록', exact: true }).click(),
      () => projectsReady(),
    );
    await tab.getByRole('button', { name: '프로젝트 더 보기', exact: true }).click();
    await projectsReady(25);
    await quiet();
    await measure(
      'project-detail-after-save',
      () => tab.locator('.project-row').filter({ hasText: target.name }).click(),
      async () => {
        await detailReady();
        await expect(tab.locator('.project-description')).toHaveText(`Baseline edit ${iteration}`);
      },
    );
    assert.equal((await context.request.get(origin + '/api/v1/me')).status(), 200);
    await context.close();
    console.log(
      `Baseline pass ${iteration + 1}/${repeats} completed${!pilot && iteration === 0 ? ' (warmup excluded)' : ''}.`,
    );
  }
  const summary = [];
  for (const scenario of [...new Set(samples.map((s) => s.scenario))]) {
    const rows = samples.filter((s) => s.scenario === scenario);
    const stats = (key) => {
      const values = rows.map((r) => r[key]).sort((a, b) => a - b);
      return {
        median: round(
          (values[Math.floor((values.length - 1) / 2)] +
            values[Math.ceil((values.length - 1) / 2)]) /
            2,
        ),
        min: values[0],
        max: values.at(-1),
      };
    };
    summary.push({
      scenario,
      n: rows.length,
      apiCount: stats('apiCount'),
      visibleMs: stats('visibleMs'),
      responseBytes: stats('responseBytes'),
      failures: rows.reduce((s, r) => s + r.failed, 0),
      httpErrors: rows.reduce((s, r) => s + r.httpErrors, 0),
    });
  }
  const backendHash = crypto.createHash('sha256');
  function hashTree(dir) {
    for (const entry of fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) hashTree(file);
      else {
        backendHash.update(path.relative(path.join(root, '../backend'), file));
        backendHash.update(fs.readFileSync(file));
      }
    }
  }
  hashTree(path.join(root, '../backend/src/main'));
  const metadata = {
    plan: plan0022 ? 'PLAN-0022' : 'PLAN-0021',
    dashboardContract: plan0022 ? 'Widget v1 + Dashboard v3' : 'legacy dashboard contract',
    measuredAt: new Date().toISOString(),
    frontendCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim(),
    backendMainSha256: backendHash.digest('hex'),
    node: process.version,
    browser: browser.version(),
    os: `${os.type()} ${os.release()}`,
    cpu: os.cpus()[0].model,
    viewport: options.viewport,
    api: env.api,
    origin,
    production: true,
    database: 'PostgreSQL 16.4 disposable Testcontainers',
    fixture: {
      users: 1,
      categories: 3,
      projects: 25,
      tasks: 30,
      journals: 3,
      milestones: 0,
      links: 1,
    },
    warmupPasses: pilot ? 0 : 1,
    measuredPasses: pilot ? 1 : 10,
    throttling: 'none; loopback; sequential browser contexts',
    cache:
      'New browser context and document per pass; same document for in-app revisits; business responses no-store; Project list/detail policy is measured in the PLAN-0022 run',
    authentication:
      'Real backend session with local test OIDC provider; credentials and storageState are never written',
  };
  for (const [name, data] of Object.entries({
    metadata,
    checks,
    samples,
    requests: records,
    summary,
  }))
    fs.writeFileSync(path.join(output, name + '.json'), JSON.stringify(data, null, 2) + '\n');
  console.log(
    JSON.stringify(
      summary.map(({ scenario, apiCount, visibleMs }) => ({
        scenario,
        requests: apiCount.median,
        visibleMs: visibleMs.median,
      })),
    ),
  );
} finally {
  await browser.close();
}
