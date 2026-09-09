import { describe, expect, it } from 'vitest';
import { defaultLayout, isLayout, moveWidget } from './model';
describe('persisted dashboard layout', () => {
  it('accepts defaults and an intentionally empty dashboard', () => {
    expect(isLayout(defaultLayout)).toBe(true);
    expect(isLayout([])).toBe(true);
  });
  it('rejects corrupt, duplicate and unsupported persisted widgets', () => {
    expect(isLayout(null)).toBe(false);
    expect(isLayout([{ ...defaultLayout[0], type: 'unknown' }])).toBe(false);
    expect(isLayout([defaultLayout[0], defaultLayout[0]])).toBe(false);
    expect(isLayout([{ ...defaultLayout[0], scope: 'invalid' }])).toBe(false);
  });
  it('moves a widget without mutating saved layout, allowing cancellation', () => {
    const original = [...defaultLayout];
    const moved = moveWidget(original, 'overview', 'board');
    expect(moved.map((w) => w.id).slice(0, 3)).toEqual(['deploy', 'board', 'overview']);
    expect(original).toEqual(defaultLayout);
  });
  it('ignores stale drag targets safely', () => {
    expect(moveWidget(defaultLayout, 'missing', 'overview')).toBe(defaultLayout);
  });
});
