import { test as base, expect, type Page } from '@playwright/test';

export const id = (n: number) => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');

const types = ['overview', 'board', 'deploy', 'links', 'journal', 'milestone'] as const;
type Type = (typeof types)[number];

const titles: Record<Type, string> = {
  overview: '프로젝트 개요',
  board: '작업 보드',
  deploy: '운영',
  links: '바로가기',
  journal: '개발 일지',
  milestone: '마일스톤',
};

const size: Record<Type, 'small' | 'medium' | 'wide'> = {
  overview: 'wide',
  board: 'wide',
  deploy: 'medium',
  links: 'small',
  journal: 'medium',
  milestone: 'medium',
};

export const identity = {
  id: id(101),
  displayName: 'Alice',
  workspace: { id: id(102), name: 'Workspace', revision: 1 },
};

export const snapshot = (type: Type, n: number, overrides: Record<string, unknown> = {}) => ({
  id: id(100 + n),
  type,
  title: titles[type],
  configVersion: 1,
  revision: 1,
  config: { selection: { kind: 'all' } },
  referenceState: 'valid',
  createdAt: '2026-09-17T00:00:00Z',
  updatedAt: '2026-09-17T00:00:00Z',
  ...overrides,
});

export const defaultSnapshots = () => types.map((type, index) => snapshot(type, index + 1));

export const catalog = types.map((type) => ({
  type,
  configVersion: 1,
  configSchema: {},
  supportedSizes: ['small', 'medium', 'wide'],
  dataKind: type,
  availability: type === 'deploy' ? 'unavailable' : 'ready',
}));

function initializedHome(widgets = defaultSnapshots(), layoutRevision = 1) {
  return {
    id: 'home',
    schemaVersion: 3,
    initialized: true,
    layoutRevision,
    placements: widgets.map((widget, index) => ({
      id: id(200 + index),
      widgetId: widget.id,
      size: size[widget.type as Type],
    })),
    widgets,
  };
}

const emptyHome = () => ({
  id: 'home',
  schemaVersion: 3,
  initialized: false,
  layoutRevision: 0,
  placements: [],
  widgets: [],
});

function taskSnapshot(status: 'todo' | 'doing' | 'done' = 'todo', revision = 1) {
  return {
    id: id(300),
    revision,
    createdAt: '2026-09-17T00:00:00Z',
    updatedAt: '2026-09-17T00:00:00Z',
    title: '서버 Widget 연결',
    projectId: id(1),
    projectName: 'Project 1',
    categoryId: null,
    description: '',
    status,
    priority: 'high',
    tag: 'dashboard',
    deletedAt: null,
  };
}

function projectSnapshot() {
  return {
    id: id(1),
    revision: 1,
    createdAt: '2026-09-17T00:00:00Z',
    updatedAt: '2026-09-17T00:00:00Z',
    categoryId: null,
    name: 'Project 1',
    subtitle: 'Widget project',
    stack: 'React · TypeScript',
    progress: 60,
    currentMilestone: 'Dashboard',
    repositoryUrl: 'https://example.com/project-1',
    status: 'active',
  };
}

