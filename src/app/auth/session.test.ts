import { expect, it, vi } from 'vitest';
import { AuthSession } from './session';
export const alice = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Alice',
  workspace: { id: '22222222-2222-4222-8222-222222222222', name: 'Alice workspace', revision: 1 },
};
export const bob = {
  id: '33333333-3333-4333-8333-333333333333',
  displayName: 'Bob',
  workspace: { id: '44444444-4444-4444-8444-444444444444', name: 'Bob workspace', revision: 7 },
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
it('deduplicates overlapping Task and Project security recovery and bounds repeated attempts', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async (input) =>
      String(input).endsWith('/auth/csrf') ? json({ csrfToken: 'fresh' }) : json(alice),
    );
  const session = new AuthSession(fetcher);
  await session.verify();
  const task = session.recoverMutationSecurity(),
    project = session.recoverProjectSecurity();
  expect(task).toBe(project);
  await Promise.all([task, project]);
  expect(fetcher.mock.calls.filter(([input]) => String(input).endsWith('/me'))).toHaveLength(2);
  expect(fetcher.mock.calls.filter(([input]) => String(input).endsWith('/auth/csrf'))).toHaveLength(
    1,
  );
  await expect(session.recoverMutationSecurity()).rejects.toThrow('security failed again');
});

it.each([
  [200, alice, 'authenticated'],
  [401, {}, 'unauthenticated'],
  [403, { code: 'ACCOUNT_DISABLED' }, 'disabled'],
  [403, {}, 'bootstrap-error'],
  [503, {}, 'bootstrap-error'],
  [200, {}, 'bootstrap-error'],
] as const)('bootstrap status %s yields %s', async (status, body, expected) => {
  const session = new AuthSession(vi.fn<typeof fetch>().mockResolvedValue(json(body, status)));
  expect(session.getSnapshot().state.kind).toBe('checking');
  await session.verify();
  expect(session.getSnapshot().state.kind).toBe(expected);
});
it('deduplicates overlapping verification and StrictMode retain replay', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(alice));
  const session = new AuthSession(fetcher);
  const release = session.retain();
  release();
  const finalRelease = session.retain();
  expect(session.verify()).toBe(session.verify());
  await session.verify();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(session.getSnapshot().state.kind).toBe('authenticated');
  finalRelease();
  await Promise.resolve();
});
it('clears A before publishing a replacement B and never uses workspace revision as generation', async () => {
  const session = new AuthSession(
    vi.fn<typeof fetch>().mockResolvedValueOnce(json(alice)).mockResolvedValueOnce(json(bob)),
  );
  await session.verify();
  const oldGeneration = session.lifecycle.generation;
  const states: string[] = [];
  session.subscribe(() => states.push(session.getSnapshot().state.kind));
  await session.verify();
  expect(states).toEqual(['checking', 'authenticated']);
  expect(session.getSnapshot().state).toMatchObject({
    identity: bob,
    generation: oldGeneration + 1,
  });
});
