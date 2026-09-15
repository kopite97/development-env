import { test, expect } from '../auth/fixtures';
import { setup } from '../journals/fixtures';
import { overview } from '../projects/fixtures';
import type { Page } from '@playwright/test';

async function assertFont(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.load('400 16px "Pretendard Variable"', '프로젝트 Home');
    await document.fonts.ready;
  });
  const families = await page
    .locator('body, button, input, textarea, select, nav, dialog')
    .evaluateAll((elements) => elements.map((element) => getComputedStyle(element).fontFamily));
  for (const family of families)
    expect(family).toBe(
      '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
]) {
  test(`global webfont renders across routes and controls ${viewport.width}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport);
    await setup(page);
    await page.route('**/api/v2/overview?*', (route) => {
      const params = new URL(route.request().url()).searchParams;
      return route.fulfill({
        json: overview(params.get('category') ?? 'all', params.get('projectId')),
      });
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    for (const path of ['/', '/projects', '/tasks', '/journals', '/library']) {
      await page.goto(path);
      await expect(page.locator('main h1')).toBeVisible();
      await assertFont(page);
      const { root } = await cdp.send('DOM.getDocument');
      const { nodeId } = await cdp.send('DOM.querySelector', {
        nodeId: root.nodeId,
        selector: 'main h1',
      });
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
      expect(
        fonts.some(
          (font) =>
            font.isCustomFont && font.familyName.includes('Pretendard') && font.glyphCount > 0,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath((path.slice(1) || 'home') + '.png'),
        fullPage: true,
      });
    }
    await page.goto('/projects');
    await page.getByRole('button', { name: '프로젝트 추가', exact: true }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await assertFont(page);
    for (const selector of ['input', 'textarea', 'select', 'button'])
      await expect(page.getByRole('dialog').locator(selector).first()).toBeVisible();
    await page.screenshot({ path: info.outputPath('project-modal.png'), fullPage: true });
    await cdp.detach();
  });
}
