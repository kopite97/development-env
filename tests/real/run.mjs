import { validateProjects } from './projects.mjs';
import { validateTasks } from './tasks.mjs';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { startProvider } from './oidc-provider.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const backend = path.resolve(root, '../dev-back/devspace');
const phase = process.argv.find((arg) => arg.startsWith('--projects='))?.split('=')[1];
const taskPhase = process.argv.find((arg) => arg.startsWith('--tasks='))?.split('=')[1];
const nginx = process.argv.includes('--nginx');
const origin = nginx ? 'http://127.0.0.1:4177' : 'http://127.0.0.1:4175';
const output = path.join(root, '.auth-validation', nginx ? 'nginx' : 'vite');
fs.mkdirSync(output, { recursive: true });
const children = [];
const logs = [];
let browser;
let provider;
let container;
const runId = 'plan0006-' + Date.now();
function launch(command, args, options, name) {
  const child = spawn(command, args, {
    windowsHide: true,
    ...options,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const log = fs.createWriteStream(path.join(output, name + '.log'));
  logs.push(log);
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  children.push(child);
  return child;
}
async function ready(url, child) {
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    if (child?.exitCode !== null && child?.exitCode !== undefined)
      throw new Error('Server exited before readiness; inspect sanitized local server log.');
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (response.status < 500) return;
    } catch {
      /* bounded startup polling */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Server readiness deadline exceeded: ' + url);
}
function docker(args) {
  return execFileSync('docker', args, { encoding: 'utf8', windowsHide: true }).trim();
}

try {
  // Refuse an unrelated server rather than reusing an unknown security configuration.
  for (const port of [18080, Number(new URL(origin).port)]) {
    try {
      await fetch('http://127.0.0.1:' + port, { signal: AbortSignal.timeout(500) });
      throw new Error('Port already occupied: ' + port);
    } catch (error) {
      if (error.message.startsWith('Port already')) throw error;
    }
  }
  const before = new Set(docker(['ps', '-q']).split('\n'));
  provider = await startProvider();
  const env = {
    ...process.env,
    JAVA_HOME: 'C:\\Users\\nellu\\.jdks\\corretto-21.0.12.1',
    SPRING_PROFILES_ACTIVE: 'test',
    SERVER_PORT: '18080',
    SPRING_CONFIG_IMPORT: 'optional:file:./plan0006-no-env.properties',
    APP_ORIGIN: origin,
    SESSION_COOKIE_SECURE: 'false',
    OIDC_GOOGLE_CLIENT_ID: 'test-google-client',
    OIDC_GOOGLE_CLIENT_SECRET: 'test-google-secret',
    OIDC_GOOGLE_ISSUER_URI: 'http://127.0.0.1:18999',
    OIDC_GOOGLE_REDIRECT_URI: origin + '/api/v1/auth/callback/google',
    SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_GOOGLE_REDIRECT_URI:
      origin + '/api/v1/auth/callback/google',
    PROJECT_CURSOR_SIGNING_KEY: 'test-only-project-cursor-signing-key-at-least-32-bytes',
    DB_URL: 'jdbc:postgresql://127.0.0.1:1/unused',
    DB_USERNAME: 'unused',
    DB_PASSWORD: 'unused',
  };
  const backendProcess = launch(
    'cmd.exe',
    ['/d', '/s', '/c', 'gradlew.bat bootTestRun --no-daemon'],
    { cwd: backend, env },
    'backend',
  );
  await ready('http://127.0.0.1:18080/api/v1/me', backendProcess);
  console.log('Unchanged backend test launcher ready with disposable PostgreSQL.');
  // Other workspaces can start Testcontainers concurrently. Bind to this owned
  // backend process's startup evidence instead of claiming all new containers.
  const databaseIds = [
    ...fs
      .readFileSync(path.join(output, 'backend.log'), 'utf8')
      .matchAll(/Container postgres:16\.4 is starting: ([a-f0-9]{64})/g),
  ].map((match) => match[1]);
  assert.equal(databaseIds.length, 1, 'Owned backend must identify exactly one test database');
  const database = databaseIds[0];
  assert(!before.has(database.slice(0, 12)), 'Owned database must be new for this run');
  assert.equal(docker(['inspect', '--format', '{{.Config.Image}}', database]), 'postgres:16.4');
  const sql = (query) =>
    docker([
      'exec',
      database,
      'psql',
      '-U',
      'test',
      '-d',
      'test',
      '-tA',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      query,
    ]);
  assert.equal(sql('select count(*) from users'), '0');
  if (nginx) {
    docker(['build', '-t', 'devspace-plan0006', '.']);
    container = runId;
    docker([
      'run',
      '-d',
      '--rm',
      '--name',
      container,
      '-p',
      '127.0.0.1:4177:10000',
      '-e',
      'BACKEND_UPSTREAM=http://host.docker.internal:18080',
      'devspace-plan0006',
    ]);
    fs.writeFileSync(
      path.join(output, 'nginx-config.txt'),
      docker(['exec', container, 'nginx', '-T']),
    );
    await ready(origin + '/api/v1/me');
    assert(
      !docker(['exec', container, 'find', '/usr/share/nginx/html', '-type', 'f']).includes(
        'tests/',
      ),
    );
  } else {
    const frontend = launch(
      process.execPath,
      ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4175', '--strictPort'],
      { cwd: root, env: { ...process.env, BACKEND_UPSTREAM: 'http://127.0.0.1:18080' } },
      'frontend',
    );
    await ready(origin, frontend);
  }
  browser = await chromium.launch();
  const context = await browser.newContext();
  const sentinels = Object.fromEntries(
    ['projects', 'tasks', 'journals', 'milestones', 'links', 'layout', 'unrelated'].map(
      (name, index) => [
        'devspace.' + name + '.v1',
        index % 2 ? '{malformed-preserved' : '[{"id":"personal-edit","name":"Keep my work"}]',
      ],
    ),
  );
  await context.addInitScript(
    ({ origin, sentinels }) => {
      if (location.origin === origin && !Object.hasOwn(localStorage, 'devspace.unrelated.v1'))
        for (const [key, value] of Object.entries(sentinels)) localStorage.setItem(key, value);
    },
    { origin, sentinels },
  );
  const page = await context.newPage();
  const excluded = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      url.pathname.startsWith('/api/') &&
      !/^\/api\/v1\/(me$|auth\/|projects(?:\/|$)|tasks(?:\/|$)|overview$)/.test(url.pathname)
    )
      excluded.push(url.pathname);
  });
  assert.equal((await context.request.get(origin + '/api/v1/me')).status(), 401);
  for (const prefix of ['/api', '/oauth2', '/api/unknown', '/oauth2/unknown']) {
    const response = await context.request.get(origin + prefix, { maxRedirects: 0 });
    assert(response.status() >= 400 || response.status() === 302);
    assert(!(response.headers()['content-type'] ?? '').includes('text/html'));
  }
  await page.goto(origin + '/projects/example?scope=all&q=hello');
  assert.equal(await page.title(), 'Devspace — 나만의 개발 작업실');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await page.getByRole('link', { name: 'alice', exact: true }).click();
  await page.waitForURL(origin + '/projects/example?scope=all&q=hello');
  const me = await context.request.get(origin + '/api/v1/me');
  assert.equal(me.status(), 200);
  const alice = await me.json();
  assert.equal(alice.displayName, 'Alice Example');
  assert.equal(alice.workspace.revision, 1);
  await expect(page.getByRole('heading', { name: 'Alice Example', exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(output, 'authenticated-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(output, 'authenticated-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  const contractResponse = await context.request.get('http://127.0.0.1:18080/v3/api-docs');
  assert.equal(contractResponse.status(), 200);
  const contract = await contractResponse.json();
  assert.deepEqual(contract.components.schemas.MeResponse.required.slice().sort(), [
    'displayName',
    'id',
    'workspace',
  ]);
  assert.deepEqual(contract.components.schemas.WorkspaceResponse.required.slice().sort(), [
    'id',
    'name',
    'revision',
  ]);
  assert.deepEqual(contract.components.schemas.CsrfTokenResponse.required, ['csrfToken']);
  assert(contract.paths['/api/v1/me'].get.responses['401']);
  assert(contract.paths['/api/v1/auth/logout'].post.responses['204']);
  assert(contract.paths['/api/v1/auth/login'].get.responses['302']);
  assert(
    !Object.keys(contract.paths).some(
      (key) => key.includes('browser-test') || key.includes('fixture'),
    ),
  );
  fs.writeFileSync(
    path.join(output, 'auth-contract.json'),
    JSON.stringify(
      {
        paths: Object.fromEntries(
          Object.entries(contract.paths).filter(
            ([key]) => key === '/api/v1/me' || key.startsWith('/api/v1/auth/'),
          ),
        ),
        schemas: Object.fromEntries(
          ['MeResponse', 'WorkspaceResponse', 'CsrfTokenResponse', 'ApiError'].map((key) => [
            key,
            contract.components.schemas[key],
          ]),
        ),
      },
      null,
      2,
    ),
  );
  assert.deepEqual(
    await page.evaluate(() => Object.fromEntries(Object.entries(localStorage))),
    sentinels,
  );
  await page.reload();
  assert.equal((await context.request.get(origin + '/api/v1/me')).status(), 200);
  assert.equal(sql('select count(*) from users'), '1');
  assert.equal(sql('select count(*) from workspaces'), '1');
  const counts = sql(
    'select (select count(*) from projects)+(select count(*) from tasks)+(select count(*) from journals)+(select count(*) from milestones)+(select count(*) from links)+(select count(*) from dashboards)',
  );
  assert.equal(counts, '0');
  if (phase) await validateProjects({ page, context, origin, sql, alice, output, phase });
  if (taskPhase)
    await validateTasks({ page, context, origin, sql, alice, output, phase: taskPhase });
  const csrf = await context.request.get(origin + '/api/v1/auth/csrf');
  assert.equal(csrf.status(), 200);
  const token = (await csrf.json()).csrfToken;
  assert.equal(
    (
      await context.request.post(origin + '/api/v1/auth/logout', { headers: { Origin: origin } })
    ).status(),
    403,
  );
  assert.equal(
    (
      await context.request.post(origin + '/api/v1/auth/logout', {
        headers: { Origin: 'https://forbidden.example', 'X-CSRF-Token': token },
      })
    ).status(),
    403,
  );
  const logout = await context.request.post(origin + '/api/v1/auth/logout', {
    headers: { Origin: origin, 'X-CSRF-Token': token },
  });
  assert.equal(logout.status(), 204);
  assert.equal(await logout.text(), '');
  assert.equal((await context.request.get(origin + '/api/v1/me')).status(), 401);
  assert.equal((await context.request.post(origin + '/api/v1/auth/logout')).status(), 204);
  assert.equal(excluded.length, 0);
  await page.goto(origin);
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await page.getByRole('link', { name: 'bob', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bob Example', exact: true })).toBeVisible();
  const bob = await (await context.request.get(origin + '/api/v1/me')).json();
  assert.notEqual(bob.id, alice.id);
  assert.notEqual(bob.workspace.id, alice.workspace.id);
  assert.equal(sql('select count(*) from users'), '2');
  assert.equal(sql('select count(*) from workspaces'), '2');
  assert.deepEqual(
    await page.evaluate(() => Object.fromEntries(Object.entries(localStorage))),
    sentinels,
  );
  // Isolated SQL exercises the existing disabled callback behavior without backend fixtures.
  assert.equal(
    sql("update users set disabled_at=now() where id='" + alice.id + "' returning id").split(
      '\n',
    )[0],
    alice.id,
  );
  const uiLogoutResponse = page.waitForResponse(
    (response) =>
      response.url() === origin + '/api/v1/auth/logout' && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  assert.equal((await uiLogoutResponse).status(), 204);
  await expect(page.getByRole('heading', { name: 'Sign in to your workspace' })).toBeVisible();
  await page.goto(origin);
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  const disabledResponse = page.waitForResponse((response) =>
    response.url().startsWith(origin + '/api/v1/auth/callback/google'),
  );
  await page.getByRole('link', { name: 'alice', exact: true }).click();
  const disabled = await disabledResponse;
  assert.equal(disabled.status(), 403);
  assert.equal((await disabled.json()).code, 'ACCOUNT_DISABLED');
  assert.equal((await context.request.get(origin + '/api/v1/me')).status(), 401);
  await page.goto(origin);
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await page.getByRole('link', { name: 'cancel', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Google sign-in failed. Please try again.');
  assert(!page.url().includes('authError'));
  assert.deepEqual(
    await page.evaluate(() => Object.fromEntries(Object.entries(localStorage))),
    sentinels,
  );
  assert.equal(
    sql(
      'select (select count(*) from projects)+(select count(*) from tasks)+(select count(*) from journals)+(select count(*) from milestones)+(select count(*) from links)+(select count(*) from dashboards)',
    ),
    '0',
  );
  assert.equal(provider.stats.pkce, 3);
  assert.equal(excluded.length, 0);
  await page.screenshot({ path: path.join(output, 'entry.png'), fullPage: true });
  execFileSync('taskkill', ['/PID', String(backendProcess.pid), '/T', '/F'], {
    windowsHide: true,
    stdio: 'ignore',
  });
  const unavailable = await context.request.get(origin + '/api/v1/me');
  assert(unavailable.status() >= 500, 'Unavailable backend must not become successful SPA HTML');
  assert.equal((await context.request.get(origin + '/projects/deep-link')).status(), 200);
  fs.writeFileSync(
    path.join(output, 'result.json'),
    JSON.stringify(
      {
        boundary: nginx ? 'nginx' : 'vite',
        passed: true,
        protocol: provider.stats,
        businessRows: 0,
        excludedRequests: 0,
      },
      null,
      2,
    ),
  );
  console.log(
    'Real session/proxy smoke passed: callback, PKCE, reload, CSRF, Origin, logout, zero business rows.',
  );
} finally {
  await browser?.close();
  if (container) {
    try {
      docker(['stop', container]);
    } catch {
      /* already exited */
    }
  }
  for (const child of children.reverse()) {
    if (child.exitCode === null) {
      try {
        execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore',
        });
      } catch {
        /* already exited */
      }
    }
  }
  await provider?.close();
  for (const log of logs) log.end();
}
