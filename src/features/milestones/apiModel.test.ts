import { describe, it, expect } from 'vitest';
import {
  milestoneDate,
  parseMilestone,
  parseMilestonePage,
  parseDeletedMilestone,
  createBody,
  patchBody,
  milestoneDraft,
} from './apiModel';
import { createIntent, retryBody } from './apiIntent';
export const id = '00000000-0000-0000-0000-000000000010';
export const dto = (changes: Record<string, unknown> = {}) => ({
  id,
  revision: 1,
  createdAt: '2026-09-13T00:00:00Z',
  updatedAt: '2026-09-13T00:00:00Z',
  title: '목표',
  projectId: '00000000-0000-0000-0000-000000000001',
  projectName: '프로젝트',
  scope: 'unity',
  dueDate: null,
  completed: false,
  ...changes,
});
describe('Milestone API boundary', () => {
  it('validates calendar arithmetic without timezone or noon conversion', () => {
    for (const x of ['0001-01-01', '2000-02-29', '2024-02-29', '9999-12-31'])
      expect(milestoneDate(x)).toBe(x);
    for (const x of [
      '',
      '0000-01-01',
      '1900-02-29',
      '2023-02-29',
      '2024-04-31',
      '2024-1-01',
      '2024-01-01T00:00:00Z',
    ])
      expect(() => milestoneDate(x)).toThrow();
  });
  it('rejects fabricated or malformed fields and duplicate pages', () => {
    for (const x of [
      { id: 'fixture' },
      { revision: 0 },
      { revision: 9007199254740992 },
      { completed: 'done' },
      { dueDate: '' },
      { scope: 'all' },
      { createdAt: 'today' },
      { title: ' ' },
    ])
      expect(() => parseMilestone(dto(x))).toThrow();
    expect(() =>
      parseMilestonePage({ items: [dto(), dto()], total: 2, nextCursor: null }),
    ).toThrow();
    expect(() => parseDeletedMilestone({ id })).toThrow();
  });
  it('maps null to blank input and sends only intended fields with server revision', () => {
    const base = parseMilestone(dto());
    const draft = milestoneDraft(base);
    expect(draft.dueDate).toBe('');
    expect(createBody(draft)).toEqual({
      title: '목표',
      projectId: base.projectId,
      dueDate: null,
      completed: false,
    });
    expect(patchBody(base, { ...draft, completed: true })).toEqual({
      revision: 1,
      completed: true,
    });
    const dated = parseMilestone(dto({ dueDate: '2024-02-29' }));
    expect(patchBody(dated, { ...milestoneDraft(dated), dueDate: '' })).toEqual({
      revision: 1,
      dueDate: null,
    });
  });
  it('freezes exact explicit field presence and rejects expired replay', () => {
    const draft = milestoneDraft(parseMilestone(dto()));
    const intent = createIntent(draft, 1000);
    draft.title = 'Changed';
    expect(retryBody(intent, 2000)).toEqual({
      title: '목표',
      projectId: draft.projectId,
      dueDate: null,
      completed: false,
    });
    expect(Object.isFrozen(intent.body)).toBe(true);
    expect(() => retryBody(intent, 86401000)).toThrow();
    expect(intent.key).toBeTruthy();
  });
});
