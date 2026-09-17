import { test, expect, setup, dashboard, defaults, project, journal, id } from './fixtures';
import type { Page } from '@playwright/test';

const frame = (page: Page, name: string) => page.locator(`[data-widget-id="${name}"]`);
async function filteredSetup(page: Page) {
  await setup(page);
  await page.route('**/api/v1/project-categories', (r) =>
    r.fulfill({
      json: {
        items: [1, 2].map((n) => ({
          id: id(800 + n),
          name: '분야 ' + n,
          revision: 1,
          createdAt: '2026-09-15T00:00:00Z',
          updatedAt: '2026-09-15T00:00:00Z',
        })),
        total: 2,
      },
    }),
  );
  const reads: URL[] = [];
  const writes: unknown[] = [];
  const widgets = [
    ...defaults,
    ...[0, 1, 4, 5].map((n) => ({
      ...defaults[n],
      id: defaults[n].id + '-configured',
      selection: { kind: 'project' as const, projectId: id(2) },
      limit: 1,
    })),
  ];
  await page.route('**/api/v2/dashboards/home', (route) => {
    if (route.request().method() === 'PUT') writes.push(route.request().postDataJSON());
    return route.fulfill({ json: dashboard(writes.length, widgets) });
  });
  page.on('request', (request) => {
    if (request.url().includes('/api/v2/')) reads.push(new URL(request.url()));
  });
  await page.route('**/api/v2/projects/*', (route) =>
    route.request().url().endsWith('/category-counts')
      ? route.fallback()
      : route.fulfill({ json: project(Number(route.request().url().split('-').at(-1))) }),
  );
  await page.route('**/api/v2/projects?*', (route) => {
    const category = new URL(route.request().url()).searchParams.get('category');
    const items = [project(1), project(2)].filter(
      (item) => !category || category === 'all' || id(800 + Number(item.id.slice(-1))) === category,
    );
    return route.fulfill({ json: { items, total: items.length, nextCursor: null } });
  });
  for (const resource of ['tasks', 'journals', 'milestones']) {
    await page.route(`**/api/v2/${resource}?*`, (route) => {
      const selected = new URL(route.request().url()).searchParams.get('projectId');
      const category = new URL(route.request().url()).searchParams.get('category');
      const ns = selected
        ? [selected === id(1) ? 1 : 2]
        : [1, 2].filter((n) => !category || category === 'all' || id(800 + n) === category);
      const items = ns.map((n) => ({
        ...journal(n),
        id: id(200 + n),
        title: `${resource} ${n}`,
        projectId: id(n),
        projectName: `Project ${n}`,
        categoryId: id(800 + n),
        ...(resource === 'tasks'
          ? { description: '', status: 'todo', priority: 'normal', tag: '', deletedAt: null }
          : {}),
        ...(resource === 'milestones' ? { dueDate: null, completed: false } : {}),
      }));
      return route.fulfill({ json: { items, total: items.length, nextCursor: null } });
    });
  }
  return { reads, writes, widgets };
}
async function shown(page: Page, selected?: number) {
  await expect(page.getByLabel('Home 프로젝트')).toHaveValue(selected ? id(selected) : '');
  for (const [type, resource] of [
    ['board', 'tasks'],
    ['journal', 'journals'],
    ['milestone', 'milestones'],
  ]) {
    const normal = frame(page, 'home-' + type);
    const configured = frame(page, 'home-' + type + '-configured');
    await expect(normal.getByText(`${resource} ${selected ?? 1}`, { exact: true })).toBeVisible();
    await expect(
      configured.getByText(`${resource} ${selected ?? 2}`, { exact: true }),
    ).toBeVisible();
    if (selected) {
      await expect(
        normal.getByText(`${resource} ${selected === 1 ? 2 : 1}`, { exact: true }),
      ).toHaveCount(0);
      await expect(
        configured.getByText(`${resource} ${selected === 1 ? 2 : 1}`, { exact: true }),
      ).toHaveCount(0);
    }
  }
  await expect(frame(page, 'home-overview').locator('.project-row')).toHaveCount(selected ? 1 : 2);
  await expect(frame(page, 'home-overview').locator('.project-row').first()).toContainText(
    `Project ${selected ?? 1}`,
  );
  await expect(frame(page, 'home-overview-configured').locator('.project-row')).toContainText(
    `Project ${selected ?? 2}`,
  );
}

