import { expect, it } from 'vitest';
import { homeProjectId, homeWidget } from './homeProject';
import type { Widget } from './apiModel';

const a = 'aaaaaaaa-0000-0000-0000-000000000001';
const b = 'bbbbbbbb-0000-0000-0000-000000000002';
it('canonicalizes Project UUIDs without accepting names', () => {
  expect(homeProjectId(a.toUpperCase())).toBe(a);
  expect(homeProjectId(null)).toBeUndefined();
  expect(() => homeProjectId('Project A')).toThrow();
});
it.each(['overview', 'board', 'journal', 'milestone', 'links'] as const)(
  '%s uses transient selection without persisting it',
  (type) => {
    const widget: Widget = Object.freeze({
      id: 'test',
      type,
      title: 'Test',
      size: 'wide',
      selection: { kind: 'project' as const, projectId: b },
    });
    expect(homeWidget(widget)).toBe(widget);
    expect(homeWidget(widget, a).selection).toEqual({ kind: 'project', projectId: a });
    expect(homeWidget(widget, undefined, 'all').selection).toEqual({ kind: 'all' });
    expect(homeWidget(widget, undefined, 'uncategorized').selection).toEqual({
      kind: 'uncategorized',
    });
    expect(homeWidget(widget, undefined, a).selection).toEqual({ kind: 'category', categoryId: a });
    expect(homeWidget(widget, a, b).selection).toEqual({ kind: 'project', projectId: a });
    expect(widget.selection).toEqual({ kind: 'project', projectId: b });
  },
);
it('keeps Deploy unfiltered and never repairs a missing saved Category', () => {
  const deploy: Widget = {
    id: 'deploy',
    type: 'deploy',
    title: 'Deploy',
    size: 'small',
    selection: { kind: 'all' },
  };
  expect(homeWidget(deploy, a, b)).toBe(deploy);
  const missing: Widget = {
    ...deploy,
    type: 'links',
    selection: { kind: 'category', categoryId: a },
    selectionState: 'missingCategory',
  };
  expect(homeWidget(missing)).toBe(missing);
  expect(homeWidget(missing, undefined, 'all').selectionState).toBe('valid');
  expect(missing.selectionState).toBe('missingCategory');
});
