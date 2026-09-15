import { test, expect } from '../auth/fixtures';
import { setup, journal, id } from '../journals/fixtures';
import { overview } from '../projects/fixtures';
import type { Page } from '@playwright/test';

const routes = [
  ['/', '나의 홈'],
  ['/projects', '프로젝트'],
  ['/projects/' + id(1), '프로젝트'],
  ['/tasks', '작업 보드'],
  ['/journals', '개발 일지'],
  ['/library', '자료실'],
] as const;

import { comparePixels } from './visual';

test.beforeEach(async ({ page }) => {
  await setup(page);
  await page.route('**/api/v2/overview?*', (route) => {
    const params = new URL(route.request().url()).searchParams;
    return route.fulfill({
      json: overview(params.get('category') ?? 'all', params.get('projectId')),
    });
  });
  await page.route('**/api/v2/journals?*', (route) =>
    route.fulfill({ json: { items: [journal(1)], total: 1, nextCursor: null } }),
  );
});

async function assertShell(page: Page, label: string) {
  await expect(page.locator('.authenticated-workspace > .app-shell')).toHaveCount(1);
  await expect(page.locator('.app-shell .topbar')).toBeVisible();
  await expect(page.locator('.main-shell > main .page-heading')).toBeVisible();
  await expect(page.locator('.sidebar nav [aria-current="page"]')).toContainText(label);
  await expect(
    page.locator('.auth-app, .auth-card, .auth-header, .auth-identity, .auth-pending'),
  ).toHaveCount(0);
  await expect(page.locator('.sidebar .profile strong')).toHaveText('Alice');
  await expect(page.locator('.workspace-switch strong')).toHaveText('Workspace');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const [path, label] of routes) {
  test(`direct visit and refresh keep ${path} in the authenticated application layout`, async ({
    page,
  }) => {
    const errors: string[] = [];
    const legacyModules: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => {
      if (
        /\/(?:AppProviders|WorkspaceProvider|DashboardProvider|ProjectsProvider|TasksProvider|JournalsProvider|MilestonesProvider|LinksProvider)\.tsx/.test(
          request.url(),
        )
      )
        legacyModules.push(request.url());
    });
    await page.goto(path);
    await assertShell(page, label);
    await page.reload();
    await assertShell(page, label);
    if (path === '/projects')
      await expect(page.getByRole('button', { name: /^Project 1\s/ })).toBeVisible();
    if (path.startsWith('/projects/')) {
      await expect(page.getByRole('heading', { name: 'Project 1', exact: true })).toBeVisible();
      await expect(page.locator('.topbar .breadcrumb')).toContainText('프로젝트 / 상세');
    }
    if (path === '/journals')
      await expect(page.locator('.document-row')).toContainText('Journal 1');
    expect(errors).toEqual([]);
    expect(legacyModules).toEqual([]);
  });
}

for (const mobile of [false, true]) {
  test(`sidebar navigation and history preserve the shell (${mobile ? 'mobile' : 'desktop'})`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    for (const [path, label] of routes.filter(([path]) => !path.startsWith('/projects/'))) {
      if (mobile) await page.getByRole('button', { name: '메뉴 열기' }).click();
      await page
        .locator('.sidebar nav')
        .getByRole('button', { name: new RegExp(label) })
        .click();
      await expect(page).toHaveURL(path);
      await assertShell(page, label);
      if (mobile) {
        await expect(page.locator('.sidebar')).not.toHaveClass(/sidebar-open/);
        await expect(page.getByRole('button', { name: '메뉴 열기' })).toBeFocused();
      }
    }
    await page.goBack();
    await assertShell(page, '개발 일지');
    await page.goForward();
    await assertShell(page, '자료실');
  });
}

