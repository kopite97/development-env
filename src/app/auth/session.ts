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
};
const identityKey = (identity: Identity) => identity.id + ':' + identity.workspace.id;

export class AuthSession {
  readonly lifecycle = new Lifecycle();
  readonly request;
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
  private notify = () => {};

  constructor(fetcher?: typeof fetch) {
    this.request = createHttpClient({
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
    this.lifecycle.reset();
    this.bootstrap = undefined;
    this.token = undefined;
  }

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
    const identity = identityKey(this.snapshot.state.identity);
    const generation = this.lifecycle.generation;
    this.publish({ ...this.snapshot, busy: true, notice: undefined });
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
    if (!this.snapshot.busy && (force || Date.now() - this.lastVerified > 1000)) void this.verify();
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
