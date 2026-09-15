import {
  CancelledError,
  createHttpClient,
  HttpError,
  Lifecycle,
  SingleFlight,
} from '../../shared/http/client';
import { parseIdentity, type AuthState, type Identity } from './model';

export type SessionSnapshot = {
  state: AuthState;
  busy: boolean;
  notice?: string;
  logoutBlocked?: boolean;
  sessionCheck?: 'pending' | 'failed';
};
const identityKey = (identity: Identity) => identity.id + ':' + identity.workspace.id;

export class AuthSession {
  readonly lifecycle = new Lifecycle();
  readonly request: ReturnType<typeof createHttpClient>;
  private snapshot: SessionSnapshot = { state: { kind: 'checking' }, busy: false };
  private listeners = new Set<() => void>();
  private bootstrap?: Promise<void>;
  private logoutWork?: Promise<void>;
  private token?: { generation: number; value: string };
  private tokenFlight = new SingleFlight<string>();
  private recoveryUsed = false;
  private mutationRecoveryUsed = false;
  private mutationRecovery?: Promise<void>;
  private logoutBlocked = false;
  private previousIdentity?: string;
  private retainCount = 0;
  private lastVerified = 0;
  private lastResume = 0;
  private background?: Promise<void>;
  private backgroundController?: AbortController;
  private notify = () => {};

