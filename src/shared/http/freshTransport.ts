import { HttpError } from './client';
import { Freshness } from './freshness';
import { queryObserver } from './query';
import type { PrivateTransport } from './transport';

export function freshTransport(
  transport: PrivateTransport,
  onStale: (keys: readonly string[]) => void = () => {},
): PrivateTransport {
  const queries = new Map<string, Set<WeakRef<NonNullable<ReturnType<typeof queryObserver>>>>>();
  const freshness = new Freshness(transport.lifecycle, (keys) => {
    for (const key of keys) for (const query of queries.get(key) ?? []) query.deref()?.invalidate();
    onStale(keys);
  });
  transport.lifecycle.signal.addEventListener('abort', () => queries.clear(), { once: true });
  const request: PrivateTransport['request'] = (path, options = {}) =>
    transport.request(path, {
      ...options,
      onMetadata: (metadata) => {
        const observer = queryObserver(options.signal);
        if (!options.method || options.method === 'GET') {
          if (observer) {
            let set = queries.get(path);
            if (!set) {
              set = new Set();
              queries.set(path, set);
            }
            for (const ref of set) if (!ref.deref()) set.delete(ref);
            if (![...set].some((ref) => ref.deref() === observer)) set.add(new WeakRef(observer));
          }
          if (!freshness.observe(path, metadata))
            throw new HttpError(
              409,
              'STALE_RESPONSE',
              '이전 응답입니다. 최신 내용을 다시 확인해 주세요.',
            );
        } else freshness.ownMutation(metadata);
        options.onMetadata?.(metadata);
      },
    });
  return { ...transport, request };
}
