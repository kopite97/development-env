import { describe, expect, it } from 'vitest';
import {
  parseCategoryFilter,
  parseSelection,
  readCategoryFilter,
  selectionFilter,
} from './categoryFilter';

const id = 'a0000000-0000-4000-8000-000000000001';
describe('Category-only selection boundary', () => {
  it('uses UUID identity with canonical cache/query casing, not names', () => {
    expect(parseCategoryFilter(id.toUpperCase())).toBe(id);
    expect(() => parseCategoryFilter('Unity')).toThrow();
    expect(() => parseCategoryFilter('server')).toThrow();
  });
  it('keeps all, uncategorized, category and Project distinct', () => {
    expect(selectionFilter(parseSelection({ kind: 'category', categoryId: id }))).toEqual({
      category: id,
    });
    expect(selectionFilter(parseSelection({ kind: 'project', projectId: id }))).toEqual({
      category: 'all',
      projectId: id,
    });
    expect(selectionFilter(parseSelection({ kind: 'uncategorized' }))).toEqual({
      category: 'uncategorized',
    });
  });
  it.each([
    { kind: 'all', categoryId: null },
    { kind: 'project', projectId: id, categoryId: id },
    { kind: 'category', categoryId: null },
    { kind: 'unity' },
  ])('rejects mixed or obsolete selection %j', (value) => {
    expect(() => parseSelection(value)).toThrow();
  });
  it('does not silently broaden invalid, repeated or obsolete URL filters', () => {
    for (const query of [
      'category=',
      'category=all&category=uncategorized',
      'scope=unity',
      'scope=server',
      'scope=all&category=all',
    ])
      expect(() => readCategoryFilter(new URLSearchParams(query))).toThrow();
    expect(readCategoryFilter(new URLSearchParams())).toBe('all');
    expect(readCategoryFilter(new URLSearchParams('scope=all'))).toBe('all');
  });
});