test('Home Category selection overrides repeated configured Projects without persisting changes', async ({
  page,
}) => {
  const { reads, writes } = await filteredSetup(page);
  await page.goto('/');
  await shown(page);
  for (const n of [1, 2]) {
    await page.getByLabel('개발 분야 필터', { exact: true }).selectOption(id(800 + n));
    for (const [type, resource] of [
      ['board', 'tasks'],
      ['journal', 'journals'],
      ['milestone', 'milestones'],
    ]) {
      await expect(
        frame(page, 'home-' + type).getByText(resource + ' ' + n, { exact: true }),
      ).toBeVisible();
      await expect(
        frame(page, 'home-' + type + '-configured').getByText(resource + ' ' + n, { exact: true }),
      ).toBeVisible();
    }
    expect(
      reads.some(
        (url) =>
          url.pathname === '/api/v2/tasks' &&
          url.searchParams.get('category') === id(800 + n) &&
          !url.searchParams.has('projectId'),
      ),
    ).toBe(true);
  }
  await page.goBack();
  await expect(
    frame(page, 'home-board-configured').getByText('tasks 1', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    frame(page, 'home-board-configured').getByText('tasks 1', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '저장된 위젯 설정 사용' }).click();
  await shown(page);
  expect(writes).toEqual([]);
});

test('Home URL selection changes actual queries/content across history and refresh, not saved widget configuration', async ({
  page,
}) => {
  const { reads, writes, widgets } = await filteredSetup(page);
  await page.goto('/');
  await shown(page);
  await page.getByLabel('Home 프로젝트').selectOption(id(1));
  await shown(page, 1);
  await page.getByLabel('Home 프로젝트').selectOption(id(2));
  await shown(page, 2);
  for (const n of [1, 2])
    for (const resource of ['overview', 'tasks', 'tasks/stats', 'journals', 'milestones']) {
      expect(
        reads.some(
          (url) =>
            url.pathname === '/api/v2/' + resource &&
            url.searchParams.get('projectId') === id(n) &&
            url.searchParams.get('category') === 'all',
        ),
      ).toBe(true);
    }
  expect(
    reads
      .filter((url) => url.pathname === '/api/v2/links')
      .some((url) => url.searchParams.get('projectId') === id(2)),
  ).toBe(true);
  await page.getByLabel('Home 프로젝트').selectOption('');
  await shown(page);
  await page.goBack();
  await shown(page, 2);
  await page.goBack();
  await shown(page, 1);
  await page.goForward();
  await shown(page, 2);
  await page.reload();
  await shown(page, 2);
  await page.goto('/?projectId=' + id(1));
  await shown(page, 1);
  await page.getByLabel('현재 화면 검색').fill('');
  await expect(page).toHaveURL(new RegExp('projectId=' + id(1)));
  await shown(page, 1);
  expect(writes).toEqual([]);
  await page.getByRole('button', { name: '배치 편집', exact: true }).click();
  await expect(page.getByLabel('Home 프로젝트')).toBeDisabled();
  await page.getByRole('button', { name: '배치 저장', exact: true }).click();
  await expect(page.getByText('배치를 적용했습니다.')).toBeVisible();
  expect(writes).toEqual([
    {
      schemaVersion: 2,
      revision: 0,
      widgets: widgets.map(({ selectionState: _state, ...widget }) => widget),
    },
  ]);
  await shown(page);
});

test('category/search preserve Project URL selection and invalid IDs never broaden widget reads', async ({
  page,
}) => {
  await filteredSetup(page);
  await page.goto('/?projectId=' + id(1));
  await shown(page, 1);
  await page.getByLabel('현재 화면 검색').fill('개발 일지');
  await expect(page).toHaveURL(new RegExp('projectId=' + id(1)));
  await expect(frame(page, 'home-journal').getByText('journals 1', { exact: true })).toBeVisible();
  await page.goto('/?projectId=invalid');
  await expect(page.getByLabel('Home 프로젝트')).toHaveValue('invalid');
  await expect(
    page.getByRole('alert', { name: '' }).filter({ hasText: '올바른 프로젝트' }),
  ).toHaveCount(9);
  await expect(frame(page, 'home-board').getByText('tasks 1', { exact: true })).toHaveCount(0);
  await page.getByLabel('Home 프로젝트').selectOption('');
  await shown(page);
});

test('late Project A response cannot replace Project B widget subscriptions', async ({ page }) => {
  await filteredSetup(page);
  const releases: (() => void)[] = [];
  let settled = 0;
  await page.route('**/api/v2/journals?*', async (route) => {
    if (new URL(route.request().url()).searchParams.get('projectId') !== id(1))
      return route.fallback();
    await new Promise<void>((resolve) => {
      releases.push(resolve);
    });
    await route.fulfill({
      json: { items: [journal(1, { title: 'Late Project A' })], total: 1, nextCursor: null },
    });
    settled++;
  });
  await page.goto('/');
  await shown(page);
  await page.getByLabel('Home 프로젝트').selectOption(id(1));
  await expect.poll(() => releases.length).toBe(2);
  await page.getByLabel('Home 프로젝트').selectOption(id(2));
  await shown(page, 2);
  for (const release of releases) release();
  await expect.poll(() => settled).toBe(2);
  await expect(page.getByText('Late Project A', { exact: true })).toHaveCount(0);
  await shown(page, 2);
});

test('Home history honors unsaved Task drafts before changing the selected Project', async ({
  page,
}) => {
  await filteredSetup(page);
  await page.goto('/');
  await shown(page);
  await page.getByLabel('Home 프로젝트').selectOption(id(1));
  await shown(page, 1);
  await frame(page, 'home-board').getByRole('button', { name: '태스크 추가', exact: true }).click();
  await page.getByLabel('태스크 제목', { exact: true }).fill('보존할 초안');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.evaluate(() => history.back());
  await expect(page.getByLabel('태스크 제목', { exact: true })).toHaveValue('보존할 초안');
  await expect(page).toHaveURL(new RegExp('projectId=' + id(1)));
  page.once('dialog', (dialog) => dialog.accept());
  await page.evaluate(() => history.back());
  await shown(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
