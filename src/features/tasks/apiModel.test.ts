import { describe, expect, it } from 'vitest';
import {
  createBody,
  parseTask,
  parseTaskPage,
  parseTaskStats,
  patchBody,
  taskDraft,
  taskPresentation,
  validateDraft,
} from './apiModel';

const response = {
  id: '10000000-0000-0000-0000-000000000001',
  revision: 1,
  createdAt: '2026-09-13T00:00:00Z',
  updatedAt: '2026-09-13T00:00:00Z',
  title: 'Task',
  projectId: '20000000-0000-0000-0000-000000000001',
  projectName: 'Project',
  categoryId: null,
  description: '',
  status: 'todo',
  priority: 'normal',
  tag: '',
  deletedAt: null,
};
describe('Task API boundary', () => {
  it('requires every DTO field without legacy fallback', () => {
    for (const key of Object.keys(response)) {
      const missing: Record<string, unknown> = { ...response };
      delete missing[key];
      expect(() => parseTask(missing), key).toThrow();
    }
    for (const change of [
      { id: 'fixture' },
      { projectId: 'forest' },
      { revision: 0 },
      { revision: Number.MAX_SAFE_INTEGER + 1 },
      { priority: '보통' },
      { status: 'all' },
      { deletedAt: 'yesterday' },
      { categoryId: 'all' },
    ])
      expect(() => parseTask({ ...response, ...change })).toThrow();
  });
  it('maps priorities and excludes all server-owned data from writes', () => {
    for (const priority of ['normal', 'high'] as const) {
      const task = parseTask({ ...response, priority });
      expect(taskPresentation(task).priority).toBe(priority === 'high' ? '높음' : '보통');
      expect(createBody(taskDraft(task))).toEqual({
        title: 'Task',
        projectId: response.projectId,
        description: '',
        status: 'todo',
        priority,
        tag: '',
      });
      expect(patchBody(task, taskDraft(task))).toEqual({ revision: 1 });
      expect(patchBody(task, { ...taskDraft(task), status: 'done' })).toEqual({
        revision: 1,
        status: 'done',
      });
    }
  });
  it('trims only title/tag and measures UTF-16 limits', () => {
    const draft = {
      ...taskDraft(parseTask(response)),
      title: '  title  ',
      tag: ' tag ',
      description: ' \n ',
    };
    expect(createBody(draft)).toMatchObject({ title: 'title', tag: 'tag', description: ' \n ' });
    expect(validateDraft({ ...draft, title: '😀'.repeat(80) })).toEqual({});
    expect(validateDraft({ ...draft, title: '😀'.repeat(81) })).toHaveProperty('title');
    expect(validateDraft({ ...draft, tag: 'x'.repeat(41) })).toHaveProperty('tag');
    expect(validateDraft({ ...draft, description: 'x'.repeat(10001) })).toHaveProperty(
      'description',
    );
    expect(() => createBody({ ...draft, title: ' ' })).toThrow();
  });
  it('validates cursor pages and independent complete stats', () => {
    expect(parseTaskPage({ items: [response], total: 100, nextCursor: 'opaque' }).total).toBe(100);
    expect(() => parseTaskPage({ items: [], total: 0, nextCursor: '' })).toThrow();
    expect(() =>
      parseTaskStats({ counts: { todo: 0, doing: 0 }, total: 0, asOf: response.createdAt }),
    ).toThrow();
    expect(
      parseTaskStats({
        counts: { todo: 50, doing: 30, done: 20 },
        total: 100,
        asOf: response.createdAt,
      }).total,
    ).toBe(100);
    expect(() =>
      parseTaskStats({
        counts: { todo: 1, doing: 0, done: 0 },
        total: 0,
        asOf: response.createdAt,
      }),
    ).toThrow();
  });
});
