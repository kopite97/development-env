import { dashboardHandoff } from './dashboardHandoff';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AuthSession } from './session';
import { connectAuthHints } from './crossTab';
import { consumeLoginError, loginUrl } from './routeIntent';
import { PrivateWorkspace } from './PrivateWorkspace';
import { projectHandoff } from './projectHandoff';
import { taskHandoff } from './taskHandoff';
import { journalHandoff } from './journalHandoff';
import { linkHandoff } from './linkHandoff';
import { milestoneHandoff } from './milestoneHandoff';
import { confirmNavigation } from '../../shared/lib/navigationGuard';
import './auth.css';

const session = new AuthSession();
const getDashboardMemory = dashboardHandoff(session);
const getProjectMemory = projectHandoff(session);
const getTaskMemory = taskHandoff(session);
const getJournalMemory = journalHandoff(session);
const getLinkMemory = linkHandoff(session);
const getMilestoneMemory = milestoneHandoff(session);

export function AuthApp() {
  const [url, setUrl] = useState(() => new URL(window.location.href));
  const locationRef = useRef(url);
  const historyIndex = useRef(0);
  const restoringHistory = useRef(false);
  const handleNavigate = (path: string, replace = false) => {
    if (path === window.location.pathname + window.location.search) return;
    if (
      !confirmNavigation(
        Boolean(
          getProjectMemory().editor ||
          getTaskMemory().editor ||
          getJournalMemory().editor ||
          getMilestoneMemory().editor ||
          getLinkMemory().editor ||
          getDashboardMemory().editor ||
          Object.values(getDashboardMemory().tasks).some((memory) => memory.editor),
        ),
        'Discard this draft? An unconfirmed creation may already exist. Review Projects before creating again.',
      )
    )
      return;
    getProjectMemory().editor = undefined;
    getTaskMemory().editor = undefined;
    getJournalMemory().editor = undefined;
    getMilestoneMemory().editor = undefined;
    getLinkMemory().editor = undefined;
    getDashboardMemory().editor = undefined;
    for (const memory of Object.values(getDashboardMemory().tasks)) memory.editor = undefined;
    if (replace)
      window.history.replaceState({ projectNavigationIndex: historyIndex.current }, '', path);
    else window.history.pushState({ projectNavigationIndex: ++historyIndex.current }, '', path);
    locationRef.current = new URL(window.location.href);
    setUrl(locationRef.current);
  };
  const { state, busy, notice, logoutBlocked } = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
  );
  const [intent] = useState(() => consumeLoginError(new URL(window.location.href)));
  useEffect(() => {
    window.history.replaceState({ ...window.history.state, projectNavigationIndex: 0 }, '');
    if (intent.failed)
      window.history.replaceState(
        window.history.state,
        '',
        intent.url.pathname + intent.url.search + intent.url.hash,
      );
    const disconnect = connectAuthHints(session);
    const release = session.retain();
    const handleFocus = () => {
      if (document.visibilityState === 'visible') session.resume();
    };
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) session.resume(true);
    };
    const handlePop = (event: PopStateEvent) => {
      if (restoringHistory.current) {
        restoringHistory.current = false;
        return;
      }
      const next =
        typeof event.state?.projectNavigationIndex === 'number'
          ? event.state.projectNavigationIndex
          : 0;
      if (
        !confirmNavigation(
          Boolean(
            getProjectMemory().editor ||
            getTaskMemory().editor ||
            getJournalMemory().editor ||
            getMilestoneMemory().editor ||
            getLinkMemory().editor ||
            getDashboardMemory().editor ||
            Object.values(getDashboardMemory().tasks).some((memory) => memory.editor),
          ),
          'Discard this draft? An unconfirmed creation may already exist.',
        )
      ) {
        const delta = historyIndex.current - next;
        if (delta) {
          restoringHistory.current = true;
          window.history.go(delta);
        } else
          window.history.replaceState(
            { projectNavigationIndex: historyIndex.current },
            '',
            locationRef.current.pathname + locationRef.current.search,
          );
        return;
      }
      getProjectMemory().editor = undefined;
      getTaskMemory().editor = undefined;
      getJournalMemory().editor = undefined;
      getMilestoneMemory().editor = undefined;
      getLinkMemory().editor = undefined;
      getDashboardMemory().editor = undefined;
      for (const memory of Object.values(getDashboardMemory().tasks)) memory.editor = undefined;
      historyIndex.current = next;
      locationRef.current = new URL(window.location.href);
      setUrl(locationRef.current);
      session.resume(true);
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('pagehide', session.suspend);
    window.addEventListener('popstate', handlePop);
    return () => {
      release();
      disconnect();
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('pagehide', session.suspend);
      window.removeEventListener('popstate', handlePop);
    };
  }, [intent]);
  const handleLogin = () =>
    session.login(() => window.location.assign(loginUrl(intent.url.pathname + intent.url.search)));
  const taskScreen =
    state.kind === 'authenticated' && ['/', '/tasks', '/library'].includes(url.pathname) && !busy;
  return (
    <div
      className={taskScreen ? 'authenticated-task-screen' : 'auth-app'}
      aria-labelledby={taskScreen ? undefined : 'auth-title'}
    >
      <header className="auth-header" hidden={taskScreen}>
        <a
          href="/"
          className="auth-brand"
          onClick={(event) => {
            if (state.kind === 'authenticated' && !event.ctrlKey && !event.metaKey) {
              event.preventDefault();
              handleNavigate('/');
            }
          }}
        >
          <h1 id="auth-title">Devspace</h1>
        </a>
        <span>Your personal workspace</span>
      </header>
      {state.kind === 'checking' && (
        <section className="auth-card">
          <p role="status">Checking your session…</p>
        </section>
      )}
      {state.kind === 'unauthenticated' && (
        <section className="auth-card">
          <h2>Sign in to your workspace</h2>
          <p>Continue with Google to access your personal workspace.</p>
          {intent.failed && <p role="alert">Google sign-in failed. Please try again.</p>}
          <button type="button" disabled={busy} onClick={handleLogin}>
            Continue with Google
          </button>
        </section>
      )}
      {state.kind === 'disabled' && (
        <section className="auth-card">
          <h2>Account disabled</h2>
          <p role="alert">
            This account cannot access Devspace. Contact your administrator for help.
          </p>
        </section>
      )}
      {state.kind === 'bootstrap-error' && (
        <section className="auth-card">
          <h2>Connection problem</h2>
          <p role="alert">{state.message}</p>
          {state.requestId && <p>Request ID: {state.requestId}</p>}
          <button onClick={() => void session.verify()}>Retry</button>
        </section>
      )}
      {state.kind === 'authenticated' && (
        <section
          key={`${state.identity.id}:${state.identity.workspace.id}:${state.generation}`}
          className={taskScreen ? 'task-workspace' : 'auth-card'}
          aria-label={state.identity.displayName + ' · ' + state.identity.workspace.name}
        >
          <div className="auth-identity" hidden={taskScreen}>
            <span className="auth-avatar" aria-hidden="true">
              {Array.from(state.identity.displayName)[0]}
            </span>
            <div>
              <h2>{state.identity.displayName}</h2>
              <p>{state.identity.workspace.name}</p>
            </div>
          </div>
          <nav
            hidden={taskScreen}
            aria-label="Workspace"
            onClick={(event) => {
              const target = event.target;
              if (
                target instanceof HTMLAnchorElement &&
                !event.ctrlKey &&
                !event.metaKey &&
                !event.shiftKey &&
                !event.altKey
              ) {
                event.preventDefault();
                handleNavigate(target.pathname);
              }
            }}
          >
            <a href="/">Home</a>
            <a href="/projects">Projects</a>
            <a href="/tasks">Tasks</a>
            <a href="/journals">Journals</a>
            <a href="/library">Library</a>
          </nav>
          {!busy && (
            <PrivateWorkspace
              transport={{
                request: session.request,
                lifecycle: session.lifecycle,
                generation: state.generation,
                recoverSecurity: session.recoverMutationSecurity,
              }}
              url={url}
              onNavigate={handleNavigate}
              memory={getProjectMemory()}
              taskMemory={getTaskMemory()}
              journalMemory={getJournalMemory()}
              milestoneMemory={getMilestoneMemory()}
              linkMemory={getLinkMemory()}
              dashboardMemory={getDashboardMemory()}
              avatar={Array.from(state.identity.displayName)[0] ?? ''}
            />
          )}
          {notice && <p role="alert">{notice}</p>}
          <button
            className={
              taskScreen
                ? url.pathname === '/'
                  ? 'dashboard-session-logout button button-secondary'
                  : 'task-session-logout button'
                : undefined
            }
            type="button"
            disabled={busy || logoutBlocked}
            onClick={() => void session.logout()}
          >
            {busy ? 'Logging out…' : notice ? 'Retry logout' : 'Log out'}
          </button>
        </section>
      )}
    </div>
  );
}
