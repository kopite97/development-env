import { afterEach, expect, it, vi } from 'vitest';
import { AuthSession } from './session';
import { CancelledError } from '../../shared/http/client';

const alice = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Alice',
  workspace: { id: '22222222-2222-4222-8222-222222222222', name: 'Workspace', revision: 1 },
};
const bob = { ...alice, id: '33333333-3333-4333-8333-333333333333' };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
afterEach(() => vi.restoreAllMocks());

it('same identity keeps lifecycle and authenticated state; overlapping focus checks share one request', async () => {
  const pending = deferred<Response>();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(json(alice))
    .mockImplementationOnce(() => pending.promise);
  const session = new AuthSession(fetcher);
  await session.verify();
  const generation = session.lifecycle.generation;
  const signal = session.lifecycle.signal;
  const states: string[] = [];
  session.subscribe(() => states.push(session.getSnapshot().state.kind));
  const check = session.revalidate();
  expect(session.revalidate()).toBe(check);
  expect(session.getSnapshot().sessionCheck).toBe('pending');
  pending.resolve(
    json({ ...alice, displayName: 'Renamed', workspace: { ...alice.workspace, revision: 2 } }),
  );
  await check;
  expect(states).toEqual(['authenticated', 'authenticated']);
  expect(session.lifecycle.generation).toBe(generation);
  expect(session.lifecycle.signal).toBe(signal);
  expect(signal.aborted).toBe(false);
  expect(session.getSnapshot().state).toMatchObject({ identity: { displayName: 'Renamed' } });
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('focus cooldown is 30 seconds and failed checks are throttled too', async () => {
  let now = 100_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(json(alice))
    .mockResolvedValue(json({}, 503));
  const session = new AuthSession(fetcher);
  await session.verify();
  now += 2000;
  session.resume();
  expect(fetcher).toHaveBeenCalledTimes(1);
  now += 30_000;
  session.resume();
  await session.revalidate();
  expect(fetcher).toHaveBeenCalledTimes(2);
  now += 1000;
  session.resume();
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(session.getSnapshot()).toMatchObject({
    state: { kind: 'authenticated' },
    sessionCheck: 'failed',
  });
});

it.each([bob, { ...alice, workspace: { ...alice.workspace, id: bob.id } }])(
  'identity boundary changes retire A before B and cancel queued writes',
  async (next) => {
    const pending = deferred<Response>();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(alice))
      .mockImplementationOnce(() => pending.promise);
    const session = new AuthSession(fetcher);
    await session.verify();
    const old = session.lifecycle.signal;
    const states: string[] = [];
    session.subscribe(() => states.push(session.getSnapshot().state.kind));
    const check = session.revalidate();
    const write = session.request('/api/v1/projects', { method: 'POST', json: { name: 'draft' } });
    const rejected = expect(write).rejects.toBeInstanceOf(CancelledError);
    pending.resolve(json(next));
    await check;
    await rejected;
    expect(old.aborted).toBe(true);
    expect(states).toEqual(['authenticated', 'checking', 'authenticated']);
    expect(fetcher).toHaveBeenCalledTimes(2);
  },
);

it.each([
  [401, {}, 'unauthenticated'],
  [403, { code: 'ACCOUNT_DISABLED' }, 'disabled'],
] as const)('background %s clears private state', async (status, body, kind) => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(json(alice))
    .mockResolvedValueOnce(json(body, status));
  const session = new AuthSession(fetcher);
  await session.verify();
  const old = session.lifecycle.signal;
  await session.revalidate();
  expect(session.getSnapshot().state.kind).toBe(kind);
  expect(old.aborted).toBe(true);
});

it('network failure retains state, blocks writes, and explicit recovery enables a separate retry', async () => {
  let fail = true;
  const calls: string[] = [];
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
    const path = String(input);
    calls.push(path);
    if (path.endsWith('/me')) return calls.length > 1 && fail ? json({}, 503) : json(alice);
    if (path.endsWith('/csrf')) return json({ csrfToken: 'token' });
    return json({ saved: true });
  });
  const session = new AuthSession(fetcher);
  await session.verify();
  const generation = session.lifecycle.generation;
  await session.revalidate();
  await expect(session.request('/api/v1/projects', { method: 'POST' })).rejects.toMatchObject({
    code: 'SESSION_UNVERIFIED',
  });
  expect(calls.filter((p) => p.endsWith('/projects'))).toHaveLength(0);
  expect(session.lifecycle.generation).toBe(generation);
  fail = false;
  expect(calls.filter((p) => p.endsWith('/projects'))).toHaveLength(0);
  await session.request('/api/v1/projects', { method: 'POST' });
  expect(session.getSnapshot().sessionCheck).toBeUndefined();
  expect(calls.filter((p) => p.endsWith('/projects'))).toHaveLength(1);
});

it('a write waits for successful verification without changing its body', async () => {
  const pending = deferred<Response>();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(json(alice))
    .mockImplementationOnce(() => pending.promise)
    .mockResolvedValueOnce(json({ csrfToken: 'token' }))
    .mockResolvedValueOnce(json({ saved: true }));
  const session = new AuthSession(fetcher);
  await session.verify();
  const check = session.revalidate();
  const body = { name: 'original' };
  const write = session.request('/api/v1/projects', {
    method: 'POST',
    json: body,
    headers: { 'Idempotency-Key': 'intent' },
  });
  await Promise.resolve();
  expect(fetcher).toHaveBeenCalledTimes(2);
  pending.resolve(json(alice));
  await check;
  await write;
  expect(fetcher.mock.calls[3][1]?.body).toBe(JSON.stringify(body));
});

it('late background response cannot restore a suspended or replaced session', async () => {
  const pending = deferred<Response>();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(json(alice))
    .mockImplementationOnce(() => pending.promise)
    .mockResolvedValueOnce(json(bob));
  const session = new AuthSession(fetcher);
  await session.verify();
  const check = session.revalidate();
  await Promise.resolve();
  session.suspend();
  await session.verify();
  pending.resolve(json(alice));
  await check;
  expect(session.getSnapshot().state).toMatchObject({ identity: bob });
});
