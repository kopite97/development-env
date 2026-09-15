import { expect, it } from 'vitest';
import {
  categoryIntent,
  categoryNameError,
  categoryRetry,
  parseCategories,
  parseCategory,
} from './categoryModel';
const row = {
  id: '00000000-0000-0000-0000-000000000001',
  name: '개발',
  revision: 1,
  createdAt: '2026-09-14T00:00:00Z',
  updatedAt: '2026-09-14T00:00:00Z',
};
it('validates UUID/revisions and full collections without a client cap', () => {
  expect(parseCategory(row)).toEqual(row);
  for (const patch of [{ id: 'unity' }, { revision: 0 }, { revision: 2 ** 53 }, { name: '' }])
    expect(() => parseCategory({ ...row, ...patch })).toThrow();
  expect(() => parseCategories({ items: [row], total: 2 })).toThrow();
  expect(() => parseCategories({ items: [row, row], total: 2 })).toThrow();
});
it('uses Java trim and NFC validation while freezing raw name intent', () => {
  expect(categoryNameError(' '.repeat(10))).not.toBe('');
  expect(categoryNameError('\u00a0')).toBe('');
  expect(categoryNameError('e\u0301'.repeat(100))).toBe('');
  const intent = categoryIntent('  e\u0301  ', 100);
  expect(categoryRetry(intent, 101)).toBe(intent.body);
  expect(intent.body.name).toBe('  e\u0301  ');
  expect(Object.isFrozen(intent.body)).toBe(true);
  expect(() => categoryRetry(intent, 99)).toThrow();
  expect(() => categoryRetry(intent, 86400100)).toThrow();
});
