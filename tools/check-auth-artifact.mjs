import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const files = fs
  .readdirSync('dist', { recursive: true })
  .filter((file) => fs.statSync(path.join('dist', file)).isFile());
assert.deepEqual(
  files.filter((file) => file.endsWith('.html')),
  ['index.html'],
);
const output = files.map((file) => fs.readFileSync(path.join('dist', file), 'utf8')).join('\n');
for (const marker of [
  'devspace.projects.v1',
  'devspace.tasks.v1',
  'devspace.journals.v1',
  'devspace.milestones.v1',
  'devspace.links.v1',
  'devspace.layout.v1',
  'browser-test/login',
  'test-google-secret',
  'Local test identity provider',
  'tests/legacy/main.tsx',
])
  assert(
    !output.includes(marker),
    'Production output includes forbidden fixture/storage marker: ' + marker,
  );
assert(!output.includes('http://127.0.0.1:18080'), 'Backend target leaked into browser code');
assert(!output.includes('BACKEND_UPSTREAM'), 'Server-only config leaked into browser code');
const entry = fs.readFileSync('src/app/App.tsx', 'utf8');
assert(
  !/AppProviders|AppLayout|PageRouter|import\(/.test(entry),
  'Default composition must not activate legacy providers',
);
const dockerIgnore = fs.readFileSync('.dockerignore', 'utf8').split(/\r?\n/);
for (const name of ['tests', '.auth-validation', '.env', '.env.*'])
  assert(dockerIgnore.includes(name));
assert(
  !/tests\/legacy|rollupOptions|input:/.test(fs.readFileSync('vite.config.ts', 'utf8')),
  'Default Vite must have a single production entry',
);
console.log(
  'Auth production artifact isolation passed: ' +
    files.length +
    ' files; no legacy storage, provider fixtures or server-only config.',
);
