import { expect, it, vi } from 'vitest';
import { AuthSession } from './session';
import { CancelledError } from '../../shared/http/client';

const alice = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Alice',
  workspace: { id: '22222222-2222-4222-8222-222222222222', name: 'Alice workspace', revision: 1 },
};
const bob = {
  id: '33333333-3333-4333-8333-333333333333',
  displayName: 'Bob',
  workspace: { id: '44444444-4444-4444-8444-444444444444', name: 'Bob workspace', revision: 1 },
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
it.each(['ACCOUNT_DISABLED', 'FORBIDDEN'])(
  'logout 403 %s distinguishes disabled from ordinary forbidden',
  async (code) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(alice))
      .mockResolvedValueOnce(json({ csrfToken: 'A' }))
      .mockResolvedValueOnce(json({ code }, 403));
    const session = new AuthSession(fetcher);
    await session.verify();
    await session.logout();
    expect(session.getSnapshot().state.kind).toBe(
      code === 'ACCOUNT_DISABLED' ? 'disabled' : 'authenticated',
    );
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(session.getSnapshot().busy).toBe(false);
  },
);
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

it('deduplicates CSRF and logout, attaches the token, accepts empty 204 and clears private state', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(json(alice))
    .mockResolvedValueOnce(json({ csrfToken: 'token-A' }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  const session = new AuthSession(fetcher);
  await session.verify();
  const token1 = session.csrf();
  const token2 = session.csrf();
  expect(token1).toBe(token2);
  await token1;
  const logout = session.logout();
  expect(session.logout()).toBe(logout);
  expect(session.getSnapshot().busy).toBe(true);
  await logout;
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(new Headers(fetcher.mock.calls[2][1]!.headers).get('X-CSRF-Token')).toBe('token-A');
  expect(session.getSnapshot()).toMatchObject({ state: { kind: 'unauthenticated' }, busy: false });
  await expect(session.csrf()).rejects.toBeInstanceOf(CancelledError);
});

it('late token acquisition after login transition cannot be cached or dispatch logout', async () => {
  const token = deferred<Response>();
  const started = deferred<void>();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(json(alice))
    .mockImplementationOnce(() => {
      started.resolve();
      return token.promise;
    })
    .mockResolvedValueOnce(json(bob))
    .mockResolvedValueOnce(json({ csrfToken: 'token-B' }));
  const session = new AuthSession(fetcher);
  await session.verify();
  const logout = session.logout();
  await started.promise;
  session.login(() => {});
  await session.verify();
  token.resolve(json({ csrfToken: 'token-A' }));
  await logout;
  expect(session.getSnapshot().state).toMatchObject({ identity: bob });
  expect(await session.csrf()).toBe('token-B');
  expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
});

it.each([200, 401, 403])('late A logout result %s never mutates B', async (status) => {
  const pending = deferred<Response>();
  const started = deferred<void>();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(json(alice))
    .mockResolvedValueOnce(json({ csrfToken: 'A' }))
    .mockImplementationOnce(() => {
      started.resolve();
      return pending.promise;
    })
    .mockResolvedValueOnce(json(bob));
  const session = new AuthSession(fetcher);
  await session.verify();
  const logout = session.logout();
  await started.promise;
  expect(fetcher).toHaveBeenCalledTimes(3);
  session.login(() => {});
  await session.verify();
  pending.resolve(json({ code: 'ACCOUNT_DISABLED' }, status));
  await logout;
  expect(session.getSnapshot()).toMatchObject({ state: { identity: bob }, busy: false });
  expect(session.getSnapshot().notice).toBeUndefined();
});

it('CSRF_INVALID refreshes once without replay; repeated rejection blocks refresh loops', async () => {
  let csrfCalls = 0,
    meCalls = 0,
    posts = 0;
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (path) => {
    if (path === '/api/v1/me') {
      meCalls++;
      return json(alice);
    }
    if (path === '/api/v1/auth/csrf') {
      csrfCalls++;
      return json({ csrfToken: 'token-' + csrfCalls });
    }
    posts++;
    return json({ code: 'CSRF_INVALID' }, 403);
  });
  const session = new AuthSession(fetcher);
  await session.verify();
  await session.logout();
  expect({ csrfCalls, meCalls, posts }).toEqual({ csrfCalls: 2, meCalls: 2, posts: 1 });
  expect(session.getSnapshot().notice).toContain('Retry logout');
  await session.logout();
  expect({ csrfCalls, meCalls, posts }).toEqual({ csrfCalls: 2, meCalls: 2, posts: 2 });
  expect(session.getSnapshot().logoutBlocked).toBe(true);
  await session.logout();
  expect(posts).toBe(2);
});

