import { describe, it, expect } from 'vitest';
import { parseDashboard, parseWidgets, saveBody, serverDefaultWidgets } from './apiModel';
const widget = () => ({ id: 'a', type: 'overview', title: '제목', scope: 'all', size: 'small' });
describe('Dashboard contract boundary', () => {
  it('accepts virtual and saved empty dashboards without replacing them', () => {
    for (const revision of [0, 2, Number.MAX_SAFE_INTEGER])
      expect(
        parseDashboard({ id: 'home', schemaVersion: 1, revision, widgets: [] }).widgets,
      ).toEqual([]);
  });
  it('normalizes Java trim, canonical UUID and project scope without inventing a limit', () => {
    const widgets = parseWidgets([
      {
        ...widget(),
        id: ' a ',
        title: ' 제목 ',
        scope: 'unity',
        projectId: 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA',
      },
    ]);
    expect(saveBody(0, widgets)).toEqual({
      schemaVersion: 1,
      revision: 0,
      widgets: [{ ...widget(), projectId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }],
    });
  });
  it('keeps repeated types and has no invented count or ID length cap', () => {
    expect(
      parseWidgets(
        Array.from({ length: 101 }, (_, n) => ({ ...widget(), id: 'x'.repeat(1000) + n })),
      ),
    ).toHaveLength(101);
  });
  it('enforces supported schema, exact fields, safe revisions, optional omission and discriminants', () => {
    const base = { id: 'home', schemaVersion: 1, revision: 0, widgets: [widget()] };
    for (const patch of [
      { id: 'other' },
      { schemaVersion: 2 },
      { revision: -1 },
      { revision: 1.5 },
      { revision: Number.MAX_SAFE_INTEGER + 1 },
      { createdAt: '2026-09-14' },
    ])
      expect(() => parseDashboard({ ...base, ...patch })).toThrow();
    for (const patch of [
      { projectId: null },
      { limit: null },
      { limit: 0 },
      { limit: 21 },
      { type: 'unknown' },
      { status: 'open' },
      { size: 'large' },
      { title: 'a'.repeat(49) },
      { id: '　' },
      { title: '　' },
      { type: 'links', limit: 1 },
      { type: 'deploy', projectId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
    ])
      expect(() => parseWidgets([{ ...widget(), ...patch }])).toThrow();
    expect(() => parseWidgets([widget(), { ...widget(), id: ' a ' }])).toThrow();
    expect(() =>
      parseDashboard({
        ...base,
        widgets: [
          { ...widget(), projectId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', scope: 'unity' },
        ],
      }),
    ).toThrow();
  });
  it('owns one reset template with the exact schema-1 fields and fresh draft copies', () => {
    expect(
      serverDefaultWidgets().map((w) => [
        w.id,
        w.type,
        w.title,
        w.scope,
        w.size,
        Object.keys(w).length,
      ]),
    ).toEqual([
      ['home-overview', 'overview', '프로젝트 개요', 'all', 'wide', 5],
      ['home-board', 'board', '작업 보드', 'all', 'wide', 5],
      ['home-deploy', 'deploy', '운영', 'all', 'medium', 5],
      ['home-links', 'links', '바로가기', 'all', 'small', 5],
      ['home-journal', 'journal', '개발 일지', 'all', 'medium', 5],
      ['home-milestone', 'milestone', '마일스톤', 'all', 'medium', 5],
    ]);
    const copy = serverDefaultWidgets();
    copy[0].title = 'changed';
    expect(serverDefaultWidgets()[0].title).toBe('프로젝트 개요');
  });
});