function dataEnvelope(widget: Record<string, any>, boardTask = taskSnapshot()) {
  const type = widget.type as Type;
  if (type === 'deploy')
    return {
      widgetId: widget.id,
      type,
      configRevision: widget.revision,
      configVersion: widget.configVersion,
      payloadVersion: 1,
      availability: 'unavailable',
      freshness: 'unknown',
      readAt: '2026-09-17T00:01:00Z',
      sourceObservedAt: null,
      lastSuccessfulSyncAt: null,
      data: null,
      page: null,
      problem: { code: 'NOT_CONFIGURED', retryable: false },
    };
  const common = {
    widgetId: widget.id,
    type,
    configRevision: widget.revision,
    configVersion: widget.configVersion,
    payloadVersion: 1,
    availability: 'ready',
    freshness: 'current',
    readAt: '2026-09-17T00:01:00Z',
    sourceObservedAt: '2026-09-17T00:00:00Z',
    lastSuccessfulSyncAt: '2026-09-17T00:00:00Z',
    page: ['board', 'journal', 'milestone'].includes(type) ? { total: 1, nextCursor: null } : null,
    problem: null,
  };
  const data =
    type === 'overview'
      ? { kind: type, projects: [{ active: 2, archived: 1 }], tasks: { doing: 1, done: 2 } }
      : type === 'board'
        ? {
            kind: type,
            columns: [
              {
                status: 'todo',
                items: [boardTask],
              },
              { status: 'doing', items: [] },
              { status: 'done', items: [] },
            ],
            statistics: { todo: 1, doing: 0, done: 0, total: 1 },
          }
        : type === 'links'
          ? { kind: type, items: [{ id: id(400), label: '문서', description: '', url: '/docs' }] }
          : type === 'journal'
            ? {
                kind: type,
                items: [
                  {
                    id: id(500),
                    title: 'Widget 전환 기록',
                    body: '서버 데이터 확인',
                    projectName: 'Project 1',
                    entryDate: '2026-09-17',
                  },
                ],
              }
            : {
                kind: type,
                items: [
                  {
                    id: id(600),
                    title: 'Dashboard v3',
                    projectName: 'Project 1',
                    projectId: id(1),
                    completed: false,
                    dueDate: '2026-09-30',
                  },
                ],
              };
  return { ...common, data };
}

export async function setup(page: Page, options: { initialized?: boolean } = {}) {
  let home = options.initialized === false ? emptyHome() : initializedHome();
  const writes: { path: string; method: string; body?: Record<string, any> }[] = [];
  let layoutRevision = home.layoutRevision;
  let widgets = [...home.widgets];
  let boardTask = taskSnapshot();
  const homeJson = () => ({
    ...home,
    layoutRevision,
    widgets,
    placements: home.placements,
  });
  const fulfill = (
    route: Parameters<Parameters<Page['route']>[1]>[0],
    json: unknown,
    status = 200,
  ) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(json) });

  await page.route('**/api/v3/dashboards/home/initializations', async (route) => {
    writes.push({
      path: '/api/v3/dashboards/home/initializations',
      method: 'POST',
      body: route.request().postDataJSON(),
    });
    widgets = defaultSnapshots();
    layoutRevision = 1;
    home = initializedHome(widgets, layoutRevision);
    await fulfill(route, homeJson(), 201);
  });
  await page.route('**/api/v3/dashboards/home', async (route) => {
    const method = route.request().method();
    if (method === 'GET') return fulfill(route, homeJson());
    const body = route.request().postDataJSON() as {
      placements: { widgetId: string; size: string }[];
    };
    writes.push({ path: '/api/v3/dashboards/home', method, body });
    layoutRevision++;
    const byId = new Map(widgets.map((widget) => [widget.id, widget]));
    home = {
      id: 'home',
      schemaVersion: 3,
      initialized: true,
      layoutRevision,
      placements: body.placements.map((placement, index) => ({
        id: id(700 + index),
        widgetId: placement.widgetId,
        size: placement.size,
      })),
      widgets,
    };
    home.placements = home.placements.filter((placement) => byId.has(placement.widgetId));
    await fulfill(route, homeJson());
  });
  await page.route('**/api/v1/widget-types', (route) => fulfill(route, catalog));
  await page.route('**/api/v1/widgets?unplaced=true&limit=100', (route) =>
    fulfill(route, { items: [], nextCursor: null }),
  );
  await page.route('**/api/v1/widgets/*/data*', (route) => {
    const widgetId = new URL(route.request().url()).pathname.split('/')[4];
    const widget = widgets.find((item) => item.id === widgetId);
    return fulfill(
      route,
      widget ? dataEnvelope(widget, boardTask) : { message: 'not found' },
      widget ? 200 : 404,
    );
  });
  await page.route('**/api/v1/widgets/*', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const widgetId = path.split('/').at(-1)!;
    const body = route.request().postDataJSON() as Record<string, any>;
    writes.push({ path, method: route.request().method(), body });
    if (route.request().method() === 'PUT') {
      const current = widgets.find((widget) => widget.id === widgetId);
      if (current) Object.assign(current, { title: body.title, revision: current.revision + 1 });
      return fulfill(route, current ?? snapshot('overview', 900));
    }
    return fulfill(route, { message: 'not found' }, 404);
  });
  await page.route('**/api/v1/me', (route) => fulfill(route, identity));
  await page.route('**/api/v1/project-categories', (route) =>
    fulfill(route, { items: [], total: 0 }),
  );
  await page.route('**/api/v1/auth/csrf', (route) => fulfill(route, { csrfToken: 'test-token' }));
  await page.route('**/api/v2/overview?*', (route) =>
    fulfill(route, {
      category: 'all',
      projectId: null,
      projects: { total: 2, archived: 1, byCategory: [] },
      tasks: { todo: 0, doing: 0, done: 0, total: 0 },
      asOf: '2026-09-17T00:00:00Z',
    }),
  );
  await page.route('**/api/v2/projects?*', (route) =>
    fulfill(route, { items: [projectSnapshot()], total: 1, nextCursor: null }),
  );
  await page.route('**/api/v2/projects/*', (route) => fulfill(route, projectSnapshot()));
  await page.route('**/api/v2/projects/category-counts', (route) =>
    fulfill(route, { items: [], totals: { active: 0, archived: 0 } }),
  );
  await page.route('**/api/v2/tasks?*', (route) =>
    fulfill(route, { items: [], total: 0, nextCursor: null }),
  );
  await page.route('**/api/v2/tasks/*', async (route) => {
    const method = route.request().method();
    if (method === 'PATCH') {
      const body = route.request().postDataJSON() as {
        revision: number;
        status: 'todo' | 'doing' | 'done';
      };
      writes.push({ path: '/api/v2/tasks/' + id(300), method, body });
      boardTask = { ...boardTask, status: body.status, revision: boardTask.revision + 1 };
      return fulfill(route, boardTask);
    }
    return fulfill(route, boardTask);
  });
  await page.route('**/api/v2/tasks/stats?*', (route) =>
    fulfill(route, {
      counts: { todo: 0, doing: 0, done: 0 },
      total: 0,
      asOf: '2026-09-17T00:00:00Z',
    }),
  );
  await page.route('**/api/v2/links?*', (route) =>
    fulfill(route, { items: [], total: 0, nextCursor: null, collectionRevision: 0 }),
  );
  await page.route('**/api/v2/milestones?*', (route) =>
    fulfill(route, { items: [], total: 0, nextCursor: null }),
  );
  await page.route('**/api/v2/journals?*', (route) =>
    fulfill(route, { items: [], total: 0, nextCursor: null }),
  );

  return { writes, getHome: () => homeJson() };
}

