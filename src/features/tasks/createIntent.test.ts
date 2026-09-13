import { expect, it } from 'vitest';
import { createIntent, retryBody } from './createIntent';
import { taskDraft } from './apiModel';
it('freezes exact creation fields and key for an explicit retry within 24 hours', () => {
  const draft = {
    ...taskDraft(),
    title: ' Task ',
    projectId: '00000000-0000-0000-0000-000000000001',
  };
  const intent = createIntent(draft, 1000);
  draft.title = 'Changed';
  expect(retryBody(intent, 2000)).toEqual({
    title: 'Task',
    projectId: draft.projectId,
    status: 'todo',
    priority: 'normal',
    description: '',
    tag: '',
  });
  expect(Object.isFrozen(intent)).toBe(true);
  expect(Object.isFrozen(intent.body)).toBe(true);
  expect(() => retryBody(intent, 1000 + 86400000)).toThrow();
  expect(() => retryBody(intent, 999)).toThrow();
});