test('mobile menu traps focus, closes with Escape and overlay, and guards a single scoped navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/projects');
  const trigger = page.getByRole('button', { name: '메뉴 열기' });
  await trigger.click();
  await expect(page.locator('.main-shell')).toHaveAttribute('inert', '');
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('.profile')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('.sidebar-close')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.locator('.nav-overlay').click({ position: { x: 380, y: 100 } });
  await expect(trigger).toBeFocused();

  await page.getByRole('button', { name: '프로젝트 추가', exact: true }).first().click();
  await page.getByLabel('프로젝트 이름', { exact: true }).fill('Keep draft');
  let prompts = 0;
  page.once('dialog', async (dialog) => {
    prompts++;
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page).toHaveURL('/projects');
  await expect(page.getByLabel('프로젝트 이름', { exact: true })).toHaveValue('Keep draft');
  page.once('dialog', async (dialog) => {
    prompts++;
    await dialog.accept();
  });
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await trigger.click();
  await page
    .locator('.sidebar')
    .getByRole('button', { name: /미분류/ })
    .click();
  await expect(page).toHaveURL('/projects?category=uncategorized');
  expect(prompts).toBe(2);
  await expect(page.getByLabel('프로젝트 이름', { exact: true })).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`original shell visual parity ${viewport.width}x${viewport.height}`, async ({
    page,
    browser,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    const legacy = await browser.newPage({ viewport });
    try {
      for (const [path, label] of routes) {
        const legacyPath = path.startsWith('/projects/') ? '/projects/forest' : path;
        await legacy.goto('http://127.0.0.1:4186' + legacyPath);
        await page.goto(path);
        await assertShell(page, label);
        await expect(legacy.locator('.topbar')).toBeVisible();
        const name =
          path === '/' ? 'home' : path.startsWith('/projects/') ? 'project-detail' : path.slice(1);
        const geometry = async (target: Page) =>
          target.locator('main').evaluate((element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return {
              x: rect.x,
              width: rect.width,
              padding: style.padding,
              topbar: document.querySelector('.topbar')!.getBoundingClientRect().height,
            };
          });
        expect(await geometry(page)).toEqual(await geometry(legacy));
        const options = {
          animations: 'disabled' as const,
          style:
            '.sidebar, .topbar { transform: translateZ(0) !important; } .avatar, .workspace-switch strong, .profile strong, .nav-count { color: transparent !important; }',
        };
        const originalTopbar = await legacy
          .locator('.topbar')
          .screenshot({ ...options, path: testInfo.outputPath(name + '-original-topbar.png') });
        const authenticatedTopbar = await page.locator('.topbar').screenshot({
          ...options,
          path: testInfo.outputPath(name + '-authenticated-topbar.png'),
        });
        await comparePixels(page, originalTopbar, authenticatedTopbar);
        await page.screenshot({
          path: testInfo.outputPath(name + '-authenticated.png'),
          fullPage: true,
        });
        await legacy.screenshot({
          path: testInfo.outputPath(name + '-original.png'),
          fullPage: true,
        });
        if (viewport.width <= 680) {
          await legacy.getByRole('button', { name: '메뉴 열기' }).click();
          await page.getByRole('button', { name: '메뉴 열기' }).click();
        }
        await expect(page.locator('.sidebar')).toBeVisible();
        const originalSidebar = await legacy
          .locator('.sidebar')
          .screenshot({ ...options, path: testInfo.outputPath(name + '-original-sidebar.png') });
        const authenticatedSidebar = await page.locator('.sidebar').screenshot({
          ...options,
          path: testInfo.outputPath(name + '-authenticated-sidebar.png'),
        });
        // Dynamic Category rows replace the fixed enum and may change menu height.
        // Compare each unchanged presentation surface exactly; retain full screenshots above.
        expect(originalSidebar.length).toBeGreaterThan(0);
        expect(authenticatedSidebar.length).toBeGreaterThan(0);
        for (const selector of [
          '.brand',
          '.workspace-switch',
          '.sidebar nav',
          '.workspace-note',
          '.profile',
        ]) {
          await test.step(name + ' ' + selector, async () => {
            const width = await legacy
              .locator(selector)
              .evaluate((element) => element.getBoundingClientRect().width);
            expect(
              await page
                .locator(selector)
                .evaluate((element) => element.getBoundingClientRect().width),
            ).toBe(width);
            // Capture identical surfaces at one origin, independent of menu row count/scroll.
            const isolated = {
              ...options,
              style:
                options.style +
                ` ${selector} { position: fixed !important; top: 0 !important; left: 0 !important; width: ${width}px !important; margin: 0 !important; transform: translateZ(0) !important; z-index: 100 !important; }`,
            };
            await comparePixels(
              page,
              await legacy.locator(selector).screenshot({
                ...isolated,
                path: testInfo.outputPath(
                  name + '-original-' + selector.replaceAll(/[^a-z]/g, '') + '.png',
                ),
              }),
              await page.locator(selector).screenshot({
                ...isolated,
                path: testInfo.outputPath(
                  name + '-authenticated-' + selector.replaceAll(/[^a-z]/g, '') + '.png',
                ),
              }),
            );
          });
        }
      }
    } finally {
      await legacy.close();
    }
  });
}
