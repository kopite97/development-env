import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
// Run alongside the legacy baseline server (4175) and authenticated Vite (4183).
const browser = await chromium.launch();
try {
  const legacy = await browser.newPage();
  const api = await browser.newPage();
  let widgets = [];
  await api.route('**/api/v1/**', (route) => {
    const p = new URL(route.request().url());
    let data;
    if (p.pathname.endsWith('/me'))
      data = {
        id: '00000000-0000-0000-0000-000000000001',
        displayName: 'N',
        workspace: { id: '00000000-0000-0000-0000-000000000002', name: 'Workspace', revision: 1 },
      };
    else if (p.pathname.endsWith('/dashboards/home'))
      data = { id: 'home', schemaVersion: 1, revision: 1, widgets };
    else if (p.pathname.endsWith('/overview'))
      data = {
        scope: p.searchParams.get('scope') ?? 'all',
        projectId: p.searchParams.get('projectId'),
        projects: {
          total: 0,
          archived: 0,
          byScope: { unity: { total: 0, archived: 0 }, server: { total: 0, archived: 0 } },
        },
        tasks: { todo: 0, doing: 0, done: 0, total: 0 },
        asOf: '2026-09-14T00:00:00Z',
      };
    else if (p.pathname.endsWith('/tasks/stats'))
      data = { counts: { todo: 0, doing: 0, done: 0 }, total: 0, asOf: '2026-09-14T00:00:00Z' };
    else
      data = {
        items: [],
        total: 0,
        nextCursor: null,
        ...(p.pathname.endsWith('/links') ? { collectionRevision: 0 } : {}),
      };
    return route.fulfill({ json: data });
  });
  const metrics = (page) =>
    page.evaluate(() => {
      const css = (node, properties) =>
        Object.fromEntries(properties.map((key) => [key, getComputedStyle(node)[key]]));
      return {
        grid: css(document.querySelector('.dashboard-grid'), ['gridTemplateColumns', 'gap']),
        frames: [...document.querySelectorAll('.dashboard-grid > .widget')].map((node) => ({
          width: Math.round(node.getBoundingClientRect().width * 10) / 10,
          box: css(node, ['padding', 'borderRadius', 'borderWidth']),
          title: css(node.querySelector('h2'), ['fontSize', 'fontWeight', 'lineHeight']),
          header: css(node.querySelector('.widget-header'), ['display', 'marginBottom']),
        })),
      };
    });
  const evidence = [];
  for (const [name, width, height] of [
    ['desktop', 1440, 1000],
    ['mobile', 390, 844],
    ['landscape', 844, 390],
  ]) {
    await legacy.setViewportSize({ width, height });
    await api.setViewportSize({ width, height });
    await legacy.goto('http://127.0.0.1:4175');
    await legacy.locator('.widget').first().waitFor();
    widgets = await legacy.locator('.widget').evaluateAll((nodes) =>
      nodes.map((n) => ({
        id: n.dataset.widgetId,
        type: n.dataset.widgetId,
        title: n.querySelector('h2').textContent,
        scope:
          n.querySelector('.badge').textContent === '전체'
            ? 'all'
            : n.querySelector('.badge').textContent === 'Unity'
              ? 'unity'
              : 'server',
        size: n.classList.contains('widget-wide')
          ? 'wide'
          : n.classList.contains('widget-small')
            ? 'small'
            : 'medium',
      })),
    );
    await api.goto('http://127.0.0.1:4183');
    await api.locator('.widget').first().waitFor();
    await api.locator('.kanban').waitFor();
    const before = await metrics(legacy),
      after = await metrics(api);
    assert.deepEqual(after, before, 'Frame/grid geometry ' + name);
    await api.screenshot({
      path: '.auth-validation/dashboard-same-layout-' + name + '.png',
      fullPage: true,
    });
    for (const page of [legacy, api]) {
      await page.getByRole('button', { name: '배치 편집', exact: true }).click();
      await page.getByRole('button', { name: '빠른 링크 설정', exact: true }).click();
    }
    const editor = (page) =>
      page.locator('.modal').evaluate((n) => ({
        width: n.getBoundingClientRect().width,
        height: n.getBoundingClientRect().height,
        fontSize: getComputedStyle(n).fontSize,
      }));
    assert.deepEqual(await editor(api), await editor(legacy), 'Editor geometry ' + name);
    await api.screenshot({
      path: '.auth-validation/dashboard-same-editor-' + name + '.png',
      fullPage: true,
    });
    evidence.push({ viewport: name, gridAndFrameMatch: true, editorMatch: true, metrics: after });
  }
  fs.writeFileSync(
    '.auth-validation/dashboard-visual-parity.json',
    JSON.stringify(evidence, null, 2),
  );
  console.log(
    'Dashboard same-configuration grid, frame, title and editor geometry matches legacy at all 3 viewports.',
  );
} finally {
  await browser.close();
}
