import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export function useMobileNavigation(entryKey: string) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setIsOpen(false), []);
  useEffect(close, [entryKey, close]);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 680px)');
    const handleChange = () => {
      if (!media.matches) close();
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [close]);
  useLayoutEffect(() => {
    if (!isOpen) return;
    const menu = menuRef.current!;
    const trigger = triggerRef.current;
    const getControls = () =>
      [
        ...menu.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]'),
      ].filter((element) => element.getClientRects().length > 0);
    getControls()[0]?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (event: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
      if (event.key !== 'Tab') return;
      const controls = getControls();
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || !menu.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !menu.contains(document.activeElement))
      ) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      if (trigger?.getClientRects().length) trigger.focus();
      else menu.querySelector<HTMLElement>('.nav-item.active')?.focus();
    };
  }, [isOpen, close]);
  return { isOpen, menuRef, triggerRef, close, open: () => setIsOpen(true) };
}
