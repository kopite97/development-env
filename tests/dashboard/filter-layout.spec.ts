import { test, expect, setup } from './fixtures';

for (const size of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`filter alignment ${size.width}x${size.height}`, async ({ page }, info) => {
    await setup(page);
    await page.setViewportSize(size);
    for (const path of ['/', '/tasks', '/journals', '/library']) {
      await page.goto(path);
      const toolbar = page.locator('.classification-toolbar');
      const selects = toolbar.locator('select');
      await expect(selects).toHaveCount(2);
      await page.waitForLoadState('networkidle');
      const first = await selects.nth(0).boundingBox();
      const second = await selects.nth(1).boundingBox();
      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
      expect(Math.abs(first!.y - second!.y)).toBeLessThan(1);
      expect(Math.abs(first!.height - second!.height)).toBeLessThan(1);
      expect(Math.abs(first!.width - second!.width)).toBeLessThan(1);
      expect(second!.x - first!.x - first!.width).toBeGreaterThanOrEqual(12);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: info.outputPath(`${path.replaceAll('/', '_')}.png`),
        fullPage: true,
      });
    }
  });
}
