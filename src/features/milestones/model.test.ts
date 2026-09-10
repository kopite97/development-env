import { describe, expect, it } from 'vitest';
import { initialProjects } from '../projects/fixtures';
import { isDueDate, isMilestones, legacyMilestones, sortMilestones } from './model';

describe('milestone storage and deadlines', () => {
  it('imports existing goals with stable ids and no invented deadline', () => {
    const imported = legacyMilestones(initialProjects);
    expect(imported).toHaveLength(4);
    expect(imported[0]).toEqual({
      id: 'legacy-forest',
      projectId: 'forest',
      title: '플레이 가능한 데모',
      dueDate: '',
      completed: false,
    });
    expect(isMilestones(imported)).toBe(true);
    expect(legacyMilestones([{ ...initialProjects[0], milestone: ' ' }])).toEqual([]);
  });
  it('validates real calendar dates, completion, ids and an intentionally empty list', () => {
    expect(isDueDate('2028-02-29')).toBe(true);
    expect(isDueDate('2026-02-29')).toBe(false);
    expect(isDueDate('2026-13-01')).toBe(false);
    expect(isDueDate('2026-9-1')).toBe(false);
    expect(isDueDate('')).toBe(true);
    expect(isMilestones([])).toBe(true);
    const item = legacyMilestones(initialProjects)[0];
    expect(isMilestones([item, item])).toBe(false);
    expect(isMilestones([{ ...item, completed: 'yes' }])).toBe(false);
    expect(isMilestones([{ ...item, title: ' ' }])).toBe(false);
  });
  it('sorts pending goals by deadline before undated and completed goals without mutation', () => {
    const item = legacyMilestones(initialProjects)[0];
    const items = [
      { ...item, id: 'undated' },
      { ...item, id: 'later', dueDate: '2026-09-30' },
      { ...item, id: 'done', dueDate: '2026-09-01', completed: true },
      { ...item, id: 'early', dueDate: '2026-09-10' },
    ];
    expect(sortMilestones(items).map((m) => m.id)).toEqual(['early', 'later', 'undated', 'done']);
    expect(items[0].id).toBe('undated');
  });
});
