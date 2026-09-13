import { useEffect, useSyncExternalStore } from 'react';
import { CancelledError } from './client';

export type QueryState<T> = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  data?: T;
  error?: unknown;
  stale: boolean;
};
export class Query<T> {
  private state: QueryState<T> = { status: 'idle', stale: true };
  private listeners = new Set<() => void>();
  private controller?: AbortController;
  private sequence = 0;
  private work?: Promise<void>;
  constructor(private fetcher: (signal: AbortSignal) => Promise<T>) {}
  getSnapshot = () => this.state;
  get observed() {
    return this.listeners.size > 0;
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size && this.work) this.invalidate();
    };
  };
  private publish(state: QueryState<T>) {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
  invalidate(clear = false) {
    this.sequence++;
    this.controller?.abort();
    this.work = undefined;
    this.publish({ status: 'idle', data: clear ? undefined : this.state.data, stale: true });
  }
  cancel() {
    this.sequence++;
    this.controller?.abort();
    this.work = undefined;
  }
  seed(data: T) {
    this.publish({ status: 'idle', data, stale: true });
  }
  load = (fetcher = this.fetcher): Promise<void> => {
    if (this.work) return this.work;
    const sequence = ++this.sequence;
    const controller = new AbortController();
    this.controller = controller;
    this.publish({ ...this.state, status: 'loading', error: undefined });
    const work = Promise.resolve()
      .then(() => fetcher(controller.signal))
      .then((data) => {
        if (sequence === this.sequence && !controller.signal.aborted)
          this.publish({ status: 'ready', data, stale: false });
      })
      .catch((error: unknown) => {
        if (
          sequence === this.sequence &&
          !controller.signal.aborted &&
          !(error instanceof CancelledError)
        )
          this.publish({ ...this.state, status: 'error', error, stale: true });
      })
      .finally(() => {
        if (this.work === work) this.work = undefined;
      });
    this.work = work;
    return work;
  };
}
export function useQuery<T>(query: Query<T>) {
  const state = useSyncExternalStore(query.subscribe, query.getSnapshot);
  useEffect(() => {
    if (state.status === 'idle') void query.load();
  }, [query, state.status]);
  return state;
}
