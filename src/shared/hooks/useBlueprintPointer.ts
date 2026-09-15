import { useEffect, useRef } from 'react';

type Sample = { x: number; y: number; target: EventTarget | null };

export function useBlueprintPointer(onSample?: (sample: Sample) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const callback = useRef(onSample);
  useEffect(() => {
    callback.current = onSample;
  }, [onSample]);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const media = matchMedia(
      '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
    );
    let frame = 0;
    let sample: Sample | null = null;
    const clear = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      sample = null;
      delete root.dataset.blueprintActive;
    };
    const move = (event: PointerEvent) => {
      if (!media.matches || event.pointerType !== 'mouse') return;
      sample = { x: event.clientX, y: event.clientY, target: event.target };
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!sample) return;
        const rect = root.getBoundingClientRect();
        const x = sample.x - rect.left;
        const y = sample.y - rect.top;
        const distance = Math.max(0, Math.min(x, y, rect.width - x, rect.height - y));
        // Short welcome strips still reach full local intensity at their center.
        const fadeWidth = Math.max(1, Math.min(80, rect.width / 2, rect.height / 2));
        const edge = Math.min(1, distance / fadeWidth);
        const opacity = edge * edge * (3 - 2 * edge);
        root.style.setProperty('--mouse-x', `${x}px`);
        root.style.setProperty('--mouse-y', `${y}px`);
        root.style.setProperty('--blueprint-edge-opacity', String(opacity));
        root.dataset.blueprintActive = 'true';
        callback.current?.(sample);
      });
    };
    root.addEventListener('pointermove', move);
    root.addEventListener('pointerenter', move);
    root.addEventListener('pointerleave', clear);
    root.addEventListener('pointercancel', clear);
    media.addEventListener('change', clear);
    return () => {
      clear();
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerenter', move);
      root.removeEventListener('pointerleave', clear);
      root.removeEventListener('pointercancel', clear);
      media.removeEventListener('change', clear);
    };
  }, []);
  return ref;
}
