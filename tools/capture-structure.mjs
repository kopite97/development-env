import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173';
const output = 'test-results/structure';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
const errors = [];
try {
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    page.on('pageerror', (error) => errors.push(error.message));
    for (const route of [
      '/',
      '/projects',
      '/projects/forest',
      '/tasks',
      '/journals',
      '/library',
      '/missing',
    ]) {
      await page.goto(new URL(route, baseUrl).href);
      await page.locator('h1').waitFor();
      const metrics = await page.evaluate(() => ({
        heading: document.querySelector('h1')?.textContent,
        headingCount: document.querySelectorAll('h1').length,
        width: window.innerWidth,
        contentWidth: document.documentElement.scrollWidth,
        widgets: document.querySelectorAll('.widget').length,
      }));
      if (metrics.headingCount !== 1 || !metrics.heading?.trim())
        errors.push(`${route}: missing heading`);
      if (metrics.contentWidth > metrics.width + 1)
        errors.push(`${route}: page overflows at ${viewport.width}px`);
      if (route === '/' && metrics.widgets !== 6)
        errors.push('Default dashboard widgets did not render');
      const name = route === '/' ? 'home' : route.slice(1).replaceAll('/', '-');
      await page.screenshot({ path: `${output}/${name}-${viewport.width}.png`, fullPage: true });
      results.push({ route, viewport, ...metrics });
    }
    await page.goto(baseUrl);
    await page.getByRole('button', { name: '위젯 추가', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    const bounds = await dialog.boundingBox();
    if (!bounds || bounds.x < 0 || bounds.x + bounds.width > viewport.width + 1) {
      errors.push(`Widget editor overflows at ${viewport.width}px`);
    }
    await page.screenshot({
      path: `${output}/widget-editor-${viewport.width}.png`,
      fullPage: true,
    });
    await page.close();
  }
} finally {
  await browser.close();
}
writeFileSync(`${output}/results.json`, JSON.stringify({ results, errors }, null, 2));
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Captured 16 screenshots; ${results.length} route/viewport checks passed without page errors or horizontal overflow.`,
  );
}