export const test = base.extend<{ isolation: void }>({
  isolation: [
    async ({ context, page }, use) => {
      const excluded: string[] = [];
      const errors: string[] = [];
      const sentinels = ['projects', 'tasks', 'journals', 'milestones', 'links'].map(
        (name) => ['devspace.' + name + '.v1', '{preserve-' + name] as const,
      );
      page.on('pageerror', (error) => errors.push(error.message));
      context.on('request', (request) => {
        const pathname = new URL(request.url()).pathname;
        if (
          pathname.startsWith('/api/') &&
          !/^\/api\/(?:v1\/(?:me$|auth\/|project-categories(?:\/|$)|widget-types$|widgets(?:\/|$))|v2\/(?:projects(?:\/|$)|tasks(?:\/|$)|journals(?:\/|$)|milestones(?:\/|$)|links(?:\/|$)|overview$)|v3\/dashboards\/home(?:\/|$))/.test(
            pathname,
          )
        )
          excluded.push(pathname);
      });
      await context.addInitScript((values) => {
        if (location.origin !== 'http://127.0.0.1:4183') return;
        for (const [key, value] of values)
          if (!Object.hasOwn(localStorage, key)) localStorage.setItem(key, value);
        for (const key of ['getItem', 'setItem', 'removeItem', 'clear'] as const)
          Storage.prototype[key] = () => {
            throw new Error('Business storage access');
          };
      }, sentinels);
      await use();
      expect(excluded).toEqual([]);
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
