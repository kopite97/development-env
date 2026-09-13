import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { chromium, expect } from '@playwright/test';
const output = process.argv[2] ?? '.auth-validation/tasks/baseline';
fs.mkdirSync(output, { recursive: true });
const server = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    '--config',
    'tests/legacy/vite.config.ts',
    '--host',
    '127.0.0.1',
    '--port',
    '4180',
    '--strictPort',
  ],
  { windowsHide: true, stdio: 'ignore' },
);
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch('http://127.0.0.1:4180')).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('http://127.0.0.1:4180/tasks');
  await expect(page.locator('.task').first()).toBeVisible();
  const styles = await page
    .locator('.task')
    .first()
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return Object.fromEntries(
        ['backgroundColor', 'borderRadius', 'padding', 'fontSize', 'borderColor'].map((k) => [
          k,
          s[k],
        ]),
      );
    });
  fs.writeFileSync(output + '/card-styles.json', JSON.stringify(styles, null, 2));
  for (const [name, width, height] of [
    ['desktop', 1280, 900],
    ['short', 1280, 600],
    ['mobile', 390, 844],
    ['landscape', 844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: output + '/tasks-' + name + '.png', fullPage: true });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('.task-title').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({ path: output + '/editor.png', fullPage: true });
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '태스크 삭제', exact: true }).click();
  await page.getByRole('button', { name: /휴지통/ }).click();
  await page.screenshot({ path: output + '/trash.png', fullPage: true });
  await page.getByRole('button', { name: /복구$/ }).click();
  await page.screenshot({ path: output + '/trash-empty.png', fullPage: true });
  await page.keyboard.press('Escape');
  await page.goto('http://127.0.0.1:4180/');
  await page.screenshot({ path: output + '/home.png', fullPage: true });
  await page.goto('http://127.0.0.1:4180/projects/forest');
  await page.screenshot({ path: output + '/project.png', fullPage: true });
  console.log('Captured legacy Task page/editor/trash/Home/Project baselines and card styles.');
} finally {
  await browser?.close();
  if (server.exitCode === null)
    execFileSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
}
