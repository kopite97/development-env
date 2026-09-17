// Disposable local environment for PLAN-0021. No application source is modified.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { startProvider } from '../tests/real/oidc-provider.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backend = path.resolve(root, '../backend');
const output = path.join(root, '.auth-validation/query-baseline');
const origin = 'http://127.0.0.1:4175';
const children = [];
let provider,
  database,
  closing = false;
fs.mkdirSync(output, { recursive: true });
const marker = path.join(output, 'environment.json');
if (fs.existsSync(marker))
  throw new Error('Previous environment marker exists; verify its owner first.');
const docker = (args) =>
  execFileSync('docker', args, { encoding: 'utf8', windowsHide: true }).trim();
function launch(command, args, options, onText) {
  const child = spawn(command, args, {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
  children.push(child);
  child.stdout.on('data', (chunk) => onText?.(chunk.toString()));
  child.stderr.on('data', (chunk) => onText?.(chunk.toString()));
  child.on('error', () => console.error('Owned child process failed to start.'));
  return child;
}
async function freePort(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}
async function ready(url, child, expected) {
  const end = Date.now() + 240000;
  while (Date.now() < end) {
    if (child.exitCode !== null) throw new Error(`Owned server exited with code ${child.exitCode}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.status === expected) return;
    } catch {
      /* startup */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Local server readiness timed out');
}
async function close() {
  if (closing) return;
  closing = true;
  for (const child of [...children].reverse()) {
    if (child.exitCode === null) {
      try {
        execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore',
        });
      } catch {
        /* exited */
      }
    }
  }
  await provider?.close();
  if (database) {
    try {
      if (docker(['inspect', '--format', '{{.Config.Image}}', database]) === 'postgres:16.4')
        docker(['stop', database]);
    } catch {
      /* Testcontainers may already have removed its owned DB */
    }
  }
  if (fs.existsSync(marker)) fs.unlinkSync(marker);
  console.log('Owned baseline servers stopped; disposable database discarded.');
}
process.on('SIGINT', () => void close().then(() => process.exit(0)));
process.on('SIGTERM', () => void close().then(() => process.exit(0)));
try {
  for (const port of [4175, 18080, 18999]) await freePort(port);
  assert(fs.existsSync(path.join(root, 'dist/index.html')), 'Run npm run build first');
  const javaHome = process.env.BASELINE_JAVA_HOME || 'C:\\Users\\nellu\\.jdks\\corretto-21.0.12.1';
  assert(fs.existsSync(path.join(javaHome, 'bin/java.exe')), 'Java 21 is required');
  const before = new Set(docker(['ps', '-q']).split('\n'));
  provider = await startProvider();
  const env = {
    ...process.env,
    JAVA_HOME: javaHome,
    SPRING_PROFILES_ACTIVE: 'test',
    SERVER_PORT: '18080',
    SPRING_CONFIG_IMPORT: 'classpath:category-transition.properties',
    SPRING_APPLICATION_JSON: JSON.stringify({
      'spring.flyway.init-sqls': [
        "select set_config('devspace.category_cutover_manifest','',false)",
      ],
    }),
    APP_ORIGIN: origin,
    SESSION_COOKIE_SECURE: 'false',
    OIDC_GOOGLE_CLIENT_ID: 'test-google-client',
    OIDC_GOOGLE_CLIENT_SECRET: 'test-google-secret',
    OIDC_GOOGLE_ISSUER_URI: 'http://127.0.0.1:18999',
    OIDC_GOOGLE_REDIRECT_URI: origin + '/api/v1/auth/callback/google',
    SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_GOOGLE_REDIRECT_URI:
      origin + '/api/v1/auth/callback/google',
    PROJECT_CURSOR_SIGNING_KEY: 'local-baseline-only-signing-key-at-least-32-bytes',
    DB_URL: 'jdbc:postgresql://127.0.0.1:1/unused',
    DB_USERNAME: 'unused',
    DB_PASSWORD: 'unused',
  };
  let logTail = '';
  const backendProcess = launch(
    'cmd.exe',
    ['/d', '/s', '/c', 'gradlew.bat bootTestRun -PcategoryStage=final --no-daemon'],
    { cwd: backend, env },
    (text) => {
      logTail = (logTail + text).slice(-32000);
      const match = logTail.match(/Container postgres:16\.4 is starting: ([a-f0-9]{64})/);
      if (match) database = match[1];
      // Only print non-secret build lifecycle lines, never raw OIDC/server logs.
      for (const line of text.split('\n'))
        if (/^> Task |^BUILD FAILED|^BUILD SUCCESSFUL/.test(line)) console.log(line.trim());
    },
  );
  await ready('http://127.0.0.1:18080/api/v1/me', backendProcess, 401);
  assert(database && !before.has(database.slice(0, 12)), 'Must own a new Testcontainers DB');
  assert.equal(docker(['inspect', '--format', '{{.Config.Image}}', database]), 'postgres:16.4');
  const users = docker([
    'exec',
    database,
    'psql',
    '-U',
    'test',
    '-d',
    'test',
    '-tA',
    '-c',
    'select count(*) from users',
  ]);
  assert.equal(users, '0', 'Refuse a nonempty database');
  const frontend = launch(
    process.execPath,
    [
      'node_modules/vite/bin/vite.js',
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      '4175',
      '--strictPort',
    ],
    { cwd: root, env: { ...process.env, BACKEND_UPSTREAM: 'http://127.0.0.1:18080' } },
  );
  await ready(origin, frontend, 200);
  fs.writeFileSync(
    marker,
    JSON.stringify(
      {
        origin,
        api: 'http://127.0.0.1:18080',
        database,
        ownerPid: process.pid,
        startedAt: new Date().toISOString(),
        production: true,
        categoryStage: 'final',
      },
      null,
      2,
    ),
  );
  console.log(
    'BASELINE_READY: production preview + unchanged Spring backend + fresh PostgreSQL 16.4',
  );
  await new Promise(() => {});
} catch (error) {
  console.error(error.message);
  await close();
  process.exitCode = 1;
}
