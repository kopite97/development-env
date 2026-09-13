import { expect, it } from 'vitest';
import { createIntent, retryBody } from './createIntent';
import { projectDraft } from './apiModel';
it('freezes the precise creation request and retains its key across retries, with a bounded replay window', () => {
  const draft = { ...projectDraft(), name: ' Raw name ', stack: 'C#' };
  const intent = createIntent(draft, 100);
  draft.name = 'Changed';
  expect(retryBody(intent, 101).name).toBe(' Raw name ');
  expect(Object.isFrozen(intent.body)).toBe(true);
  expect(retryBody(intent, 200)).toBe(intent.body);
  expect(() => retryBody(intent, 100 + 86400000)).toThrow('expired');
  expect(() => retryBody(intent, 99)).toThrow('expired');
});
