import { describe, expect, it } from 'vitest';
import { createIntent, retryBody } from './apiIntent';

const draft = {
  title: 'Retry me',
  projectId: '00000000-0000-0000-0000-000000000001',
  body: 'line one\nline two  ',
  entryDate: '2026-09-13',
};

describe('Journal creation intent', () => {
  it('freezes one key and exact body for the bounded replay window', () => {
    const intent = createIntent(draft, 1_000);
    expect(Object.isFrozen(intent)).toBe(true);
    expect(Object.isFrozen(intent.body)).toBe(true);
    expect(retryBody(intent, 1_000)).toBe(intent.body);
    expect(retryBody(intent, 1_000 + 86_400_000 - 1)).toBe(intent.body);
    expect(() => retryBody(intent, 1_000 + 86_400_000)).toThrow();
    expect(intent.body).toEqual(draft);
  });

  it('does not allow replay before the intent was created', () => {
    const intent = createIntent(draft, 5_000);
    expect(() => retryBody(intent, 4_999)).toThrow();
  });
});
