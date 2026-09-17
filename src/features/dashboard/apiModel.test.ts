import { describe, expect, it } from 'vitest';
import {
  createWidgetBody,
  parseDashboard,
  parseWidgets,
  saveBody,
  serverDefaultWidgets,
  updateWidgetBody,
  writableWidgets,
} from './apiModel';

const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const id2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const snapshot = (widgetId = id, type = 'overview', selection = { kind: 'all' }) => ({
  id: widgetId,
  type,
  title: '제목',
  configVersion: 1,
  revision: 1,
  config: { selection },
  referenceState: 'valid',
  createdAt: '2026-09-17T00:00:00Z',
  updatedAt: '2026-09-17T00:00:00Z',
});

describe('Dashboard v3 and Widget v1 contract boundary', () => {
  it('parses an uninitialized Dashboard without inventing defaults', () => {
    expect(
      parseDashboard({
        id: 'home',
        schemaVersion: 3,
        initialized: false,
        layoutRevision: 0,
        placements: [],
        widgets: [],
      }),
    ).toMatchObject({ initialized: false, layoutRevision: 0, widgets: [] });
  });

  it('joins placement size/order with independent Widget snapshots', () => {
    const dashboard = parseDashboard({
      id: 'home',
      schemaVersion: 3,
      initialized: true,
      layoutRevision: 4,
      placements: [
        { id: id2, widgetId: id2, size: 'wide' },
        { id, widgetId: id, size: 'small' },
      ],
      widgets: [snapshot(id), snapshot(id2, 'board')],
    });
    expect(dashboard.widgets.map((widget) => [widget.id, widget.size])).toEqual([
      [id2, 'wide'],
      [id, 'small'],
    ]);
  });

  it('builds separate Widget configuration and Dashboard placement bodies', () => {
    const [widget] = parseWidgets([
      {
        id,
        type: 'board',
        title: ' 제목 ',
        size: 'wide',
        selection: { kind: 'project', projectId: id },
        limit: 10,
      },
    ]);
    expect(createWidgetBody(widget)).toEqual({
      type: 'board',
      title: '제목',
      configVersion: 1,
      config: { selection: { kind: 'project', projectId: id }, limit: 10 },
    });
    expect(updateWidgetBody({ ...widget, revision: 3 })).toMatchObject({ revision: 3 });
    expect(saveBody(4, [widget])).toEqual({
      schemaVersion: 3,
      layoutRevision: 4,
      placements: [{ widgetId: id, size: 'wide' }],
    });
  });

  it('rejects invalid references, versions, duplicate placements and unavailable config', () => {
    const base = {
      id: 'home',
      schemaVersion: 3,
      initialized: true,
      layoutRevision: 1,
      placements: [{ id, widgetId: id, size: 'medium' }],
      widgets: [snapshot()],
    };
    expect(() => parseDashboard({ ...base, schemaVersion: 2 })).toThrow();
    expect(() =>
      parseDashboard({ ...base, placements: [{ id, widgetId: id2, size: 'medium' }] }),
    ).toThrow();
    expect(() =>
      parseDashboard({
        ...base,
        widgets: [snapshot(id, 'deploy', { kind: 'project', projectId: id } as never)],
      }),
    ).toThrow();
    expect(() =>
      parseWidgets([
        { id, type: 'links', title: '링크', size: 'small', selection: { kind: 'all' }, limit: 1 },
      ]),
    ).toThrow();
  });

  it('keeps the explicit six-widget template local and copyable', () => {
    const widgets = serverDefaultWidgets();
    expect(widgets).toHaveLength(6);
    expect(widgets.every((widget) => widget.revision === undefined)).toBe(true);
    widgets[0].title = '변경';
    expect(serverDefaultWidgets()[0].title).toBe('프로젝트 개요');
  });

  it('strips server-owned Widget metadata before comparing or validating drafts', () => {
    const [widget] = parseWidgets([
      { id, type: 'overview', title: '제목', size: 'medium', selection: { kind: 'all' } },
    ]);
    const server = {
      ...widget,
      revision: 3,
      configVersion: 1,
      referenceState: 'valid' as const,
      createdAt: '2026-09-17T00:00:00Z',
      updatedAt: '2026-09-17T00:00:00Z',
    };
    expect(writableWidgets([server])).toEqual([
      { id, type: 'overview', title: '제목', size: 'medium', selection: { kind: 'all' } },
    ]);
  });
});