it('CSRF recovery account change discards A intent and never fetches a token or replays for B', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(json(alice))
    .mockResolvedValueOnce(json({ csrfToken: 'A' }))
    .mockResolvedValueOnce(json({ code: 'CSRF_INVALID' }, 403))
    .mockResolvedValueOnce(json(bob));
  const session = new AuthSession(fetcher);
  await session.verify();
  await session.logout();
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(session.getSnapshot()).toMatchObject({
    state: { identity: bob },
    notice: 'The account changed. The previous logout was discarded.',
  });
});

it.each(['offline', 'malformed', 'server'])(
  'ambiguous %s logout gates private state then reconciles without claiming success',
  async (mode) => {
    const reconciliation = deferred<Response>();
    const started = deferred<void>();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(alice))
      .mockResolvedValueOnce(json({ csrfToken: 'A' }));
    if (mode === 'offline') fetcher.mockRejectedValueOnce(new TypeError('offline'));
    else
      fetcher.mockResolvedValueOnce(mode === 'malformed' ? new Response('<html/>') : json({}, 503));
    fetcher.mockImplementationOnce(() => {
      started.resolve();
      return reconciliation.promise;
    });
    const session = new AuthSession(fetcher);
    await session.verify();
    const logout = session.logout();
    await started.promise;
    expect(session.getSnapshot().state.kind).toBe('checking');
    reconciliation.resolve(json(alice));
    await logout;
    expect(session.getSnapshot()).toMatchObject({
      state: { identity: alice },
      notice: 'Logout was not confirmed. Please retry logout.',
      busy: false,
    });
  },
);

it.each([401, 503])(
  'failed logout reconciliation status %s stays anonymous/error',
  async (status) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(alice))
      .mockResolvedValueOnce(json({ csrfToken: 'A' }))
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(json({}, status));
    const session = new AuthSession(fetcher);
    await session.verify();
    await session.logout();
    expect(session.getSnapshot().state.kind).toBe(
      status === 401 ? 'unauthenticated' : 'bootstrap-error',
    );
  },
);

it.each([401, 403])('token acquisition auth error %s tears down without POST', async (status) => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(json(alice))
    .mockResolvedValueOnce(json({ code: 'ACCOUNT_DISABLED' }, status));
  const session = new AuthSession(fetcher);
  await session.verify();
  await session.logout();
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(session.getSnapshot().state.kind).toBe(status === 401 ? 'unauthenticated' : 'disabled');
});

it('hint during pending logout retires old intent and revalidates; unchanged identity does not echo', async () => {
  const pending = deferred<Response>();
  const started = deferred<void>();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(json(alice))
    .mockImplementationOnce(() => {
      started.resolve();
      return pending.promise;
    })
    .mockResolvedValueOnce(json(bob))
    .mockResolvedValueOnce(json(bob));
  const session = new AuthSession(fetcher);
  const notify = vi.fn();
  session.setNotifier(notify);
  await session.verify();
  const logout = session.logout();
  await started.promise;
  session.receiveHint();
  await session.verify();
  pending.resolve(json({ csrfToken: 'A' }));
  await logout;
  expect(session.getSnapshot().state).toMatchObject({ identity: bob });
  expect(notify).toHaveBeenCalledTimes(2);
  session.receiveHint();
  await session.verify();
  expect(notify).toHaveBeenCalledTimes(2);
});
