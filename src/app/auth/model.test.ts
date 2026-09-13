import { expect, it } from 'vitest';
import { parseIdentity } from './model';
const identity = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'A',
  workspace: { id: '22222222-2222-4222-8222-222222222222', name: 'Workspace', revision: 1 },
};
it('narrows only server identity fields', () => {
  expect(parseIdentity({ ...identity, email: 'not-in-contract' })).toEqual(identity);
});
it.each([
  null,
  {},
  { ...identity, id: 'bad' },
  { ...identity, workspace: { ...identity.workspace, revision: 0 } },
  { ...identity, workspace: { ...identity.workspace, revision: 1.5 } },
])('rejects malformed identity %#', (value) => {
  expect(() => parseIdentity(value)).toThrow();
});
