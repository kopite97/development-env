import { createContext, useContext, type ReactNode } from 'react';
import { usePersistedState } from '../../shared/hooks/usePersistedState';
import { initialLinks, isLinks, moveLink, type QuickLink } from './model';
function useLinksStore() {
  const [links, save, error] = usePersistedState('devspace.links.v1', initialLinks, isLinks);
  const upsert = (link: QuickLink) => {
    const next = links.some((l) => l.id === link.id)
      ? links.map((l) => (l.id === link.id ? link : l))
      : [...links, link];
    return isLinks(next) && save(next);
  };
  return {
    links,
    error,
    upsert,
    remove: (id: string) => save(links.filter((l) => l.id !== id)),
    move: (id: string, direction: -1 | 1) => save(moveLink(links, id, direction)),
  };
}
const Context = createContext<ReturnType<typeof useLinksStore> | null>(null);
export function LinksProvider({ children }: { children: ReactNode }) {
  return <Context.Provider value={useLinksStore()}>{children}</Context.Provider>;
}
export function useLinks() {
  const value = useContext(Context);
  if (!value) throw Error('LinksProvider is required');
  return value;
}
