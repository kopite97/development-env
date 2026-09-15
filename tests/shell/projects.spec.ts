import { test, expect } from '../auth/fixtures';
import { setup, id } from '../journals/fixtures';
import { comparePixels } from './visual';

const projects = [
  {
    id: id(1),
    name: 'Forest of Echoes',
    subtitle: '탐험과 발견이 있는 작은 숲',
    scope: 'unity',
    stack: 'Unity · C#',
    progress: 68,
    color: 'forest',
    milestone: '플레이 가능한 데모',
    repositoryUrl: 'https://example.com/forest',
    archived: false,
  },
  {
    id: id(2),
    name: 'Devspace API',
    subtitle: '프로젝트를 연결하는 백엔드',
    scope: 'server',
    stack: 'Java · Spring Boot',
    progress: 84,
    color: 'api',
    milestone: 'v1.2 배포',
    repositoryUrl: '',
    archived: false,
  },
];
const apiProjects = projects.map(({ milestone, archived, color, scope: _scope, ...project }) => ({
  ...project,
  currentMilestone: milestone,
  status: archived ? 'archived' : 'active',
  categoryId: null,
  revision: 7,
  createdAt: '2026-09-13T00:00:00Z',
  updatedAt: '2026-09-14T00:00:00Z',
}));

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`original Project presentation parity ${viewport.width}x${viewport.height}`, async ({
    page,
    browser,
  }, testInfo) => {
    test.setTimeout(60000);
    await page.setViewportSize(viewport);
    await setup(page);
    const requests: URL[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/v2/')) requests.push(new URL(request.url()));
    });
    await page.route('**/api/v2/projects?*', (route) =>
      route.fulfill({ json: { items: apiProjects, total: 2, nextCursor: null } }),
    );
    await page.route('**/api/v2/projects/' + id(1), (route) =>
      route.fulfill({ json: apiProjects[0] }),
    );
    await page.route('**/api/v2/overview?*', (route) => {
      const params = new URL(route.request().url()).searchParams;
      return route.fulfill({
        json: {
          category: params.get('category') ?? 'all',
          projectId: params.get('projectId'),
          projects: {
            total: params.has('projectId') ? 1 : 2,
            archived: 0,
            byCategory: [{ categoryId: null, total: params.has('projectId') ? 1 : 2, archived: 0 }],
          },
          tasks: { total: 0, todo: 0, doing: 0, done: 0 },
          asOf: '2026-09-14T00:00:00Z',
        },
      });
    });
    const legacy = await browser.newPage({ viewport });
    await legacy.addInitScript((projects) => {
      localStorage.setItem('devspace.projects.v1', JSON.stringify(projects));
      for (const name of ['tasks', 'journals', 'milestones', 'links'])
        localStorage.setItem('devspace.' + name + '.v1', '[]');
    }, projects);
    const options = {
      animations: 'disabled' as const,
      style:
        'main, .modal { transform: translateZ(0) !important; } .welcome-strip > .badge { color: transparent !important; } .category-management-action, .project-category-field, .project-category-fact { display: none !important; } .field:has(select[aria-label="개발 분야"]), .project-summary .feature-actions .badge:nth-child(2) { display: none !important; } .project-icon { visibility: hidden !important; }',
    };
    try {
      for (const path of ['/projects', '/projects/' + id(1)]) {
        const detail = path !== '/projects';
        const name = detail ? 'detail' : 'list';
        await legacy.goto('http://127.0.0.1:4186' + path);
        await page.goto(path);
        await legacy.mouse.move(0, 0);
        await page.mouse.move(0, 0);
        await expect(
          page.locator(detail ? '.project-summary' : '.project-row').first(),
        ).toBeVisible();
        await expect(page.locator('.app-shell .topbar')).toBeVisible();
        await expect(
          page.locator(
            '.auth-card, .auth-header, .server-project-list, .overview-counts, .project-audit',
          ),
        ).toHaveCount(0);
        const mainText = await page.locator('main').innerText();
        for (const forbidden of [
          'Workspace counters',
          'Refresh counters',
          'loaded rows',
          id(1),
          'Revision:',
          'Created:',
          'Updated:',
          'Link integration pending',
        ])
          expect(mainText).not.toContain(forbidden);
        await expect(page.getByRole('alert')).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );

        const selectors = detail
          ? ['.page-heading', '.project-summary']
          : ['.page-heading', '.welcome-strip', '.section-toolbar .search', '.content-panel'];
        for (const selector of selectors) {
          const original = await legacy.locator(selector).screenshot({
            ...options,
            path: testInfo.outputPath(name + '-original-' + selector.slice(1) + '.png'),
          });
          const restored = await page.locator(selector).screenshot({
            ...options,
            path: testInfo.outputPath(name + '-restored-' + selector.slice(1) + '.png'),
          });
          await comparePixels(page, original, restored);
        }
        if (detail) {
          expect(
            await page
              .locator('.project-detail > section.content-panel')
              .evaluateAll((sections) =>
                sections.map((section) => section.getAttribute('aria-label')),
              ),
          ).toEqual([
            '프로젝트 기본 정보',
            '프로젝트 마일스톤',
            '프로젝트 작업',
            '프로젝트 최근 일지',
          ]);
          for (const section of ['프로젝트 마일스톤', '프로젝트 작업', '프로젝트 최근 일지']) {
            // Match text shaping across equivalent JSX text-node boundaries.
            for (const target of [legacy, page])
              await target
                .getByRole('region', { name: section, exact: true })
                .locator('.panel-heading')
                .evaluate((element) => element.normalize());
            // Isolate the heading from adjacent API controls at fractional screenshot edges.
            const original = await legacy
              .getByRole('region', { name: section, exact: true })
              .locator('.panel-heading')
              .screenshot({
                ...options,
                style: options.style + ' .panel-heading ~ * { visibility: hidden !important; }',
                path: testInfo.outputPath(section + '-original.png'),
              });
            const restored = await page
              .getByRole('region', { name: section, exact: true })
              .locator('.panel-heading')
              .screenshot({
                ...options,
                style: options.style + ' .panel-heading ~ * { visibility: hidden !important; }',
                path: testInfo.outputPath(section + '-restored.png'),
              });
            await comparePixels(page, original, restored);
          }
          for (const resource of ['tasks', 'journals', 'milestones'])
            expect(
              requests.some(
                (url) =>
                  url.pathname === '/api/v2/' + resource &&
                  url.searchParams.get('projectId') === id(1),
              ),
            ).toBe(true);
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        await legacy.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          animations: 'disabled',
          style: 'main { transform: translateZ(0) !important; }',
          path: testInfo.outputPath(name + '-restored.png'),
          fullPage: true,
        });
        await legacy.screenshot({
          animations: 'disabled',
          style: 'main { transform: translateZ(0) !important; }',
          path: testInfo.outputPath(name + '-original.png'),
          fullPage: true,
        });
        if (detail) {
          await legacy.getByRole('button', { name: '프로젝트 편집', exact: true }).click();
          await page.getByRole('button', { name: '프로젝트 편집', exact: true }).click();
          await expect(page.getByLabel('호환 범위')).toHaveCount(0);
          await expect(page.getByLabel('개발 분야', { exact: true })).toBeVisible();
          await page
            .getByRole('dialog')
            .screenshot({ path: testInfo.outputPath('editor-category-actual.png') });
          await legacy.mouse.move(0, 0);
          await page.mouse.move(0, 0);
          const original = await legacy
            .getByRole('dialog')
            .screenshot({ ...options, path: testInfo.outputPath('editor-original.png') });
          const restored = await page
            .getByRole('dialog')
            .screenshot({ ...options, path: testInfo.outputPath('editor-restored.png') });
          await comparePixels(page, original, restored);
          await page
            .getByRole('dialog')
            .getByRole('button', { name: '카테고리 관리', exact: true })
            .click();
          await expect(page.getByRole('dialog')).toHaveCount(1);
          await expect(page.getByLabel('카테고리 이름', { exact: true })).toBeVisible();
          expect(
            await page.getByRole('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth),
          ).toBe(true);
          await page
            .getByRole('dialog')
            .screenshot({ path: testInfo.outputPath('category-management.png') });
        }
      }
    } finally {
      await legacy.close();
    }
  });
}
