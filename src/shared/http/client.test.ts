import { describe, expect, it, vi } from 'vitest';
import { CancelledError, createHttpClient, HttpError, Lifecycle, SingleFlight } from './client';

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function setup(fetcher: typeof fetch) {
  const lifecycle = new Lifecycle();
  const onAuthError = vi.fn();
  return {
    lifecycle,
    onAuthError,
    request: createHttpClient({ lifecycle, fetch: fetcher, onAuthError }),
  };
}

describe('HTTP response boundary', () => {
  it('preserves JSON intent, headers and browser credentials', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ ok: true }));
    const { request } = setup(fetcher);
    await request('/api/v1/synthetic', {
      method: 'PATCH',
      json: { omitted: undefined, nil: null, empty: '', zero: 0, flag: false },
      headers: { 'X-Intent': 'explicit' },
    });
    const init = fetcher.mock.calls[0][1]!;
    expect(init.body).toBe('{"nil":null,"empty":"","zero":0,"flag":false}');
    expect(init.credentials).toBe('same-origin');
    expect(new Headers(init.headers).get('X-Intent')).toBe('explicit');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
  });
  it('accepts bodyless 204 only when requested', async () => {
    const { request } = setup(
      vi.fn<typeof fetch>().mockImplementation(async () => new Response(null, { status: 204 })),
    );
    await expect(
      request('/api/v1/auth/logout', { method: 'POST', response: 'empty' }),
    ).resolves.toBeUndefined();
    await expect(request('/api/v1/me')).rejects.toMatchObject({ code: 'PROTOCOL_ERROR' });
  });
  it.each([
    new Response('<html/>'),
    new Response('{', { headers: { 'Content-Type': 'application/json' } }),
    json({}),
  ])('rejects HTML, malformed JSON and invalid DTOs', async (response) => {
    const { request } = setup(vi.fn<typeof fetch>().mockResolvedValue(response));
    await expect(
      request('/api/v1/me', {
        parse: () => {
          throw new Error('Invalid DTO');
        },
      }),
    ).rejects.toMatchObject({ code: 'PROTOCOL_ERROR' });
  });
  it('retains typed error fields without displaying arbitrary server messages', async () => {
    const { request } = setup(
      vi.fn<typeof fetch>().mockResolvedValue(
        json(
          {
            code: 'FUTURE_CODE',
            message: '<secret>',
            fieldErrors: { title: 'Required', unknown: 4 },
            requestId: 'req-1',
          },
          422,
        ),
      ),
    );
    await expect(request('/api/v1/synthetic')).rejects.toMatchObject({
      status: 422,
      code: 'FUTURE_CODE',
      fieldErrors: { title: 'Required' },
      requestId: 'req-1',
      message: 'The request could not be completed.',
    });
  });
  it.each([401, 403, 503])('keeps malformed status %s authoritative', async (status) => {
    const { request, onAuthError } = setup(
      vi.fn<typeof fetch>().mockResolvedValue(new Response('<html/>', { status })),
    );
    await expect(request('/api/v1/me')).rejects.toMatchObject({ status });
    expect(onAuthError).toHaveBeenCalledTimes(status === 401 ? 1 : 0);
  });
  it.each(['ACCOUNT_DISABLED', 'CSRF_INVALID', 'UNKNOWN'])(
    'reports only typed disabled 403 to auth: %s',
    async (code) => {
      const { request, onAuthError } = setup(
        vi.fn<typeof fetch>().mockResolvedValue(json({ code }, 403)),
      );
      await expect(request('/api/v1/me')).rejects.toMatchObject({ code });
      expect(onAuthError).toHaveBeenCalledTimes(code === 'ACCOUNT_DISABLED' ? 1 : 0);
    },
  );
  it('distinguishes network, timeout and intentional abort', async () => {
    const { request } = setup(vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline')));
    await expect(request('/api/v1/me')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    const controller = new AbortController();
    controller.abort();
    await expect(request('/api/v1/me', { signal: controller.signal })).rejects.toBeInstanceOf(
      CancelledError,
    );
    vi.useFakeTimers();
    try {
      const fetcher: typeof fetch = async (_path, init) =>
        new Promise((_resolve, reject) =>
          init!.signal!.addEventListener('abort', () => reject(new Error('abort'))),
        );
      const timed = createHttpClient({ lifecycle: new Lifecycle(), fetch: fetcher, timeoutMs: 10 });
      const assertion = expect(timed('/api/v1/me')).rejects.toMatchObject({ code: 'TIMEOUT' });
      await vi.advanceTimersByTimeAsync(10);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
  it.each([
    'https://example.com/api/v1/me',
    '//example.com/api/v1/me',
    '/api/v1/../me',
    '/api/v1/%2e%2e/me',
    '/api/v1/%252fme',
    '/api/v1/me#fragment',
  ])('rejects target %s', async (path) => {
    const fetcher = vi.fn<typeof fetch>();
    const { request } = setup(fetcher);
    await expect(request(path)).rejects.toBeInstanceOf(HttpError);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('generation and cancellation', () => {
  it('a stalled 401 body invalidates the active session immediately without advancing time', async () => {
    vi.useFakeTimers();
    try {
      const response = new Response(null, { status: 401 });
      vi.spyOn(response, 'json').mockImplementation(() => new Promise<unknown>(() => {}));
      const lifecycle = new Lifecycle();
      const onAuthError = vi.fn(() => lifecycle.reset());
      const request = createHttpClient({
        lifecycle,
        onAuthError,
        fetch: vi.fn<typeof fetch>().mockResolvedValue(response),
        timeoutMs: 20,
      });
      const assertion = expect(request('/api/v1/me')).rejects.toMatchObject({ status: 401 });
      await assertion;
      expect(onAuthError).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
  it('times out even when a custom transport ignores AbortSignal forever', async () => {
    vi.useFakeTimers();
    try {
      const request = createHttpClient({
        lifecycle: new Lifecycle(),
        fetch: () => new Promise<Response>(() => {}),
        timeoutMs: 20,
      });
      const assertion = expect(request('/api/v1/me')).rejects.toMatchObject({ code: 'TIMEOUT' });
      await vi.advanceTimersByTimeAsync(20);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
  it('late body parsing failure cannot publish an obsolete protocol error', async () => {
    const lifecycle = new Lifecycle();
    let rejectBody!: (reason: Error) => void;
    const body = new Promise<unknown>((_resolve, reject) => {
      rejectBody = reject;
    });
    const response = json({});
    const started = deferred<void>();
    vi.spyOn(response, 'json').mockImplementation(() => {
      started.resolve();
      return body;
    });
    const request = createHttpClient({
      lifecycle,
      fetch: vi.fn<typeof fetch>().mockResolvedValue(response),
    });
    const old = request('/api/v1/me');
    const assertion = expect(old).rejects.toBeInstanceOf(CancelledError);
    await started.promise;
    lifecycle.reset();
    rejectBody(new Error('late malformed body'));
    await assertion;
  });
  it.each([200, 401, 403])(
    'late A status %s cannot affect B even when abort is ignored',
    async (status) => {
      const pending = deferred<Response>();
      const fetcher = vi
        .fn<typeof fetch>()
        .mockReturnValueOnce(pending.promise)
        .mockResolvedValueOnce(json({ identity: 'B' }));
      const { request, lifecycle, onAuthError } = setup(fetcher);
      const old = request('/api/v1/me');
      const assertion = expect(old).rejects.toBeInstanceOf(CancelledError);
      lifecycle.reset();
      await expect(request('/api/v1/me')).resolves.toEqual({ identity: 'B' });
      pending.resolve(json({ code: 'ACCOUNT_DISABLED', identity: 'A' }, status));
      await assertion;
      expect(onAuthError).not.toHaveBeenCalled();
    },
  );
  it('rejects queued old work before dispatch and retires old single-flight only once', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({}));
    const { lifecycle, request } = setup(fetcher);
    const flight = new SingleFlight<unknown>();
    const generation = lifecycle.generation;
    const old = flight.run(generation, () => request('/api/v1/me', { generation }));
    expect(flight.run(generation, () => request('/api/v1/me'))).toBe(old);
    const assertion = expect(old).rejects.toBeInstanceOf(CancelledError);
    lifecycle.reset();
    await assertion;
    expect(fetcher).not.toHaveBeenCalled();
    await flight.run(lifecycle.generation, () => request('/api/v1/me'));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