  constructor(fetcher?: typeof fetch) {
    const request = createHttpClient({
      lifecycle: this.lifecycle,
      fetch: fetcher,
      getCsrfToken: (generation) => this.csrf(generation),
      onAuthError: (error, generation) => {
        if (generation !== this.lifecycle.generation) return;
        const hadIdentity = !!this.previousIdentity;
        this.retire();
        this.previousIdentity = undefined;
        this.publish({
          state: { kind: error.status === 401 ? 'unauthenticated' : 'disabled' },
          busy: false,
        });
        if (hadIdentity) this.notify();
      },
    });
    this.request = async (path, options = {}) => {
      const generation = options.generation ?? this.lifecycle.generation;
      if (options.method && options.method !== 'GET' && path !== '/api/v1/auth/logout') {
        if (this.background) await this.background;
        else if (this.snapshot.sessionCheck === 'failed') await this.revalidate();
        this.lifecycle.assert(generation);
        if (this.snapshot.busy || this.snapshot.state.kind !== 'authenticated')
          throw new CancelledError();
        if (options.signal?.aborted) throw new CancelledError();
        if (this.snapshot.sessionCheck === 'failed')
          throw new HttpError(
            409,
            'SESSION_UNVERIFIED',
            '세션을 확인하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.',
          );
      }
      return request(path, { ...options, generation });
    };
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  setNotifier(notify: () => void) {
    this.notify = notify;
  }
  private publish(snapshot: SessionSnapshot) {
    this.snapshot = { ...snapshot, logoutBlocked: this.logoutBlocked };
    for (const listener of this.listeners) listener();
  }
  private retire() {
    this.cancelBackground();
    this.lifecycle.reset();
    this.bootstrap = undefined;
    this.token = undefined;
  }

  private cancelBackground() {
    this.backgroundController?.abort();
    this.backgroundController = undefined;
    this.background = undefined;
  }

  revalidate = (): Promise<void> => {
    if (this.logoutWork) return this.logoutWork;
    if (this.bootstrap) return this.bootstrap;
    if (this.background) return this.background;
    if (this.snapshot.state.kind !== 'authenticated') return this.verify();
    const generation = this.lifecycle.generation;
    const currentIdentity = identityKey(this.snapshot.state.identity);
    const controller = new AbortController();
    this.backgroundController = controller;
    this.lastResume = Date.now();
    this.publish({ ...this.snapshot, sessionCheck: 'pending' });
    const work = Promise.resolve().then(async () => {
      try {
        const identity = await this.request('/api/v1/me', {
          generation,
          signal: controller.signal,
          parse: parseIdentity,
        });
        this.lifecycle.assert(generation);
        if (controller.signal.aborted) return;
        this.lastVerified = Date.now();
        if (currentIdentity !== identityKey(identity)) {
          this.retire();
          this.publish({ state: { kind: 'checking' }, busy: false });
          this.previousIdentity = identityKey(identity);
          this.recoveryUsed = false;
          this.mutationRecoveryUsed = false;
          this.logoutBlocked = false;
          this.publish({
            state: { kind: 'authenticated', identity, generation: this.lifecycle.generation },
            busy: false,
          });
          this.notify();
        } else {
          this.publish({
            ...this.snapshot,
            state: { kind: 'authenticated', identity, generation },
            sessionCheck: undefined,
          });
        }
      } catch (error) {
        if (
          generation !== this.lifecycle.generation ||
          controller.signal.aborted ||
          error instanceof CancelledError
        )
          return;
        this.publish({ ...this.snapshot, sessionCheck: 'failed' });
      } finally {
        if (this.background === work) {
          this.background = undefined;
          this.backgroundController = undefined;
        }
      }
    });
    this.background = work;
    return work;
  };

  verify = (): Promise<void> => this.logoutWork ?? this.verifySession();
  private verifySession(): Promise<void> {
    if (this.bootstrap) return this.bootstrap;
    this.retire();
    const generation = this.lifecycle.generation;
    this.publish({ state: { kind: 'checking' }, busy: !!this.logoutWork });
    const work = Promise.resolve().then(async () => {
      try {
        const identity = await this.request('/api/v1/me', { generation, parse: parseIdentity });
        this.lifecycle.assert(generation);
        this.lastVerified = Date.now();
        const changed = this.previousIdentity !== identityKey(identity);
        if (changed) {
          this.recoveryUsed = false;
          this.mutationRecoveryUsed = false;
          this.logoutBlocked = false;
        }
        this.previousIdentity = identityKey(identity);
        this.publish({
          state: { kind: 'authenticated', identity, generation },
          busy: !!this.logoutWork,
        });
        if (changed) this.notify();
      } catch (error) {
        if (generation !== this.lifecycle.generation || error instanceof CancelledError) return;
        this.publish({
          state: {
            kind: 'bootstrap-error',
            message: 'Unable to verify your session. Please retry.',
            requestId: error instanceof HttpError ? error.requestId : undefined,
          },
          busy: false,
        });
      } finally {
        if (this.bootstrap === work) this.bootstrap = undefined;
      }
    });
    this.bootstrap = work;
    return work;
  }

  csrf(generation = this.lifecycle.generation): Promise<string> {
    return this.tokenFlight.run(generation, async () => {
      this.lifecycle.assert(generation);
      if (this.snapshot.state.kind !== 'authenticated') throw new CancelledError();
      if (this.token?.generation === generation) return this.token.value;
      const value = await this.request('/api/v1/auth/csrf', {
        generation,
        parse: (body) => {
          if (
            !body ||
            typeof body !== 'object' ||
            !('csrfToken' in body) ||
            typeof body.csrfToken !== 'string' ||
            !body.csrfToken.trim()
          )
            throw new Error('Invalid CSRF response');
          return body.csrfToken;
        },
      });
      this.lifecycle.assert(generation);
      this.token = { generation, value };
      return value;
    });
  }

  recoverProjectSecurity = () => this.recoverMutationSecurity();
  recoverMutationSecurity = (): Promise<void> => {
    if (this.mutationRecovery) return this.mutationRecovery;
    if (this.mutationRecoveryUsed)
      return Promise.reject(
        new Error('Session security failed again. Check token/Origin configuration and reload.'),
      );
    if (this.snapshot.state.kind !== 'authenticated') return Promise.resolve();
    this.mutationRecoveryUsed = true;
    const identity = identityKey(this.snapshot.state.identity);
    const work = this.verify().then(async () => {
      const state = this.snapshot.state;
      if (state.kind === 'authenticated' && identityKey(state.identity) === identity)
        await this.csrf(state.generation);
    });
    this.mutationRecovery = work;
    void work
      .finally(() => {
        if (this.mutationRecovery === work) this.mutationRecovery = undefined;
      })
      .catch(() => {});
    return work;
  };

  logout = (): Promise<void> => {
    if (this.logoutWork) return this.logoutWork;
    if (this.snapshot.state.kind !== 'authenticated' || this.logoutBlocked)
      return Promise.resolve();
    this.cancelBackground();
    const identity = identityKey(this.snapshot.state.identity);
    const generation = this.lifecycle.generation;
    this.publish({ ...this.snapshot, busy: true, notice: undefined, sessionCheck: undefined });
    const work = Promise.resolve().then(async () => {
      let dispatched = false;
      try {
        // Acquire before dispatch so offline acquisition cannot be mistaken for ambiguous logout.
        await this.csrf(generation);
        this.lifecycle.assert(generation);
        dispatched = true;
        await this.request('/api/v1/auth/logout', {
          method: 'POST',
          response: 'empty',
          generation,
        });
        this.lifecycle.assert(generation);
        this.retire();
        this.previousIdentity = undefined;
        this.recoveryUsed = false;
        this.logoutBlocked = false;
        this.publish({ state: { kind: 'unauthenticated' }, busy: false });
        this.notify();
      } catch (error) {
        if (generation !== this.lifecycle.generation || error instanceof CancelledError) return;
        if (error instanceof HttpError && error.status === 403 && error.code === 'CSRF_INVALID') {
          this.token = undefined;
          if (this.recoveryUsed) {
            this.logoutBlocked = true;
            this.publish({
              ...this.snapshot,
              busy: false,
              notice:
                'Session security check failed again. Check the token/Origin configuration and reload after it is corrected.',
            });
            return;
          }
          this.recoveryUsed = true;
          const verification = this.verifySession();
          const verificationGeneration = this.lifecycle.generation;
          await verification;
          if (verificationGeneration !== this.lifecycle.generation) return;
          const refreshed = this.snapshot.state;
          if (refreshed.kind !== 'authenticated') return;
          if (identityKey(refreshed.identity) !== identity) {
            this.publish({
              ...this.snapshot,
              busy: false,
              notice: 'The account changed. The previous logout was discarded.',
            });
            return;
          }
          const recoveryGeneration = this.lifecycle.generation;
          try {
            await this.csrf(recoveryGeneration);
            this.lifecycle.assert(recoveryGeneration);
            this.publish({
              ...this.snapshot,
              busy: false,
              notice: 'Session security was refreshed. Retry logout to continue.',
            });
          } catch (recoveryError) {
            if (
              recoveryGeneration === this.lifecycle.generation &&
              !(recoveryError instanceof CancelledError)
            )
              this.publish({
                ...this.snapshot,
                busy: false,
                notice: 'Unable to refresh session security. Please retry logout.',
              });
          }
        } else if (
          dispatched &&
          error instanceof HttpError &&
          (error.status === 0 || error.code === 'PROTOCOL_ERROR' || error.status >= 500)
        ) {
          const verification = this.verifySession();
          const verificationGeneration = this.lifecycle.generation;
          await verification;
          if (verificationGeneration !== this.lifecycle.generation) return;
          if (this.snapshot.state.kind === 'authenticated')
            this.publish({
              ...this.snapshot,
              busy: false,
              notice:
                identityKey(this.snapshot.state.identity) === identity
                  ? 'Logout was not confirmed. Please retry logout.'
                  : 'The account changed. The previous logout was discarded.',
            });
        } else
          this.publish({
            ...this.snapshot,
            busy: false,
            notice: 'Unable to log out. Please retry.',
          });
      } finally {
        if (this.logoutWork === work) {
          this.logoutWork = undefined;
          if (this.snapshot.busy) this.publish({ ...this.snapshot, busy: false });
        }
      }
    });
    this.logoutWork = work;
    return work;
  };

  login(navigate: () => void) {
    this.retire();
    this.logoutWork = undefined;
    this.previousIdentity = undefined;
    this.publish({ state: { kind: 'unauthenticated' }, busy: true });
    this.notify();
    navigate();
  }
  receiveHint = () => {
    // A known cross-tab change cancels even an in-flight logout; no intent survives it.
    this.retire();
    this.logoutWork = undefined;
    void this.verifySession();
  };
  suspend = () => {
    this.retire();
    this.logoutWork = undefined;
    this.publish({ state: { kind: 'checking' }, busy: false });
  };
  resume = (force = false) => {
    if (this.snapshot.busy) return;
    if (force || this.snapshot.state.kind !== 'authenticated') void this.verify();
    else if (Date.now() - Math.max(this.lastVerified, this.lastResume) > 30_000)
      void this.revalidate();
  };
  retain() {
    this.retainCount++;
    if (this.retainCount === 1) void this.verify();
    return () => {
      this.retainCount--;
      queueMicrotask(() => {
        if (this.retainCount === 0) {
          this.retire();
          this.logoutWork = undefined;
        }
      });
    };
  }
}
