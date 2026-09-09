import { createContext, useContext, useState, type ReactNode } from 'react';
import { usePersistedState } from '../../hooks/usePersistedState';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { defaultLayout, isLayout, moveWidget, type Widget } from './model';
function useDashboardStore() {
  const [layout, save, error] = usePersistedState('devspace.layout.v1', defaultLayout, isLayout);
  const [draft, setDraft] = useState<Widget[] | null>(null);
  const canDiscard = useUnsavedChanges(
    draft !== null && JSON.stringify(draft) !== JSON.stringify(layout),
  );
  const cancel = () => {
    if (!canDiscard()) return false;
    setDraft(null);
    return true;
  };
  const commit = () => {
    if (draft === null || !save(draft)) return false;
    setDraft(null);
    return true;
  };
  const upsert = (widget: Widget) =>
    setDraft((current) => {
      const list = current ?? layout;
      return list.some((w) => w.id === widget.id)
        ? list.map((w) => (w.id === widget.id ? widget : w))
        : [...list, widget];
    });
  const move = (id: string, target: string) =>
    setDraft((current) => (current ? moveWidget(current, id, target) : current));
  const remove = (id: string) =>
    setDraft((current) => (current ? current.filter((w) => w.id !== id) : current));
  return {
    layout,
    items: draft ?? layout,
    editing: draft !== null,
    error,
    start: () => setDraft([...layout]),
    cancel,
    commit,
    upsert,
    move,
    remove,
    reset: () => setDraft([...defaultLayout]),
  };
}
const Context = createContext<ReturnType<typeof useDashboardStore> | null>(null);
export function DashboardProvider({ children }: { children: ReactNode }) {
  const store = useDashboardStore();
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useDashboard() {
  const value = useContext(Context);
  if (!value) throw Error('DashboardProvider is required');
  return value;
}
