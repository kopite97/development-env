import type { ReactNode } from 'react';
import { useBlueprintPointer } from '../hooks/useBlueprintPointer';

export function WelcomeStrip({ children }: { children: ReactNode }) {
  const ref = useBlueprintPointer();
  return (
    <div className="welcome-strip blueprint-surface" ref={ref}>
      {children}
    </div>
  );
}
