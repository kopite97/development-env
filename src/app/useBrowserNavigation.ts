import { useEffect, useRef, useState } from 'react';
import { locationUrl, readLocation, type WorkspaceLocation } from './routes';
const stateKey = 'devspace.navigation.v1';
type Entry = { session: string; index: number };
function readEntry(): Entry | null {
  const entry = window.history.state?.[stateKey];
  return entry && typeof entry.session === 'string' && Number.isInteger(entry.index) ? entry : null;
}
function replaceEntry(entry: Entry, url: string) {
  window.history.replaceState({ ...window.history.state, [stateKey]: entry }, '', url);
}
// Rejected popstate restores the existing entry, preserving the forward stack.
export function useBrowserNavigation(canNavigate: () => boolean) {
  const [snapshot, setSnapshot] = useState(() => {
    const entry = readEntry() ?? { session: crypto.randomUUID(), index: 0 };
    replaceEntry(entry, window.location.href);
    return { location: readLocation(new URL(window.location.href)), entry };
  });
  const current = useRef(snapshot);
  const guard = useRef(canNavigate);
  guard.current = canNavigate;
  const restoring = useRef(false);
  useEffect(() => {
    const pop = () => {
      const previous = current.current;
      const entry = readEntry();
      if (
        restoring.current &&
        entry?.session === previous.entry.session &&
        entry.index === previous.entry.index
      ) {
        restoring.current = false;
        return;
      }
      if (restoring.current || !guard.current()) {
        if (entry?.session === previous.entry.session && entry.index !== previous.entry.index) {
          restoring.current = true;
          window.history.go(previous.entry.index - entry.index);
        } else {
          replaceEntry(previous.entry, locationUrl(previous.location));
          restoring.current = false;
        }
        return;
      }
      const nextEntry = entry ?? {
        session: previous.entry.session,
        index: previous.entry.index + 1,
      };
      if (!entry) replaceEntry(nextEntry, window.location.href);
      const next = { location: readLocation(new URL(window.location.href)), entry: nextEntry };
      current.current = next;
      setSnapshot(next);
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  const update = (change: (location: WorkspaceLocation) => WorkspaceLocation, push = false) => {
    if (restoring.current) return false;
    const previous = current.current;
    const location = change(previous.location);
    const url = locationUrl(location);
    if (url === locationUrl(previous.location)) return true;
    if (push && !guard.current()) return false;
    const entry = push ? { ...previous.entry, index: previous.entry.index + 1 } : previous.entry;
    if (push) window.history.pushState({ [stateKey]: entry }, '', url);
    else replaceEntry(entry, url);
    const next = { location, entry };
    current.current = next;
    setSnapshot(next);
    return true;
  };
  return {
    location: snapshot.location,
    entryKey: `${snapshot.entry.session}:${snapshot.entry.index}`,
    update,
  };
}
