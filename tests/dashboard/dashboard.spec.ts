import { test, expect, setup, dashboard, defaults, project, id, journal } from './fixtures';
import type { Page } from '@playwright/test';
const frame = (page: Page, id: string) => page.locator(`[data-widget-id="${id}"]`);
test('virtual default composition is authoritative, read only until explicit save and preserves demo', async ({
  page,
}) => {
  await setup(page);
  const writes: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'PUT') writes.push(r.url());
  });
  await page.goto('/');
  await expect(page.locator('.dashboard-grid > .widget')).toHaveCount(6);
  await expect(page.getByRole('heading', { name: '다시 만나 반가워요 👋' })).toBeVisible();
  expect(await page.locator('.widget-header h2').allTextContents()).toEqual(
    defaults.map((w) => w.title),
  );
  await expect(frame(page, 'home-deploy').getByText('실시간 연동 전 · 데모 데이터')).toBeVisible();
  await frame(page, 'home-deploy')
    .getByRole('button', { name: /Devspace API/ })
    .click();
  await expect(page.getByRole('dialog')).toContainText('실시간 모니터링 결과가 아닙니다');
  await page
    .getByRole('dialog')
    .locator('.modal-actions')
    .getByRole('button', { name: '닫기', exact: true })
    .click();
  await page.getByRole('button', { name: '배치 편집', exact: true }).click();
  await expect(page.getByLabel('현재 화면 검색')).toBeDisabled();
  await expect(frame(page, 'home-board').locator('.dashboard-widget-content')).toHaveAttribute(
    'inert',
    '',
  );
  await page.locator('.heading-actions').getByRole('button', { name: '취소', exact: true }).click();
  expect(writes).toEqual([]);
});
test('cold failure is not defaults; retry and saved empty remain genuinely empty', async ({
  page,
}) => {
  await setup(page);
  let failed = true;
  await page.route('**/api/v1/dashboards/home', (r) =>
    r.fulfill(
      failed ? { status: 404, json: { code: 'RESOURCE_NOT_FOUND' } } : { json: dashboard(3, []) },
    ),
  );
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('배치를 불러오지 못했습니다');
  await expect(page.locator('.widget')).toHaveCount(0);
  await expect(page.getByText('표시할 위젯이 없어요')).toHaveCount(0);
  failed = false;
  await page.getByRole('button', { name: '배치 다시 불러오기' }).click();
  await expect(page.getByText('표시할 위젯이 없어요')).toBeVisible();
  await page.reload();
  await expect(page.locator('.widget')).toHaveCount(0);
});
test('editing preserves frame controls, drag, widths, optional config and awaits exact revision-zero PUT', async ({
  page,
}) => {
  await setup(page);
  let current = dashboard();
  let release!: () => void;
  const bodies: Record<string, unknown>[] = [];
  await page.route('**/api/v1/dashboards/home', async (r) => {
    if (r.request().method() === 'PUT') {
      const body = r.request().postDataJSON();
      bodies.push(body);
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      current = { ...body, id: 'home', revision: 1 };
    }
    await r.fulfill({ json: current });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '배치 편집', exact: true }).click();
  await frame(page, 'home-overview')
    .getByRole('button', { name: '프로젝트 개요 뒤로 이동' })
    .click();
  expect(await page.locator('.widget').first().getAttribute('data-widget-id')).toBe('home-board');
  await expect(
    frame(page, 'home-overview').getByRole('button', { name: '프로젝트 개요 드래그 이동' }),
  ).toBeFocused();
  await frame(page, 'home-overview')
    .getByRole('button', { name: '프로젝트 개요 드래그 이동' })
    .dragTo(frame(page, 'home-board'));
  expect(await page.locator('.widget').first().getAttribute('data-widget-id')).toBe(
    'home-overview',
  );
  await frame(page, 'home-overview').getByRole('button', { name: '프로젝트 개요 설정' }).click();
  await page.getByLabel('위젯 제목', { exact: true }).fill('  My overview  ');
  await page.getByLabel('위젯 너비').selectOption('small');
  await page.getByLabel('특정 프로젝트').selectOption(id(1));
  await page.getByLabel('표시 개수').fill('1');
  await page.getByRole('button', { name: '설정 적용' }).click();
  await expect(frame(page, 'home-overview')).toHaveClass(/widget-small/);
  await page.getByRole('button', { name: '배치 저장', exact: true }).click();
  await expect(page.getByRole('button', { name: '저장 중…' })).toBeDisabled();
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toMatchObject({ schemaVersion: 1, revision: 0 });
  expect(Object.keys(bodies[0]).sort()).toEqual(['revision', 'schemaVersion', 'widgets']);
  expect((bodies[0].widgets as Record<string, unknown>[])[0]).toMatchObject({
    title: 'My overview',
    projectId: id(1),
    scope: 'all',
    limit: 1,
  });
  release();
  await expect(page.getByText('배치를 적용했습니다.')).toBeVisible();
  await page.reload();
  await expect(frame(page, 'home-overview').getByRole('heading')).toHaveText('My overview');
});
test('reset is explicit draft-only, cancel preserves server and utility replacement omits stale fields', async ({
  page,
}) => {
  await setup(page);
  const writes: unknown[] = [];
  let current = dashboard(7, [
    { ...defaults[0], projectId: id(1), limit: 1 } as (typeof defaults)[0],
  ]);
  await page.route('**/api/v1/dashboards/home', (r) => {
    if (r.request().method() === 'PUT') {
      const b = r.request().postDataJSON();
      writes.push(b);
      current = { ...b, id: 'home', revision: 8 };
    }
    return r.fulfill({ json: current });
  });
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await page.getByRole('button', { name: '배치 편집', exact: true }).click();
  await page.getByRole('button', { name: '기본 배치', exact: true }).click();
  await page.getByRole('button', { name: '기본 배치 적용' }).click();
  await expect(page.locator('.widget')).toHaveCount(6);
  expect(writes).toHaveLength(0);
  await page.locator('.heading-actions').getByRole('button', { name: '취소' }).click();
  await expect(page.locator('.widget')).toHaveCount(1);
  await page.getByRole('button', { name: '배치 편집', exact: true }).click();
  await frame(page, 'home-overview').getByRole('button', { name: '프로젝트 개요 설정' }).click();
  await page.locator('.catalog-item').filter({ hasText: '빠른 링크' }).click();
  await page.getByRole('button', { name: '설정 적용' }).click();
  await page.getByRole('button', { name: '배치 저장' }).click();
  await expect(page.getByText('배치를 적용했습니다.')).toBeVisible();
  expect(writes).toEqual([
    {
      schemaVersion: 1,
      revision: 7,
      widgets: [
        { id: 'home-overview', type: 'links', title: '빠른 링크', scope: 'all', size: 'wide' },
      ],
    },
  ]);
});
test('conflict preserves full draft and requires review, confirmation and a separate explicit save', async ({
  page,
}) => {
  await setup(page);
  let current = dashboard(4);
  let writes = 0;
  const revisions: number[] = [];
  await page.route('**/api/v1/dashboards/home', (r) => {
    if (r.request().method() === 'PUT') {
      writes++;
      const body = r.request().postDataJSON();
      revisions.push(body.revision);
      if (writes === 1) {
        current = dashboard(5, [{ ...defaults[2], title: 'Other tab' }]);
        return r.fulfill({ status: 409, json: { code: 'REVISION_CONFLICT' } });
      }
      current = { ...body, id: 'home', revision: 6 };
    }
    return r.fulfill({ json: current });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '배치 편집', exact: true }).click();
  await frame(page, 'home-links').getByRole('button', { name: '바로가기 제거' }).click();
  await page.getByRole('button', { name: '배치 저장' }).click();
  await expect(page.getByRole('region', { name: '배치 충돌 검토' })).toContainText('Other tab');
  await expect(page.getByRole('button', { name: '배치 저장' })).toBeDisabled();
  expect(writes).toBe(1);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '내 초안 전체 다시 적용' }).click();
  expect(writes).toBe(1);
  await expect(page.locator('.widget')).toHaveCount(5);
  await page.getByRole('button', { name: '배치 저장' }).click();
  await expect(page.getByText('배치를 적용했습니다.')).toBeVisible();
  expect(revisions).toEqual([4, 5]);
});
test('ambiguous committed PUT is reconciled by matching GET without replay', async ({ page }) => {
  await setup(page);
  let current = dashboard();
  let writes = 0;
  await page.route('**/api/v1/dashboards/home', (r) => {
    if (r.request().method() === 'PUT') {
      writes++;
      current = { ...r.request().postDataJSON(), id: 'home', revision: 1 };
      return r.abort('failed');
    }
    return r.fulfill({ json: current });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '배치 편집', exact: true }).click();
  await page.getByRole('button', { name: '배치 저장' }).click();
  await expect(page.getByText(/현재 서버 배치가 제출한 내용과 같습니다/)).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '서버 배치 사용' }).click();
  await expect(page.getByRole('button', { name: '배치 편집', exact: true })).toBeVisible();
  expect(writes).toBe(1);
});
test('validation failure preserves draft; failed reconciliation blocks blind save', async ({
  page,
}) => {
  await setup(page);
  let writes = 0;
  let readsFail = false;
  await page.route('**/api/v1/dashboards/home', (r) => {
    if (r.request().method() === 'PUT') {
      writes++;
      if (writes === 1) return r.fulfill({ status: 404, json: { code: 'RESOURCE_NOT_FOUND' } });
      readsFail = true;
      return r.abort('failed');
    }
    return r.fulfill(
      readsFail ? { status: 503, json: { code: 'INTERNAL_ERROR' } } : { json: dashboard() },
    );
  });
  await page.goto('/');
  await page.getByRole('button', { name: '배치 편집', exact: true }).click();
  await frame(page, 'home-links').getByRole('button', { name: '바로가기 제거' }).click();
  await page.getByRole('button', { name: '배치 저장' }).click();
  await expect(page.getByRole('button', { name: '배치 저장' })).toBeEnabled();
  await expect(page.locator('.widget')).toHaveCount(5);
  await page.getByRole('button', { name: '배치 저장' }).click();
  await expect(page.getByRole('button', { name: '배치 저장' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '내 초안 전체 다시 적용' })).toHaveCount(0);
  expect(writes).toBe(2);
});
test('configured filters and direct archived Project work beyond loaded pages; Home search only filters frames', async ({
  page,
}) => {
  await setup(page);
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/v1/')) requests.push(r.url());
  });
  await page.route('**/api/v1/projects/' + id(99), (r) =>
    r.fulfill({ json: project(99, 'archived') }),
  );
  const widgets = [
    { ...defaults[0], projectId: id(99), limit: 1 },
    { ...defaults[4], scope: 'server', limit: 1 },
    { ...defaults[5], scope: 'server', limit: 1 },
    { ...defaults[3], scope: 'unity' },
  ];
  await page.route('**/api/v1/dashboards/home', (r) => r.fulfill({ json: dashboard(2, widgets) }));
  await page.route('**/api/v1/journals?*', (r) =>
    r.fulfill({ json: { items: [journal(1, { scope: 'server' })], total: 1, nextCursor: null } }),
  );
  await page.goto('/');
  await expect(
    frame(page, 'home-overview').getByRole('button', { name: 'Project 99 상세 보기' }),
  ).toBeVisible();
  await expect(frame(page, 'home-overview').getByText('보관된 프로젝트')).toBeVisible();
  await expect(frame(page, 'home-journal').locator('.journal-row')).toHaveCount(1);
  expect(
    requests.some(
      (u) =>
        u.includes('journals?') &&
        u.includes('scope=server') &&
        u.includes('sort=newest') &&
        u.includes('limit=1'),
    ),
  ).toBe(true);
  expect(
    requests.some(
      (u) =>
        u.includes('milestones?') &&
        u.includes('scope=server') &&
        u.includes('status=open') &&
        u.includes('limit=1'),
    ),
  ).toBe(true);
  await page.getByLabel('현재 화면 검색').fill('개발 일지');
  await expect(page.locator('.widget')).toHaveCount(1);
  await expect(page).toHaveURL(/q=/);
  await page.reload();
  await expect(page.locator('.widget')).toHaveCount(1);
  await expect(page.getByLabel('현재 화면 검색')).toHaveValue('개발 일지');
  await page.getByRole('button', { name: '배치 편집', exact: true }).click();
  await expect(page).toHaveURL('/');
  await expect(page.locator('.widget')).toHaveCount(4);
  expect(requests.filter((u) => u.includes('dashboards/home')).every((u) => !u.includes('?'))).toBe(
    true,
  );
});
for (const [name, viewport] of [
  ['desktop', { width: 1440, height: 1000 }],
  ['mobile', { width: 390, height: 844 }],
  ['landscape', { width: 844, height: 390 }],
] as const)
  test('Home/editor responsive and keyboard baseline ' + name, async ({ page }) => {
    await setup(page);
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('.widget')).toHaveCount(6);
    await expect(frame(page, 'home-overview').locator('.project-row')).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: '.auth-validation/dashboard-api-' + name + '.png',
      fullPage: true,
    });
    await page.getByRole('button', { name: '배치 편집', exact: true }).click();
    await page.screenshot({
      path: '.auth-validation/dashboard-edit-api-' + name + '.png',
      fullPage: true,
    });
    await frame(page, 'home-overview').getByRole('button', { name: '프로젝트 개요 설정' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.screenshot({
      path: '.auth-validation/dashboard-editor-api-' + name + '.png',
      fullPage: true,
    });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(
      frame(page, 'home-overview').getByRole('button', { name: '프로젝트 개요 설정' }),
    ).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
